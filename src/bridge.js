/* PERSONAL FX bridge — SamuSignal wala hi raasta: Firebase /personalfx/orders/<key> -> PERSONAL FX EA (MT5).
   App KHUD kabhi order nahi bhejta — sirf "🚀 MT5 पे लगाओ" + confirm par.
   EA order ko apne lot se lagata hai; SL/TP / grid / averaging EA ke apne niyam (signal ka SL/TP EA pe lagu nahi).
   Key "-SG..." = SAMUSIGNAL AI. EA MT5 comment me "PFXA"+key likhta hai -> Watcher / SAMU REPORT pehchaan lete hain. */
import {SPECS} from './symbols.js';
import {fbUrl} from './data.js';

export const EXP_MIN = 60;
export function orderKey(now = Date.now()){
  const r = Array.from(crypto.getRandomValues(new Uint8Array(9)), x => (x % 36).toString(36)).join('');
  return ('-SG' + now.toString(36) + r).slice(0, 20);
}
/* [{login, real, bal, cur, server, name, lot, at, online}] */
export async function accounts(s){
  const u = fbUrl(s, 'personalfx/accounts'); if(!u) return [];
  const r = await fetch(u, {cache: 'no-store'}); if(!r.ok) throw new Error('accounts HTTP ' + r.status);
  const j = (await r.json()) || {};
  return Object.keys(j).map(k => Object.assign({}, j[k], {login: String(k), online: Date.now() - (+j[k].at || 0) < 5 * 60000}))
    .filter(a => a.at).sort((a, b) => (b.online - a.online) || ((b.real ? 1 : 0) - (a.real ? 1 : 0)));
}
/* saare orders {key: {...}} */
export async function orders(s){
  const u = fbUrl(s, 'personalfx/orders'); if(!u) return {};
  const r = await fetch(u, {cache: 'no-store'}); if(!r.ok) throw new Error('orders HTTP ' + r.status);
  return (await r.json()) || {};
}
export const ORDER_ST = {NEW: ['EA ka intezaar', 'gold'], PLACED: ['MT5 pe laga', 'up'], EXPIRED: ['60 min — hata diya', 'mu'],
  FAILED: ['Fail', 'dn'], SKIP: ['Nahi lagaya', 'dn'], STALE: ['Purana — nahi lagaya', 'dn'], REPLACED: ['Naye order se badla', 'mu'], CANCELLED: ['Cancel', 'mu']};

/* signal -> LIMIT order (har chune account pe ek). live = abhi ka bhaav (check: LIMIT sahi taraf) */
export async function sendLimit(s, sig, live, accts){
  const sp = SPECS[sig.sym], now = Date.now();
  if(now > sig.expiresAt) throw new Error('Signal ka 60 min khatam — dobara analyze karo');
  if(sig.dir === 'BUY' ? !(sig.entry < live) : !(sig.entry > live))
    throw new Error(`Bhaav entry ke paar chala gaya (live ${(+live).toFixed(sp.d)}) — ${sig.dir} LIMIT ab galat taraf hai, dobara analyze karo`);
  const sent = [], batch = 'G' + now.toString(36);
  for(const a of (accts.length ? accts : [null])){
    const key = orderKey(now + sent.length);
    const body = {id: now + sent.length, pair: sp.n, type: sig.dir + 'LIMIT', entry: +(+sig.entry).toFixed(sp.d), live: +(+live).toFixed(sp.d),
      at: now, exp: EXP_MIN, status: 'NEW', src: 'SAMUSIGNAL AI', batch, leg: 1, legs: 1};
    if(a) body.acct = a.login;
    const r = await fetch(fbUrl(s, 'personalfx/orders/' + key), {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    if(!r.ok) throw new Error((sent.length ? sent.length + ' gaya, baaki fail — ' : '') + (r.status === 401 || r.status === 403 ? 'Firebase ne mana kiya (auth)' : 'HTTP ' + r.status));
    sent.push({key, acct: a ? a.login : '', real: a ? !!a.real : false});
  }
  return sent;
}
