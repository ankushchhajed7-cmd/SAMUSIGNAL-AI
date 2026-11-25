/* 🛡️ FX SENTINEL — roz ka report (GitHub Action "Sentinel Daily Report" chalata hai; Claude raat 9:55 IST par padh kar bhejta hai)
   Firebase (public read) se /sentinel/vps + /sentinel/paper padhta hai, sentinelrules.js ke dayReport() se hisaab.
   Chalao: node tools/sentinel-report.mjs [YYYY-MM-DD]   (khaali = aaj IST)
   Env: FB_URL (default app wala), FB_AUTH (optional). Kuch nahi likhta — sirf padhta hai. */
import fs from 'node:fs';
import {dayReport, dayKeyIST, SEN_VERSION} from '../src/sentinelrules.js';

const FB = (process.env.FB_URL || 'https://forexdiagnosis-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/+$/, '');
const AUTH = process.env.FB_AUTH || '';
const day = /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2] || '') ? process.argv[2] : dayKeyIST(Date.now());
const u = (p, q) => `${FB}/${p}.json?${[AUTH ? 'auth=' + encodeURIComponent(AUTH) : '', q || ''].filter(Boolean).join('&')}`;
async function get(p, q){ const r = await fetch(u(p, q)); if(!r.ok) throw new Error(`Firebase ${p} HTTP ${r.status}`); return r.json() }

const hmIST = t => new Date(t).toLocaleTimeString('en-GB', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false});
const $ = v => (v >= 0 ? '+$' : '−$') + Math.abs(+v || 0).toFixed(2);
const R = v => (v >= 0 ? '+' : '') + (+v || 0).toFixed(1) + 'R';

const vps = await get('sentinel/vps').catch(() => null);
const trades = Object.values((await get('sentinel/paper', 'orderBy=%22%24key%22&limitToLast=300').catch(() => null)) || {}).filter(t => t && t.sym);
const rep = dayReport(trades, day);
const age = vps && vps.t ? Math.round((Date.now() / 1000 - vps.t) / 60) : null;
const dLbl = new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'});

const L = [];
L.push(`# 🛡️ FX SENTINEL — Daily Report · ${dLbl}`);
L.push('');
L.push(age === null ? '**VPS:** ⚠️ Sentinel का कोई data नहीं (scanner v1.13 अभी VPS पर नहीं चला)'
  : age <= 3 ? `**VPS:** ✅ चालू · आख़िरी scan ${vps.scanAt ? hmIST(vps.scanAt * 1000) + ' IST' : '—'}${vps.why ? ' · ⚠️ ' + vps.why : ''}`
  : `**VPS:** ⚠️ ${age >= 120 ? Math.round(age / 60) + ' घंटे' : age + ' min'} से चुप${vps.why ? ' (' + vps.why + ')' : ''}`);
L.push('');
L.push(`**आज बंद हुए:** ${rep.n} trade · ✅ ${rep.win} जीते / ❌ ${rep.loss} हारे · Win ${rep.pct === null ? '—' : rep.pct + '%'}`);
L.push(`**Net:** ${$(rep.usd)} (${R(rep.R)}) · TP ${rep.tp} · SL ${rep.sl} · Time ${rep.time}`);
L.push(`**आज लगे:** ${rep.made} · भरे नहीं (expire) ${rep.expired} · अभी चालू ${rep.open} · pending ${rep.pending}`);
const bp = Object.entries(rep.byPair);
if(bp.length){ L.push(''); L.push('**Pair-wise:** ' + bp.map(([k, b]) => `${k} ${b.n} (${b.win} जीत) ${$(b.usd)}`).join(' · ')) }
if(rep.trades.length){
  L.push(''); L.push('| समय (IST) | Pair | दिशा | Score | नतीजा | R | $ |'); L.push('|---|---|---|---|---|---|---|');
  rep.trades.forEach(t => L.push(`| ${hmIST(t.at)}→${hmIST(t.exitAt)} | ${t.sym} | ${t.dir} | ${t.score} | ${t.res} | ${R(t.r)} | ${$(t.usd)} |`));
}
L.push('');
L.push(`**अब तक कुल:** ${rep.total.n} trade · Win ${rep.total.pct === null ? '—' : rep.total.pct + '%'} · ${$(rep.total.usd)} (${R(rep.total.R)})`);
L.push(`<sub>paper only · 0.01 lot · rules v${SEN_VERSION}</sub>`);
const md = L.join('\n');
console.log(md);
console.log('\nREPORT_JSON:' + JSON.stringify({day, vpsAgeMin: age, vpsWhy: vps && vps.why || '', lastScan: vps && vps.scanAt ? hmIST(vps.scanAt * 1000) : null,
  n: rep.n, win: rep.win, loss: rep.loss, pct: rep.pct, usd: rep.usd, R: rep.R, tp: rep.tp, sl: rep.sl, time: rep.time, made: rep.made, expired: rep.expired, open: rep.open, pending: rep.pending,
  byPair: rep.byPair, trades: rep.trades.map(t => ({...t, at: hmIST(t.at), exitAt: hmIST(t.exitAt)})), total: rep.total}));
if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
