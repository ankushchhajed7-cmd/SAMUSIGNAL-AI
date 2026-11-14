/* CANDLE (Strategy 5) — pure logic, test hota hai (tests/candle.test.mjs).
   Signal: aakhri BAND candle mazboot + EMA 9/21 ki disha + RSI 14 theek zone -> AGLI candle ke liye BUY / SELL.
   Trade (PERSONAL FX v7.6 Strategy 5 / paper): TP +$0.25, SL -$1.50 (0.01 lot), candle band hote hi jo bhi P/L. */

export const DEF = {
  tf: 1,            /* 1 ya 5 minute */
  bodyMult: 1.2,    /* body >= pichhli 10 candle ki average body x 1.2 */
  bodyPct: 0.5,     /* body >= candle ki poori lambai (high-low) ka 50% (lambi poonch nahi) */
  fast: 9, slow: 21, rsiLen: 14,
  buyRsi: [50, 70], sellRsi: [30, 50],
  tp: 0.25, sl: 1.5, lot: 0.01, maxCandles: 1
};

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
   Ek hi candle me TP aur SL dono chhue -> SL maana (pakka pata nahi, isliye ghaate wala). */
export function paperResolve(p, bars, now = Date.now()){
  const tfMs = (p.tf || 1) * 60000, maxC = Math.max(1, p.maxCandles || 1);
  const scale = (p.lot || 0.01) / 0.01, k = p.k * scale, sp = Math.max(0, +p.spread || 0);
  const tpUsd = (p.tp === undefined ? DEF.tp : p.tp) * scale, slUsd = (p.sl === undefined ? DEF.sl : p.sl) * scale;
  if(!(k > 0)) return {done: false, why: 'k nahi'};
  const seq = bars.filter(b => b.t >= p.next).sort((a, b) => a.t - b.t);
  const first = seq[0];
  if(!first || first.t !== p.next) return {done: false, why: 'trade wali candle abhi nahi aayi'};
  const entry = p.dir === 'BUY' ? first.o + sp : first.o;
  const tpDist = tpUsd / k, slDist = slUsd / k;
  for(let i = 0; i < maxC; i++){
    const b = seq[i];
    if(!b || b.t + tfMs > now) return {done: false, entry, why: 'candle chal rahi hai'};
    let hitTp, hitSl;
    if(p.dir === 'BUY'){ hitTp = b.h >= entry + tpDist; hitSl = b.l <= entry - slDist }
    else{ hitTp = b.l + sp <= entry - tpDist; hitSl = b.h + sp >= entry + slDist }
    if(hitSl) return {done: true, entry, res: hitTp ? 'SL?' : 'SL', pl: -round2(slUsd), exitT: b.t};
    if(hitTp) return {done: true, entry, res: 'TP', pl: round2(tpUsd), exitT: b.t};
    if(i === maxC - 1){
      const pl = p.dir === 'BUY' ? (b.c - entry) * k : (entry - (b.c + sp)) * k;
      return {done: true, entry, res: 'CANDLE CLOSE', pl: round2(pl), exitT: b.t + tfMs};
    }
  }
  return {done: false, entry};
}
const round2 = v => Math.round(v * 100) / 100;

/* [{pl}] -> {n, win, loss, flat, net, wr} — sirf poore hue */
export function stats(list){
  const d = list.filter(x => x && isFinite(x.pl));
  const win = d.filter(x => x.pl > 0.004).length, loss = d.filter(x => x.pl < -0.004).length;
  const net = round2(d.reduce((a, x) => a + x.pl, 0));
  return {n: d.length, win, loss, flat: d.length - win - loss, net, wr: d.length ? Math.round(win / d.length * 100) : 0};
}

/* MT5 button kab tak (agli candle khulne ke baad): 1m = 20 sec, 5m = 60 sec */
export const sendWindowMs = tf => (tf === 5 ? 60 : 20) * 1000;
