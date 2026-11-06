/* NEWS SIGNAL — rule-book (pure logic, koi DOM / network nahi — tests/news.test.mjs me test hota hai).
   Soch: USD ka data "forecast se zyada" = USD mazboot (siwaye Unemployment / Claims ke, jahan zyada = USD kamzor).
   USD mazboot -> XAUUSD SELL, EURUSD SELL. USD kamzor -> dono BUY.
   Confidence = sirf rule-based andaza (surprise kitna bada) — guarantee nahi. Asli sach History me dikhta hai. */

export const PAIRS = [
  {sym: 'XAU/USD', name: 'XAUUSD', usdDir: -1, pip: 0.10, flat: 10, cs: 100},      /* 1 pip = $0.10, 10 pip se kam hilna = FLAT; 1 lot = 100 oz */
  {sym: 'EUR/USD', name: 'EURUSD', usdDir: -1, pip: 0.0001, flat: 3, cs: 100000}
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

/* v1.1.0: speech / statement / minutes — inka number nahi hota, kabhi trade nahi */
const SPEECHY = /speaks|speech|testifies|testimony|press conference|minutes|statement|member|meeting|beige|auction|bill |bond|holiday|president|chair/;
export const speechy = title => SPEECHY.test(String(title || '').toLowerCase());
/* +1: zyada aaya = USD mazboot, -1: zyada aaya = USD kamzor, 0: koi number-rule nahi (speech / statement / anjaan) */
export function polarity(title){
  const t = String(title || '').toLowerCase();
  if(SPEECHY.test(t)) return 0;
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

/* v1.1.0: MT5 calendar wali news jiska naam hamari list me nahi (jaise Philly Fed index) —
   number wala indicator ho to MT5 ka apna andaza (mi) chalega */
export function tradeable(ev){ return polarity(ev.title) !== 0 || (ev.kind === 'ind' && !speechy(ev.title)) }

/* actual aate hi signal. ev = {title, forecast, previous}. opt.mi = MT5 ka andaza (+1 USD mazboot / -1 kamzor) */
export function evaluate(ev, actualStr, opt = {}){
  let pol = polarity(ev.title);
  const mtOnly = !pol && ev.kind === 'ind' && !speechy(ev.title) && (opt.mi === 1 || opt.mi === -1);
  const a = parseActual(actualStr, ev.forecast), f = parseNum(ev.forecast), p = parseNum(ev.previous);
  if(!isFinite(a)) return {ok: false, why: 'Number samajh nahi aaya — jaise 0.4 ya 227K likho'};
  if(!pol && !mtOnly) return {ok: false, why: 'Is news ka koi rule nahi (speech / statement) — trade nahi'};
  if(!isFinite(f)) return {ok: false, why: 'Is news ka forecast nahi mila — signal nahi ban sakta'};
  const surprise = a - f;
  if(mtOnly) pol = Math.sign(surprise) * opt.mi || 1;     /* MT5: is surprise se USD upar (+1) ya neeche (-1) */
  if(surprise === 0) return {ok: true, flat: true, usd: 0, conf: 50, conv: 'LOW', surprise, sigs: PAIRS.map(x => ({sym: x.sym, name: x.name, dir: 'NO TRADE'}))};
  const scale = Math.max(Math.abs(f), isFinite(p) ? Math.abs(p) : 0, 1e-9);
  const r = Math.abs(surprise) / scale;
  const conf = 50 + Math.min(15, Math.round(r * 30));
  const usd = Math.sign(surprise) * pol;               /* +1 USD mazboot, -1 USD kamzor */
  return {ok: true, flat: false, usd, surprise, conf, mtOnly, conv: conf >= 59 ? 'HIGH' : conf >= 54 ? 'MED' : 'LOW',
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

/* ---------- v1.2.0: "✅ maine trade liya" — $ hisaab (sirf record, koi order nahi) ---------- */
export const DEF_TGT = {'XAU/USD': 10, 'EUR/USD': 3};          /* default target $ (0.01 lot): gold $10, EURUSD $3 (= 30 pip) */
/* entry se exit tak $ (direction ke hisaab se, + = nafa). spread shamil nahi */
export function usdOf(sym, dir, entry, exit, lot){
  const p = PAIRS.find(x => x.sym === sym);
  if(!p || !isFinite(entry) || !isFinite(exit) || !(lot > 0) || (dir !== 'BUY' && dir !== 'SELL')) return null;
  return Math.round((exit - entry) * (dir === 'BUY' ? 1 : -1) * p.cs * lot * 100) / 100;
}
/* $ target ka bhaav: SELL 4039.10, 0.01 lot, $10 -> 4029.10 */
export function tpPrice(sym, dir, entry, lot, usd){
  const p = PAIRS.find(x => x.sym === sym);
  if(!p || !isFinite(entry) || !(lot > 0) || !(usd > 0)) return null;
  const mv = usd / (p.cs * lot);
  return dir === 'BUY' ? entry + mv : entry - mv;
}
/* pts = [{t, h, l}] samay ke kram me (entry ke BAAD ke) -> target pehli baar kab chhua (t) ya null */
export function scanTp(dir, tp, pts){
  for(const x of pts){ if(dir === 'BUY' ? x.h >= tp : x.l <= tp) return x.t }
  return null;
}
/* mere trades ka saar: 1 min exit / $ target / 5 min / haath se band */
export function takeSummary(list){
  const T = [];
  list.filter(r => !r.test).forEach(r => (r.sigs || []).forEach(s => { if(s.take) T.push(s.take) }));
  const grp = k => { const v = T.map(t => t[k]).filter(x => typeof x === 'number'); const w = v.filter(x => x > 0).length;
    return {n: v.length, win: w, rate: v.length ? Math.round(w / v.length * 100) : null, usd: Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100} };
  const d = T.map(t => t.delay).filter(x => typeof x === 'number');
  return {n: T.length, m1: grp('u1'), tgt: grp('uT'), m5: grp('u5'), hand: grp('uX'), hits: T.filter(t => t.hit).length,
    delay: d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null};
}
