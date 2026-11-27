/* 📝 S6 PAPER — PERSONAL FX v10.5 (Strategy 6) ke NIYAM, bina asli paise (pure logic, test hota hai). UI: decide.js
   Main 0.01 (Judge ki disha) -> har $3 par ulta hedge 0.01 (STOP) · naya hedge sirf jab upar wale saare us bhaav par profit me
   (kam se kam 1.5 doori) · lock +$2 -> +$1, NEECHE SE; na bane to jodi (aakhri 2) +$1, phir tikdi (aakhri 3) +$1 ·
   band ke baad wahi bhaav par dobara (aadhe gap tak) · doosra trade main ke bhaav par (cycle me hedge khula tha, ek baar) ·
   band: NET (pakka + khule) $2 · CYCLE TP (main faayde me) $2 · BASKET TP (main ghate me) $2 · main akela / main + doosra TP $2 · SL −$60.
   Bhaav: MT5 feed ki 1-min candles (bid) — har candle o -> (h/l) -> c, chhote kadam me; ask = bid + spread. */

export const PAPER_VERSION = '1.0.0';
export const CFG = {gapUsd: 3, lockArm: 2, lock: 1, net: 2, cycle: 2, basket: 2, tp: 2, sl: 60, b2: true};
const MAXEV = 250;

const plPos = (side, o, bid, ask, k) => side > 0 ? (bid - o) * k : (o - ask) * k;   /* 0.01 lot ka $ */
const r2 = v => Math.round(v * 100) / 100;

/* dir: +1 BUY main / -1 SELL main · k = 0.01 lot par bhaav 1.0 = kitne $ · sp = spread (bhaav me) · d = digits */
export function newPaper({id, sym, name, dir, at, bid, k, sp, d = 2, ai = null}){
  const ask = bid + sp, open = dir > 0 ? ask : bid;
  const P = {id, sym, name: name || sym, dir, at, k, sp, d, ai, open, H: [], R: {}, banked: 0, b2: null, b2used: false, had: false,
    pairArm: null, tripArm: null, done: false, res: null, pl: 0, endT: null, uid: 0, used: 0, locks: 0, pairs: 0, trips: 0,
    minTot: 0, minAt: at, minPx: bid, minNet: 0, maxH: 0, lastT: at, prevBid: bid, prevAsk: ask, lastPx: bid, coarse: false, ev: []};
  ev(P, at, `${dir > 0 ? 'BUY' : 'SELL'} main 0.01 @ ${open.toFixed(d)}`);
  return P;
}
function ev(P, t, m){ P.ev.push({t, m}); if(P.ev.length > MAXEV) P.ev.splice(1, P.ev.length - MAXEV) }
const gapPx = (P, C) => C.gapUsd / P.k;
const lvl = (P, C, n) => P.open - P.dir * n * gapPx(P, C);

function close(P, t, bid, reason, total){
  P.done = true; P.res = reason; P.endT = t; P.pl = r2(P.banked + total);
  ev(P, t, `🏁 ${reason} · cycle band @ ${bid.toFixed(P.d)} · kul ${P.pl >= 0 ? '+' : '−'}$${Math.abs(P.pl).toFixed(2)}`);
}
function slotFree(P, C, h, bid, ask){
  const g = gapPx(P, C), L = lvl(P, C, h.n), px = P.dir > 0 ? bid : ask;
  const beyond = P.dir > 0 ? px < L : px > L;
  if(beyond) P.R[h.n] = P.dir > 0 ? Math.max(px, L - 0.5 * g) : Math.min(px, L + 0.5 * g);
  else delete P.R[h.n];
}

