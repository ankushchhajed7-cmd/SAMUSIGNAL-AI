import test from 'node:test';
import assert from 'node:assert/strict';
import {toH4, adxSeries, effRatio, strength, newsBlock, parseCurBias, aiPoints, session, learnAdj, score, evalTrade, stats, canOpen, closedOnly, M15, H1} from '../src/sentinelrules.js';

/* chhota pakka random (har baar same) */
function rng(seed){ let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
/* drift = har candle ka jhukaav, noise = hilna */
function bars(n, tf, start, drift, noise, seed = 7, t0 = Date.UTC(2026, 10, 24, 0, 0)){
  const r = rng(seed), out = []; let p = start;
  for(let i = 0; i < n; i++){
    const o = p, c = o + drift + (r() - 0.5) * noise, h = Math.max(o, c) + r() * noise * 0.4, l = Math.min(o, c) - r() * noise * 0.4;
    out.push({t: t0 + i * tf, o, h, l, c}); p = c;
  }
  return out;
}
const NOW = Date.UTC(2026, 10, 25, 9, 0, 30);   /* Budhvar, London session */

test('toH4 1H ko 4 ghante me jodta hai', () => {
  const b = bars(12, H1, 1.1, 0.0001, 0.0002);
  const h4 = toH4(b);
  assert.equal(h4.length, 3);
  assert.equal(h4[0].o, b[0].o); assert.equal(h4[0].c, b[3].c);
  assert.equal(h4[0].h, Math.max(...b.slice(0, 4).map(x => x.h)));
});

test('effRatio: seedhi line 1, chop kam', () => {
  const line = Array.from({length: 30}, (_, i) => 1 + i * 0.001);
  assert.ok(effRatio(line, 20) > 0.99);
  const chop = Array.from({length: 30}, (_, i) => 1 + (i % 2 ? 0.001 : -0.001));
  assert.ok(effRatio(chop, 20) < 0.1);
});

test('adxSeries: trend me ADX upar aur +DI aage', () => {
  const b = bars(200, H1, 1.1, 0.0006, 0.0006);
  const a = adxSeries(b);
  const L = b.length - 1;
  assert.ok(a.adx[L] > 20, 'adx ' + a.adx[L]);
  assert.ok(a.pdi[L] > a.mdi[L]);
});

test('strength: EUR upar, JPY neeche', () => {
  const all = {
    EURUSD: bars(80, H1, 1.1, 0.0005, 0.0004, 3), GBPUSD: bars(80, H1, 1.3, 0.0001, 0.0004, 4),
    USDJPY: bars(80, H1, 150, 0.06, 0.05, 5), AUDUSD: bars(80, H1, 0.66, 0, 0.0004, 6),
    USDCHF: bars(80, H1, 0.88, 0, 0.0004, 8), USDCAD: bars(80, H1, 1.38, 0, 0.0004, 9), NZDUSD: bars(80, H1, 0.58, 0, 0.0004, 10),
    EURJPY: bars(80, H1, 165, 0.12, 0.05, 11)
  };
  const s = strength(all);
  assert.ok(s.ok);
  assert.equal(s.rank.EUR, 1);
  assert.equal(s.rank.JPY, 8);
});

test('newsBlock: currency ki High news ±30 min', () => {
  const ev = [{t: NOW + 20 * 60e3, cur: 'EUR', imp: 'High', title: 'ECB'}, {t: NOW + 10 * 60e3, cur: 'JPY', imp: 'Medium', title: 'x'}];
  assert.ok(newsBlock('EUR/USD', ev, NOW));
  assert.equal(newsBlock('USD/JPY', ev, NOW), null);
  assert.equal(newsBlock('EUR/USD', ev, NOW - 60 * 60e3), null);
  assert.ok(newsBlock('XAU/USD', [{t: NOW, cur: 'USD', imp: 'High', title: 'NFP'}], NOW));
});

test('parseCurBias + aiPoints', () => {
  const t = 'USD: WEAK\nEUR: STRONG\nGBP: NEUTRAL\nJPY: neutral\nCHF: STRONG\nAUD: WEAK\nCAD: NEUTRAL\nNZD: NEUTRAL\nXAU: UP\nSAAR: Fed dovish, EUR data accha.';
  const b = parseCurBias(t);
  assert.equal(b.USD, 'WEAK'); assert.equal(b.EUR, 'STRONG'); assert.equal(b.XAU, 'UP');
  assert.match(b.sum, /Fed/);
  assert.equal(aiPoints('EUR/USD', 'BUY', b).pts, 10);
  assert.equal(aiPoints('EUR/USD', 'SELL', b).pts, -15);
  assert.equal(aiPoints('GBP/USD', 'BUY', b).pts, 5);
  assert.equal(aiPoints('XAU/USD', 'BUY', b).pts, 10);
  assert.equal(parseCurBias('kuch nahi'), null);
});

test('session: London ok, weekend / raat band', () => {
  assert.ok(session(NOW).ok);
  assert.equal(session(Date.UTC(2026, 10, 28, 10)).ok, false);   /* Shanivar */
  assert.equal(session(Date.UTC(2026, 10, 25, 2)).ok, false);
});

test('learnAdj: kharab pair ka score ghate', () => {
  const h = Array.from({length: 10}, (_, i) => ({sym: 'EUR/USD', res: i < 3 ? 'TP' : 'SL', r: i < 3 ? 1.8 : -1}));
  assert.equal(learnAdj(h, 'EUR/USD').pts, -10);
  assert.equal(learnAdj(h.slice(0, 5), 'EUR/USD').pts, 0);
});

test('score: saaf uptrend = BUY LIMIT, entry neeche, SL neeche, TP = 1.8R', () => {
  const b1h = bars(250, H1, 1.05, 0.0004, 0.0005, 21, NOW - 250 * H1 - 30e3);
  const last = b1h[b1h.length - 1].c;
  const b15 = bars(200, M15, last - 200 * 0.0001, 0.0001, 0.0003, 22, NOW - 200 * M15 - 30e3);
  const live = b15[b15.length - 1].c;
  const s = score({sym: 'EUR/USD', b15, b1h, live, spread: 0.00012, cs: null, events: [], now: NOW});
  assert.equal(s.dir, 'BUY');
  assert.equal(s.order.type, 'BUY LIMIT');
  assert.ok(s.order.entry < live);
  assert.ok(s.order.sl < s.order.entry);
  assert.ok(Math.abs((s.order.tp - s.order.entry) / (s.order.entry - s.order.sl) - 1.8) < 1e-9);
  assert.ok(s.score > 30, 'score ' + s.score);
  assert.ok(s.why.length >= 3);
});

test('score: chop me koi trade nahi', () => {
  const r = rng(5), mk = (n, tf, t0) => Array.from({length: n}, (_, i) => { const c = 1.1 + (i % 4 < 2 ? 0.0006 : -0.0006) + (r() - 0.5) * 0.0002; return {t: t0 + i * tf, o: c - 0.0001, h: c + 0.0004, l: c - 0.0004, c} });
  const s = score({sym: 'EUR/USD', b15: mk(200, M15, NOW - 200 * M15), b1h: mk(250, H1, NOW - 250 * H1), live: 1.1, spread: 0, cs: null, events: [], now: NOW});
  assert.ok(!s.ok);
  assert.ok(s.blocks.length > 0);
});

test('score: high news ho to rok', () => {
  const b1h = bars(250, H1, 1.05, 0.0004, 0.0005, 21, NOW - 250 * H1 - 30e3);
  const b15 = bars(200, M15, b1h[249].c - 0.02, 0.0001, 0.0003, 22, NOW - 200 * M15 - 30e3);
  const s = score({sym: 'EUR/USD', b15, b1h, live: b15[199].c, cs: null, events: [{t: NOW + 10 * 60e3, cur: 'USD', imp: 'High', title: 'CPI'}], now: NOW, cfg: {minScore: 0}});
  assert.ok(s.blocks.some(x => /High news/.test(x)));
  assert.equal(s.ok, false);
});

test('evalTrade: fill -> TP, fill -> SL, dono ek candle = SL, EXPIRED', () => {
  const t0 = Date.UTC(2026, 10, 25, 9, 0);
  const tr = {dir: 'BUY', entry: 1.1000, sl: 1.0990, tp: 1.1018, at: t0, spread: 0, expiryMin: 60};
  const B = (i, o, h, l, c) => ({t: t0 + i * M15, o, h, l, c});
  assert.equal(evalTrade(tr, [B(0, 1.1005, 1.1006, 1.0999, 1.1003), B(1, 1.1003, 1.1020, 1.1001, 1.1019)], t0 + 3 * M15).res, 'TP');
  assert.equal(evalTrade(tr, [B(0, 1.1005, 1.1006, 1.0999, 1.1003), B(1, 1.1003, 1.1004, 1.0985, 1.0988)], t0 + 3 * M15).res, 'SL');
  assert.equal(evalTrade(tr, [B(0, 1.1005, 1.1006, 1.0999, 1.1003), B(1, 1.1003, 1.1025, 1.0985, 1.1000)], t0 + 3 * M15).res, 'SL');
  assert.equal(evalTrade(tr, [B(0, 1.1010, 1.1012, 1.1005, 1.1008)], t0 + 2 * H1).state, 'EXPIRED');
  assert.equal(evalTrade(tr, [B(0, 1.1010, 1.1012, 1.1005, 1.1008)], t0 + 20 * 60e3).state, 'PENDING');
  const o = evalTrade(tr, [B(0, 1.1005, 1.1006, 1.0999, 1.1003), B(1, 1.1003, 1.1008, 1.1001, 1.1005)], t0 + 2 * M15);
  assert.equal(o.state, 'OPEN'); assert.equal(o.r, 0.5);
  /* SELL + spread: TP ask par */
  const ts = {dir: 'SELL', entry: 1.1000, sl: 1.1010, tp: 1.0982, at: t0, spread: 0.0001, expiryMin: 60};
  assert.equal(evalTrade(ts, [B(0, 1.0995, 1.1001, 1.0994, 1.0998), B(1, 1.0998, 1.0999, 1.0982, 1.0985)], t0 + 3 * M15).state, 'OPEN');
  assert.equal(evalTrade(ts, [B(0, 1.0995, 1.1001, 1.0994, 1.0998), B(1, 1.0998, 1.0999, 1.0980, 1.0985)], t0 + 3 * M15).res, 'TP');
});

test('stats + canOpen', () => {
  const L = [{res: 'TP', r: 1.8, usd: 1.8}, {res: 'SL', r: -1, usd: -1}, {res: 'EXPIRED', r: 0}];
  const s = stats(L);
  assert.equal(s.n, 2); assert.equal(s.pct, 50); assert.equal(s.usd, 0.8);
  const tr = [{sym: 'EUR/USD', state: 'OPEN'}, {sym: 'GBP/USD', state: 'PENDING'}];
  assert.match(canOpen({sym: 'EUR/USD'}, tr, {}, NOW, 0), /पहले से/);
  assert.equal(canOpen({sym: 'USD/JPY'}, tr, {}, NOW, 0), '');
  assert.match(canOpen({sym: 'USD/JPY'}, tr, {maxOpen: 2}, NOW, 0), /सीमा/);
  assert.match(canOpen({sym: 'USD/JPY'}, tr, {}, NOW, -5), /loss limit/);
  assert.match(canOpen({sym: 'AUD/USD'}, [{sym: 'AUD/USD', res: 'SL', state: 'SL', exitAt: NOW - 30 * 60e3}], {}, NOW, 0), /आराम/);
});

test('closedOnly bann rahi candle hatata hai', () => {
  const b = [{t: NOW - 2 * M15}, {t: NOW - M15}, {t: NOW - 60e3}];
  assert.equal(closedOnly(b, M15, NOW).length, 2);
});

test('v1.1: newTrade + applyEval + dayReport', async () => {
  const {newTrade, applyEval, dayReport, dayKeyIST, todayUsd} = await import('../src/sentinelrules.js');
  const now = Date.UTC(2026, 10, 25, 9, 0);
  const r = {sym: 'EUR/USD', dir: 'BUY', score: 80, why: ['a'], parts: [], order: {type: 'BUY LIMIT', entry: 1.1, sl: 1.099, tp: 1.1018, rr: 1.8, dist: 0.001, spread: 0}};
  const t = newTrade(r, {}, now, 1, '', 'vps');
  assert.equal(t.state, 'PENDING'); assert.equal(t.src, 'vps'); assert.equal(t.reward, 1.8);
  assert.equal(applyEval(t, {state: 'OPEN', fillAt: now, cur: 1.1005, r: 0.5}, now), 'PENDING');
  assert.equal(t.usd, 0.5);
  assert.equal(applyEval(t, {state: 'TP', done: true, exit: 1.1018, fillAt: now, exitAt: now + 3600e3, r: 1.8}, now), 'OPEN');
  assert.equal(applyEval(t, {state: 'TP', done: true, r: 1.8}, now), null);
  const day = dayKeyIST(now);
  const rep = dayReport([t, {sym: 'GBP/USD', dir: 'SELL', state: 'SL', res: 'SL', done: true, at: now, exitAt: now + 60e3, r: -1, usd: -1}], day);
  assert.equal(rep.n, 2); assert.equal(rep.pct, 50); assert.equal(rep.usd, 0.8); assert.equal(rep.byPair.EURUSD.win, 1);
  assert.equal(todayUsd([t], now + 3600e3), 1.8);
});

test('v1.1: runScan sab 8 pair lautata hai', async () => {
  const {runScan, SEN_PAIRS} = await import('../src/sentinelrules.js');
  const mk = (n, tf, d) => { const t0 = NOW - n * tf - 30e3; return {bars: bars(n, tf, 1.1, d, 0.0004, 3, t0), live: 1.1} };
  const A15 = {EURUSD: mk(200, M15, 0.0001)}, A1 = {EURUSD: mk(250, H1, 0.0004)};
  const {list} = runScan({A15, A1, now: NOW});
  assert.equal(list.length, SEN_PAIRS.length);
  assert.ok(list.find(x => x.sym === 'GBP/USD').blocks[0].includes('Feed'));
});
