import test from 'node:test';
import assert from 'node:assert/strict';
import {newPaper, tick, feedBar, snapshot, paperStats, CFG} from '../src/s6paper.js';

const mk = (dir = 1) => newPaper({id: 'p', sym: 'XAU/USD', dir, at: 0, bid: 4000, k: 1, sp: 0.2, d: 2});
const walk = (P, prices) => { let t = 1; for(const p of prices) tick(P, t++ * 1000, p) };
const path = (a, b, st = 0.1) => { const o = []; const n = Math.round(Math.abs(b - a) / st); for(let i = 1; i <= n; i++) o.push(+(a + (b - a) * i / n).toFixed(3)); return o };

test('seedha upar: main TP $2', () => {
  const P = mk(); walk(P, path(4000, 4003));
  assert.equal(P.done, true); assert.match(P.res, /^(TP|NET)/); assert.ok(P.pl >= 2 && P.pl < 2.2); assert.equal(P.used, 0);
});
test('neeche: hedge har $3 par, ek jagah do nahi, cycle $2 par band', () => {
  const P = mk(); walk(P, path(4000, 3980));
  assert.equal(P.done, true); assert.match(P.res, /NET|BASKET/); assert.ok(P.pl >= 2);
  const opens = P.ev.filter(e => /hedge/.test(e.m)).map(e => +e.m.match(/SELL (\d+\.\d+)/)[1]);
  assert.deepEqual(opens.slice(0, 3), [3997.2, 3994.2, 3991.2]);   // main BUY ask 4000.2 se har $3
  assert.equal(new Set(opens).size, opens.length);
});
test('lock: +$2 ke baad +$1 par sabse neeche wala band, phir usi bhaav par dobara', () => {
  const P = mk(); walk(P, [...path(4000, 3994.5), ...path(3994.5, 3996.1)]);
  assert.ok(P.ev.some(e => /lock chalu #1/.test(e.m)), 'lock chalu');
  assert.ok(P.ev.some(e => /lock band #1/.test(e.m)), 'lock band');
  assert.equal(P.locks, 1); assert.ok(P.banked > 0.9 && P.banked < 1.1);
  walk(P, path(3996.1, 3994.8));
  assert.ok(P.ev.filter(e => /hedge #1/.test(e.m)).length >= 2, 'wahi level dobara');
});
test('upar wala ghate me ho to uske upar naya hedge nahi (F)', () => {
  const P = mk(); walk(P, path(4000, 3993.9));                 // #1 3997, #2 3994
  walk(P, path(3993.9, 3996.5));                               // upar laute: #2 ghate me
  const before = P.used; walk(P, path(3996.5, 3996.9));
  assert.equal(P.used, before);
});
test('doosra BUY main ke bhaav par (hedge ke baad), ek hi baar', () => {
  const P = mk(); walk(P, [...path(4000, 3996.5), ...path(3996.5, 4000.5)]);
  assert.ok(P.b2 || P.done);
  assert.equal(P.ev.filter(e => /doosra/.test(e.m)).length <= 1, true);
});
test('SELL main ulta: BUY hedge upar har $3, cycle $2', () => {
  const P = mk(-1); walk(P, path(4000, 4020));
  assert.equal(P.done, true); assert.ok(P.pl >= 2);
  const opens = P.ev.filter(e => /hedge/.test(e.m)).map(e => +e.m.match(/BUY (\d+\.\d+)/)[1]);
  assert.deepEqual(opens.slice(0, 2), [4003, 4006]);
});
test('chop me basket SL -$60 tak', () => {
  const P = mk(); let pr = 4000, t = 1;
  for(let r = 0; r < 400 && !P.done; r++){ for(const x of path(pr, pr - 2.6)) tick(P, t++, x); pr -= 2.6; for(const x of path(pr, pr + 2.0)) tick(P, t++, x); pr += 2.0 }
  assert.equal(P.done, true); assert.ok(P.minTot <= 0);
});
test('feedBar + snapshot + stats', () => {
  const P = mk(); feedBar(P, {t: 60000, o: 4000, h: 4000.5, l: 3996, c: 3996.5});
  const s = snapshot(P, 3996.5); assert.equal(s.hedges.length, 1); assert.ok(s.total < 0);
  const st = paperStats([P, {done: true, pl: 2, res: 'NET +$2', minTot: -5, at: 0, endT: 600000}]);
  assert.equal(st.n, 1); assert.equal(st.open, 1); assert.equal(st.w, 1);
});
