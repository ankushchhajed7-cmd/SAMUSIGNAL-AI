/* NEWS SIGNAL v1.0.0 — alag page (news.html). SAMUSIGNAL AI ke baaki app ko chhoota nahi:
   sirf data.js se keys + bhaav PADHTA hai. Apni cheezein localStorage me "sai_news_*" me.
   v1: calendar free (Forex Factory feed), ASLI number tum daalte ho (Enter) — signal usi second.
   Auto number / band-app phone alert ke liye server chahiye (v2). */
import {keys, quotes, series, feedStatus, LS, fbUrl} from './data.js';
import {PAIRS, rules, evaluate, grade, summary, polarity, tradeable, DEF_TGT, usdOf, tpPrice, scanTp, takeSummary} from './newsrules.js';

export const NEWS_VERSION = '1.3.0';
const FF = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const MIN = 60000;
const $ = s => document.querySelector(s);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const S = {
  tab: 'live', cal: [], calSrc: '', calAt: 0, calErr: '',
  manual: LS.get('news_manual', []), fired: LS.get('news_fired', []),
  cfg: Object.assign({sound: true, medium: false, lot: 0.01, tgt: Object.assign({}, DEF_TGT)}, LS.get('news_cfg', {})),
  tapes: {}, paper: {}, paperAt: 0,     /* v1.3.0: VPS (News Pusher v1.03) ke auto paper trade — app band ho tab bhi */
  now: Date.now(), stage: '', beep: '', feed: null, wake: null, resolving: false,
  act: {}, mt5At: 0, es: null, esOk: false, polling: false     /* v1.1.0: MT5 News Pusher se asli number */
};
const saveFired = () => { S.fired = S.fired.slice(0, 200); LS.set('news_fired', S.fired) };
const saveManual = () => LS.set('news_manual', S.manual);
const saveCfg = () => LS.set('news_cfg', S.cfg);

/* ---------- time helpers (IST) ---------- */
const IST = {timeZone: 'Asia/Kolkata'};
const hm = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour: '2-digit', minute: '2-digit', hour12: false});
const dayKey = t => new Date(t).toLocaleDateString('en-CA', IST);
const dayLbl = t => { const k = dayKey(t), n = dayKey(Date.now()); return k === n ? 'Aaj' : k === dayKey(Date.now() + 864e5) ? 'Kal' : new Date(t).toLocaleDateString('en-GB', {...IST, day: '2-digit', month: 'short'}) };
function fmtCd(ms){
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m ${String(x).padStart(2, '0')}s` : m ? `${m}m ${String(x).padStart(2, '0')}s` : `${x}s`;
}
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` };

/* ---------- calendar ---------- */
/* v1.1.0: pehle MT5 calendar (VPS ka News Pusher EA, /feed/news/cal) — asli number bhi isi se */
async function loadMt5Cal(){
  const u = fbUrl(keys(), 'feed/news/cal'); if(!u) return false;
  try{
    const r = await fetch(u, {cache: 'no-store'}); if(!r.ok) return false;
    const j = await r.json();
    if(!j || !Array.isArray(j.list) || !j.list.length || Date.now() - j.at * 1000 > 40 * MIN) return false;
    S.cal = j.list.map(x => ({mt5: true, vid: String(x.id), title: x.title, country: x.cur || 'USD', date: new Date(x.t * 1000).toISOString(), impact: x.imp, kind: x.kind,
      forecast: x.fc || '', previous: x.pv || '', actual: x.act || ''}));
    S.calAt = j.at * 1000; S.calSrc = 'MT5'; S.calErr = ''; S.mt5At = Date.now(); return true;
  }catch(e){ return false }
}
async function loadCal(force){
  if(await loadMt5Cal()) return;
  const c = LS.get('news_cal', null);
  if(!force && c && Date.now() - c.at < 30 * MIN){ S.cal = c.list; S.calAt = c.at; S.calSrc = 'cache'; return }
  const tries = [['direct', FF], ['proxy', 'https://api.allorigins.win/raw?url=' + encodeURIComponent(FF)], ['proxy2', 'https://corsproxy.io/?' + encodeURIComponent(FF)]];
  for(const [name, u] of tries){
    try{
      const r = await fetch(u, {cache: 'no-store'}); if(!r.ok) continue;
      const j = await r.json();
      if(Array.isArray(j) && j.length){ S.cal = j; S.calAt = Date.now(); S.calSrc = name; S.calErr = ''; LS.set('news_cal', {at: S.calAt, list: j}); return }
    }catch(e){}
  }
  if(c){ S.cal = c.list; S.calAt = c.at; S.calSrc = 'purana'; S.calErr = 'Naya calendar nahi mila — purana dikha rahe hain'; return }
  S.calErr = 'Calendar nahi mila — Setting me haath se news jodo';
}
function evList(){
  const out = [];
  S.cal.forEach(c => {
    if(c.country !== 'USD') return;
    if(!(c.impact === 'High' || (S.cfg.medium && c.impact === 'Medium'))) return;
    const t = Date.parse(c.date); if(!isFinite(t)) return;
    out.push({id: c.mt5 ? 'm5|' + c.vid : 'c|' + c.title + '|' + t, vid: c.vid, mt5: !!c.mt5, kind: c.kind, title: c.title, t, impact: c.impact, forecast: c.forecast || '', previous: c.previous || '', actual: c.actual || ''});
  });
  S.manual.forEach(m => out.push(m));
  return out.sort((a, b) => a.t - b.t);
}
const firedBy = id => S.fired.find(r => r.id === id);
function nextEv(){
  const now = Date.now();
  return evList().find(e => !firedBy(e.id) && e.t > now - 30 * MIN && tradeable(e)) || null;
}

