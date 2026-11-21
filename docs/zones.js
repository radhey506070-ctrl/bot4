/* Supply Demand PRO scanner logic - website aur GitHub alert (node) dono yahi file use karte hain */
(function (root) {
  const DEF = {
    bases: [1], baseMax: 50, openEdge: true, zoneEdge: true,
    legBodyOn: true, legIn: 60, legOut: 60, legLarger: true, legCompare: "Body",
    legInMultOn: true, legInMult: 3, legOutMultOn: true, legOutMult: 4,
    pats: { RBR: false, DBR: true, DBD: false, RBD: true },
    confBars: 20, confBody: 50, cancelEnter: true,
    curPrice: true, seq: false, retestDir: true, touchTol: 0,
    slBufOn: false, slBuf: 0.02, rr: 5, entryEdge: true, entryBody: false,
    maxZ: 50, disp: "Both", emaOn: false, emaFast: 20, emaSlow: 50, look: 100, near: 1, pop: null
  };

  function zoneScan(cd, S) {
    const O = cd.o, H = cd.h, L = cd.l, C = cd.c, N = C.length; if (N < 9) return null;
    const body = i => Math.abs(C[i] - O[i]), rng = i => H[i] - L[i], pct = i => H[i] > L[i] ? body(i) / rng(i) * 100 : 0;
    const sz = S.legCompare == "Range" ? rng : body, bases = [...S.bases].sort((a, b) => a - b), tol = +S.touchTol || 0;
    function setup(t, n) {
      let bh = -1e18, bl = 1e18, bmc = -1e18, bnc = 1e18, bbt = -1e18, bbb = 1e18, mb = 0;
      for (let i = t - n; i < t; i++) {
        if (pct(i) > S.baseMax) return null;
        bh = Math.max(bh, H[i]); bl = Math.min(bl, L[i]); bmc = Math.max(bmc, C[i]); bnc = Math.min(bnc, C[i]);
        bbt = Math.max(bbt, O[i], C[i]); bbb = Math.min(bbb, O[i], C[i]); mb = Math.max(mb, sz(i));
      }
      const li = t - n - 1;
      if (S.legBodyOn && (pct(li) < S.legIn || pct(t) < S.legOut)) return null;
      if (S.legLarger && !(sz(li) > mb && sz(t) > mb)) return null;
      if (S.legInMultOn && !(sz(li) >= S.legInMult * mb)) return null;
      if (S.legOutMultOn && !(sz(t) >= S.legOutMult * mb)) return null;
      const iu = C[li] > O[li], idn = C[li] < O[li], ou = C[t] > O[t], od = C[t] < O[t], bu = C[t] > bh, bd = C[t] < bl;
      const ph = Math.max(H[li], bh, H[t]), pl = Math.min(L[li], bl, L[t]), P = S.pats; let r = null;
      if (iu && ou && bu && P.RBR) r = [1, S.zoneEdge ? bh : S.openEdge ? bbt : bmc, Math.min(bl, L[t])];
      else if (idn && ou && bu && P.DBR) r = [1, S.zoneEdge ? bh : bmc, pl];
      else if (idn && od && bd && P.DBD) r = [0, Math.max(bh, H[t]), S.zoneEdge ? bl : S.openEdge ? bbb : bnc];
      else if (iu && od && bd && P.RBD) r = [0, ph, S.zoneEdge ? bl : bnc];
      return r && { dem: r[0], top: r[1], bot: r[2], lh: H[t], ll: L[t], bar: t, bt: bbt, bb: bbb };
    }
    let pend = [], zs = [], lDB = null, lST = null;
    for (let t = Math.max(6, N - 1 - S.look); t < N; t++) {
      for (let pi = pend.length - 1; pi >= 0; pi--) {
        const p = pend[pi], age = t - p.bar;
        const conf = p.dem ? (C[t] > O[t] && C[t] > p.lh && pct(t) >= S.confBody) : (C[t] < O[t] && C[t] < p.ll && pct(t) >= S.confBody);
        if (age >= 1 && age <= S.confBars && conf) {
          const okP = !S.curPrice || (p.dem ? p.top < C[t] : p.bot > C[t]);
          const okS = !S.seq || (p.dem ? (lDB === null || p.top < lDB) : (lST === null || p.bot > lST));
          if (okP && okS && p.top > p.bot) {
            zs.push({ top: p.top, bot: p.bot, dem: p.dem, c: t, tested: false, bt: p.bt, bb: p.bb });
            if (p.dem) lDB = p.bot; else lST = p.top;
            if (zs.length > S.maxZ) zs.shift();
          }
          pend.splice(pi, 1);
        } else if (age > S.confBars) pend.splice(pi, 1);
        else if (S.cancelEnter && age >= 1 && L[t] <= p.top && H[t] >= p.bot) pend.splice(pi, 1);
      }
      let sel = null; for (const n of bases) { if (t - n - 1 >= 0) { const r = setup(t, n); if (r) sel = r; } }
      if (sel) pend.push(sel);
      for (let zi = zs.length - 1; zi >= 0; zi--) {
        const z = zs[zi]; if (t <= z.c) continue;
        if (z.dem ? C[t] < z.bot : C[t] > z.top) { zs.splice(zi, 1); continue; }
        if (!z.tested) {
          const touch = L[t] <= z.top + tol && H[t] >= z.bot - tol, dOK = !S.retestDir || (z.dem ? C[t] > O[t] : C[t] < O[t]);
          if (touch && dOK) { if (S.disp == "Fresh Only") zs.splice(zi, 1); else z.tested = true; }
        }
      }
    }
    const keep = z => S.disp != "Tested Only" || z.tested, m = z => [z.top, z.bot, z.tested, z.bt, z.bb];
    return { z: { demand: zs.filter(z => z.dem && keep(z)).map(m), supply: zs.filter(z => !z.dem && keep(z)).map(m) }, px: [C[N - 1], H[N - 1], L[N - 1]] };
  }

  /* criteria ke hisaab se stock ka sabse paas wala zone */
  function pick(v, zt, crit, S) {
    let best = null; const [c, h, l] = v.px, tol = +S.touchTol || 0;
    for (const [top, bot, tested, bt, bb] of v.z[zt] || []) {
      const touch = h >= bot - tol && l <= top + tol, dist = c > top ? (c - top) / c * 100 : c < bot ? (bot - c) / c * 100 : 0;
      const side = zt == "demand" ? c > top : c < bot;
      if ((crit == "zone" && touch) || (crit == "approach" && !touch && side && dist <= S.near))
        if (!best || dist < best.dist) best = { top, bot, tested, bt, bb, touch, dist, c };
    }
    return best;
  }
  /* Entry / SL / Target */
  function trade(b, zt, S) {
    const dem = zt == "demand";
    const entry = S.entryBody ? (dem ? b.bt : b.bb) : S.entryEdge ? (dem ? b.top : b.bot) : b.c;
    let sl = dem ? b.bot : b.top; if (S.slBufOn) { const f = entry * S.slBuf / 100; sl = dem ? sl - f : sl + f; }
    const risk = Math.abs(entry - sl);
    return { entry, sl, tp: dem ? entry + S.rr * risk : entry - S.rr * risk };
  }
  function emaLast(a, n) { const k = 2 / (n + 1); let e = a[0]; for (let i = 1; i < a.length; i++) e = a[i] * k + e * (1 - k); return e; }
  function emaOK(cd, zt, S) {
    if (!S.emaOn) return true;
    const f = emaLast(cd.c, S.emaFast), s = emaLast(cd.c, S.emaSlow), c = cd.c[cd.c.length - 1];
    return zt == "supply" ? (f > s && c > f && c > s) : (f < s && c < f && c < s);
  }
  const api = { DEF, zoneScan, pick, trade, emaOK };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ZN = api;
})(this);
