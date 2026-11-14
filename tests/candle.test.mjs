import test from 'node:test';
import assert from 'node:assert/strict';
import {ema, rsi, signal, closedBars, paperResolve, stats, DEF, sendWindowMs, dynTp} from '../src/candlerules.js';

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
