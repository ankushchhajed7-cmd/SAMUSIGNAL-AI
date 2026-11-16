/* CANDLE v1.0.0 — alag page (candle.html). Agli candle ka BUY / SELL (Strategy 5).
   Data: VPS ka "SamuSignal Data Feed" EA (Firebase /feed) — broker ka exact bhaav, 0 credit. TwelveData nahi.
   🚀 MT5: Firebase /personalfx/orders/<key> {strat:'CANDLE', tf} -> PERSONAL FX v7.6 is trade ko HAMESHA Strategy 5 pe chalata hai
           (TP +$0.25 / SL -$1.50 / candle band hote hi band), baaki trades upar wali Strategy (jaise 4) pe.
   📝 Paper: wahi niyam, band candles ke OHLC se (asli paisa nahi). Real aur Paper ka hisaab alag.
   localStorage: "sai_candle_*" (alag). Baaki app ko chhoota nahi.
   1.1.0: APP BAND HO TAB BHI — settings (ON pair / tf / Auto Paper) Firebase /candle/cfg me; VPS scanner v1.01 har candle
   par wahi code chala kar /candle/sig + /candle/paper likhta hai, AI AUTO EA v1.12 phone push. VPS chalu ho to phone khud
   auto paper nahi jodta (dohra na ho); Record tab me "Paper — VPS" alag. */
import {keys, LS, fbUrl, feedStatus} from './data.js';
import {SPECS, PAIRS, fmt, pipUsd} from './symbols.js';
import {accounts, orderKey} from './bridge.js';
import {DEF, signal, closedBars, stats, sendWindowMs, dynTp, CONFIRMS} from './candlerules.js';

export const CANDLE_VERSION = '1.10.0';
const MAX_ON = 6;
/* 1.9.0 (user 16 Nov): XAUUSD Candle se hataya — na pair list me, na history me (real / paper / VPS paper) */
const NO_PAIR = new Set(['XAU/USD']);
const okSym = p => !NO_PAIR.has(p);
const CPAIRS = PAIRS.filter(okSym);
const $ = id => document.getElementById(id);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const IST = {timeZone: 'Asia/Kolkata'};
const hms = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour12: false});
const hm = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour: '2-digit', minute: '2-digit', hour12: false});
const dayKey = t => new Date(t).toLocaleDateString('en-CA', IST);
const usd = v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);

const S = {
  tab: 'live', q: '',
  cfg: Object.assign({tf: 1, pairs: ['BTC/USD'], autoPaper: false, confirm: true, sound: true, screenOn: true}, LS.get('candle_cfg', {})),
  paper: LS.get('candle_paper', []),
  real: LS.get('candle_real', []),
  seen: LS.get('candle_seen', {}),
  bars: {}, live: {}, sig: {}, feed: null, err: '', busy: false, lastPoll: 0, sending: false,
  vps: null, vpsPaper: [], wx: {},   /* 1.1.0; 1.8.0 mausam */
  ea: null, eaTrades: []             /* 1.10.0: SAMUSIGNAL CANDLE EA (demo) */
};
const saveCfg = () => { LS.set('candle_cfg', S.cfg); cfgSync() };
/* 1.9.0: purani XAUUSD settings / history phone se hamesha ke liye saaf */
(() => {
  const p0 = S.cfg.pairs.length, r0 = S.real.length, q0 = S.paper.length;
  S.cfg.pairs = S.cfg.pairs.filter(okSym); S.real = S.real.filter(r => okSym(r.sym)); S.paper = S.paper.filter(r => okSym(r.sym));
  if(S.cfg.pairs.length !== p0) LS.set('candle_cfg', S.cfg);
  if(S.real.length !== r0) LS.set('candle_real', S.real);
  if(S.paper.length !== q0) LS.set('candle_paper', S.paper);
})();
/* 1.1.0: VPS ko batao kaunse pair / tf / Auto Paper (app band ho tab bhi wahi chale) */
function cfgSync(){
  clearTimeout(cfgSync.h);
  cfgSync.h = setTimeout(() => { try{ fetch(fbUrl(keys(), 'candle/cfg'), {method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({pairs: S.cfg.pairs.filter(p => SPECS[p]), tf: S.cfg.tf, autoPaper: !!S.cfg.autoPaper, at: Date.now()})}).catch(() => {}) }catch(e){} }, 800);
}
const vpsAlive = () => !!(S.vps && S.vps.t && Date.now() - S.vps.t * 1000 < 150000);
async function refreshVps(){
  const s = keys();
  try{ const r = await fetch(fbUrl(s, 'candle/vps'), {cache: 'no-store'}); S.vps = r.ok ? await r.json() : null }catch(e){}
  try{ const r = await fetch(fbUrl(s, 'candle/wx'), {cache: 'no-store'}); if(r.ok) S.wx = (await r.json()) || {} }catch(e){}   /* 1.8.0 */
  try{ const u = fbUrl(s, 'candle/paper'), r = await fetch(u + (u.includes('?') ? '&' : '?') + 'orderBy=%22%24key%22&limitToLast=600', {cache: 'no-store'});
    if(r.ok){ const j = (await r.json()) || {}; S.vpsPaper = Object.values(j).filter(p => p && p.sym && okSym(p.sym)).sort((a, b) => b.next - a.next) } }catch(e){}
  /* 1.10.0: CANDLE EA ki haalat + uske trade */
  try{ const r = await fetch(fbUrl(s, 'candle/ea/state'), {cache: 'no-store'}); if(r.ok) S.ea = await r.json() }catch(e){}
  try{ const u = fbUrl(s, 'candle/ea/trades'), r = await fetch(u + (u.includes('?') ? '&' : '?') + 'orderBy=%22%24key%22&limitToLast=300', {cache: 'no-store'});
    if(r.ok){ const j = (await r.json()) || {}; S.eaTrades = Object.values(j).filter(t => t && t.dir).sort((a, b) => b.next - a.next) } }catch(e){}
}
/* 1.10.0: EA ek line me — chalu? kitne trade, aaj ka P/L */
const eaAlive = () => !!(S.ea && S.ea.t && Date.now() - S.ea.t * 1000 < 120000);
function eaLine(){
  if(!S.ea) return '🤖 CANDLE EA: अभी कोई ख़बर नहीं (VPS पर नए $100 demo में EA लगाएँ)';
  const e = S.ea, pl = +e.dayPl || 0;
  return `🤖 CANDLE EA v${esc(e.v)} ${e.demo === false ? 'REAL' : 'DEMO'}: ${eaAlive() ? (e.stop ? '⏸ रुका — ' + esc(e.stop) : '✅ चालू') : '⚠ 2 min से ख़बर नहीं'} · खुले trade ${+e.open || 0}/${+e.max || 3} · आज <b class="${pl > 0 ? 'up' : pl < 0 ? 'dn' : ''}">${usd(pl)}</b> (${+e.dayW || 0}/${+e.dayL || 0})`;
}
const saveReal = () => { S.real = S.real.slice(0, 300); LS.set('candle_real', S.real) };
const saveSeen = () => { const k = Object.keys(S.seen); if(k.length > 80) k.slice(0, k.length - 80).forEach(x => delete S.seen[x]); LS.set('candle_seen', S.seen) };
const tfName = tf => (tf === 5 ? '5min' : '1min');
const tfMs = tf => (tf === 5 ? 5 : 1) * 60000;

