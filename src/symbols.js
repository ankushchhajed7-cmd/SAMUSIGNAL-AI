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
/* v1.20.0: forex ke hisse (Pairs page tabs + Scanner filter) — Majors (USD wale) / EUR / GBP / AUD+NZD / CAD+CHF+JPY cross */
const fxCat = (b, q) => b === 'USD' || q === 'USD' ? 'Majors' : b === 'EUR' ? 'EUR' : b === 'GBP' ? 'GBP' : b === 'AUD' || b === 'NZD' ? 'AUDNZD' : 'CCJ';
FX.forEach(p => {
  const [b, q] = p.split('/'), jpy = q === 'JPY';
  SPECS[p] = {sym: p, n: b + q, d: jpy ? 3 : 5, pip: jpy ? 0.01 : 0.0001, group: 'Forex', cat: fxCat(b, q), title: NAMES[b] + ' / ' + NAMES[q]};
});
export const GROUPS = [['Majors', 'Majors'], ['EUR', 'EUR Cross'], ['GBP', 'GBP Cross'], ['AUDNZD', 'AUD / NZD'], ['CCJ', 'CAD / CHF / JPY'], ['Metals', 'Metals'], ['Crypto', 'Crypto']];
SPECS['XAU/USD'] = {sym: 'XAU/USD', n: 'XAUUSD', d: 2, pip: 0.10, group: 'Metals', cat: 'Metals', title: 'Gold / US Dollar'};
SPECS['BTC/USD'] = {sym: 'BTC/USD', n: 'BTCUSD', d: 2, pip: 1, group: 'Crypto', cat: 'Crypto', title: 'Bitcoin / US Dollar'};
export const PAIRS = Object.keys(SPECS);
export const fromName = n => PAIRS.find(p => SPECS[p].n === String(n || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)) || null;
export const fmt = (sym, v) => (v === null || v === undefined || !isFinite(v)) ? '—' : (+v).toFixed(SPECS[sym] ? SPECS[sym].d : 5);
/* 4 / 2 digit "short" — 1.12450 -> 1.1245 (design jaisa) */
export const fmtS = (sym, v) => { const sp = SPECS[sym]; if(!isFinite(v)) return '—'; const d = sp ? (sp.d === 5 ? 4 : sp.d === 3 ? 2 : sp.d) : 4; return (+v).toFixed(d) };

/* v1.6.0: 1 pip ki keemat USD me (lot ke hisaab se). Forex 1 lot = 100000, Gold = 100 oz, BTC = 1.
   Quote currency -> USD: live bhaav (rates) ho to wahi, warna andaza. */
export function pipUsd(sym, lot = 0.01, rates = {}){
  const sp = SPECS[sym]; if(!sp) return 0;
  const contract = sp.group === 'Forex' ? 100000 : sym === 'XAU/USD' ? 100 : 1;
  const r = (p, d) => (rates[p] > 0 ? rates[p] : d), q = sym.split('/')[1];
  const toUsd = {USD: 1, JPY: 1 / r('USD/JPY', 157), CHF: 1 / r('USD/CHF', 0.817), CAD: 1 / r('USD/CAD', 1.38), GBP: r('GBP/USD', 1.31),
    EUR: r('EUR/USD', 1.124), AUD: r('AUD/USD', 0.70), NZD: r('NZD/USD', 0.565)}[q] || 1;
  return sp.pip * contract * lot * toUsd;
}
