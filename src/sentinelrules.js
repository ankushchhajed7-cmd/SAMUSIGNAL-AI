/* 🛡️ FX SENTINEL v1.1.0 — rule-book (pure functions, koi network nahi — test hota hai)
   7 major + XAUUSD. H4 (1H se banaya) trend -> H1 structure -> M15 entry. Har pair ko 0–100 score.
   EMA/ADX ke upar naye filter:
     1) Currency Strength Meter (saare pair ke 1H move ATR me) — sirf mazboot vs kamzor
     2) ADX slope + DI gap — ADX bas 25 se upar nahi, BADH bhi raha ho
     3) Efficiency Ratio (Kaufman) — sideways / chop me trade nahi
     4) EMA stretch (ATR me) — bhaag chuke price ke peeche nahi, pullback pe LIMIT
     5) Structure SL (swing + ATR buffer), TP = RR x risk
     6) Session + spread + high-impact news (±30 min) rok
     7) Gemini news bias (har currency) + self-learning (pair ka apna jeet %)
   Order sirf BUY LIMIT / SELL LIMIT (user ki REAL trading LIMIT pe chalti hai).
   v1.1.0 — runScan / newTrade / applyEval / dayReport yahin: app page AUR VPS scanner (app band ho tab bhi) dono
   bilkul isi code se chalte hain (scanner ye file GitHub Pages se leta hai). */
import {ema, atrSeries, rsi, trendScore, macdHist} from './engine.js';

export const SEN_VERSION = '1.1.0';
export const SEN_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'XAU/USD'];
export const CURS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];
export const M15 = 900e3, H1 = 3600e3, H4 = 4 * H1;
export const DEF_CFG = {minScore: 75, rr: 1.8, lot: 0.01, maxOpen: 3, dayLoss: 5, expiryMin: 60, ai: true, newsWin: 30, maxHoldH: 24, coolH: 2};
/* aam spread (price me) — feed ka spread na mile / ajeeb ho to */
export const DEF_SPREAD = {'EUR/USD': 0.00012, 'GBP/USD': 0.00016, 'USD/JPY': 0.015, 'USD/CHF': 0.00016, 'AUD/USD': 0.00014, 'USD/CAD': 0.00018, 'NZD/USD': 0.00018, 'XAU/USD': 0.25};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
export const curOf = sym => sym === 'XAU/USD' ? ['XAU', 'USD'] : sym.split('/');

/* ---------- indicators ---------- */
/* 1H candles -> H4 (UTC 00/04/08/...) */
export function toH4(b1h){
  const out = [];
  (b1h || []).forEach(b => {
    const k = Math.floor(b.t / H4) * H4, last = out[out.length - 1];
    if(last && last.t === k){ last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c }
    else out.push({t: k, o: b.o, h: b.h, l: b.l, c: b.c});
  });
  return out;
}
/* sirf band candles (bann rahi candle hata do) */
export const closedOnly = (bars, tf, now) => (bars || []).filter(b => b.t + tf <= now);

/* Wilder ADX series: {adx[], pdi[], mdi[]} */
export function adxSeries(b, n = 14){
  const A = [], P = [], M = [];
  let sp = 0, sm = 0, st = 0, ax = 0, cnt = 0;
  for(let i = 0; i < b.length; i++){
    if(!i){ A.push(0); P.push(0); M.push(0); continue }
    const up = b[i].h - b[i - 1].h, dn = b[i - 1].l - b[i].l;
    const p = up > dn && up > 0 ? up : 0, m = dn > up && dn > 0 ? dn : 0;
    const t = Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c));
    if(i <= n){ sp += p; sm += m; st += t } else { sp = sp - sp / n + p; sm = sm - sm / n + m; st = st - st / n + t }
    let pdi = 0, mdi = 0;
    if(i >= n && st > 0){
      pdi = sp / st * 100; mdi = sm / st * 100;
      const dx = pdi + mdi ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
      cnt++; ax = cnt <= n ? (ax * (cnt - 1) + dx) / cnt : (ax * (n - 1) + dx) / n;
    }
    A.push(ax); P.push(pdi); M.push(mdi);
  }
  return {adx: A, pdi: P, mdi: M};
}
/* Kaufman Efficiency Ratio: 1 = seedhi line, 0 = poora chop */
export function effRatio(cl, n = 20){
  const L = cl.length - 1; if(L < n) return 0;
  let path = 0; for(let i = L - n + 1; i <= L; i++) path += Math.abs(cl[i] - cl[i - 1]);
  return path > 0 ? Math.abs(cl[L] - cl[L - n]) / path : 0;
}
/* ATR me naapa gaya move (pichhli `look` candle) */
export function atrMove(b, look = 8){
  if(!b || b.length < look + 15) return null;
  const a = atrSeries(b, 14), L = b.length - 1;
  return a[L] > 0 ? (b[L].c - b[L - look].c) / a[L] : null;
}

