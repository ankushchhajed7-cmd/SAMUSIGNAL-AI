import test from 'node:test';
import assert from 'node:assert/strict';
import {ema, rsi, signal, closedBars, paperResolve, stats, DEF, sendWindowMs, dynTp, dynSl, paperVariants, confirms, weather} from '../src/candlerules.js';

test('1.8.0 weather: mausam', () => {
  const M_ = 60000, t0 = Date.UTC(2026, 10, 16, 6, 0);            /* 11:30 IST — koi session nahi */
  const calm = Array.from({length: 200}, (_, i) => ({t: t0 - (200 - i) * M_, o: 100, h: 100.1 + (i % 3) * 0.01, l: 99.9 - (i % 2) * 0.01, c: 100 + (i % 5) * 0.004}));
  assert.equal(weather({b1: calm, now: t0, sym: 'EUR/USD'}).c, 'G');
  const fast = calm.slice(0, -10).concat(Array.from({length: 10}, (_, i) => ({t: t0 - (10 - i) * M_, o: 100, h: 100.2, l: 99.8, c: 100})));
  const w = weather({b1: fast, now: t0, sym: 'EUR/USD'});
  assert.equal(w.c, 'R'); assert.ok(w.why.some(x => x.includes('रफ़्तार')));
  assert.equal(weather({b1: calm, now: t0, sym: 'BTC/USD', news: [{t: t0 / 1000 + 1800, cur: 'USD', imp: 'High'}]}).c, 'R');
  assert.equal(weather({b1: calm, now: t0, sym: 'EUR/JPY', news: [{t: t0 / 1000 + 1800, cur: 'USD', imp: 'High'}]}).c, 'G');
  assert.equal(weather({b1: calm, now: Date.UTC(2026, 10, 16, 8, 5), sym: 'EUR/USD'}).c, 'Y');   /* London */
  assert.equal(weather({b1: calm, now: t0, sym: 'EUR/USD', spreadRatio: 2.5}).c, 'R');
});

test('1.6.0 confirms: 4 pushti', () => {
  const M_ = 60000, t = Date.UTC(2026, 10, 15, 10, 0);
  const up = n => Array.from({length: n}, (_, i) => ({t: t + i * M_, o: 100 + i * 0.1, h: 100.2 + i * 0.1, l: 99.9 + i * 0.1, c: 100.1 + i * 0.1}));
  const bars = [{t, o: 100, h: 100.3, l: 99.9, c: 100.2}, {t: t + M_, o: 100.2, h: 100.62, l: 100.15, c: 100.6}];
  const sg = {dir: 'BUY', body: 0.4, avg: 0.2, e21: 100.1};
  const c = confirms(sg, bars, up(30));
  assert.deepEqual(c, {1: true, 2: true, 3: true, 4: true});
  /* SELL usi upar wale trend me: 1 = false, pichhli hari: 4 = false */
  const c2 = confirms({dir: 'SELL', body: 0.4, avg: 0.2, e21: 100.1}, [bars[0], {t: t + M_, o: 100.6, h: 100.62, l: 100.15, c: 100.2}], up(30));
  assert.equal(c2[1], false); assert.equal(c2[4], false); assert.equal(c2[2], true);
  /* thaki: body 1.0 > 3 x 0.2 */
  assert.equal(confirms({dir: 'BUY', body: 1.0, avg: 0.2, e21: 100.1}, bars, null)[3], false);
  assert.equal(confirms({dir: 'BUY', body: 0.4, avg: 0.2, e21: 100.1}, bars, null)[1], null);   /* badi TF data nahi */
});

test('1.5.0 hold: SL $10 tak, profit dikhte hi book', () => {
  const M_ = 60000, t = Date.UTC(2026, 10, 15, 10, 0);
  const p = {dir: 'BUY', next: t, tf: 1, spread: 0, k: 1, tp: 0.5, sl: 10, lot: 0.01, maxCandles: 200, hold: true};
  /* candle 1 ghaate me band (99.7), candle 2 me high 99.9 (+$0 se kam) close 99.8, candle 3 me high 100.06 -> +$0.05 book */
  const bars = [{t, o: 100, h: 100.1, l: 99.6, c: 99.7}, {t: t + M_, o: 99.7, h: 99.9, l: 99.5, c: 99.8}, {t: t + 2 * M_, o: 99.8, h: 100.06, l: 99.7, c: 99.9}];
  assert.equal(paperResolve(p, bars.slice(0, 1), t + M_ + 1).done, false);          /* pehli candle ghaate me -> chalta rahe */
  const r = paperResolve(p, bars, t + 3 * M_ + 1);
  assert.equal(r.res, 'PROFIT BOOK'); assert.equal(r.pl, 0.05); assert.equal(r.n, 3);
  assert.equal(r.mae, -0.5);                                          /* sabse neeche 99.5 (candle 2) */
  /* pehli candle close fayde me -> wahi book */
  const r1 = paperResolve(p, [{t, o: 100, h: 100.3, l: 99.9, c: 100.2}], t + M_ + 1);
  assert.equal(r1.res, 'PROFIT BOOK'); assert.equal(r1.pl, 0.2);
  /* TP chhua */
  assert.equal(paperResolve(p, [{t, o: 100, h: 100.6, l: 99.9, c: 100.2}], t + M_ + 1).res, 'TP');
  /* SL $10 */
  assert.equal(paperResolve(p, [{t, o: 100, h: 100.1, l: 89.9, c: 90}], t + M_ + 1).res, 'SL');
});

