import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze, evaluate, evaluateMarket, evaluateTrail, councilPlan, ema, rsi, adx, impulse, atr} from '../src/engine.js';
import {pipUsd} from '../src/symbols.js';
const spec = {d: 5, pip: 0.0001};
function mk(n, start, step, tf, wave = 0.0004, t0 = 1.7e12){
  const out = []; let p = start;
  for(let i = 0; i < n; i++){ const o = p; p = p + step + Math.sin(i / 3) * wave; out.push({t: t0 + i * tf, o, h: Math.max(o, p) + 0.0002, l: Math.min(o, p) - 0.0002, c: p}) }
  return out;
}
test('indicators sane', () => {
  assert.equal(ema([1, 1, 1], 3)[2], 1);
  assert.ok(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) > 90);
  const b = mk(120, 1.1, 0.0005, 9e5, 0);
  assert.ok(adx(b).pdi > adx(b).mdi);
});
test('uptrend -> BUY LIMIT below live, SL below, TPs above', () => {
  const b15 = mk(200, 1.10, 0.0003, 9e5), b1h = mk(200, 1.08, 0.0008, 36e5);
  const live = b15[b15.length - 1].c;
  const s = analyze({b15, b1h, live, spec, now: 1.8e12});
  assert.equal(s.dir, 'BUY');
  assert.ok(s.entry < live, 'buy limit below live');
  assert.ok(s.sl < s.entry && s.tp[0] > s.entry); assert.equal(s.tp.length, 1);
  assert.ok(['A', 'B', 'C'].includes(s.grade));
});
test('downtrend -> SELL LIMIT above live', () => {
  const b15 = mk(200, 1.20, -0.0003, 9e5), b1h = mk(200, 1.25, -0.0008, 36e5);
  const live = b15[b15.length - 1].c;
  const s = analyze({b15, b1h, live, spec});
  assert.equal(s.dir, 'SELL');
  assert.ok(s.entry > live && s.sl > s.entry && s.tp[0] < s.entry);
});
test('always a signal, even flat market', () => {
  const b15 = mk(200, 1.1, 0, 9e5), b1h = mk(200, 1.1, 0, 36e5);
  const s = analyze({b15, b1h, live: 1.1, spec});
  assert.ok(s.dir === 'BUY' ? s.entry < 1.1 : s.entry > 1.1);
});
test('impulse leg order', () => {
  const b = mk(100, 1.1, 0.0002, 9e5, 0);
  const L = impulse(b, 1, 48);
  assert.ok(L.iS <= L.iE && L.hi > L.lo);
});
test('evaluate: TP1 only — fill then TP, SL, expired, pending', () => {
  const sig = {dir: 'BUY', entry: 1.1000, sl: 1.0980, tp: [1.1020], at: 0, exp: 60};
  const bar = (t, h, l, c) => ({t: t * 60000, o: l, h, l, c: c === undefined ? h : c});
  assert.equal(evaluate(sig, [bar(5, 1.1010, 1.0999, 1.1005), bar(10, 1.1025, 1.1001)], 1e9).state, 'TP1');
  assert.equal(evaluate(sig, [bar(5, 1.1010, 1.0999, 1.1005), bar(10, 1.1005, 1.0975)], 1e9).state, 'SL');
  assert.equal(evaluate(sig, [bar(5, 1.1050, 1.1010), bar(70, 1.1050, 1.0990)], 1e9).state, 'EXPIRED');
  assert.equal(evaluate(sig, [bar(5, 1.1050, 1.1010)], 30 * 60000).state, 'PENDING');
  /* fill wali candle ka high TP se upar, par close neeche -> TP nahi maana */
  assert.equal(evaluate(sig, [bar(5, 1.1030, 1.0999, 1.1001)], 1e9).state, 'OPEN');
  const sell = {dir: 'SELL', entry: 1.1, sl: 1.102, tp: [1.098], at: 0, exp: 60};
  assert.equal(evaluate(sell, [bar(5, 1.1001, 1.099, 1.0995), bar(9, 1.099, 1.0975)], 1e9).state, 'TP1');
});

test('78.6% entry is never Grade A', () => {
  const b15 = mk(200, 1.10, 0.0003, 9e5), b1h = mk(200, 1.08, 0.0008, 36e5);
  const L = impulse(b15, 1, 48), A = atr(b15), R = L.hi - L.lo;
  const live = L.hi - R * 0.786 + 0.4 * A;
  const s = analyze({b15, b1h, live, spec});
  assert.equal(s.dir, 'BUY');
  assert.equal(s.fibX, 0.786, 'entry should be at 78.6%');
  assert.ok(s.entry < live);
  assert.notEqual(s.grade, 'A');
});