/* ---------- v1.1.0: asli number apne aap (MT5 News Pusher -> Firebase /feed/news/act) ---------- */
function gotAct(vid, a){
  if(!a || !a.act) return;
  S.act[vid] = a;
  const ev = evList().find(e => e.vid === vid);
  if(ev && !firedBy(ev.id) && tradeable(ev) && Date.now() - (a.seen || ev.t / 1000) * 1000 < 30 * MIN) fire(ev, a.act, a);
}
function stream(){
  const u = fbUrl(keys(), 'feed/news/act'); if(!u || !window.EventSource || S.es) return;
  try{
    const es = new EventSource(u); S.es = es;
    const on = e => { S.esOk = true; try{ const m = JSON.parse(e.data); if(!m) return;
      if(m.path === '/'){ Object.entries(m.data || {}).forEach(([k, v]) => gotAct(k, v)) }
      else { const k = m.path.split('/')[1]; if(k) gotAct(k, m.path.split('/').length > 2 ? Object.assign({}, S.act[k], m.data) : m.data) } }catch(x){} };
    es.addEventListener('put', on); es.addEventListener('patch', on);
    es.onerror = () => { S.esOk = false; es.close(); S.es = null; setTimeout(stream, 5000) };
  }catch(e){ S.es = null }
}
/* stream na chale to: release ke aas-paas har 1.5 sec seedha poochho */
async function poll(){
  if(S.polling) return; const ev = nextEv(), now = Date.now();
  if(!ev || !ev.vid || ev.t - now > 5000 || now - ev.t > 10 * MIN || (S.esOk && now - ev.t > 20000)) return;
  S.polling = true;
  try{ const r = await fetch(fbUrl(keys(), 'feed/news/act/' + ev.vid), {cache: 'no-store'}); if(r.ok) gotAct(ev.vid, await r.json()) }catch(e){}
  finally{ S.polling = false }
}

/* ---------- sound / alert / screen ---------- */
let AC = null;
function audio(){ try{ AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if(AC.state === 'suspended') AC.resume() }catch(e){} }
function beep(f = 660, d = 0.12){
  if(!S.cfg.sound) return;
  try{ audio(); const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.16; o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d) }catch(e){}
}
async function notify(title, body){
  try{ if(navigator.vibrate) navigator.vibrate([250, 120, 250]) }catch(e){}
  try{
    if(!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if(reg) reg.showNotification(title, {body, icon: 'icon-192.png', tag: 'news-signal'}); else new Notification(title, {body});
  }catch(e){}
}
async function wakeToggle(){
  try{
    if(S.wake){ await S.wake.release(); S.wake = null; return toast('Screen jagaye rakhna band') }
    if(!navigator.wakeLock) return toast('Is browser me Keep-awake nahi');
    S.wake = await navigator.wakeLock.request('screen'); S.wake.addEventListener('release', () => { S.wake = null; render() }); toast('Screen jaagta rahega');
  }catch(e){ toast('Keep-awake nahi chala') }
}
document.addEventListener('visibilitychange', async () => { if(document.visibilityState === 'visible' && S.wake === null && S.wantWake){ try{ S.wake = await navigator.wakeLock.request('screen') }catch(e){} } });
function toast(m){ const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => { t.style.display = 'none' }, 3200) }

/* ---------- fire (number aate hi) ---------- */
async function fire(ev, a, auto){
  if(firedBy(ev.id)) return;
  const fc = auto && auto.fc ? auto.fc : ev.forecast;
  const r = evaluate(Object.assign({}, ev, {forecast: fc}), a, auto ? {mi: auto.mi} : {});
  if(!r.ok){ if(!auto) toast(r.why); return }
  const now = Date.now(), seen = auto && auto.seen ? auto.seen * 1000 : 0;
  const rec = {id: ev.id, title: ev.title, t: ev.t, firedAt: seen && now - seen < 2 * MIN ? seen : now, gotAt: now, seen, src: auto ? 'mt5' : 'hand',
    actual: String(a).trim(), forecast: fc, previous: auto && auto.pv ? auto.pv : ev.previous, test: !!ev.test,
    flat: r.flat, usd: r.usd, conf: r.conf, conv: r.conv, mtOnly: !!r.mtOnly, tape: auto && auto.tape ? String(auto.tape) : '',
    sigs: r.sigs.map(s => ({sym: s.sym, name: s.name, dir: s.dir, entry: null, p5: null, p30: null, g5: null, g30: null, res: null}))};
  if(auto && auto.px) rec.sigs.forEach(s => { const v = +auto.px[s.name]; if(v > 0){ s.entry = v; s.es = 'mt5' } });   /* MT5 ne number dekha usi pal ka bhaav */
  S.fired.unshift(rec); saveFired(); S.stage = ''; render(); setTimeout(resolve, 1500);
  beep(990, 0.25); setTimeout(() => beep(1320, 0.25), 300);
  notify(rec.flat ? 'NO TRADE — ' + rec.title : rec.sigs.map(s => s.name + ' ' + s.dir).join(' · '), `${rec.title}: ${rec.actual} vs ${rec.forecast}`);
  if(rec.flat || rec.sigs.every(s => s.entry !== null)) return;
  try{
    const q = await quotes(keys(), PAIRS.map(p => p.sym), true);
    rec.sigs.forEach(s => { if(s.entry === null && q[s.sym] && q[s.sym].p > 0) s.entry = q[s.sym].p });
    saveFired(); render();
  }catch(e){}
}