test('1.3.0 dynSl: body ka 100%, $0.20 - $1.50', () => {
  assert.equal(dynSl({body: 0.0006}, 1000), 0.60);
  assert.equal(dynSl({body: 0.0001}, 1000), 0.20);
  assert.equal(dynSl({body: 500}, 0.01), 1.50);
  assert.equal(dynSl({}, 1000), DEF.sl);
});

test('1.3.0 break-even + 4 tareeke', () => {
  const M_ = 60000, t = Date.UTC(2026, 10, 15, 10, 0), end = t + M_ + 1;
  const p = {dir: 'BUY', next: t, tf: 1, spread: 0, k: 1, tp: 0.5, sl: 1.5, slDyn: 0.3, lot: 0.01, maxCandles: 1};
  /* entry 100, 60% of TP = +0.30 chhua (high 100.35), close 99.9 -> BE 0; SL 1.5 nahi; candle SL 0.3 -> low 99.6 nahi chhua (99.75) */
  const b1 = [{t, o: 100, h: 100.35, l: 99.75, c: 99.9}];
  const r = paperVariants(p, b1, end);
  assert.equal(r.done, true);
  assert.deepEqual(r.v.A, {res: 'CANDLE CLOSE', pl: -0.1});
  assert.deepEqual(r.v.B, {res: 'CANDLE CLOSE', pl: -0.1});
  assert.deepEqual(r.v.C, {res: 'BE', pl: 0});
  assert.deepEqual(r.v.D, {res: 'BE', pl: 0});
  /* low 99.6 -> candle SL (0.3) lagta hai, fixed nahi */
  const r2 = paperVariants(p, [{t, o: 100, h: 100.1, l: 99.6, c: 99.8}], end);
  assert.deepEqual(r2.v.A, {res: 'CANDLE CLOSE', pl: -0.2});
  assert.deepEqual(r2.v.B, {res: 'SL', pl: -0.3});
  /* 60% chhua aur close fayde me -> BE nahi, candle close */
  const r3 = paperVariants(p, [{t, o: 100, h: 100.4, l: 99.9, c: 100.2}], end);
  assert.deepEqual(r3.v.C, {res: 'CANDLE CLOSE', pl: 0.2});
});

test('1.2.0 dynTp: body ka 50%, $0.10 - $1.00', () => {
  assert.equal(dynTp({body: 0.0006}, 1000), 0.30);      /* GBPUSD 6 pip -> $0.30 */
  assert.equal(dynTp({body: 0.0002}, 1000), 0.10);      /* chhoti candle -> kam se kam $0.10 */
  assert.equal(dynTp({body: 300}, 0.01), 1.00);         /* BTC $300 -> zyada se zyada $1.00 */
  assert.equal(dynTp({body: 80}, 0.01), 0.40);          /* BTC $80 -> $0.40 */
  assert.equal(dynTp({}, 1000), DEF.tp);                /* body nahi -> purana $0.25 */
});

const M = 60000, T0 = Date.UTC(2026, 10, 14, 10, 0);
/* chhote-chhote candles (body 0.2) ek disha me, phir aakhri candle jaisi chahiye */
function mk(n, step, lastBody, opts = {}){
  const out = []; let p = 2650;
  const dir = step > 0 ? 1 : -1;
  for(let i = 0; i < n; i++){
    const o = p, c = p + (i % 2 === 0 ? 0.25 : -0.2) * dir;   /* aage 0.25, peeche 0.2 -> halka trend, RSI ~55 */
    out.push({t: T0 + i * M, o, h: Math.max(o, c) + 0.05, l: Math.min(o, c) - 0.05, c});
    p = c;
  }
  if(lastBody !== undefined){
    const o = p, c = p + lastBody, wick = opts.wick || 0.05;
    out.push({t: T0 + n * M, o, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, c});
  }
  return out;
}

