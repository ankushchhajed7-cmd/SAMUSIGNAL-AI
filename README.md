# SAMUSIGNAL AI

Personal AI chart-signal app (PWA) — design "A" (obsidian + gold mirror, vault background).

- **Signals:** sirf BUY LIMIT / SELL LIMIT, hamesha ek signal (Grade A / B / C). 15m + 1H trend → aakhri impulse → Fib golden zone (50–61.8%). SL 78.6% ke paar, TP1/2/3 = 1R/2R/3R, valid 60 min.
- **Data:** MT5 Data Feed (Firebase `/feed`, Exness exact bhaav) → na mile to TwelveData.
- **Keys:** SamuSignal ki localStorage (`samu_*`) se apne aap — dono app `ankushchhajed7-cmd.github.io` par, isi phone ke ek hi browser me. Koi key repo me nahi.
- **🚀 MT5 पे लगाओ:** Firebase `/personalfx/orders/-SG…` → PERSONAL FX EA (lot / TP / SL / grid EA ke niyam). Confirm + account choose; REAL par chetavni.
- **✋ मैंने ट्रेड लिया:** khud liye trade ka record.
- **History:** nateeja live candles se (fill → TP1/2/3 ya SL), win rate.
- **AI:** Gemini (SamuSignal wali key) — signal par doosri raay + screenshot se signal.

Signals analysis hain, guarantee nahi. Trading me jokhim hai.

`npm test` — engine tests.