/* ---------- v1.2.0: 🤖 AUTO paper trade — har signal apne aap (MT5 bhaav pe), 1 min exit · $ target · 5 min. MT5 pe koi order nahi ---------- */
const PXD = sym => sym === 'XAU/USD' ? 2 : 5;
async function getTape(key){
  if(!key) return null;
  const c = S.tapes[key]; if(c && (c.n >= 361 || Date.now() - c.at < 4000)) return c;
  try{
    const r = await fetch(fbUrl(keys(), 'feed/news/tape/' + key), {cache: 'no-store'}); if(!r.ok) return c || null;
    const j = await r.json(); if(!j || !j.t0) return c || null;
    const t = {t0: j.t0 * 1000, n: j.n || 0, at: Date.now()};
    PAIRS.forEach(p => { t[p.sym] = String(j[p.name] || '').split(',').map(Number) });
    return (S.tapes[key] = t);
  }catch(e){ return c || null }
}
const tapeAt = (tp, sym, T) => { if(!tp || !tp[sym]) return null; const i = Math.round((T - tp.t0) / 1000), v = tp[sym][i]; return i >= 0 && v > 0 ? v : null };
function barAt(b, T){ const x = b.filter(k => k.t <= T).pop(); return x && T - x.t < 2 * MIN ? (T - x.t < 30000 ? x.o : x.c) : null }
async function resolveTakes(now, bars){
  let ch = false;
  for(const rec of S.fired){
    for(const s of rec.sigs || []){
      if(!s.take && !rec.flat && (s.dir === 'BUY' || s.dir === 'SELL') && s.entry > 0 && now - rec.firedAt < 8 * 3600e3 && !(S.paper[vidOf(rec)] && now - rec.firedAt > 20000)){   /* signal = trade (VPS ka ho to wahi) */
        const tgt = S.cfg.tgt && S.cfg.tgt[s.sym] > 0 ? S.cfg.tgt[s.sym] : DEF_TGT[s.sym], lot = S.cfg.lot > 0 ? S.cfg.lot : 0.01;
        s.take = {auto: true, at: rec.firedAt, px: s.entry, lot, tgt, tp: tpPrice(s.sym, s.dir, s.entry, lot, tgt), delay: Math.round((rec.firedAt - rec.t) / 1000)}; ch = true;
      }
      const t = s.take; if(!t || t.done) continue;
      const tp = await getTape(rec.tape);
      const px = async T => { const v = tapeAt(tp, s.sym, T); if(v) return v; try{ return barAt(await bars(s.sym), T) }catch(e){ return null } };
      if(t.u1 === undefined && now >= t.at + 62000){ const v = await px(t.at + 60000); if(v){ t.p1 = v; t.u1 = usdOf(s.sym, s.dir, t.px, v, t.lot); ch = true } }
      if(t.u5 === undefined && now >= t.at + 5 * MIN + 5000){ const v = await px(t.at + 5 * MIN); if(v){ t.p5 = v; t.u5 = usdOf(s.sym, s.dir, t.px, v, t.lot); ch = true } }
      if(t.uT === undefined && t.tp){
        const pts = [];
        if(tp && tp[s.sym]) tp[s.sym].forEach((v, i) => { const T = tp.t0 + i * 1000; if(v > 0 && T > t.at && T <= t.at + 30 * MIN) pts.push({t: T, h: v, l: v}) });
        const tapeEnd = tp ? tp.t0 + (tp[s.sym] || []).length * 1000 : t.at;
        try{ (await bars(s.sym)).forEach(k => { if(k.t >= Math.max(t.at, tapeEnd) && k.t < t.at + 30 * MIN) pts.push({t: k.t + 30000, h: k.h, l: k.l}) }) }catch(e){}
        const hit = scanTp(s.dir, t.tp, pts);
        if(hit){ t.hit = Math.max(1, Math.round((hit - t.at) / 1000)); t.uT = t.tgt; ch = true }
        else if(now >= t.at + 31 * MIN){ const v = await px(t.at + 30 * MIN); if(v){ t.p30 = v; t.uT = usdOf(s.sym, s.dir, t.px, v, t.lot); ch = true } }
      }
      if(t.u1 !== undefined && t.u5 !== undefined && t.uT !== undefined){ t.done = true; ch = true }
    }
  }
  return ch;
}
/* ---------- v1.3.0: VPS ke paper trade (/feed/news/paper) ---------- */
async function loadPaper(){
  const u = fbUrl(keys(), 'feed/news/paper'); if(!u) return;
  try{ const r = await fetch(u, {cache: 'no-store'}); if(!r.ok) return; const j = await r.json(); S.paper = j && typeof j === 'object' ? j : {}; S.paperAt = Date.now() }catch(e){}
}
const vidOf = rec => rec && typeof rec.id === 'string' && rec.id.startsWith('m5|') ? rec.id.slice(3) : '';
const num = v => typeof v === 'number' ? v : undefined;
/* VPS wala sig -> app ke take jaisa */
function srvTake(p, k){
  const g = p && p.sigs && p.sigs[k]; if(!g) return null;
  return {srv: true, px: g.entry, lot: g.lot, tgt: g.tgt, tp: g.tp, u1: num(g.u1), u5: num(g.u5), uT: num(g.uT), hit: g.hit || 0, delay: p.at && p.t ? p.at - p.t : null};
}
/* VPS ke paper jo is phone ki History me nahi (phone band tha) -> rec jaisa */
function srvRecs(){
  const have = new Set(S.fired.map(vidOf).filter(Boolean));
  return Object.entries(S.paper || {}).filter(([v]) => !have.has(v)).map(([v, p]) => ({id: 'm5|' + v, srvOnly: true, src: 'mt5', title: p.title, t: (p.t || 0) * 1000, firedAt: (p.at || p.t || 0) * 1000,
    actual: p.act, forecast: p.fc, previous: p.pv, conf: p.conf, conv: '', flat: false,
    sigs: Object.entries(p.sigs || {}).map(([k, g]) => ({sym: k === 'XAUUSD' ? 'XAU/USD' : k === 'EURUSD' ? 'EUR/USD' : k, name: k, dir: g.dir, res: null, g5: null, g30: null}))}));
}
const usd$ = v => typeof v === 'number' ? `<b class="${v > 0 ? 'WIN' : v < 0 ? 'LOSS' : ''}">${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}</b>` : '<i>…</i>';
function takeLine(rec, s){
  const sp = S.paper[vidOf(rec)], t = srvTake(sp, s.name) || s.take; if(!t) return '';
  return `<div class="tkl">${t.srv ? '🖥 VPS' : '🤖'} Auto @${t.px} · ${t.lot} lot · TP ${t.tp ? t.tp.toFixed(PXD(s.sym)) : '—'} ($${t.tgt})<br>
    ⏱ 1m: ${usd$(t.u1)} · 🎯 $${t.tgt}: ${t.hit ? `<b class="WIN">TP ${t.hit < 60 ? t.hit + 's' : Math.round(t.hit / 60) + 'm'}</b>` : t.uT !== undefined ? usd$(t.uT) + ' <small>(30m)</small>' : '<i>…</i>'} · 5m: ${usd$(t.u5)}</div>`;
}

