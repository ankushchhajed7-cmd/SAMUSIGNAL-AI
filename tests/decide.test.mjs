import test from 'node:test';
import assert from 'node:assert/strict';
import {effRatio, tfSummary, parseVote, parseJudge, outcome, stats, session} from '../src/deciderules.js';

const bars = (n, f) => Array.from({length: n}, (_, i) => { const c = f(i); return {t: i * 60e3, o: c - 0.1, h: c + 0.3, l: c - 0.3, c} });
test('effRatio: seedhi chaal 1, chop kam', () => {
  assert.equal(effRatio(Array.from({length: 30}, (_, i) => i)), 1);
  assert.ok(effRatio(Array.from({length: 30}, (_, i) => i % 2)) < 0.1);
});
test('tfSummary: upar ki chaal = BUY bias, ATR $ me', () => {
  const t = tfSummary(bars(120, i => 3600 + i * 0.5), 1);
  assert.equal(t.bias, 'BUY'); assert.ok(t.atrUsd > 0); assert.ok(t.rangePos > 80);
});
test('parseVote / parseJudge: seema aur default', () => {
  assert.deepEqual(parseVote({vote: 'sell', conf: 120, why: 'x'}).vote, 'SELL');
  assert.equal(parseVote({vote: 'BUY', conf: 10}).conf, 50);
  const j = parseJudge({verdict: 'BUY', prob: 99, waitBetter: 'true'});
  assert.equal(j.prob, 85); assert.equal(j.wait, true);
  assert.equal(parseJudge({}).verdict, 'BUY');
});
test('outcome: pehle +$1 = W, pehle -$1 = L, ek candle me dono = L, 60 min me kuch nahi = 0', () => {
  const at = 10 * 60e3, h = {at, px: 100, dir: 'BUY', usdU: 1};
  const up = Array.from({length: 70}, (_, i) => ({t: i * 60e3, o: 100, h: i > 12 ? 101.2 : 100.3, l: 99.7, c: 100}));
  assert.equal(outcome(h, up, 1), 'W');
  const dn = up.map(b => ({...b, h: 100.3, l: b.t > 12 * 60e3 ? 98.8 : 99.7}));
  assert.equal(outcome(h, dn, 1), 'L');
  const both = up.map(b => ({...b, h: 101.5, l: 98.5}));
  assert.equal(outcome(h, both, 1), 'L');
  const flat = Array.from({length: 80}, (_, i) => ({t: i * 60e3, o: 100, h: 100.4, l: 99.6, c: 100}));
  assert.equal(outcome(h, flat, 1), '0');
  assert.equal(outcome({...h, dir: 'SELL'}, dn, 1), 'W');
  assert.equal(outcome(h, flat.slice(0, 30), 1), null);
});
test('stats + session', () => {
  const s = stats([{r1: 'W'}, {r1: 'L'}, {r1: 'W'}, {r1: null}], 'r1');
  assert.deepEqual(s, {n: 3, w: 2, pct: 67});
  assert.equal(session(Date.UTC(2026, 10, 27, 13)), 'London + New York (sabse tez)');
});