/* ek bhaav (bid) par EA jaisa ek tick */
export function tick(P, t, bid, C = CFG){
  if(P.done) return;
  const k = P.k, dir = P.dir, sp = P.sp, ask = bid + sp, g = gapPx(P, C), d = P.d;
  const tag = h => `#${h.n} ${dir > 0 ? 'SELL' : 'BUY'} ${h.o.toFixed(d)}`;
  P.H.sort((a, b) => dir * (P.open - a.o) - dir * (P.open - b.o));          /* sabse neeche (main se door) aakhri */
  const hpl = P.H.map(h => plPos(-dir, h.o, bid, ask, k));
  const mainPL = plPos(dir, P.open, bid, ask, k), b2PL = P.b2 ? plPos(dir, P.b2.o, bid, ask, k) : 0;
  const tot = mainPL + hpl.reduce((a, b) => a + b, 0) + b2PL, net = P.banked + tot;
  if(tot < P.minTot){ P.minTot = tot; P.minAt = t; P.minPx = bid }
  if(net < P.minNet) P.minNet = net;
  P.lastT = t;
  /* ---- cycle band ---- */
  if(net >= C.net) return close(P, t, bid, 'NET +$' + C.net, tot);
  if(!P.H.length){
    if(P.b2){
      if(mainPL + b2PL >= C.tp) return close(P, t, bid, 'TP (main + doosra)', tot);
      if(mainPL + b2PL <= -C.sl) return close(P, t, bid, 'BASKET SL', tot);
    }else if(mainPL >= C.tp) return close(P, t, bid, 'TP (main)', tot);
  }else{
    const need = mainPL >= 0 ? C.cycle : C.basket;
    if(tot >= need) return close(P, t, bid, mainPL >= 0 ? 'CYCLE TP' : 'BASKET TP', tot);
    if(tot <= -C.sl) return close(P, t, bid, 'BASKET SL', tot);
  }
  /* ---- lock: neeche se, phir jodi, phir tikdi ---- */
  if(P.H.length){
    P.had = true;
    P.H.forEach((h, i) => { if(!h.armed && hpl[i] > Math.max(C.lock, C.lockArm)){ h.armed = true; ev(P, t, `🔒 lock chalu ${tag(h)} (+$${hpl[i].toFixed(2)} @ ${bid.toFixed(d)})`) } });
    const n = P.H.length, b = P.H[n - 1], pb = hpl[n - 1];
    const shut = (idx, kind) => {
      let s = 0; const hs = idx.map(i => P.H[i]);
      idx.forEach(i => { s += hpl[i] });
      P.banked += s;
      hs.forEach(h => slotFree(P, C, h, bid, ask));
      P.H = P.H.filter(h => !hs.includes(h));
      ev(P, t, `✅ ${kind} band ${hs.map(tag).join(' + ')} · ${s >= 0 ? '+' : '−'}$${Math.abs(s).toFixed(2)} @ ${bid.toFixed(d)}`);
      P.pairArm = null; P.tripArm = null;
    };
    if(b.armed){
      if(pb <= C.lock){ shut([n - 1], 'lock'); P.locks++; P.prevBid = bid; P.prevAsk = ask; return }
    }else if(n >= 2){
      const comb = hpl[n - 2] + pb;
      if(comb > C.lock && P.pairArm !== b.id){ P.pairArm = b.id; ev(P, t, `🔗 jodi chalu ${tag(P.H[n - 2])} + ${tag(b)} (+$${comb.toFixed(2)})`) }
      if(P.pairArm === b.id && comb <= C.lock){ shut([n - 2, n - 1], 'jodi'); P.pairs++; P.prevBid = bid; P.prevAsk = ask; return }
      if(n >= 3 && P.pairArm !== b.id){
        const c3 = comb + hpl[n - 3];
        if(c3 > C.lock && P.tripArm !== b.id){ P.tripArm = b.id; ev(P, t, `🔗 tikdi chalu (aakhri 3, +$${c3.toFixed(2)})`) }
        if(P.tripArm === b.id && c3 <= C.lock){ shut([n - 3, n - 2, n - 1], 'tikdi'); P.trips++; P.prevBid = bid; P.prevAsk = ask; return }
      }
    }
  }
  /* ---- doosra trade: main ke bhaav par, main ki disha (cycle me hedge khula tha, ek baar) ---- */
  if(C.b2 && !P.b2 && !P.b2used && P.had){
    const cross = dir > 0 ? (P.prevAsk < P.open && ask >= P.open) : (P.prevBid > P.open && bid <= P.open);
    if(cross){ P.b2 = {o: P.open, t}; P.b2used = true; ev(P, t, `➕ doosra ${dir > 0 ? 'BUY' : 'SELL'} 0.01 @ ${P.open.toFixed(d)} (main ke bhaav par)`) }
  }
  /* ---- naya hedge (STOP bharna) ---- */
  const depth = dir * (P.open - (dir > 0 ? Math.min(bid, P.prevBid) : Math.max(ask, P.prevAsk)));
  const nmax = Math.min(400, Math.max(1, Math.floor(depth / g) + 3));
  const occ = new Set(P.H.map(h => h.n));
  for(let n = 1; n <= nmax; n++){
    const L = lvl(P, C, n);
    let re = P.R[n] !== undefined;
    if(re && (dir > 0 ? bid > L : ask < L)){ delete P.R[n]; re = false }
    if(occ.has(n)) continue;
    const T = re ? (dir > 0 ? Math.max(P.R[n], L - 0.5 * g) : Math.min(P.R[n], L + 0.5 * g)) : L;
    const cross = dir > 0 ? (P.prevBid > T && bid <= T) : (P.prevAsk < T && ask >= T);
    if(!cross) continue;
    if(P.H.some(h => Math.abs(h.o - T) < 0.5 * g)) continue;                                  /* kam se kam 1.5 doori */
    if(P.H.some(h => dir > 0 ? T > h.o - sp : T < h.o + sp)) continue;                       /* upar wale us bhaav par profit me nahi */
    const prevDeep = P.H.length ? P.H[P.H.length - 1] : null;
    const h = {id: ++P.uid, n, o: T, t, armed: false};
    P.H.push(h); occ.add(n); P.used++; delete P.R[n];
    if(P.H.length > P.maxH) P.maxH = P.H.length;
    ev(P, t, `🔻 hedge ${tag(h)} khula (level ${n}${re ? ', wahi bhaav' : ''}) · khule ${P.H.length}`);
    if(prevDeep && dir * (P.open - T) > dir * (P.open - prevDeep.o)){                        /* jodi lock bharte hi (v8.8) */
      const cf = (Math.abs(T - prevDeep.o) - 2 * sp) * k;
      if(cf > C.lock) P.pairArm = h.id;
    }
  }
  P.prevBid = bid; P.prevAsk = ask;
}

