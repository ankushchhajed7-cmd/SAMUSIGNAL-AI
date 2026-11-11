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

## v1.13.0 — 🟦 PERSONAL FX jaisa = REAL Strategy 3 ($0.25 TP + $1.50 SL)
- User ka faisla (11 Nov, 50 trade ke baad): sirf point 2 — paper ka "PERSONAL FX jaisa" ab REAL jaisa: TP $0.25, SL $1.50 (0.01 lot). Candle me pehle SL (savdhaan), phir TP.
- Purane (bina SL) hisaab: jo $1.50 se zyada ulta gaya (DD) = SL maana (TP se pehle hi), v=2 nishaan.
- History: net $, TP / SL ginti, jeet %, "86% se zyada jeet chahiye" note. Row: "🟦 P: SL −$1.50".
- Point 1 (🚀 se MARKET) user ne NAHI chuna — 🚀 abhi LIMIT hi.

## v1.14.0 — 🎯 Smart Order (SIRF PAPER, Kadam 1)
- `smartOrder` (engine, analyze me): situation dekh ke STOP / MARKET / LIMIT + `why`. Niyam engine.js me upar likhe (STOP: 15m+1H+4H saath, tang range kinare, mazboot candle, London/NY, 0.25 ATR gap, 45 min; MARKET: tez trend, LIMIT 0.7 ATR door, bhaga nahi; baaki LIMIT).
- Jhootha breakout: `evaluateStop` (15m close wapas range me = EARLY bahar), tulna ke liye `res0` (bina jaldi bahar) aur `evaluateStopConfirm` (#3 candle close entry).
- History: "🎯 Smart Order" dabba (kul, MARKET / STOP / LIMIT alag, jaldi bahar + bachaya $, candle-close tarika). Result screen line + "क्यों". Firebase paperRow `smart`.
- 🚀 abhi LIMIT hi (Kadam 2 alag Final se).

## v1.15.0 — "✅ मैंने trade लिया" (auto paper band) + data reset (11 Nov)
- Analysis ab apne aap paper trade NAHI banata: rec.preview = 'NEW' (st.preview), Result screen pe bada "✅ मैंने trade लिया" button. Dabane par (ya 🚀 MT5 bhejne par apne aap) History + paper me judta hai; us pal se gina jaata hai (r.at = dabane ka samay, entry / SL / TP signal wale). Ek pair pe ek chalu trade ka niyam wahi.
- Ek baar reset: phone ki History + cLedger / mLedger saaf, Firebase /samuai/paper DELETE (fail ho to agli baar dobara). User: "aaj se 100 trade ka data aane pe final karenge".

## v1.16.0 — 📋 Scanner (saare pair) + Auto scan + alert
- Home tools me "📋 Scan" -> `s-scan`. `feedAllBars` (data.js): ek fetch me saare pair ki 15m / 1h band candles + live. Engine `analyze` har pair pe (free). Achhe = Grade A/B + 15m/1H saath + us pair pe chalu trade nahi; score se sort.
- Top 5 (auto me 3) pe AI check (Gemini), 4 sec gap, same signal 60 min cache. Filter: AI सहमत / अच्छे / सारे. Row dabao -> poora signal (preview NEW: ✅ मैंने trade लिया / 🚀).
- Auto scan (LS autoScan): app khula + MT5 feed ho to har nayi 15m candle ke 25 sec baad; naya Grade A + AI सहमत -> toast + vibrate + notification (ek signal ek baar, sxSeen 2 din).
- Scan ke signal apne aap paper me nahi.

## v1.16.1 — ANALYZE gola neeche kat raha tha
- Gola (span.c) 14px upar, ring path radius 43 -> 40, letter-spacing 2.6px, svg overflow visible — akshar ab screen ke neeche nahi katte, History label se bhi door.

## v1.17.0 — History: sirf TP + SL gine, EXPIRED chhupa (11 Nov)
- SIGNALS = sirf TP + SL (7 din), neeche chhota "· N चालू" (PENDING / OPEN).
- EXPIRED (entry nahi bhari) History list aur Home chart (lastSig) me nahi dikhta. Andar se tab tak rehta hai jab tak MARKET / Smart / PFX / Council hisaab poora na ho, phir pruneExpired (6h) apne aap delete — taaki paper stats sahi rahein.

## v1.17.1 (branch feature-v1.17.1) — code review ke 3 bug fix + 3 chhote sudhaar (11 Nov)
- **Bug: chalu (OPEN) trade "EXPIRED" ban jaata tha.** Har baar fill dobara dhoondha jaata tha; candles ki khidki (5-min pe ~25 ghante) fill se aage nikalte hi OPEN -> EXPIRED -> History se chhup jaata, jeet % galat, 🟦 PERSONAL FX ka 48h TIMEOUT kabhi nahi aata.
  Ab `filledAt` yaad: engine `evaluate` / `evaluatePfx` / `evaluateStop` me `fillAt` (app `evalSym` deta hai — res, tres, pres, cres, sres, sres0, sres3 sab). PFX ka DD (`mae0`) aur Trail ka peak (`peak0`, sirf jab fill wali candle data se bahar ho) bhi bana rehta hai.
- **Bug: 🚀 MT5 pe gaya order record se gayab.** "Sirf dekhne ke liye" (us pair pe pehla trade chalu) signal ko 🚀 bhejne par order jaata tha par History me nahi judta — reload pe status gayab. Ab 🚀 se gaya har order HAMESHA History me (`takeTrade(id, true)` active-trade rok nahi lagata). "✅ मैंने trade लिया" ka ek-pair-ek-trade niyam waisa hi.
- **Bug: ⚡ MARKET / 🎯 Smart MARKET ka paper bhaav purana.** "✅ मैंने trade लिया" / 🚀 dabane ke pal ka live bhaav lekar entry wahan khiskaate hain, SL / TP ki doori wahi (`reMarket`, engine). LIMIT / STOP nahi chhedte. Bhaav na mile to jaisa tha.
- Gemini: "band" maana gaya model ab 24 ghante baad dobara aazmaaya jaata hai (`gDeadAt`) — pehle hamesha ke liye hat jaata tha.
- `npm test` me ab news ke tests bhi (kul 50: engine 20 + version 1 + flow 4 + news 20 + newsbrief 5).
- `sw.js` shell me `news.html` + `src/news.js` / `newsrules.js` / `newsbrief.js` — NEWS page pehli baar se offline.
- News page ka apna version 1.4.0 wahi (news code nahi chhua).
### Pending
- **Firebase suraksha (user ne abhi chhoda):** database URL public repo me hai aur app bina auth ke likhta hai — rules band + Auth (app me khaana hai; VPS ke EA me bhi wahi) karna baaki.

## v1.18.0 (branch feature-v1.18.0) — 🟦🎯 Smart entry + REAL niyam (SIRF PAPER) (11 Nov)
- Sawaal (user): market ke hisaab se LIMIT / STOP / MARKET dena sahi hai kya — jabki REAL me LIMIT pe ~95% jeet (4–11 Nov, ~35 TP / 1 SL, BTC chhod kar).
  Faisla: REAL aur 🚀 button **LIMIT hi** (kuch nahi badla). Paper me barabari ki tulna chahiye thi: Smart Order ka purana hisaab 1R TP se tha, REAL niyam $0.25 TP / $1.50 SL hai — jeet % ki tulna galat thi.
- Naya: jahan Smart ne **MARKET / STOP** chuna, wahan usi entry par REAL niyam ka paper (`r.spres`): MARKET = signal ke pal bhara, STOP = bhaav entry ko aage ki taraf chhue tab (45 min), phir $0.25 TP / $1.50 SL, 48h TIMEOUT.
  Engine `evaluatePfx` me `sig.stop` (STOP jaisa fill; fill wali candle ka DD sirf close se). LIMIT wale Smart ka yahi hisaab pehle se `r.pres` hai.
- History: naya dabba "🟦🎯 Smart entry + REAL नियम" — ⚡ MARKET aur 🚀 STOP alag, har ek me **usi signal par** "MARKET / STOP se" vs "wahi LIMIT se" (net $, TP / SL, %, nahi bhara, chalu). `pfxStat` (engine).
- Result screen: Smart Order line ke neeche "🟦 REAL नियम ($0.25 / $1.50) इसी entry पर: …". Firebase paperRow `smart.pfx`.
- Spread / slippage shamil NAHI — asal me MARKET / STOP thoda kam kamaenge (dabbe me likha hai).
- Bug fix: 🟦 PERSONAL FX jaisa hisaab (pres / spres) 48 ghante baad "chalu" atka reh jaata tha (jaanch 48h par band, TIMEOUT 48h ke baad) — ab `refreshResults` 48h par TIMEOUT / EXPIRED laga deta hai. (v1.17.1 ke note me "48h TIMEOUT ab aayega" isi se poora hua.)
- Tests: kul 52.
### Pending
- Kam se kam 20–30 MARKET + STOP signal jama hone par tulna dekh kar faisla (100 trade wale review ke saath). Tab tak REAL = LIMIT.
- Spread ko hisaab me jodna (MT5 feed ke `sp` ki unit pakki karke).
- Firebase suraksha (rules + Auth) — abhi bhi baaki.

## v1.19.0 (branch feature-v1.19.0) — 🤖 Scan ke "AI सहमत" signal apne aap paper trade (11 Nov)
- User: "Scan me AI sahmat wale saare trade auto paper trading me lag jaayein."
- `sxPaper` (app.js): scan ke baad jin signal par AI check hua aur AI सहमत — apne aap History / paper me (`r.auto = 'scan'`, `taken.by = 'scan'`). Scan screen par button "🤖 AI सहमत → paper: ON / OFF" (LS `sxPaper`, default ON). Haath se scan aur ⏱ Auto scan dono me.
- Niyam: ek pair pe ek chalu trade (wahi); wahi signal (pair + disha + entry) 2 din tak dobara nahi (LS `sxTaken`). AI check sirf top 5 (auto scan me top 3) par hota hai — utne hi jud sakte hain. In par Council NAHI chalta (Gemini limit). MT5 par kuch NAHI jaata.
- History: upar nayi pankti "सब · ✋ मेरे · 🤖 Scan auto" (LS `hv`) — poora hisaab (jeet %, balance, MARKET, Trail, Smart, PFX, Council) chuni hui tarah par. Row me 🤖 nishaan. Firebase paperRow `auto`. mLedger / cLedger me `auto`.
  **User ka "100 trade" wala data = ✋ मेरे.** Auto wale usme nahi milte.
- 300 ki seema: zyada hone par pehle sabse purane poore ho chuke 🤖 auto hatte hain. Nateeja jaanch: MT5 feed par ek baar me 12 -> 30 pair.
- Auto scan sirf app khula + MT5 feed LIVE ho tab (pehle jaisa) — band app par paper trade nahi bante.
### Pending
- Band app par bhi scan + paper (VPS / server chahiye).
- Firebase suraksha (rules + Auth) — abhi bhi baaki.