/* ---------- 1) Currency Strength Meter ----------
   all = {EURUSD: bars1h, GBPJPY: bars1h, ...} (broker naam). Har pair ka ATR-move base ko +, quote ko −.
   Nateeja: {str: {USD: x...}, rank: {USD: 1..8}} (1 = sabse mazboot) */
export function strength(all, look = 8){
  const sum = {}, cnt = {};
  CURS.forEach(c => { sum[c] = 0; cnt[c] = 0 });
  Object.entries(all || {}).forEach(([name, bars]) => {
    const b = name.slice(0, 3), q = name.slice(3, 6);
    if(!(b in sum) || !(q in sum)) return;
    const m = atrMove(bars, look); if(m === null || !isFinite(m)) return;
    sum[b] += m; cnt[b]++; sum[q] -= m; cnt[q]++;
  });
  const str = {};
  CURS.forEach(c => { str[c] = cnt[c] ? r2(sum[c] / cnt[c]) : 0 });
  const order = [...CURS].sort((a, b) => str[b] - str[a]), rank = {};
  order.forEach((c, i) => { rank[c] = i + 1 });
  const ok = CURS.filter(c => cnt[c]).length >= 6;
  return {str, rank, ok};
}

/* ---------- news ---------- */
/* events: [{t (ms), cur, imp: 'High'|'Medium', title}] -> sym ki currency ka High event ±win min ke andar */
export function newsBlock(sym, events, now, win = 30){
  const cs = curOf(sym).map(c => c === 'XAU' ? 'USD' : c);
  return (events || []).find(e => e && e.imp === 'High' && cs.includes(e.cur) && Math.abs(e.t - now) <= win * 60e3) || null;
}
/* Gemini jawab -> {USD: 'STRONG'|'WEAK'|'NEUTRAL', ..., XAU: 'UP'|'DOWN'|'NEUTRAL', sum} */
export function parseCurBias(text){
  const t = String(text || ''), out = {}; let n = 0;
  CURS.forEach(c => { const m = t.match(new RegExp('^\\s*\\**' + c + '\\**\\s*[:=\\-]\\s*([A-Za-z]+)', 'mi'));
    if(m){ const v = m[1].toUpperCase(); out[c] = v.startsWith('STR') ? 'STRONG' : v.startsWith('WEA') ? 'WEAK' : 'NEUTRAL'; n++ } });
  const g = t.match(/^\s*\**XAU(?:USD)?\**\s*[:=\-]\s*([A-Za-z]+)/mi);
  if(g){ const v = g[1].toUpperCase(); out.XAU = v.startsWith('UP') || v.startsWith('STR') ? 'UP' : v.startsWith('DOWN') || v.startsWith('WEA') ? 'DOWN' : 'NEUTRAL' }
  const s = t.match(/SAAR\s*[:=\-]\s*([\s\S]*?)(?:\n\s*(?:KHABAR|[A-Z]{3})\s*[:=\-]|$)/i);
  out.sum = s ? s[1].replace(/\s+/g, ' ').trim().slice(0, 400) : '';
  return n >= 6 ? out : null;
}
/* Gemini bias pair ki disha ke saath: +10 dono saath, +5 ek saath, −15 ulta, 0 neutral */
export function aiPoints(sym, dir, bias){
  if(!bias) return {pts: 0, txt: ''};
  const [b, q] = curOf(sym), up = dir === 'BUY';
  if(sym === 'XAU/USD'){
    const g = bias.XAU || 'NEUTRAL', u = bias.USD || 'NEUTRAL';
    const want = up ? 'UP' : 'DOWN', usdWant = up ? 'WEAK' : 'STRONG', usdBad = up ? 'STRONG' : 'WEAK';
    if(g !== 'NEUTRAL' && g !== want) return {pts: -15, txt: `Gemini: Gold ख़बरें ${g === 'UP' ? 'ऊपर' : 'नीचे'} की — उल्टा`};
    if(g === want) return {pts: u === usdWant ? 10 : 6, txt: `Gemini: Gold ${up ? 'ऊपर' : 'नीचे'} की ख़बरें${u === usdWant ? ', USD ' + (up ? 'कमज़ोर' : 'मज़बूत') : ''}`};
    if(u === usdBad) return {pts: -8, txt: `Gemini: USD ${up ? 'मज़बूत' : 'कमज़ोर'} — Gold के लिए उल्टा`};
    return {pts: 0, txt: 'Gemini: Gold पर कोई साफ़ ख़बर नहीं'};
  }
  const bb = bias[b] || 'NEUTRAL', qq = bias[q] || 'NEUTRAL';
  const good = (c, v) => (c === b) === up ? v === 'STRONG' : v === 'WEAK';
  const bad = (c, v) => v !== 'NEUTRAL' && !good(c, v);
  const word = v => v === 'STRONG' ? 'मज़बूत' : v === 'WEAK' ? 'कमज़ोर' : 'neutral';
  const line = `Gemini: ${b} ${word(bb)}, ${q} ${word(qq)}`;
  if(bad(b, bb) || bad(q, qq)) return {pts: -15, txt: line + ' — उल्टा'};
  const g = (good(b, bb) ? 1 : 0) + (good(q, qq) ? 1 : 0);
  return {pts: g === 2 ? 10 : g === 1 ? 5 : 0, txt: line};
}

