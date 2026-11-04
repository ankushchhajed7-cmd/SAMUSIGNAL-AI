import test from 'node:test';
import assert from 'node:assert/strict';
import {windowStats, bookStats, decide, whaleCut} from '../src/flow.js';
const now = 1e9;
const mk = (n, buyFrac, usd = 1000) => Array.from({length: n}, (_, i) => ({t: now - (n - i) * 500, p: 100, q: usd / 100, usd, buy: i % 100 < buyFrac * 100}));
test('window stats share + delta', () => {
  const w = windowStats(mk(100, 0.7), now, 60e3);
  assert.ok(w.share > 0.65 && w.share < 0.75); assert.ok(w.delta > 0.3);
});
test('book imbalance + walls', () => {
  const b = bookStats([[99.9, 50], [99.8, 10]], [[100.1, 5], [100.2, 30]], 100);
  assert.ok(b.imb > 0); assert.equal(b.askWall.p, 100.2); assert.equal(b.bidWall.p, 99.9);
});
test('strong buying -> BUY, balanced -> WAIT, selling -> SELL', () => {
  const book = {imb: 0.3};
  assert.equal(decide(mk(1200, 0.85), book, now).decision, 'BUY');
  assert.equal(decide(mk(1200, 0.5), {imb: 0}, now).decision, 'WAIT');
  assert.equal(decide(mk(1200, 0.15), {imb: -0.3}, now).decision, 'SELL');
});
test('whale cut at least 10K', () => { assert.ok(whaleCut(mk(500, 0.5, 200), now) >= 10000) });
