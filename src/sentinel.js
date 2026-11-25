/* 🛡️ FX SENTINEL v1.0.0 — page (UI + scan loop). Niyam sentinelrules.js me.
   Page khula ho to: har nayi 15m candle ke 25 sec baad 8 pair scan -> score 75+ aur koi rok nahi = apne aap PAPER trade
   (BUY / SELL LIMIT, 60 min expiry, structure SL, TP = 1.8R). Har minute paper trade ka nateeja (TP / SL / TIME).
   Data: sirf MT5 Data Feed (Firebase /feed, 0 TwelveData credit). News: MT5 calendar (/feed/news/cal) + Forex Factory, Gemini + Google Search.
   MT5 par koi order NAHI jaata (Kadam 1 — pehle yahan parakhna). localStorage: sai_sen_* */
import {LS, keys, feedStatus, feedAllBars, quotes, fbUrl} from './data.js';
import {SPECS, fmt, pipUsd} from './symbols.js';
import {SEN_VERSION, SEN_PAIRS, CURS, M15, H1, DEF_CFG, AI_PROMPT, score, strength, closedOnly, evalTrade, stats, canOpen, session, parseCurBias} from './sentinelrules.js';

const MIN = 60e3;
const $ = id => document.getElementById(id);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const IST = {timeZone: 'Asia/Kolkata'};
const hm = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour: '2-digit', minute: '2-digit', hour12: false});
const dayKey = t => new Date(t).toLocaleDateString('en-CA', IST);
const dLbl = t => dayKey(t) === dayKey(Date.now()) ? 'आज' : new Date(t).toLocaleDateString('en-GB', {...IST, day: '2-digit', month: 'short'});
const nm = sym => SPECS[sym] ? SPECS[sym].n : sym;
const usd = v => (v >= 0 ? '+$' : '−$') + Math.abs(+v || 0).toFixed(2);
const ago = t => { const m = Math.round((Date.now() - t) / MIN); return m < 1 ? 'अभी' : m < 60 ? m + ' min पहले' : Math.round(m / 60) + ' घंटे पहले' };
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` };

const S = {
  tab: LS.get('sen_tab', 'radar'),
  cfg: Object.assign({}, DEF_CFG, {screenOn: true, notify: false}, LS.get('sen_cfg', {})),
  trades: LS.get('sen_trades', []),
  radar: LS.get('sen_radar', null),
  ai: LS.get('sen_ai', null), aiErr: '', aiBusy: false,
  events: [], calAt: 0, calSrc: '',
  feed: {ok: false, why: 'जाँच रहे हैं…'}, busy: false, err: '',
  lastScan: LS.get('sen_lastScan', 0), nextAt: 0, lastTick: 0, rates: {}, openD: {}, cs: LS.get('sen_cs', null)
};
const saveCfg = () => LS.set('sen_cfg', S.cfg);
const saveTrades = () => { if(S.trades.length > 400) S.trades = S.trades.filter(t => !t.done).concat(S.trades.filter(t => t.done).slice(-380)); LS.set('sen_trades', S.trades) };

/* ---------- toast / alert ---------- */
let tT = 0;
function toast(m){ const el = $('toast'); el.textContent = m; el.style.display = 'block'; clearTimeout(tT); tT = setTimeout(() => { el.style.display = 'none' }, 3200) }
function alertUser(title, body){
  toast(title);
  try{ navigator.vibrate && navigator.vibrate([200, 100, 200]) }catch(e){}
  if(S.cfg.notify && 'Notification' in window && Notification.permission === 'granted'){
    try{ navigator.serviceWorker && navigator.serviceWorker.ready.then(r => r.showNotification(title, {body, icon: 'icon-192.png', tag: 'sen-' + Date.now()})).catch(() => new Notification(title, {body})) }
    catch(e){ try{ new Notification(title, {body}) }catch(x){} }
  }
}
/* screen on */
let wake = null;
async function wakeSet(){
  try{
    if(S.cfg.screenOn && 'wakeLock' in navigator && document.visibilityState === 'visible'){ if(!wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null }) } }
    else if(wake){ await wake.release(); wake = null }
  }catch(e){ wake = null }
}

/* ---------- calendar (MT5 + Forex Factory) ---------- */
const FF = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
async function loadCal(force){
  if(!force && Date.now() - S.calAt < 30 * MIN) return;
  const ev = [];
  let src = [];
  try{
    const u = fbUrl(keys(), 'feed/news/cal');
    if(u){ const r = await fetch(u, {cache: 'no-store'}); const j = r.ok ? await r.json() : null;
      if(j && Array.isArray(j.list) && Date.now() - j.at * 1000 < 40 * MIN){ j.list.forEach(x => ev.push({t: x.t * 1000, cur: x.cur || 'USD', imp: x.imp, title: x.title})); src.push('MT5') } }
  }catch(e){}
  let ff = LS.get('sen_ff', null);
  if(!ff || Date.now() - ff.at > 3 * 3600e3){
    for(const u of [FF, 'https://api.allorigins.win/raw?url=' + encodeURIComponent(FF), 'https://corsproxy.io/?' + encodeURIComponent(FF)]){
      try{ const r = await fetch(u, {cache: 'no-store'}); if(!r.ok) continue; const j = await r.json();
        if(Array.isArray(j) && j.length){ ff = {at: Date.now(), list: j.filter(x => x.impact === 'High').map(x => ({t: Date.parse(x.date), cur: x.country, imp: 'High', title: x.title}))}; LS.set('sen_ff', ff); break } }catch(e){}
    }
  }
  if(ff && ff.list){ ff.list.forEach(x => { if(isFinite(x.t) && !ev.some(e => e.cur === x.cur && Math.abs(e.t - x.t) < 5 * MIN)) ev.push(x) }); src.push('FF') }
  S.events = ev.filter(e => e.imp === 'High').sort((a, b) => a.t - b.t); S.calAt = Date.now(); S.calSrc = src.join(' + ') || 'नहीं मिला';
}
const nextNews = () => S.events.find(e => e.t > Date.now() - 30 * MIN && CURS.includes(e.cur));

/* ---------- Gemini news bias ---------- */
const GBASE = 'https://generativelanguage.googleapis.com/v1beta';
const GMODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.5-flash'];
const aiFresh = () => S.cfg.ai && S.ai && S.ai.bias && Date.now() - S.ai.at < 60 * MIN ? S.ai.bias : null;
async function askAi(){
  const key = keys().gKey;
  if(!key) throw new Error('Gemini key नहीं (SamuSignal Settings में डालो)');
  if(S.aiBusy) return; S.aiBusy = true; render();
  const errs = [];
  try{
    for(const m of [LS.get('gOk', ''), ...GMODELS].filter((x, i, a) => x && a.indexOf(x) === i)){
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 45000);
      try{
        const r = await fetch(`${GBASE}/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ac.signal,
          body: JSON.stringify({contents: [{parts: [{text: AI_PROMPT}]}], tools: [{google_search: {}}], generationConfig: {temperature: 0.2, maxOutputTokens: 700}})});
        const j = await r.json().catch(() => ({}));
        if(!r.ok){ errs.push(((j.error && j.error.message) || 'HTTP ' + r.status).split(key).join('***')); continue }
        const c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(x => x.text || '').join('');
        const b = parseCurBias(txt); if(!b){ errs.push(m + ': format गलत'); continue }
        const src = (((c.groundingMetadata || {}).groundingChunks) || []).map(x => x.web).filter(w => w && /^https?:\/\//.test(w.uri)).slice(0, 3).map(w => ({t: String(w.title || w.uri).slice(0, 50), u: w.uri}));
        const sum = b.sum; delete b.sum;
        S.ai = {at: Date.now(), bias: b, sum, src, model: m}; LS.set('sen_ai', S.ai); S.aiErr = ''; return;
      }catch(e){ errs.push(e.name === 'AbortError' ? m + ' slow' : String(e.message).split(key).join('***')) }finally{ clearTimeout(tm) }
    }
    throw new Error(errs.find(e => /quota|rate|exhaust|429/i.test(e)) ? 'Gemini की limit पूरी — थोड़ी देर बाद' : (errs[0] || 'AI fail').slice(0, 110));
  }finally{ S.aiBusy = false }
}

