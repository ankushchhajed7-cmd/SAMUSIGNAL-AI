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

## v1.20.0 — Pairs + Scanner me forex ke hisse (12 Nov)
- User: "pair divide kar dena — Majors, EUR cross, GBP cross, AUD/NZD, CAD/CHF..." + "Scanner me bhi..final".
- symbols.js: har forex pair me `cat` — Majors (USD wale 7) / EUR (6) / GBP (5) / AUDNZD (7) / CCJ = CAD/CHF/JPY cross (3); Gold `Metals`, BTC `Crypto`; `GROUPS` list. `group: 'Forex'` wahi (contract size wagairah).
- Pairs page tabs: ★ Favourites · Majors · EUR Cross · GBP Cross · AUD / NZD · CAD / CHF / JPY · Metals · Crypto (search pehle jaisa sab me).
- Scanner: naya chips row (sab + 7 group, har ek me ginti — upar wale AI sahmat / achhe / saare filter ke hisaab se), LS `sxG`. Sirf dikhane ka filter — scan / AI check / paper / alert saare pair par wahi.

## v1.37.0 (branch feature-sentinel-v1.37.0) — 🛡️ FX SENTINEL page (Kadam 1: PAPER) (25 Nov)
- User: 24/7 forex bot — major pairs watch, live news + deep technical, high-probability setup par proper reasoning + TP + SL, EMA/ADX me kuch naya. Choices: Auto Trade, 7 Majors + XAUUSD, nateeje SAMUSIGNAL AI me, news = MT5 Calendar + Gemini. Phir: "pehle SAMUSIGNAL app me naya page, shuru me isi par check karenge".
- Naya alag page `sentinel.html` + `src/sentinel.js` (UI + scan loop) + `src/sentinelrules.js` (pure niyam) + `tests/sentinel.test.mjs` (14 test). Home tools me 7va button 🛡️ **Sentinel** (kaala + sunehra). Baaki app nahi chhua.
- Data: sirf MT5 Data Feed (`/feed/bars/15min`, `/feed/bars/1h`, `/feed/live`) — 0 TwelveData credit. H4 = 1H se joda.
- Scan: page khula ho to har nayi 15m candle ke 25 sec baad (aur "📡 अभी Scan"). Score 0–100:
  Trend H4+H1 (25) · ADX ≥ 20 + BADHTA + DI gap (15) · Efficiency Ratio chop filter (15) · Currency Strength Meter saare feed pair (20) · EMA20 stretch / pullback ATR me (15) · M15 trigger candle + MACD + RSI (10) · Gemini news bias +10 / −15 · self-learning (pair ke 8+ trade: jeet % se −10..+5).
  Rok: H4/H1 alag, DI ulta, ER < 0.12, strength ulta, RSI extreme, session OFF (Asia / raat / weekend / Friday 19 UTC ke baad), High news ±30 min (MT5 cal + Forex Factory), spread > SL ka 15%.
- Order: sirf BUY / SELL LIMIT (REAL jaisa), entry EMA20 pullback / live se 0.2 ATR, SL = 12 candle swing + 0.3 ATR (kam se kam 1 ATR M15 aur ½ ATR H1, zyada se zyada 2.5 ATR), TP = 1.8R (Setting), expiry 60 min.
- Default minScore 75. Risk: ek pair ek trade, ek saath 3, daily loss $5, SL ke baad us pair par 2 ghante aaram. Paper lot 0.01.
- Paper nateeja: 15m candle (bid + spread): BUY fill = low ≤ entry − spread; ek candle me SL + TP = SL; fill wali candle me sirf SL; 24h = TIME; na bhara = EXPIRED. Har minute jaanch.
- Gemini (SamuSignal key) + Google Search: 8 currency STRONG / WEAK / NEUTRAL + XAU; sirf jab koi setup kareeb ho aur pichhla > 30 min purana (60 min tak maana jaata hai).
- Tabs: Radar (Currency Strength, 8 pair score + tap = har hissa ka point aur wajah) · Trades (chalu + aaj ke) · History (net $, win %, R, pair-wise) · Setting. Screen ON (wake lock) + phone notification toggle.
- localStorage: `sai_sen_*`. MT5 par koi order NAHI jaata.
- App 1.36.0 -> **1.37.0** (app.js, sw.js, package.json; sw SHELL me sentinel files; npm test me sentinel tests). Kul 82 test pass. Playwright (mock feed) se jaancha: radar, 3 trade ki seema, trades / history / setting, side-scroll nahi.
### Pending
- Kuch din ka paper record (kam se kam 30–50 band trade) dekh kar minScore / RR parakhna.
- Kadam 2: VPS EA `SAMU FX Sentinel` (24/7, asli auto trade, Gold Luxe full-screen dashboard, nateeje isi page par Firebase se) — paper achha chalne ke baad, demo pehle.
- Backtest technical core ka SAMU Backtest Lab me.
- Feed ke `sp` ki unit pakki nahi — ajeeb ho to aam spread maana jaata hai (DEF_SPREAD).

