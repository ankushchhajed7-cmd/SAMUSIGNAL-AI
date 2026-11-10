# STATE — SAMUSIGNAL AI

## NEWS SIGNAL page (news.html) — v1.0.0
Alag page, baaki app (index.html, src/app.js, sw.js, package.json, purane tests) ko chhoota nahi.
Link: `.../SAMUSIGNAL-AI/news.html`

### Files (sirf naye)
- `news.html` — page + CSS
- `src/news.js` — UI, calendar, countdown, signal, history
- `src/newsrules.js` — rule-book (pure logic, test hota hai)
- `tests/news.test.mjs` — 12 tests (`node --test tests/news.test.mjs`)

### Kaise kaam karta hai
- Pairs: XAUUSD + EURUSD. Calendar: Forex Factory free feed (USD, High impact; Setting me Medium bhi).
- Rule: USD data forecast se zyada = USD mazboot -> dono SELL; kam = dono BUY. Unemployment / Claims me ulta. Speech / statement = no trade.
- Asli number tum daalte ho (Enter) — usi second signal. Confidence = surprise ke size se rule-based andaza (50–65%), guarantee nahi.
- Nateeja: entry (signal ke second ka bhaav) se 5 min baad ki keemat -> WIN / LOSS / FLAT + pips; 30 min bhi dikhta hai. Gold 1 pip = $0.10; FLAT < 10 pip (gold) / 3 pip (EURUSD). Bhaav SamuSignal wale MT5 Data Feed / TwelveData se (data.js se sirf padhta hai).
- localStorage: `sai_news_*` (alag).

### Faisle
- v1 me asli number haath se (free source number nahi deta); koi paid feed / server nahi.
- Koi ordering / MT5 bhejna nahi — sirf signal page par.
- Trial / Upgrade / payment nahi (apna personal app).

### Baaki kaam (v2 idea)
- Number apne aap (tez feed / server), band app par phone alert (Web Push + server).
- Kuch aur pairs, per-news-type win-rate.
- Kam se kam 30 signal jama hone ke baad History se rule-book ko parakhna.

## v1.9.7 (branch feature-news-link-v1.9.7) — ऐप से NEWS पेज का लिंक
- `index.html` me home ki tools wali pankti me ek "📰 News" button (Council · Order Flow · **News** · Refresh · Data). Dabane par `news.html` khulta hai.
- Badlav sirf `index.html` me 2 jagah (grid 4 -> 5 column + ek button). app.js / sw.js / package.json nahi chhue.
- Wapas aane ke liye news page ka ← button.
- App version 1.9.6 -> **1.9.7** (app.js, sw.js, package.json teeno ek jaise; version test pass). News page ka apna version 1.0.0.

## NEWS SIGNAL v1.1.0 (app v1.9.8) — asli number MT5 se APNE AAP
- VPS pe EA `Samusignal/vps-ea/SamuSignal News Pusher v1.00.mq5` (Data Feed wale terminal pe, trade nahi karta):
  MT5 ka apna Economic Calendar padhta hai -> Firebase `/feed/news/cal` (har 10 min) + `/feed/news/act/<id>` (number aate hi, 0.5 sec check) + `/feed/news/meta`.
  act = {t, title, act, fc, pv, mi (MT5 andaza +1/-1), seen (UTC sec), px:{XAUUSD, EURUSD} usi pal ka bid}.
- news.js: calendar pehle MT5 se (na mile to Forex Factory); act ko EventSource (Firebase stream) + release ke aas-paas 1.5 sec poll se sunta hai -> `fire()` apne aap.
  Entry = EA ka px (usi pal), signal time = seen. Card: "📡 MT5 auto · release ke Xs baad · phone tak Ys". Haath se number backup.
- newsrules: `tradeable(ev)` (hamara rule ya MT5 indicator, speech kabhi nahi), `evaluate(ev, a, {mi})` — hamara rule na ho to MT5 ka andaza.
- Tests: news 16.

