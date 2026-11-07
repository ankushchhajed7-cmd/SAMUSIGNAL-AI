/* NEWS AI BRIEF v1.4.0 — Gemini + Google Search se live ख़बरों का सार (XAUUSD / EURUSD).
   Sirf jaankari + apna alag hisaab (WIN/LOSS 30 min baad). MT5 ya signal ko kuch nahi bhejta.
   Purane Gemini (Council) ka hisaab yahan sirf PADHA jaata hai (cLedger) — wahan kuch badalta nahi. */
import {LS} from './data.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.5-flash'];
export const JUDGE_MIN = 30;                      /* kitni der baad nateeja */
export const FLAT = {'XAU/USD': 1.0, 'EUR/USD': 0.0003};   /* itne se kam hilna = FLAT (gold 10 pip = $1, EURUSD 3 pip) */
const BIAS = ['UP', 'DOWN', 'NEUTRAL'];

/* ---------- pure logic (test hota hai) ---------- */
const norm = v => { const x = String(v || '').toUpperCase(); return x.includes('UP') || x.includes('BUY') || x.includes('TEZI') ? 'UP' : x.includes('DOWN') || x.includes('SELL') || x.includes('MANDI') ? 'DOWN' : 'NEUTRAL' };
export function parseBrief(text){
  const t = String(text || '');
  const pick = re => { const m = t.match(re); return m ? m[1].trim() : '' };
  const xau = norm(pick(/XAUUSD\s*[:=-]\s*([^\n]+)/i)), eur = norm(pick(/EURUSD\s*[:=-]\s*([^\n]+)/i));
  const sum = pick(/SAAR\s*[:=-]\s*([\s\S]*?)(?:\n\s*(?:KHABAR|XAUUSD|EURUSD)\s*[:=-]|$)/i).replace(/\s+/g, ' ').slice(0, 400);
  const heads = [...t.matchAll(/^\s*[-•*]\s*(.+)$/gm)].map(m => m[1].trim().slice(0, 160)).slice(0, 5);
  if(!pick(/XAUUSD\s*[:=-]\s*([^\n]+)/i) && !pick(/EURUSD\s*[:=-]\s*([^\n]+)/i)) return null;
  return {xau, eur, sum, heads};
}
/* bias sahi tha? p0 = brief ke time ka bhaav, p1 = 30 min baad */
export function judge(bias, p0, p1, sym){
  if(!BIAS.includes(bias) || bias === 'NEUTRAL' || !(p0 > 0) || !(p1 > 0)) return null;
  const d = p1 - p0, fl = FLAT[sym] || 0;
  if(Math.abs(d) < fl) return 'FLAT';
  return (bias === 'UP') === (d > 0) ? 'WIN' : 'LOSS';
}
/* list me har record: {xau, eur, p0:{sym:p}, p1:{sym:p}|null} -> {sym:{win,loss,flat,n,pct}} */
export function ledger(list){
  const out = {'XAU/USD': {win: 0, loss: 0, flat: 0}, 'EUR/USD': {win: 0, loss: 0, flat: 0}};
  (list || []).forEach(r => { if(!r.p1) return;
    [['XAU/USD', r.xau], ['EUR/USD', r.eur]].forEach(([sym, b]) => { const j = judge(b, (r.p0 || {})[sym], r.p1[sym], sym);
      if(j) out[sym][j.toLowerCase()]++ }) });
  Object.values(out).forEach(o => { o.n = o.win + o.loss; o.pct = o.n ? Math.round(o.win / o.n * 100) : null });
  return out;
}
/* purane Gemini (Council) ka hisaab: cLedger = {id: {usd, win, agree}} */
export function councilLedger(L){
  const v = Object.values(L || {}).filter(x => x && typeof x.win === 'boolean');
  const win = v.filter(x => x.win).length, n = v.length;
  return {n, win, loss: n - win, pct: n ? Math.round(win / n * 100) : null, usd: Math.round(v.reduce((a, x) => a + (+x.usd || 0), 0) * 100) / 100};
}

/* ---------- Gemini + Google Search ---------- */
const PROMPT = `Tum ek forex/gold news analyst ho. Google Search se pichhle kuch ghanton ki sabse taaza, bharosemand ख़बरें dekho (US data, Fed, USD, gold, EUR, geopolitics).
Sirf neeche ke format me jawab do (koi aur text nahi):
XAUUSD: UP ya DOWN ya NEUTRAL
EURUSD: UP ya DOWN ya NEUTRAL
SAAR: 2-3 chhote Hindi (Hinglish) vaakya — kyun.
KHABAR:
- ek ख़बर (chhoti)
- ek ख़बर
- ek ख़बर
UP/DOWN ka matlab: agle 30 minute me us pair ki keemat upar/neeche. Pakka na ho to NEUTRAL likho. Guess mat karo.`;
export async function fetchBrief(key){
  if(!key) throw new Error('Gemini key nahi (SamuSignal Settings me daalo)');
  const errs = [];
  for(const m of [LS.get('gOk', ''), ...MODELS].filter((x, i, a) => x && a.indexOf(x) === i)){
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 45000);
    try{
      const r = await fetch(`${BASE}/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ac.signal,
        body: JSON.stringify({contents: [{parts: [{text: PROMPT}]}], tools: [{google_search: {}}], generationConfig: {temperature: 0.2, maxOutputTokens: 900}})});
      const j = await r.json().catch(() => ({}));
      if(!r.ok){ errs.push(((j.error && j.error.message) || 'HTTP ' + r.status).split(key).join('***')); continue }
      const c = (j.candidates || [])[0] || {};
      const txt = ((c.content || {}).parts || []).map(x => x.text || '').join('');
      const b = parseBrief(txt); if(!b){ errs.push(m + ': format galat'); continue }
      const src = (((c.groundingMetadata || {}).groundingChunks) || []).map(x => x.web).filter(w => w && /^https?:\/\//.test(w.uri)).slice(0, 4).map(w => ({t: String(w.title || w.uri).slice(0, 60), u: w.uri}));
      return Object.assign(b, {src, model: m});
    }catch(e){ errs.push(e.name === 'AbortError' ? m + ' slow' : String(e.message).split(key).join('***')) }finally{ clearTimeout(tm) }
  }
  throw new Error(errs.find(e => /quota|rate|exhaust|429/i.test(e)) ? 'Gemini की limit पूरी — थोड़ी देर बाद' : (errs[0] || 'AI fail').slice(0, 120));
}