/* ---------- sound / toast / dialog ---------- */
let AC = null;
function audio(){ try{ AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if(AC.state === 'suspended') AC.resume() }catch(e){} }
function beep(f = 880, d = 0.15){
  if(!S.cfg.sound) return;
  try{ audio(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; o.connect(g); g.connect(AC.destination);
    g.gain.setValueAtTime(0.6, AC.currentTime);   /* 1.0.4: zor se */ g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d); o.start(); o.stop(AC.currentTime + d) }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]) }catch(e){}
}
/* 1.0.4: naya signal = 3 beep + poori screen par bada BUY / SELL flash (8 sec, tap se band) */
function alertSig(sym, sg){
  const hi = sg.dir === 'BUY' ? [990, 1320, 1760] : [660, 520, 440];
  hi.forEach((f, i) => setTimeout(() => beep(f, 0.25), i * 300));
  const el = $('flash'); if(!el) return;
  el.className = 'on ' + sg.dir;
  el.innerHTML = `<div class="fdir">${sg.dir}</div><div class="fsym">${esc(SPECS[sym] ? SPECS[sym].n : sym)}</div><div class="fln">${hm(sg.next)} की ${sg.tf}m candle · 🚀 MT5 जल्दी दबाएँ</div><div class="fx">tap = बंद</div>`;
  clearTimeout(alertSig.h); alertSig.h = setTimeout(() => { el.className = '' }, 8000);
}
/* 1.0.4: Screen ON (Wake Lock) — ON rahe tab tak screen apne aap band nahi hogi */
let WL = null;
async function wakeSet(){
  if(!S.cfg.screenOn){ try{ if(WL) await WL.release() }catch(e){} WL = null; S.wlTxt = 'OFF'; return }
  if(!('wakeLock' in navigator)){ S.wlTxt = 'इस phone / browser में support नहीं'; return }
  if(document.hidden) return;
  try{ if(!WL || WL.released){ WL = await navigator.wakeLock.request('screen'); WL.addEventListener('release', () => { S.wlTxt = 'रुका — app फिर खोलें'; }) } S.wlTxt = 'चालू — screen बंद नहीं होगी' }
  catch(e){ S.wlTxt = 'अभी नहीं चला — page पर एक बार tap करें' }
}
function toast(m){ const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => { t.style.display = 'none' }, 3200) }
function dlg(title, html, okTxt = 'OK', noTxt = 'Cancel'){
  $('dlgT').textContent = title; $('dlgB').innerHTML = html; $('dlgOk').textContent = okTxt; $('dlgNo').textContent = noTxt;
  $('dlgNo').style.display = noTxt ? '' : 'none'; $('dlg').classList.add('on');
  return new Promise(res => { $('dlgOk').onclick = () => { $('dlg').classList.remove('on'); res(true) }; $('dlgNo').onclick = () => { $('dlg').classList.remove('on'); res(false) } });
}

/* ---------- data (MT5 Data Feed) ---------- */
function rates(){ const r = {}; ['USD/JPY', 'USD/CHF', 'USD/CAD', 'GBP/USD', 'EUR/USD', 'AUD/USD', 'NZD/USD'].forEach(p => { const L = S.live[SPECS[p].n]; if(L && L.b > 0) r[p] = +L.b }); return r }
/* $ per 1.0 price, 0.01 lot */
const kOf = sym => pipUsd(sym, 0.01, rates()) / SPECS[sym].pip;
const spreadOf = sym => { const L = S.live[SPECS[sym].n]; return L && L.sp > 0 ? +L.sp : 0 };
async function fetchBars(s, sym, tf){
  const r = await fetch(fbUrl(s, 'feed/bars/' + tfName(tf) + '/' + SPECS[sym].n), {cache: 'no-store'});
  if(!r.ok) throw new Error('bars HTTP ' + r.status);
  const str = await r.json();
  if(typeof str !== 'string' || !str) throw new Error(SPECS[sym].n + ' feed me nahi');
  return str.split(';').map(x => { const v = x.split(',').map(Number); return {t: v[0] * 1000, o: v[1], h: v[2], l: v[3], c: v[4]} }).filter(b => b.c > 0);
}
async function poll(){
  if(S.busy) return; S.busy = true; S.lastPoll = Date.now();
  try{
    const s = keys();
    S.feed = await feedStatus(s);
    if(!S.feed.ok){ S.err = S.feed.why || 'Data Feed band'; return }
    S.err = '';
    try{ const r = await fetch(fbUrl(s, 'feed/live'), {cache: 'no-store'}); if(r.ok) S.live = (await r.json()) || {} }catch(e){}
    const need = new Map();
    S.cfg.pairs.forEach(p => { if(SPECS[p]) need.set(p + '|' + S.cfg.tf, [p, S.cfg.tf]) });
    await Promise.all([...need.values()].map(async ([sym, tf]) => {
      try{ S.bars[sym + '|' + tf] = await fetchBars(s, sym, tf) }catch(e){ S.bars[sym + '|' + tf] = S.bars[sym + '|' + tf] || [] }
    }));
    const now = Date.now();
    S.cfg.pairs.forEach(sym => {
      const tf = S.cfg.tf, bars = closedBars(S.bars[sym + '|' + tf] || [], tf, now);
      const sg = Object.assign(signal(bars, Object.assign({}, DEF, {tf})), {sym, tf});
      S.sig[sym] = sg;
      if(sg.dir === 'NO') return;
      const key = sym + '|' + tf;
      if(S.seen[key] === sg.at) return;
      S.seen[key] = sg.at; saveSeen();
      if(now - sg.next < sendWindowMs(tf)) alertSig(sym, sg);   /* 1.0.4: 3 beep + bada flash */
    });
  }catch(e){ S.err = e.message }
  finally{ S.busy = false; render() }
}

