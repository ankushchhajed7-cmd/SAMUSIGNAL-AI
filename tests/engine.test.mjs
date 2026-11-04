import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze, evaluate, ema, rsi, adx, impulse, atr} from '../src/engine.js';
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