test('pip value USD for 0.01 lot', () => {
  assert.equal(+pipUsd('EUR/USD', 0.01).toFixed(4), 0.1);
  assert.ok(Math.abs(pipUsd('USD/JPY', 0.01, {'USD/JPY': 150}) - 0.0667) < 0.001);
  assert.equal(+pipUsd('XAU/USD', 0.01).toFixed(4), 0.1);
  assert.ok(Math.abs(pipUsd('GBP/JPY', 0.02, {'USD/JPY': 160}) - 0.125) < 0.001);
});

test('market shadow plan always present, SL/TP on correct side', () => {
  const b15 = mk(200, 1.10, 0.0003, 9e5), b1h = mk(200, 1.08, 0.0008, 36e5), live = b15[b15.length - 1].c;
  const s = analyze({b15, b1h, live, spec});
  assert.ok(s.mkt && typeof s.mkt.ok === 'boolean');
  assert.ok(s.mkt.sl < s.mkt.entry && s.mkt.tp > s.mkt.entry);
  assert.ok(Math.abs((s.mkt.tp - s.mkt.entry) - (s.mkt.entry - s.mkt.sl)) < 1e-4);
});
test('evaluateMarket: TP, SL, same-bar SL, open', () => {
  const m = {entry: 1.1, sl: 1.098, tp: 1.102}, bar = (t, h, l) => ({t, o: l, h, l, c: h});
  assert.equal(evaluateMarket(m, 0, 'BUY', [bar(1, 1.1025, 1.0995)]).state, 'TP1');
  assert.equal(evaluateMarket(m, 0, 'BUY', [bar(1, 1.1010, 1.0975)]).state, 'SL');
  assert.equal(evaluateMarket(m, 0, 'BUY', [bar(1, 1.1030, 1.0970)]).state, 'SL');
  assert.equal(evaluateMarket(m, 0, 'BUY', [bar(1, 1.1010, 1.0990)]).state, 'OPEN');
  assert.equal(evaluateMarket({entry: 1.1, sl: 1.102, tp: 1.098}, 0, 'SELL', [bar(1, 1.1005, 1.0975)]).state, 'TP1');
});

test('evaluateTrail: lock after +start, trails by step, SL before lock, TP cap', () => {
  const sig = {dir: 'BUY', entry: 1.1000, sl: 1.0990, tp: [1.1020], at: 0, exp: 60};
  const tr = {start: 5, lock: 2.5, step: 1};       /* pips */
  const bar = (t, h, l, c) => ({t: t * 60000, o: l, h, l, c: c === undefined ? h : c});
  /* fill, +6 pips peak, then back to +3 -> lock = 2.5 + 1 = 3.5 -> LOCK 3.5 */
  let r = evaluateTrail(sig, [bar(5, 1.1001, 1.0999, 1.1000), bar(10, 1.1006, 1.1002), bar(15, 1.1004, 1.1003)], 1e9, 0.0001, tr);
  assert.equal(r.state, 'LOCK'); assert.ok(Math.abs(r.pips - 3.5) < 1e-6);
  /* never reaches +5 -> SL */
  r = evaluateTrail(sig, [bar(5, 1.1001, 1.0999, 1.1000), bar(10, 1.1004, 1.1001), bar(15, 1.1002, 1.0985)], 1e9, 0.0001, tr);
  assert.equal(r.state, 'SL');
  /* straight to TP */
  r = evaluateTrail(sig, [bar(5, 1.1001, 1.0999, 1.1000), bar(10, 1.1025, 1.1001)], 1e9, 0.0001, tr);
  assert.equal(r.state, 'TP1');
  /* not filled -> EXPIRED passes through */
  r = evaluateTrail(sig, [bar(5, 1.1050, 1.1010), bar(70, 1.1050, 1.1010)], 1e9, 0.0001, tr);
  assert.equal(r.state, 'EXPIRED');
});

