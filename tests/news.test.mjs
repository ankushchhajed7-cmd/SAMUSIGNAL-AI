import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNum, parseActual, polarity, rules, evaluate, grade, summary, tradeable, speechy} from '../src/newsrules.js';

test('parseNum units', () => {
  assert.equal(parseNum('0.3%'), 0.3);
  assert.equal(parseNum('227K'), 227000);
  assert.equal(parseNum('-0.4%'), -0.4);
  assert.equal(parseNum('1.2M'), 1200000);
  assert.equal(parseNum('4,200'), 4200);
  assert.ok(isNaN(parseNum('')));
  assert.ok(isNaN(parseNum('abc')));
  assert.ok(isNaN(parseNum(undefined)));
});
test('parseActual forecast ki unit laga deta hai', () => {
  assert.equal(parseActual('227', '200K'), 227000);
  assert.equal(parseActual('227K', '200K'), 227000);
  assert.equal(parseActual('0.4', '0.3%'), 0.4);
});
test('polarity', () => {
  assert.equal(polarity('Average Hourly Earnings m/m'), 1);
  assert.equal(polarity('Non-Farm Employment Change'), 1);
  assert.equal(polarity('Unemployment Rate'), -1);
  assert.equal(polarity('Unemployment Claims'), -1);
  assert.equal(polarity('FOMC Member Williams Speaks'), 0);
  assert.equal(polarity('FOMC Statement'), 0);
  assert.equal(polarity('Something Unknown'), 0);
});
test('AHE 0.4 vs 0.3 -> USD mazboot -> XAUUSD SELL + EURUSD SELL (video wala case)', () => {
  const r = evaluate({title: 'Average Hourly Earnings m/m', forecast: '0.3%', previous: '0.1%'}, '0.4');
  assert.equal(r.ok, true); assert.equal(r.usd, 1);
  assert.deepEqual(r.sigs.map(s => s.dir), ['SELL', 'SELL']);
});
test('Unemployment 4.1 vs 4.2 forecast -> USD mazboot -> SELL', () => {
  const r = evaluate({title: 'Unemployment Rate', forecast: '4.2%', previous: '4.2%'}, '4.1');
  assert.equal(r.usd, 1); assert.equal(r.sigs[0].dir, 'SELL');
});
test('Unemployment 4.4 vs 4.2 -> USD kamzor -> BUY', () => {
  const r = evaluate({title: 'Unemployment Rate', forecast: '4.2%', previous: '4.2%'}, '4.4');
  assert.equal(r.usd, -1); assert.deepEqual(r.sigs.map(s => s.dir), ['BUY', 'BUY']);
});
test('NFP 150 vs 200K -> BUY', () => {
  const r = evaluate({title: 'Non-Farm Employment Change', forecast: '200K', previous: '254K'}, '150');
  assert.equal(r.sigs[0].dir, 'BUY');
});
test('forecast ke barabar -> NO TRADE; speech -> rule nahi; kharab number -> error', () => {
  assert.equal(evaluate({title: 'CPI m/m', forecast: '0.3%', previous: '0.2%'}, '0.3').sigs[0].dir, 'NO TRADE');
  assert.equal(evaluate({title: 'FOMC Member Speaks', forecast: '', previous: ''}, '1').ok, false);
  assert.equal(evaluate({title: 'CPI m/m', forecast: '0.3%', previous: '0.2%'}, 'xx').ok, false);
  assert.equal(evaluate({title: 'CPI m/m', forecast: '', previous: '0.2%'}, '0.4').ok, false);
});
test('confidence bada surprise = zyada, cap 65', () => {
  const small = evaluate({title: 'Unemployment Rate', forecast: '4.2%', previous: '4.2%'}, '4.1').conf;
  const big = evaluate({title: 'Average Hourly Earnings m/m', forecast: '0.3%', previous: '0.1%'}, '0.4').conf;
  assert.ok(big > small); assert.ok(small >= 50 && big <= 65);
});
test('rules card', () => {
  const r = rules('Unemployment Rate');
  assert.equal(r[0].higher, 'BUY'); assert.equal(r[0].lower, 'SELL');
  assert.equal(rules('CPI m/m')[1].higher, 'SELL');
  assert.equal(rules('FOMC Member Speaks'), null);
});
test('grade pips / WIN / LOSS / FLAT', () => {
  assert.deepEqual(grade('XAU/USD', 'SELL', 4061.6, 4039.8), {pips: 218, res: 'WIN'});
  assert.equal(grade('XAU/USD', 'SELL', 4040, 4045).res, 'LOSS');
  assert.equal(grade('XAU/USD', 'SELL', 4040, 4040.5).res, 'FLAT');
  assert.equal(grade('EUR/USD', 'BUY', 1.1, 1.1010).res, 'WIN');
  assert.equal(grade('EUR/USD', 'BUY', NaN, 1.1), null);
});
test('summary TEST ko nahi ginta', () => {
  const s = summary([{test: true, sigs: [{res: 'WIN'}]}, {sigs: [{res: 'WIN'}, {res: 'LOSS'}]}, {sigs: [{res: 'FLAT'}, {res: null}]}]);
  assert.deepEqual(s, {win: 1, loss: 1, flat: 1, n: 3, rate: 50});
});

