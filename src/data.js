/* Data + keys
   1) Keys: SamuSignal (isi website ankushchhajed7-cmd.github.io par) ki localStorage (samu_*) se SIRF PADHTE hain —
      kuch copy / commit / log nahi. Is app ki apni cheezein "sai_*" me. Settings me haath se override bhi ho sakta hai.
   2) Candles + bhaav: pehle MT5 Data Feed (Firebase /feed — Exness ka exact bhaav, 0 credit),
      na mile to TwelveData (SamuSignal wali key). */
import {SPECS} from './symbols.js';

const SAMU = k => { try{ const v = localStorage.getItem('samu_' + k); return v === null ? undefined : JSON.parse(v) }catch(e){ return undefined } };
export const DEFAULT_FB = 'https://forexdiagnosis-default-rtdb.asia-southeast1.firebasedatabase.app';
export const LS = {
  get(k, d){ try{ const v = localStorage.getItem('sai_' + k); return v === null ? d : JSON.parse(v) }catch(e){ return d } },
  set(k, v){ try{ localStorage.setItem('sai_' + k, JSON.stringify(v)) }catch(e){} }
};
export function keys(){
  const ov = LS.get('ov', {});
  const pick = (k, sk) => (ov[k] !== undefined && ov[k] !== '') ? {v: ov[k], from: 'manual'} : (SAMU(sk) ? {v: SAMU(sk), from: 'samu'} : {v: '', from: ''});
  const td = pick('tdKey', 'key'), fb = pick('fbUrl', 'fbUrl'), fa = pick('fbAuth', 'fbAuth'), g = pick('gKey', 'gKey');
  let samuN = 0; try{ for(let i = 0; i < localStorage.length; i++) if(String(localStorage.key(i)).startsWith('samu_')) samuN++ }catch(e){}
  return {tdKey: td.v, fbUrl: fb.v || DEFAULT_FB, fbAuth: fa.v, gKey: g.v, gModel: SAMU('gModel') || '', samuN,
    from: {tdKey: td.from, fbUrl: fb.from || 'default', fbAuth: fa.from, gKey: g.from}};
}
export function fbBase(s){ let u = String(s.fbUrl || '').trim().replace(/\/+$/, ''); if(!u) return ''; if(!/^https?:\/\//.test(u)) u = 'https://' + u; return u }
export const fbUrl = (s, path) => { const b = fbBase(s); return b ? b + '/' + path + '.json' + (s.fbAuth ? '?auth=' + encodeURIComponent(s.fbAuth) : '') : '' };

/* ---------------- MT5 Data Feed ---------------- */
const FEED = {meta: null, metaAt: 0, live: null, liveAt: 0, bars: {}};
export async function feedStatus(s, force){
  if(!fbBase(s)) return {ok: false, why: 'Firebase URL nahi'};
  if(force || Date.now() - FEED.metaAt > 15000){
    FEED.metaAt = Date.now();
    FEED.err = '';
    try{ const r = await fetch(fbUrl(s, 'feed/meta'), {cache: 'no-store'}); FEED.meta = r.ok ? await r.json() : null;
      if(!r.ok) FEED.err = r.status === 401 || r.status === 403 ? 'Firebase ne mana kiya (Auth chahiye)' : 'HTTP ' + r.status }catch(e){ FEED.meta = null; FEED.err = 'Firebase tak nahi pahunche' }
  }
  const m = FEED.meta, ok = !!(m && m.at && Date.now() - m.at * 1000 < 120000);
  const ago = m && m.at ? Math.round((Date.now() - m.at * 1000) / 60000) : 0;
  return {ok, meta: m, why: ok ? '' : FEED.err || (m && m.at ? `VPS ka Data Feed EA ${ago >= 120 ? Math.round(ago / 60) + ' ghante' : ago + ' min'} se band` : 'Data Feed EA ka data nahi mila')};
}
async function feedLive(s){
  if(FEED.live && Date.now() - FEED.liveAt < 4000) return FEED.live;
  const r = await fetch(fbUrl(s, 'feed/live'), {cache: 'no-store'});
  if(!r.ok) throw new Error('feed live HTTP ' + r.status);
  FEED.live = (await r.json()) || {}; FEED.liveAt = Date.now();
  return FEED.live;
}
async function feedBars(s, sym, tf){
  const k = SPECS[sym].n, ck = tf + '|' + k, c = FEED.bars[ck];
  let str;
  if(c && Date.now() - c.t < (tf === '1min' || tf === '5min' ? 15000 : 40000)) str = c.s;
  else{
    const r = await fetch(fbUrl(s, 'feed/bars/' + tf + '/' + k), {cache: 'no-store'});
    if(!r.ok) throw new Error('feed bars HTTP ' + r.status);
    str = await r.json();
    if(typeof str !== 'string' || !str) throw new Error('feed me ' + k + ' ' + tf + ' nahi');
    FEED.bars[ck] = {t: Date.now(), s: str};
  }
  const out = str.split(';').map(x => { const v = x.split(',').map(Number); return {t: v[0] * 1000, o: v[1], h: v[2], l: v[3], c: v[4]} }).filter(b => b.c > 0);
  try{ const L = (await feedLive(s))[k], f = L && L.f && L.f[tf];
    if(f && out.length && f[0] * 1000 > out[out.length - 1].t) out.push({t: f[0] * 1000, o: f[1], h: f[2], l: f[3], c: f[4]}) }catch(e){}
  if(out.length < 30) throw new Error('feed me kam candles');
  return out;
}

/* ---------------- TwelveData ---------------- */
const TD = {cache: {}, q: {}};   /* v1.8.2: q = har pair ka alag cache {sym: {t, d}} */
/* v1.8.3: TwelveData free = 8 credit / minute. Ab ek minute me 7 se zyada nahi (apna hisaab).
   Zaroori kaam (critical: ANALYZE, MT5 order, chart pehli baar) jagah khaali hone tak ruk jaata hai (max ~65 sec);
   baaki (refresh, pairs list, nateeja) us minute chhod diya jaata hai. TD "credits" wala error aaye to agle minute tak ruko. */
const TDB = {log: [], coolUntil: 0, max: 7};
export const TD_WAIT = {cb: null};   /* app yahan callback deta hai: kitne sec baaki (screen pe dikhane ke liye) */
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const tdLimitErr = () => Object.assign(new Error('TwelveData की इस मिनट की limit पूरी — थोड़ी देर में अपने आप'), {limit: true});
async function tdGate(n, critical){
  for(let k = 0; k < 70; k++){
    const now = Date.now(); TDB.log = TDB.log.filter(t => now - t < 61000);
    if(now >= TDB.coolUntil && TDB.log.length + n <= TDB.max){ for(let i = 0; i < n; i++) TDB.log.push(now); return }
    if(!critical) throw tdLimitErr();
    const oldest = TDB.log.length ? Math.min(...TDB.log) : now, left = Math.max(1, Math.ceil(Math.max(TDB.coolUntil - now, oldest + 61000 - now) / 1000));
    try{ TD_WAIT.cb && TD_WAIT.cb(left) }catch(e){}
    await sleep(1000);
  }
  throw tdLimitErr();
}
function tdErr(j, r, s){
  const m = j && j.message ? String(j.message).split(s.tdKey).join('***') : '';
  if(/credits|limit/i.test(m)){ TDB.coolUntil = (Math.floor(Date.now() / 60000) + 1) * 60000 + 1500; return tdLimitErr() }
  return new Error('TwelveData: ' + (m ? m.slice(0, 90) : 'HTTP ' + r.status));
}
export const tdUsage = () => { const now = Date.now(); return TDB.log.filter(t => now - t < 61000).length };
async function tdBars(s, sym, tf, n, critical){
  const ck = sym + '|' + tf, c = TD.cache[ck];
  if(c && Date.now() - c.t < 60000) return c.bars;
  await tdGate(1, critical);
  const u = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${tf}&outputsize=${n}&order=ASC&timezone=UTC&apikey=${encodeURIComponent(s.tdKey)}`;
  const r = await fetch(u), j = await r.json().catch(() => ({}));
  if(!j.values) throw tdErr(j, r, s);
  const bars = j.values.map(v => ({t: Date.parse(v.datetime.replace(' ', 'T') + 'Z'), o: +v.open, h: +v.high, l: +v.low, c: +v.close})).filter(b => isFinite(b.c));
  TD.cache[ck] = {t: Date.now(), bars};
  return bars;
}
const useFeed = () => LS.get('src', 'auto') !== 'td';

/* candles: {bars, src} */
export async function series(s, sym, tf, n = 250, critical = false){
  if(useFeed() && (await feedStatus(s)).ok){ try{ return {bars: await feedBars(s, sym, tf), src: 'mt5'} }catch(e){} }
  if(!s.tdKey) throw Object.assign(new Error('Live data nahi — MT5 feed band aur TwelveData key nahi'), {nodata: true});
  return {bars: await tdBars(s, sym, tf, n, critical), src: 'td'};
}
/* sab pairs ke bhaav {sym: {p, chg, sp}} */
export async function quotes(s, syms, critical = false){
  const out = {};
  if(useFeed() && (await feedStatus(s)).ok){
    try{ const L = await feedLive(s);
      syms.forEach(x => { const q = L[SPECS[x].n]; if(!q || !(q.b > 0)) return; const d1 = q.f && q.f['1day'];
        out[x] = {p: +q.b, chg: d1 && d1[1] ? (q.b - d1[1]) / d1[1] * 100 : 0, sp: +q.sp || 0, src: 'mt5'} });
      if(Object.keys(out).length) return out;
    }catch(e){}
  }
  if(!s.tdKey) return out;
  /* v1.8.2 bug fix: pehle 1 min tak PICHHLE pair ka bhaav lauta deta tha (pair badalte hi "Live bhaav nahi mila").
     Ab har pair ka apna 1-min cache — sirf jo pair purane / nahi hain wahi TwelveData se (credit bachat waisi hi). */
  const now = Date.now(), need = [];
  syms.forEach(x => { const c = TD.q[x]; if(c && now - c.t < 60000) out[x] = c.d; else need.push(x) });
  if(!need.length) return out;
  try{
    const list = need.slice(0, critical ? 2 : 3);          /* v1.8.3: har symbol = 1 credit — list chhoti */
    await tdGate(list.length, critical);
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(list.join(','))}&apikey=${encodeURIComponent(s.tdKey)}`);
    const j = await r.json(), one = list.length === 1 ? {[list[0]]: j} : j;
    if(j && j.code && j.message) throw tdErr(j, r, s);
    list.forEach(x => { const q = one[x]; if(q && q.close){ out[x] = {p: +q.close, chg: +q.percent_change || 0, sp: 0, src: 'td'}; TD.q[x] = {t: now, d: out[x]} } });
  }catch(e){}
  return out;
}
