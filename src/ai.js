/* Gemini (SamuSignal wali key) — 2 kaam:
   1) AI check: engine ke signal pe doosri raay (haan / na + 1 line) — signal ko rokta nahi.
   2) Screenshot: chart ki photo se BUY LIMIT / SELL LIMIT. */
import {LS} from './data.js';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const TIMEOUT = 40000;
function think(m){ const v = parseFloat((m.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0); return v >= 3 ? {thinkingLevel: 'low'} : /2\.5|flash-latest/.test(m) ? {thinkingBudget: 0} : null }
async function call(key, model, parts, noThink){
  const cfg = {temperature: 0.3, maxOutputTokens: 1500, responseMimeType: 'application/json'};
  const th = noThink ? null : think(model); if(th) cfg.thinkingConfig = th;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), TIMEOUT);
  try{
    const r = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
      signal: ac.signal, body: JSON.stringify({contents: [{parts}], generationConfig: cfg})});
    const j = await r.json().catch(() => ({}));
    if(!r.ok){ const msg = (j.error && j.error.message) || 'HTTP ' + r.status;
      if(th && r.status === 400 && /think/i.test(msg)) return call(key, model, parts, true);
      throw Object.assign(new Error(msg.split(key).join('***')), {code: r.status}) }
    const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join('');
    const m = txt.match(/\{[\s\S]*\}/); if(!m) throw new Error('AI ne JSON nahi diya');
    return JSON.parse(m[0]);
  }catch(e){ if(e.name === 'AbortError') throw new Error(model + ' slow'); throw e }finally{ clearTimeout(t) }
}
async function ask(key, parts, pref){
  if(!key) throw new Error('Gemini key nahi (SamuSignal Settings me daalo)');
  const good = LS.get('gOk', ''), list = [...new Set([good, pref, ...MODELS].filter(Boolean))];
  let last;
  for(const m of list){ try{ const out = await call(key, m, parts); LS.set('gOk', m); return out }catch(e){ last = e } }
  throw last || new Error('AI fail');
}
export async function aiCheck(s, sym, sig, b15){
  const rows = b15.slice(-60).map(b => [b.o, b.h, b.l, b.c].map(v => +v.toFixed(5)).join(',')).join('\n');
  const prompt = `You are a strict forex price-action reviewer. Pair ${sym}, 15-minute candles (oldest first, o,h,l,c):\n${rows}\n\n` +
    `Proposed trade: ${sig.dir} LIMIT at ${sig.entry}, stop ${sig.sl}, target ${sig.tp[0]}, current price ${sig.live}. Valid 60 minutes.\n` +
    `Judge ONLY from the candles: is this direction and pullback entry sensible right now?\n` +
    `Reply JSON only: {"agree": true or false, "confidence": 0-100 integer, "reason": "one short sentence in simple Hinglish (Hindi in Roman letters)"}`;
  const j = await ask(s.gKey, [{text: prompt}], s.gModel);
  return {agree: !!j.agree, conf: Math.max(0, Math.min(100, Math.round(+j.confidence || 0))), reason: String(j.reason || '').slice(0, 160)};
}
export async function aiShot(s, b64, mime, names){
  const prompt = `You are a professional price-action trader reading a trading chart screenshot.
Give ONE pending LIMIT order only (never market, never stop): trend direction, wait for the pullback.
BUY LIMIT entry must be BELOW the current price; SELL LIMIT entry must be ABOVE the current price.
Entry at the 50-61.8% pullback zone of the last impulse, stop beyond the pullback (tight), one target at 1R.
Always give a trade (no "no trade"); if the setup is weak or counter-trend, set grade "C".
Read every number from the price axis — never invent levels. If it is not a price chart set "dir" to "UNREADABLE".
Use this exact symbol spelling if it matches: ${names}
Reply JSON only:
{"symbol":"", "timeframe":"", "dir":"BUY or SELL or UNREADABLE", "current_price":0, "entry":0, "sl":0, "tp1":0, "grade":"A or B or C", "reason":"one short sentence in simple Hinglish"}`;
  return ask(s.gKey, [{text: prompt}, {inline_data: {mime_type: mime, data: b64}}], s.gModel);
}
