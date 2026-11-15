/* CANDLE (Strategy 5) — pure logic, test hota hai (tests/candle.test.mjs).
   Signal: aakhri BAND candle mazboot + EMA 9/21 ki disha + RSI 14 theek zone -> AGLI candle ke liye BUY / SELL.
   Trade (PERSONAL FX v7.6 Strategy 5 / paper): TP +$0.25, SL -$1.50 (0.01 lot), candle band hote hi jo bhi P/L. */

export const DEF = {
  tf: 1,            /* 1 ya 5 minute */
  bodyMult: 1.2,    /* body >= pichhli 10 candle ki average body x 1.2 */
  bodyPct: 0.5,     /* body >= candle ki poori lambai (high-low) ka 50% (lambi poonch nahi) */
  fast: 9, slow: 21, rsiLen: 14,
  buyRsi: [50, 70], sellRsi: [30, 50],
  tp: 0.25, sl: 1.5, lot: 0.01, maxCandles: 1,
  /* 1.2.0 (user Final): PAPER ka TP candle ke hisaab se = signal candle ki body ka 50%, $0.10 se $1.00 (0.01 lot par).
     Asli EA (PERSONAL FX v7.6 Strategy 5) abhi bhi fixed $0.25. */
  tpBodyPct: 0.5, tpMin: 0.10, tpMax: 1.00,
  /* 1.3.0 (user 'Tulna Final'): SL ki tulna — (1) SL candle ke hisaab se = body ka 100%, $0.20–$1.50;
     (2) BREAK-EVEN: bhaav TP ki taraf 60% chale to SL entry par (fir ulta aaye to $0). */
  slBodyPct: 1.0, slMin: 0.20, slMax: 1.50, beAt: 0.6,
  /* 1.5.0 (user Final): PAPER ka SL $10 (0.01 lot) + TP candle ke hisaab se — sirf yahi ek jaanch. Asli EA wahi $0.25 / $1.50. */
  paperSl: 10,
  /* 1.5.0 (user): HOLD — trade SL $10 tak chalta hai (candle close par band nahi). Pehli candle: TP ya close fayde me = book.
     Dusri candle se: +$0.05 chhoote hi ya kisi candle ka close fayde me ho to wahi profit BOOK. Ek pair (+ tf) par ek hi trade. */
  bookUsd: 0.05, holdMaxMin: 200
};
/* paper SL ($, 0.01 lot) candle ke hisaab se */
export function dynSl(sg, k, cfg = DEF){
  const c = Object.assign({}, DEF, cfg);
  const v = (sg && sg.body > 0 && k > 0) ? sg.body * k * c.slBodyPct : c.sl;
  return Math.round(Math.min(c.slMax, Math.max(c.slMin, v)) * 100) / 100;
}
/* 4 tareeke (naam, SL kaunsa, break-even) — A = abhi wala */
export const VARIANTS = [
  {id: 'A', name: 'अभी वाला (SL $1.50)', dyn: false, be: false},
  {id: 'B', name: '1 · SL candle के हिसाब से', dyn: true, be: false},
  {id: 'C', name: '2 · Break-even', dyn: false, be: true},
  {id: 'D', name: '1+2 दोनों', dyn: true, be: true}
];
/* paper TP ($, 0.01 lot): signal candle body (price) x k ($ per 1.0 price, 0.01 lot) x 50%, seema ke andar */
export function dynTp(sg, k, cfg = DEF){
  const c = Object.assign({}, DEF, cfg);
  const v = (sg && sg.body > 0 && k > 0) ? sg.body * k * c.tpBodyPct : c.tp;
  return Math.round(Math.min(c.tpMax, Math.max(c.tpMin, v)) * 100) / 100;
}

