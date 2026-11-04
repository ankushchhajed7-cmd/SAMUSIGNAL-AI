/* SAMUSIGNAL AI — analysis engine (pure functions, koi network nahi)
   Forex AI jaisa tareeka: trend ki disha -> aakhri impulse leg -> Fib golden zone (50–61.8%) pe LIMIT.
   HAMESHA ek signal (NO TRADE nahi): sirf BUY LIMIT / SELL LIMIT, entry hamesha live ke sahi taraf
   (BUY LIMIT neeche, SELL LIMIT upar), zone ka wo kinara jo TP1 ke paas. Kamzor setup = Grade C.
   SL = 78.6% ke paar (0.8–2 ATR), TP1/2/3 = 1R/2R/3R. Valid 60 min. */
export const TF_MS = {'1min': 60e3, '5min': 300e3, '15min': 900e3, '1h': 3600e3};
export const VALID_MIN = 60;

export function ema(vals, n){
  const k = 2 / (n + 1), out = []; let e = vals[0];
  for(let i = 0; i < vals.length; i++){ e = i ? vals[i] * k + e * (1 - k) : vals[0]; out.push(e) }
  return out;
}
const tr = (b, i) => i ? Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c)) : b[i].h - b[i].l;
export function atrSeries(b, n = 14){
  const out = []; let a = 0;
  for(let i = 0; i < b.length; i++){ const t = tr(b, i); a = i < n ? (a * i + t) / (i + 1) : (a * (n - 1) + t) / n; out.push(a) }
  return out;
}
export const atr = (b, n = 14) => { const s = atrSeries(b, n); return s[s.length - 1] || 0 };
export function rsi(cl, n = 14){
  let g = 0, l = 0;
  for(let i = 1; i < cl.length; i++){ const d = cl[i] - cl[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if(i <= n){ g += up / n; l += dn / n } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n } }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
export function adx(b, n = 14){
  let sp = 0, sm = 0, st = 0, ax = 0, cnt = 0, pdi = 0, mdi = 0;
  for(let i = 1; i < b.length; i++){
    const up = b[i].h - b[i - 1].h, dn = b[i - 1].l - b[i].l;
    const p = up > dn && up > 0 ? up : 0, m = dn > up && dn > 0 ? dn : 0, t = tr(b, i);
    if(i <= n){ sp += p; sm += m; st += t } else { sp = sp - sp / n + p; sm = sm - sm / n + m; st = st - st / n + t }
    if(i >= n && st > 0){
      pdi = sp / st * 100; mdi = sm / st * 100;
      const dx = pdi + mdi ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
      cnt++; ax = cnt <= n ? (ax * (cnt - 1) + dx) / cnt : (ax * (n - 1) + dx) / n;
    }
  }
  return {adx: ax, pdi, mdi};
}
export function macdHist(cl){
  const a = ema(cl, 12), b = ema(cl, 26), m = a.map((x, i) => x - b[i]), s = ema(m, 9);
  return m[m.length - 1] - s[s.length - 1];
}
/* -3..+3 : EMA21 vs 50, close vs 50, EMA50 ki dhalaan */
export function trendScore(b){
  const cl = b.map(x => x.c), e21 = ema(cl, 21), e50 = ema(cl, 50), L = cl.length - 1, k = Math.max(0, L - 8);
  return (e21[L] > e50[L] ? 1 : -1) + (cl[L] > e50[L] ? 1 : -1) + (e50[L] > e50[k] ? 1 : -1);
}
function votes(b){
  const cl = b.map(x => x.c), L = cl.length - 1, e21 = ema(cl, 21), e50 = ema(cl, 50), eL = ema(cl, Math.min(200, Math.max(50, cl.length - 1))), d = adx(b);
  return [e21[L] > e50[L], cl[L] > eL[L], rsi(cl) > 50, macdHist(cl) > 0, d.pdi > d.mdi, cl[L] > cl[Math.max(0, L - 5)]];
}
/* apna sentiment: 15m (wazan 1) + 1H (wazan 1.5) ke 6-6 indicator */
export function sentiment(b15, b1h){
  let buy = 0, tot = 0;
  votes(b15).forEach(v => { tot += 1; if(v) buy += 1 });
  votes(b1h).forEach(v => { tot += 1.5; if(v) buy += 1.5 });
  return Math.min(95, Math.max(5, Math.round(buy / tot * 100)));
}
/* aakhri impulse leg: BUY = pehle low phir high (high sabse naya), SELL = ulta */
export function impulse(b, dir, n){
  const s = Math.max(0, b.length - n);
  let iE = s;
  for(let i = s; i < b.length; i++) if(dir > 0 ? b[i].h >= b[iE].h : b[i].l <= b[iE].l) iE = i;
  let iS = s;
  for(let i = s; i <= iE; i++) if(dir > 0 ? b[i].l <= b[iS].l : b[i].h >= b[iS].h) iS = i;
  return dir > 0 ? {lo: b[iS].l, hi: b[iE].h, iS, iE} : {hi: b[iS].h, lo: b[iE].l, iS, iE};
}
const r = (v, d) => +(+v).toFixed(d);

/* in: {b15, b1h, live, spec:{d, pip}, now}  ->  signal */
export function analyze({b15, b1h, live, spec, now = Date.now()}){
  if(!b15 || b15.length < 60 || !b1h || b1h.length < 60) throw new Error('Kam candles — analysis ke liye 15m + 1H dono ke 60+ chahiye');
  live = +live || b15[b15.length - 1].c;
  const A = atr(b15), t15 = trendScore(b15), t1h = trendScore(b1h);
  let tot = t15 + 1.2 * t1h;
  if(tot === 0) tot = t15 || (b15[b15.length - 1].c - b15[Math.max(0, b15.length - 20)].c);
  const dir = tot >= 0 ? 1 : -1, D = dir > 0 ? 'BUY' : 'SELL';
  const gap = Math.max(0.15 * A, 2 * spec.pip), far = 2.5 * A;
  /* leg: 12 ghante (48) -> chhota 6 ghante (24, tez trend me paas ka zone) -> bada 24 ghante (96) */
  let leg = null, pick = null;
  for(const n of [48, 24, 96]){
    const L = impulse(b15, dir, n); if(L.hi - L.lo < 1.5 * A && leg) continue;
    if(!leg) leg = L;
    const R0 = L.hi - L.lo, f0 = x => dir > 0 ? L.hi - R0 * x : L.lo + R0 * x;
    for(const x of [0.5, 0.618, 0.382, 0.786]){
      const p = f0(x), dist = dir > 0 ? live - p : p - live;
      if(dist >= gap && dist <= far){ pick = {x, p}; break }
    }
    if(pick){ leg = L; break }
  }
  const R = leg.hi - leg.lo;
  const fib = x => dir > 0 ? leg.hi - R * x : leg.lo + R * x;
  const noZone = !pick;
  const entry = pick ? pick.p : live - dir * 0.6 * A;
  const golden = !!pick && (pick.x === 0.5 || pick.x === 0.618);
  const w = Math.min(0.25 * A, golden ? Math.abs(fib(0.618) - fib(0.5)) || 0.25 * A : 0.25 * A);
  const zone = dir > 0 ? [entry - w, entry] : [entry, entry + w];
  const raw = Math.abs(entry - (fib(0.786) - dir * 0.2 * A));
  const risk = Math.min(2 * A, Math.max(0.8 * A, raw));
  const sl = entry - dir * risk, tp = [1, 2, 3].map(k => entry + dir * k * risk);
  const ax = adx(b15).adx;
  const aSer = atrSeries(b15), base = aSer.slice(-100).reduce((s, v) => s + v, 0) / Math.min(100, aSer.length);
  const dRatio = base ? A / base : 1;
  const buyPct = sentiment(b15, b1h);
  const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;
  const al15 = sgn(t15) === dir, al1h = sgn(t1h) === dir, counter = sgn(t1h) === -dir && Math.abs(t1h) >= 2;
  const sentOk = dir > 0 ? buyPct >= 55 : buyPct <= 45;
  let pts = (al15 ? 1 : 0) + (al1h ? 1 : 0) + (ax >= 25 ? 1 : 0) + (golden ? 1 : 0) + (sentOk ? 1 : 0) - (dRatio > 1.6 ? 1 : 0);
  let grade = pts >= 4 ? 'A' : pts >= 2 ? 'B' : 'C';
  if(counter || noZone) grade = 'C';
  else if(pick && pick.x === 0.786 && grade === 'A') grade = 'B';   /* v1.1.1: 78.6% = gehra pullback -> max Grade B (A sirf golden zone / mazboot setup) */
  const up = dir > 0 ? 'Uptrend' : 'Downtrend';
  const reasons = [
    al15 && al1h ? `${up} on 15m and 1H` : al15 ? `${up} on 15m (1H not confirmed)` : `${up} on 1H — 15m still mixed`,
    pick && pick.x === 0.786 ? 'Entry at the 78.6% Fibonacci level — deep pullback (max Grade B)' : pick ? (golden ? `Price pulled back into the ${pick.x === 0.5 ? '50%' : '61.8%'} golden zone` : `Entry at the ${(pick.x * 100).toFixed(1)}% Fibonacci level`) : 'No clean Fib zone — entry 0.6 ATR from price',
    `Sentiment: ${dir > 0 ? 'Buy ' + buyPct : 'Sell ' + (100 - buyPct)}% · ADX ${ax.toFixed(0)}`
  ];
  if(counter) reasons.push('Counter-trend vs 1H — Grade C, small size');
  const d = spec.d;
  return {dir: D, type: D + ' LIMIT', entry: r(entry, d), zone: zone.map(v => r(v, d)), sl: r(sl, d), tp: tp.map(v => r(v, d)),
    rr: '1 : 2', grade, buyPct, sellPct: 100 - buyPct, adx: +ax.toFixed(1),
    regime: ax >= 25 ? 'Trend' : ax < 20 ? 'Range' : 'Weak trend', danger: dRatio > 1.6 ? 'high' : dRatio > 1.2 ? 'medium' : 'calm',
    live: r(live, d), atr: A, fibX: pick ? pick.x : null, leg: {hi: r(leg.hi, d), lo: r(leg.lo, d)}, t15, t1h, reasons,
    at: now, exp: VALID_MIN, expiresAt: now + VALID_MIN * 60000};
}

/* Nateeja: signal ke BAAD ki candles (5m / 1m) se. Pehle fill (60 min me), phir SL / TP1..3.
   Ek hi candle me SL aur TP dono = SL (savdhaan). TP mila phir SL = jo TP mila wahi (jeet). */
export function evaluate(sig, bars, now = Date.now(), pip = 0.0001){
  const B = sig.dir === 'BUY' ? 1 : -1, after = bars.filter(b => b.t >= sig.at);
  const fillBy = sig.at + (sig.exp || VALID_MIN) * 60000;
  let fi = -1;
  for(let i = 0; i < after.length; i++){
    if(after[i].t > fillBy) break;
    if(B > 0 ? after[i].l <= sig.entry : after[i].h >= sig.entry){ fi = i; break }
  }
  if(fi < 0) return {state: now > fillBy && (after.length && after[after.length - 1].t > fillBy || now - fillBy > 10 * 60000) ? 'EXPIRED' : 'PENDING', done: now > fillBy};
  let best = 0;
  for(let i = fi; i < after.length; i++){
    const b = after[i];
    const slHit = B > 0 ? b.l <= sig.sl : b.h >= sig.sl;
    if(slHit){ return best ? res(best, b.t) : {state: 'SL', done: true, filledAt: after[fi].t, exitAt: b.t, pips: -Math.abs(sig.entry - sig.sl) / pip} }
    for(let k = 3; k > best; k--) if(B > 0 ? b.h >= sig.tp[k - 1] : b.l <= sig.tp[k - 1]){ best = k; break }
    if(best === 3) return res(3, b.t);
  }
  return best ? Object.assign(res(best, null), {done: false}) : {state: 'OPEN', done: false, filledAt: after[fi].t};
  function res(k, t){ return {state: 'TP' + k, done: true, filledAt: after[fi].t, exitAt: t, pips: Math.abs(sig.tp[k - 1] - sig.entry) / pip} }
}
export const isWin = st => /^TP/.test(st || ''), isLoss = st => st === 'SL';