## v1.36.0 — 🕯️ Candle page hataya (24 Nov)
- User: "Candle wala option kaafi safal nahi, app se hata do, uski jagah naya strategy daalenge".
- Header se 🕯️ Candle button + uska CSS hataya; `candle.html` + `src/candle.js` delete; sw.js SHELL se hataye. `src/candlerules.js` + `tests/candle.test.mjs` rehte hain (VPS scanner Pages se candlerules.js leta hai; scanner v1.12 me Candle band).

## v1.35.0 — Candle 1.14.0: CANDLE EA v1.09 AUTO PICK dikhana (17 Nov)
- EA v1.09 (Samusignal repo): AUTO PICK (EA khud ~15 pair me se score se chune), seedhi slot 8/6/4, target $3 + TARGET LOCK, BOOK $0.10, TIME 300.
- App: `eaLine()` me "(सीढ़ी 8,6,4) · target $3.00"; Candle note me `S.ea.auto` ho to "🎯 AUTO PICK …" + aakhri jaanch (`S.ea.pick`); EA trade row me `why` "AUTO <score> (…)" ka pehla hissa. Paper (VPS) abhi bhi app ke ON pair par. Candle 1.14.0, app 1.35.0.

## v1.34.0 — Candle 1.13.0: EA ka badle ka pair app me (16 Nov)
- User: CANDLE EA me koi pair floating −$2 se neeche = us din band; uski jagah dusra pair apne aap ON + notification (4 pair chalte rahein). EA v1.03 (Samusignal) `/candle/cfg` `pairs` me badla pair PATCH karta hai + `/candle/cfg/auto/<NAME>` {d, for, t}; agle din hata deta hai.
- App: `cfgSync` ab PATCH (PUT nahi — `auto` na mite); `pullCfg()` boot par aur har 20 sec Firebase ke pair maanta hai (user ke badlav ke 15 sec tak nahi), naya auto pair aaye to toast; Pairs me "🤖 auto — X आज बंद है, उसकी जगह…"; Pairs note me niyam. Candle 1.13.0, app 1.34.0.

## v1.33.0 — Candle 1.12.0: 🎯 TP ka naap (sirf paper) (16 Nov)
- User: "TP candle ka 50% kaise kaam karta hai, positive candle bhi kam close" → sujhaav ① naap → "Final".
- `candlerules`: `paperResolve` ab har done par `mfe` (trade me sabse zyada fayda $) + `mfe1` (pehli candle me) deta hai; `p.trail` {arm, lock}: +arm par SL +lock pakka, TP door wala tak, arm ke baad book band ('LOCK'). `TPV` 6 tareeke (T30 / T50 abhi / T75 / T100 = body ka %, max $1.00 x pct/50%; TR = 50% par +$0.05 lock → 100%; B25 = book body 25%), `tpAt(body, k, pct)`, `tpVariants(p, bars)`. Test +1 (68).
- Scanner v1.10 paper me `body` likhta hai; nateeje par `mfe`, `mfe1`, `tv` (+ `tvp` jab tak lambe wale baaki).
- Record: "🎯 TP का नाप — 1 MIN" (wahi trade, 6 tareeke, Aaj / Kul, ⭐ sabse zyada $) + "pehli candle me bhaav kitna gaya" (avg $, body 30 / 50 / 75 / 100% tak kitne %); paper line me "ऊपर +$x". Candle 1.12.0, app 1.33.0. EA / asli niyam nahi badla.

