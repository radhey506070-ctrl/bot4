"""GitHub Actions: saare F&O stocks ke candles + trend export (docs/candles.json, docs/data.json).
Zones website/alert.js khud nikalte hain (docs/zones.js)."""
import json, os, sys, time, datetime as dt
from app import fno_stocks, candles, resample, TOKEN, TFS

if not TOKEN:
    sys.exit("UPSTOX_TOKEN secret set nahi hai")
cfg = json.load(open("config.json"))
KEEP = 150  # har timeframe ke aakhri 150 candles website ko jate hain


def trend(df):
    """U = Uptrend (close > EMA20 > EMA50), D = Downtrend (close < EMA20 < EMA50), S = Sideways."""
    c = df["c"].astype(float)
    e20, e50 = c.ewm(span=20, adjust=False).mean().iloc[-1], c.ewm(span=50, adjust=False).mean().iloc[-1]
    return "U" if c.iloc[-1] > e20 > e50 else "D" if c.iloc[-1] < e20 < e50 else "S"


trends, cand = {}, {tf: {} for tf in TFS}
stocks = fno_stocks()
print("F&O stocks:", len(stocks))
for n, (sym, key) in enumerate(stocks.items(), 1):
    try:
        d, w, m = candles(key, "days", 2), candles(key, "weeks", 5), candles(key, "months", 15)
        fr = {"Daily": d, "Weekly": w, "Monthly": m}
        if len(m) > 10:
            fr.update({"Quarterly": resample(m, 3), "Half Yearly": resample(m, 6), "Yearly": resample(m, 12)})
        trends[sym] = {tf: trend(fr[tf]) for tf in ("Daily", "Weekly", "Monthly") if len(fr[tf]) > 50}
        for tf, df in fr.items():
            if len(df) > 8:
                cand[tf][sym] = {k: [round(float(x), 2) for x in df[k].values[-KEEP:]] for k in "ohlc"}
    except Exception as e:
        print(sym, "error:", e)
    if n % 20 == 0:
        print(n, "/", len(stocks))
    time.sleep(0.3)

if sum(len(v) for v in cand.values()) == 0:
    sys.exit("Koi data nahi mila - token ya API check karein")  # purana data bacha rahega
os.makedirs("docs", exist_ok=True)
with open("docs/candles.json", "w") as f:
    json.dump(cand, f, separators=(",", ":"))
ist = dt.timezone(dt.timedelta(hours=5, minutes=30))
with open("docs/data.json", "w") as f:
    json.dump({"updated": dt.datetime.now(ist).strftime("%d %b %Y, %I:%M %p IST"), "total": len(stocks), "trend": trends,
               "alert_tfs": cfg["alert_timeframes"], "alert_pct": cfg["alert_distance_pct"]}, f)
print("Done")
