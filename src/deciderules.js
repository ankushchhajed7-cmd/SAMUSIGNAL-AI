/* 🎯 BUY YA SELL? — niyam (pure logic, test hota hai). UI + Gemini + MT5: decide.js
   Scalping $1 / $2 (0.01 lot). Timeframe: 1H mahaul · 15m disha · 5m setup · 1m trigger
   (4H / Daily nahi — $1–2 ka move 1–15 min me hota hai, bade timeframe ka trend us waqt $5–10 ulta jhatka de sakta hai). */
import {ema, rsi, atr, adx, macdHist, trendScore} from './engine.js';

export const DC_VERSION = '1.0.0';
export const TFS = [['1H', '1h'], ['15m', '15min'], ['5m', '5min'], ['1m', '1min']];
export const MAX_MS = 5 * 60e3;          /* faisla 5 min tak hi MT5 bhejne layak */

export const AGENTS = [
  {k: 'trend', ic: '📈', n: 'Trend agent', job: 'Tum TREND expert ho. 1H mahaul + 15m disha dekho (EMA 9/21/50, trendScore -3..+3). Scalp ke liye trend ki disha behtar, par 15m aur 1H takra rahe hon to saaf bolo.'},
  {k: 'mom', ic: '⚡', n: 'Momentum agent', job: 'Tum MOMENTUM expert ho. 5m aur 1m par RSI, MACD histogram (badh raha / ghat raha), ADX + DI, pichhli candles ki raftaar. Abhi kis taraf zor hai, aur kya zor khatam ho raha hai (RSI extreme)?'},
  {k: 'lvl', ic: '🧱', n: 'Level agent', job: 'Tum PRICE ACTION / LEVEL expert ho. 5m aur 15m ke swing high/low (hh20/ll20), range me bhaav kahan (0% neeche, 100% upar), aakhri candles ke wick. $1–2 ke scalp ke liye kis taraf saaf jagah hai aur kis taraf deewar paas hai?'},
  {k: 'news', ic: '📰', n: 'News agent', search: true, job: 'Tum NEWS / MACRO expert ho. Google Search se ABHI ki is pair ki taaza khabar dekho (gold ho to gold + USD + Fed + yields + geopolitics), aur diye MT5 calendar me agle 60 min ki High impact news. Khabar kis disha ko dhakel rahi hai? High news 30 min ke andar ho to saaf chetavni do.'},
  {k: 'risk', ic: '🛡', n: 'Risk agent', job: 'Tum RISK expert ho. Bazaar saaf chal raha hai ya sideways/chop (ADX < 20, Efficiency Ratio < 0.25 = chop), spread $ me, ATR 1m/5m $ me ($1 target kitni jaldi), session (Asia dheema, London/NY tez). Kis disha me ulta jhatka kam? Grid/hedge EA ke liye chop sabse bura.'}
];

/* Efficiency Ratio: 1 = seedhi chaal, 0 = chop */
export function effRatio(cl, n = 20){
  if(cl.length <= n) return 0;
  let s = 0; for(let i = cl.length - n; i < cl.length; i++) s += Math.abs(cl[i] - cl[i - 1]);
  return s ? +(Math.abs(cl[cl.length - 1] - cl[cl.length - 1 - n]) / s).toFixed(2) : 0;
}
export function session(now = Date.now()){
  const h = new Date(now).getUTCHours();
  return h >= 22 || h < 7 ? 'Asia (dheema)' : h < 12 ? 'London' : h < 16 ? 'London + New York (sabse tez)' : h < 21 ? 'New York' : 'NY band hone ke paas (dheema)';
}
/* ek timeframe ke asli number. usdU = 0.01 lot par bhaav 1.0 chale to kitne $ */
export function tfSummary(b, usdU){
  const cl = b.map(x => x.c), L = cl.length - 1, d = adx(b), H20 = Math.max(...b.slice(-20).map(x => x.h)), L20 = Math.min(...b.slice(-20).map(x => x.l));
  const ts = trendScore(b), px = cl[L], e9 = ema(cl, 9)[L], e21 = ema(cl, 21)[L], e50 = ema(cl, 50)[L];
  const mh = macdHist(cl), mhPrev = macdHist(cl.slice(0, -1));
  return {bias: ts >= 2 ? 'BUY' : ts <= -2 ? 'SELL' : 'NEUTRAL', trendScore: ts, close: px, ema9: +e9.toFixed(5), ema21: +e21.toFixed(5), ema50: +e50.toFixed(5),
    rsi: +rsi(cl).toFixed(1), macdHist: +mh.toFixed(6), macdRising: mh > mhPrev, adx: +d.adx.toFixed(1), diPlus: +d.pdi.toFixed(1), diMinus: +d.mdi.toFixed(1),
    atrUsd: +(atr(b) * usdU).toFixed(2), effRatio20: effRatio(cl), hh20: H20, ll20: L20,
    rangePos: H20 > L20 ? Math.round((px - L20) / (H20 - L20) * 100) : 50, move5barsUsd: +((px - cl[Math.max(0, L - 5)]) * usdU).toFixed(2)};
}
export const candleStr = (b, n, d) => b.slice(-n).map(x => [x.o, x.h, x.l, x.c].map(v => (+v).toFixed(d)).join(',')).join(' ');

/* AI ka jawab -> saaf vote */
export function parseVote(o){
  o = o || {};
  return {vote: /SELL/i.test(o.vote || o.verdict || '') ? 'SELL' : 'BUY', conf: Math.max(50, Math.min(95, Math.round(+o.conf || 60))),
    why: String(o.why || '').slice(0, 300), watch: String(o.watch || '').slice(0, 200)};
}
export function parseJudge(o){
  o = o || {};
  return {verdict: /SELL/i.test(o.verdict || '') ? 'SELL' : 'BUY', prob: Math.max(50, Math.min(85, Math.round(+o.prob || 55))),
    why: String(o.why || '').slice(0, 500), against: String(o.against || '').slice(0, 250), wait: o.waitBetter === true || o.waitBetter === 'true',
    minutes: String(o.minutes || '').slice(0, 30)};
}

/* record: entry ke baad 1-min candles (t = ms) me pehle +$T ya −$T? 60 min. Ek candle me dono = haar.
   'W' / 'L' / '0' (60 min me dono nahi) / null (abhi pata nahi). */
export function outcome(h, bars, T){
  const dist = T / (h.usdU || 1), sg = h.dir === 'BUY' ? 1 : -1, end = h.at + 3600e3;
  const after = bars.filter(b => b.t + 60e3 > h.at);
  for(const b of after){
    if(b.t > end) break;
    const win = sg > 0 ? b.h >= h.px + dist : b.l <= h.px - dist;
    const loss = sg > 0 ? b.l <= h.px - dist : b.h >= h.px + dist;
    if(loss) return 'L';
    if(win) return 'W';
  }
  return after.length && after[after.length - 1].t >= end ? '0' : null;
}
export function stats(hist, key, f){
  const a = hist.filter(h => (h[key] === 'W' || h[key] === 'L') && (!f || f(h))), w = a.filter(h => h[key] === 'W').length;
  return {n: a.length, w, pct: a.length ? Math.round(w / a.length * 100) : null};
}