test('v1.1 MT5 naam: Nonfarm Payrolls / Initial Jobless Claims / Core CPI', () => {
  assert.equal(polarity('Nonfarm Payrolls'), 1);
  assert.equal(polarity('Initial Jobless Claims'), -1);
  assert.equal(polarity('Core CPI m/m'), 1);
  assert.equal(polarity('Fed Chair Powell Testimony'), 0);
});
test('v1.1 tradeable: hamara rule ya MT5 indicator (speech kabhi nahi)', () => {
  assert.equal(tradeable({title: 'CPI m/m'}), true);
  assert.equal(tradeable({title: 'Philadelphia Fed Manufacturing Index', kind: 'ind'}), true);
  assert.equal(tradeable({title: 'Philadelphia Fed Manufacturing Index'}), false);
  assert.equal(tradeable({title: 'Fed Chair Powell Speech', kind: 'event'}), false);
  assert.equal(tradeable({title: 'FOMC Member Speaks', kind: 'ind'}), false);
  assert.equal(speechy('FOMC Minutes'), true);
});
test('v1.1 MT5 andaza (mi) — rule na ho to MT5 ki disha', () => {
  const ev = {title: 'Philadelphia Fed Manufacturing Index', kind: 'ind', forecast: '5.0', previous: '2.0'};
  const up = evaluate(ev, '12.0', {mi: 1});
  assert.equal(up.ok, true); assert.equal(up.usd, 1); assert.equal(up.mtOnly, true);
  assert.deepEqual(up.sigs.map(s => s.dir), ['SELL', 'SELL']);
  const dn = evaluate(ev, '1.0', {mi: -1});
  assert.equal(dn.usd, -1); assert.deepEqual(dn.sigs.map(s => s.dir), ['BUY', 'BUY']);
  assert.equal(evaluate(ev, '12.0', {}).ok, false);                                    /* MT5 andaza nahi -> trade nahi */
  assert.equal(evaluate({title: 'Fed Chair Powell Speech', kind: 'ind', forecast: '1'}, '2', {mi: 1}).ok, false);
});
test('v1.1 hamara rule MT5 andaze se upar (CPI zyada = SELL, chahe mi kuch bhi)', () => {
  const r = evaluate({title: 'CPI m/m', kind: 'ind', forecast: '0.3%', previous: '0.2%'}, '0.5%', {mi: -1});
  assert.deepEqual(r.sigs.map(s => s.dir), ['SELL', 'SELL']); assert.equal(r.mtOnly, false);
});

import {usdOf, tpPrice, scanTp, takeSummary, DEF_TGT} from '../src/newsrules.js';
test('v1.2 auto trade $: gold 0.01 lot $1 chaal = $1, EURUSD 10 pip = $1', () => {
  assert.equal(usdOf('XAU/USD', 'SELL', 4039.10, 4029.10, 0.01), 10);
  assert.equal(usdOf('XAU/USD', 'SELL', 4039.10, 4045.10, 0.01), -6);
  assert.equal(usdOf('EUR/USD', 'BUY', 1.1500, 1.1510, 0.01), 1);
  assert.equal(usdOf('EUR/USD', 'BUY', 1.15, NaN, 0.01), null);
});
test('v1.2 target bhaav (video wala case: SELL 4039.10 -> $10 = 4029.10)', () => {
  assert.ok(Math.abs(tpPrice('XAU/USD', 'SELL', 4039.10, 0.01, 10) - 4029.10) < 1e-9);
  assert.ok(Math.abs(tpPrice('EUR/USD', 'BUY', 1.1500, 0.01, 3) - 1.1530) < 1e-9);
  assert.equal(DEF_TGT['XAU/USD'], 10); assert.equal(DEF_TGT['EUR/USD'], 3);
});
test('v1.2 scanTp: SELL low ne chhua to pehla samay, BUY high', () => {
  const pts = [{t: 1, h: 4040, l: 4035}, {t: 2, h: 4036, l: 4029}, {t: 3, h: 4031, l: 4020}];
  assert.equal(scanTp('SELL', 4029.10, pts), 2);
  assert.equal(scanTp('BUY', 4039, pts), 1);
  assert.equal(scanTp('SELL', 4000, pts), null);
});
test('v1.2 takeSummary: 1m / target / 5m alag, TEST ginti me nahi', () => {
  const L = [{sigs: [{take: {u1: 2, uT: 10, u5: -3, hit: 40, delay: 3}}, {take: {u1: -1, uT: -2, u5: 1, delay: 5}}]}, {test: true, sigs: [{take: {u1: 99}}]}];
  const m = takeSummary(L);
  assert.equal(m.n, 2); assert.equal(m.m1.usd, 1); assert.equal(m.m1.rate, 50); assert.equal(m.tgt.usd, 8); assert.equal(m.hits, 1); assert.equal(m.delay, 4);
});
