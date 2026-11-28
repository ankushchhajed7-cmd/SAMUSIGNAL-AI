/* 🎯 BUY YA SELL? v1.2.0 (app v1.41.0: + 📝 Paper trade, EA v10.5 niyam) · v1.1.0 (app v1.40.0: + 🏔 Structure + 🧭 Alignment agent, Judge 1m rejection, bante agent = ⏸) · v1.0.0 (app v1.39.0) — user 27 Nov 2026: trade lene se pehle — 5 AI agent (Gemini) apni raay,
   phir aapas me BEHES, phir ⚖️ JUDGE ek faisla: abhi BUY ya SELL, +$1 / +$2 scalp (0.01 lot), kitni sambhavna.
   Data: MT5 feed (1m / 5m / 15m / 1H), na mile to TwelveData. 🚀 MT5: /personalfx/orders MARKET (PERSONAL FX EA, lot = EA ka).
   Record: 1-min candles se pehle +$T ya −$T (60 min). localStorage: sai_dc_* . SamuSignal app me bhi yahi page hai (v10.10.0). */
import {LS, keys, series, quotes, feedStatus, fbUrl} from './data.js';
import {SPECS, PAIRS, fmt, pipUsd} from './symbols.js';
import {accounts, orderKey, ORDER_ST, EXP_MIN} from './bridge.js';
import {AGENTS, TFS, MAX_MS, tfSummary, candleStr, session, parseVote, parseJudge, outcome, stats, isSplit} from './deciderules.js';
import {newPaper, feedBar, snapshot, paperStats} from './s6paper.js';   /* v1.41.0: 📝 paper trade (EA v10.5 niyam) */