## NEWS SIGNAL v1.2.0 (app v1.9.9) — 🤖 AUTO paper trade (button nahi)
- User ka faisla: "maine liya" button NAHI; har signal apne aap ek paper trade = MT5 ne number dekha usi pal ka bhaav (act.px), lot 0.01, target default gold $10 / EURUSD $3 (Setting me badlo).
- Teen nateeje saath-saath: ⏱ 1 min baad exit (MAIN), 🎯 $ target (na aaye to 30 min ka), 5 min. Signal card + History me har pair ke neeche.
- Bhaav: News Pusher v1.02 ka TAPE (`/feed/news/tape/<key>`, news ke baad 6 min har second ka bid); na ho to 1-min candles.
- History me "🤖 Auto trade का हिसाब": har exit ka jeet % + $, target kitni baar, औसत देर.
- MT5 par koi order NAHI. Asli auto trade: pehle 15–20 news ka data -> demo pe EA -> phir hi real (alag "Final").

## NEWS SIGNAL v1.3.0 (app v1.10.0) — VPS pe auto paper + phone push (app band ho tab bhi)
- EA `SamuSignal News Pusher v1.03` (Samusignal/vps-ea): High USD news pe khud signal (app jaisa niyam) + paper trade (usi pal ka bid, 0.01 lot, gold $10 / baaki $3 target), 1 min / 5 min / target (na aaye to 30 min) -> `/feed/news/paper/<id>`.
  MT5 PUSH (SendNotification): 5 min + 1 min pehle, number aate hi SIGNAL, 1 min nateeja, TARGET. Terminal me Tools > Options > Notifications (MetaQuotes ID).
- news.js: `/feed/news/paper` har 20 sec; History me VPS wale trade (🖥) — phone band tha unke bhi; summary VPS + local (jo VPS pe nahi). Local auto take sirf jab VPS ka na ho.
- MT5 par koi order NAHI.

## v1.11.0 — 🟦 PERSONAL FX jaisa (paper)
- REAL account (PERSONAL FX) ka niyam: $0.25 TP (0.01 lot), SL NAHI. Har signal pe paper: LIMIT fill wahi, phir TP kitne min me + bhaav sabse zyada kitna ulta gaya (DD $) — chhupa khatra. 48h me TP nahi = TIMEOUT.
- History me alag dabba + har row me "🟦 P: TP 12m · DD −$x". Firebase paperRow me `pfx`. Grid / averaging shamil nahi.

## NEWS SIGNAL v1.4.0 (branch feature-news-ai-v1.4.0) — 🤖 AI tab: ख़बर-AI + purane Gemini ka hisaab saath-saath
- Naya tab **🤖 AI** (news.html me 5 tab). Baaki app (index.html, app.js, sw.js, package.json, ai.js) ko chhoota nahi; app version 1.11.0 wahi.
- Naya `src/newsbrief.js`: Gemini + **Google Search grounding** se live ख़बरों ka saar — XAUUSD / EURUSD ke liye UP / DOWN / NEUTRAL + 2-3 line wajah + ख़बरें + sources. Button dabane par hi chalta hai (apne aap nahi — Gemini limit bachti hai).
- Sirf jaankari + paper hisaab: BUY/SELL signal nahi, MT5 / Firebase par kuch nahi jaata.
- Nateeja: brief ke time ka bhaav (p0) vs 30 min baad ka bhaav (p1). WIN/LOSS; FLAT = gold < $1 (10 pip) / EURUSD < 3 pip; NEUTRAL ginti me nahi.
- Do hisaab saath: (1) 🧠 purana Gemini (Council) — app ka `sai_cLedger` sirf PADHA jaata hai (jeet %, $), (2) 📰 naya ख़बर-AI — `sai_news_briefs` me apna.
- Bhaav ke liye `quotes()` (MT5 feed ya TwelveData) — 30 min baad ek baar; 2 ghante se purana ho to nateeja nahi lagta.
- Tests: `tests/newsbrief.test.mjs` (5). Poore 43 pass. `package.json` ka "test" script nahi badla (news tests alag chalte hain: `node --test tests/news.test.mjs tests/newsbrief.test.mjs`).
### Pending
- Kam se kam 20-30 nateeje jama hone par dono ki jeet % ki tulna.
- Agar Google Search grounding free key par na chale to error dikhega — tab batao.

## v1.12.0 — ANALYZE akshar gol ghoomte
- User ka chitra (E4): button ke chaaron or ek hi baar "A N A L Y Z E" (SVG textPath, radius 43), 9 sec me ek chakkar; neeche ka label chhupa (screen reader ke liye rakha). prefers-reduced-motion pe ruk jaata hai.
