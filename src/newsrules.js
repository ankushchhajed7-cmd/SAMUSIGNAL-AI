/* NEWS SIGNAL — rule-book (pure logic, koi DOM / network nahi — tests/news.test.mjs me test hota hai).
   Soch: USD ka data "forecast se zyada" = USD mazboot (siwaye Unemployment / Claims ke, jahan zyada = USD kamzor).
   USD mazboot -> XAUUSD SELL, EURUSD SELL. USD kamzor -> dono BUY.
   Confidence = sirf rule-based andaza (surprise kitna bada) — guarantee nahi. Asli sach History me dikhta hai. */

export const PAIRS = [
  {sym: 'XAU/USD', name: 'XAUUSD', usdDir: -1, pip: 0.10, flat: 10},      /* 1 pip = $0.10, 10 pip se kam hilna = FLAT */
  {sym: 'EUR/USD', name: 'EURUSD', usdDir: -1, pip: 0.0001, flat: 3}
];

/* "227K" "0.3%" "1.2M" "-0.4%" "4,200" -> number. samajh na aaye to NaN */
export function parseNum(s){
  if(s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(/,/g, '').replace(/\s+/g, '');
  if(!t) return NaN;
  const m = /^(-?\d*\.?\d+)([%KMBT])?$/i.exec(t);
  if(!m) return NaN;
  let v = parseFloat(m[1]);
  const u = (m[2] || '').toUpperCase();
  if(u === 'K') v *= 1e3; else if(u === 'M') v *= 1e6; else if(u === 'B') v *= 1e9; else if(u === 'T') v *= 1e12;
  return v;
}
/* user sirf "227" likhe aur forecast "200K" ho to wahi unit laga do */
export function parseActual(actual, forecast){
  const a = String(actual === null || actual === undefined ? '' : actual).trim();
  if(!a) return NaN;
  if(/[%KMBT]$/i.test(a)) return parseNum(a);
  const fu = /([KMBT])$/i.exec(String(forecast || '').trim());
  return parseNum(fu ? a + fu[1] : a);
}

/* +1: zyada aaya = USD mazboot, -1: zyada aaya = USD kamzor, 0: koi number-rule nahi (speech / statement / anjaan) */
export function polarity(title){
  const t = String(title || '').toLowerCase();
  if(/speaks|speech|testifies|press conference|minutes|statement|member|meeting|beige|auction|bill |bond|holiday|president|chair/.test(t)) return 0;
  if(/unemployment|jobless|claims/.test(t)) return -1;
  if(/non-?farm|nfp|employment change|average hourly|payroll|cpi|ppi|pce|retail sales|gdp|ism|pmi|durable|industrial production|consumer (confidence|sentiment)|michigan|uom|jolts|job openings|housing starts|building permits|home sales|federal funds|interest rate|core /.test(t)) return 1;
  return 0;
}

const side = (usdUp, p) => (usdUp * p.usdDir > 0 ? 'BUY' : 'SELL');

/* release se PEHLE ka rule card: zyada aaya to? kam aaya to? */
export function rules(title){
  const pol = polarity(title);
  if(!pol) return null;
  return PAIRS.map(p => ({sym: p.sym, name: p.name, higher: side(pol, p), lower: side(-pol, p)}));
}

/* actual aate hi signal. ev = {title, forecast, previous} */
export function evaluate(ev, actualStr){
  const pol = polarity(ev.title);
  const a = parseActual(actualStr, ev.forecast), f = parseNum(ev.forecast), p = parseNum(ev.previous);
  if(!isFinite(a)) return {ok: false, why: 'Number samajh nahi aaya — jaise 0.4 ya 227K likho'};
  if(!pol) return {ok: false, why: 'Is news ka koi rule nahi (speech / statement) — trade nahi'};
  if(!isFinite(f)) return {ok: false, why: 'Is news ka forecast nahi mila — signal nahi ban sakta'};
  const surprise = a - f;
  if(surprise === 0) return {ok: true, flat: true, usd: 0, conf: 50, conv: 'LOW', surprise, sigs: PAIRS.map(x => ({sym: x.sym, name: x.name, dir: 'NO TRADE'}))};
  const scale = Math.max(Math.abs(f), isFinite(p) ? Math.abs(p) : 0, 1e-9);
  const r = Math.abs(surprise) / scale;
  const conf = 50 + Math.min(15, Math.round(r * 30));
  const usd = Math.sign(surprise) * pol;               /* +1 USD mazboot, -1 USD kamzor */
  return {ok: true, flat: false, usd, surprise, conf, conv: conf >= 59 ? 'HIGH' : conf >= 54 ? 'MED' : 'LOW',
    sigs: PAIRS.map(x => ({sym: x.sym, name: x.name, dir: side(usd, x)}))};
}

/* entry se price tak: pips (direction ke hisaab se, + = hamare haq me) aur WIN / LOSS / FLAT */
export function grade(sym, dir, entry, price){
  const p = PAIRS.find(x => x.sym === sym);
  if(!p || !isFinite(entry) || !isFinite(price) || (dir !== 'BUY' && dir !== 'SELL')) return null;
  const pips = (price - entry) * (dir === 'BUY' ? 1 : -1) / p.pip;
  return {pips: Math.round(pips * 10) / 10, res: Math.abs(pips) < p.flat ? 'FLAT' : pips > 0 ? 'WIN' : 'LOSS'};
}

/* history ka saar — TEST wale (rec.test) ginti me nahi */
export function summary(list){
  let w = 0, l = 0, f = 0;
  list.filter(r => !r.test).forEach(r => r.sigs.forEach(s => { if(s.res === 'WIN') w++; else if(s.res === 'LOSS') l++; else if(s.res === 'FLAT') f++ }));
  return {win: w, loss: l, flat: f, n: w + l + f, rate: w + l ? Math.round(w / (w + l) * 100) : null};
}