/* ek candle (bid o,h,l,c): o -> (pehle h ya l) -> c, chhote kadam me */
export function feedBar(P, bar, C = CFG){
  if(P.done) return;
  const g = gapPx(P, C), step = Math.max(g / 40, 1e-9);
  const pts = bar.c >= bar.o ? [bar.o, bar.l, bar.h, bar.c] : [bar.o, bar.h, bar.l, bar.c];
  let from = P.lastPx;
  for(const to of pts){
    const n = Math.max(1, Math.ceil(Math.abs(to - from) / step));
    for(let i = 1; i <= n && !P.done; i++) tick(P, bar.t, from + (to - from) * i / n, C);
    from = to; if(P.done) break;
  }
  P.lastPx = bar.c; P.lastBarT = bar.t;
}

/* abhi ka haal (live bhaav par, kuch badle bina) */
export function snapshot(P, bid){
  const ask = bid + P.sp, k = P.k, dir = P.dir;
  const main = plPos(dir, P.open, bid, ask, k), hs = P.H.map(h => ({n: h.n, o: h.o, armed: h.armed, pl: r2(plPos(-dir, h.o, bid, ask, k))}));
  const b2 = P.b2 ? plPos(dir, P.b2.o, bid, ask, k) : 0, tot = main + hs.reduce((a, h) => a + h.pl, 0) + b2;
  return {main: r2(main), b2: P.b2 ? r2(b2) : null, hedges: hs, total: r2(tot), net: r2(P.banked + tot), banked: r2(P.banked)};
}

export function paperStats(list){
  const D = list.filter(p => p.done);
  const w = D.filter(p => p.pl > 0).length, sl = D.filter(p => /SL/.test(p.res)).length;
  const sum = r2(D.reduce((a, p) => a + p.pl, 0));
  const avgDD = D.length ? r2(D.reduce((a, p) => a + p.minTot, 0) / D.length) : 0;
  const worstDD = D.length ? r2(Math.min(...D.map(p => p.minTot))) : 0;
  const avgMin = D.length ? Math.round(D.reduce((a, p) => a + (p.endT - p.at), 0) / D.length / 60000) : 0;
  return {n: D.length, open: list.length - D.length, w, sl, sum, avgDD, worstDD, avgMin};
}