/* ---------- nateeja (5 min / 30 min) — 1-min candles se, page band ho tab bhi agli baar bhar jaata hai ---------- */
async function resolve(){
  if(S.resolving) return; S.resolving = true;
  try{
    const now = Date.now(), cache = {};
    const bars = async sym => cache[sym] || (cache[sym] = (await series(keys(), sym, '1min', 500)).bars);
    const px = (b, t) => { const x = b.find(k => k.t >= t); return x && x.t - t < 2 * MIN ? x.o : null };   /* t ke baad pehli 1-min candle ka open */
    let changed = false;
    for(const rec of S.fired){
      if(rec.flat || now - rec.firedAt > 2 * 864e5) continue;
      for(const s of rec.sigs){
        if(s.dir !== 'BUY' && s.dir !== 'SELL') continue;
        const need5 = s.p5 === null && now >= rec.firedAt + 6 * MIN, need30 = s.p30 === null && now >= rec.firedAt + 31 * MIN, needE = s.entry === null;
        if(!(need5 || need30 || (needE && now > rec.firedAt + MIN))) continue;
        try{
          const b = await bars(s.sym);
          if(needE){ const x = b.filter(k => k.t <= rec.firedAt).pop(); if(x){ s.entry = x.o; s.es = 'bar'; changed = true } }
          if(need5){ const v = px(b, rec.firedAt + 5 * MIN); if(v !== null){ s.p5 = v; changed = true } }
          if(need30){ const v = px(b, rec.firedAt + 30 * MIN); if(v !== null){ s.p30 = v; changed = true } }
          if(s.entry !== null){
            if(s.p5 !== null){ const g = grade(s.sym, s.dir, s.entry, s.p5); if(g){ s.g5 = g.pips; s.res = g.res } }
            if(s.p30 !== null){ const g = grade(s.sym, s.dir, s.entry, s.p30); if(g) s.g30 = g.pips }
          }
        }catch(e){}
      }
    }
    if(await resolveTakes(now, bars)) changed = true;
    if(changed){ saveFired(); render() }
  }finally{ S.resolving = false }
}

