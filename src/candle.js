/* CANDLE v1.0.0 — alag page (candle.html). Agli candle ka BUY / SELL (Strategy 5).
   Data: VPS ka "SamuSignal Data Feed" EA (Firebase /feed) — broker ka exact bhaav, 0 credit. TwelveData nahi.
   🚀 MT5: Firebase /personalfx/orders/<key> {strat:'CANDLE', tf} -> PERSONAL FX v7.6 is trade ko HAMESHA Strategy 5 pe chalata hai
           (TP +$0.25 / SL -$1.50 / candle band hote hi band), baaki trades upar wali Strategy (jaise 4) pe.
   📝 Paper: wahi niyam, band candles ke OHLC se (asli paisa nahi). Real aur Paper ka hisaab alag.
   localStorage: "sai_candle_*" (alag). Baaki app ko chhoota nahi. */
import {keys, LS, fbUrl, feedStatus} from './data.js';
import {SPECS, PAIRS, fmt, pipUsd} from './symbols.js';
import {accounts, orderKey} from './bridge.js';
import {DEF, signal, closedBars, paperResolve, stats, sendWindowMs} from './candlerules.js';

export const CANDLE_VERSION = '1.0.0';
const MAX_ON = 6;
const $ = id => document.getElementById(id);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const IST = {timeZone: 'Asia/Kolkata'};
const hms = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour12: false});
const hm = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour: '2-digit', minute: '2-digit', hour12: false});
const dayKey = t => new Date(t).toLocaleDateString('en-CA', IST);
const usd = v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);

const S = {
  tab: 'live', q: '',
  cfg: Object.assign({tf: 1, pairs: ['XAU/USD'], autoPaper: false, confirm: true, sound: true}, LS.get('candle_cfg', {})),
  paper: LS.get('candle_paper', []),
  real: LS.get('candle_real', []),
  seen: LS.get('candle_seen', {}),
  bars: {}, live: {}, sig: {}, feed: null, err: '', busy: false, lastPoll: 0, sending: false
};
const saveCfg = () => LS.set('candle_cfg', S.cfg);
const savePaper = () => { S.paper = S.paper.slice(0, 300); LS.set('candle_paper', S.paper) };
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
    g.gain.setValueAtTime(0.25, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d); o.start(); o.stop(AC.currentTime + d) }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([200, 100, 200]) }catch(e){}
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
    S.paper.filter(p => !p.done && SPECS[p.sym]).forEach(p => need.set(p.sym + '|' + p.tf, [p.sym, p.tf]));
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
      if(S.cfg.autoPaper) addPaper(sym, sg, true);
      if(now - sg.next < sendWindowMs(tf)){ beep(sg.dir === 'BUY' ? 990 : 660, 0.2); setTimeout(() => beep(sg.dir === 'BUY' ? 1320 : 520, 0.2), 260) }
    });
    resolvePaper(now);
  }catch(e){ S.err = e.message }
  finally{ S.busy = false; render() }
}

