import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNum, parseActual, polarity, rules, evaluate, grade, summary} from '../src/newsrules.js';

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