/* ---------- screens ---------- */
const dirCls = d => d === 'BUY' ? 'BUY' : d === 'SELL' ? 'SELL' : 'NO';
function ruleCard(ev){
  const r = rules(ev.title); if(!r) return ev.kind === 'ind' ? '<div class="note">Is news ka hamara rule nahi — MT5 ka apna andaza (number aate hi) chalega.</div>' : '';
  const box = (lbl, key) => {
    const ds = [...new Set(r.map(x => x[key]))], cls = ds.length === 1 ? ds[0] : 'MIX';
    return `<div class="rb ${cls}"><small>${lbl}</small><div>${r.map(x => `${esc(x.name)} → ${x[key]}`).join('<br>')}</div></div>`;
  };
  return `<div class="rg">${box('Agar forecast se <b>zyada</b> aaya', 'higher')}${box('Agar forecast se <b>kam</b> aaya', 'lower')}</div>`;
}
function nextCard(ev){
  const left = ev.t - Date.now(), imp = ev.impact === 'High' ? 'hi' : 'md';
  const meta = `Forecast <b class="mono">${esc(ev.forecast || '—')}</b> · Previous <b class="mono">${esc(ev.previous || '—')}</b>`;
  if(left > 0) return `<div class="card nx"><span class="badge y">NEXT NEWS</span> <span class="badge ${imp}">${esc(ev.impact)} impact</span>
    <div class="ev">🇺🇸 ${esc(ev.title)}</div><div class="sub">${dayLbl(ev.t)} ${hm(ev.t)} IST · ${meta}</div>
    <div class="cd mono" id="cd">${fmtCd(left)}</div>${ruleCard(ev)}
    <div class="note">${ev.mt5 ? '📡 MT5 se asli number <b>apne aap</b> aayega — signal usi second. Page khula rakho.' : 'Release ke time number aate hi yahan daalo — signal usi second.'} Pehle se rule upar dikh raha hai.</div></div>`;
  return `<div class="card rel"><span class="badge y">● RELEASING NOW</span> <span class="badge ${imp}">${esc(ev.impact)} impact</span>
    <div class="ev">🇺🇸 ${esc(ev.title)}</div><div class="sub">${meta}</div>
    <div class="cd mono" id="cd">+${Math.floor(-left / 1000)}s</div><div class="sub">${ev.mt5 ? '📡 MT5 se number ka intezaar… (na aaye to khud daalo)' : 'release ko ho gaye — asli number daalo'}</div>
    <div class="actrow"><input id="act" inputmode="decimal" autocomplete="off" placeholder="Actual" enterkeyhint="go"><button class="btn gold" data-act="fire">SIGNAL</button></div>
    ${ruleCard(ev)}<div class="note">Sirf number likho (jaise 0.4 ya 227) — % / K apne aap forecast jaisa lag jaata hai.</div></div>`;
}
function resTxt(s, k){
  const pips = s['g' + k], p = s['p' + k];
  if(p === null || pips === null) return '<i>measuring…</i>';
  const g = grade(s.sym, s.dir, s.entry, p);
  return `${pips > 0 ? '+' : ''}${pips}p ${g ? g.res : ''}`;
}
function sigCard(r){
  const age = Date.now() - r.firedAt, lag = Math.round((r.firedAt - r.t) / 1000);
  const main = r.flat ? 'NO' : dirCls(r.sigs[0].dir), why = r.flat ? 'Actual forecast ke barabar — koi surprise nahi, trade nahi.' :
    `${r.title}: actual ${r.actual} vs forecast ${r.forecast} → USD ${r.usd > 0 ? 'mazboot' : 'kamzor'}${r.mtOnly ? ' (MT5 ka andaza)' : ''} → ${r.sigs.map(s => s.name + ' ' + s.dir).join(', ')}. Confidence sirf rule-based andaza hai (surprise jitna bada utna zyada), guarantee nahi.`;
  return `<div class="sig ${main}"><div class="top"><i></i>${r.test ? 'TEST ' : ''}LIVE SIGNAL<span style="flex:1"></span><span class="ago mono" data-t="${r.firedAt}">${Math.round(age / 1000)}s ago</span></div>
    ${r.flat ? '<div class="dir">NO TRADE</div>' : `<div class="dir">${esc(r.sigs[0].dir === r.sigs[1].dir ? r.sigs[0].dir : 'MIXED')}</div>`}
    ${r.sigs.filter(s => !r.flat).map(s => `<div class="prow"><span>${esc(s.name)}</span><span class="d">${s.dir}</span><span class="m mono">5m: ${resTxt(s, 5)}<br>30m: ${resTxt(s, 30)}</span></div>${takeLine(r, s)}`).join('')}
    <div class="conf mono">${r.conf}% <small>confidence</small></div><span class="mtag">${r.conv} CONVICTION</span>
    <div class="ln"><b>${esc(r.title)}</b> ${esc(r.actual)} vs ${esc(r.forecast)} forecast · previous ${esc(r.previous || '—')}</div>
    <div class="ln mono">${r.src === 'mt5' ? `📡 MT5 auto · release ke ${lag}s baad · phone tak ${Math.max(0, Math.round((r.gotAt - r.seen) / 100) / 10)}s` : `✍️ haath se · release ke ${lag}s baad`} · screen pe <span class="rem" data-t="${r.firedAt}">${mmss(30 * MIN - age)}</span> aur</div>
    <details><summary>Kyun ${r.flat ? 'NO TRADE' : esc(r.sigs[0].dir)}?</summary><p>${esc(why)}</p></details></div>`;
}
function liveTab(){
  const act = S.fired.filter(r => Date.now() - r.firedAt < 30 * MIN), ev = nextEv();
  let h = `<div class="tools">
    <button data-act="fs"><b>⛶</b>Full-screen</button><button data-act="snd"><b>${S.cfg.sound ? '🔊' : '🔇'}</b>Sound test</button>
    <button data-act="wake" class="${S.wake ? 'on' : ''}"><b>☾</b>Keep awake</button><button data-act="alert"><b>🔔</b>Alerts</button></div><div class="wrap">`;
  act.forEach(r => { h += sigCard(r) });
  if(ev) h += nextCard(ev);
  else if(!act.length) h += `<div class="card empty">Abhi koi aane wali High-impact USD news nahi mili.<br>Setting me <b>TEST news (30 sec)</b> se pura flow aazma sakte ho.</div>`;
  return h + '</div>';
}
function todayTab(){
  const now = Date.now(), list = evList().filter(e => e.t > now - 8 * 3600e3 && e.t < now + 40 * 3600e3);
  if(!list.length) return `<div class="wrap"><div class="card empty">${esc(S.calErr || 'Aaj-kal koi High-impact USD news nahi.')}</div></div>`;
  return `<div class="wrap">${list.map(e => {
    const r = firedBy(e.id), pol = tradeable(e);
    let st = e.t > now ? `<span class="st go">in ${fmtCd(e.t - now)}</span>` : '<span class="st no">done</span>';
    if(r) st = r.flat ? '<span class="st no">NO TRADE</span>' : `<span class="st ${r.sigs[0].dir}">${r.sigs[0].dir}</span>`;
    else if(!pol) st = '<span class="st no">no trade</span>';
    return `<div class="row"><div class="tm"><b class="mono">${hm(e.t)}</b><small>${dayLbl(e.t)}</small></div>
      <div class="nm">🇺🇸 ${esc(e.title)}<small>F ${esc(e.forecast || '—')} · P ${esc(e.previous || '—')}${e.actual ? ' · <b>A ' + esc(e.actual) + '</b>' : ''}${pol ? '' : ' · speech / statement'}</small></div>${st}</div>`;
  }).join('')}</div>`;
}
function mineCard(){
  const loc = S.fired.filter(r => !S.paper[vidOf(r)]);
  const srv = Object.values(S.paper || {}).map(p => ({sigs: Object.keys(p.sigs || {}).map(k => ({take: srvTake(p, k)}))}));
  const m = takeSummary([...srv, ...loc]); if(!m.n) return '';
  const row = (lbl, g) => `<div class="mr"><span>${lbl}</span><span class="mono">${g.n} · ${g.rate === null ? '—' : g.rate + '% jeet'} · ${usd$(g.n ? g.usd : null)}</span></div>`;
  return `<div class="card mine"><h3>🤖 Auto trade का हिसाब (${m.n})</h3>${row('⏱ 1 min exit', m.m1)}${row('🎯 $ target (na aaya to 30m)', m.tgt)}${row('5 min exit', m.m5)}
    <div class="note">Har High news signal = ek paper trade — 🖥 VPS pe (app band ho tab bhi) MT5 ne number dekha usi pal ka bhaav. Target ${m.hits} baar poora hua · signal औसतन release ke ${m.delay === null ? '—' : m.delay + 's'} baad. 15–20 news ke baad dekhna kaunsa exit behtar. Spread / slippage shamil nahi. MT5 pe koi order nahi.</div></div>`;
}
function histTab(){
  const real = S.fired.filter(r => !r.test), sm = summary(S.fired);
  let h = `<div class="wrap"><div class="tiles"><div class="tile"><span class="lbl">WIN</span><b class="WIN">${sm.win}</b></div><div class="tile"><span class="lbl">LOSS</span><b class="LOSS">${sm.loss}</b></div>
    <div class="tile"><span class="lbl">FLAT</span><b class="FLAT">${sm.flat}</b></div><div class="tile"><span class="lbl">Win rate</span><b>${sm.rate === null ? '—' : sm.rate + '%'}</b></div></div>
    ${mineCard()}
    <div class="note">Nateeja = signal ke 5 min baad ki keemat entry se (WIN / LOSS / FLAT). Kam trade ho to win rate par bharosa mat karo — kam se kam 30+ signal dekho. Spread / slippage is ginti me shamil nahi.</div>`;
  const all = [...S.fired, ...srvRecs()].sort((a, b) => b.firedAt - a.firedAt);
  if(!all.length) return h + '<div class="card empty">Abhi koi signal nahi. Pehla signal yahan dikhega.</div></div>';
  h += all.map(r => `<div class="hrow"><div class="l1"><span>${r.test ? '🧪 ' : ''}${esc(r.title)}</span><span class="mono">${hm(r.firedAt)}</span></div>
    <div class="l2">${r.srvOnly ? '🖥 VPS (phone band tha) · ' : r.src === 'mt5' ? '📡 ' : ''}${dayLbl(r.firedAt)} · actual ${esc(r.actual)} vs forecast ${esc(r.forecast)} · ${r.flat ? 'NO TRADE' : r.conf + '%' + (r.conv ? ' ' + r.conv : '')}</div>
    ${r.flat ? '' : r.sigs.map(s => `<div class="pr"><span><b>${esc(s.name)}</b> ${s.dir}</span>${r.srvOnly ? '' : `<span class="mono ${s.res || ''}">${s.res ? (s.g5 > 0 ? '+' : '') + s.g5 + 'p ' + s.res : 'measuring…'}${s.g30 !== null ? ' · 30m ' + (s.g30 > 0 ? '+' : '') + s.g30 + 'p' : ''}</span>`}</div>${takeLine(r, s)}`).join('')}</div>`).join('');
  return h + `<button class="btn ghost" data-act="clrtest">TEST wale hatao</button>${real.length ? '' : ''}</div>`;
}
function setTab(){
  const f = S.feed;
  return `<div class="wrap">
  <div class="card"><h3>🧪 Poora flow aazmao</h3><div class="note" style="margin-top:0">30 second baad ek nakli news aayegi (Average Hourly Earnings, forecast 0.3%). Live tab par jao, countdown ke baad 0.4 likho — SELL aana chahiye.</div>
    <button class="btn gold" style="width:100%;margin-top:10px" data-act="test">TEST news (30 sec)</button></div>
  <div class="card"><h3>➕ Haath se news jodo</h3><div class="form"><input id="mt" placeholder="News ka naam (jaise CPI m/m)">
    <input id="mw" type="datetime-local"><div class="two"><input id="mf" placeholder="Forecast (0.3%)"><input id="mp" placeholder="Previous (0.2%)"></div>
    <button class="btn gold" data-act="addev">JODO</button></div><div class="note">Time apne phone ka (IST) lagta hai.</div></div>
  <div class="card"><h3>🤖 Auto paper trade — default</h3><div class="form"><div class="two"><input id="dL" inputmode="decimal" value="${S.cfg.lot || 0.01}" placeholder="Lot">
    <input id="dXT" inputmode="decimal" value="${(S.cfg.tgt || DEF_TGT)['XAU/USD']}" placeholder="Gold $"></div><input id="dET" inputmode="decimal" value="${(S.cfg.tgt || DEF_TGT)['EUR/USD']}" placeholder="EURUSD $">
    <button class="btn gold" data-act="defsave">SAVE</button></div><div class="note">Lot · Gold target $ · EURUSD target $ (0.01 lot par gold $10 = $10 chaal, EURUSD $3 = 30 pip). Naye signals par lagta hai.</div></div>
  <div class="card"><div class="tg"><span>Medium impact news bhi dikhao</span><button data-act="medium" class="${S.cfg.medium ? 'on' : ''}">${S.cfg.medium ? 'ON' : 'OFF'}</button></div>
    <div class="tg" style="margin-top:10px"><span>Awaaz (beep)</span><button data-act="soundcfg" class="${S.cfg.sound ? 'on' : ''}">${S.cfg.sound ? 'ON' : 'OFF'}</button></div>
    <div class="tg" style="margin-top:10px"><span>Calendar: ${esc(S.calSrc || '—')}${S.calAt ? ' · ' + hm(S.calAt) : ''}</span><button data-act="reload">Refresh</button></div>
    <div class="note">Bhaav: ${f ? (f.ok ? 'MT5 Data Feed chal raha' : esc(f.why || 'MT5 feed band') + ' — TwelveData key se') : '…'}</div></div>
  <div class="card"><h3>ℹ️ Kaise kaam karta hai</h3><div class="note" style="margin-top:0">USD ka data forecast se <b>zyada</b> = USD mazboot → XAUUSD aur EURUSD <b>SELL</b>. <b>Kam</b> = USD kamzor → <b>BUY</b>. (Unemployment / Claims me ulta.) Speech / statement par koi signal nahi.<br><br>
    <b>v1.1:</b> VPS pe <b>SamuSignal News Pusher</b> EA chal raha ho to calendar aur asli number MT5 se <b>apne aap</b> (📡) — signal usi second. EA band ho to Forex Factory calendar + number haath se.<br>
    MT5 News Pusher: ${S.calSrc === 'MT5' ? '✅ chal raha (' + hm(S.calAt) + ')' : '❌ data nahi mila'} · live: ${S.esOk ? '✅ jude hain' : '…'}<br>
    Page band ho to alert nahi aata — uske liye server chahiye.<br><b>v1.3:</b> 🖥 VPS (News Pusher v1.03) khud paper trade + phone push (MT5 app) — app band ho tab bhi; History me sab. <b>v1.2:</b> 🤖 har signal apne aap paper trade (MT5 order nahi): ⏱ 1 min exit, 🎯 $ target, 5 min ka nateeja (MT5 tape se har second ka bhaav).<br><br>
    Ye analysis hai, guarantee nahi. News ke second me spread / slippage bahut hota hai. Pehle demo par aazmao.<br><br>NEWS SIGNAL v${NEWS_VERSION}</div></div></div>`;
}
function render(){
  if(S.tab === 'live'){
    const keep = $('#act') ? $('#act').value : '';
    $('#main').innerHTML = liveTab();
    const i = $('#act'); if(i){ if(keep) i.value = keep; try{ i.focus() }catch(e){} }
  }else $('#main').innerHTML = S.tab === 'today' ? todayTab() : S.tab === 'hist' ? histTab() : setTab();
  const tabs = [['live', '⚡', 'LIVE'], ['today', '📅', 'AAJ'], ['hist', '📈', 'HISTORY'], ['set', '⚙️', 'SETTING']];
  $('#nav').innerHTML = tabs.map(t => `<button data-act="tab" data-v="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}"><b>${t[1]}</b>${t[2]}</button>`).join('');
  const f = S.feed;
  $('#chips').innerHTML = `<span class="pill ${f && f.ok ? 'ok' : keys().tdKey ? 'warn' : 'bad'}">${f && f.ok ? 'MT5 FEED' : keys().tdKey ? 'TWELVEDATA' : 'BHAAV NAHI'}</span>
    <span class="pill ${S.cal.length ? 'ok' : 'bad'}">${S.calSrc === 'MT5' ? '📡 MT5 AUTO' : S.cal.length ? 'CALENDAR (haath se)' : 'CALENDAR NAHI'}</span><span class="pill">IST ${hm(Date.now())}</span>`;
}