/* ---------- session (UTC) ---------- */
export function session(now){
  const d = new Date(now), h = d.getUTCHours() + d.getUTCMinutes() / 60, wd = d.getUTCDay();
  if(wd === 6 || wd === 0) return {k: 'OFF', name: 'Weekend', ok: false};
  if(wd === 5 && h >= 19) return {k: 'OFF', name: 'Friday close', ok: false};
  if(h >= 7 && h < 12) return {k: 'LON', name: 'London', ok: true};
  if(h >= 12 && h < 16) return {k: 'OVL', name: 'London + NY', ok: true};
  if(h >= 16 && h < 20) return {k: 'NY', name: 'New York', ok: true};
  return {k: 'OFF', name: 'Asia / रात (कम हलचल)', ok: false};
}

/* ---------- 7) self-learning ---------- */
/* history = band trade [{sym, res: 'TP'|'SL'|'TIME', r}] -> score me badlav */
export function learnAdj(history, sym, minN = 8){
  const h = (history || []).filter(x => x.sym === sym && (x.res === 'TP' || x.res === 'SL' || x.res === 'TIME')).slice(-30);
  if(h.length < minN) return {pts: 0, n: h.length, wr: null, txt: ''};
  const w = h.filter(x => (x.r || 0) > 0).length, wr = Math.round(w / h.length * 100);
  const pts = wr < 40 ? -10 : wr < 50 ? -5 : wr > 60 ? 5 : 0;
  return {pts, n: h.length, wr, txt: `इस pair का अपना रिकॉर्ड: ${wr}% जीत (${h.length} trade)${pts ? ` → ${pts > 0 ? '+' : ''}${pts}` : ''}`};
}

/* ---------- MAIN: ek pair ka score + order ----------
   inp = {sym, b15, b1h (band candles), live, spread, cs (strength), events, bias, history, now, cfg} */
