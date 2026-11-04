/* Pairs — SamuSignal jaise naam. n = broker / MT5 feed naam (EURUSD), d = digits, pip = 1 pip */
export const FX = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD',
  'EUR/JPY', 'EUR/GBP', 'EUR/CHF', 'EUR/CAD', 'EUR/AUD', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/CAD', 'GBP/AUD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
  'NZD/JPY', 'NZD/CHF', 'NZD/CAD',
  'CAD/CHF', 'CAD/JPY', 'CHF/JPY'
];
const NAMES = {USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen', CHF: 'Swiss Franc', CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar', NZD: 'NZ Dollar'};
export const SPECS = {};
FX.forEach(p => {
  const [b, q] = p.split('/'), jpy = q === 'JPY';
  SPECS[p] = {sym: p, n: b + q, d: jpy ? 3 : 5, pip: jpy ? 0.01 : 0.0001, group: 'Forex', title: NAMES[b] + ' / ' + NAMES[q]};
});
SPECS['XAU/USD'] = {sym: 'XAU/USD', n: 'XAUUSD', d: 2, pip: 0.10, group: 'Metals', title: 'Gold / US Dollar'};
SPECS['BTC/USD'] = {sym: 'BTC/USD', n: 'BTCUSD', d: 2, pip: 1, group: 'Crypto', title: 'Bitcoin / US Dollar'};
export const PAIRS = Object.keys(SPECS);
export const fromName = n => PAIRS.find(p => SPECS[p].n === String(n || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)) || null;
export const fmt = (sym, v) => (v === null || v === undefined || !isFinite(v)) ? '—' : (+v).toFixed(SPECS[sym] ? SPECS[sym].d : 5);
/* 4 / 2 digit "short" — 1.12450 -> 1.1245 (design jaisa) */
export const fmtS = (sym, v) => { const sp = SPECS[sym]; if(!isFinite(v)) return '—'; const d = sp ? (sp.d === 5 ? 4 : sp.d === 3 ? 2 : sp.d) : 4; return (+v).toFixed(d) };