/* ---------- tick ---------- */
function tick(){
  const now = Date.now(), ev = nextEv();
  const stage = ev ? ev.id + (ev.t > now ? ':pre' : ':rel') : 'none';
  if(stage !== S.stage){ S.stage = stage; if(S.tab === 'live') render(); if(ev && ev.t <= now) beep(1100, 0.3) }
  if(ev && S.tab === 'live'){
    const cd = $('#cd'); if(cd) cd.textContent = ev.t > now ? fmtCd(ev.t - now) : '+' + Math.floor((now - ev.t) / 1000) + 's';
    const sec = Math.ceil((ev.t - now) / 1000), key = ev.id + sec;
    if(ev.t > now && [10, 3, 2, 1].includes(sec) && S.beep !== key){ S.beep = key; beep(sec <= 3 ? 880 : 660, 0.1) }
  }
  document.querySelectorAll('.ago').forEach(e => { e.textContent = Math.round((now - +e.dataset.t) / 1000) + 's ago' });
  document.querySelectorAll('.rem').forEach(e => { e.textContent = mmss(30 * MIN - (now - +e.dataset.t)) });
  if(S.tab === 'live' && S.fired.some(r => now - r.firedAt >= 30 * MIN && now - r.firedAt < 30 * MIN + 1500)) render();
}

