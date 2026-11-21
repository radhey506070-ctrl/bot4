// GitHub Actions: zone ke paas aaye stocks ka phone alert (ntfy). Settings = config.json
const fs = require("fs"), ZN = require("./docs/zones.js");
const cfg = JSON.parse(fs.readFileSync("config.json", "utf8"));
const S = { ...ZN.DEF, ...cfg, pats: { ...ZN.DEF.pats, ...(cfg.pats || {}) } };
const PCT = cfg.alert_distance_pct, cand = JSON.parse(fs.readFileSync("docs/candles.json", "utf8")), cur = {};
for (const tf of cfg.alert_timeframes)
  for (const [sym, cd] of Object.entries(cand[tf] || {})) {
    const v = ZN.zoneScan(cd, S); if (!v) continue;
    for (const zt of ["demand", "supply"]) {
      const b = ZN.pick(v, zt, "approach", { ...S, near: PCT });
      if (b && ZN.emaOK(cd, zt, S)) cur[`${sym}|${tf}|${zt}|${Math.round(b.top)}`] = `${sym} ${tf} ${zt} zone - ${b.dist.toFixed(2)}% away (LTP ${b.c.toFixed(2)})`;
    }
  }
let old = []; try { old = JSON.parse(fs.readFileSync("docs/alerts.json", "utf8")); } catch (e) {}
const fresh = Object.entries(cur).filter(([k]) => !old.includes(k)).map(([, m]) => m);
(async () => {
  const topic = process.env.NTFY_TOPIC;
  if (fresh.length && topic) {
    try { await fetch("https://ntfy.sh/" + topic, { method: "POST", body: fresh.join("\n"), headers: { Title: "Zone Alert", Priority: "high" } }); console.log("Alert sent:", fresh.length); }
    catch (e) { console.log("ntfy error:", e.message); }
  }
  fs.writeFileSync("docs/alerts.json", JSON.stringify(Object.keys(cur).sort()));
  console.log("approaching now:", Object.keys(cur).length, "| new:", fresh.length);
})();