export function score(inp){
  const {sym, live, now} = inp, cfg = Object.assign({}, DEF_CFG, inp.cfg || {});
  const b15 = inp.b15 || [], b1h = inp.b1h || [];
  const out = {sym, dir: null, score: 0, parts: [], blocks: [], why: [], order: null, at: now};
  if(b15.length < 60 || b1h.length < 60 || !(live > 0)){ out.blocks.push('Candles कम हैं (feed)'); return out }
  const cl15 = b15.map(x => x.c), cl1 = b1h.map(x => x.c), L15 = cl15.length - 1, L1 = cl1.length - 1;
  const atr15 = atrSeries(b15, 14)[L15], atr1 = atrSeries(b1h, 14)[L1];
  if(!(atr15 > 0)){ out.blocks.push('ATR नहीं'); return out }

  /* A) Trend H4 + H1 (25) */
  const b4 = toH4(b1h), has4 = b4.length >= 55;
  const t1 = trendScore(b1h), t4 = has4 ? trendScore(b4) : null;
  let dir = null;
  if(has4){ if(t4 > 0 && t1 > 0) dir = 'BUY'; else if(t4 < 0 && t1 < 0) dir = 'SELL' }
  else { if(t1 >= 2) dir = 'BUY'; else if(t1 <= -2) dir = 'SELL' }
  if(!dir){
    out.blocks.push(has4 ? `H4 (${t4 > 0 ? '+' : ''}${t4}) और H1 (${t1 > 0 ? '+' : ''}${t1}) trend अलग — कोई दिशा नहीं` : `H1 trend कमज़ोर (${t1})`);
    out.dirHint = t1 > 0 ? 'BUY' : t1 < 0 ? 'SELL' : null;
    return out;
  }
  out.dir = dir;
  const up = dir === 'BUY', sg = up ? 1 : -1;
  const tPts = has4 ? Math.round((Math.abs(t4) + Math.abs(t1)) / 6 * 25) : Math.round(Math.abs(t1) / 3 * 18);
  out.parts.push({k: 'Trend', pts: tPts, max: 25, txt: has4 ? `H4 ${t4 > 0 ? '+' : ''}${t4}/3 और H1 ${t1 > 0 ? '+' : ''}${t1}/3 — दोनों ${up ? 'UP' : 'DOWN'}` : `H1 ${t1}/3 (H4 के लिए candles कम)`});

  /* B) ADX slope + DI gap (15) — H1 */
  const ad = adxSeries(b1h, 14), A = ad.adx[L1], A3 = ad.adx[Math.max(0, L1 - 3)], gap = (ad.pdi[L1] - ad.mdi[L1]) * sg;
  if(gap < 0) out.blocks.push(`DI उल्टा (${up ? '−DI' : '+DI'} आगे ${r1(-gap)})`);
  const rising = A > A3 + 0.5;
  const aPts = (A >= 20 ? 5 : 0) + (rising ? 5 : 0) + (gap >= 5 ? 5 : gap > 0 ? 2 : 0);
  out.parts.push({k: 'ADX', pts: aPts, max: 15, txt: `ADX ${r1(A)} ${rising ? '↑ बढ़ रहा' : A < A3 - 0.5 ? '↓ गिर रहा' : '→ सपाट'} · DI gap ${gap >= 0 ? '+' : ''}${r1(gap)}`});

  /* C) Efficiency Ratio / chop (15) */
  const er1 = effRatio(cl1, 20), er15 = effRatio(cl15, 20);
  if(er1 < 0.12) out.blocks.push(`Market sideways / chop (ER ${r2(er1)})`);
  const ePts = Math.round(clamp((er1 - 0.12) / 0.28, 0, 1) * 10) + (er15 >= 0.25 ? 5 : er15 >= 0.15 ? 2 : 0);
  out.parts.push({k: 'Chop filter', pts: ePts, max: 15, txt: `Trend की सफ़ाई ER H1 ${r2(er1)} · M15 ${r2(er15)}${er1 >= 0.3 ? ' (साफ़)' : er1 < 0.18 ? ' (उलझा)' : ''}`});

  /* D) Currency Strength (20) */
  const cs = inp.cs;
  if(cs && cs.ok){
    const [b, q] = curOf(sym);
    let d, rb = '';
    if(sym === 'XAU/USD'){ const m = atrMove(b1h, 8) || 0; d = (m - (cs.str.USD || 0)) / 2 * sg; rb = `USD #${cs.rank.USD}` }
    else { d = ((cs.str[b] || 0) - (cs.str[q] || 0)) * sg; rb = `${b} #${cs.rank[b]} vs ${q} #${cs.rank[q]}` }
    if(d < -0.3) out.blocks.push(`Currency strength उल्टा (${rb})`);
    let bonus = 0;
    if(sym !== 'XAU/USD'){
      const strong = up ? b : q, weak = up ? q : b, rs = cs.rank[strong], rw = cs.rank[weak];
      bonus = rs <= 2 && rw >= 7 ? 6 : rs <= 3 && rw >= 6 ? 3 : 0;
    } else { const ru = cs.rank.USD; bonus = up ? (ru >= 7 ? 6 : ru >= 6 ? 3 : 0) : (ru <= 2 ? 6 : ru <= 3 ? 3 : 0) }
    const cPts = Math.round(clamp(d / 2, 0, 1) * 14) + bonus;
    out.parts.push({k: 'Currency strength', pts: cPts, max: 20, txt: `${rb} · फ़र्क ${d >= 0 ? '+' : ''}${r2(d)} ATR${bonus === 6 ? ' (सबसे मज़बूत vs सबसे कमज़ोर)' : ''}`});
  } else out.parts.push({k: 'Currency strength', pts: 0, max: 20, txt: 'Strength meter के लिए data कम'});

  /* E) EMA stretch / pullback (15) — M15 */
  const e20 = ema(cl15, 20)[L15], e50 = ema(cl15, 50)[L15];
  const stretch = (live - e20) / atr15 * sg, beyond50 = (live - e50) * sg < 0;
  let sPts, sTxt;
  if(beyond50){ sPts = 0; sTxt = `Price EMA50 के ${up ? 'नीचे' : 'ऊपर'} — pullback बहुत गहरा` }
  else if(stretch > 2.5){ sPts = 0; sTxt = `Price EMA20 से ${r1(stretch)} ATR भाग चुका — पीछा नहीं, LIMIT EMA20 पर` }
  else if(stretch > 1.8){ sPts = 3; sTxt = `EMA20 से ${r1(stretch)} ATR दूर (थोड़ा ज़्यादा)` }
  else if(stretch > 1.0){ sPts = 8; sTxt = `EMA20 से ${r1(stretch)} ATR दूर` }
  else if(stretch >= -0.5){ sPts = 15; sTxt = `Price EMA20 के पास (${r1(stretch)} ATR) — अच्छी entry` }
  else { sPts = 10; sTxt = `Pullback EMA20–50 zone में (${r1(stretch)} ATR)` }
  out.parts.push({k: 'Pullback', pts: sPts, max: 15, txt: sTxt});

  /* F) M15 trigger (10) */
  const lc = b15[L15], cDir = (lc.c - lc.o) * sg > 0, mh = macdHist(cl15) * sg > 0, rv = rsi(cl15, 14);
  const rOk = up ? rv >= 45 && rv <= 68 : rv >= 32 && rv <= 55;
  const fPts = (cDir ? 4 : 0) + (mh ? 3 : 0) + (rOk ? 3 : 0);
  if(up ? rv > 75 : rv < 25) out.blocks.push(`RSI ${Math.round(rv)} — ${up ? 'overbought' : 'oversold'}`);
  out.parts.push({k: 'M15 trigger', pts: fPts, max: 10, txt: `आख़िरी candle ${cDir ? (up ? 'हरी' : 'लाल') + ' ✓' : 'उल्टी'} · MACD ${mh ? '✓' : '✗'} · RSI ${Math.round(rv)}${rOk ? ' ✓' : ''}`});

  let total = out.parts.reduce((a, p) => a + p.pts, 0);

  /* G) Gemini news bias */
  const ai = aiPoints(sym, dir, inp.bias);
  if(ai.txt){ out.parts.push({k: 'Gemini news', pts: ai.pts, max: 10, txt: ai.txt}); total += ai.pts }
  /* H) self-learning */
  const lr = learnAdj(inp.history, sym);
  if(lr.txt){ out.parts.push({k: 'Self-learning', pts: lr.pts, max: 5, txt: lr.txt}); total += lr.pts }

  /* rok: session + news */
  const ss = session(now);
  if(!ss.ok) out.blocks.push(`Session: ${ss.name}`);
  const nb = newsBlock(sym, inp.events, now, cfg.newsWin);
  if(nb) out.blocks.push(`High news ${nb.cur}: ${String(nb.title || '').slice(0, 40)} (${Math.round((nb.t - now) / 60e3)} min)`);

  out.score = clamp(Math.round(total), 0, 100);

  /* order: LIMIT entry + structure SL + RR TP */
  const sp = spreadOk(sym, inp.spread, atr15);
  const pull = stretch > 0.8 ? (up ? Math.max(e20, live - atr15) : Math.min(e20, live + atr15)) : live - sg * 0.2 * atr15;
  const entry = up ? Math.min(pull, live - 0.1 * atr15) : Math.max(pull, live + 0.1 * atr15);
  const win = b15.slice(-12), swing = up ? Math.min(...win.map(x => x.l)) : Math.max(...win.map(x => x.h));
  let sl = swing - sg * 0.3 * atr15, dist = (entry - sl) * sg;
  /* SL ki doori: kam se kam 1 ATR(15m) aur 0.5 ATR(1H) — shaant market me 1–2 pip ka SL noise me hi lag jaata hai */
  const lo = Math.max(1.0 * atr15, 0.5 * (atr1 || 0)), hi = Math.max(2.5 * atr15, lo * 1.5);
  dist = clamp(dist, lo, hi);
  sl = entry - sg * dist;
  const tp = entry + sg * dist * cfg.rr;
  if(sp > 0.15 * dist) out.blocks.push(`Spread ज़्यादा (SL का ${Math.round(sp / dist * 100)}%)`);
  out.order = {type: up ? 'BUY LIMIT' : 'SELL LIMIT', entry, sl, tp, dist, rr: cfg.rr, spread: sp, atr15, atr1};
  out.why = out.parts.filter(p => p.pts > 0 || p.k === 'Gemini news').sort((a, b) => b.pts / (b.max || 1) - a.pts / (a.max || 1)).map(p => p.txt);
  out.ok = !out.blocks.length && out.score >= cfg.minScore;
  return out;
}
/* feed spread price me; ajeeb ho to aam spread */
export function spreadOk(sym, sp, atr15){
  const d = DEF_SPREAD[sym] || 0;
  return sp > 0 && isFinite(sp) && sp < Math.max(d * 4, atr15 * 0.6) ? sp : d;
}