export function ema(vals, n){
  const out = []; if(vals.length < n) return out;
  const k = 2 / (n + 1);
  let e = vals.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for(let i = 0; i < vals.length; i++){
    if(i < n - 1){ out.push(NaN); continue }
    if(i > n - 1) e = vals[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

/* Wilder RSI — aakhri value */
export function rsi(closes, n = 14){
  if(closes.length < n + 1) return NaN;
  let g = 0, l = 0;
  for(let i = 1; i <= n; i++){ const d = closes[i] - closes[i - 1]; if(d > 0) g += d; else l -= d }
  g /= n; l /= n;
  for(let i = n + 1; i < closes.length; i++){
    const d = closes[i] - closes[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
  }
  if(l === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / l);
}

/* sirf band candles (t + tf <= now). bars: [{t(ms), o, h, l, c}] purani pehle */
export const closedBars = (bars, tfMin, now = Date.now()) => bars.filter(b => b.t + tfMin * 60000 <= now);

/* bars = BAND candles. Lautata hai {dir: BUY|SELL|NO, why, at (signal candle ka open), next (agli candle ka open), ...numbers} */
export function signal(bars, cfg = DEF){
  const c = Object.assign({}, DEF, cfg), tfMs = c.tf * 60000;
  const need = Math.max(c.slow + 2, c.rsiLen + 2, 12);
  if(!bars || bars.length < need) return {dir: 'NO', why: 'kam candles (' + (bars ? bars.length : 0) + ')', at: 0, next: 0};
  const last = bars[bars.length - 1], closes = bars.map(b => b.c);
  const e9 = ema(closes, c.fast).pop(), e21 = ema(closes, c.slow).pop(), r = rsi(closes, c.rsiLen);
  const prev = bars.slice(-11, -1), avg = prev.reduce((a, b) => a + Math.abs(b.c - b.o), 0) / prev.length;
  const body = Math.abs(last.c - last.o), range = last.h - last.l;
  const base = {at: last.t, next: last.t + tfMs, body, avg, range, e9, e21, rsi: r, close: last.c};
  const green = last.c > last.o, red = last.c < last.o;
  if(!green && !red) return Object.assign(base, {dir: 'NO', why: 'doji candle (open = close)'});
  if(!(range > 0) || body < c.bodyPct * range) return Object.assign(base, {dir: 'NO', why: 'lambi poonch — body chhoti'});
  if(!(avg > 0) || body < c.bodyMult * avg) return Object.assign(base, {dir: 'NO', why: 'candle mazboot nahi (average se chhoti)'});
  if(green){
    if(!(e9 > e21)) return Object.assign(base, {dir: 'NO', why: 'hari candle par EMA 9 < 21 (trend neeche)'});
    if(!(last.c > e9)) return Object.assign(base, {dir: 'NO', why: 'close EMA 9 ke neeche'});
    if(!(r >= c.buyRsi[0] && r < c.buyRsi[1])) return Object.assign(base, {dir: 'NO', why: r >= c.buyRsi[1] ? 'RSI ' + r.toFixed(0) + ' — zyada upar (overbought)' : 'RSI ' + r.toFixed(0) + ' — 50 se kam'});
    return Object.assign(base, {dir: 'BUY', why: 'mazboot hari candle + EMA 9 > 21 + RSI ' + r.toFixed(0)});
  }
  if(!(e9 < e21)) return Object.assign(base, {dir: 'NO', why: 'laal candle par EMA 9 > 21 (trend upar)'});
  if(!(last.c < e9)) return Object.assign(base, {dir: 'NO', why: 'close EMA 9 ke upar'});
  if(!(r <= c.sellRsi[1] && r > c.sellRsi[0])) return Object.assign(base, {dir: 'NO', why: r <= c.sellRsi[0] ? 'RSI ' + r.toFixed(0) + ' — zyada neeche (oversold)' : 'RSI ' + r.toFixed(0) + ' — 50 se upar'});
  return Object.assign(base, {dir: 'SELL', why: 'mazboot laal candle + EMA 9 < 21 + RSI ' + r.toFixed(0)});
}

/* PAPER trade ka nateeja — EA (Strategy 5) jaise niyam, band candles ke OHLC se (bid bhaav).
   p = {dir, next (trade wali candle ka open ms), tf, spread (price), k ($ per 1.0 price, 0.01 lot pe), tp, sl, lot, maxCandles}
   Entry = trade wali candle ka open (BUY = open + spread, yaani ask).
   Ek hi candle me TP aur SL dono chhue -> SL maana (pakka pata nahi, isliye ghaate wala).
   1.3.0 p.be = true: bhaav TP ki taraf beAt (60%) chal gaya to SL entry par. Ek hi candle me 60% chhua aur close entry ke
   ulti taraf -> beech me entry se guzra hi hoga -> 'BE' $0 (SL pehle chhua ho to SL, ghaate wala maana). */
export function paperResolve(p, bars, now = Date.now()){
  const tfMs = (p.tf || 1) * 60000, maxC = Math.max(1, p.maxCandles || 1);
  const scale = (p.lot || 0.01) / 0.01, k = p.k * scale, sp = Math.max(0, +p.spread || 0);
  const tpUsd = (p.tp === undefined ? DEF.tp : p.tp) * scale, slUsd = (p.sl === undefined ? DEF.sl : p.sl) * scale;
  if(!(k > 0)) return {done: false, why: 'k nahi'};
  const seq = bars.filter(b => b.t >= p.next).sort((a, b) => a.t - b.t);
  const first = seq[0];
  if(!first || first.t !== p.next) return {done: false, why: 'trade wali candle abhi nahi aayi'};
  const entry = p.dir === 'BUY' ? first.o + sp : first.o;
  const tpDist = tpUsd / k, slDist = slUsd / k, beDist = (p.beAt || DEF.beAt) * tpDist;
  let armed = false;
  for(let i = 0; i < maxC; i++){
    const b = seq[i];
    if(!b || b.t + tfMs > now) return {done: false, entry, why: 'candle chal rahi hai'};
    let hitTp, hitSl, fav, adv;
    if(p.dir === 'BUY'){ hitTp = b.h >= entry + tpDist; hitSl = b.l <= entry - slDist; fav = b.h - entry; adv = b.l - entry }
    else{ hitTp = b.l + sp <= entry - tpDist; hitSl = b.h + sp >= entry + slDist; fav = entry - (b.l + sp); adv = entry - (b.h + sp) }
    if(armed && adv <= 0) return {done: true, entry, res: 'BE', pl: 0, exitT: b.t};          /* pichhli candle me 60% hua tha */
    if(hitSl) return {done: true, entry, res: hitTp ? 'SL?' : 'SL', pl: -round2(slUsd), exitT: b.t};
    if(hitTp) return {done: true, entry, res: 'TP', pl: round2(tpUsd), exitT: b.t};
    const closePl = p.dir === 'BUY' ? (b.c - entry) * k : (entry - (b.c + sp)) * k;
    if(p.be && fav >= beDist){
      if(closePl < 0) return {done: true, entry, res: 'BE', pl: 0, exitT: b.t};
      armed = true;
    }
    if(p.hold){                                                       /* 1.5.0: SL tak ruko, profit dikhte hi book */
      const bookUsd = (p.book === undefined ? DEF.bookUsd : p.book) * scale;
      if(i >= 1 && fav * k >= bookUsd) return {done: true, entry, res: 'PROFIT BOOK', pl: round2(bookUsd), exitT: b.t, n: i + 1};
      if(closePl > 0.004) return {done: true, entry, res: 'PROFIT BOOK', pl: round2(closePl), exitT: b.t + tfMs, n: i + 1};
      if(i === maxC - 1) return {done: true, entry, res: 'TIME', pl: round2(closePl), exitT: b.t + tfMs, n: i + 1};
      continue;
    }
    if(i === maxC - 1) return {done: true, entry, res: 'CANDLE CLOSE', pl: round2(closePl), exitT: b.t + tfMs};
  }
  return {done: false, entry};
}
const round2 = v => Math.round(v * 100) / 100;

/* 1.6.0 (user "Naap Final"): 4 PUSHTI — sirf likhi jaati hain (paper ka niyam / signal nahi badalta).
   bars = band candles (signal wali aakhri), htf = badi timeframe ki band candles (1 MIN -> 5 MIN, 5 MIN -> 15 MIN).
   1 = badi TF ka trend saath (EMA 9 vs 21) · 2 = close candle ke sire par (BUY upar 25%, SELL neeche 25%)
   3 = thaki nahi (body <= 3x average aur close EMA 21 se <= 4x average body door) · 4 = pichhli candle bhi usi rang ki.
   Data kam ho to us pushti ka null. */
export const CONFIRMS = [
  {id: '1', name: 'बड़ी TF का trend साथ'},
  {id: '2', name: 'Close candle के सिरे पर'},
  {id: '3', name: 'थकी हुई candle नहीं'},
  {id: '4', name: 'दो candle एक रंग'}
];
export function confirms(sg, bars, htf){
  const out = {1: null, 2: null, 3: null, 4: null};
  if(!sg || (sg.dir !== 'BUY' && sg.dir !== 'SELL') || !bars || bars.length < 2) return out;
  const buy = sg.dir === 'BUY', last = bars[bars.length - 1], prev = bars[bars.length - 2];
  if(htf && htf.length >= DEF.slow + 2){
    const cl = htf.map(b => b.c), e9 = ema(cl, DEF.fast).pop(), e21 = ema(cl, DEF.slow).pop();
    if(isFinite(e9) && isFinite(e21)) out[1] = buy ? e9 > e21 : e9 < e21;
  }
  const rng = last.h - last.l;
  if(rng > 0) out[2] = buy ? (last.c - last.l) / rng >= 0.75 : (last.h - last.c) / rng >= 0.75;
  if(sg.avg > 0 && isFinite(sg.e21)) out[3] = sg.body <= 3 * sg.avg && Math.abs(last.c - sg.e21) <= 4 * sg.avg;
  out[4] = buy ? prev.c > prev.o : prev.c < prev.o;
  return out;
}
/* 1.3.0: ek paper trade ke 4 nateeje. p.sl = fixed SL, p.slDyn = candle wala SL. Lautata {done, entry, v: {A: {res, pl}, ...}} */
export function paperVariants(p, bars, now = Date.now()){
  const v = {}; let entry, done = true;
  for(const x of VARIANTS){
    const r = paperResolve(Object.assign({}, p, {sl: x.dyn && isFinite(p.slDyn) ? p.slDyn : p.sl, be: x.be}), bars, now);
    if(r.entry !== undefined) entry = r.entry;
    if(!r.done){ done = false; continue }
    v[x.id] = {res: r.res, pl: r.pl};
  }
  return {done, entry, v};
}

/* [{pl}] -> {n, win, loss, flat, net, wr} — sirf poore hue */
export function stats(list){
  const d = list.filter(x => x && isFinite(x.pl));
  const win = d.filter(x => x.pl > 0.004).length, loss = d.filter(x => x.pl < -0.004).length;
  const net = round2(d.reduce((a, x) => a + x.pl, 0));
  return {n: d.length, win, loss, flat: d.length - win - loss, net, wr: d.length ? Math.round(win / d.length * 100) : 0};
}

/* MT5 button kab tak (agli candle khulne ke baad): 1m = 20 sec, 5m = 60 sec */
export const sendWindowMs = tf => (tf === 5 ? 60 : 20) * 1000;