## v1.32.0 — Candle 1.11.0: sirf 1 MIN (5 MIN hataya) (16 Nov)
- User: "5 MIN ka hisaab app aur EA se remove, sirf success wala 1 MIN rakho".
- Live: 1 / 5 MIN button hata kar sirf "1 MIN"; boot par `cfg.tf` = 1 (VPS ko bhi 1). Record se 5 MIN ke saare dabbe (paper, gehra ghata, mausam, pushti) hataye; VPS paper / EA trades me tf 5 wale nahi dikhte. Scanner v1.09 + CANDLE EA v1.01 bhi sirf 1 MIN. Candle 1.11.0, app 1.32.0.

## v1.31.0 — Candle 1.10.0: 🤖 SAMUSIGNAL CANDLE EA (demo) ka haal + record (16 Nov)
- User: Candle strategy ka alag EA, naye $100 DEMO par, ek saath 3 trade, sirf app me ON pair par (app se manage).
- EA (Samusignal `vps-ea/SAMUSIGNAL CANDLE EA v1.00.mq5`) `/candle/cfg` (pairs + tf) padhta hai; likhta hai `/candle/ea/state` {t, v, tf, pairs, open, max, list, dayPl, dayW, dayL, bal, eq, demo, stop, last, skip} + `/candle/ea/trades/<key>` (key = VPS paper wala; open: sym, n, dir, tf, next, at, entry, tp, sl, spread, lot; band: done, res, pl, exitT, cn, exit).
- App: `refreshVps` me EA state + trades (aakhri 300); Live note me `eaLine()` (chalu / ruka, khule x/3, aaj $); Record me sabse upar "🤖 CANDLE EA (Demo) — असली order" Aaj / Kul + EA trades list (har trade ke saath usi candle ka paper nateeja); Pairs note: EA bhi inhi ON pair par. Candle 1.10.0, app 1.31.0.

## v1.30.0 — Candle 1.9.0: XAUUSD Candle se hataya (16 Nov)
- User: "Candle me XAUUSD ki trade history remove karna aur pair me bhi XAUUSD remove karna".
- `NO_PAIR` {XAU/USD}: Pairs list (`CPAIRS`) me nahi; boot par phone se `cfg.pairs` / `candle_real` / `candle_paper` ke XAU hamesha ke liye saaf; VPS paper list me XAU nahi dikhta. Default pair BTC/USD. Page khulte hi `cfgSync` → `/candle/cfg` se XAU hat jaata hai, VPS scanner XAU par signal / paper / push band. Baaki app (Scan, Signal) me XAU waisa hi. Candle 1.9.0, app 1.30.0.

## v1.29.0 — Candle 1.8.0: 🌦 Bazaar ka Mausam (sirf naap) (15 Nov)
- User "Mausam Final": tezi pehle bhaanpo, saaf halat me hi trade — pehle sirf naap.
- `candlerules.weather({b1, b1h, now, news, sym, spreadRatio})` → {c G/Y/R, why[]}. R: High news ±60 min (pair ki currency; BTC = USD), raftaar (10/60 candle range) ≥ 1.5, 15 min me 3 guna candle, spread ≥ 2 guna. Y: raftaar ≥ 1.25, London 08:00 / NY 13:00 + 14:30 UTC ±15 min, rollover 21:00–23:30 UTC, Bollinger squeeze (< 50% avg), is ghante (1h itihaas) 1.5 guna. `WX` config. Test +1 (67).
- App: pair card par mausam patti ("🔴 तेज़ — news USD 19:00 · रफ़्तार ×1.6"), `/candle/wx` har 20 sec; Record "🌦 मौसम का नाप — 1 / 5 MIN" (G / Y / R ka nateeja + sabse gehra / average); paper line me 🟢🟡🔴.
- Scanner v1.08: har minute `/candle/wx/<NAME>` + paper `wx`; news `/feed/news/cal`, `/feed/bars/1h`; aam spread `ST.cdl.spAvg`. Candle 1.8.0, app 1.29.0.