/* ---------- paper ---------- */
/* 1.3.0: phone wala paper hata diya (user) — paper sirf VPS par (Firebase /candle/paper) */

/* ---------- 🚀 MT5 ---------- */
async function onMt5(sym){
  const sg = S.sig[sym]; if(!sg || sg.dir === 'NO' || S.sending) return;
  const left = () => sg.next + sendWindowMs(sg.tf) - Date.now();
  if(left() <= 0) return toast('Signal का समय निकल गया — अगली candle का इंतज़ार करें');
  if(S.real.some(r => r.sym === sym && r.next === sg.next)) return toast('ये signal MT5 को पहले ही भेजा जा चुका है');
  S.sending = true;
  try{
    const s = keys(); let acc = [];
    try{ acc = (await accounts(s)).filter(a => a.online) }catch(e){ return dlg('Firebase नहीं खुला', esc(e.message), 'OK', '') }
    let pick = acc;
    if(acc.length > 1){
      const last = LS.get('acct', []);
      pick = acc.filter(a => last.includes(a.login));
      if(!pick.length) pick = [acc.find(a => !a.real) || acc[0]];
    }
    const n = SPECS[sym].n, real = pick.some(a => a.real);
    if(S.cfg.confirm){
      const ok = await dlg('PERSONAL FX — Strategy 5?', `<b style="font-size:17px;color:${sg.dir === 'BUY' ? 'var(--up)' : 'var(--dn2)'}">${esc(n)} · ${sg.dir} MARKET · ${sg.tf}m</b>
<div class="note" style="margin-top:6px">TP <b>+$${DEF.tp.toFixed(2)}</b> · SL <b>-$${DEF.sl.toFixed(2)}</b> · lot <b>EA का S5_Lot (0.01)</b> · candle बंद होते ही बंद</div>
<div style="margin-top:10px;font-size:13px">${pick.length ? 'Account: ' + pick.map(a => `<b style="color:${a.real ? 'var(--up)' : 'var(--gold)'}">${a.real ? 'REAL' : 'DEMO'} ${esc(a.login)}</b>`).join(' + ') : '<span style="color:var(--gold)">⚠ कोई PERSONAL FX online नहीं दिखा — EA 15 sec में न देखे तो order नहीं लगेगा</span>'}</div>
${real ? '<div class="warn" style="margin-top:10px">💰 REAL account — असली पैसे का जोखिम है।</div>' : ''}
<div class="note" style="margin-top:8px">⏱ बचा समय: ${Math.max(0, Math.ceil(left() / 1000))} sec · PERSONAL FX <b>v7.6</b> होना ज़रूरी</div>`, '🚀 भेजो', 'Cancel');
      if(!ok) return;
      if(left() <= 0) return toast('Signal का समय निकल गया — नहीं भेजा');
    }
    const now = Date.now(), sent = [];
    for(const a of (pick.length ? pick : [null])){
      const key = orderKey(now + sent.length);
      const body = {id: now + sent.length, pair: n, type: sg.dir + 'MARKET', at: Date.now(), status: 'NEW', src: 'SAMUSIGNAL AI CANDLE',
        strat: 'CANDLE', tf: sg.tf, sig: sg.at, leg: 1, legs: 1};
      if(a) body.acct = a.login;
      const r = await fetch(fbUrl(s, 'personalfx/orders/' + key), {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      if(!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Firebase ने मना किया (auth)' : 'HTTP ' + r.status);
      sent.push(key);
      S.real.unshift({key, sym, dir: sg.dir, tf: sg.tf, next: sg.next, at: body.at, acct: a ? a.login : '', real: a ? !!a.real : false, status: 'NEW', msg: ''});
    }
    saveReal(); render(); toast('✅ PERSONAL FX को भेजा — Strategy 5');
    [4000, 9000, 16000, 30000].forEach(t => setTimeout(refreshReal, t));
  }catch(e){ dlg('नहीं भेजा', esc(e.message), 'OK', '') }
  finally{ S.sending = false }
}
const OPEN_ST = ['NEW', 'PLACED'];
async function refreshReal(force){
  const todo = S.real.filter(r => OPEN_ST.includes(r.status) && Date.now() - r.at < 24 * 3600e3);
  if(!todo.length && !force) return;
  try{
    const s = keys(), r = await fetch(fbUrl(s, 'personalfx/orders'), {cache: 'no-store'});
    if(!r.ok) return;
    const all = (await r.json()) || {};
    let ch = false;
    S.real.forEach(x => {
      const o = all[x.key]; if(!o) return;
      ['status', 'msg', 'res', 'pl', 'closed'].forEach(f => { if(o[f] !== undefined && o[f] !== x[f]){ x[f] = o[f]; ch = true } });
    });
    if(ch){ saveReal(); render() }
  }catch(e){}
}

/* ---------- render ---------- */
const ST_TXT = {NEW: ['EA का इंतज़ार', 'gd'], PLACED: ['MT5 पे चालू', 'up'], CLOSED: ['बंद', ''], FAILED: ['Fail', 'dn'], SKIP: ['नहीं लगा', 'dn'], STALE: ['देर हो गई — नहीं लगा', 'dn']};
function chips(){
  const f = S.feed, now = Date.now();
  const feed = !f ? '<span class="pill">Data …</span>' : f.ok ? '<span class="pill ok">● MT5 Data Feed</span>' : `<span class="pill bad">● ${esc(S.err || 'Data Feed band')}</span>`;
  const open = S.real.filter(r => r.status === 'PLACED').length, pend = S.vpsPaper.filter(p => !p.done).length;
  return feed + `<span class="pill warn">📝 TP candle 50% · SL $${DEF.paperSl}</span><span class="pill warn">🚀 TP $${DEF.tp.toFixed(2)} · SL $${DEF.sl.toFixed(2)}</span>` + (S.cfg.autoPaper ? '<span class="pill ok">🖥 VPS Paper</span>' : '')
    + (S.vps ? (vpsAlive() ? '<span class="pill ok">🖥 VPS चालू</span>' : '<span class="pill bad">🖥 VPS बंद</span>') : '')
    + (open ? `<span class="pill ok">🚀 ${open} चालू</span>` : '') + (pend ? `<span class="pill">📝 ${pend} चल रहे</span>` : '') + `<span class="pill">${hm(now)} IST</span>`;
}
function cdTxt(){ const tf = S.cfg.tf, ms = tfMs(tf) - (Date.now() % tfMs(tf)); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
function pairCard(sym){
  const sp = SPECS[sym], L = S.live[sp.n], sg = S.sig[sym], now = Date.now(), k = kOf(sym), spr = spreadOf(sym);
  const w = S.wx[sp.n], wOk = w && w.t && Date.now() - w.t * 1000 < 180000;   /* 1.8.0: bazaar ka mausam (VPS, har minute) */
  const wxTxt = wOk ? `<div class="wx ${w.c}">${WXI[w.c] || ''} ${w.c === 'G' ? 'साफ़' : w.c === 'Y' ? 'ध्यान' : 'तेज़'}${w.why && w.why.length ? ' — ' + esc([].concat(w.why).join(' · ')) : ''}</div>` : '';
  const head = `<div class="hd"><b>${esc(sp.n)}</b><span class="mono">${L && L.b > 0 ? fmt(sym, L.b) : '—'}${spr > 0 ? ` · spread $${(spr * k).toFixed(2)}` : ''}</span></div>${wxTxt}`;
  if(!sg) return `<div class="pc">${head}<div class="no">Candles आ रही हैं…</div></div>`;
  /* v1.0.1: feed se nayi band candle nahi aa rahi? (Data Feed v1.0 weekend pe sirf 5 min me bhejta tha) */
  const late = sg.at && now - sg.next > tfMs(sg.tf) + 20000;
  const lateTxt = late ? `<div class="warn" style="margin-top:10px">⚠ नई candle नहीं आई — आख़िरी बंद candle <b>${hm(sg.at)}</b>। VPS पर <b>Data Feed v1.01</b> लगाएँ, या ये pair का market बंद है।</div>` : '';
  if(sg.dir === 'NO'){
    return `<div class="pc">${head}${lateTxt}<div class="no">⏸ <b class="nt">No Trade</b> <span class="why">— ${esc(sg.why)}</span>${sg.at ? `<div class="kv"><span>candle <b>${hm(sg.at)}</b></span>${isFinite(sg.rsi) ? `<span>RSI <b>${sg.rsi.toFixed(0)}</b></span>` : ''}${isFinite(sg.e9) ? `<span>EMA9 ${sg.e9 > sg.e21 ? '>' : '<'} 21</span>` : ''}</div>` : ''}</div></div>`;
  }
  const left = sg.next + sendWindowMs(sg.tf) - now, live = left > 0, candleLeft = sg.next + tfMs(sg.tf) - now;
  const sent = S.real.find(r => r.sym === sym && r.next === sg.next), inPaper = S.vpsPaper.find(p => p.sym === sym && p.next === sg.next && +p.tf === sg.tf);   /* 1.3.0: VPS paper */
  const pTp = dynTp(sg, k), tpPx = k > 0 ? DEF.tp / k : 0, slPx = k > 0 ? DEF.sl / k : 0;   /* 1.2.0 */
  const stTxt = sent ? (ST_TXT[sent.status] || [sent.status, ''])[0] + (sent.res ? ' · ' + sent.res + ' ' + (isFinite(sent.pl) ? usd(+sent.pl) : '') : '') : '';
  return `<div class="pc">${head}${lateTxt}
<div class="sig ${sg.dir}${live ? '' : ' OLD'}">
  <span class="vt" data-left="${sg.next + sendWindowMs(sg.tf)}">${live ? '⏱ ' + Math.ceil(left / 1000) + 's' : candleLeft > 0 ? 'MT5 का समय गया' : 'candle पूरी'}</span>
  <div class="dir">${sg.dir}</div>
  <div class="ln">${hm(sg.next)} की ${sg.tf}m candle के लिए · ${esc(sg.why)}</div>
  <div class="ln" style="opacity:.85">🖥 Paper TP <b>$${pTp.toFixed(2)}</b> · SL $${DEF.paperSl} · 🚀 Real TP $${DEF.tp.toFixed(2)} ≈ ${tpPx ? (+tpPx).toFixed(sp.d) : '—'} दूर · SL ≈ ${slPx ? (+slPx).toFixed(sp.d) : '—'} दूर (0.01 lot)</div>
  ${sent ? `<div class="ln"><b>🚀 MT5: ${esc(stTxt)}</b>${sent.msg ? `<br><span style="opacity:.85">${esc(sent.msg)}</span>` : ''}</div>` : ''}
  ${inPaper ? `<div class="ln"><b>🖥 VPS Paper: ${inPaper.done ? esc(inPaper.res) + ' ' + (isFinite(inPaper.pl) && inPaper.pl !== null ? usd(inPaper.pl) : '') : 'चल रहा है'}</b></div>` : ''}
  <div class="acts">
    <button class="btn mt5" data-act="mt5" data-v="${esc(sym)}" ${!live || sent ? 'disabled' : ''}>🚀 MT5</button>
  </div>
</div></div>`;
}
function liveTab(){
  const on = S.cfg.pairs.filter(p => SPECS[p]);
  return `<div class="wrap">
<div class="card"><div class="bar"><div class="seg">${[1, 5].map(t => `<button data-act="tf" data-v="${t}" class="${S.cfg.tf === t ? 'on' : ''}">${t} MIN</button>`).join('')}</div>
<div class="cdbox"><b class="mono" id="cd">${cdTxt()}</b><small>candle बंद होने में</small></div></div>
<div class="tg" style="margin-top:8px"><span>🖥 VPS Paper<small>हर signal VPS पर अपने आप paper में — app बंद हो तब भी (asli paisa nahi)</small></span><button data-act="auto" class="${S.cfg.autoPaper ? 'on' : ''}">${S.cfg.autoPaper ? 'ON' : 'OFF'}</button></div>
<div class="tg" style="margin-top:8px"><span>☀️ Screen ON<small>${esc(S.wlTxt || 'ON = जब तक ये page खुला है, screen अपने आप बंद नहीं होगी')}</small></span><button data-act="screen" class="${S.cfg.screenOn ? 'on' : ''}">${S.cfg.screenOn ? 'ON' : 'OFF'}</button></div></div>
${S.feed && !S.feed.ok ? `<div class="warn">⚠ ${esc(S.err || 'Data Feed band')} — VPS पर "SamuSignal Data Feed" EA चालू करें।</div>` : ''}
${on.length ? on.map(pairCard).join('') : `<div class="empty">कोई pair ON नहीं — नीचे <b>Pairs</b> में जाकर ON करें</div>`}
<div class="note">Signal सिर्फ़ <b>बंद candle</b> पर बनता है। MT5 button: 1m में 20 sec, 5m में 60 sec तक।<br>🖥 <b>App बंद हो तब भी:</b> VPS scanner इन्हीं ON pair पर <b>1 MIN और 5 MIN दोनों</b> का paper जोड़ता है (VPS Paper ON हो तो), और ऊपर चुने हुए MIN का signal AI AUTO EA (v1.12) से phone पर push। ${S.vps ? (vpsAlive() ? '✅ VPS चालू' : '⚠ VPS से 2 min से ख़बर नहीं') : '⚠ VPS से अभी कोई ख़बर नहीं (scanner v1.01 चाहिए)'}<br>${eaLine()}<br><small>🤖 EA इन्हीं ON pair पर और ऊपर चुने हुए MIN पर असली (demo) order लगाता है — एक साथ ज़्यादा से ज़्यादा 3।</small></div>
</div>`;
}
function pairsTab(){
  const q = S.q.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const list = CPAIRS.filter(p => !q || SPECS[p].n.includes(q));
  const on = S.cfg.pairs;
  const row = p => `<div class="prow"><span>${esc(SPECS[p].n)}<small>${esc(SPECS[p].title)}</small></span><button data-act="pair" data-v="${esc(p)}" class="${on.includes(p) ? 'on' : ''}">${on.includes(p) ? 'ON' : 'OFF'}</button></div>`;
  return `<div class="wrap"><div class="card"><h3>Pairs (${on.length}/${MAX_ON} ON)</h3><div class="note" style="margin-bottom:8px">सिर्फ़ ON वाले pair पर signal आएगा। (XAUUSD Candle से हटा दिया गया है।)<br>🤖 <b>CANDLE EA (demo) भी सिर्फ़ इन्हीं ON pair पर trade लगाता है</b> — OFF किया तो उस pair पर नया trade नहीं (चालू trade अपने नियम से बंद होगा)।</div>
<input class="srch" id="srch" placeholder="खोजें: BTC, EUR…" value="${esc(S.q)}">
${on.length ? `<div style="margin-top:10px">${on.filter(p => SPECS[p]).map(row).join('')}</div>` : ''}
<div style="margin-top:10px">${list.filter(p => !on.includes(p)).map(row).join('')}</div></div></div>`;
}
function statBlock(title, list){
  const today = dayKey(Date.now()), all = stats(list), td = stats(list.filter(x => dayKey(x.at) === today));
  const tiles = s => `<div class="tiles"><div class="tile">Trades<b>${s.n}</b></div><div class="tile">Win %<b class="${s.n ? (s.wr >= 86 ? 'up' : s.wr >= 60 ? 'gd' : 'dn') : ''}">${s.n ? s.wr + '%' : '—'}</b></div><div class="tile">W / L<b>${s.win} / ${s.loss}</b></div><div class="tile">Net $<b class="${s.net > 0 ? 'up' : s.net < 0 ? 'dn' : ''}">${s.n ? usd(s.net) : '—'}</b></div></div>`;
  return `<div class="card"><h3>${title}</h3><div class="lbl">आज</div>${tiles(td)}<div class="lbl" style="margin-top:10px">कुल</div>${tiles(all)}</div>`;
}
/* 1.3.0: SL ki tulna — VPS paper ke har trade ke 4 nateeje (p.v.A..D), sirf naye trade (jinme v hai) */
/* 1.6.0: 4 pushti ka naap — "agar ye pushti lagi hoti to" (paper niyam wahi; sirf jin trade par cf likha hai) */
/* 1.7.0: sabse gehra ghata (MAE) — book hone se pehle trade kitna neeche gaya; SL $10 ka asli khatra */
const WXI = {G: '🟢', Y: '🟡', R: '🔴'};
/* 1.8.0: mausam ka naap — trade lete waqt mausam G / Y / R tha to nateeja kya raha */
function wxTable(tf){
  const list = S.vpsPaper.filter(p => p.done && p.wx && p.wx.c && +p.tf === tf && isFinite(p.pl) && p.pl !== null);
  if(!list.length) return `<div class="card"><h3>🌦 मौसम का नाप — ${tf} MIN</h3><div class="empty">नए paper trade आते ही यहाँ 🟢 / 🟡 / 🔴 का हिसाब (VPS scanner v1.08)</div></div>`;
  const rows = [['G', 'साफ़'], ['Y', 'ध्यान'], ['R', 'तेज़']].map(([c, nm]) => {
    const sub = list.filter(p => p.wx.c === c), s = stats(sub.map(p => ({at: p.at, pl: +p.pl}))), ms = sub.filter(p => isFinite(p.mae) && p.mae !== null).map(p => +p.mae);
    const worst = ms.length ? Math.min(...ms) : null, av = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null;
    return `<tr><td>${WXI[c]} ${nm}</td><td><b class="${s.net > 0 ? 'up' : s.net < 0 ? 'dn' : ''}">${s.n ? usd(s.net) : '—'}</b><small>${s.n ? s.n + ' · ' + s.wr + '%' : ''}</small></td><td><b class="${worst !== null && worst < 0 ? 'dn' : ''}">${worst !== null ? usd(worst) : '—'}</b><small>${av !== null ? 'औसत ' + usd(av) : ''}</small></td></tr>`;
  }).join('');
  return `<div class="card"><h3>🌦 मौसम का नाप — ${tf} MIN</h3><table class="cmp"><tr><th>trade लेते समय</th><th>नतीजा (कुल)</th><th>सबसे गहरा</th></tr>${rows}</table>
<div class="note" style="margin-top:8px">🔴 तेज़ = High news (60 min पहले-बाद), रफ़्तार 1.5 गुना, अचानक बड़ी candle, spread चौड़ा · 🟡 ध्यान = रफ़्तार 1.25 गुना, London / New York खुलना, rollover, लंबी शांति, इस घंटे अक्सर तेज़ी · 🟢 साफ़ = इनमें से कुछ नहीं। अगर 🔴 में गहरा घाटा ज़्यादा दिखे तो EA में "सिर्फ़ 🟢 में trade" लगाएँगे।</div></div>`;
}
function maeCard(tf){
  const list = S.vpsPaper.filter(p => p.done && +p.tf === tf && isFinite(p.mae) && p.mae !== null);
  if(!list.length) return '';
  const worst = list.reduce((a, p) => (p.mae < a.mae ? p : a)), avg = list.reduce((a, p) => a + +p.mae, 0) / list.length;
  const cnt = v => list.filter(p => p.mae <= -v).length;
  return `<div class="card"><h3>📉 सबसे गहरा घाटा — ${tf} MIN</h3><div class="note" style="margin-top:0">
सबसे गहरा: <b class="dn">${usd(+worst.mae)}</b> (${esc(SPECS[worst.sym] ? SPECS[worst.sym].n : worst.sym)} ${worst.dir} · ${hm(worst.next)})<br>
औसत गहरा: <b>${usd(avg)}</b> · ${list.length} trade<br>
−$1 से नीचे गए: <b>${cnt(1)}</b> · −$3 से नीचे: <b>${cnt(3)}</b> · −$5 से नीचे: <b>${cnt(5)}</b><br>
<small>मतलब: अगर SL इससे कम होता तो कितने trade SL पर बंद होते। Paper SL अभी $${DEF.paperSl}।</small></div></div>`;
}
function cfTable(tf){
  const list = S.vpsPaper.filter(p => p.done && p.cf && +p.tf === tf && isFinite(p.pl) && p.pl !== null), today = dayKey(Date.now());
  const big = tf === 5 ? '15' : '5';
  const rowsDef = [['सारे trade', []]].concat(CONFIRMS.map(c => [c.id + ' · ' + (c.id === '1' ? big + ' MIN का trend साथ' : c.name), [c.id]]), [['1 + 2', ['1', '2']], ['चारों', ['1', '2', '3', '4']]]);
  const cell = arr => { const s = stats(arr); return `<td><b class="${s.net > 0 ? 'up' : s.net < 0 ? 'dn' : ''}">${s.n ? usd(s.net) : '—'}</b><small>${s.n ? s.n + ' · ' + s.wr + '%' : ''}</small></td>` };
  const rows = rowsDef.map(([name, ids]) => { const sub = list.filter(p => ids.every(id => p.cf[id] === true)).map(p => ({at: p.at, pl: +p.pl}));
    return `<tr><td>${esc(name)}</td>${cell(sub.filter(x => dayKey(x.at) === today))}${cell(sub)}</tr>` }).join('');
  return `<div class="card"><h3>🔍 पुष्टि का नाप — ${tf} MIN</h3>
${list.length ? `<table class="cmp"><tr><th>अगर सिर्फ़ ये trade लेते</th><th>आज</th><th>कुल</th></tr>${rows}</table>
<div class="note" style="margin-top:8px">हर line = सिर्फ़ वो trade जिनमें वो पुष्टि पास थी (signal / paper नियम नहीं बदला)। 1 = बड़ी TF (${big} MIN) का EMA 9/21 trend साथ · 2 = close candle के ऊपर / नीचे 25% में · 3 = candle average के 3 गुना से बड़ी नहीं और EMA 21 से ज़्यादा दूर नहीं · 4 = पिछली candle भी उसी रंग की।</div>`
  : `<div class="empty">${tf} MIN के नए paper trade आते ही यहाँ पुष्टि का हिसाब (VPS scanner v1.06)</div>`}</div>`;
}
function recTab(){
  const realDone = S.real.filter(r => r.status === 'CLOSED' && isFinite(r.pl)).map(r => ({at: r.at, pl: +r.pl}));
  const vpsDone = S.vpsPaper.filter(p => p.done && isFinite(p.pl) && p.pl !== null);   /* 1.1.0 */
  const rRow = r => `<div class="hrow"><div><b class="${r.dir === 'BUY' ? 'up' : 'dn'}">${esc(SPECS[r.sym] ? SPECS[r.sym].n : r.sym)} ${r.dir}</b> · ${r.tf}m · ${hm(r.next)}${r.acct ? ` · ${r.real ? 'REAL' : 'DEMO'} ${esc(r.acct)}` : ''}<small>${esc((ST_TXT[r.status] || [r.status])[0])}${r.res ? ' · ' + esc(r.res) : ''}${r.msg && r.status !== 'CLOSED' ? ' · ' + esc(String(r.msg).slice(0, 80)) : ''}</small></div><div class="r ${isFinite(r.pl) ? (+r.pl > 0 ? 'up' : +r.pl < 0 ? 'dn' : '') : 'gd'}">${isFinite(r.pl) && r.pl !== undefined ? usd(+r.pl) : OPEN_ST.includes(r.status) ? '…' : '—'}</div></div>`;
  const pRow = p => `<div class="hrow"><div><b class="${p.dir === 'BUY' ? 'up' : 'dn'}">${esc(SPECS[p.sym] ? SPECS[p.sym].n : p.sym)} ${p.dir}</b> · ${p.tf}m · ${hm(p.next)}${p.auto ? ' · auto' : ''}<small>${p.done ? esc(p.res) + (p.n > 1 ? ' · ' + p.n + ' candle' : '') + (isFinite(p.mae) && p.mae !== null ? ' · गहरा ' + usd(+p.mae) : '') : 'चल रहा है'}${p.wx && p.wx.c ? ' · ' + (WXI[p.wx.c] || '') : ''}${p.cf ? ' · पुष्टि ' + ['1', '2', '3', '4'].map(id => p.cf[id] === true ? id : p.cf[id] === false ? '✗' : '·').join('') : ''}${p.entry ? ' · entry ' + fmt(p.sym, p.entry) : ''}${isFinite(p.tp) ? ' · TP $' + (+p.tp).toFixed(2) : ''}${isFinite(p.slDyn) ? ' · cSL $' + (+p.slDyn).toFixed(2) : ''}${p.v ? '<br>' + ['B', 'C', 'D'].map(id => p.v[id] ? id + ' ' + (p.v[id].pl >= 0 ? '+' : '') + (+p.v[id].pl).toFixed(2) : '').filter(Boolean).join(' · ') : ''}</small></div><div class="r ${p.done && isFinite(p.pl) ? (p.pl > 0 ? 'up' : p.pl < 0 ? 'dn' : '') : 'gd'}">${p.done && isFinite(p.pl) ? usd(p.pl) : '…'}</div></div>`;
  const eaDone = S.eaTrades.filter(t => t.done && isFinite(t.pl) && t.pl !== null).map(t => ({at: t.at, pl: +t.pl}));   /* 1.10.0 */
  const eRow = t => { const pp = S.vpsPaper.find(p => p.id === t.id);
    return `<div class="hrow"><div><b class="${t.dir === 'BUY' ? 'up' : 'dn'}">${esc(t.n || t.sym)} ${t.dir}</b> · ${t.tf}m · ${hm(t.next)}<small>${t.done ? esc(t.res || '') + (t.cn > 1 ? ' · ' + t.cn + ' candle' : '') : 'चल रहा है'}${isFinite(t.tp) ? ' · TP $' + (+t.tp).toFixed(2) : ''}${isFinite(t.spread) ? ' · spread $' + (+t.spread).toFixed(2) : ''}${pp && pp.done && isFinite(pp.pl) ? ' · paper ' + usd(+pp.pl) : ''}</small></div><div class="r ${t.done && isFinite(t.pl) ? (t.pl > 0 ? 'up' : t.pl < 0 ? 'dn' : '') : 'gd'}">${t.done && isFinite(t.pl) ? usd(+t.pl) : '…'}</div></div>` };
  return `<div class="wrap">
${statBlock('🤖 CANDLE EA (Demo) — असली order', eaDone)}
${S.ea ? `<div class="note">${eaLine()}${S.ea.bal ? ' · Balance $' + (+S.ea.bal).toFixed(2) : ''}</div>` : ''}
${statBlock('🚀 Real (MT5 · EA का नतीजा)', realDone)}
${statBlock('🖥 VPS Paper — 1 MIN', vpsDone.filter(p => +p.tf !== 5))}
${maeCard(1)}
${wxTable(1)}
${cfTable(1)}
${statBlock('🖥 VPS Paper — 5 MIN', vpsDone.filter(p => +p.tf === 5))}
${maeCard(5)}
${wxTable(5)}
${cfTable(5)}
<div class="note">🖥 VPS Paper (1.5.0): TP = signal candle की body का 50% ($0.10–$1.00) · SL $${DEF.paperSl} · trade SL तक चलता है — पहली candle पर TP या close फ़ायदे में = book; दूसरी candle से +$${DEF.bookUsd.toFixed(2)} छूते ही या किसी candle का close फ़ायदे में = <b>PROFIT BOOK</b>। एक pair पर एक समय में एक ही paper trade। 🚀 Real (EA): TP $${DEF.tp.toFixed(2)} · SL $${DEF.sl.toFixed(2)}।</div>
<div class="card"><h3>🤖 CANDLE EA trades (Demo)</h3>${S.eaTrades.length ? S.eaTrades.slice(0, 60).map(eRow).join('') : `<div class="empty">${S.ea ? 'EA चालू — ON pair पर अगले signal का इंतज़ार' : 'अभी कोई EA trade नहीं — VPS पर नए $100 demo में "SAMUSIGNAL CANDLE EA" लगाएँ'}</div>`}</div>
<div class="card"><h3>🚀 Real trades</h3>${S.real.length ? S.real.slice(0, 40).map(rRow).join('') : '<div class="empty">अभी कोई real trade नहीं</div>'}
<button class="btn ghost" data-act="refreal" style="width:100%;margin-top:10px">↻ EA से नतीजा लाओ</button></div>
<div class="card"><h3>🖥 VPS paper trades</h3>${S.vpsPaper.length ? S.vpsPaper.slice(0, 60).map(pRow).join('') : `<div class="empty">${vpsAlive() ? 'VPS चालू है — अगले signal का इंतज़ार (VPS Paper ON होना चाहिए)' : 'VPS से अभी कोई paper नहीं — VPS पर scanner v1.04 चाहिए'}</div>`}
${S.vpsPaper.length ? '<button class="btn ghost" data-act="clrvps" style="width:100%;margin-top:10px">🗑 VPS paper record साफ़ करें (नया शुरू)</button>' : ''}</div>
</div>`;
}
function setTab(){
  const tg = (act, on, t, sub) => `<div class="tg"><span>${t}<small>${sub}</small></span><button data-act="${act}" class="${on ? 'on' : ''}">${on ? 'ON' : 'OFF'}</button></div>`;
  return `<div class="wrap"><div class="card"><h3>Setting</h3>
${tg('auto', S.cfg.autoPaper, '🖥 VPS Paper', 'हर BUY / SELL signal VPS पर अपने आप paper में (4 तरह के SL की तुलना)')}
${tg('confirm', S.cfg.confirm, '🚀 MT5 से पहले पूछो', 'OFF = एक tap में सीधा भेजो (तेज़)')}
${tg('sound', S.cfg.sound, '🔔 आवाज़ + vibrate', 'नया signal आने पर (3 beep + बड़ा BUY / SELL flash)')}
${tg('screen', S.cfg.screenOn, '☀️ Screen ON', 'ON = screen अपने आप बंद नहीं होगी')}</div>
<div class="card"><h3>Strategy 5 — नियम</h3><div class="note">
• Signal: बंद candle मज़बूत (body ≥ पिछली 10 की average × ${DEF.bodyMult}, body ≥ candle का ${DEF.bodyPct * 100}%) + EMA ${DEF.fast} / ${DEF.slow} की दिशा + close EMA ${DEF.fast} के उस पार + RSI ${DEF.rsiLen} (BUY ${DEF.buyRsi[0]}–${DEF.buyRsi[1]}, SELL ${DEF.sellRsi[0]}–${DEF.sellRsi[1]})।<br>
• Paper TP: signal candle की body का ${DEF.tpBodyPct * 100}% — कम से कम $${DEF.tpMin.toFixed(2)}, ज़्यादा से ज़्यादा $${DEF.tpMax.toFixed(2)} (0.01 lot)। Paper SL $${DEF.paperSl}। Trade SL तक चलता है, दूसरी candle से +$${DEF.bookUsd.toFixed(2)} या किसी candle का close फ़ायदे में = PROFIT BOOK। एक pair (+ MIN) पर एक ही paper trade (1.5.0)।<br>
• Trade (EA PERSONAL FX v7.6): TP +$${DEF.tp.toFixed(2)} · SL -$${DEF.sl.toFixed(2)} (0.01 lot पर) · candle बंद होते ही जो भी P/L · lot = EA का S5_Lot (0.01)।<br>
• बाकी सारे trades EA की ऊपर वाली Strategy (जैसे 4) पर ही चलते हैं।<br>
• Paper: वही नियम; entry = trade वाली candle का open (+ spread BUY पर)। एक ही candle में TP और SL दोनों छुए तो SL माना जाता है।<br>
• Real में order 5–15 sec देर से लगता है, इसलिए real और paper में थोड़ा फ़र्क रहेगा।</div></div>
<div class="card"><h3>Data</h3><div class="note">${S.feed ? (S.feed.ok ? '✅ MT5 Data Feed चालू' : '⚠ ' + esc(S.err)) : '…'}<br>Firebase: ${esc(keys().fbUrl.replace(/^https?:\/\//, '').slice(0, 40))}…<br>Candle page v${CANDLE_VERSION}</div></div></div>`;
}
const tabHtml = () => S.tab === 'live' ? liveTab() : S.tab === 'pairs' ? pairsTab() : S.tab === 'rec' ? recTab() : setTab();
/* poll ke baad: Pairs tab par search box ko mat chhedo (likhte waqt focus na jaaye) */
function render(){
  $('chips').innerHTML = chips();
  if(S.tab !== 'pairs' || !$('srch')) $('main').innerHTML = tabHtml();
  const tabs = [['live', '🕯️', 'Live'], ['pairs', '🔀', 'Pairs'], ['rec', '📊', 'Record'], ['set', '⚙️', 'Setting']];
  $('nav').innerHTML = tabs.map(t => `<button data-act="tab" data-v="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}"><b>${t[1]}</b>${t[2]}</button>`).join('');
}
function repaint(){ $('main').innerHTML = tabHtml(); render() }

/* ---------- actions ---------- */
document.addEventListener('click', e => { audio(); if(S.cfg.screenOn && (!WL || WL.released)) wakeSet().then(render);   /* 1.0.4: tap par Screen ON phir se */
  const b = e.target.closest('[data-act]'); if(b && !b.disabled) act(b.dataset.act, b.dataset.v) });
document.addEventListener('input', e => { if(e.target.id === 'srch'){ S.q = e.target.value; const pos = e.target.selectionStart; $('main').innerHTML = pairsTab(); const i = $('srch'); i.focus(); try{ i.setSelectionRange(pos, pos) }catch(x){} } });
function act(a, v){
  if(a === 'tab'){ S.tab = v; S.q = ''; repaint(); if(v === 'rec'){ refreshReal(true); refreshVps().then(() => { if(S.tab === 'rec') repaint() }) } return }
  if(a === 'tf'){ S.cfg.tf = +v === 5 ? 5 : 1; saveCfg(); S.sig = {}; repaint(); poll(); return }
  if(a === 'auto'){ S.cfg.autoPaper = !S.cfg.autoPaper; saveCfg(); repaint(); toast(S.cfg.autoPaper ? '🖥 VPS Paper ON' : 'VPS Paper OFF'); return }
  if(a === 'confirm'){ S.cfg.confirm = !S.cfg.confirm; saveCfg(); repaint(); return }
  if(a === 'sound'){ S.cfg.sound = !S.cfg.sound; saveCfg(); repaint(); if(S.cfg.sound) beep(); return }
  if(a === 'screen'){ S.cfg.screenOn = !S.cfg.screenOn; saveCfg(); wakeSet().then(repaint); toast(S.cfg.screenOn ? '☀️ Screen ON — अपने आप बंद नहीं होगी' : 'Screen ON बंद'); return }
  if(a === 'flashoff'){ $('flash').className = ''; return }
  if(a === 'pair'){
    const on = S.cfg.pairs;
    if(on.includes(v)) S.cfg.pairs = on.filter(p => p !== v);
    else{ if(on.length >= MAX_ON) return toast(`ज़्यादा से ज़्यादा ${MAX_ON} pair ON`); S.cfg.pairs = on.concat(v) }
    saveCfg(); delete S.sig[v]; $('main').innerHTML = pairsTab(); render(); poll(); return;
  }
  if(a === 'mt5') return onMt5(v);
  if(a === 'refreal'){ refreshReal(true).then(() => toast('↻ ताज़ा किया')); return }
  if(a === 'clrvps'){   /* 1.4.0: user — purana VPS paper hatao, aaj se naya */
    dlg('VPS paper record साफ़ करें?', '<div class="note">VPS के <b>सारे paper trade</b> (1 MIN + 5 MIN, चारों SL तरीके) हमेशा के लिए हट जाएँगे। Real trade नहीं हटेंगे। इसके बाद से नया हिसाब।</div>', 'हटाओ', 'Cancel').then(async ok => {
      if(!ok) return;
      try{ const r = await fetch(fbUrl(keys(), 'candle/paper'), {method: 'DELETE'}); if(!r.ok) throw new Error('HTTP ' + r.status);
        S.vpsPaper = []; repaint(); toast('🗑 VPS paper साफ़ — अब से नया हिसाब') }catch(e){ dlg('नहीं हटा', esc(e.message), 'OK', '') }
    });
    return;
  }
}

/* ---------- loop ---------- */
function tick(){
  const now = Date.now();
  const cd = $('cd'); if(cd) cd.textContent = cdTxt();
  document.querySelectorAll('[data-left]').forEach(el => { const l = +el.dataset.left - now; if(l > 0) el.textContent = '⏱ ' + Math.ceil(l / 1000) + 's'; else if(!el.dataset.gone){ el.dataset.gone = 1; if(S.tab === 'live') repaint() } });
  if(document.hidden) return;
  const since = now % tfMs(S.cfg.tf), every = since < 25000 ? 2000 : 8000;
  if(now - S.lastPoll >= every) poll();
}
function boot(){
  $('ver').textContent = 'v' + CANDLE_VERSION;
  render(); poll(); refreshReal(); cfgSync(); refreshVps().then(render);   /* 1.1.0: VPS ko settings + VPS ka haal */
  setInterval(tick, 1000);
  setInterval(refreshReal, 10000);
  setInterval(() => { if(!document.hidden) refreshVps().then(() => { if(S.tab !== 'pairs') render() }) }, 20000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden){ wakeSet().then(render); poll() } });   /* 1.0.4: Screen ON toggle */
  wakeSet().then(render);
}
boot();