/* ---------- trades ---------- */
const todayUsd = () => S.trades.filter(t => t.done && t.exitAt && dayKey(t.exitAt) === dayKey(Date.now())).reduce((a, t) => a + (+t.usd || 0), 0);
function riskUsd(sym, dist, lot){ const sp = SPECS[sym]; return sp ? dist / sp.pip * pipUsd(sym, lot, S.rates) : 0 }
function openTrade(r, now){
  const why = canOpen(r, S.trades, S.cfg, now, todayUsd());
  if(why){ r.skip = why; return false }
  const o = r.order, risk = riskUsd(r.sym, o.dist, S.cfg.lot);
  const t = {id: 'SN' + now.toString(36) + nm(r.sym), sym: r.sym, dir: r.dir, type: o.type, entry: o.entry, sl: o.sl, tp: o.tp, rr: o.rr, dist: o.dist, spread: o.spread,
    score: r.score, why: r.why.slice(0, 6), parts: r.parts.map(p => ({k: p.k, pts: p.pts, max: p.max})), at: now, expiryMin: S.cfg.expiryMin, maxHoldH: S.cfg.maxHoldH,
    lot: S.cfg.lot, risk, reward: risk * o.rr, state: 'PENDING', done: false, ai: S.ai && aiFresh() ? S.ai.sum : '', v: SEN_VERSION};
  S.trades.push(t); r.taken = t.id;
  alertUser(`🛡️ ${nm(r.sym)} ${o.type} · Score ${r.score}`, `Entry ${fmt(r.sym, o.entry)} · SL ${fmt(r.sym, o.sl)} · TP ${fmt(r.sym, o.tp)}\n${r.why.slice(0, 2).join(' · ')}`);
  return true;
}
function resolveAll(A15, now){
  let ch = false;
  S.trades.forEach(t => {
    if(t.done) return;
    const a = A15[nm(t.sym)]; if(!a || !a.bars) return;
    const res = evalTrade(t, a.bars, now), was = t.state;
    if(res.state === 'OPEN'){ t.state = 'OPEN'; t.fillAt = res.fillAt; t.cur = res.cur; t.r = res.r; t.usd = Math.round(res.r * t.risk * 100) / 100 }
    else if(res.done){ Object.assign(t, {state: res.state, res: res.state, done: true, exit: res.exit, fillAt: res.fillAt, exitAt: res.exitAt || now, r: res.r, usd: Math.round(res.r * t.risk * 100) / 100}) }
    if(was !== t.state){ ch = true;
      if(t.state === 'OPEN') alertUser(`🟢 ${nm(t.sym)} ${t.type} भर गया`, `Entry ${fmt(t.sym, t.entry)}`);
      else if(t.state === 'TP') alertUser(`✅ ${nm(t.sym)} TP ${usd(t.usd)}`, `${t.r}R`);
      else if(t.state === 'SL') alertUser(`❌ ${nm(t.sym)} SL ${usd(t.usd)}`, `${t.r}R`);
      else if(t.state === 'TIME') alertUser(`⏱ ${nm(t.sym)} समय पूरा ${usd(t.usd)}`, `${t.r}R`);
    }
  });
  if(ch || S.trades.some(t => t.state === 'OPEN')) saveTrades();
}