/* ---------- paper trade ka nateeja ----------
   tr = {dir, entry, sl, tp, at, spread, expiryMin, maxHoldH}; bars = 15m candles (bid), bann rahi bhi chalegi.
   BUY fill: ask <= entry (bid low <= entry − spread). SL/TP bid par. SELL: fill bid high >= entry, SL/TP ask (bid + spread).
   Ek candle me SL aur TP dono = SL (savdhaan). Fill wali candle me sirf SL jaancha jaata hai. */
export function evalTrade(tr, bars, now, tf = M15){
  const up = tr.dir === 'BUY', sp = tr.spread || 0, exp = tr.at + (tr.expiryMin || 60) * 60e3, hold = (tr.maxHoldH || 24) * 3600e3;
  const bs = (bars || []).filter(b => b.t + tf > tr.at).sort((a, b) => a.t - b.t);
  /* har baar shuru se (fillAt yaad nahi rakhte — feed me ~2.5 din ki 15m candles, trade 25h me band) */
  let fillAt = null, i = 0;
  {
    for(; i < bs.length; i++){
      const b = bs[i]; if(b.t > exp) break;
      const hit = up ? b.l <= tr.entry - sp : b.h >= tr.entry;
      if(hit){
        fillAt = Math.max(b.t, tr.at);
        const slHit = up ? b.l <= tr.sl : b.h + sp >= tr.sl;
        if(slHit && (up ? b.c <= tr.entry : b.c >= tr.entry)) return done(tr, 'SL', tr.sl, fillAt, b.t + tf);
        i++; break;
      }
    }
    if(!fillAt) return now > exp ? {state: 'EXPIRED', done: true, r: 0} : {state: 'PENDING', done: false};
  }
  for(; i < bs.length; i++){
    const b = bs[i];
    const slHit = up ? b.l <= tr.sl : b.h + sp >= tr.sl, tpHit = up ? b.h >= tr.tp : b.l + sp <= tr.tp;
    if(slHit) return done(tr, 'SL', tr.sl, fillAt, b.t + tf);
    if(tpHit) return done(tr, 'TP', tr.tp, fillAt, b.t + tf);
    if(b.t + tf - fillAt >= hold) return done(tr, 'TIME', up ? b.c : b.c + sp, fillAt, b.t + tf);
  }
  const last = bs[bs.length - 1], px = last ? (up ? last.c : last.c + sp) : tr.entry;
  return {state: 'OPEN', done: false, fillAt, cur: px, r: r2((px - tr.entry) * (up ? 1 : -1) / Math.abs(tr.entry - tr.sl))};
}
function done(tr, res, px, fillAt, exitAt){
  const up = tr.dir === 'BUY', risk = Math.abs(tr.entry - tr.sl);
  return {state: res, done: true, res, exit: px, fillAt, exitAt, r: r2((px - tr.entry) * (up ? 1 : -1) / risk)};
}

