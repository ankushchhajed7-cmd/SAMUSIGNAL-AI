/* SAMUSIGNAL AI — personal app. SamuSignal ki keys + MT5 feed + PERSONAL FX bridge. */
import {SPECS, PAIRS, fmt, fmtS, fromName} from './symbols.js';
import {LS, keys, feedStatus, series, quotes} from './data.js';
import {analyze, evaluate, isWin, isLoss} from './engine.js';
import {accounts, orders, sendLimit, ORDER_ST} from './bridge.js';
import {aiCheck, aiShot} from './ai.js';

export const VERSION = '1.0.4';
const $ = id => document.getElementById(id);
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const IC = {chart: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  list: '<path d="M5 7h14M5 12h14M5 17h9"/>', spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', ref: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'};
const icon = (n, c = 'currentColor', s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
let LG = 0;
export function logo(size){
  const g = 'lg' + (++LG), b = 'lb' + LG;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="SAMUSIGNAL AI"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.28" stop-color="#e8c35a"/><stop offset="0.5" stop-color="#a87b16"/><stop offset="0.72" stop-color="#f7e08a"/><stop offset="1" stop-color="#c9971f"/></linearGradient><radialGradient id="${b}" cx="0.35" cy="0.25" r="0.9"><stop offset="0" stop-color="#23242b"/><stop offset="0.6" stop-color="#0d0e12"/><stop offset="1" stop-color="#060709"/></radialGradient></defs><rect x="2" y="2" width="96" height="96" rx="24" fill="url(#${b})" stroke="url(#${g})" stroke-width="2.5"/><path d="M64 31 C57 24 45 23 38 28 C29 34 32 45 42 48.5 L58 54 C69 58 69 71 60 76 C51 81 38 78 32 70" fill="none" stroke="url(#${g})" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="75" cy="25" r="5" fill="#2fe08a"/><path d="M75 14 A11 11 0 0 1 86 25" fill="none" stroke="#2fe08a" stroke-width="3" stroke-linecap="round"/><path d="M75 7 A18 18 0 0 1 93 25" fill="none" stroke="#2fe08a" stroke-width="3" stroke-linecap="round" opacity="0.55"/></svg>`;
}
const gauge = (w, h, buy) => { const a = Math.PI * (1 - buy / 100), x = 100 + 70 * Math.cos(a), y = 100 - 70 * Math.sin(a);
  return `<svg width="${w}" height="${h}" viewBox="0 0 200 110" role="img" aria-label="Buy ${buy} percent"><path d="M10 100 A90 90 0 0 1 55 22.06" fill="none" stroke="#ff5d6c" stroke-width="16"/><path d="M55 22.06 A90 90 0 0 1 145 22.06" fill="none" stroke="#4a4f59" stroke-width="16"/><path d="M145 22.06 A90 90 0 0 1 190 100" fill="none" stroke="#2fe08a" stroke-width="16"/><line x1="100" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#f3efe6" stroke-width="6" stroke-linecap="round"/><circle cx="100" cy="100" r="10" fill="#f3efe6"/></svg>` };
const ist = (t, sec) => new Date(t).toLocaleTimeString('en-GB', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: sec ? '2-digit' : undefined, hour12: false});
const istD = t => new Date(t).toLocaleDateString('en-GB', {timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short'});
let toastT;
function toast(m, ms = 2600){ const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', ms) }
function dlg(title, html, okTxt = 'OK', noTxt = 'Cancel'){
  $('dlgT').textContent = title; $('dlgB').innerHTML = html; $('dlgOk').textContent = okTxt; $('dlgNo').textContent = noTxt;
  $('dlgNo').style.display = noTxt ? '' : 'none'; $('dlg').classList.add('on');
  return new Promise(res => { $('dlgOk').onclick = () => { $('dlg').classList.remove('on'); res(true) }; $('dlgNo').onclick = () => { $('dlg').classList.remove('on'); res(false) } });
}

/* ---------------- state ---------------- */
const st = {pair: SPECS[LS.get('pair')] ? LS.get('pair') : 'EUR/USD', tf: LS.get('tf', '15min'), favs: LS.get('favs', ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD']),
  hist: LS.get('hist', []), cur: null, q: {}, src: '', ptab: 'fav', hf: 'all', hk: 'all', scr: 'home', busy: false, home: null};
const saveHist = () => LS.set('hist', st.hist.slice(0, 300));
const K = () => keys();

/* ---------------- charts ---------------- */
/* v1.0.4: saaf levels — entry = halki gold patti, TP/SL = patli line + chhote pill (aapas me takraate nahi),
   chart ke bahar wala level kinare pe ↑/↓ ke saath. Pill ke daam right price-scale ke andar nahi (khichdi khatam). */
function mkChart(el){
  const ch = LightweightCharts.createChart(el, {autoSize: true,
    layout: {background: {type: 'solid', color: 'rgba(0,0,0,0)'}, textColor: '#8f8775', fontFamily: 'Manrope', fontSize: 10, attributionLogo: false},
    grid: {vertLines: {visible: false}, horzLines: {color: 'rgba(232,195,90,0.05)'}},
    rightPriceScale: {borderVisible: false, scaleMargins: {top: 0.12, bottom: 0.22}},
    timeScale: {borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 14, barSpacing: 7},
    localization: {locale: 'en-US', timeFormatter: t => new Date(t * 1000).toISOString().slice(11, 16)},
    crosshair: {mode: 0}, handleScale: {axisPressedMouseMove: true}});
  const s = ch.addCandlestickSeries({upColor: '#2fe08a', downColor: '#ff5d6c', borderVisible: false, wickUpColor: '#2fe08a', wickDownColor: '#ff5d6c',
    priceLineColor: 'rgba(243,239,230,0.35)', priceLineStyle: 2});
  const ov = document.createElement('div');
  ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden';
  el.appendChild(ov);
  const C = {ch, s, lines: [], sym: '', sig: null, n: 0, ov};
  C.set = (bars, sym) => {
    const sp = SPECS[sym]; if(sym !== C.sym){ s.applyOptions({priceFormat: {type: 'price', precision: sp.d, minMove: Math.pow(10, -sp.d)}}); C.sym = sym; ch.priceScale('right').applyOptions({autoScale: true}) }
    s.setData(bars.map(b => ({time: Math.floor(b.t / 1000) + 19800, open: b.o, high: b.h, low: b.l, close: b.c})));
    C.n = bars.length; C.draw();
  };
  C.levels = sig => {
    C.lines.forEach(l => s.removePriceLine(l)); C.lines = []; C.sig = sig || null;
    if(sig){
      const L = (price, color, style) => C.lines.push(s.createPriceLine({price, color, lineStyle: style, lineWidth: 1, axisLabelVisible: false, title: ''}));
      L(sig.sl, 'rgba(255,93,108,0.75)', 2); sig.tp.forEach((p, i) => L(p, `rgba(47,224,138,${[0.8, 0.55, 0.4][i]})`, i ? 1 : 2));
    }
    C.draw();
  };
  C.fit = () => { const n = C.n; if(n > 100) ch.timeScale().setVisibleLogicalRange({from: n - 80, to: n + 14}); else ch.timeScale().fitContent() };
  C.draw = () => {
    const g = C.sig; if(!g || !C.sym){ ov.innerHTML = ''; return }
    let W = 0, H = el.clientHeight; try{ W = ch.priceScale('right').width(); H = el.clientHeight - ch.timeScale().height() }catch(e){}
    const y = p => s.priceToCoordinate(p), f = v => fmtS(C.sym, v);
    const top = y(Math.max(g.zone[0], g.zone[1])), bot = y(Math.min(g.zone[0], g.zone[1]));
    let html = '';
    if(top !== null && bot !== null){
      const t = Math.max(0, Math.min(top, bot)), h = Math.max(3, Math.abs(bot - top));
      if(t < H) html += `<div style="position:absolute;left:0;right:${W}px;top:${t}px;height:${h}px;background:linear-gradient(90deg,rgba(232,195,90,0.04),rgba(232,195,90,0.22));border-top:1px solid rgba(232,195,90,0.85);border-bottom:1px solid rgba(232,195,90,0.45)"></div>`;
    }
    const tags = [{p: (g.zone[0] + g.zone[1]) / 2, t: (g.dir === 'BUY' ? 'BUY ' : 'SELL ') + f(g.entry), bg: 'linear-gradient(120deg,#f7e08a,#c9971f 45%,#fff6cf 60%,#e8c35a)', c: '#1a1408', k: 0},
      {p: g.sl, t: 'SL ' + f(g.sl), bg: '#ff5d6c', c: '#2a0a0e', k: 1}]
      .concat(g.tp.map((p, i) => ({p, t: 'TP' + (i + 1) + ' ' + f(p), bg: ['#2fe08a', 'rgba(47,224,138,0.8)', 'rgba(47,224,138,0.62)'][i], c: '#06140d', k: 2 + i})));
    const PH = 18, GAP = 2;
    tags.forEach(x => { const c = y(x.p); x.out = c === null ? 0 : c < PH / 2 ? -1 : c > H - PH / 2 ? 1 : 0; x.y = c === null ? H / 2 : Math.min(H - PH / 2, Math.max(PH / 2, c)) });
    tags.sort((a, b) => a.y - b.y);
    for(let i = 1; i < tags.length; i++) if(tags[i].y - tags[i - 1].y < PH + GAP) tags[i].y = tags[i - 1].y + PH + GAP;
    const over = tags[tags.length - 1].y - (H - PH / 2);
    if(over > 0) tags.forEach(x => x.y -= over);
    tags.forEach(x => { html += `<span style="position:absolute;right:${W + 4}px;top:${(x.y - PH / 2).toFixed(1)}px;height:${PH}px;line-height:${PH}px;padding:0 7px;border-radius:6px;font:800 10px Manrope,sans-serif;letter-spacing:.3px;white-space:nowrap;color:${x.c};background:${x.bg};box-shadow:0 2px 8px rgba(0,0,0,0.45)">${x.out < 0 ? '↑ ' : x.out > 0 ? '↓ ' : ''}${x.t}</span>` });
    ov.innerHTML = html;
  };
  ch.timeScale().subscribeVisibleLogicalRangeChange(() => C.draw());
  let last = '';
  setInterval(() => { if(!C.sig || document.hidden) return; const k = [s.priceToCoordinate(C.sig.sl), s.priceToCoordinate(C.sig.tp[2]), el.clientHeight].join('|'); if(k !== last){ last = k; C.draw() } }, 250);
  return C;
}

/* ---------------- source pill ---------------- */
async function srcPill(){
  const f = await feedStatus(K()), p = $('srcPill');
  const td = !!K().tdKey && LS.get('src', 'auto') !== 'off';
  p.className = 'live ' + (f.ok && LS.get('src', 'auto') !== 'td' ? 'on' : td ? 'td' : 'off');
  p.innerHTML = '<i></i>' + (f.ok && LS.get('src', 'auto') !== 'td' ? 'LIVE' : td ? 'TD' : 'OFF');
  const k = K();
  $('hSrc').innerHTML = f.ok ? `📡 MT5 feed · account ${esc(f.meta.acct || '—')} · Exness exact bhaav`
    : (td ? 'TwelveData chal raha hai' : '<b style="color:var(--dn2)">Live data नहीं</b>') + ` <br>📡 MT5 feed: ${esc(f.why)}` +
      (!k.samuN && !k.tdKey && !k.fbAuth ? '<br><b style="color:var(--gold)">⚠ इस browser में SamuSignal नहीं मिला</b> — ये link उसी Chrome में खोलें जिसमें SamuSignal चलता है (WhatsApp / Claude ऐप के अंदर नहीं), या Settings में keys खुद डालें' : '');
}

/* ---------------- HOME ---------------- */
let homeChart, resChart, homeBars = null;
function tfRow(){
  $('tfs').innerHTML = [['5min', '5m'], ['15min', '15m'], ['1h', '1H']].map(([v, t]) => `<button class="tf${st.tf === v ? ' on' : ''}" data-tf="${v}">${t}</button>`).join('');
}
function lastSig(sym){ return st.hist.find(r => r.sym === sym && Date.now() < r.expiresAt + 6 * 3600e3) }
function sigCard(r, compact){
  const S = r.sym, live = st.q[S] && st.q[S].p;
  return `<div class="gb"><div class="gi">
<div style="display:flex;align-items:center;gap:8px"><span class="dirb ${r.dir}">${r.dir} LIMIT</span><span class="grade">Grade ${r.grade}</span>${r.src === 'shot' ? '<span class="kind k-shot">📷</span>' : ''}<span style="margin-left:auto;font-size:12px;color:var(--mu)">R:R ${r.rr || '1 : 2'}</span></div>
<div class="lbl" style="margin-top:12px">Entry zone ${compact ? '· ' + esc(SPECS[S] ? SPECS[S].n : S) + ' · ' + ist(r.at) : ''}</div>
<div class="big mt">${fmtS(S, r.zone[0])} – ${fmtS(S, r.zone[1])}</div>
<div style="display:flex;gap:6px;margin-top:10px"><div class="chip"><span class="lbl">SL</span><b style="color:var(--dn2)">${fmtS(S, r.sl)}</b></div>${r.tp.map((p, i) => `<div class="chip"><span class="lbl">TP${i + 1}</span><b style="color:var(--up)">${fmtS(S, p)}</b></div>`).join('')}</div>
${compact ? `<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px"><span style="color:var(--mu)">${resLabel(r)}</span><b style="color:var(--gold)">Open ›</b></div>` : ''}</div></div>`;
}
function resLabel(r){
  const s = r.res && r.res.state;
  if(s) return {PENDING: '⏳ Entry का इंतज़ार', OPEN: '🟢 Trade चालू', EXPIRED: '⌛ Fill नहीं हुआ', SL: '🔴 SL hit'}[s] || ('✅ ' + s + ' hit');
  return Date.now() < r.expiresAt ? 'Valid ' + Math.max(0, Math.round((r.expiresAt - Date.now()) / 60000)) + ' min' : 'Expired';
}
function renderHomeCard(){
  const r = lastSig(st.pair);
  $('hCard').innerHTML = r ? `<div data-open="${r.id}">${sigCard(r, true)}</div>` :
    `<div class="gb"><div class="gi" style="text-align:center"><div style="font-weight:800;font-size:15px">${esc(SPECS[st.pair].n)} पर अभी कोई signal नहीं</div><div class="note" style="margin-top:4px">नीचे गोल्ड <b style="color:var(--gold)">ANALYZE</b> दबाएँ — AI 15m + 1H पढ़कर BUY LIMIT / SELL LIMIT देगा</div></div></div>`;
}
async function loadHome(quiet){
  const sym = st.pair, sp = SPECS[sym];
  $('hPair').textContent = sp.n; $('hTitle').textContent = sp.title + ' · ' + sp.group;
  tfRow(); renderHomeCard();
  if(!homeChart) homeChart = mkChart($('hChart'));
  if(!quiet) $('hMsg').style.display = 'flex', $('hMsg').textContent = 'Loading…';
  try{
    const s = K(), q = await quotes(s, [sym]); Object.assign(st.q, q);
    const d = await series(s, sym, st.tf, 250);
    if(sym !== st.pair) return;
    homeBars = d.bars; st.src = d.src;
    homeChart.set(d.bars, sym); if(!quiet) homeChart.fit();
    homeChart.levels(lastSig(sym));
    $('hMsg').style.display = 'none';
    const px = (st.q[sym] && st.q[sym].p) || d.bars[d.bars.length - 1].c, chg = st.q[sym] ? st.q[sym].chg : 0;
    $('hPx').textContent = fmt(sym, px);
    $('hChg').textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '% today'; $('hChg').style.color = chg >= 0 ? 'var(--up)' : 'var(--dn2)';
    if(!quiet || !st.home || st.home.sym !== sym || Date.now() - st.home.t > 120000) quickRead(sym);
  }catch(e){ $('hMsg').style.display = 'flex'; $('hMsg').textContent = e.message }
  srcPill();
}
async function quickRead(sym){
  try{
    const s = K(), [a, b] = await Promise.all([series(s, sym, '15min', 250), series(s, sym, '1h', 250)]);
    const sig = analyze({b15: a.bars, b1h: b.bars, live: st.q[sym] && st.q[sym].p, spec: SPECS[sym]});
    st.home = {sym, t: Date.now(), sig};
    $('hGauge').innerHTML = gauge(64, 36, sig.buyPct); $('hBuy').textContent = 'BUY ' + sig.buyPct + '%'; $('hSell').textContent = 'SELL ' + sig.sellPct + '%';
    $('hReg').textContent = sig.regime + ' · ' + (sig.danger[0].toUpperCase() + sig.danger.slice(1)); $('hReg2').textContent = 'ADX ' + sig.adx.toFixed(0) + ' · 15m + 1H';
  }catch(e){}
}

/* ---------------- ANALYZE ---------------- */
const STEPS = ['Live candles (15m + 1H)', 'Trend + impulse leg', 'Fibonacci golden zone', 'Entry · SL · TP1-3 · Grade'];
function scanUI(i, sub){
  $('scSub').textContent = sub || ''; const pct = Math.round(i / STEPS.length * 100);
  $('scPct').textContent = pct + '%'; $('scBar').style.width = pct + '%';
  $('scSteps').innerHTML = STEPS.map((t, k) => k < i ? `<div class="step ok"><svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2fe08a"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#07140d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${t}</div>`
    : k === i ? `<div class="step"><span class="spin"></span>${t}…</div>` : `<div class="step" style="opacity:.5"><span style="width:16px;height:16px;border-radius:50%;border:2px solid var(--mu2)"></span>${t}</div>`).join('');
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function runAnalyze(sym = st.pair){
  if(st.busy) return; st.busy = true; let cancelled = false;
  $('scCancel').onclick = () => { cancelled = true; $('scan').classList.remove('on'); st.busy = false };
  $('scan').classList.add('on'); scanUI(0, SPECS[sym].n + ' · 15m');
  try{
    const s = K();
    const [a, b, q] = await Promise.all([series(s, sym, '15min', 250), series(s, sym, '1h', 250), quotes(s, [sym])]);
    Object.assign(st.q, q); if(cancelled) return;
    scanUI(1, `${SPECS[sym].n} · 15m · ${a.bars.length} candles · ${a.src === 'mt5' ? 'MT5 feed' : 'TwelveData'}`); await wait(350);
    const live = (q[sym] && q[sym].p) || a.bars[a.bars.length - 1].c;
    const sig = analyze({b15: a.bars, b1h: b.bars, live, spec: SPECS[sym]});
    scanUI(2); await wait(350); scanUI(3); await wait(300); if(cancelled) return;
    const rec = Object.assign({id: 'r' + Date.now().toString(36), sym, tf: '15m', src: a.src, sent: [], taken: null, res: null, ai: null}, sig);
    st.hist.unshift(rec); saveHist();
    scanUI(4); await wait(200);
    $('scan').classList.remove('on');
    openRes(rec.id);
    if(LS.get('aiOn', true) && s.gKey) aiCheck(s, sym, sig, a.bars).then(ai => { rec.ai = ai; saveHist(); if(st.cur === rec.id) renderAi(rec) })
      .catch(e => { rec.ai = {err: e.message}; if(st.cur === rec.id) renderAi(rec) });
  }catch(e){ $('scan').classList.remove('on'); dlg('Analysis नहीं हुआ', esc(e.message), 'OK', '') }
  finally{ st.busy = false }
}
async function fromShot(file){
  const s = K(); if(!s.gKey){ dlg('Gemini key नहीं', 'Screenshot पढ़ने के लिए SamuSignal में Gemini key चाहिए।', 'OK', ''); return }
  $('scan').classList.add('on'); scanUI(1, 'Screenshot · Gemini');
  try{
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(file) });
    const j = await aiShot(s, b64, file.type || 'image/png', PAIRS.map(p => SPECS[p].n).join(', '));
    if(!/^(BUY|SELL)$/.test(j.dir)) throw new Error('Chart पढ़ा नहीं गया — साफ़ screenshot भेजें');
    const sym = fromName(j.symbol), cur = +j.current_price, D = j.dir === 'BUY' ? 1 : -1;
    let entry = +j.entry, grade = /^[ABC]$/.test(j.grade) ? j.grade : 'C';
    if(!(D > 0 ? entry < cur : entry > cur)){ grade = 'C' }
    const d = sym ? SPECS[sym].d : 5, r = v => +(+v).toFixed(d);
    const w = Math.abs(entry - +j.sl) * 0.2;
    const rec = {id: 'r' + Date.now().toString(36), sym: sym || String(j.symbol || '?'), tf: j.timeframe || '?', src: 'shot', dir: j.dir, type: j.dir + ' LIMIT',
      entry: r(entry), zone: (D > 0 ? [entry - w, entry] : [entry, entry + w]).map(r), sl: r(j.sl), tp: [j.tp1, j.tp2, j.tp3].map(r), rr: '1 : 2', grade,
      buyPct: D > 0 ? 60 : 40, sellPct: D > 0 ? 40 : 60, regime: '—', danger: '—', live: r(cur), reasons: [String(j.reason || 'Screenshot analysis').slice(0, 160)],
      at: Date.now(), exp: 60, expiresAt: Date.now() + 3600e3, sent: [], taken: null, res: null, ai: null};
    st.hist.unshift(rec); saveHist(); $('scan').classList.remove('on'); openRes(rec.id);
  }catch(e){ $('scan').classList.remove('on'); dlg('Screenshot नहीं पढ़ा गया', esc(e.message), 'OK', '') }
}

/* ---------------- RESULT ---------------- */
let leftT;
async function openRes(id){
  const r = st.hist.find(x => x.id === id); if(!r) return;
  st.cur = id; show('res');
  const S = r.sym, sp = SPECS[S];
  $('rMeta').innerHTML = `<b style="color:var(--tx);font-size:16px">${esc(sp ? sp.n : S)}</b> · ${esc(r.tf)} · ${istD(r.at)} ${ist(r.at)}`;
  $('resKind').innerHTML = (r.sent.length ? '<span class="kind k-mt5">MT5</span>' : '') + (r.taken ? '<span class="kind k-man">✋ लिया</span>' : '');
  $('rCard').innerHTML = sigCard(r);
  $('rWhy').innerHTML = r.reasons.map(t => `<div style="display:flex;gap:8px"><span style="color:var(--gold)">◆</span>${esc(t)}</div>`).join('') +
    (r.src !== 'shot' ? `<div style="display:flex;gap:8px"><span style="color:var(--gold)">◆</span>Regime: ${esc(r.regime)} · Danger: ${esc(r.danger)} · Buy ${r.buyPct}% / Sell ${r.sellPct}%</div>` : '');
  renderAi(r); renderStatus(r);
  $('bMt5').disabled = !sp; $('bTook').textContent = r.taken ? '✋ लिया हुआ ✓ (हटाने के लिए दबाएँ)' : '✋ मैंने ट्रेड लिया';
  clearInterval(leftT);
  const tick = () => { const ms = r.expiresAt - Date.now(); $('rLeft').textContent = ms > 0 ? `Valid ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')} left` : 'Expired'; };
  tick(); leftT = setInterval(tick, 1000);
  if(!resChart) resChart = mkChart($('rChart'));
  resChart.levels(null);
  if(sp){ try{ const d = await series(K(), S, '15min', 250); if(st.cur !== id) return; resChart.set(d.bars, S); resChart.levels(r); resChart.fit() }catch(e){} }
  if(r.sent.length) refreshOrders();
}
function renderAi(r){
  const a = r.ai, el = $('rAi');
  if(!a){ el.innerHTML = LS.get('aiOn', true) && K().gKey && r.src !== 'shot' && Date.now() - r.at < 120000 ? '<span class="note">🤖 AI check चल रहा है…</span>' : ''; return }
  if(a.err){ el.innerHTML = `<span class="note">🤖 AI check नहीं हुआ: ${esc(a.err.slice(0, 80))}</span>`; return }
  el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start"><span>🤖</span><div><b style="color:${a.agree ? 'var(--up)' : 'var(--dn2)'}">AI ${a.agree ? 'सहमत' : 'असहमत'} · ${a.conf}%</b><div style="color:var(--mu)">${esc(a.reason)}</div></div></div>`;
}
function renderStatus(r){
  const box = $('rStatus');
  const rows = r.sent.map(o => { const s = ORDER_ST[o.status || 'NEW'] || [o.status, 'mu'];
    return `<div class="sr">🚀 ${o.acct ? (o.real ? 'REAL ' : 'DEMO ') + esc(o.acct) : 'PERSONAL FX'}<em style="color:var(--${s[1] === 'mu' ? 'mu' : s[1] === 'up' ? 'up' : s[1] === 'dn' ? 'dn2' : 'gold'})">${esc(s[0])}</em></div>` }).join('');
  const tk = r.taken ? `<div class="sr">✋ आपने लिया · ${ist(r.taken.at)}<em>@ ${fmt(r.sym, r.taken.px)}</em></div>` : '';
  const res = r.res ? `<div class="sr">📊 नतीजा<em><b style="color:${isWin(r.res.state) ? 'var(--up)' : isLoss(r.res.state) ? 'var(--dn2)' : 'var(--gold)'}">${esc(resLabel(r))}</b>${r.res.pips ? ' · ' + (r.res.pips > 0 ? '+' : '') + r.res.pips.toFixed(1) + ' pips' : ''}</em></div>` : '';
  box.innerHTML = rows || tk || res ? `<div class="card" style="margin:12px 18px 0">${rows}${tk}${res}</div>` : '';
}
async function refreshOrders(){
  const pend = st.hist.filter(r => r.sent.some(o => !o.status || o.status === 'NEW' || o.status === 'PLACED') && Date.now() - r.at < 26 * 3600e3);
  if(!pend.length) return;
  try{ const all = await orders(K());
    pend.forEach(r => r.sent.forEach(o => { if(all[o.key]) o.status = all[o.key].status || o.status }));
    saveHist(); const cur = st.hist.find(x => x.id === st.cur); if(cur && st.scr === 'res') renderStatus(cur);
  }catch(e){}
}
async function onMt5(){
  const r = st.hist.find(x => x.id === st.cur); if(!r || !SPECS[r.sym]) return;
  const s = K(); let acc = [];
  try{ acc = (await accounts(s)).filter(a => a.online) }catch(e){ return dlg('Firebase नहीं खुला', esc(e.message), 'OK', '') }
  let pick = acc;
  if(acc.length > 1){
    const last = LS.get('acct', []);
    const ok = await dlg('Account चुनें', acc.map(a => `<label class="acc"><input type="checkbox" data-login="${esc(a.login)}" ${last.includes(a.login) || (!last.length && a === (acc.find(x => !x.real) || acc[0])) ? 'checked' : ''}><span style="flex:1"><b style="color:${a.real ? 'var(--up)' : 'var(--gold)'}">${a.real ? 'REAL' : 'DEMO'} ${esc(a.login)}</b><span class="note" style="display:block">${esc(a.server || '')} · ${esc(a.cur || '')} ${(+a.bal || 0).toFixed(2)} · lot ${(+a.lot || 0).toFixed(2)}</span></span></label>`).join(''), 'आगे', 'Cancel');
    if(!ok) return;
    const ids = [...document.querySelectorAll('#dlgB input:checked')].map(i => i.dataset.login);
    if(!ids.length) return toast('कम से कम एक account चुनें');
    LS.set('acct', ids); pick = acc.filter(a => ids.includes(a.login));
  }
  const q = await quotes(s, [r.sym]); Object.assign(st.q, q);
  const live = q[r.sym] && q[r.sym].p;
  if(!live) return dlg('Live भाव नहीं मिला', 'MT5 feed / TwelveData से भाव नहीं आया — थोड़ी देर बाद फिर करें।', 'OK', '');
  let dup = '';
  try{ const all = await orders(s), n = SPECS[r.sym].n;
    const d = Object.values(all).find(o => o && o.pair === n && (o.status === 'NEW' || o.status === 'PLACED') && Date.now() - o.at < 3600e3);
    if(d) dup = `<div class="warn" style="margin-top:10px">⚠ ${n} का एक order पहले से "${esc((ORDER_ST[d.status] || [d.status])[0])}" है (${ist(d.at)})</div>` }catch(e){}
  const real = pick.some(a => a.real);
  const ok = await dlg('PERSONAL FX को भेजें?', `<b style="font-size:16px">${esc(SPECS[r.sym].n)} · ${r.dir} LIMIT @ ${fmt(r.sym, r.entry)}</b><div class="note" style="margin-top:4px">Live ${fmt(r.sym, live)} · Grade ${r.grade} · 60 min में न भरे तो EA हटा देगा</div>
<div style="margin-top:10px">${pick.length ? 'Account: ' + pick.map(a => `<b style="color:${a.real ? 'var(--up)' : 'var(--gold)'}">${a.real ? 'REAL' : 'DEMO'} ${esc(a.login)}</b> (${esc(a.cur || '')} ${(+a.bal || 0).toFixed(2)})`).join(' + ') : '<span style="color:var(--gold)">⚠ कोई PERSONAL FX online नहीं दिखा — order Firebase में रहेगा, EA चालू होते ही लगेगा</span>'}</div>
<div class="note" style="margin-top:8px">Lot, TP/SL, grid: PERSONAL FX के नियम (signal का SL/TP EA पर लागू नहीं)</div>${dup}
${real ? '<div class="warn" style="margin-top:10px">💰 REAL account — असली पैसे का जोखिम है। Grade C पर ध्यान से।</div>' : ''}${r.grade === 'C' ? '<div class="warn" style="margin-top:10px">Grade C — कमज़ोर / counter-trend setup</div>' : ''}`, '🚀 भेजो', 'Cancel');
  if(!ok) return;
  try{
    const sent = await sendLimit(s, r, live, pick);
    sent.forEach(o => r.sent.push(Object.assign(o, {status: 'NEW', at: Date.now()})));
    saveHist(); toast('✅ PERSONAL FX को भेज दिया'); openRes(r.id);
    setTimeout(refreshOrders, 8000); setTimeout(refreshOrders, 25000);
  }catch(e){ dlg('नहीं भेजा', esc(e.message), 'OK', '') }
}
async function onTook(){
  const r = st.hist.find(x => x.id === st.cur); if(!r) return;
  if(r.taken){ if(await dlg('Record हटाएँ?', '"मैंने ट्रेड लिया" का निशान हटेगा।', 'हटाओ', 'Cancel')){ r.taken = null; saveHist(); openRes(r.id) } return }
  const ok = await dlg('✋ मैंने ट्रेड लिया', `${esc(SPECS[r.sym] ? SPECS[r.sym].n : r.sym)} · ${r.dir}<div class="lbl" style="margin-top:12px">किस भाव पर लिया?</div><input class="f mono" id="tkPx" inputmode="decimal" value="${r.entry}" style="margin-top:6px">`, 'Save', 'Cancel');
  if(!ok) return;
  const px = parseFloat(String(document.getElementById('tkPx').value).replace(',', '.'));
  r.taken = {at: Date.now(), px: isFinite(px) ? px : r.entry}; saveHist(); toast('✅ Record हो गया — नतीजा History में'); openRes(r.id);
}

/* ---------------- HISTORY ---------------- */
async function refreshResults(){
  const s = K(), now = Date.now();
  const todo = st.hist.filter(r => SPECS[r.sym] && !(r.res && r.res.done) && now - r.at < 48 * 3600e3);
  const syms = [...new Set(todo.map(r => r.sym))].slice(0, (await feedStatus(s)).ok ? 12 : 3);
  for(const sym of syms){
    try{ const d = await series(s, sym, '5min', 300);
      todo.filter(r => r.sym === sym).forEach(r => { r.res = evaluate(r, d.bars, now, SPECS[sym].pip) });
    }catch(e){}
  }
  st.hist.filter(r => !(r.res && r.res.done) && now - r.at >= 48 * 3600e3).forEach(r => { r.res = Object.assign({}, r.res || {state: 'EXPIRED'}, {done: true}) });
  saveHist(); await refreshOrders();
}
function renderHis(){
  const wk = st.hist.filter(r => Date.now() - r.at < 7 * 864e5), fin = wk.filter(r => r.res && (isWin(r.res.state) || isLoss(r.res.state)));
  const w = fin.filter(r => isWin(r.res.state)).length, l = fin.length - w;
  $('stWin').textContent = fin.length ? Math.round(w / fin.length * 100) + '%' : '—'; $('stN').textContent = wk.length; $('stW').textContent = w; $('stL').textContent = l;
  const last = st.hist.filter(r => r.res && (isWin(r.res.state) || isLoss(r.res.state))).slice(0, 10);
  $('stDots').innerHTML = last.length ? last.map(r => `<span style="flex:1;height:16px;border-radius:4px;background:${isWin(r.res.state) ? 'var(--up)' : 'var(--dn)'}"></span>`).join('') : '<span class="note">अभी कोई पूरा नतीजा नहीं</span>';
  $('hf').innerHTML = [['all', 'All'], ['won', 'Won'], ['lost', 'Lost'], ['pend', 'Pending']].map(([k, t]) => `<button class="pill${st.hf === k ? ' on' : ''}" data-hf="${k}">${t}</button>`).join('');
  $('hk').innerHTML = [['all', 'सब'], ['mt5', '🚀 MT5'], ['man', '✋ खुद लिया'], ['sig', 'सिर्फ़ signal']].map(([k, t]) => `<button class="pill${st.hk === k ? ' on' : ''}" data-hk="${k}">${t}</button>`).join('');
  const L = st.hist.filter(r => {
    const s = r.res && r.res.state;
    if(st.hf === 'won' && !isWin(s)) return false; if(st.hf === 'lost' && !isLoss(s)) return false;
    if(st.hf === 'pend' && (isWin(s) || isLoss(s) || s === 'EXPIRED')) return false;
    if(st.hk === 'mt5' && !r.sent.length) return false; if(st.hk === 'man' && !r.taken) return false; if(st.hk === 'sig' && (r.sent.length || r.taken)) return false;
    return true }).slice(0, 80);
  $('hList').innerHTML = L.length ? L.map(r => {
    const s = r.res && r.res.state, B = r.dir === 'BUY';
    const [bc, bt] = isWin(s) ? ['b-win', s + ' HIT'] : isLoss(s) ? ['b-loss', 'SL HIT'] : s === 'EXPIRED' ? ['b-exp', 'EXPIRED'] : s === 'OPEN' ? ['b-open', 'OPEN'] : ['b-pend', 'PENDING'];
    const pip = r.res && r.res.pips ? (r.res.pips > 0 ? '+' : '') + r.res.pips.toFixed(1) + ' pips' : s === 'EXPIRED' ? 'not filled' : '—';
    return `<div class="row" data-open="${r.id}"><span style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:${B ? 'var(--up)' : 'var(--dn)'};background:${B ? 'rgba(47,224,138,0.12)' : 'rgba(255,93,108,0.12)'}">${r.dir}</span>
<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:14px">${esc(SPECS[r.sym] ? SPECS[r.sym].n : r.sym)} <span style="font-size:11px;font-weight:600;color:var(--mu)">LIMIT · ${istD(r.at)} ${ist(r.at)}</span></div>
<div style="font-size:11px;color:var(--mu)" class="mono">Entry ${fmtS(r.sym, r.entry)} · Grade ${r.grade}${r.sent.length ? '<span class="kind k-mt5">MT5</span>' : ''}${r.taken ? '<span class="kind k-man">✋</span>' : ''}${r.src === 'shot' ? '<span class="kind k-shot">📷</span>' : ''}</div></div>
<div style="text-align:right"><span class="badge ${bc}">${bt}</span><div class="mono" style="font-size:12px;font-weight:700;margin-top:4px;color:${isWin(s) ? 'var(--up)' : isLoss(s) ? 'var(--dn2)' : 'var(--mu)'}">${pip}</div></div></div>` }).join('')
    : '<div class="row" style="justify-content:center;color:var(--mu);font-size:13px;padding:24px">अभी कुछ नहीं — ANALYZE दबाकर पहला signal लें</div>';
}

/* ---------------- PAIRS ---------------- */
async function renderPairs(fetchQ){
  $('ptabs').innerHTML = [['fav', '★ Favourites'], ['Forex', 'Forex'], ['Metals', 'Metals'], ['Crypto', 'Crypto']].map(([k, t]) => `<button class="pill${st.ptab === k ? ' on' : ''}" data-pt="${k}">${t}</button>`).join('');
  const qq = $('pSearch').value.trim().toUpperCase().replace('/', '');
  let L = PAIRS.filter(p => qq ? SPECS[p].n.includes(qq) : st.ptab === 'fav' ? st.favs.includes(p) : SPECS[p].group === st.ptab);
  const star = on => `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? '#e8c35a' : 'none'}" stroke="${on ? '#e8c35a' : '#5c574c'}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  const draw = () => $('pList').innerHTML = L.length ? L.map(p => { const q = st.q[p], sp = SPECS[p], act = p === st.pair;
    return `<div style="display:flex;align-items:center;gap:12px;padding:11px 12px;${act ? 'background:rgba(232,195,90,0.10);border:1px solid rgba(232,195,90,0.5);border-radius:14px' : 'border-top:1px solid rgba(232,195,90,0.08)'}">
<button data-star="${p}" style="background:none;border:0;padding:4px">${star(st.favs.includes(p))}</button><button data-pick="${p}" style="flex:1;display:flex;align-items:center;background:none;border:0;color:inherit;text-align:left;padding:0">
<div style="flex:1"><div style="font-weight:800;font-size:15px">${sp.n}</div><div style="font-size:11px;color:var(--mu)">${esc(sp.title)}</div></div>
<div style="text-align:right" class="mono"><div style="font-weight:700;font-size:15px">${q ? fmt(p, q.p) : '—'}</div><div style="font-size:11px;font-weight:700;color:${q && q.chg < 0 ? 'var(--dn2)' : 'var(--up)'}">${q ? (q.chg >= 0 ? '+' : '') + q.chg.toFixed(2) + '%' : ''}</div></div></button></div>` }).join('')
    : '<div class="note" style="text-align:center;padding:20px">कोई pair नहीं — ★ दबाकर favourite बनाएँ</div>';
  draw();
  if(fetchQ){ try{ Object.assign(st.q, await quotes(K(), L.length ? L : PAIRS)); draw() }catch(e){} }
}

/* ---------------- SETTINGS ---------------- */
async function renderSet(){
  const s = K(), F = s.from;
  const kr = (name, ok, from) => `<div class="sr">${name}<em style="color:${ok ? 'var(--up)' : 'var(--dn2)'}">${ok ? '✓ ' + (from === 'samu' ? 'SamuSignal से' : from === 'manual' ? 'खुद डाली' : 'default') : '✗ नहीं मिली'}</em></div>`;
  const f = await feedStatus(s, true);
  $('kList').innerHTML = `<div class="sr">SamuSignal इस browser में<em style="color:${s.samuN ? 'var(--up)' : 'var(--dn2)'}">${s.samuN ? '✓ मिला (' + s.samuN + ' settings)' : '✗ नहीं मिला'}</em></div><div class="sr" style="font-size:12px;font-weight:500">Address<em>${esc(location.host + location.pathname)}</em></div>` + kr('Firebase URL', !!s.fbUrl, F.fbUrl) + kr('Firebase Auth', !!s.fbAuth || true, F.fbAuth || 'default').replace('✓ default', s.fbAuth ? '✓' : '— (बिना auth)') +
    kr('TwelveData', !!s.tdKey, F.tdKey) + kr('Gemini (AI)', !!s.gKey, F.gKey) +
    `<div class="sr">📡 MT5 Data Feed<em style="color:${f.ok ? 'var(--up)' : 'var(--gold)'}">${f.ok ? 'ON · ' + esc(f.meta.n || '') + ' symbols' : esc(f.why)}</em></div>` +
    (!s.samuN && !s.tdKey && !s.gKey && !s.fbAuth ? `<div class="sr" style="font-size:12px;color:var(--gold);font-weight:500">SamuSignal की keys नहीं मिलीं — दोनों ऐप इसी फ़ोन के एक ही browser (Chrome) में और ankushchhajed7-cmd.github.io पर खुलें, या नीचे खुद डालें।</div>` : '');
  $('aList').innerHTML = '<div class="sr note">Loading…</div>';
  accounts(s).then(A => { $('aList').innerHTML = A.length ? A.map(a => `<div class="sr"><span style="width:8px;height:8px;border-radius:50%;background:${a.online ? 'var(--up)' : 'var(--mu2)'}"></span><div><b style="color:${a.real ? 'var(--up)' : 'var(--gold)'}">${a.real ? 'REAL' : 'DEMO'} ${esc(a.login)}</b><div class="note">${esc(a.server || '')} · lot ${(+a.lot || 0).toFixed(2)} · ${a.online ? 'online' : 'offline'}</div></div><em class="mono" style="color:var(--tx);font-size:14px;font-weight:800">${esc(a.cur || '')} ${(+a.bal || 0).toFixed(2)}</em></div>`).join('')
    : '<div class="sr note">कोई PERSONAL FX account नहीं मिला</div>' }).catch(e => { $('aList').innerHTML = `<div class="sr note">${esc(e.message)}</div>` });
  const tg = (k, on) => `<button class="tg${on ? ' on' : ''}" data-tg="${k}"><i></i></button>`;
  $('prefs').innerHTML = `<div class="sr">🤖 AI check (Gemini दूसरी राय)<span style="margin-left:auto"></span>${tg('aiOn', LS.get('aiOn', true))}</div>
<div class="sr">Data source<em><select id="srcSel" style="background:#14151a;color:var(--tx);border:1px solid var(--line);border-radius:8px;padding:6px"><option value="auto">Auto (MT5 → TwelveData)</option><option value="td">सिर्फ़ TwelveData</option></select></em></div>
<div class="sr">Signal timeframe<em>15m + 1H</em></div><div class="sr">Order type<em>सिर्फ़ BUY LIMIT / SELL LIMIT</em></div>`;
  $('srcSel').value = LS.get('src', 'auto');
  $('ver').textContent = 'v' + VERSION;
}

/* ---------------- SamuSignal keys: "SAI1:<code>" / "#keys=<code>" link / JSON ---------------- */
export function parseKeys(str){
  let t = String(str || '').trim();
  const h = t.indexOf('#keys='); if(h >= 0) t = t.slice(h + 6);
  if(t.startsWith('SAI1:')) t = t.slice(5);
  t = t.replace(/\s+/g, '');
  const j = t.startsWith('{') ? JSON.parse(t) : JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))));
  const out = {}; ['fbUrl', 'fbAuth', 'tdKey', 'gKey'].forEach(k => { if(j[k]) out[k] = String(j[k]).trim() });
  if(!Object.keys(out).length) throw new Error('code me koi key nahi');
  return out;
}
function importKeys(str){
  const k = parseKeys(str), ov = Object.assign(LS.get('ov', {}), k); LS.set('ov', ov);
  toast('✅ Keys आ गईं: ' + Object.keys(k).map(x => ({fbUrl: 'Firebase', fbAuth: 'Auth', tdKey: 'TwelveData', gKey: 'Gemini'}[x])).join(', '));
  return k;
}

/* ---------------- refresh: purana cache hatao, naya version lo ---------------- */
async function hardRefresh(){
  toast('🔄 Refresh… नया version ला रहे हैं');
  try{ const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : []; await Promise.all(regs.map(r => r.update().catch(() => {}))) }catch(e){}
  try{ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))) }catch(e){}
  setTimeout(() => location.reload(), 400);
}

/* ---------------- nav ---------------- */
function show(sc){
  st.scr = sc; document.querySelectorAll('.scr').forEach(x => x.classList.toggle('on', x.id === 's-' + sc));
  document.querySelectorAll('nav.bar a[data-s]').forEach(a => a.classList.toggle('on', a.dataset.s === sc || (sc === 'res' && a.dataset.s === 'home')));
  window.scrollTo(0, 0);
  if(sc === 'home') loadHome();
  if(sc === 'his'){ renderHis(); refreshResults().then(renderHis) }
  if(sc === 'pairs') renderPairs(true);
  if(sc === 'set') renderSet();
}
function boot(){
  document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = icon(e.dataset.ic, e.dataset.ic === 'spark' ? '#1a1408' : 'currentColor', e.dataset.ic === 'spark' && e.closest('.fab') ? 28 : e.dataset.ic === 'spark' ? 18 : 22) });
  $('splashLogo').innerHTML = logo(104); $('splashVer').textContent = 'v' + VERSION; $('hVer').textContent = 'v' + VERSION; $('refBtn').innerHTML = icon('ref', '#e8c35a', 18);
  $('refBtn').onclick = hardRefresh; $('hLogo').innerHTML = logo(42); $('icDown').innerHTML = icon('down', '#a39a86', 18);
  $('resBack').innerHTML = icon('back', '#f3efe6', 18); $('hisRef').innerHTML = icon('ref', '#e8c35a', 18); $('hGauge').innerHTML = gauge(64, 36, 50);
  $('nav').addEventListener('click', e => { const a = e.target.closest('a'); if(!a) return; e.preventDefault(); if(a.id === 'fab') runAnalyze(); else show(a.dataset.s) });
  $('tfs').addEventListener('click', e => { const b = e.target.closest('[data-tf]'); if(!b) return; st.tf = b.dataset.tf; LS.set('tf', st.tf); homeChart && homeChart.ch.priceScale('right').applyOptions({autoScale: true}); loadHome() });
  $('pairBtn').onclick = () => show('pairs');
  document.body.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if(o) openRes(o.dataset.open) });
  $('resBack').onclick = () => show(st.hist.find(x => x.id === st.cur && x.sym === st.pair) ? 'home' : 'his');
  $('bRe').onclick = () => { const r = st.hist.find(x => x.id === st.cur); if(r && SPECS[r.sym]){ st.pair = r.sym; LS.set('pair', r.sym); runAnalyze(r.sym) } };
  $('bMt5').onclick = onMt5; $('bTook').onclick = onTook;
  $('hisRef').onclick = async () => { toast('Refreshing…'); await refreshResults(); renderHis() };
  $('hf').onclick = e => { const b = e.target.closest('[data-hf]'); if(b){ st.hf = b.dataset.hf; renderHis() } };
  $('hk').onclick = e => { const b = e.target.closest('[data-hk]'); if(b){ st.hk = b.dataset.hk; renderHis() } };
  $('ptabs').onclick = e => { const b = e.target.closest('[data-pt]'); if(b){ st.ptab = b.dataset.pt; $('pSearch').value = ''; renderPairs(true) } };
  $('pSearch').oninput = () => renderPairs(false);
  $('pList').onclick = e => { const s = e.target.closest('[data-star]'), p = e.target.closest('[data-pick]');
    if(s){ const x = s.dataset.star; st.favs = st.favs.includes(x) ? st.favs.filter(y => y !== x) : [...st.favs, x]; LS.set('favs', st.favs); renderPairs(false) }
    else if(p){ st.pair = p.dataset.pick; LS.set('pair', st.pair); homeChart && homeChart.ch.priceScale('right').applyOptions({autoScale: true}); show('home') } };
  $('prefs').onclick = e => { const t = e.target.closest('[data-tg]'); if(t){ LS.set(t.dataset.tg, !LS.get(t.dataset.tg, true)); renderSet() } };
  $('prefs').onchange = e => { if(e.target.id === 'srcSel'){ LS.set('src', e.target.value); toast('Data source बदला') } };
  $('kcSave').onclick = () => { const v = $('kcIn').value; if(!v.trim()) return toast('पहले code paste करें');
    try{ importKeys(v); $('kcIn').value = ''; renderSet(); setTimeout(() => loadHome(), 300) }catch(e){ toast('Code गलत है — SamuSignal से दोबारा copy करें') } };
  $('kcClip').onclick = async () => { try{ const v = await navigator.clipboard.readText(); if(!v) throw 0; $('kcIn').value = v; $('kcSave').click() }catch(e){ toast('Clipboard नहीं पढ़ा — खाने में लंबा दबाकर Paste करें') } };
  $('ovSave').onclick = () => { const ov = LS.get('ov', {}); [['fbUrl', 'ovFb'], ['fbAuth', 'ovFa'], ['tdKey', 'ovTd'], ['gKey', 'ovG']].forEach(([k, id]) => { const v = $(id).value.trim(); if(v) ov[k] = v; $(id).value = '' });
    LS.set('ov', ov); toast('Saved'); renderSet() };
  $('clrHist').onclick = async () => { if(await dlg('History साफ़ करें?', 'सारे signals और नतीजे इस फ़ोन से हट जाएँगे।', 'साफ़ करो', 'Cancel')){ st.hist = []; saveHist(); toast('साफ़ हो गया') } };
  $('shotIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if(f) fromShot(f) };
  /* v1.0.1: "#keys=<base64 JSON>" link se keys (SamuSignal doosre browser / address par ho tab) — hash server pe nahi jaata, padhte hi URL se hata dete hain */
  if(location.hash.startsWith('#keys=')){
    try{ importKeys(location.hash) }catch(e){ toast('Keys link गलत है') }
    history.replaceState(null, '', location.pathname + location.search);
  }
  setTimeout(() => $('splash').classList.add('hide'), 900);
  loadHome();
  setInterval(() => { if(document.hidden) return;
    if(st.scr === 'home') loadHome(true);
    if(st.scr === 'res') refreshOrders() }, st.src === 'td' ? 60000 : 12000);
  setInterval(() => { if(!document.hidden) refreshResults().then(() => { if(st.scr === 'his') renderHis(); renderHomeCard() }) }, 120000);
}
boot();