/* ---------- scan ---------- */
const nextSlot = now => Math.floor(now / M15) * M15 + M15 + 25e3;
async function scan(manual){
  if(S.busy) return; S.busy = true; S.err = ''; render();
  try{
    const s = keys();
    S.feed = await feedStatus(s, true);
    if(!S.feed.ok) throw new Error('MT5 Data Feed बंद — ' + S.feed.why);
    const [A15, A1, q] = await Promise.all([feedAllBars(s, '15min'), feedAllBars(s, '1h'), quotes(s, SEN_PAIRS).catch(() => ({}))]);
    const now = Date.now();
    Object.entries(q).forEach(([k, v]) => { if(v && v.p > 0) S.rates[k] = v.p });
    const all = {}; Object.entries(A1).forEach(([k, v]) => { all[k] = closedOnly(v.bars, H1, now) });
    S.cs = strength(all); LS.set('sen_cs', S.cs);
    await loadCal().catch(() => {});
    resolveAll(A15, now);
    const hist = S.trades.filter(t => t.done);
    const run = bias => SEN_PAIRS.map(sym => {
      const k = nm(sym), a = A15[k], b = A1[k];
      if(!a || !b) return {sym, dir: null, score: 0, parts: [], blocks: [`Feed में ${k} नहीं`], why: []};
      const sp = q[sym] && q[sym].sp > 0 ? q[sym].sp * Math.pow(10, -SPECS[sym].d) : 0;
      return score({sym, b15: closedOnly(a.bars, M15, now), b1h: closedOnly(b.bars, H1, now), live: a.live, spread: sp, cs: S.cs, events: S.events, bias, history: hist, now, cfg: S.cfg});
    });
    let res = run(aiFresh());
    /* Gemini sirf tab jab koi setup banne ke kareeb ho aur purana bias 30 min se zyada ho (quota bachao) */
    const near = res.some(r => r.dir && !r.blocks.length && r.score >= S.cfg.minScore - 15);
    if(S.cfg.ai && s.gKey && near && (!S.ai || Date.now() - S.ai.at > 30 * MIN)){
      try{ await askAi(); res = run(aiFresh()) }catch(e){ S.aiErr = e.message }
    }
    res.sort((a, b) => (b.ok - a.ok) || (b.score - a.score));
    let n = 0; res.forEach(r => { if(r.ok && openTrade(r, now)) n++ });
    if(n) saveTrades();
    S.radar = {at: now, list: res.map(r => ({sym: r.sym, dir: r.dir, dirHint: r.dirHint, score: r.score, ok: r.ok, blocks: r.blocks, why: r.why, parts: r.parts, order: r.order, skip: r.skip, taken: r.taken}))};
    LS.set('sen_radar', S.radar);
    S.lastScan = now; LS.set('sen_lastScan', now);
    if(manual) toast(n ? `${n} नया paper trade` : 'Scan पूरा — अभी कोई high-probability setup नहीं');
  }catch(e){ S.err = e.message || String(e); if(manual) toast(S.err) }
  finally{ S.busy = false; S.nextAt = nextSlot(Date.now()); render() }
}
/* har minute: chalu trade ka nateeja (halka — sirf 15m bars) */
async function tick(){
  if(S.busy || !S.trades.some(t => !t.done)) return;
  try{ const s = keys(); S.feed = await feedStatus(s); if(!S.feed.ok) return;
    const A15 = await feedAllBars(s, '15min'); resolveAll(A15, Date.now()); render() }catch(e){}
}