/* ---------- hisaab ---------- */
export function stats(list){
  const c = (list || []).filter(x => x.res === 'TP' || x.res === 'SL' || x.res === 'TIME');
  const w = c.filter(x => (x.r || 0) > 0).length, usd = c.reduce((a, x) => a + (+x.usd || 0), 0), R = c.reduce((a, x) => a + (+x.r || 0), 0);
  return {n: c.length, win: w, loss: c.length - w, pct: c.length ? Math.round(w / c.length * 100) : null, usd: r2(usd), R: r2(R), avgR: c.length ? r2(R / c.length) : null,
    tp: c.filter(x => x.res === 'TP').length, sl: c.filter(x => x.res === 'SL').length, time: c.filter(x => x.res === 'TIME').length};
}
/* naya trade lag sakta hai? (risk niyam) */
export function canOpen(sig, trades, cfg, now, todayUsd){
  cfg = Object.assign({}, DEF_CFG, cfg || {});
  const live = (trades || []).filter(t => t.state === 'PENDING' || t.state === 'OPEN');
  if(live.some(t => t.sym === sig.sym)) return 'इस pair पर पहले से trade चालू';
  if(live.length >= cfg.maxOpen) return `एक साथ ${cfg.maxOpen} trade की सीमा पूरी`;
  if(todayUsd <= -Math.abs(cfg.dayLoss)) return `आज का loss limit $${cfg.dayLoss} पूरा — आज नए trade बंद`;
  const lastSl = (trades || []).filter(t => t.sym === sig.sym && t.res === 'SL').sort((a, b) => (b.exitAt || 0) - (a.exitAt || 0))[0];
  if(lastSl && now - (lastSl.exitAt || 0) < cfg.coolH * 3600e3) return `SL के बाद ${cfg.coolH} घंटे का आराम`;
  return '';
}