/* ---------- paper ---------- */
function addPaper(sym, sg, auto){
  if(S.paper.some(p => p.sym === sym && p.tf === sg.tf && p.next === sg.next)){ if(!auto) toast('ये signal पहले से paper में है'); return }
  const k = kOf(sym);
  S.paper.unshift({id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), sym, dir: sg.dir, tf: sg.tf, next: sg.next, at: Date.now(),
    spread: spreadOf(sym), k, tp: DEF.tp, sl: DEF.sl, lot: DEF.lot, maxCandles: DEF.maxCandles, auto: !!auto, done: false});
  savePaper();
  if(!auto) toast('📝 Paper में जुड़ गया — candle बंद होते ही नतीजा');
}
function resolvePaper(now){
  let ch = false;
  S.paper.forEach(p => {
    if(p.done) return;
    if(now - p.next > 6 * 3600e3){ p.done = true; p.res = 'DATA NAHI'; p.pl = NaN; ch = true; return }
    const r = paperResolve(p, S.bars[p.sym + '|' + p.tf] || [], now);
    if(r.entry !== undefined && p.entry !== r.entry){ p.entry = r.entry; ch = true }
    if(r.done){ Object.assign(p, {done: true, res: r.res, pl: r.pl, exitT: r.exitT}); ch = true }
  });
  if(ch) savePaper();
}

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
  const open = S.real.filter(r => r.status === 'PLACED').length, pend = S.paper.filter(p => !p.done).length;
  return feed + `<span class="pill warn">TP +$${DEF.tp.toFixed(2)} · SL -$${DEF.sl.toFixed(2)}</span>` + (S.cfg.autoPaper ? '<span class="pill ok">📝 Auto Paper</span>' : '')
    + (open ? `<span class="pill ok">🚀 ${open} चालू</span>` : '') + (pend ? `<span class="pill">📝 ${pend} चल रहे</span>` : '') + `<span class="pill">${hm(now)} IST</span>`;
}
function cdTxt(){ const tf = S.cfg.tf, ms = tfMs(tf) - (Date.now() % tfMs(tf)); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
function pairCard(sym){
  const sp = SPECS[sym], L = S.live[sp.n], sg = S.sig[sym], now = Date.now(), k = kOf(sym), spr = spreadOf(sym);
  const head = `<div class="hd"><b>${esc(sp.n)}</b><span class="mono">${L && L.b > 0 ? fmt(sym, L.b) : '—'}${spr > 0 ? ` · spread $${(spr * k).toFixed(2)}` : ''}</span></div>`;
  if(!sg) return `<div class="pc">${head}<div class="no">Candles आ रही हैं…</div></div>`;
  if(sg.dir === 'NO'){
    return `<div class="pc">${head}<div class="no">⏸ <b>No Trade</b> — ${esc(sg.why)}${sg.at ? `<div class="kv"><span>candle <b>${hm(sg.at)}</b></span>${isFinite(sg.rsi) ? `<span>RSI <b>${sg.rsi.toFixed(0)}</b></span>` : ''}${isFinite(sg.e9) ? `<span>EMA9 ${sg.e9 > sg.e21 ? '>' : '<'} 21</span>` : ''}</div>` : ''}</div></div>`;
  }
  const left = sg.next + sendWindowMs(sg.tf) - now, live = left > 0, candleLeft = sg.next + tfMs(sg.tf) - now;
  const sent = S.real.find(r => r.sym === sym && r.next === sg.next), inPaper = S.paper.find(p => p.sym === sym && p.next === sg.next && p.tf === sg.tf);
  const tpPx = k > 0 ? DEF.tp / k : 0, slPx = k > 0 ? DEF.sl / k : 0;
  const stTxt = sent ? (ST_TXT[sent.status] || [sent.status, ''])[0] + (sent.res ? ' · ' + sent.res + ' ' + (isFinite(sent.pl) ? usd(+sent.pl) : '') : '') : '';
  return `<div class="pc">${head}
<div class="sig ${sg.dir}${live ? '' : ' OLD'}">
  <span class="vt" data-left="${sg.next + sendWindowMs(sg.tf)}">${live ? '⏱ ' + Math.ceil(left / 1000) + 's' : candleLeft > 0 ? 'MT5 का समय गया' : 'candle पूरी'}</span>
  <div class="dir">${sg.dir}</div>
  <div class="ln">${hm(sg.next)} की ${sg.tf}m candle के लिए · ${esc(sg.why)}</div>
  <div class="ln" style="opacity:.85">TP ≈ ${tpPx ? (+tpPx).toFixed(sp.d) : '—'} दूर · SL ≈ ${slPx ? (+slPx).toFixed(sp.d) : '—'} दूर (0.01 lot)</div>
  ${sent ? `<div class="ln"><b>🚀 MT5: ${esc(stTxt)}</b>${sent.msg ? `<br><span style="opacity:.85">${esc(sent.msg)}</span>` : ''}</div>` : ''}
  ${inPaper ? `<div class="ln"><b>📝 Paper: ${inPaper.done ? esc(inPaper.res) + ' ' + (isFinite(inPaper.pl) ? usd(inPaper.pl) : '') : 'चल रहा है'}</b></div>` : ''}
  <div class="acts">
    <button class="btn mt5" data-act="mt5" data-v="${esc(sym)}" ${!live || sent ? 'disabled' : ''}>🚀 MT5</button>
    <button class="btn pp" data-act="paper" data-v="${esc(sym)}" ${inPaper || candleLeft <= 0 ? 'disabled' : ''}>📝 Paper</button>
  </div>
</div></div>`;
}
function liveTab(){
  const on = S.cfg.pairs.filter(p => SPECS[p]);
  return `<div class="wrap">
<div class="card"><div class="bar"><div class="seg">${[1, 5].map(t => `<button data-act="tf" data-v="${t}" class="${S.cfg.tf === t ? 'on' : ''}">${t} MIN</button>`).join('')}</div>
<div class="cdbox"><b class="mono" id="cd">${cdTxt()}</b><small>candle बंद होने में</small></div></div>
<div class="tg" style="margin-top:8px"><span>📝 Auto Paper<small>हर signal अपने आप paper में (asli paisa nahi)</small></span><button data-act="auto" class="${S.cfg.autoPaper ? 'on' : ''}">${S.cfg.autoPaper ? 'ON' : 'OFF'}</button></div></div>
${S.feed && !S.feed.ok ? `<div class="warn">⚠ ${esc(S.err || 'Data Feed band')} — VPS पर "SamuSignal Data Feed" EA चालू करें।</div>` : ''}
${on.length ? on.map(pairCard).join('') : `<div class="empty">कोई pair ON नहीं — नीचे <b>Pairs</b> में जाकर ON करें</div>`}
<div class="note">Signal सिर्फ़ <b>बंद candle</b> पर बनता है। MT5 button: 1m में 20 sec, 5m में 60 sec तक। App खुला रहना चाहिए (screen on)।</div>
</div>`;
}
function pairsTab(){
  const q = S.q.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const list = PAIRS.filter(p => !q || SPECS[p].n.includes(q));
  const on = S.cfg.pairs;
  const row = p => `<div class="prow"><span>${esc(SPECS[p].n)}<small>${esc(SPECS[p].title)}</small></span><button data-act="pair" data-v="${esc(p)}" class="${on.includes(p) ? 'on' : ''}">${on.includes(p) ? 'ON' : 'OFF'}</button></div>`;
  return `<div class="wrap"><div class="card"><h3>Pairs (${on.length}/${MAX_ON} ON)</h3><div class="note" style="margin-bottom:8px">सिर्फ़ ON वाले pair पर signal आएगा। Gold पर $0.25 सबसे आसान (spread ~$0.26 जोड़कर ~$0.51 का move चाहिए)।</div>
<input class="srch" id="srch" placeholder="खोजें: XAU, EUR…" value="${esc(S.q)}">
${on.length ? `<div style="margin-top:10px">${on.filter(p => SPECS[p]).map(row).join('')}</div>` : ''}
<div style="margin-top:10px">${list.filter(p => !on.includes(p)).map(row).join('')}</div></div></div>`;
}
function statBlock(title, list){
  const today = dayKey(Date.now()), all = stats(list), td = stats(list.filter(x => dayKey(x.at) === today));
  const tiles = s => `<div class="tiles"><div class="tile">Trades<b>${s.n}</b></div><div class="tile">Win %<b class="${s.n ? (s.wr >= 86 ? 'up' : s.wr >= 60 ? 'gd' : 'dn') : ''}">${s.n ? s.wr + '%' : '—'}</b></div><div class="tile">W / L<b>${s.win} / ${s.loss}</b></div><div class="tile">Net $<b class="${s.net > 0 ? 'up' : s.net < 0 ? 'dn' : ''}">${s.n ? usd(s.net) : '—'}</b></div></div>`;
  return `<div class="card"><h3>${title}</h3><div class="lbl">आज</div>${tiles(td)}<div class="lbl" style="margin-top:10px">कुल</div>${tiles(all)}</div>`;
}
function recTab(){
  const realDone = S.real.filter(r => r.status === 'CLOSED' && isFinite(r.pl)).map(r => ({at: r.at, pl: +r.pl}));
  const paperDone = S.paper.filter(p => p.done && isFinite(p.pl));
  const rRow = r => `<div class="hrow"><div><b class="${r.dir === 'BUY' ? 'up' : 'dn'}">${esc(SPECS[r.sym] ? SPECS[r.sym].n : r.sym)} ${r.dir}</b> · ${r.tf}m · ${hm(r.next)}${r.acct ? ` · ${r.real ? 'REAL' : 'DEMO'} ${esc(r.acct)}` : ''}<small>${esc((ST_TXT[r.status] || [r.status])[0])}${r.res ? ' · ' + esc(r.res) : ''}${r.msg && r.status !== 'CLOSED' ? ' · ' + esc(String(r.msg).slice(0, 80)) : ''}</small></div><div class="r ${isFinite(r.pl) ? (+r.pl > 0 ? 'up' : +r.pl < 0 ? 'dn' : '') : 'gd'}">${isFinite(r.pl) && r.pl !== undefined ? usd(+r.pl) : OPEN_ST.includes(r.status) ? '…' : '—'}</div></div>`;
  const pRow = p => `<div class="hrow"><div><b class="${p.dir === 'BUY' ? 'up' : 'dn'}">${esc(SPECS[p.sym] ? SPECS[p.sym].n : p.sym)} ${p.dir}</b> · ${p.tf}m · ${hm(p.next)}${p.auto ? ' · auto' : ''}<small>${p.done ? esc(p.res) : 'चल रहा है'}${p.entry ? ' · entry ' + fmt(p.sym, p.entry) : ''}</small></div><div class="r ${p.done && isFinite(p.pl) ? (p.pl > 0 ? 'up' : p.pl < 0 ? 'dn' : '') : 'gd'}">${p.done && isFinite(p.pl) ? usd(p.pl) : '…'}</div></div>`;
  return `<div class="wrap">
${statBlock('🚀 Real (MT5 · EA का नतीजा)', realDone)}
${statBlock('📝 Paper (candle OHLC से)', paperDone)}
<div class="note">Break-even के लिए चाहिए: TP $0.25 / SL $1.50 → सिर्फ़ TP-SL हो तो ~86% win; candle close पर छोटे loss से कम। Win % हरा = 86%+, सुनहरा = 60–85%।</div>
<div class="card"><h3>🚀 Real trades</h3>${S.real.length ? S.real.slice(0, 40).map(rRow).join('') : '<div class="empty">अभी कोई real trade नहीं</div>'}
<button class="btn ghost" data-act="refreal" style="width:100%;margin-top:10px">↻ EA से नतीजा लाओ</button></div>
<div class="card"><h3>📝 Paper trades</h3>${S.paper.length ? S.paper.slice(0, 60).map(pRow).join('') : '<div class="empty">अभी कोई paper trade नहीं — signal पर 📝 Paper दबाएँ या Auto Paper ON करें</div>'}
${S.paper.length ? '<button class="btn ghost" data-act="clrpaper" style="width:100%;margin-top:10px">🗑 Paper record साफ़ करें</button>' : ''}</div>
</div>`;
}
function setTab(){
  const tg = (act, on, t, sub) => `<div class="tg"><span>${t}<small>${sub}</small></span><button data-act="${act}" class="${on ? 'on' : ''}">${on ? 'ON' : 'OFF'}</button></div>`;
  return `<div class="wrap"><div class="card"><h3>Setting</h3>
${tg('auto', S.cfg.autoPaper, '📝 Auto Paper', 'हर BUY / SELL signal अपने आप paper में')}
${tg('confirm', S.cfg.confirm, '🚀 MT5 से पहले पूछो', 'OFF = एक tap में सीधा भेजो (तेज़)')}
${tg('sound', S.cfg.sound, '🔔 आवाज़ + vibrate', 'नया signal आने पर')}</div>
<div class="card"><h3>Strategy 5 — नियम</h3><div class="note">
• Signal: बंद candle मज़बूत (body ≥ पिछली 10 की average × ${DEF.bodyMult}, body ≥ candle का ${DEF.bodyPct * 100}%) + EMA ${DEF.fast} / ${DEF.slow} की दिशा + close EMA ${DEF.fast} के उस पार + RSI ${DEF.rsiLen} (BUY ${DEF.buyRsi[0]}–${DEF.buyRsi[1]}, SELL ${DEF.sellRsi[0]}–${DEF.sellRsi[1]})।<br>
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
document.addEventListener('click', e => { audio(); const b = e.target.closest('[data-act]'); if(b && !b.disabled) act(b.dataset.act, b.dataset.v) });
document.addEventListener('input', e => { if(e.target.id === 'srch'){ S.q = e.target.value; const pos = e.target.selectionStart; $('main').innerHTML = pairsTab(); const i = $('srch'); i.focus(); try{ i.setSelectionRange(pos, pos) }catch(x){} } });
function act(a, v){
  if(a === 'tab'){ S.tab = v; S.q = ''; repaint(); if(v === 'rec') refreshReal(true); return }
  if(a === 'tf'){ S.cfg.tf = +v === 5 ? 5 : 1; saveCfg(); S.sig = {}; repaint(); poll(); return }
  if(a === 'auto'){ S.cfg.autoPaper = !S.cfg.autoPaper; saveCfg(); repaint(); toast(S.cfg.autoPaper ? '📝 Auto Paper ON' : 'Auto Paper OFF'); return }
  if(a === 'confirm'){ S.cfg.confirm = !S.cfg.confirm; saveCfg(); repaint(); return }
  if(a === 'sound'){ S.cfg.sound = !S.cfg.sound; saveCfg(); repaint(); if(S.cfg.sound) beep(); return }
  if(a === 'pair'){
    const on = S.cfg.pairs;
    if(on.includes(v)) S.cfg.pairs = on.filter(p => p !== v);
    else{ if(on.length >= MAX_ON) return toast(`ज़्यादा से ज़्यादा ${MAX_ON} pair ON`); S.cfg.pairs = on.concat(v) }
    saveCfg(); delete S.sig[v]; $('main').innerHTML = pairsTab(); render(); poll(); return;
  }
  if(a === 'mt5') return onMt5(v);
  if(a === 'paper'){ const sg = S.sig[v]; if(sg && sg.dir !== 'NO'){ addPaper(v, sg, false); repaint() } return }
  if(a === 'refreal'){ refreshReal(true).then(() => toast('↻ ताज़ा किया')); return }
  if(a === 'clrpaper'){ dlg('Paper record साफ़ करें?', '<div class="note">सारे paper trade हट जाएँगे (real नहीं)।</div>', 'हटाओ', 'Cancel').then(ok => { if(ok){ S.paper = []; savePaper(); repaint() } }); return }
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
  render(); poll(); refreshReal();
  setInterval(tick, 1000);
  setInterval(refreshReal, 10000);
  const wake = () => { try{ if('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {}) }catch(e){} };   /* screen on rahe */
  document.addEventListener('visibilitychange', () => { if(!document.hidden){ wake(); poll() } });
  wake();
}
boot();