## v1.28.0 — Candle 1.7.0: "sabse gehra ghata" (MAE) (15 Nov)
- User Final: har paper ka sabse gehra ghata note ho (SL $10 ka asli khatra).
- `paperResolve` har return me `mae` ($, har candle ka sabse bura bhaav — kram pakka nahi to ghaate wala; SL = −SL). Test me +1 assert.
- Scanner v1.07 `p.mae` likhta hai. Record: "📉 सबसे गहरा घाटा — 1 / 5 MIN" (sabse gehra + pair / samay, average, −$1 / −$3 / −$5 se neeche kitne); paper line me "गहरा −$x". Candle 1.7.0, app 1.28.0.

## v1.27.0 — Candle 1.6.0: 4 pushti ka naap (sirf paper record) (15 Nov)
- User: "पुष्टि के चारों तरीके का रिकॉर्ड फाइनल — सिर्फ पेपर रीडिंग में" (signal / paper niyam nahi badalna).
- `candlerules.confirms(sg, bars, htf)` → {1 badi TF (1m→5m, 5m→15m) EMA 9/21 saath, 2 close range ke sire 25% me, 3 body ≤ 3× avg aur close EMA21 se ≤ 4× avg, 4 pichhli candle usi rang} (true / false / null). `CONFIRMS` naam. Test +1 (66).
- Scanner v1.06 har naye paper par `cf` likhta hai (15min bars bhi). App Record: "🔍 पुष्टि का नाप — 1 MIN / 5 MIN" table (saare / 1 / 2 / 3 / 4 / 1+2 / charon — aaj / kul $, trade, win %); paper line me "पुष्टि 12✗4". Candle 1.6.0, app 1.27.0.

## v1.26.0 — Candle 1.5.0: paper SL $10 + TP candle + HOLD (profit dikhte hi book), ek pair ek trade (15 Nov)
- User Final: "SL $10, TP candle ke hisaab se, sirf yahi ek jaanch, baaki kuch nahi; purana data delete". Phir: SL se pehle jahan bhi profit dikhe (koi bhi candle) book; pehle trade ka nateeja aane tak doosra nahi.
- `candlerules`: `paperSl` 10, `bookUsd` 0.05, `holdMaxMin` 200; `paperResolve` `p.hold`: candle 1 = TP / SL / close fayde me → book, warna chalta rahe; candle 2+ = +$0.05 chhoote (PROFIT BOOK $0.05) ya close fayde me (us close ka profit) ya TP / SL; aakhri candle = TIME. Test +1 (65).
- 4-tareeke tulna UI se hataya (`slCompare` nahi); chip "📝 TP candle 50% · SL $10"; record line me "N candle"; note / Setting me niyam.
- Scanner v1.05: pehli baar `/candle/paper` ek baar DELETE (`ST.cdl.reset105`); paper {sl 10, hold, maxCandles 1m 200 / 5m 72}; `X.open` (sym|tf) — chalu trade ho to naya paper nahi; 7 ghante = DATA NAHI. Candle 1.5.0, app 1.26.0.

## v1.25.0 — Candle 1.4.0: 1 MIN + 5 MIN dono ka VPS paper, purana record saaf karne ka button (15 Nov)
- User: purana VPS paper hata kar aaj se naya; 5 MIN ka data bhi.
- Record: "🖥 VPS Paper — 1 MIN" + "⚖️ SL की तुलना — 1 MIN", phir wahi 5 MIN ke liye (`slCompare(tf)`). VPS paper list ke neeche "🗑 VPS paper record साफ़ करें (नया शुरू)" → confirm → DELETE `/candle/paper` (Playwright se jaancha). App 600 tak padhta hai.
- VPS scanner v1.04: paper 1 + 5 MIN dono par; push (`/candle/sig`) sirf app me chune tf ka. Candle 1.4.0, app 1.25.0.