/* ---------- Gemini prompt ---------- */
export const AI_PROMPT = `Tum ek forex news analyst ho. Google Search se pichhle 12 ghanton ki sabse taaza, bharosemand ख़बरें dekho
(central banks, economic data, risk sentiment, geopolitics) aur har currency ka agle 2-4 ghante ka news bias batao.
Sirf neeche ke format me jawab do (koi aur text nahi):
USD: STRONG ya WEAK ya NEUTRAL
EUR: STRONG ya WEAK ya NEUTRAL
GBP: STRONG ya WEAK ya NEUTRAL
JPY: STRONG ya WEAK ya NEUTRAL
CHF: STRONG ya WEAK ya NEUTRAL
AUD: STRONG ya WEAK ya NEUTRAL
CAD: STRONG ya WEAK ya NEUTRAL
NZD: STRONG ya WEAK ya NEUTRAL
XAU: UP ya DOWN ya NEUTRAL
SAAR: 2-3 chhote Hinglish vaakya — kaunsi ख़बर kis currency ko hila rahi hai.
Pakki ख़बर na ho to NEUTRAL likho. Guess mat karo.`;

/* ==================================================================
   v1.1.0 — saanjha kaam (page + VPS scanner)
   ================================================================== */
export const nameOf = sym => sym.replace('/', '');
export const digitsOf = sym => sym === 'XAU/USD' ? 2 : sym.endsWith('JPY') ? 3 : 5;
const IST_MS = 5.5 * 3600e3;
export const dayKeyIST = t => new Date(t + IST_MS).toISOString().slice(0, 10);

/* A15 / A1 = feedAllBars() {EURUSD: {bars, live}}; q = quotes() {sym: {sp}} (sp = points) */
export function runScan({A15, A1, q = {}, events = [], bias = null, history = [], cfg = {}, now}){
  const all = {};
  Object.entries(A1 || {}).forEach(([k, v]) => { if(v && v.bars) all[k] = closedOnly(v.bars, H1, now) });
  const cs = strength(all);
  const list = SEN_PAIRS.map(sym => {
    const k = nameOf(sym), a = (A15 || {})[k], b = (A1 || {})[k];
    if(!a || !b || !a.bars || !b.bars) return {sym, dir: null, score: 0, parts: [], blocks: [`Feed में ${k} नहीं`], why: [], ok: false};
    const sp = q[sym] && q[sym].sp > 0 ? q[sym].sp * Math.pow(10, -digitsOf(sym)) : 0;
    return score({sym, b15: closedOnly(a.bars, M15, now), b1h: closedOnly(b.bars, H1, now), live: a.live, spread: sp, cs, events, bias, history, now, cfg});
  });
  list.sort((x, y) => (y.ok - x.ok) || (y.score - x.score));
  return {cs, list};
}
/* koi setup banne ke kareeb? (tab hi Gemini poochho — quota bachao) */
export const nearSetup = (list, cfg) => (list || []).some(r => r.dir && !r.blocks.length && r.score >= (cfg.minScore || 75) - 15);

