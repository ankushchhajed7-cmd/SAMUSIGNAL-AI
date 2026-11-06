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