## v1.24.0 — Candle 1.3.0: SL ki tulna (4 tareeke) + phone paper hataya (15 Nov)
- User: BTC 1m VPS paper 54 trade 52% −$4.14 → "SL modify" → "Tulna Final" + phone wala paper hatao + dono naye niyam Final.
- `candlerules`: `dynSl(sg, k)` = body ka 100%, $0.20–$1.50; `paperResolve` me `p.be` (bhaav TP ki taraf `beAt` 60% chale to SL entry par; ek candle me 60% chhua aur close ulta = 'BE' $0; SL pehle maana); `VARIANTS` A (abhi, SL $1.50) / B (candle SL) / C (break-even) / D (B+C); `paperVariants(p, bars)`. Test +2 (64).
- Phone paper poori tarah hataya (addPaper / resolvePaper / 📝 Paper button / phone record). Toggle ab "🖥 VPS Paper" (cfg.autoPaper → VPS). Signal card: "🖥 Paper TP $x · candle SL $y", VPS paper ka nateeja.
- Record: "⚖️ SL की तुलना (VPS paper)" table A–D (aaj / kul $, trade, win %, sabse achha); VPS paper line me "B · C · D" ke $. Scanner v1.03 `p.v` likhta hai.
- Candle 1.3.0, app 1.24.0.

## v1.23.1 — Candle 1.2.1: page side me nahi khisakta, neeche ke button sthir (15 Nov)
- User video: page daayein-baayein khisak raha tha, Live / Pairs / Record / Setting sirf scroll karne par dikhte the. Wajah: lambi `nowrap` pill ("Paper TP: candle 50% … Real TP … SL") screen se chaudi -> poora page chauda.
- Fix: html / body / #app `overflow-x:hidden`, pill `max-width:100%` + ellipsis, chip do chhote hisson me ("📝 TP candle 50%", "🚀 TP $0.25 · SL $1.50"), #main neeche 110px jagah (button ke peeche content na chhupe). Pixel 7 par jaancha: scrollWidth = clientWidth, nav har tab me neeche fixed.

## v1.23.0 — Candle 1.2.0: paper TP candle ke hisaab se (14 Nov)
- User: "TP 0.25 fix hai, SL zyada hai — TP candle ke hisaab se kam / zyada" → "Seedha Final" (paper me).
- `candlerules.dynTp(sg, k)`: signal candle body (price) × k × 50%, seema $0.10–$1.00 (0.01 lot); body na ho to $0.25. Phone paper (`addPaper`) + VPS scanner v1.02 dono isi se `tp` likhte hain (`paperResolve` p.tp pehle se use karta hai). Asli EA (PERSONAL FX v7.6 S5) abhi bhi $0.25.
- UI: chip "Paper TP: candle 50% ($0.10–1.00) · Real TP $0.25 · SL"; signal card "📝 Paper TP $x"; paper row me TP $; Setting niyam. Test +1 (62). Candle 1.2.0, app 1.23.0.

## v1.22.0 — Candle 1.1.0: app band ho tab bhi (VPS) (14 Nov)
- User: Candle signal app band hone par bhi + paper + push → A + push.
- `saveCfg` → `cfgSync()` PUT `/candle/cfg` {pairs, tf, autoPaper, at} (800 ms debounce; boot par bhi). `refreshVps()` har 20 sec: `/candle/vps` heartbeat + `/candle/paper` (aakhri 300). `vpsAlive()` = heartbeat < 150 sec.
- VPS chalu ho to phone khud auto paper NAHI jodta (dohra na ho); manual 📝 Paper phone me hi. Chip "🖥 VPS चालू / बंद". Record: "🖥 Paper — VPS (app बंद हो तब भी)" Aaj / Kul + VPS paper list; phone ka paper alag ("इस phone का", sirf ho to). Live note me VPS ka haal.
- VPS: Samusignal `vps-scanner` v1.01 (signal + paper), push: AI AUTO EA v1.12. Candle 1.1.0, app 1.22.0. Playwright mock se jaancha.