/* radar ka chhota roop (Firebase / localStorage) */
export const slimRadar = r => ({sym: r.sym, dir: r.dir, dirHint: r.dirHint || null, score: r.score, ok: !!r.ok, blocks: r.blocks || [], why: (r.why || []).slice(0, 6),
  parts: (r.parts || []).map(p => ({k: p.k, pts: p.pts, max: p.max, txt: p.txt})), order: r.order || null, skip: r.skip || '', taken: r.taken || ''});

/* naya paper trade (risk = $ jo SL par jaayega, caller pipUsd se deta hai) */
export function newTrade(r, cfg, now, risk, aiSum, src){
  cfg = Object.assign({}, DEF_CFG, cfg || {});
  const o = r.order;
  return {id: 'SN' + now.toString(36) + nameOf(r.sym), sym: r.sym, dir: r.dir, type: o.type, entry: o.entry, sl: o.sl, tp: o.tp, rr: o.rr, dist: o.dist, spread: o.spread,
    score: r.score, why: (r.why || []).slice(0, 6), parts: (r.parts || []).map(p => ({k: p.k, pts: p.pts, max: p.max})), at: now, expiryMin: cfg.expiryMin, maxHoldH: cfg.maxHoldH,
    lot: cfg.lot, risk: r2(risk), reward: r2(risk * o.rr), state: 'PENDING', done: false, ai: aiSum || '', src: src || 'app', v: SEN_VERSION};
}
/* evalTrade ka nateeja trade par lagao; badla to purani halat lautao, warna null */
export function applyEval(t, res, now){
  const was = t.state;
  if(res.state === 'OPEN'){ t.state = 'OPEN'; t.fillAt = res.fillAt; t.cur = res.cur; t.r = res.r; t.usd = r2(res.r * (t.risk || 0)) }
  else if(res.done){ Object.assign(t, {state: res.state, res: res.state, done: true, exit: res.exit === undefined ? null : res.exit, fillAt: res.fillAt || null, exitAt: res.exitAt || now, r: res.r || 0, usd: r2((res.r || 0) * (t.risk || 0))}) }
  return was !== t.state ? was : null;
}
/* aaj (IST) ka hisaab */
export function todayUsd(trades, now){ const d = dayKeyIST(now); return r2((trades || []).filter(t => t.done && t.exitAt && dayKeyIST(t.exitAt) === d).reduce((a, t) => a + (+t.usd || 0), 0)) }
export function dayReport(trades, day){
  const T = trades || [];
  const closed = T.filter(t => t.done && t.exitAt && dayKeyIST(t.exitAt) === day && t.state !== 'EXPIRED');
  const made = T.filter(t => dayKeyIST(t.at) === day);
  const st = stats(closed), all = stats(T.filter(t => t.done));
  const byPair = {};
  closed.forEach(t => { const k = nameOf(t.sym), b = byPair[k] = byPair[k] || {n: 0, win: 0, usd: 0, R: 0}; b.n++; if(t.r > 0) b.win++; b.usd = r2(b.usd + (+t.usd || 0)); b.R = r2(b.R + (+t.r || 0)) });
  return {day, made: made.length, expired: made.filter(t => t.state === 'EXPIRED').length, open: T.filter(t => t.state === 'OPEN').length, pending: T.filter(t => t.state === 'PENDING').length,
    n: st.n, win: st.win, loss: st.loss, pct: st.pct, usd: st.usd, R: st.R, tp: st.tp, sl: st.sl, time: st.time, byPair,
    trades: closed.sort((a, b) => a.exitAt - b.exitAt).map(t => ({sym: nameOf(t.sym), dir: t.dir, score: t.score, res: t.res, r: t.r, usd: t.usd, at: t.at, exitAt: t.exitAt})),
    total: {n: all.n, pct: all.pct, usd: all.usd, R: all.R}};
}