test('ema / rsi basic', () => {
  const e = ema([1, 2, 3, 4, 5, 6], 3);
  assert.ok(isNaN(e[0]) && isNaN(e[1]));
  assert.equal(e[2], 2);
  assert.ok(e[5] > e[4]);
  assert.equal(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14), 100);
  assert.ok(isNaN(rsi([1, 2, 3], 14)));
});

test('closedBars sirf band candles', () => {
  const b = [{t: T0}, {t: T0 + M}, {t: T0 + 2 * M}];
  assert.equal(closedBars(b, 1, T0 + 2 * M + 5000).length, 2);
  assert.equal(closedBars(b, 1, T0 + 3 * M).length, 3);
});

test('BUY: uptrend + mazboot hari candle', () => {
  const s = signal(mk(40, 1, 0.6), DEF);
  assert.equal(s.dir, 'BUY', s.why);
  assert.equal(s.next, s.at + M);
});

test('SELL: downtrend + mazboot laal candle', () => {
  const s = signal(mk(40, -1, -0.6), DEF);
  assert.equal(s.dir, 'SELL', s.why);
});

test('NO: chhoti candle / ulta trend / lambi poonch / kam candles', () => {
  assert.equal(signal(mk(40, 1, 0.1)).dir, 'NO');                 /* average se chhoti */
  assert.match(signal(mk(40, -1, 0.6)).why, /EMA|close/);           /* hari candle, trend neeche */
  assert.match(signal(mk(40, 1, 0.6, {wick: 1.5})).why, /poonch/);
  assert.match(signal(mk(5, 1, 0.6)).why, /kam candles/);
});

const k = 1;   /* gold 0.01 lot: $1 per 1.0 price */
const P = dir => ({dir, next: T0 + 10 * M, tf: 1, spread: 0.2, k, tp: 0.25, sl: 1.5, lot: 0.01, maxCandles: 1});
const bar = (o, h, l, c, i = 10) => ({t: T0 + i * M, o, h, l, c});

test('paper BUY: TP / SL / candle close / abhi chal rahi', () => {
  const end = T0 + 11 * M + 1;
  assert.deepEqual(paperResolve(P('BUY'), [bar(100, 100.5, 99.9, 100.3)], end).res, 'TP');      /* entry 100.2, TP 100.45 */
  assert.equal(paperResolve(P('BUY'), [bar(100, 100.3, 98.6, 99)], end).res, 'SL');              /* SL 98.7 */
  assert.equal(paperResolve(P('BUY'), [bar(100, 100.5, 98.6, 99)], end).res, 'SL?');            /* dono chhue -> SL */
  const cc = paperResolve(P('BUY'), [bar(100, 100.4, 99.5, 100.1)], end);
  assert.equal(cc.res, 'CANDLE CLOSE'); assert.equal(cc.pl, -0.1);                                /* 100.1 - 100.2 */
  assert.equal(paperResolve(P('BUY'), [bar(100, 100.1, 99.9, 100)], T0 + 10 * M + 30000).done, false);
  assert.equal(paperResolve(P('BUY'), [bar(100, 100.1, 99.9, 100, 9)], end).done, false);       /* trade wali candle nahi */
});

test('paper SELL: spread ke saath', () => {
  const end = T0 + 11 * M + 1;
  assert.equal(paperResolve(P('SELL'), [bar(100, 100.1, 99.5, 99.6)], end).res, 'TP');            /* ask low 99.7 <= 99.75 */
  assert.equal(paperResolve(P('SELL'), [bar(100, 101.4, 99.9, 101)], end).res, 'SL');             /* ask high 101.6 >= 101.5 */
  const cc = paperResolve(P('SELL'), [bar(100, 100.2, 99.8, 99.9)], end);
  assert.equal(cc.res, 'CANDLE CLOSE'); assert.equal(cc.pl, -0.1);                                 /* 100 - (99.9+0.2) */
});

test('paper lot 0.02 = dugna', () => {
  const r = paperResolve(Object.assign(P('BUY'), {lot: 0.02}), [bar(100, 100.5, 99.9, 100.3)], T0 + 11 * M + 1);
  assert.equal(r.res, 'TP'); assert.equal(r.pl, 0.5);
});

test('stats + send window', () => {
  const s = stats([{pl: 0.25}, {pl: 0.25}, {pl: -1.5}, {pl: 0}, {pl: NaN}]);
  assert.deepEqual(s, {n: 4, win: 2, loss: 1, flat: 1, net: -1, wr: 50});
  assert.equal(sendWindowMs(1), 20000); assert.equal(sendWindowMs(5), 60000);
});