## v1.21.4 — Candle page: signal par 3 beep + bada BUY / SELL flash + Screen ON toggle (14 Nov)
- User: signal aaye to beep + bade lafzon me BUY / SELL flash; page par "screen on" option.
- `alertSig()`: 3 beep (BUY oonche, SELL neeche, gain 0.6) + vibrate + poori screen hara / laal flash (dir 150px, pair, candle samay) 8 sec, tap = band (#flash data-act flashoff). Sirf taaza signal par (sendWindow ke andar), pehle jaisa.
- `cfg.screenOn` (default ON): Live card + Setting me ☀️ toggle; Wake Lock `wakeSet()` — OFF par release, visibility / tap par phir se. Status line toggle ke neeche. Candle 1.0.4, app 1.21.4.

## v1.21.3 — Candle / News ka ← back app band karta tha (14 Nov)
- User: Candle page ka ← dabane par app band ho jaata tha. Pehle `href="./"` (nayi navigation, directory URL). Ab `goHome()`: referrer same-origin + history.length>1 → `history.back()`, warna `location.replace(index.html)`. news.html me bhi wahi. Candle 1.0.3, News 1.4.1, app 1.21.3.

## v1.21.2 — Candle page: No Trade hara, wajah peeli (14 Nov)
- User: "No Trade dark green me, aage ka result (EMA wagairah) thoda dark peela". `.no b.nt` #16a34a bold; `.why` + `.no .kv` #d4a72c. Candle page 1.0.2, app 1.21.2.

## v1.21.1 — Candle page: "nayi candle nahi aayi" chetavni (14 Nov)
- User: 4 min se screen same (BTCUSD, Shanivar). Wajah: **Data Feed v1.0** nayi candle sirf pehle pair (EURUSD) se pehchanta tha; weekend pe EURUSD band -> BTC ki band candles sirf har 5 min (ResendMin) me jaati thi.
- Fix VPS par: `Samusignal/vps-ea/SamuSignal Data Feed v1.01.mq5` (kisi bhi pair ki nayi candle -> turant bhejo). Chart par v1.0 hata kar v1.01 lagana hai.
- App: pair card par "⚠ नई candle नहीं आई — आख़िरी बंद candle HH:MM" jab feed ki aakhri band candle 1 candle + 20 sec se purani ho. Candle page 1.0.1, app 1.21.1.

## v1.21.0 — 🕯️ CANDLE page (Strategy 5) + Paper (14 Nov, branch feature-candle-v1.21.0)
- User: agli 1 / 5 min candle ka BUY / SELL, sirf ON kiye pair par, MT5 button se trade (TP $0.25), paper ka option bhi. PERSONAL FX me Strategy 4 waise hi chale, sirf Candle page ke trade Strategy 5 par.
- Naya alag page `candle.html` + `src/candle.js` (UI) + `src/candlerules.js` (pure logic) + `tests/candle.test.mjs` (9 test). Home par 🕯️ **Candle** button (naarangi; hTools 6 -> 7 column). Baaki app nahi chhua.
- Data: sirf VPS ka **SamuSignal Data Feed** (Firebase `/feed/bars/1min|5min/<PAIR>` + `/feed/live`), 0 TwelveData credit. Poll: candle khulne ke pehle 25 sec me har 2 sec, baaki har 8 sec. App khula + screen on (wakeLock) chahiye.
- Signal (aakhri BAND candle): body >= pichhli 10 ki average x 1.2 aur >= candle range ka 50%; BUY = hari + EMA9 > EMA21 + close > EMA9 + RSI14 50–70; SELL ulta (RSI 30–50). Warna "No Trade — wajah".
- 🚀 MT5: 1m me candle khulne ke 20 sec, 5m me 60 sec tak. Order `/personalfx/orders/<key>` = {type BUYMARKET / SELLMARKET, **strat: 'CANDLE', tf: 1|5**, at, acct}. Account: online PERSONAL FX; kai hon to main app ka chuna hua (`sai_acct`), warna DEMO. Confirm sheet (Setting me OFF = ek tap). Ek signal ek hi baar.
- EA (PERSONAL FX **v7.6**, Samusignal repo) is order ko Strategy 5 pe chalata hai: TP +$0.25 / SL -$1.50 (0.01 lot), candle band hote hi band, lot S5_Lot 0.01; nateeja wapas `orders/<key>` {status CLOSED, res TP / SL / CANDLE CLOSE, pl}. App Record tab me dikhta hai.
- 📝 Paper: har signal par button + **Auto Paper** switch. Wahi niyam, entry = trade wali candle ka open (BUY + spread), band candle ke OHLC se; ek candle me TP aur SL dono = SL maana. Real aur Paper ka Aaj / Kul hisaab alag (trades, win %, W/L, net $).
- localStorage: `sai_candle_cfg`, `sai_candle_paper`, `sai_candle_real`, `sai_candle_seen`. Page version 1.0.0; app 1.20.6 -> **1.21.0** (app.js, sw.js, package.json; sw SHELL me candle files).
- Baaki / idea: kuch din ke paper record ke baad niyam (bodyMult, RSI zone) parakhna; app band ho tab bhi signal ke liye VPS par chalne wala version (jaise News Pusher).

## v1.20.6 — Chart dabbe me (14 Nov)
- User: "chart bhi ek square box me daal dena". #hChart (Home) + #rChart (Signal) — margin 18px, sunehri patli kinari, 16px gol kone, halka background + shadow, fadeb chhupa (time axis dikhe). hCard / rCard ab chart ke neeche (pehle −56 / −48 px upar chadhte the).

## v1.20.5 — Home ke saare button rangeen (14 Nov)
- User: "Scan jaise golden button, waise hi saare button — har ek ka rang alag".
- Scan sunehra (wahi), Council gulabi, Flow neela, News chaandi, Refresh hara, Data baingani; sab chamakdaar gradient + gehre bold akshar + halki glow. Data ke LIVE / OFF pill ko gehra background (padhne layak). Refresh icon gehra (#062014).

## v1.20.4 — Home ka Scan button highlight (13 Nov)
- User: "start me jo scan wala option hai use zyada highlight karo" → Final 1+3.
- `#sxBtn` sunehra gradient + gehre bold akshar + halki glow (baaki 5 button waise hi). Auto scan ON ho to kone me hara "AUTO" badge (`#sxAutoB`, `autoBadge()` — renderScan + toggle par).

## v1.20.3 — Chart: SELL / SL pill candle nahi dhakte (13 Nov)
- User: SELL / SL pill aakhri candles ke upar aa kar unhe chhupa rahe the.
- Daam ab right price-scale par rangeen label (createPriceLine axisLabelVisible + axisLabelColor): SL laal, TP hara, entry (naya line) sunehra.
- Chart me sirf chhota tag "SELL / BUY", "SL", "TP" — aakhri candle ke daayein (logicalToCoordinate(n-1+1.2)); jagah na ho to scale ke baayein. Level bahar ho to ↑/↓ + daam. TP ab baayein nahi (pehle shuru ki candle dhakta tha).
- rightOffset 14 → 20 (fit bhi n+20). Entry patti halki (0.02→0.10, border 0.55).

## v1.20.2 — Scanner Auto scan yaad nahi rehta (13 Nov)
- User: app band karke kholo to ⏱ Auto scan apne aap **OFF**; khud ON karo tab chale. Pehle localStorage me save hota tha (khulte hi ON).
- Ab sirf memory (`autoOn`); purani saved `sai_autoScan` hata di jaati hai. 🤖 paper wala toggle (sxPaper) waisa hi yaad rehta hai.

## v1.20.1 — v1.20.0 wapas (12 Nov)
- User: "mujhe aisa nahi chahiye tha, pahile jaisa kar dena pair" — Pairs page (Favourites / Forex / Metals / Crypto) aur Scanner bina group filter, bilkul v1.19.0 jaisa. Sirf version 1.20.1.