/* ---------- render ---------- */
const TABS = [['radar', '📡', 'Radar'], ['trades', '🎯', 'Trades'], ['hist', '📜', 'History'], ['set', '⚙️', 'Setting']];
function chips(){
  const ss = session(Date.now()), live = S.trades.filter(t => !t.done).length, td = todayUsd(), nn = nextNews();
  const aiP = !S.cfg.ai ? ['', 'Gemini OFF'] : S.aiBusy ? ['warn', 'Gemini…'] : S.aiErr ? ['bad', 'Gemini ✗'] : S.ai ? [Date.now() - S.ai.at < 60 * MIN ? 'ok' : 'warn', 'Gemini ' + ago(S.ai.at)] : ['', 'Gemini तैयार'];
  return [
    [S.feed.ok ? 'ok' : 'bad', S.feed.ok ? '● MT5 LIVE' : '● FEED OFF'],
    [ss.ok ? 'ok' : 'warn', ss.name],
    [S.busy ? 'warn' : '', S.busy ? 'Scanning…' : 'अगला scan ' + mmss(S.nextAt - Date.now())],
    aiP,
    [live >= S.cfg.maxOpen ? 'warn' : '', `Trades ${live}/${S.cfg.maxOpen}`],
    [td < 0 ? 'bad' : td > 0 ? 'ok' : '', 'आज ' + usd(td)],
    nn ? [Math.abs(nn.t - Date.now()) < 30 * MIN ? 'bad' : '', `📰 ${nn.cur} ${hm(nn.t)}`] : null
  ].filter(Boolean).map(([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`).join('');
}
function csmHtml(){
  const cs = S.cs; if(!cs || !cs.ok) return '<div class="note">Currency strength के लिए feed data नहीं</div>';
  const mx = Math.max(1, ...CURS.map(c => Math.abs(cs.str[c])));
  return '<div class="csm">' + [...CURS].sort((a, b) => cs.rank[a] - cs.rank[b]).map(c => {
    const v = cs.str[c], h = Math.round(Math.abs(v) / mx * 50), pos = v >= 0;
    return `<div><b>${c}</b><s><u style="${pos ? `bottom:50%;height:${h}%;background:var(--up)` : `top:50%;height:${h}%;background:var(--dn)`}"></u></s>${v > 0 ? '+' : ''}${v}</div>`;
  }).join('') + '</div>';
}
function radarCard(r){
  const open = S.openD[r.sym], th = S.cfg.minScore;
  const st = r.taken ? `<div class="st k">✅ Paper trade लगा — ${esc(r.order.type)}</div>`
    : r.blocks.length ? `<div class="st b">⛔ ${esc(r.blocks[0])}${r.blocks.length > 1 ? ` (+${r.blocks.length - 1})` : ''}</div>`
    : r.skip ? `<div class="st">⏸ ${esc(r.skip)}</div>`
    : r.ok ? `<div class="st k">✅ Setup तैयार</div>` : `<div class="st">Score ${r.score} — ${th} चाहिए</div>`;
  let det = '';
  if(open){
    det = '<div class="det">' + r.parts.map(p => `<div class="pt"><span class="k">${esc(p.k)}</span><span class="v">${p.pts > 0 && p.k.startsWith('Gemini') ? '+' : ''}${p.pts}/${p.max}</span><span>${esc(p.txt)}</span></div>`).join('')
      + (r.blocks.length ? r.blocks.map(b => `<div class="st b">⛔ ${esc(b)}</div>`).join('') : '')
      + (r.order ? `<div class="lv"><div class="e">${esc(r.order.type)}<b>${fmt(r.sym, r.order.entry)}</b></div><div class="s">SL<b>${fmt(r.sym, r.order.sl)}</b></div><div class="t">TP ${r.order.rr}R<b>${fmt(r.sym, r.order.tp)}</b></div></div>` : '')
      + '</div>';
  }
  return `<div class="pr${r.ok || r.taken ? ' go' : ''}" data-act="tog" data-sym="${esc(r.sym)}">
    <div class="r1"><span class="nm">${nm(r.sym)}</span><span class="dir ${r.dir || 'NO'}">${r.dir || (r.dirHint ? r.dirHint + '?' : '—')}</span><span class="sc mono">${r.dir ? r.score : '—'}<small>/100</small></span></div>
    <div class="bar${r.ok ? '' : ' dim'}"><i style="width:${r.dir ? r.score : 0}%"></i><em style="left:${th}%"></em></div>
    ${st}${det}</div>`;
}
function radar(){
  const R = S.radar, ai = S.ai;
  let h = '';
  if(S.err) h += `<div class="alert">⚠️ ${esc(S.err)}</div>`;
  h += `<div class="alert g">🧪 अभी <b>PAPER</b> — MT5 पर कोई order नहीं जाता। Page खुला रहे (screen on) तो हर 15 min पर 8 pair scan होते हैं और score ${S.cfg.minScore}+ पर अपने आप paper trade लगता है। अच्छा चला तो अगला कदम: VPS EA (24/7 असली auto trade).</div>`;
  h += `<div class="card"><h3>Currency Strength</h3>${csmHtml()}
    ${ai && ai.sum ? `<div class="note" style="margin-top:10px">🤖 <b>Gemini (${ago(ai.at)}):</b> ${esc(ai.sum)}</div>` : ''}${S.aiErr ? `<div class="note" style="color:#ff9aa3;margin-top:6px">Gemini: ${esc(S.aiErr)}</div>` : ''}</div>`;
  h += `<div class="btns"><button class="btn gold" data-act="scan">${S.busy ? '<span class="spin">⟳</span> Scanning…' : '📡 अभी Scan करो'}</button><button class="btn ghost" data-act="ai" ${S.aiBusy ? 'disabled' : ''}>🤖 News अभी</button></div>`;
  if(!R) return h + '<div class="empty">अभी scan नहीं हुआ</div>';
  h += `<div class="lbl" style="padding:0 2px">Scan ${hm(R.at)} IST · tap करो = पूरी वजह</div>`;
  return h + R.list.map(radarCard).join('');
}
function tradeCard(t){
  const live = !t.done, sp = SPECS[t.sym];
  const stTxt = {PENDING: `⏳ PENDING · ${mmss(t.at + t.expiryMin * MIN - Date.now())} में expire`, OPEN: `🟢 OPEN · ${t.r >= 0 ? '+' : ''}${t.r}R (${usd(t.usd)})`, TP: `✅ TP ${usd(t.usd)}`, SL: `❌ SL ${usd(t.usd)}`, TIME: `⏱ समय पूरा ${usd(t.usd)}`, EXPIRED: '⌛ भरा नहीं (expire)'}[t.state];
  return `<div class="card${live ? ' go' : ''}" style="${live ? 'border-color:var(--gold)' : ''}">
    <div class="r1" style="display:flex;align-items:center;gap:8px"><b style="font-size:17px;flex:1">${nm(t.sym)}</b><span class="dir ${t.dir}">${esc(t.type)}</span><span class="serif" style="color:var(--gold);font-size:20px">${t.score}</span></div>
    <div class="res ${t.state}" style="margin-top:6px;font-size:13px">${stTxt}</div>
    <div class="lv"><div class="e">Entry<b>${fmt(t.sym, t.entry)}</b></div><div class="s">SL ${(t.dist / sp.pip).toFixed(1)} pip<b>${fmt(t.sym, t.sl)}</b></div><div class="t">TP ${t.rr}R<b>${fmt(t.sym, t.tp)}</b></div></div>
    <div class="note" style="margin-top:6px">${t.lot} lot · risk ≈ $${t.risk.toFixed(2)} · reward ≈ $${t.reward.toFixed(2)} · ${dLbl(t.at)} ${hm(t.at)}${t.fillAt ? ' · भरा ' + hm(t.fillAt) : ''}${t.exitAt && t.done ? ' · बंद ' + hm(t.exitAt) : ''}</div>
    <ul class="why">${t.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    ${t.ai ? `<div class="note">🤖 ${esc(t.ai)}</div>` : ''}</div>`;
}
function trades(){
  const L = S.trades.filter(t => !t.done).sort((a, b) => b.at - a.at);
  const D = S.trades.filter(t => t.done && dayKey(t.at) === dayKey(Date.now())).sort((a, b) => b.at - a.at);
  return (L.length ? L.map(tradeCard).join('') : '<div class="empty">अभी कोई चालू paper trade नहीं।<br>Score ' + S.cfg.minScore + '+ वाला setup बनते ही अपने आप लगेगा।</div>')
    + (D.length ? '<div class="lbl" style="padding:4px 2px 0">आज के बंद</div>' + D.map(tradeCard).join('') : '');
}
function hist(){
  const all = S.trades.filter(t => t.done), st = stats(all), td = stats(all.filter(t => dayKey(t.exitAt || t.at) === dayKey(Date.now())));
  const exp = all.filter(t => t.state === 'EXPIRED').length;
  let h = `<div class="card"><div class="hero"><div><div class="lbl">Net</div><div class="big mono" style="color:${st.usd >= 0 ? 'var(--up)' : '#ff8a95'}">${usd(st.usd)}</div></div>
    <div><div class="lbl">Win</div><div class="big mono mt">${st.pct === null ? '—' : st.pct + '%'}</div></div><div><div class="lbl">Total R</div><div class="big mono">${st.R >= 0 ? '+' : ''}${st.R}</div></div></div>
    <div class="tiles" style="margin-top:10px"><div class="tile">Trades<b>${st.n}</b></div><div class="tile">TP<b style="color:var(--up)">${st.tp}</b></div><div class="tile">SL<b style="color:#ff8a95">${st.sl}</b></div><div class="tile">Time<b>${st.time}</b></div></div>
    <div class="note" style="margin-top:8px">आज: ${td.n} trade · ${td.pct === null ? '—' : td.pct + '%'} · ${usd(td.usd)} · Avg ${st.avgR === null ? '—' : st.avgR + 'R'} · भरे नहीं (expire): ${exp}<br>TP ${S.cfg.rr}R पर break-even के लिए ~${Math.round(100 / (1 + S.cfg.rr))}% जीत काफ़ी है।</div></div>`;
  const rows = SEN_PAIRS.map(sym => { const x = stats(all.filter(t => t.sym === sym)); return x.n ? `<tr><td>${nm(sym)}</td><td>${x.n}</td><td>${x.pct}%</td><td>${x.R}</td><td style="color:${x.usd >= 0 ? 'var(--up)' : '#ff8a95'}">${usd(x.usd)}</td></tr>` : '' }).join('');
  if(rows) h += `<div class="card"><h3>Pair-wise</h3><table><tr><th>Pair</th><th>Trades</th><th>Win</th><th>R</th><th>$</th></tr>${rows}</table></div>`;
  const list = all.filter(t => t.state !== 'EXPIRED').sort((a, b) => (b.exitAt || b.at) - (a.exitAt || a.at)).slice(0, 80);
  h += `<div class="card"><h3>History</h3>${list.length ? list.map(t => `<div class="row"><div><b>${nm(t.sym)}</b> <span class="dir ${t.dir}">${t.dir}</span> <span class="l2">score ${t.score}</span><div class="l2">${dLbl(t.at)} ${hm(t.at)} → ${hm(t.exitAt)} · ${fmt(t.sym, t.entry)}</div></div><div style="text-align:right"><span class="res ${t.res}">${t.res}</span><div class="l2">${t.r >= 0 ? '+' : ''}${t.r}R · ${usd(t.usd)}</div></div></div>`).join('') : '<div class="empty">अभी कोई बंद trade नहीं</div>'}</div>`;
  return h;
}
function seg(k, opts, fmtL){ return `<div class="seg">${opts.map(v => `<button class="${S.cfg[k] === v ? 'on' : ''}" data-act="cfg" data-k="${k}" data-v="${v}">${fmtL ? fmtL(v) : v}</button>`).join('')}</div>` }
function setting(){
  const tg = (k, on, off) => seg(k, [true, false], v => v ? on : off);
  return `<div class="card set">
    <div class="sg">Minimum score (कब trade)<small>ज़्यादा = कम पर बेहतर trade</small>${seg('minScore', [65, 70, 75, 80, 85])}</div>
    <div class="sg">TP = risk का कितना गुना (R:R)${seg('rr', [1.5, 1.8, 2, 2.5], v => '1:' + v)}</div>
    <div class="sg">Lot (paper $ हिसाब)${seg('lot', [0.01, 0.02, 0.05, 0.1])}</div>
    <div class="sg">एक साथ max trade${seg('maxOpen', [1, 2, 3, 4, 5])}</div>
    <div class="sg">Daily loss limit<small>इतना loss होते ही उस दिन नए trade बंद</small>${seg('dayLoss', [3, 5, 10, 20], v => '$' + v)}</div>
    <div class="sg">Pending order expiry${seg('expiryMin', [30, 60, 90, 120], v => v + 'm')}</div>
    <div class="sg">Gemini news bias<small>हर 30 min (सिर्फ़ जब कोई setup क़रीब हो)</small>${tg('ai', 'ON', 'OFF')}</div>
    <div class="sg">☀️ Screen on रखो${tg('screenOn', 'ON', 'OFF')}</div>
    <div class="sg">🔔 Phone notification${tg('notify', 'ON', 'OFF')}</div>
  </div>
  <div class="card"><h3>नियम (v${SEN_VERSION})</h3><div class="note">
    • Pairs: ${SEN_PAIRS.map(nm).join(', ')}<br>
    • H4 + H1 trend एक दिशा में (EMA21/50) → M15 पर pullback entry<br>
    • ADX ≥ 20 और <b>बढ़ता</b> हुआ + DI gap · Efficiency Ratio (chop filter)<br>
    • Currency Strength Meter (सारे feed pair) — मज़बूत vs कमज़ोर<br>
    • EMA20 से stretch (ATR में) — भागे price का पीछा नहीं<br>
    • SL = पिछले 12 candle का swing + 0.3 ATR (कम से कम 1 ATR M15 और ½ ATR H1), TP = ${S.cfg.rr}R, सिर्फ़ BUY/SELL LIMIT<br>
    • रोक: High news ±30 min, Asia/रात/weekend, spread > SL का 15%, RSI extreme, SL के बाद 2 घंटे उस pair पर आराम<br>
    • Self-learning: pair के 8+ trade होने पर जीत % से score ±<br>
    • Calendar: ${esc(S.calSrc || '—')} · Fill / TP / SL 15m candle (bid + spread) से; एक candle में दोनों = SL
  </div></div>
  <button class="btn red" style="width:100%" data-act="reset">🗑 Paper history साफ़ करो</button>`;
}
function renderTop(){
  const now = Date.now();
  $('clock').innerHTML = `<b>${hm(now)}</b> IST<br>${new Date(now).toISOString().slice(11, 16)} UTC`;
  $('chips').innerHTML = chips();
}
function render(){
  renderTop();
  $('main').innerHTML = '<div class="wrap">' + ({radar, trades, hist, set: setting}[S.tab] || radar)() + '</div>';
  $('nav').innerHTML = TABS.map(([k, i, t]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-k="${k}"><b>${i}</b>${t}${k === 'trades' && S.trades.some(x => !x.done) ? ' •' : ''}</button>`).join('');
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const a = el.dataset.act;
  if(a === 'tab'){ S.tab = el.dataset.k; LS.set('sen_tab', S.tab); render(); window.scrollTo(0, 0) }
  else if(a === 'tog'){ S.openD[el.dataset.sym] = !S.openD[el.dataset.sym]; render() }
  else if(a === 'scan') scan(true);
  else if(a === 'ai'){ try{ await askAi(); toast('Gemini news bias आ गया'); scan(false) }catch(err){ S.aiErr = err.message; toast(err.message) } render() }
  else if(a === 'cfg'){
    const k = el.dataset.k, raw = el.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : +raw;
    S.cfg[k] = v; saveCfg();
    if(k === 'screenOn') wakeSet();
    if(k === 'notify' && v && 'Notification' in window && Notification.permission !== 'granted'){
      try{ const p = await Notification.requestPermission(); if(p !== 'granted'){ S.cfg.notify = false; saveCfg(); toast('Notification की इजाज़त नहीं मिली') } }catch(err){}
    }
    render();
  }
  else if(a === 'reset'){
    if(confirm('सारा paper history (चालू trade भी) मिटा दें?')){ S.trades = []; saveTrades(); render(); toast('साफ़ — नया शुरू') }
  }
});
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ wakeSet(); if(Date.now() >= S.nextAt) scan(false) } });

/* ---------- boot ---------- */
S.nextAt = nextSlot(Date.now());
render();
wakeSet();
loadCal().catch(() => {});
/* pichhla scan is candle ka nahi = abhi scan */
if(Date.now() - S.lastScan > 2 * MIN && Math.floor(S.lastScan / M15) !== Math.floor((Date.now() - 25e3) / M15)) scan(false);
else feedStatus(keys(), true).then(f => { S.feed = f; render() }).catch(() => {});
setInterval(() => {
  const now = Date.now();
  if(!S.busy && now >= S.nextAt) scan(false);
  else if(now - S.lastTick >= MIN){ S.lastTick = now; tick() }
  if(S.tab === 'trades') render(); else renderTop();   /* baaki tab sirf badlav par (scroll / tap na toote) */
}, 1000);