const $ = id => document.getElementById(id);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const IST = {timeZone: 'Asia/Kolkata'};
const hm = t => new Date(t).toLocaleTimeString('en-GB', {...IST, hour: '2-digit', minute: '2-digit', hour12: false});
const vc = v => v === 'SELL' ? 'var(--dn)' : 'var(--up)';
function toast(m){ const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', 2600) }

const S = {papers: LS.get('dc_papers', []), popen: new Set(), pNote: '', sym: LS.get('dc_sym', 'XAU/USD'), tgt: LS.get('dc_tgt', 1), busy: false, step: '', last: LS.get('dc_last', null),
  hist: LS.get('dc_hist', []), accts: [], pick: LS.get('dc_acct', []), send: null};
if(!SPECS[S.sym]) S.sym = 'XAU/USD';

/* ---------- Gemini: JSON; News agent Google Search ke saath (tab JSON mime nahi chalta, isliye text se JSON nikaalte) ---------- */
const GB = 'https://generativelanguage.googleapis.com/v1beta';
/* v1.41.1: model list key se (Google jo chalu rakhe wahi), band model yaad (24 ghante), quota (429) par agla model,
   aakhri galti me sabse kaam ki wajah (limit > vyast > baaki), ek saath max 3 sawaal (per-minute limit na bhare) */
const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
const DEAD = /no longer available|not found|is not supported|deprecat|update your code/i;
const think = m => { const v = parseFloat((m.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0); return v >= 3 ? {thinkingLevel: 'low'} : /2\.5|flash-latest/.test(m) ? {thinkingBudget: 0} : null };
function pickJson(txt){
  const m = String(txt || '').replace(/```json|```/g, '').match(/\{[\s\S]*\}/); if(!m) return null;
  try{ return JSON.parse(m[0]) }catch(e){ return null }
}
const rank = m => { const v = parseFloat((m.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0); return v * 10 + (/latest/.test(m) ? 25 : 0) - (/lite/.test(m) ? 3 : 0) - (/preview|exp|thinking/.test(m) ? 8 : 0) - (/pro/.test(m) ? 12 : 0) };
const deadList = () => { if(Date.now() - LS.get('gDeadAt', 0) > 864e5){ LS.set('gDead', []); LS.set('gDeadAt', Date.now()) } return LS.get('gDead', []) };
const markDead = m => LS.set('gDead', [...new Set([...LS.get('gDead', []), m])].slice(-20));
let gListP = null;
async function models(key){
  const c = LS.get('gList', null);
  if(c && Date.now() - c.at < 6 * 3600e3 && c.list.length) return c.list;
  if(!gListP) gListP = fetch(`${GB}/models?key=${encodeURIComponent(key)}&pageSize=200`).then(r => r.ok ? r.json() : {}).then(j => {
    const list = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''))
      .filter(m => /^gemini-/.test(m) && /flash/.test(m) && !/image|tts|audio|live|embed/.test(m));
    if(list.length) LS.set('gList', {at: Date.now(), list});
    return list;
  }).catch(() => []).finally(() => { gListP = null });
  return await gListP;
}
async function gem(key, prompt, search){
  if(!key) throw new Error('Gemini key nahi — SamuSignal Settings me daalo');
  const dead = deadList(), avail = await models(key);
  const pool = (avail.length ? avail : MODELS).filter(m => !dead.includes(m)).sort((a, b) => rank(b) - rank(a));
  const list = [...new Set([LS.get('gOk', ''), ...pool].filter(m => m && pool.includes(m)))].slice(0, 5);
  if(!list.length){ LS.set('gDead', []); throw new Error('Koi Gemini model nahi mila — thodi der baad dobara (list saaf kar di)') }
  const errs = [];
  for(const useSearch of search ? [true, false] : [false]){
    for(const m of list){
      for(const noTh of [false, true]){
        const cfg = {temperature: 0.4, maxOutputTokens: 1500};
        if(!useSearch) cfg.responseMimeType = 'application/json';
        const th = noTh ? null : think(m); if(th) cfg.thinkingConfig = th;
        const body = {contents: [{parts: [{text: prompt}]}], generationConfig: cfg};
        if(useSearch) body.tools = [{google_search: {}}];
        const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 45000);
        try{
          const r = await fetch(`${GB}/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: ac.signal});
          const j = await r.json().catch(() => ({}));
          if(!r.ok){
            const msg = String((j.error && j.error.message) || 'HTTP ' + r.status).split(key).join('***');
            if(th && r.status === 400 && /think/i.test(msg)) continue;          /* bina thinking ke dobara */
            if(r.status === 404 || DEAD.test(msg)){ markDead(m); if(LS.get('gOk', '') === m) LS.set('gOk', ''); errs.push({k: 3, m: m + ' band'}) }
            else if(r.status === 429 || /quota|exhaust|rate/i.test(msg)) errs.push({k: 1, m: 'Gemini ki limit poori (free key) — 1-2 min baad dobara, ya kal'});
            else if(r.status >= 500 || /high demand|overload|unavailable/i.test(msg)) errs.push({k: 2, m: 'Gemini abhi vyast hai — thodi der baad dobara'});
            else errs.push({k: 4, m: msg.slice(0, 140)});
            break;
          }
          const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join('');
          const out = pickJson(txt);
          if(out){ LS.set('gOk', m); out._search = useSearch; return out }
          errs.push({k: 4, m: 'AI ka jawab samajh nahi aaya'}); break;
        }catch(e){ errs.push({k: 2, m: e && e.name === 'AbortError' ? m + ' ne der kar di' : (e && e.message) || 'network'}); break }
        finally{ clearTimeout(tm) }
      }
    }
  }
  errs.sort((a, b) => a.k - b.k);
  throw new Error(errs.length ? errs[0].m : 'Gemini nahi chala');
}
/* ek saath max n kaam */
async function pool(items, n, fn){
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({length: Math.min(n, items.length)}, async () => { while(i < items.length){ const k = i++; out[k] = await fn(items[k], k) } }));
  return out;
}

/* ---------- analysis ---------- */
async function run(){
  if(S.busy) return;
  const s = keys(), sym = S.sym, tgt = +S.tgt || 1, sp = SPECS[sym];
  if(!s.gKey){ toast('Gemini key nahi — SamuSignal Settings me daalo'); return }
  S.busy = true; S.send = null; render();
  const step = t => { S.step = t; const el = $('dcStep'); if(el) el.innerHTML = t };
  try{
    step('<span class="spin">◐</span> 1/4 · candles (1m · 5m · 15m · 1H)…');
    await feedStatus(s, true);                                 /* pehle feed ki haalat (warna 4 saath-saath call me race: feed 'band' dikhta) */
    const got = await Promise.all(TFS.map(([, tf]) => series(s, sym, tf, 250, true)));
    const B = {}; TFS.forEach(([l], i) => B[l] = got[i].bars);
    if(B['15m'].length < 60 || B['1H'].length < 60) throw new Error('Candles poori nahi mili');
    const q = (await quotes(s, [sym], true))[sym] || {};
    const live = q.p > 0 ? q.p : B['1m'][B['1m'].length - 1].c;
    const usdU = pipUsd(sym, 0.01) / sp.pip;                 /* 0.01 lot par bhaav 1.0 = kitne $ */
    const src = got[1].src === 'mt5' ? 'MT5 feed (Exness)' : 'TwelveData';
    const tf = {}; TFS.forEach(([l]) => tf[l] = tfSummary(B[l], usdU));
    let cal = ''; try{ const r = await fetch(fbUrl(s, 'feed/news/cal'), {cache: 'no-store'}); if(r.ok) cal = JSON.stringify(await r.json()).slice(0, 1800) }catch(e){}
    const ctx = {pair: sp.n, livePrice: live, istTime: hm(Date.now()), session: session(),
      goal: `SCALP: 0.01 lot, target +$${tgt} (= ${(tgt / usdU).toFixed(sp.d)} bhaav), seedha MARKET entry abhi. Sirf BUY ya SELL chunna hai.`,
      spreadUsd: q.sp > 0 ? +(q.sp * usdU).toFixed(2) : null, timeframes: tf,
      candles5m_last12_ohlc: candleStr(B['5m'], 12, sp.d), candles1m_last15_ohlc: candleStr(B['1m'], 15, sp.d)};
    const base = `Tum ek trading team ke agent ho. Data (asli, abhi ka):\n${JSON.stringify(ctx)}\n\n`;
    const fmtQ = '\n\nSirf JSON do: {"vote":"BUY" ya "SELL","conf":50-95 (kitna pakka),"why":"1-2 chhoti line simple Hinglish, numbers ke saath","watch":"ek line: kis baat se tumhari raay galat ho sakti hai"}';

    step('<span class="spin">◐</span> 2/4 · 7 agent apni raay de rahe hain…');
    const r1 = await pool(AGENTS, 3, a => gem(s.gKey, base + a.job + (a.k === 'news' ? `\nMT5 calendar (raw): ${cal || 'nahi mila'}` : '') + fmtQ, a.search)
      .then(o => Object.assign({k: a.k, search: !!o._search}, parseVote(o))).catch(e => ({k: a.k, err: e.message})));
    const ok1 = r1.filter(x => !x.err);
    if(ok1.length < 3) throw new Error('Sirf ' + ok1.length + ' agent ne jawab diya — ' + ((r1.find(x => x.err) || {}).err || ''));
    const nm = k => AGENTS.find(a => a.k === k).n;
    const round1 = ok1.map(x => `${nm(x.k)}: ${x.vote} ${x.conf}% — ${x.why} (khatra: ${x.watch})`).join('\n');

    step('<span class="spin">◐</span> 3/4 · agents aapas me behes kar rahe hain…');
    let r2 = null, r2err = '';
    try{
      const o = await gem(s.gKey, base + `Pehle round me agents ne ye kaha:\n${round1}\n\nAb BEHES: har agent doosron ke tark padh kar seedha jawab de — kisse sehmat, kisse nahi aur kyun; chahe to apni raay badle (sirf achhe tark par). ` +
        'Sirf JSON: {"agents":[{"name":"<wahi naam>","reply":"1-2 line Hinglish, kisi aur agent ka naam lekar","vote":"BUY|SELL","conf":50-95}]}', false);
      r2 = Array.isArray(o.agents) ? o.agents.slice(0, 8).map(x => ({name: String(x.name || '').slice(0, 40), reply: String(x.reply || '').slice(0, 300), vote: /SELL/i.test(x.vote) ? 'SELL' : 'BUY', conf: Math.round(+x.conf || 0)})) : null;
    }catch(e){ r2err = e.message }
    const round2 = r2 ? r2.map(x => `${x.name}: ${x.vote} ${x.conf}% — ${x.reply}`).join('\n') : '(behes nahi ho payi)';

    step('<span class="spin">◐</span> 4/4 · ⚖️ Judge faisla de raha hai…');
    const jd = parseJudge(await gem(s.gKey, base + `Tum JUDGE ho (head trader). Round 1:\n${round1}\n\nBehes ke baad:\n${round2}\n\n` +
      `Ab ek hi faisla do: ABHI MARKET par +$${tgt} ke scalp ke liye BUY ya SELL — jisme pehle +$${tgt} aane ki sambhavna zyada ho (pehle −$${tgt} aane se). ` +
      `Scalp ke liye 1m (aur 5m) ki TAAZA rejection / palatne wali candle (lambi ulti wick, BOS, divergence) ko PURANE trend se ZYADA wazan do — purana trend ulta ho aur 1m palat raha ho to us disha me mat jao, ya waitBetter true. ` +
      `Agents bante hon (jaise 4-3) ya saaf na ho to prob 50-58 aur waitBetter true. ` +
      `Sach bolo: bazaar saaf na ho to prob kam (50-58) rakho. prob = tumhara andaza ki pehle +$${tgt} aayega (50-85).\n` +
      'Sirf JSON: {"verdict":"BUY|SELL","prob":50-85,"why":"2-3 line Hinglish, sabse mazboot tark + numbers","against":"1 line: ulta kya ho sakta hai","waitBetter":true/false (abhi ruk jaana behtar? jaise High news paas, bahut chop),"minutes":"andaza, target me kitne min (jaise 3-10)"}', false));
    S.last = Object.assign({at: Date.now(), sym, tgt, live, usdU, src, spread: q.sp > 0 ? q.sp : null, tf, r1, r2, r2err, split: isSplit(r1)}, jd);
    LS.set('dc_last', S.last);
    S.hist.unshift({at: S.last.at, sym, tgt, dir: jd.verdict, prob: jd.prob, px: live, usdU, wait: jd.wait || S.last.split, ag: ok1.filter(x => x.vote === jd.verdict).length + '/' + ok1.length});
    S.hist = S.hist.slice(0, 150); LS.set('dc_hist', S.hist);
    step(`✓ ${hm(S.last.at)} · ${esc(src)} · 9 AI sawaal`);
  }catch(e){
    step(`<span style="color:var(--dn)">❌ ${esc(e.message || String(e))}</span>`);
  }finally{ S.busy = false; render(); loadAccts() }
}

/* ---------- 🚀 MT5 ---------- */
async function loadAccts(){
  try{ S.accts = (await accounts(keys())).filter(a => a.online) }catch(e){ S.accts = [] }
  if(!S.pick.length && S.accts.length) S.pick = [S.accts[0].login];
  render();
}
async function send(){
  const d = S.last, s = keys();
  if(!d){ toast('Pehle ANALYZE karo'); return }
  if(Date.now() - d.at > MAX_MS){ toast('Faisla 5 min se purana — dobara ANALYZE'); render(); return }
  const sp = SPECS[d.sym], dir = d.verdict;
  const chosen = S.accts.filter(a => S.pick.includes(a.login));
  if(S.accts.length && !chosen.length){ toast('Kam se kam ek account chuno'); return }
  const real = chosen.some(a => a.real);
  const q = (await quotes(s, [d.sym], true))[d.sym] || {}, live = q.p > 0 ? q.p : d.live;
  const msg = `🎯 ${sp.n} ${dir} MARKET\nAI: ${dir} ${d.prob}% (+$${d.tgt} scalp)\nLive ${fmt(d.sym, live)}\n` +
    (chosen.length ? 'Account: ' + chosen.map(a => (a.real ? 'REAL ' : 'DEMO ') + a.login).join(', ') : '⚠ Koi PERSONAL FX account online nahi dikha — bina account ke jayega') +
    (real ? '\n\n🔴🔴 REAL ACCOUNT — asli paisa! Pakka?' : '') + (d.prob < 60 ? '\n\n⚠ Sambhavna 60% se kam.' : '') + (d.wait ? '\n⚠ Judge ne rukne ko kaha tha.' : '') + (d.split ? '\n⚠ Agents bante hue the (⏸ ABHI MAT LO).' : '') +
    '\n\nLot, TP, hedge: PERSONAL FX ke niyam (us pair pe trade pehle se ho to EA SKIP karega).\n\nMT5 pe bhejein?';
  if(!confirm(msg)) return;
  const now = Date.now(), batch = 'D' + now.toString(36), keysSent = [];
  try{
    for(const a of (chosen.length ? chosen : [null])){
      const key = orderKey(now + keysSent.length);
      const body = {id: now + keysSent.length, pair: sp.n, type: dir + 'MARKET', entry: 0, live: +(+live).toFixed(sp.d), at: now, exp: EXP_MIN, status: 'NEW',
        src: 'SAMUSIGNAL AI DECIDE', batch, leg: 1, legs: 1};
      if(a) body.acct = a.login;
      const r = await fetch(fbUrl(s, 'personalfx/orders/' + key), {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      if(!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Firebase ne mana kiya (auth)' : 'HTTP ' + r.status);
      keysSent.push({key, acct: a ? (a.real ? 'REAL ' : 'DEMO ') + a.login : ''});
    }
  }catch(e){ if(!keysSent.length){ alert('Order nahi gaya — ' + e.message); return } toast('Kuch account par nahi gaya: ' + e.message) }
  toast(`Gaya — ${sp.n} ${dir} MARKET`);
  S.send = {keys: keysSent, st: {}}; render();
  for(let i = 0; i < 40; i++){
    for(const k of keysSent){ try{ const r = await fetch(fbUrl(s, 'personalfx/orders/' + k.key), {cache: 'no-store'}); if(r.ok){ const o = await r.json(); if(o) S.send.st[k.key] = o } }catch(e){} }
    renderSend();
    if(keysSent.every(k => S.send.st[k.key] && S.send.st[k.key].status && S.send.st[k.key].status !== 'NEW')) return;
    await new Promise(r => setTimeout(r, 3000));
  }
  S.send.slow = true; renderSend();
}
function renderSend(){
  const el = $('dcSend'); if(!el || !S.send) return;
  const col = c => ({up: 'var(--up)', dn: 'var(--dn)', gold: 'var(--gold)', mu: 'var(--mu)'}[c] || 'var(--mu)');
  el.innerHTML = S.send.keys.map(k => { const o = S.send.st[k.key] || {}, s = o.status || 'NEW', L = ORDER_ST[s] || [s, 'mu'];
    return `<div class="row" style="border:1px solid ${col(L[1])};border-radius:10px;padding:8px 10px;margin-top:6px;display:block"><b style="color:${col(L[1])}">${esc(L[0])}</b>${k.acct ? ' · ' + esc(k.acct) : ''}
      <div class="note mono">${esc(String(o.msg || o.note || o.res || (s === 'NEW' ? 'EA order padh raha hai…' : '')))}</div></div>` }).join('') +
    (S.send.slow ? '<p class="note">2 min me EA ka jawab nahi — PERSONAL FX chalu hai? (WebRequest / AppPollSec)</p>' : '');
}

/* ---------- 📝 PAPER TRADE — EA v10.5 (Strategy 6) ke niyam, asli paisa nahi ----------
   Page khula ho to har 30 sec MT5 feed ki BAND 1-min candles se aage chalta hai. App band tha to khulte hi pichhla hisaab:
   1-min candles (~4 ghante tak), usse purana 5-min candles (~20 ghante tak; thoda kam sateek). */
const DT = t => new Date(t).toLocaleString('en-GB', {...IST, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false});
const DUR = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' मि' : Math.floor(m / 60) + ' घं ' + (m % 60) + ' मि' };
const usd2 = v => (v >= 0 ? '+$' : '−$') + Math.abs(+v || 0).toFixed(2);
const savePapers = () => { S.papers = S.papers.slice(0, 100); LS.set('dc_papers', S.papers) };
async function paperStart(){
  const d = S.last, s = keys();
  if(!d){ toast('Pehle ANALYZE karo'); return }
  if(Date.now() - d.at > MAX_MS){ toast('Faisla 5 min se purana — dobara ANALYZE'); return }
  if(S.papers.some(p => !p.done && p.sym === d.sym)){ toast(SPECS[d.sym].n + ' par paper cycle pehle se chalu (EA jaisa: ek pair ek cycle)'); return }
  const q = (await quotes(s, [d.sym], true))[d.sym] || {}, bid = q.p > 0 ? q.p : d.live;
  const sp = q.sp > 0 ? q.sp : (d.spread > 0 ? d.spread : SPECS[d.sym].pip * 2);
  const P = newPaper({id: 'P' + Date.now().toString(36), sym: d.sym, name: SPECS[d.sym].n, dir: d.verdict === 'BUY' ? 1 : -1, at: Date.now(), bid,
    k: d.usdU, sp, d: SPECS[d.sym].d, ai: {prob: d.prob, hold: !!(d.prob < 60 || d.wait || d.split), tgt: d.tgt}});
  P.lastBarT = Math.floor(Date.now() / 60000) * 60000;      /* is minute ki bann rahi candle ke baad se */
  P.live = bid;
  S.papers.unshift(P); S.popen.add(P.id); savePapers(); render();
  toast(`📝 Paper ${d.verdict} ${SPECS[d.sym].n} @ ${fmt(d.sym, P.open)} — EA v10.5 niyam`);
}
async function paperUpdate(){
  const open = S.papers.filter(p => !p.done); if(!open.length) return;
  const s = keys(), fs = await feedStatus(s);
  if(!fs.ok){ S.pNote = '⚠ MT5 feed band (' + (fs.why || '') + ') — paper ruka hai, feed aate hi aage chalega'; render(); return }
  S.pNote = '';
  for(const sym of [...new Set(open.map(p => p.sym))]){
    let b1; try{ b1 = (await series(s, sym, '1min', 250)).bars }catch(e){ continue }
    const now = Date.now(), c1 = b1.filter(b => b.t + 60000 <= now);
    for(const P of open.filter(p => p.sym === sym)){
      if(c1.length && P.lastBarT < c1[0].t - 60000){          /* bahut der band tha -> beech ka 5-min candles se */
        try{
          const b5 = (await series(s, sym, '5min', 250)).bars.filter(b => b.t + 300000 <= now && b.t > P.lastBarT && b.t + 300000 <= c1[0].t);
          if(!b5.length || b5[0].t - P.lastBarT > 450000) P.gap = true;
          b5.forEach(b => feedBar(P, b)); if(b5.length) P.coarse = true;
        }catch(e){ P.gap = true }
      }
      c1.filter(b => b.t > P.lastBarT).forEach(b => feedBar(P, b));
      try{ const q = (await quotes(s, [sym]))[sym]; if(q && q.p > 0) P.live = q.p }catch(e){}
    }
  }
  savePapers(); render();
}
function paperClose(id){
  const P = S.papers.find(p => p.id === id); if(!P || P.done) return;
  if(!confirm('Ye paper cycle abhi ke bhaav par band karein?')) return;
  const sn = snapshot(P, P.live || P.lastPx);
  P.done = true; P.res = 'HAATH SE'; P.endT = Date.now(); P.pl = sn.net;
  P.ev.push({t: P.endT, m: `🏁 HAATH SE band @ ${(+(P.live || P.lastPx)).toFixed(P.d)} · kul ${usd2(P.pl)}`});
  savePapers(); render();
}
function paperCard(){
  const L = S.papers, st = paperStats(L);
  const row = P => {
    const dn = P.dir > 0 ? 'BUY' : 'SELL', col = P.dir > 0 ? 'var(--up)' : 'var(--dn)';
    let head, body = '';
    if(!P.done){
      const sn = snapshot(P, P.live || P.lastPx);
      head = `<b style="color:${col}">${dn}</b> ${esc(P.name)} @ ${P.open.toFixed(P.d)} · <span style="color:var(--gold)">chalu ${DUR(Date.now() - P.at)}</span> · <b style="color:${sn.net >= 0 ? 'var(--up)' : 'var(--dn)'}">net ${usd2(sn.net)}</b>`;
      body = `<div class="lv"><div>Khule<b>${usd2(sn.total)}</b></div><div class="t">Pakka<b>${usd2(sn.banked)}</b></div><div class="s">Sabse gehra DD<b>${usd2(P.minTot)}</b></div></div>
        <div class="note" style="margin-top:6px">Main ${usd2(sn.main)}${sn.b2 !== null ? ' · doosra ' + usd2(sn.b2) : ''} · bhaav ${(+(P.live || P.lastPx)).toFixed(P.d)}</div>
        ${sn.hedges.length ? sn.hedges.map(h => `<div class="row mono"><span>#${h.n} ${P.dir > 0 ? 'SELL' : 'BUY'} ${h.o.toFixed(P.d)}</span><span>${h.armed ? '🔒 lock' : ''}</span><b style="color:${h.pl >= 0 ? 'var(--up)' : 'var(--dn)'}">${usd2(h.pl)}</b></div>`).join('') : '<div class="note">Koi hedge khula nahi</div>'}
        <button class="btn red" data-pclose="${esc(P.id)}" style="width:100%;margin-top:8px;height:38px">✖ Paper cycle abhi band karo</button>`;
    }else{
      const win = P.pl > 0;
      head = `${win ? '✅' : '❌'} <b style="color:${col}">${dn}</b> ${esc(P.name)} · ${esc(P.res)} · <b style="color:${win ? 'var(--up)' : 'var(--dn)'}">${usd2(P.pl)}</b>`;
      body = `<div class="lv"><div>Kitna chala<b>${DUR(P.endT - P.at)}</b></div><div class="s">Sabse gehra DD<b>${usd2(P.minTot)}</b></div><div class="e">Hedge<b>${P.used}</b></div></div>
        <div class="note" style="margin-top:6px">Shuru ${DT(P.at)} @ ${P.open.toFixed(P.d)} · band ${DT(P.endT)} · DD ${DT(P.minAt)} par (bhaav ${(+P.minPx).toFixed(P.d)})<br>Lock ${P.locks} · jodi ${P.pairs} · tikdi ${P.trips} · ek saath max ${P.maxH} hedge${P.b2used ? ' · doosra trade khula' : ''}${P.ai ? ' · AI ' + P.ai.prob + '%' + (P.ai.hold ? ' (⏸ tha)' : '') : ''}</div>`;
    }
    const evs = P.ev.slice().reverse().map(e => `<div class="row mono" style="font-size:11.5px"><span class="l2">${DT(e.t)}</span><span style="flex:1;text-align:right">${esc(e.m)}</span></div>`).join('');
    return `<div class="pr" style="margin-bottom:8px"><div style="font-size:13px">${head}</div>
      <div class="note">${DT(P.at)}${P.coarse ? ' · ⚠ kuch hissa 5-min candles se' : ''}${P.gap ? ' · ⚠ beech me data nahi mila' : ''}</div>
      ${body}<details data-pid="${esc(P.id)}" ${S.popen.has(P.id) ? 'open' : ''}><summary class="note" style="margin-top:6px;cursor:pointer">📜 Har ghatna (${P.ev.length})</summary>${evs}</details></div>`;
  };
  return `<div class="card"><h3>📝 Paper trades — EA v10.5 niyam <button id="pClr" style="float:right;background:none;border:0;color:#ff8a95;font-size:10px;font-weight:800">RESET</button></h3>
    <div class="tiles"><div class="tile">Band<b>${st.n}</b></div><div class="tile">Jeete<b style="color:var(--up)">${st.w}</b></div><div class="tile">SL<b style="color:var(--dn)">${st.sl}</b></div><div class="tile">Kul<b>${usd2(st.sum)}</b></div></div>
    <div class="note" style="margin:8px 0">Ausat DD ${usd2(st.avgDD)} · sabse bura DD ${usd2(st.worstDD)} · ausat samay ${st.avgMin} मि · chalu ${st.open}</div>
    ${S.pNote ? `<div class="alert g">${esc(S.pNote)}</div>` : ''}
    ${L.length ? L.slice(0, 30).map(row).join('') : '<div class="empty">Abhi koi paper trade nahi. ANALYZE ke baad "📝 Paper trade" dabao.</div>'}
    <div class="note" style="margin-top:6px">Niyam EA v10.5 jaise: main 0.01 · har $3 hedge 0.01 (naya sirf jab upar wale profit me) · lock +$2 → +$1 neeche se, phir jodi / tikdi · doosra trade main ke bhaav par · NET / CYCLE / BASKET $2 · SL −$60. Bhaav MT5 feed ki 1-min candles, spread gina. Page band ho to khulte hi pichhla hisaab (1-min ~4 ghante, 5-min ~20 ghante).</div></div>`;
}

/* ---------- 📒 record ---------- */
async function check(){
  const todo = S.hist.filter(h => !h.done && Date.now() - h.at > 3 * 60e3); if(!todo.length) return;
  const s = keys(); if(!(await feedStatus(s)).ok) return;                 /* sirf MT5 feed (TwelveData credit nahi) */
  for(const sym of [...new Set(todo.map(h => h.sym))]){
    let bars; try{ bars = (await series(s, sym, '1min', 250)).bars }catch(e){ continue }
    if(!bars || !bars.length) continue;
    todo.filter(h => h.sym === sym).forEach(h => {
      if(bars[0].t > h.at){ if(Date.now() - h.at > 4 * 3600e3){ h.done = true; h.na = true } return }
      h.r1 = outcome(h, bars, 1); h.r2 = outcome(h, bars, 2);
      if(h.r1 && h.r2) h.done = true;
    });
  }
  LS.set('dc_hist', S.hist); render();
}

/* ---------- UI ---------- */
function render(){
  const d = S.last, sp = SPECS[S.sym];
  const pairs = ['XAU/USD'].concat(PAIRS.filter(p => p !== 'XAU/USD'));
  let h = `<div class="card">
    <div class="note" style="margin-bottom:10px">7 AI agent (Trend · Momentum · Level · News · Structure · Alignment · Risk) apni raay dete hain, aapas me behes karte hain, phir ⚖️ Judge ek faisla deta hai.<br>Timeframe: <b>1H</b> mahaul · <b>15m</b> disha · <b>5m</b> setup · <b>1m</b> trigger. Analysis hai, guarantee nahi.</div>
    <div class="sg">Pair</div>
    <select id="dcPair" style="width:100%;height:42px;margin-top:6px;border-radius:12px;background:#0d0d0d;color:var(--tx);border:1px solid var(--line);padding:0 10px;font-weight:800;font-size:15px">
      ${pairs.map(p => `<option value="${esc(p)}" ${p === S.sym ? 'selected' : ''}>${esc(SPECS[p].n)}</option>`).join('')}</select>
    <div class="sg" style="margin-top:10px">Target (0.01 lot)</div>
    <div class="seg">${[1, 2].map(t => `<button data-tgt="${t}" class="${+S.tgt === t ? 'on' : ''}">+$${t}</button>`).join('')}</div>
    <button class="btn gold" id="dcRun" style="width:100%;margin-top:12px" ${S.busy ? 'disabled' : ''}>🧠 ANALYZE — abhi BUY ya SELL?</button>
    <div class="note mono" id="dcStep" style="margin-top:8px">${S.step || 'Gemini key (SamuSignal Settings) chahiye · ek analysis = 9 AI sawaal'}</div></div>`;
  if(d){
    const up = d.verdict === 'BUY', col = vc(d.verdict), old = Date.now() - d.at > MAX_MS, dsp = SPECS[d.sym];
    const hold = d.prob < 60 || d.wait || d.split;               /* v1.40.0: kamzor / bante agent / Judge "ruko" -> ⏸ */
    h += `<div class="card" style="border-color:${col}">
      ${hold ? `<div style="text-align:center;border:2px solid var(--gold);border-radius:14px;padding:10px;margin-bottom:10px"><div style="font-family:Cinzel,serif;font-size:26px;font-weight:700;color:var(--gold)">⏸ ABHI MAT LO</div>
        <div class="note" style="color:#f1dfaa">${[d.split ? 'agents bante hue' : '', d.prob < 60 ? 'sambhavna 60% se kam' : '', d.wait ? 'Judge: rukna behtar' : ''].filter(Boolean).join(' · ')}</div></div>` : ''}
      <div style="text-align:center;${hold ? 'opacity:.55' : ''}"><div class="lbl">${esc(dsp.n)} · +$${d.tgt} SCALP · ${hm(d.at)}</div>
        <div style="font-family:Cinzel,serif;font-size:38px;font-weight:700;letter-spacing:3px;color:${col};margin:4px 0">${up ? '🟢 BUY' : '🔴 SELL'}</div>
        <b style="font-size:20px;color:${col}">${d.prob}% sambhavna</b>
        <div class="note">pehle +$${d.tgt} aayega (−$${d.tgt} se pehle) · ${esc(d.minutes)} min</div></div>
      <p style="margin:10px 0 4px;font-size:13.5px;line-height:1.55"><b>⚖️ Judge:</b> ${esc(d.why)}</p>
      <div class="note">↩ Ulta: ${esc(d.against)}</div>
      ${S.accts.length > 1 ? `<div class="sg" style="margin-top:12px">Account</div>${S.accts.map(a => `<label class="row" style="align-items:center"><span><b style="color:${a.real ? 'var(--dn)' : '#7cc4f0'}">${a.real ? 'REAL' : 'DEMO'} ${esc(a.login)}</b> <span class="note">${esc(a.server || '')} · lot ${(+a.lot || 0).toFixed(2)}</span></span>
        <input type="checkbox" data-acct="${esc(a.login)}" ${S.pick.includes(a.login) ? 'checked' : ''} style="width:22px;height:22px;accent-color:#e8c35a"></label>`).join('')}` :
        S.accts.length === 1 ? `<div class="note" style="margin-top:10px">Account: <b style="color:${S.accts[0].real ? 'var(--dn)' : '#7cc4f0'}">${S.accts[0].real ? 'REAL' : 'DEMO'} ${esc(S.accts[0].login)}</b></div>` : ''}
      <button class="btn" id="dcSendBtn" style="width:100%;margin-top:12px;background:${col};color:#000;font-size:16px;font-weight:900" ${old ? 'disabled' : ''}>${old ? '⏱ 5 min purana — dobara ANALYZE' : `🚀 ${hold ? 'phir bhi ' : ''}MT5 pe ${d.verdict} lagao (MARKET)`}</button>
      <div class="note" style="margin-top:6px">Lot = PERSONAL FX ka lot (0.01) · baaki niyam EA ke (Strategy 6 = hedge, $2 cycle).</div>
      <button class="btn ghost" id="dcPaperBtn" style="width:100%;margin-top:8px" ${old ? 'disabled' : ''}>📝 Paper trade — ${d.verdict} (EA v10.5 niyam, asli paisa nahi)</button>
      <div id="dcSend"></div></div>
    <div class="card"><h3>🗣 Round 1 — har agent</h3>
      ${d.r1.map(x => { const a = AGENTS.find(z => z.k === x.k);
        return `<div class="pr" style="margin-bottom:6px"><b>${a.ic} ${a.n}</b> ${x.err ? `<span class="note">— jawab nahi (${esc(x.err)})</span>` : `· <b style="color:${vc(x.vote)}">${x.vote}</b> ${x.conf}%${x.search ? ' · 🔎' : ''}
          <div class="st" style="color:var(--tx)">${esc(x.why)}</div><div class="st">⚠ ${esc(x.watch)}</div>`}</div>` }).join('')}
      <h3 style="margin-top:12px">💬 Behes (ek doosre ko jawab)</h3>
      ${d.r2 ? d.r2.map(x => `<div style="border-left:3px solid ${vc(x.vote)};padding:4px 10px;margin-bottom:6px"><b>${esc(x.name)}</b> → <b style="color:${vc(x.vote)}">${x.vote}</b> ${x.conf}%<div class="st" style="color:var(--tx)">${esc(x.reply)}</div></div>`).join('')
        : `<div class="note">Behes nahi ho payi${d.r2err ? ' — ' + esc(d.r2err) : ''} (Judge ne Round 1 se faisla kiya)</div>`}
      <h3 style="margin-top:12px">📊 Data jo agents ne dekha <span class="note" style="text-transform:none;letter-spacing:0">${esc(d.src)}</span></h3>
      <table class="mono"><tr><th></th>${TFS.map(([l]) => `<th>${l}</th>`).join('')}</tr>
        ${[['Disha', 'bias'], ['Structure', 'structure'], ['EMA20 dhalaan', 'ema20Slope'], ['RSI', 'rsi'], ['ADX', 'adx'], ['Saaf chaal (ER)', 'effRatio20'], ['ATR $', 'atrUsd'], ['Range %', 'rangePos']].map(([l, k]) =>
          `<tr><td>${l}</td>${TFS.map(([z]) => `<td>${esc(String(d.tf[z][k] === undefined ? '—' : d.tf[z][k]).replace(/ \(.*\)/, ''))}</td>`).join('')}</tr>`).join('')}</table>
      <div class="note" style="margin-top:6px">Live ${fmt(d.sym, d.live)} · spread ${d.spread != null ? '$' + (d.spread * d.usdU).toFixed(2) : '—'}</div></div>`;
  }
  const H = S.hist, st = (k, f) => { const x = stats(H, k, f); return x.n ? `${x.w}/${x.n} (${x.pct}%)` : '—' };
  const ic = r => r === 'W' ? '<b style="color:var(--up)">✓</b>' : r === 'L' ? '<b style="color:var(--dn)">✗</b>' : r === '0' ? '<span class="note">–</span>' : '<span class="note">…</span>';
  h += paperCard();
  h += `<div class="card"><h3>📒 Record — AI kitna sahi <button id="dcClr" style="float:right;background:none;border:0;color:#ff8a95;font-size:10px;font-weight:800">RESET</button></h3>
    <div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile">JUDGE · pehle +$1<b>${st('r1')}</b></div><div class="tile">JUDGE · pehle +$2<b>${st('r2')}</b></div></div>
    <div class="note" style="margin:8px 0">60% se upar wale: $1 ${st('r1', x => x.prob >= 60)}. Spread nahi gina — asli thoda kam.</div>
    ${H.length ? H.slice(0, 25).map(x => `<div class="row mono"><span class="l2">${hm(x.at)}</span><span>${esc(SPECS[x.sym] ? SPECS[x.sym].n : x.sym)}</span>
      <b style="color:${vc(x.dir)}">${x.dir} ${x.prob}%</b><span class="l2">ag ${esc(x.ag || '')}</span><span>$1 ${ic(x.r1)} · $2 ${ic(x.r2)}${x.na ? ' <span class="note">n/a</span>' : ''}</span></div>`).join('') : '<div class="empty">Abhi khaali.</div>'}
    <div class="note" style="margin-top:6px">✓ = pehle target aaya · ✗ = pehle utna hi ulta · – = 60 min me dono nahi · … = abhi chal raha. 1-min candle me dono = ✗.</div></div>`;
  $('main').innerHTML = `<div class="wrap">${h}</div>`;
  $('dcPair').onchange = e => { S.sym = e.target.value; LS.set('dc_sym', S.sym) };
  document.querySelectorAll('[data-tgt]').forEach(b => b.onclick = () => { S.tgt = +b.dataset.tgt; LS.set('dc_tgt', S.tgt); render() });
  $('dcRun').onclick = run;
  if($('dcSendBtn')) $('dcSendBtn').onclick = send;
  if($('dcPaperBtn')) $('dcPaperBtn').onclick = paperStart;
  document.querySelectorAll('[data-pclose]').forEach(b => b.onclick = () => paperClose(b.dataset.pclose));
  document.querySelectorAll('details[data-pid]').forEach(x => x.ontoggle = () => { if(x.open) S.popen.add(x.dataset.pid); else S.popen.delete(x.dataset.pid) });
  if($('pClr')) $('pClr').onclick = () => { if(!confirm('Saare paper trade saaf karein?')) return; S.papers = []; savePapers(); render() };
  document.querySelectorAll('[data-acct]').forEach(c => c.onchange = () => { const l = c.dataset.acct; S.pick = c.checked ? [...new Set([...S.pick, l])] : S.pick.filter(x => x !== l); LS.set('dc_acct', S.pick) });
  $('dcClr').onclick = () => { if(!confirm('Record saaf karein?')) return; S.hist = []; LS.set('dc_hist', S.hist); render() };
  renderSend();
}
function clock(){ const c = $('clock'); if(c) c.innerHTML = `<b>${hm(Date.now())}</b><br>IST` }

render(); clock(); loadAccts(); check(); paperUpdate();
setInterval(() => { if(!document.hidden) paperUpdate() }, 30e3);
document.addEventListener('visibilitychange', () => { if(!document.hidden) paperUpdate() });
setInterval(() => { clock(); check(); if(S.last && !S.last.oldShown && Date.now() - S.last.at > MAX_MS){ S.last.oldShown = true; if(!S.send) render() } }, 60e3);