test('councilPlan: valid kept, wrong side fixed, market uses live, bad json null', () => {
  const ctx = {live: 1.1000, atr: 0.0010, d: 5};
  let p = councilPlan({final: {dir: 'BUY', order: 'LIMIT', entry: 1.0995, sl: 1.0985, tp: 1.1010, confidence: 70}, bots: [{name: 'Trend', view: 'buy', note: 'x'}]}, ctx);
  assert.equal(p.entry, 1.0995); assert.equal(p.sl, 1.0985); assert.equal(p.tp, 1.1010); assert.equal(p.fixed, false); assert.equal(p.bots[0].view, 'BUY');
  p = councilPlan({final: {dir: 'BUY', order: 'LIMIT', entry: 1.1010, sl: 1.1020, tp: 1.0990}}, ctx);   /* galat taraf + ulta SL/TP */
  assert.ok(p.fixed && p.entry < ctx.live && p.sl < p.entry && p.tp > p.entry);
  p = councilPlan({final: {dir: 'SELL', order: 'MARKET', entry: 0, sl: 1.1015, tp: 1.0985}}, ctx);
  assert.equal(p.entry, 1.1); assert.ok(p.sl > p.entry && p.tp < p.entry);
  assert.equal(councilPlan({final: {dir: 'HOLD'}}, ctx), null); assert.equal(councilPlan({}, ctx), null);
});

import {evaluatePfx} from '../src/engine.js';
test('v1.11 PERSONAL FX jaisa: fill ke baad chhota TP, SL nahi, mae (sabse bura) ginta hai', () => {
  const at = 0, m = 60000, pip = 0.0001;
  const sig = {dir: 'BUY', entry: 1.1000, at, exp: 60};
  const bars = [{t: 0, o: 1.1010, h: 1.1012, l: 1.1004, c: 1.1006}, {t: m, o: 1.1006, h: 1.1007, l: 1.0999, c: 1.1001},
    {t: 2 * m, o: 1.1001, h: 1.1002, l: 1.0980, c: 1.0985}, {t: 3 * m, o: 1.0985, h: 1.1030, l: 1.0984, c: 1.1028}];
  const r = evaluatePfx(sig, bars, 4 * m, pip, 25);
  assert.equal(r.state, 'TP'); assert.equal(r.filledAt, m); assert.equal(r.exitAt, 3 * m);
  assert.ok(Math.abs(r.mae - 20) < 1e-6);                      /* 1.1000 -> 1.0980 = 20 pip ulta gaya */
  const o = evaluatePfx(sig, bars.slice(0, 3), 3 * m, pip, 25);
  assert.equal(o.state, 'OPEN'); assert.ok(Math.abs(o.pips + 15) < 1e-6);
  const x = evaluatePfx(sig, bars.slice(0, 3), 49 * 3600e3, pip, 25);
  assert.equal(x.state, 'TIMEOUT'); assert.equal(x.done, true);
  const e2 = evaluatePfx({dir: 'SELL', entry: 1.2000, at: 0, exp: 60}, bars, 2 * 3600e3, pip, 25);
  assert.equal(e2.state, 'EXPIRED');
});

test('v1.11.1 PENDING kabhi done nahi — fillBy ke turant baad PENDING, phir EXPIRED', () => {
  const m = 60000, sig = {dir: 'BUY', entry: 1.0, at: 0, exp: 60, sl: 0.99, tp: [1.01]};
  const bars = [{t: 0, o: 1.01, h: 1.02, l: 1.005, c: 1.01}];
  const a = evaluate(sig, bars, 65 * m, 0.0001);
  assert.equal(a.state, 'PENDING'); assert.equal(a.done, false);
  const b = evaluate(sig, bars, 75 * m, 0.0001);
  assert.equal(b.state, 'EXPIRED'); assert.equal(b.done, true);
  assert.equal(evaluatePfx(sig, bars, 65 * m, 0.0001, 25).done, false);
});

test('v1.13 PERSONAL FX jaisa + SL: $1.50 SL pehle aaya to SL (REAL Strategy 3)', () => {
  const m = 60000, pip = 0.0001, sig = {dir: 'BUY', entry: 1.1000, at: 0, exp: 60};
  const bars = [{t: 0, o: 1.1010, h: 1.1012, l: 1.1004, c: 1.1006}, {t: m, o: 1.1006, h: 1.1007, l: 1.0999, c: 1.1001},
    {t: 2 * m, o: 1.1001, h: 1.1002, l: 1.0980, c: 1.0985}, {t: 3 * m, o: 1.0985, h: 1.1030, l: 1.0984, c: 1.1028}];
  const s = evaluatePfx(sig, bars, 4 * m, pip, 2.5, 15);          /* SL 15 pip: 20 pip ulta -> SL */
  assert.equal(s.state, 'SL'); assert.equal(s.exitAt, 2 * m); assert.equal(s.pips, -15);
  const t = evaluatePfx(sig, bars, 4 * m, pip, 25, 25);           /* SL 25 pip: 20 pip ulta tak theek, phir TP */
  assert.equal(t.state, 'TP');
  assert.equal(evaluatePfx(sig, bars, 4 * m, pip, 25).state, 'TP'); /* SL 0 = purana tarika */
});
