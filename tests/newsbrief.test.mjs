import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBrief, judge, ledger, councilLedger} from '../src/newsbrief.js';

const TXT = `XAUUSD: UP
EURUSD: DOWN
SAAR: Fed ke narm bayan se dollar kamzor. Gold ko sahara.
KHABAR:
- Fed official: rate cut ki gunjaish
- US jobless claims badhe`;
test('parseBrief format', () => {
  const b = parseBrief(TXT);
  assert.equal(b.xau, 'UP'); assert.equal(b.eur, 'DOWN');
  assert.match(b.sum, /Fed ke narm/); assert.equal(b.heads.length, 2);
});
test('parseBrief galat text -> null, NEUTRAL default', () => {
  assert.equal(parseBrief('kuch bhi'), null);
  assert.equal(parseBrief('XAUUSD: pata nahi\nEURUSD: NEUTRAL').xau, 'NEUTRAL');
});
test('judge WIN / LOSS / FLAT / NEUTRAL', () => {
  assert.equal(judge('UP', 2000, 2005, 'XAU/USD'), 'WIN');
  assert.equal(judge('DOWN', 2000, 2005, 'XAU/USD'), 'LOSS');
  assert.equal(judge('UP', 2000, 2000.5, 'XAU/USD'), 'FLAT');          /* $1 se kam */
  assert.equal(judge('DOWN', 1.1000, 1.0990, 'EUR/USD'), 'WIN');
  assert.equal(judge('UP', 1.1000, 1.1002, 'EUR/USD'), 'FLAT');        /* 3 pip se kam */
  assert.equal(judge('NEUTRAL', 2000, 2010, 'XAU/USD'), null);
  assert.equal(judge('UP', 0, 2010, 'XAU/USD'), null);
});
test('ledger sirf poore hue (p1) ginta hai', () => {
  const L = ledger([
    {xau: 'UP', eur: 'DOWN', p0: {'XAU/USD': 2000, 'EUR/USD': 1.1}, p1: {'XAU/USD': 2005, 'EUR/USD': 1.101}},
    {xau: 'UP', eur: 'UP', p0: {'XAU/USD': 2000, 'EUR/USD': 1.1}, p1: null},
    {xau: 'DOWN', eur: 'NEUTRAL', p0: {'XAU/USD': 2000}, p1: {}}
  ]);
  assert.equal(L['XAU/USD'].win, 1); assert.equal(L['EUR/USD'].loss, 1);
  assert.equal(L['XAU/USD'].n, 1); assert.equal(L['XAU/USD'].pct, 100); assert.equal(L['EUR/USD'].pct, 0);
});
test('councilLedger purane Gemini ka hisaab', () => {
  const c = councilLedger({a: {usd: 5, win: true}, b: {usd: -3, win: false}, c: {usd: 2, win: true}, d: {}});
  assert.equal(c.n, 3); assert.equal(c.win, 2); assert.equal(c.pct, 67); assert.equal(c.usd, 4);
  assert.equal(councilLedger({}).pct, null);
});
