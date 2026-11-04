/* 🐋 Order Flow — Binance ka FREE public market data (koi key nahi). Tradfye jaisa: kaun control me hai.
   Sirf Gold (PAXG token) + crypto — forex ka koi public order book nahi hota.
   Data: data-api.binance.vision (REST) + data-stream.binance.vision (WebSocket) — Binance ke "sirf market data" wale official raaste;
   na chale to api.binance.com / stream.binance.com. */
export const FLOW_SYMS = [
  {id: 'PAXGUSDT', name: 'GOLD', sub: 'PAXG/USDT · gold token', d: 2},
  {id: 'BTCUSDT', name: 'BTC', sub: 'BTC/USDT', d: 2},
  {id: 'ETHUSDT', name: 'ETH', sub: 'ETH/USDT', d: 2}
];
export const REST = ['https://data-api.binance.vision', 'https://api.binance.com'];
export const WS = ['wss://data-stream.binance.vision', 'wss://stream.binance.com:9443'];

/* trades: [{t ms, p, q, usd, buy(bool: aggressive buyer)}] */
export function windowStats(trades, now, ms){
  let b = 0, s = 0, n = 0, big = 0;
  for(let i = trades.length - 1; i >= 0; i--){
    const x = trades[i]; if(now - x.t > ms) break;
    n++; if(x.buy) b += x.usd; else s += x.usd; if(x.usd > big) big = x.usd;
  }
  const tot = b + s;
  return {buy: b, sell: s, n, big, share: tot ? b / tot : 0.5, delta: tot ? (b - s) / tot : 0};
}
/* order book (top levels) -> imbalance near price + biggest walls */
export function bookStats(bids, asks, mid, pct = 0.003){
  const near = (lv, side) => lv.filter(([p]) => side > 0 ? p <= mid && p >= mid * (1 - pct) : p >= mid && p <= mid * (1 + pct));
  const nb = near(bids, 1), na = near(asks, -1);
  const usd = lv => lv.reduce((a, [p, q]) => a + p * q, 0);
  const bU = usd(nb), aU = usd(na);
  const wall = lv => lv.reduce((m, [p, q]) => p * q > (m ? m.usd : 0) ? {p, usd: p * q} : m, null);
  return {bidUsd: bU, askUsd: aU, imb: bU + aU ? (bU - aU) / (bU + aU) : 0, askWall: wall(na), bidWall: wall(nb)};
}
/* Faisla: score -100..+100 = 1 min delta 40% + 5 min delta 35% + order book 25% */
export function decide(trades, book, now){
  const w10 = windowStats(trades, now, 10e3), w1 = windowStats(trades, now, 60e3), w5 = windowStats(trades, now, 300e3), w15 = windowStats(trades, now, 900e3);
  const span = trades.length ? (now - trades[0].t) / 1000 : 0;
  const tps = w1.n / 60, base = span > 120 ? w15.n / Math.min(900, span) : tps;
  const activity = base ? Math.min(2, tps / base) : 1;
  const imb = book ? book.imb : 0;
  const score = Math.round(100 * (0.4 * w1.delta + 0.35 * w5.delta + 0.25 * imb));
  const strength = Math.abs(score);
  const okAct = activity >= 0.5, okStr = strength >= 22;
  const side = score >= 22 ? 'BUY' : score <= -22 ? 'SELL' : 'WAIT';
  const decision = okAct && okStr ? side : 'WAIT';
  const ev = [];
  if(w1.buy + w1.sell > 0) ev.push({ok: w1.delta > 0, t: (w1.delta >= 0 ? 'Buyers' : 'Sellers') + ` took ${Math.round(100 * Math.max(w1.share, 1 - w1.share))}% of 1-min volume`});
  if(Math.abs(w10.delta) > 0.3 && w10.n >= 3) ev.push({ok: w10.delta > 0, t: (w10.delta > 0 ? 'Buying' : 'Selling') + ' burst in the last 10 s'});
  if(w5.buy + w5.sell > 0) ev.push({ok: w5.delta > 0, t: 'Net ' + (w5.delta >= 0 ? 'buying' : 'selling') + ' over 5 min'});
  if(book) ev.push({ok: Math.sign(imb) === Math.sign(score) && Math.abs(imb) > 0.1, t: Math.abs(imb) > 0.1 ? (Math.sign(imb) === Math.sign(score) ? 'Order book agrees' : 'Order book disagrees') : 'Order book neutral', n: Math.abs(imb) <= 0.1});
  const ctrl = decision === 'BUY' ? 'Buyers are in control.' : decision === 'SELL' ? 'Sellers are in control.'
    : !okAct ? 'Market is quiet — too little activity.' : 'Buyers and sellers are balanced — nobody is in control.';
  return {decision, score, strength, activity, tps, w10, w1, w5, w15, imb, ev, ctrl, missing: [!okStr && 'Strength', !okAct && 'Activity'].filter(Boolean), warm: span < 290};
}
/* whale = pichhle 15 min ke trades ka top 1% (kam se kam $10K) */
export function whaleCut(trades, now){
  const v = trades.filter(x => now - x.t <= 900e3).map(x => x.usd).sort((a, b) => a - b);
  if(v.length < 50) return 10000;
  return Math.max(10000, v[Math.floor(v.length * 0.99)]);
}