/* ---------- actions ---------- */
document.addEventListener('pointerdown', audio, {once: true});
document.addEventListener('keydown', e => { if(e.key === 'Enter' && e.target && e.target.id === 'act') act('fire') });
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(b) act(b.dataset.act, b.dataset) });
function act(a, d){
  if(a === 'tab'){ S.tab = d.v; S.stage = ''; render(); if(d.v === 'hist') loadPaper().then(() => { if(S.tab === 'hist') render() }); return }
  if(a === 'fire'){ const ev = nextEv(), i = $('#act'); if(!ev || ev.t > Date.now()) return toast('Abhi release nahi hua'); if(!i || !i.value.trim()) return toast('Pehle number likho'); fire(ev, i.value); return }
  if(a === 'fs'){ try{ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() }catch(e){ toast('Full-screen nahi chala') } return }
  if(a === 'snd'){ audio(); const was = S.cfg.sound; S.cfg.sound = true; beep(880, 0.15); setTimeout(() => beep(1100, 0.15), 200); S.cfg.sound = was; toast('Awaaz aayi? Nahi aayi to phone ka volume / silent dekho'); return }
  if(a === 'soundcfg'){ S.cfg.sound = !S.cfg.sound; saveCfg(); render(); return }
  if(a === 'wake'){ S.wantWake = !S.wake; wakeToggle().then(render); return }
  if(a === 'alert'){
    if(!('Notification' in window)) return toast('Is browser me alert nahi');
    Notification.requestPermission().then(p => { toast(p === 'granted' ? 'Alert ON — page khula ho tab phone par aayega' : 'Alert ki ijazat nahi mili') }); return;
  }
  if(a === 'defsave'){ const l = parseFloat($('#dL').value), x = parseFloat($('#dXT').value), e = parseFloat($('#dET').value);
    S.cfg.lot = l > 0 ? l : 0.01; S.cfg.tgt = {'XAU/USD': x > 0 ? x : DEF_TGT['XAU/USD'], 'EUR/USD': e > 0 ? e : DEF_TGT['EUR/USD']}; saveCfg(); toast('Default save ho gaya'); return }
  if(a === 'medium'){ S.cfg.medium = !S.cfg.medium; saveCfg(); render(); return }
  if(a === 'reload'){ toast('Calendar la rahe hain…'); loadCal(true).then(() => { render(); toast(S.calErr || 'Calendar aa gaya') }); return }
  if(a === 'clrtest'){ S.fired = S.fired.filter(r => !r.test); saveFired(); render(); return }
  if(a === 'test'){
    const t = Date.now() + 30000;
    S.manual = S.manual.filter(m => !m.test); S.fired = S.fired.filter(r => !r.test);
    S.manual.push({id: 'test|' + t, title: 'TEST — Average Hourly Earnings m/m', t, impact: 'High', forecast: '0.3%', previous: '0.1%', test: true});
    saveManual(); saveFired(); S.tab = 'live'; S.stage = ''; render(); toast('30 sec me TEST news — 0.4 likhna'); return;
  }
  if(a === 'addev'){
    const title = $('#mt').value.trim(), w = $('#mw').value, t = Date.parse(w);
    if(!title || !isFinite(t)) return toast('Naam aur time dono chahiye');
    S.manual.push({id: 'm|' + t + '|' + title, title, t, impact: 'High', forecast: $('#mf').value.trim(), previous: $('#mp').value.trim()});
    S.manual = S.manual.filter(m => m.t > Date.now() - 2 * 864e5); saveManual(); S.tab = 'today'; render(); toast('News jud gayi'); return;
  }
}

/* ---------- start ---------- */
(async function(){
  S.manual = S.manual.filter(m => m.t > Date.now() - 2 * 864e5);
  render();
  await loadCal(false); S.stage = ''; render();
  try{ S.feed = await feedStatus(keys()) }catch(e){}
  render(); resolve();
  await loadPaper(); render();
  setInterval(() => loadPaper().then(() => { if(S.tab === 'hist' || S.fired.some(r => Date.now() - r.firedAt < 31 * MIN)) render() }), 20000);
  stream(); setInterval(poll, 1500);
  setInterval(tick, 250);
  setInterval(resolve, 30000);
  setInterval(() => { const now = Date.now(); if(S.fired.some(r => now - r.firedAt < 7 * MIN || (r.sigs || []).some(s => s.take && !s.take.done && now - s.take.at < 7 * MIN))) resolve() }, 5000);
  setInterval(async () => { try{ S.feed = await feedStatus(keys()) }catch(e){} }, 45000);
  setInterval(() => loadCal(false).then(() => { if(S.tab !== 'live') render() }), 5 * MIN);
})();
