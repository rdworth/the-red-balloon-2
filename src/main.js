import './style.css';

(() => {
'use strict';

/* =====================================================================
   Utilities
   ===================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const s2step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
function fbm(x) { return vnoise(x) * .6 + vnoise(x * 2.13 + 5.3) * .28 + vnoise(x * 4.37 + 11.7) * .12; }
function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], t)).toString(16).padStart(2, '0')).join(''); }
function shade(a, f) { const A = hexRgb(a); return '#' + A.map(v => clamp(Math.round(v * f), 0, 255).toString(16).padStart(2, '0')).join(''); }
function rgba(h, a) { const A = hexRgb(h); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
const FILTER_OK = (() => { try { const g = mkCanvas(2, 2).getContext('2d'); g.filter = 'blur(2px)'; return g.filter === 'blur(2px)'; } catch (e) { return false; } })();
function blurred(src, px) { if (!FILTER_OK || px <= 0) return src; const c = mkCanvas(src.width, src.height), g = c.getContext('2d'); g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0); return c; }
function archRect(g, x, y, w, h) { const r = w / 2; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); }
function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot || 0, 0, TAU); }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =====================================================================
   The world. Units: 100 ≈ 1 metre. y grows downward, the building line is y = 0.
   ===================================================================== */
const W0 = 1665, H0 = 900, ASPECT = W0 / H0;
const GAP_X0 = 3600, GAP_X1 = 4240;            // an opening in the street with a view over Paris
const LAMP_X = 3800, LAMP_Y = 52, BAR_Y = LAMP_Y - 335;
const TREE_X = 4340, TREE_Y = 60;
const BOY_Y = 36, BOY_STOP = 3978;
const MORRIS_X = 2800, MORRIS_Y = 50;
const LAMPS = [-450, 450, 1350, 2150, LAMP_X, 4860, 5600];
const HAZE = '#eadccb';

/* ---------------- wind ---------------- */
const GUSTS = [[2.6, 1.5, .55], [8.3, 1.3, .8], [14.4, 1.6, 1.0], [17.6, .9, .5], [23.3, 1.7, .38], [26.8, 1.4, .3]];
function gust(t) { let g = 0; for (const [c, w, a] of GUSTS) { const d = (t - c) / w; g += a * Math.exp(-d * d); } return g; }
function windX(t, x, y) { return 42 + 150 * gust(t) + 28 * vnoise(x * .0032 - t * .55 + y * .002); }
function windY(t, x, y) { return 16 * vnoise(x * .004 + t * .45 + 31.4) - 5; }

/* ---------------- the balloon's flight (centre of the balloon) ---------------- */
const KEYS = [
  [0, -320, -1560], [2.2, -60, -1500], [4.4, 300, -1425], [6.4, 560, -1290], [8.0, 860, -1145],
  [9.4, 1190, -1075], [10.8, 1500, -960], [12.2, 1790, -800], [13.6, 2110, -625], [15.0, 2520, -500],
  [16.4, 2930, -430], [17.6, 3250, -470], [18.8, 3560, -482], [19.9, 3800, -446], [21.0, 4000, -426]];
function keyTan(i) { const n = KEYS.length, a = KEYS[Math.max(0, i - 1)], b = KEYS[Math.min(n - 1, i + 1)]; return [(b[1] - a[1]) / (b[0] - a[0]), (b[2] - a[2]) / (b[0] - a[0])]; }
function pathAt(t) {
  let x, y;
  if (t <= KEYS[0][0]) { const m = keyTan(0); x = KEYS[0][1] + m[0] * t; y = KEYS[0][2] + m[1] * t; }
  else if (t >= KEYS[KEYS.length - 1][0]) { const k = KEYS[KEYS.length - 1], m = keyTan(KEYS.length - 1); x = k[1] + m[0] * (t - k[0]); y = k[2] + m[1] * (t - k[0]); }
  else {
    let i = 0; while (t > KEYS[i + 1][0]) i++;
    const [t0, x0, y0] = KEYS[i], [t1, x1, y1] = KEYS[i + 1], h = t1 - t0, u = (t - t0) / h;
    const m0 = keyTan(i), m1 = keyTan(i + 1), u2 = u * u, u3 = u2 * u;
    const a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, c = -2 * u3 + 3 * u2, d = u3 - u2;
    x = a * x0 + b * h * m0[0] + c * x1 + d * h * m1[0];
    y = a * y0 + b * h * m0[1] + c * y1 + d * h * m1[1];
  }
  const w = 1 - sstep(17.5, 19.2, t);
  return [x + fbm(t * .42 + 2) * 24 * w, y + fbm(t * .5 + 7) * 16 * w];
}

/* =====================================================================
   Simulation: string physics, snag, camera, leaves, boy. Deterministic,
   precomputed once so any moment can be drawn exactly.
   ===================================================================== */
const DT = 1 / 120;
const NR = 18, SEG = 9, KO = 45;               // string particles, link length, balloon centre → knot
const T_MAX = 32;
const NS = Math.ceil(T_MAX / DT) + 2;
const SIM = {};
let TS = 20.4, T_END = 29.8, BAR = 2.55, BOY_T0 = 14;

function simulate() {
  const px = new Float64Array(NR), py = new Float64Array(NR), qx = new Float64Array(NR), qy = new Float64Array(NR);
  const bx = new Float32Array(NS), by = new Float32Array(NS), ba = new Float32Array(NS), rope = new Float32Array(NS * NR * 2);
  let ang = 0, snag = -1, K = -1, pin0x = 0, pin0y = 0, pinTX = 0;
  const start = -3;
  let c = pathAt(start);
  for (let j = 0; j < NR; j++) { px[j] = qx[j] = c[0]; py[j] = qy[j] = c[1] + KO + j * SEG; }
  const s0 = Math.round(start / DT);
  const LB = { x0: LAMP_X - 22, x1: LAMP_X + 22, y0: LAMP_Y - 430, y1: LAMP_Y - 338 };
  for (let s = s0; s < NS; s++) {
    const t = s * DT, dyn = snag >= 0;
    if (!dyn) {
      c = pathAt(t);
      qx[0] = px[0]; qy[0] = py[0];
      px[0] = c[0] - KO * Math.sin(ang); py[0] = c[1] + KO * Math.cos(ang);
    }
    for (let j = dyn ? 0 : 1; j < NR; j++) {
      if (dyn && j === K) continue;
      const vx = (px[j] - qx[j]) / DT, vy = (py[j] - qy[j]) / DT;
      const wx = windX(t, px[j], py[j]), wy = windY(t, px[j], py[j]);
      let ax, ay;
      if (j === 0) { ax = 2.6 * (wx - vx); ay = 2.6 * (wy - vy) - 460; }
      else { ax = 2.2 * (wx - vx); ay = 2.2 * (wy * .5 - vy) + 560; }
      qx[j] = px[j]; qy[j] = py[j];
      px[j] += vx * DT * .999 + ax * DT * DT; py[j] += vy * DT * .999 + ay * DT * DT;
    }
    let pinX = 0, pinY = 0;
    if (dyn) {
      const u = s2step(snag, snag + .14, t);
      pinX = lerp(pin0x, pinTX, u); pinY = lerp(pin0y, BAR_Y - 2.5, u);
      px[K] = qx[K] = pinX; py[K] = qy[K] = pinY;
    }
    for (let it = 0; it < 22; it++) {
      for (let j = 0; j < NR - 1; j++) {
        const w0 = j === 0 ? (dyn ? .3 : 0) : (dyn && j === K ? 0 : 1);
        const w1 = dyn && j + 1 === K ? 0 : 1;
        const ws = w0 + w1; if (ws === 0) continue;
        const dx = px[j + 1] - px[j], dy = py[j + 1] - py[j], d = Math.hypot(dx, dy) || 1e-6;
        const k = (d - SEG) / d / ws;
        px[j] += dx * k * w0; py[j] += dy * k * w0; px[j + 1] -= dx * k * w1; py[j + 1] -= dy * k * w1;
      }
      if (dyn) {
        // the string drapes around the lantern and the column rather than passing through them
        for (let j = 1; j < NR; j++) {
          if (j === K) continue;
          if (j < K && px[j] > LB.x0 && px[j] < LB.x1 && py[j] > LB.y0 && py[j] < LB.y1) {
            const dl = px[j] - LB.x0, dr = LB.x1 - px[j], dt = py[j] - LB.y0;
            if (dt < dl && dt < dr) py[j] = LB.y0; else if (dl < dr) px[j] = LB.x0; else px[j] = LB.x1;
          }
          if (j > K && py[j] > BAR_Y && Math.abs(px[j] - LAMP_X) < 8) px[j] = LAMP_X + (px[j] < LAMP_X ? -8 : 8);
        }
        // the balloon itself bumps off the lantern
        const cx = px[0] + KO * Math.sin(ang), cy = py[0] - KO * Math.cos(ang);
        const nx = clamp(cx, LB.x0, LB.x1), ny = clamp(cy, LB.y0, LB.y1);
        const ddx = cx - nx, ddy = cy - ny, dd = Math.hypot(ddx, ddy);
        if (dd < 33 && dd > 1e-3) { const p = (33 - dd) / dd; px[0] += ddx * p; py[0] += ddy * p; }
      }
    }
    if (!dyn && t > 19) {
      for (let j = 11; j < NR - 1; j++) {
        const ya = py[j] - BAR_Y, yb = py[j + 1] - BAR_Y;
        if (ya <= 0 && yb > 0) {
          const f = ya / (ya - yb), xi = px[j] + (px[j + 1] - px[j]) * f;
          if (xi > LAMP_X + 4 && xi < LAMP_X + 30) { snag = t; K = f < .5 ? j : j + 1; pin0x = px[K]; pin0y = py[K]; pinTX = xi; break; }
        }
      }
      if (snag < 0 && t >= 21.2) { snag = t; K = 14; pin0x = px[K]; pin0y = py[K]; pinTX = LAMP_X + 18; }
    }
    const ux = px[0] - px[1], uy = py[0] - py[1];
    const tgt = Math.atan2(ux, -uy) * (snag >= 0 ? .92 : .55);
    ang += (tgt - ang) * (1 - Math.exp(-DT * (snag >= 0 ? 9 : 5)));
    if (s >= 0) {
      bx[s] = px[0] + KO * Math.sin(ang); by[s] = py[0] - KO * Math.cos(ang); ba[s] = ang;
      for (let j = 0; j < NR; j++) { rope[(s * NR + j) * 2] = px[j]; rope[(s * NR + j) * 2 + 1] = py[j]; }
    }
  }
  Object.assign(SIM, { bx, by, ba, rope, K, pinX: pinTX });
  TS = snag;
  T_END = TS + 9.4;
  BAR = TS / 8;
  BOY_T0 = TS - 6.3;

  /* ---------------- boy ---------------- */
  const boyV = t => t < BOY_T0 ? 0 : 80 * (1 - s2step(TS + .05, TS + 1.3, t));
  let dist = 0;
  const bd = new Float32Array(NS);
  for (let s = 0; s < NS; s++) { bd[s] = dist; dist += boyV(s * DT) * DT; }
  const x0 = BOY_STOP + dist;
  const boyX = new Float32Array(NS), boyPh = new Float32Array(NS), boyAmp = new Float32Array(NS);
  const steps = [];
  let lastStep = null;
  for (let s = 0; s < NS; s++) {
    const t = s * DT;
    boyX[s] = x0 - bd[s];
    boyPh[s] = bd[s] * TAU / 92;
    boyAmp[s] = boyV(t) / 80;
    const k = Math.floor((boyPh[s] + Math.PI / 2) / Math.PI);
    if (t >= BOY_T0 && boyAmp[s] > .12 && lastStep !== null && k !== lastStep) steps.push({ t, x: boyX[s] });
    lastStep = k;
  }
  Object.assign(SIM, { boyX, boyPh, boyAmp, steps });

  /* ---------------- camera ---------------- */
  const cx = new Float32Array(NS), cy = new Float32Array(NS), cz = new Float32Array(NS);
  const Z = [[0, .72], [4, .75], [9, .86], [12.5, 1.0], [17, 1.02], [TS - .5, .98], [TS + 3, 1.03], [T_END, 1.3], [T_MAX, 1.34]];
  const zoomAt = t => { let i = 0; while (i < Z.length - 2 && t > Z[i + 1][0]) i++; const [a, za] = Z[i], [b, zb] = Z[i + 1]; const u = clamp((t - a) / (b - a), 0, 1); return lerp(za, zb, .5 - .5 * Math.cos(Math.PI * u)); };
  let vbx = 0, vby = 0;
  const target = (s, t) => {
    const fy = by[s] + 70 + 150 * (1 - sstep(3.5, 11, t));
    const fx = bx[s] + vbx * .45 + 70;
    const w = s2step(TS - 2.2, TS + 2.4, t);
    return [lerp(fx, 3905, w), lerp(fy, -262, w)];
  };
  let [camx, camy] = target(0, 0), cvx = 0, cvy = 0;
  const om = 2.0;
  for (let s = 0; s < NS; s++) {
    const t = s * DT;
    if (s > 0) {
      const a = 1 - Math.exp(-DT / .5);
      vbx += ((bx[s] - bx[s - 1]) / DT - vbx) * a; vby += ((by[s] - by[s - 1]) / DT - vby) * a;
    }
    const [tx, ty] = target(s, t);
    if (s === 0) { camx = tx; camy = ty; }
    const ax = om * om * (tx - camx) - 2 * om * cvx, ay = om * om * (ty - camy) - 2 * om * cvy;
    cvx += ax * DT; cvy += ay * DT; camx += cvx * DT; camy += cvy * DT;
    const z = zoomAt(t);
    cz[s] = z; cx[s] = camx; cy[s] = Math.min(camy, 300 - 450 / z);
  }
  Object.assign(SIM, { cx, cy, cz });

  /* ---------------- leaves ---------------- */
  const NL = 44, r = mulberry(99);
  const defs = [];
  for (let i = 0; i < 34; i++) defs.push({ t: 9.2 + i * (18.5 / 34) + r() * .4, mode: 0, p: [.85, 1, 1, 1, 1.35, 1.55][(r() * 6) | 0], k: (r() * 6) | 0, rs: (r() - .5) * 7, fs: 2 + r() * 5, seed: r() * 10, ground: 8 + r() * 58 });
  for (let i = 0; i < NL - 34; i++) defs.push({ t: TS - 1.6 + i * .8 + r() * .5, mode: 1, p: 1, k: (r() * 6) | 0, rs: (r() - .5) * 6, fs: 2 + r() * 4, seed: r() * 10, ground: 12 + r() * 50, x: TREE_X - 190 + r() * 330, y: -640 + r() * 200 });
  const LV = new Float32Array(NS * NL * 5);
  const st = defs.map(() => ({ on: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, fl: 0 }));
  for (let s = 0; s < NS; s++) {
    const t = s * DT, z = cz[s], hw = W0 / 2 / z, hh = H0 / 2 / z;
    const camV = s > 0 ? (cx[s] - cx[s - 1]) / DT : 0;
    for (let i = 0; i < NL; i++) {
      const d = defs[i], L = st[i];
      if (!L.on && t >= d.t) {
        L.on = 1; L.rot = d.seed * 3; L.fl = d.seed;
        if (d.mode === 1) { L.x = d.x; L.y = d.y; L.vx = 0; L.vy = 0; }
        else {
          const w = windX(t, cx[s], cy[s]), rel = w - camV;
          if (rel > 25) { L.x = cx[s] * d.p - hw - 40; L.y = cy[s] * d.p + (r() * 1.3 - .85) * hh; }
          else if (rel < -25) { L.x = cx[s] * d.p + hw + 40; L.y = cy[s] * d.p + (r() * 1.3 - .85) * hh; }
          else { L.x = cx[s] * d.p + (r() - .5) * 1.8 * hw; L.y = cy[s] * d.p - hh - 40; }
          L.vx = w * d.p; L.vy = 30 * d.p;
        }
      }
      if (L.on === 1) {
        const wx = windX(t, L.x / d.p, L.y / d.p) * .9, wy = windY(t, L.x, L.y);
        const tvx = (wx + Math.sin(t * 2.1 + d.seed * 6) * 30) * d.p;
        const tvy = (34 + 22 * Math.sin(t * 1.7 + d.seed * 4) + wy) * d.p;
        const a = 1 - Math.exp(-DT * 2.4);
        L.vx += (tvx - L.vx) * a; L.vy += (tvy - L.vy) * a;
        L.x += L.vx * DT; L.y += L.vy * DT;
        L.rot += d.rs * DT * (.6 + gust(t)); L.fl += d.fs * DT;
        if (d.p === 1 && L.y > d.ground && L.y < 90) { L.on = 2; L.y = d.ground; L.fl = 0; }
        if (Math.abs(L.x - cx[s] * d.p) > hw * 1.6 + 400 || L.y > 1400) L.on = 3;
      }
      const o = (s * NL + i) * 5;
      LV[o] = L.x; LV[o + 1] = L.y; LV[o + 2] = L.rot; LV[o + 3] = L.fl; LV[o + 4] = L.on === 1 || L.on === 2 ? L.on : 0;
    }
  }
  Object.assign(SIM, { LV, NL, leafDefs: defs });
}

/* =====================================================================
   Street furniture and buildings
   ===================================================================== */
const FACADES = ['#d8cab2', '#d3c5ad', '#dcd0bc', '#cfc1a9', '#d6c9b3', '#d9ceba'];
const SHOPS = [
  { name: 'BOULANGERIE', col: '#2f4a3e', kind: 'bread' },
  { name: 'LIBRAIRIE', col: '#34395a', kind: 'books' },
  { name: 'FLEURS', col: '#3c4d3a', kind: 'flowers' },
  { name: 'QUINCAILLERIE', col: '#4a3b33', kind: 'hardware' },
  { name: 'CRÈMERIE', col: '#2e4656', kind: 'dairy' },
  { name: 'HORLOGERIE', col: '#3a3346', kind: 'clock' },
  { name: 'PHARMACIE', col: '#2c4540', kind: 'pharma' },
  { name: 'MERCERIE', col: '#43384a', kind: 'books' },
];
const CAFE = { name: 'CAFÉ DES AMIS', col: '#2c463b', kind: 'cafe' };
let BUILDINGS = [];
function genBuildings() {
  const r = mulberry(11), out = [];
  let si = 0;
  for (const [a, b] of [[-1100, GAP_X0], [GAP_X1, 6200]]) {
    let x = a;
    while (x < b - 1) {
      let w = 380 + Math.floor(r() * 4) * 36;
      if (b - (x + w) < 300) w = b - x;
      const fh = 98 + Math.floor(r() * 3) * 4;
      const cols = Math.max(3, Math.round(w / 90));
      const isCafe = x <= 2480 && x + w > 2480;
      const shop = isCafe ? CAFE : SHOPS[si++ % SHOPS.length];
      const bl = { x, w, fh, cornice: -150 - 5 * fh, cols, col: FACADES[(r() * FACADES.length) | 0], shop, doorBay: isCafe ? cols - 1 : (r() < .5 ? 0 : cols - 1), seed: r() * 1000, num: 12 + out.length * 2 };
      bl.stackW = 40 + r() * 26; bl.pots = 3 + ((r() * 4) | 0);
      bl.dormer = []; for (let c = 0; c < cols; c++) bl.dormer.push(r() < .82);
      bl.boxes = []; for (let i = 0; i < 30; i++) bl.boxes.push(r());
      out.push(bl);
      x += w;
    }
  }
  BUILDINGS = out;
}

let railPat = null;
function makePatterns(ctx) {
  const c = mkCanvas(96, 120), g = c.getContext('2d');
  g.scale(4, 4);
  g.fillStyle = '#25292d'; g.strokeStyle = '#25292d'; g.lineWidth = 1.1;
  g.fillRect(0, 0, 24, 2.2); g.fillRect(0, 27.2, 24, 2.8);
  g.fillRect(0, 0, 1.3, 30); g.fillRect(12, 0, 1, 30);
  for (const cx of [6, 18]) {
    g.beginPath(); g.arc(cx, 15, 4.2, 0, TAU); g.stroke();
    g.beginPath(); g.arc(cx, 6.2, 2.4, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(cx, 23.8, 2.4, Math.PI, TAU); g.stroke();
    g.fillRect(cx - .5, 10.8, 1, 8.4);
  }
  railPat = ctx.createPattern(c, 'repeat');
  if (railPat.setTransform && window.DOMMatrix) railPat.setTransform(new DOMMatrix().scale(.25, .25));
}

let LS_OK = false;
function signFont(ctx, px, weight = 500, spacing = 0) {
  ctx.font = `${weight} ${px}px Jost, Futura, "Century Gothic", sans-serif`;
  if (LS_OK) ctx.letterSpacing = spacing + 'px';
}

function drawMansard(ctx, b) {
  const { x, w, cornice: cy } = b, ridge = cy - 150;
  const mg = ctx.createLinearGradient(0, ridge, 0, cy);
  mg.addColorStop(0, '#a6adb6'); mg.addColorStop(1, '#6b7480');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.moveTo(x + 4, cy - 4); ctx.lineTo(x + w - 4, cy - 4); ctx.lineTo(x + w - 16, ridge + 22); ctx.lineTo(x + 16, ridge + 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b6bcc4';
  ctx.beginPath(); ctx.moveTo(x + 16, ridge + 22); ctx.lineTo(x + w - 16, ridge + 22); ctx.lineTo(x + w - 34, ridge); ctx.lineTo(x + 34, ridge); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,48,58,.17)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let sx = x + 14; sx < x + w - 10; sx += 13) { ctx.moveTo(sx, cy - 5); ctx.lineTo(sx + (x + w / 2 - sx) * .04, ridge + 23); }
  ctx.stroke();
  ctx.fillStyle = '#5b636d'; ctx.fillRect(x + 32, ridge - 2, w - 64, 3);
  const sp = w / b.cols;
  for (let c = 0; c < b.cols; c++) {
    if (!b.dormer[c]) continue;
    const dx = x + sp * (c + .5), dw = 32, dh = 58, y0 = cy - 20 - dh;
    ctx.fillStyle = '#e2d8c6'; archRect(ctx, dx - dw / 2 - 5, y0 - 5, dw + 10, dh + 9); ctx.fill();
    ctx.fillStyle = '#39414d'; archRect(ctx, dx - dw / 2, y0, dw, dh); ctx.fill();
    ctx.fillStyle = 'rgba(175,190,210,.22)'; ctx.fillRect(dx - dw / 2, y0 + dw / 2, dw, dh * .22);
    ctx.fillStyle = '#ece5d6'; ctx.fillRect(dx - 1, y0 + 3, 2, dh - 3); ctx.fillRect(dx - dw / 2, y0 + dh * .52, dw, 1.5);
    ctx.strokeStyle = '#6c7581'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(dx, y0 + dw / 2 - 2, dw / 2 + 8, Math.PI * 1.02, -Math.PI * .02); ctx.stroke();
  }
}

function drawStack(ctx, b) {
  const sx = b.x, sw = b.stackW, ridge = b.cornice - 150, top = ridge - 46, cy = b.cornice;
  ctx.fillStyle = '#c6b29a'; ctx.fillRect(sx - sw / 2, top, sw, cy - top);
  ctx.fillStyle = 'rgba(255,238,212,.4)'; ctx.fillRect(sx - sw / 2, top, 5, cy - top);
  ctx.fillStyle = 'rgba(60,45,35,.2)'; ctx.fillRect(sx + sw / 2 - 6, top, 6, cy - top);
  ctx.fillStyle = 'rgba(80,60,45,.1)';
  for (let yy = top + 10; yy < cy; yy += 14) ctx.fillRect(sx - sw / 2, yy, sw, 1);
  ctx.fillStyle = '#b19b83'; ctx.fillRect(sx - sw / 2 - 3, top - 4, sw + 6, 5);
  const n = b.pots, gap = (sw - 6) / n;
  for (let i = 0; i < n; i++) {
    const cx = sx - sw / 2 + 3 + gap * (i + .5), ph = 13 + hash(b.seed + i) * 11, pw = 6.5;
    ctx.fillStyle = '#b07e64'; ctx.fillRect(cx - pw / 2, top - 4 - ph, pw, ph);
    ctx.fillStyle = 'rgba(255,228,196,.4)'; ctx.fillRect(cx - pw / 2, top - 4 - ph, 2, ph);
    ctx.fillStyle = '#7b5645'; ctx.fillRect(cx - pw / 2 - 1, top - 4 - ph, pw + 2, 2.5);
  }
}

function drawWindow(ctx, cx, top, ww, wh, f, v) {
  const x0 = cx - ww / 2;
  ctx.fillStyle = 'rgba(255,250,240,.26)'; ctx.fillRect(x0 - 6, top - 6, ww + 12, wh + 10);
  ctx.fillStyle = '#39414d'; ctx.fillRect(x0, top, ww, wh);
  ctx.fillStyle = 'rgba(175,190,210,.24)'; ctx.fillRect(x0, top, ww, wh * .36);
  if (v < .45) {
    ctx.fillStyle = 'rgba(235,238,245,.1)';
    ctx.beginPath(); ctx.moveTo(x0 + ww * .15, top + wh); ctx.lineTo(x0 + ww * .55, top); ctx.lineTo(x0 + ww * .85, top); ctx.lineTo(x0 + ww * .45, top + wh); ctx.fill();
  }
  if (v > .52) { ctx.fillStyle = 'rgba(230,222,206,.55)'; ctx.fillRect(x0 + 2, top + wh * .34, ww / 2 - 3, wh * .64); ctx.fillRect(cx + 1, top + wh * .34, ww / 2 - 3, wh * .64); }
  else if (v > .4) { ctx.fillStyle = 'rgba(255,214,150,.2)'; ctx.fillRect(x0, top + wh * .4, ww, wh * .6); }
  ctx.fillStyle = '#ebe4d5';
  ctx.fillRect(cx - 1, top, 2, wh); ctx.fillRect(x0, top + wh * .3, ww, 2); ctx.fillRect(x0, top + wh * .64, ww, 1.2);
  ctx.fillRect(x0, top, ww, 1.6); ctx.fillRect(x0, top, 1.6, wh); ctx.fillRect(x0 + ww - 1.6, top, 1.6, wh);
  ctx.fillStyle = 'rgba(255,250,240,.55)'; ctx.fillRect(x0 - 7, top + wh + 1, ww + 14, 4);
  ctx.fillStyle = 'rgba(60,50,40,.18)'; ctx.fillRect(x0 - 7, top + wh + 5, ww + 14, 2);
  if (f === 2) {
    ctx.fillStyle = 'rgba(255,250,240,.5)';
    ctx.beginPath(); ctx.moveTo(x0 - 9, top - 8); ctx.lineTo(cx, top - 23); ctx.lineTo(x0 + ww + 9, top - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(60,50,40,.16)'; ctx.fillRect(x0 - 9, top - 8, ww + 18, 2.5);
  } else {
    ctx.fillStyle = 'rgba(255,250,240,.42)'; ctx.fillRect(cx - 4, top - 10, 8, 10);
  }
}

function drawGroundFloor(ctx, b) {
  const { x, w, cols } = b, sp = w / cols;
  ctx.fillStyle = 'rgba(80,68,52,.08)';
  for (let yy = -150 - b.fh + 15; yy < -2; yy += 17) ctx.fillRect(x, yy, w, 1.3);
  const d = b.doorBay, dcx = x + sp * (d + .5);
  // porte cochère
  const dw = 66, dh = 128;
  ctx.fillStyle = 'rgba(255,250,240,.3)'; archRect(ctx, dcx - dw / 2 - 9, -dh - 9, dw + 18, dh + 9); ctx.fill();
  ctx.fillStyle = '#2a3832'; archRect(ctx, dcx - dw / 2, -dh, dw, dh); ctx.fill();
  ctx.strokeStyle = 'rgba(210,225,215,.12)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(dcx, -dh + dw / 2); ctx.lineTo(dcx, 0);
  for (const s of [-1, 1]) { ctx.rect(dcx + s * 6 + (s < 0 ? -24 : 0), -dh + dw / 2 + 8, 24, 36); ctx.rect(dcx + s * 6 + (s < 0 ? -24 : 0), -dh + dw / 2 + 52, 24, 40); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,24,22,.9)'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const a = Math.PI + i / 6 * Math.PI; ctx.moveTo(dcx, -dh + dw / 2); ctx.lineTo(dcx + Math.cos(a) * dw / 2, -dh + dw / 2 + Math.sin(a) * dw / 2); }
  ctx.stroke();
  ctx.fillStyle = '#c9a65a'; ell(ctx, dcx - 5, -62, 2, 2); ctx.fill(); ell(ctx, dcx + 5, -62, 2, 2); ctx.fill();
  // house number
  ctx.fillStyle = '#284c86'; ell(ctx, dcx, -dh - 20, 10, 7); ctx.fill();
  ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 1; ell(ctx, dcx, -dh - 20, 8, 5.2); ctx.stroke();
  ctx.fillStyle = '#f2f4f7'; signFont(ctx, 7.5, 600, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(b.num), dcx, -dh - 19.6);
  // shopfront
  const s0 = x + (d === 0 ? sp : 0) + 8, s1 = x + (d === 0 ? w : w - sp) - 8;
  drawShopfront(ctx, s0, s1, b.shop, b.seed);
}

function drawShopfront(ctx, x0, x1, shop, seed) {
  const w = x1 - x0;
  ctx.fillStyle = shop.col; ctx.fillRect(x0, -152, w, 152);
  ctx.fillStyle = shade(shop.col, 1.18); ctx.fillRect(x0 + 6, -147, w - 12, 30);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x0 + 6, -117, w - 12, 2);
  ctx.fillStyle = shade(shop.col, .8); ctx.fillRect(x0, -152, 7, 152); ctx.fillRect(x1 - 7, -152, 7, 152);
  ctx.fillStyle = '#dcc07a'; signFont(ctx, 15, 500, 3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(shop.name, (x0 + x1) / 2 + 1.5, -131);
  const gx0 = x0 + 13, gx1 = x1 - 13, doorW = 38, gEnd = gx1 - doorW - 8;
  ctx.fillStyle = '#252a31'; ctx.fillRect(gx0, -108, gx1 - gx0, 84);
  ctx.fillStyle = 'rgba(255,208,150,.12)'; ctx.fillRect(gx0, -108, gx1 - gx0, 84);
  drawShopItems(ctx, shop.kind, gx0 + 4, gEnd - 4, seed);
  ctx.fillStyle = 'rgba(225,232,240,.09)';
  for (let sx = gx0 + 10; sx < gEnd - 20; sx += 70) { ctx.beginPath(); ctx.moveTo(sx, -24); ctx.lineTo(sx + 26, -108); ctx.lineTo(sx + 44, -108); ctx.lineTo(sx + 18, -24); ctx.fill(); }
  ctx.fillStyle = shop.col; ctx.fillRect(gEnd, -110, 8, 110); ctx.fillRect((gx0 + gEnd) / 2 - 2, -108, 4, 84);
  ctx.fillStyle = '#2a3038'; ctx.fillRect(gx1 - doorW, -108, doorW, 106);
  ctx.fillStyle = 'rgba(255,208,150,.1)'; ctx.fillRect(gx1 - doorW, -108, doorW, 106);
  ctx.fillStyle = '#c9a65a'; ctx.fillRect(gx1 - doorW + 5, -58, 2, 12);
  ctx.fillStyle = shade(shop.col, .9); ctx.fillRect(gx0, -26, gEnd - gx0, 26);
  ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.strokeRect(gx0 + 5, -21, gEnd - gx0 - 10, 16);
  if (shop.kind === 'pharma') {
    const cx = x1 - 26, cy = -176;
    ctx.fillStyle = 'rgba(80,220,140,.22)'; ell(ctx, cx, cy, 26, 26); ctx.fill();
    ctx.fillStyle = '#39c07a'; ctx.fillRect(cx - 5, cy - 15, 10, 30); ctx.fillRect(cx - 15, cy - 5, 30, 10);
  }
  if (shop.kind === 'cafe') drawAwning(ctx, x0, x1);
}

function drawShopItems(ctx, kind, a, b, seed) {
  const w = b - a;
  if (kind === 'bread') {
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#c8954e' : '#b98443'; ell(ctx, a + 20 + i * (w - 40) / 6, -44, 14, 7); ctx.fill(); }
    for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(a + 14 + i * (w - 30) / 8, -80); ctx.rotate(-.5); ctx.fillStyle = '#d4a25b'; ell(ctx, 0, 0, 22, 3.6); ctx.fill(); ctx.restore(); }
  } else if (kind === 'books') {
    for (const sy of [-96, -62]) for (let xx = a; xx < b - 4; xx += 5) { ctx.fillStyle = ['#8b6a55', '#58677a', '#a39070', '#6e5a70', '#7b8b73', '#b5a78a'][(hash(xx + sy + seed) * 6) | 0]; const h = 18 + hash(xx * 3.1 + sy) * 8; ctx.fillRect(xx, sy + 26 - h, 4, h); }
    ctx.fillStyle = '#5c4a3a'; ctx.fillRect(a, -70, w, 3); ctx.fillRect(a, -36, w, 3);
  } else if (kind === 'flowers') {
    for (let i = 0; i < 26; i++) { const xx = a + hash(i + seed) * w, yy = -40 - hash(i * 7.3) * 50; ctx.fillStyle = ['#e7dcc2', '#d9c05c', '#b7a3c6', '#e3b8b0', '#f1ece0'][i % 5]; ell(ctx, xx, yy, 7, 6); ctx.fill(); ctx.fillStyle = '#556b45'; ell(ctx, xx + 4, yy + 8, 5, 4); ctx.fill(); }
  } else if (kind === 'cafe') {
    ctx.fillStyle = '#6b4b35'; ctx.fillRect(a, -52, w, 26);
    ctx.fillStyle = 'rgba(210,200,180,.25)'; ctx.fillRect(a + 6, -104, w - 12, 34);
    for (let xx = a + 8; xx < b - 8; xx += 9) { ctx.fillStyle = ['#5e7a52', '#8a6b3a', '#c9c3b0', '#6d4a3a'][(hash(xx + seed) * 4) | 0]; ctx.fillRect(xx, -82, 4, 12); ctx.fillRect(xx + 1, -86, 2, 4); }
    ctx.fillStyle = '#c9a65a'; ctx.fillRect(a, -55, w, 2.5);
  } else if (kind === 'hardware') {
    for (let i = 0; i < 9; i++) { const xx = a + 16 + i * (w - 32) / 8; ctx.strokeStyle = '#888c8f'; ctx.lineWidth = 2; ell(ctx, xx, -78 + (i % 2) * 8, 10, 10); ctx.stroke(); ctx.fillStyle = '#6a6e70'; ctx.fillRect(xx - 1, -94, 2, 8); }
    ctx.fillStyle = '#7d6a55'; ctx.fillRect(a, -44, w, 18);
  } else if (kind === 'dairy') {
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#d8c27a'; ell(ctx, a + 22 + i * (w - 44) / 5, -44, 17, 8); ctx.fill(); ctx.fillStyle = '#c2a95e'; ctx.fillRect(a + 5 + i * (w - 44) / 5, -44, 34, 6); }
    for (let i = 0; i < 12; i++) { ctx.fillStyle = '#eee8dc'; ctx.fillRect(a + 8 + i * (w - 16) / 12, -92, 8, 22); }
  } else if (kind === 'clock') {
    for (let i = 0; i < 6; i++) { const xx = a + 20 + i * (w - 40) / 5, yy = -70 + (i % 2) * 16; ctx.fillStyle = '#e8e0cc'; ell(ctx, xx, yy, 11, 11); ctx.fill(); ctx.strokeStyle = '#8a6d3f'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 7); ctx.moveTo(xx, yy); ctx.lineTo(xx + 5, yy); ctx.stroke(); }
  } else if (kind === 'pharma') {
    for (let i = 0; i < 14; i++) { ctx.fillStyle = ['#e8e2d4', '#b7c9c0', '#d8cfb6'][i % 3]; ctx.fillRect(a + 8 + i * (w - 16) / 14, -90 + (i % 2) * 26, 8, 20); }
  }
}

function drawAwning(ctx, x0, x1) {
  const top = -152, bot = -102;
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#223a30'); g.addColorStop(1, '#335a49');
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0 - 4, top); ctx.lineTo(x1 + 4, top); ctx.lineTo(x1 + 20, bot); ctx.lineTo(x0 - 20, bot); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  ctx.fillStyle = 'rgba(236,226,200,.78)';
  const n = Math.round((x1 - x0) / 26);
  for (let i = 0; i < n; i += 2) {
    const u0 = i / n, u1 = (i + 1) / n;
    ctx.beginPath();
    ctx.moveTo(lerp(x0 - 4, x1 + 4, u0), top); ctx.lineTo(lerp(x0 - 4, x1 + 4, u1), top);
    ctx.lineTo(lerp(x0 - 20, x1 + 20, u1), bot); ctx.lineTo(lerp(x0 - 20, x1 + 20, u0), bot); ctx.fill();
  }
  const sh = ctx.createLinearGradient(0, top, 0, bot); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(x0 - 30, top, x1 - x0 + 60, bot - top);
  ctx.restore();
  ctx.fillStyle = '#2c4a3d'; ctx.fillRect(x0 - 20, bot, x1 - x0 + 40, 12);
  ctx.beginPath();
  for (let sx = x0 - 20; sx < x1 + 20; sx += 16) { ctx.moveTo(sx, bot + 12); ctx.arc(sx + 8, bot + 12, 8, Math.PI, 0, true); }
  ctx.fill();
  ctx.fillStyle = '#ece2c8'; signFont(ctx, 8, 600, 2.4); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CAFÉ · VINS · BRASSERIE', (x0 + x1) / 2, bot + 6.5);
}

function drawBuildingFacade(ctx, b) {
  const { x, w, fh, cornice: cy, cols, col } = b, sp = w / cols;
  const fg = ctx.createLinearGradient(0, cy, 0, 0);
  fg.addColorStop(0, shade(col, 1.04)); fg.addColorStop(1, shade(col, .95));
  ctx.fillStyle = fg; ctx.fillRect(x, cy, w + .5, -cy + 2);
  ctx.fillStyle = 'rgba(90,75,60,.045)';
  for (let i = 0; i < 18; i++) { const hx = x + hash(b.seed + i) * w, hy = cy + hash(b.seed * 1.3 + i) * -cy; ell(ctx, hx, hy, 30 + hash(i + b.seed) * 60, 12 + hash(i * 2 + b.seed) * 30); ctx.fill(); }
  ctx.fillStyle = shade(col, 1.07); ctx.fillRect(x - 3, cy - 7, w + 6, 11);
  ctx.fillStyle = 'rgba(60,50,40,.24)'; ctx.fillRect(x - 3, cy + 4, w + 6, 3);
  for (let i = 0; i < w; i += 12) { ctx.fillStyle = 'rgba(60,50,40,.12)'; ctx.fillRect(x + i, cy + 4, 5, 5); }
  let bi = 0;
  for (let f = 1; f <= 5; f++) {
    const fb = -150 - (f - 1) * fh;
    ctx.fillStyle = 'rgba(255,250,240,.35)'; ctx.fillRect(x, fb - 2, w, 2);
    ctx.fillStyle = 'rgba(70,60,50,.12)'; ctx.fillRect(x, fb, w, 2);
    const wh = fh * (f === 2 ? .7 : f === 5 ? .6 : .66), wb = fb - 14, wt = wb - wh;
    const ww = Math.min(38, sp * .44);
    for (let c = 0; c < cols; c++) drawWindow(ctx, x + sp * (c + .5), wt, ww, wh, f, hash(b.seed + f * 13 + c * 7));
    if (f === 2 || f === 5) {
      ctx.fillStyle = '#e4dbca'; ctx.fillRect(x + 6, fb - 14, w - 12, 6);
      ctx.fillStyle = 'rgba(50,40,30,.24)'; ctx.fillRect(x + 6, fb - 8, w - 12, 4);
      ctx.fillStyle = '#dcd2c0';
      for (let c = 0; c < cols; c++) { const cx = x + sp * (c + .5); ctx.fillRect(cx - ww / 2 - 10, fb - 8, 6, 9); ctx.fillRect(cx + ww / 2 + 4, fb - 8, 6, 9); }
      ctx.save(); ctx.translate(x + 8, fb - 44); ctx.fillStyle = railPat; ctx.fillRect(0, 0, w - 16, 30); ctx.restore();
    } else {
      for (let c = 0; c < cols; c++) {
        const cx = x + sp * (c + .5);
        ctx.save(); ctx.translate(cx - ww / 2 - 3, wb - 26); ctx.fillStyle = railPat; ctx.fillRect(0, 0, ww + 6, 26); ctx.restore();
        if (b.boxes[bi++ % 30] > .8 && f < 5) {
          ctx.fillStyle = '#7b5a43'; ctx.fillRect(cx - ww / 2 - 2, wb - 10, ww + 4, 8);
          for (let k = 0; k < 7; k++) { ctx.fillStyle = k % 3 ? '#5f7547' : '#e8e0cf'; ell(ctx, cx - ww / 2 + 2 + k * (ww / 6), wb - 12 - hash(k + c + f) * 5, 4.5, 4); ctx.fill(); }
        }
      }
    }
  }
  drawGroundFloor(ctx, b);
  ctx.fillStyle = 'rgba(60,50,40,.12)'; ctx.fillRect(x, cy, 2, -cy);
  if (x + w === GAP_X0) {
    const px = GAP_X0 - 92, py = -300;
    ctx.fillStyle = 'rgba(40,40,40,.18)'; ctx.fillRect(px - 60, py - 21, 124, 46);
    ctx.fillStyle = '#233f71'; ctx.fillRect(px - 62, py - 23, 124, 46);
    ctx.strokeStyle = '#e9eef3'; ctx.lineWidth = 1.6; ctx.strokeRect(px - 58, py - 19, 116, 38);
    ctx.fillStyle = '#f2f5f8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    signFont(ctx, 6, 500, 1); ctx.fillText('20e ARRt', px, py - 11);
    signFont(ctx, 7.5, 500, 1.5); ctx.fillText('RUE DE', px, py - 2);
    signFont(ctx, 10.5, 600, 1); ctx.fillText('MÉNILMONTANT', px, py + 9);
  }
}

function drawBalustrade(ctx) {
  const x0 = GAP_X0, x1 = GAP_X1, top = -64;
  ctx.fillStyle = '#c9bfab'; ctx.fillRect(x0, -14, x1 - x0, 16);
  for (let x = x0 + 14; x < x1 - 8; x += 19) {
    if ((x - x0) % 152 < 19) continue;
    ctx.fillStyle = '#d9d0be';
    ctx.fillRect(x - 4, -18, 8, 5); ell(ctx, x, -27, 4.8, 9); ctx.fill();
    ctx.fillRect(x - 2.2, -46, 4.4, 14); ctx.fillRect(x - 3.8, -54, 7.6, 5);
    ctx.fillStyle = 'rgba(70,60,50,.22)'; ctx.fillRect(x + 1.5, -36, 2.5, 18);
  }
  for (let x = x0; x <= x1; x += 152) {
    const px = Math.min(x, x1 - 14);
    ctx.fillStyle = '#d3c9b6'; ctx.fillRect(px, top, 16, 66);
    ctx.fillStyle = 'rgba(70,60,50,.18)'; ctx.fillRect(px + 11, top, 5, 66);
  }
  ctx.fillStyle = '#e0d7c5'; ctx.fillRect(x0 - 4, top - 2, x1 - x0 + 8, 11);
  ctx.fillStyle = 'rgba(60,50,40,.2)'; ctx.fillRect(x0 - 4, top + 9, x1 - x0 + 8, 2);
}

const COBBLES = ['#86888c', '#7b7d82', '#908e89', '#75797f', '#8b8781', '#7f8285'];
function drawStreet(ctx, vx0, vx1, vy1) {
  const w = vx1 - vx0;
  const sg = ctx.createLinearGradient(0, 0, 0, 70);
  sg.addColorStop(0, '#a9a296'); sg.addColorStop(1, '#c2bbae');
  ctx.fillStyle = sg; ctx.fillRect(vx0, 0, w, 70);
  ctx.fillStyle = 'rgba(80,70,60,.14)';
  for (let x = Math.floor(vx0 / 96) * 96; x < vx1; x += 96) ctx.fillRect(x, 0, 1.2, 70);
  ctx.fillRect(vx0, 34, w, 1);
  ctx.fillStyle = 'rgba(40,40,45,.16)'; ctx.fillRect(vx0, 0, w, 4);
  ctx.fillStyle = '#d5cfc4'; ctx.fillRect(vx0, 70, w, 4);
  ctx.fillStyle = '#8e8981'; ctx.fillRect(vx0, 74, w, 8);
  ctx.fillStyle = '#65666a'; ctx.fillRect(vx0, 82, w, 10);
  ctx.fillStyle = 'rgba(200,210,225,.18)'; ctx.fillRect(vx0, 84, w, 2);
  ctx.fillStyle = '#6f7277'; ctx.fillRect(vx0, 92, w, Math.max(0, vy1 - 92 + 40));
  let y = 92, row = 0;
  while (y < vy1 + 20) {
    const h = 7 + (y - 92) * .09, sw = h * 1.75, off = (row % 2) * sw * .5;
    for (let x = Math.floor((vx0 - off) / sw) * sw + off; x < vx1; x += sw) {
      const hs = hash(Math.round(x / sw) * .37 + row * 13.1);
      ctx.fillStyle = COBBLES[(hs * 6) | 0];
      ctx.fillRect(x + h * .08, y + h * .08, sw - h * .16, h - h * .16);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + h * .12, y + h * .1, sw - h * .24, h * .22);
    }
    y += h; row++;
  }
  const rg = ctx.createLinearGradient(0, 92, 0, 360);
  rg.addColorStop(0, 'rgba(40,45,55,.25)'); rg.addColorStop(1, 'rgba(40,45,55,0)');
  ctx.fillStyle = rg; ctx.fillRect(vx0, 92, w, 270);
}

function drawGroundLeaves(ctx, vx0, vx1) {
  for (let k = Math.floor(vx0 / 23); k < vx1 / 23; k++) {
    const h = hash(k * 1.91);
    if (h < .62) continue;
    const x = k * 23 + hash(k * 3.3) * 20, y = hash(k * 5.7) < .6 ? 6 + hash(k * 7.7) * 60 : 82 + hash(k * 2.1) * 9;
    const sp = LEAF[(hash(k * 9.1) * LEAF.length) | 0];
    ctx.save(); ctx.translate(x, y); ctx.rotate(hash(k) * TAU); ctx.scale(1, .45); ctx.globalAlpha = .85;
    ctx.drawImage(sp, -6, -6, 12, 12); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawLamp(ctx, x, by, hero) {
  const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
  g.addColorStop(0, '#4d5d56'); g.addColorStop(.32, '#28332f'); g.addColorStop(1, '#111715');
  ctx.fillStyle = 'rgba(25,28,35,.3)'; ell(ctx, x + 6, by + 1, 34, 4); ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 21, by); ctx.lineTo(x + 21, by); ctx.lineTo(x + 21, by - 7); ctx.lineTo(x + 16, by - 11);
  ctx.bezierCurveTo(x + 19, by - 30, x + 10, by - 44, x + 11, by - 62);
  ctx.lineTo(x + 14, by - 66); ctx.lineTo(x + 14, by - 72); ctx.lineTo(x - 14, by - 72); ctx.lineTo(x - 14, by - 66); ctx.lineTo(x - 11, by - 62);
  ctx.bezierCurveTo(x - 10, by - 44, x - 19, by - 30, x - 16, by - 11); ctx.lineTo(x - 21, by - 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(210,225,215,.12)'; ctx.fillRect(x - 17, by - 22, 34, 2); ctx.fillRect(x - 13, by - 64, 26, 1.5);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - 8.5, by - 72); ctx.lineTo(x + 8.5, by - 72); ctx.lineTo(x + 5.5, by - 318); ctx.lineTo(x - 5.5, by - 318); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(210,225,215,.14)';
  ctx.beginPath(); ctx.moveTo(x - 5.5, by - 72); ctx.lineTo(x - 4, by - 72); ctx.lineTo(x - 2.4, by - 318); ctx.lineTo(x - 3.6, by - 318); ctx.fill();
  ctx.fillStyle = '#1c2522';
  ctx.fillRect(x - 9.5, by - 204, 19, 6); ctx.fillRect(x - 7, by - 210, 14, 5);
  ctx.fillRect(x - 8, by - 324, 16, 7);
  ctx.fillStyle = '#1f2825'; ctx.fillRect(x - 30, by - 337, 60, 4);
  ell(ctx, x - 31, by - 335, 3.2, 3.2); ctx.fill(); ell(ctx, x + 31, by - 335, 3.2, 3.2); ctx.fill();
  ctx.strokeStyle = '#1f2825'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x - 12, by - 327, 7, Math.PI * 1.5, Math.PI * .5, true); ctx.moveTo(x + 12, by - 334); ctx.arc(x + 12, by - 327, 7, Math.PI * 1.5, Math.PI * .5); ctx.stroke();
  ctx.fillRect(x - 5, by - 347, 10, 11);
  const lg = ctx.createLinearGradient(0, by - 398, 0, by - 346);
  lg.addColorStop(0, 'rgba(255,236,196,.95)'); lg.addColorStop(1, 'rgba(250,206,140,.9)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(x - 12, by - 346); ctx.lineTo(x + 12, by - 346); ctx.lineTo(x + 20, by - 398); ctx.lineTo(x - 20, by - 398); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1c2522'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x - 12, by - 346); ctx.lineTo(x + 12, by - 346); ctx.lineTo(x + 20, by - 398); ctx.lineTo(x - 20, by - 398); ctx.closePath();
  ctx.moveTo(x - 4, by - 346); ctx.lineTo(x - 7, by - 398); ctx.moveTo(x + 4, by - 346); ctx.lineTo(x + 7, by - 398);
  ctx.stroke();
  ctx.fillStyle = '#1c2522';
  ctx.beginPath(); ctx.moveTo(x - 25, by - 397); ctx.lineTo(x + 25, by - 397); ctx.lineTo(x + 9, by - 418); ctx.lineTo(x - 9, by - 418); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(210,225,215,.16)';
  ctx.beginPath(); ctx.moveTo(x - 25, by - 397); ctx.lineTo(x - 14, by - 397); ctx.lineTo(x - 5, by - 418); ctx.lineTo(x - 9, by - 418); ctx.fill();
  ctx.fillStyle = '#1c2522'; ctx.fillRect(x - 2, by - 428, 4, 11); ell(ctx, x, by - 430, 3.2, 3.2); ctx.fill();
}

function lampGlow(ctx, x, by) {
  const gg = ctx.createRadialGradient(x, by - 372, 4, x, by - 372, 90);
  gg.addColorStop(0, 'rgba(255,214,150,.42)'); gg.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = gg; ctx.fillRect(x - 90, by - 462, 180, 180);
}

function drawMorris(ctx, x, by) {
  const r = 50;
  ctx.fillStyle = 'rgba(25,28,35,.28)'; ell(ctx, x + 8, by + 1, 64, 5); ctx.fill();
  ctx.fillStyle = '#2b4337'; ctx.fillRect(x - r - 5, by - 16, 2 * r + 10, 16);
  ctx.fillStyle = '#dccfb2'; ctx.fillRect(x - r, by - 246, 2 * r, 230);
  const P = [[-50, -246, 34, 118, '#e4d6b4', 'THÉÂTRE'], [-16, -246, 40, 96, '#b8c7c1', 'CINÉMA'], [24, -246, 26, 130, '#d9bb88', 'CIRQUE'], [-50, -128, 44, 112, '#c8bfd3', 'CONCERT'], [-6, -150, 56, 134, '#e6dcc4', 'EXPOSITION']];
  for (const [ox, oy, pw, ph, c, label] of P) {
    ctx.fillStyle = c; ctx.fillRect(x + ox + 1, by + oy + 2, pw - 2, ph - 3);
    ctx.fillStyle = 'rgba(40,35,30,.72)'; signFont(ctx, Math.min(8, pw / label.length * 1.5), 600, .5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + ox + pw / 2, by + oy + 16);
    ctx.fillStyle = 'rgba(40,35,30,.25)';
    for (let yy = oy + 28; yy < oy + ph - 10; yy += 7) ctx.fillRect(x + ox + 5, by + yy, (pw - 10) * (.5 + hash(yy + ox) * .5), 2);
  }
  const cg = ctx.createLinearGradient(x - r, 0, x + r, 0);
  cg.addColorStop(0, 'rgba(255,244,222,.28)'); cg.addColorStop(.3, 'rgba(255,244,222,0)'); cg.addColorStop(.62, 'rgba(20,25,30,.08)'); cg.addColorStop(1, 'rgba(20,25,30,.5)');
  ctx.fillStyle = cg; ctx.fillRect(x - r, by - 246, 2 * r, 230);
  ctx.fillStyle = '#2d473b'; ctx.fillRect(x - r - 5, by - 254, 2 * r + 10, 10);
  ctx.fillStyle = '#35533f'; ctx.fillRect(x - r - 2, by - 272, 2 * r + 4, 18);
  ctx.fillStyle = '#d9c68e'; signFont(ctx, 7, 600, 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SPECTACLES', x, by - 263);
  const dg = ctx.createLinearGradient(x - r, 0, x + r, 0);
  dg.addColorStop(0, '#4f6d5d'); dg.addColorStop(.4, '#2f4a3c'); dg.addColorStop(1, '#1b2b23');
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.moveTo(x - r - 6, by - 272); ctx.quadraticCurveTo(x - r + 8, by - 318, x, by - 324); ctx.quadraticCurveTo(x + r - 8, by - 318, x + r + 6, by - 272); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#233a2f'; ctx.fillRect(x - 3, by - 336, 6, 13); ell(ctx, x, by - 338, 4, 4); ctx.fill();
}

function drawCafeTerrace(ctx) {
  for (const tx of [2395, 2540]) {
    for (const dir of [-1, 1]) {
      const cx = tx + dir * 27;
      ctx.strokeStyle = '#3a2f25'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 10, 20); ctx.lineTo(cx - 12, 46); ctx.moveTo(cx + 10, 20); ctx.lineTo(cx + 12, 46);
      ctx.moveTo(cx + dir * 11, 18); ctx.quadraticCurveTo(cx + dir * 16, 0, cx + dir * 12, -16); ctx.stroke();
      ctx.fillStyle = '#b48d56'; ctx.fillRect(cx - 12, 15, 24, 6);
      ctx.fillStyle = '#3f5446'; for (let k = 0; k < 24; k += 4) ctx.fillRect(cx - 12 + k, 15, 2, 6);
      ctx.strokeStyle = '#b48d56'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(cx + dir * 12, -12); ctx.quadraticCurveTo(cx + dir * 14, -2, cx + dir * 13, 8); ctx.stroke();
    }
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(tx - 2, 6, 4, 36); ell(ctx, tx, 43, 13, 3); ctx.fill();
    ctx.fillStyle = '#ebe5d9'; ctx.fillRect(tx - 20, 1, 40, 5);
    ctx.fillStyle = '#9d927f'; ctx.fillRect(tx - 20, 5, 40, 1.5);
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(tx - 7, -6, 7, 7); ell(ctx, tx - 3.5, 1, 7, 1.5); ctx.fill();
  }
  ctx.lineCap = 'butt';
}

/* ---------------- the boy ---------------- */
const BOYC = { coat: '#5e6470', coatB: '#4a4f59', shorts: '#40444c', skin: '#e3b995', skinB: '#c99a78', sock: '#e6dfcf', shoe: '#2a211c', hair: '#4a3326', beret: '#262d45', satchel: '#6e4b31', satchelB: '#553823', collar: '#ece7dc' };
function drawBoy(ctx, x, y, st) {
  const { ph, amp, head, lean, reach, lit } = st;
  const C = k => lit > 0 ? mix(BOYC[k], '#ffdcae', lit * .2) : BOYC[k];
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(25,28,40,.3)'; ell(ctx, 3, 1, 24, 3.6); ctx.fill();
  const bob = -Math.abs(Math.cos(ph)) * 2 * amp;
  ctx.translate(0, bob); ctx.rotate(lean);
  const hipY = -58;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const leg = (p, back) => {
    const th = .42 * Math.sin(p) * amp;
    const kn = amp * (.08 + .85 * Math.pow(Math.max(0, Math.cos(p + .4)), 1.5));
    const kx = -Math.sin(th) * 27, ky = hipY + Math.cos(th) * 27;
    const sa = th - kn, ax = kx - Math.sin(sa) * 27, ay = ky + Math.cos(sa) * 27;
    ctx.strokeStyle = back ? C('skinB') : C('skin'); ctx.lineWidth = 8.5;
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(kx, ky); ctx.lineTo(lerp(kx, ax, .3), lerp(ky, ay, .3)); ctx.stroke();
    ctx.strokeStyle = back ? shade(BOYC.sock, .82) : C('sock'); ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(lerp(kx, ax, .3), lerp(ky, ay, .3)); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.save(); ctx.translate(ax, ay + 1); ctx.rotate(sa * .35);
    ctx.fillStyle = back ? '#1b1512' : C('shoe'); ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(-10, -3); ctx.quadraticCurveTo(-15, -2, -14, 3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = back ? shade(BOYC.shorts, .82) : C('shorts'); ctx.lineWidth = 12.5;
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(kx * .45, lerp(hipY, ky, .45)); ctx.stroke();
  };
  const arm = (p, back, rch) => {
    let a = -.45 * Math.sin(p) * amp, e = .28 + .22 * Math.max(0, Math.sin(p)) * amp;
    a = lerp(a, 2.5, rch); e = lerp(e, .3, rch);
    const sx = -1, sy = -96;
    const ex = sx - Math.sin(a) * 20, ey = sy + Math.cos(a) * 20;
    const hx = ex - Math.sin(a + e) * 18, hy = ey + Math.cos(a + e) * 18;
    ctx.strokeStyle = back ? C('coatB') : C('coat'); ctx.lineWidth = 8.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(lerp(ex, hx, .8), lerp(ey, hy, .8)); ctx.stroke();
    ctx.fillStyle = back ? C('skinB') : C('skin'); ell(ctx, hx, hy, 3.8, 3.8); ctx.fill();
  };
  arm(ph, true, 0);
  leg(ph + Math.PI, true);
  ctx.fillStyle = C('shorts'); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-12, -66, 23, 14, 3) : ctx.rect(-12, -66, 23, 14); ctx.fill();
  ctx.fillStyle = C('satchel'); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(6, -97, 16, 28, 3) : ctx.rect(6, -97, 16, 28); ctx.fill();
  ctx.fillStyle = C('coat');
  ctx.beginPath(); ctx.moveTo(-11, -99); ctx.quadraticCurveTo(-1, -104, 10, -99); ctx.lineTo(13, -60); ctx.lineTo(-14, -60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-14, -63, 27, 3);
  ctx.fillStyle = C('satchelB'); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(9, -98, 15, 15, 3) : ctx.rect(9, -98, 15, 15); ctx.fill();
  ctx.fillStyle = '#b89a5c'; ctx.fillRect(15, -87, 3, 4);
  ctx.strokeStyle = C('satchelB'); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-6, -100); ctx.quadraticCurveTo(-3, -84, 8, -74); ctx.stroke();
  ctx.fillStyle = '#2b2d33'; for (const yy of [-90, -80, -70]) { ell(ctx, -10.5, yy, 1.3, 1.3); ctx.fill(); }
  ctx.fillStyle = BOYC.collar; ctx.beginPath(); ctx.moveTo(-9, -101); ctx.lineTo(-2, -101); ctx.lineTo(-6, -95); ctx.closePath(); ctx.fill();
  leg(ph, false);
  // head
  ctx.save(); ctx.translate(-2, -101); ctx.rotate(head);
  ctx.fillStyle = C('skinB'); ctx.fillRect(-3, -6, 6, 8);
  ctx.fillStyle = C('hair'); ell(ctx, 0, -13, 13.2, 12.8); ctx.fill();
  ctx.fillStyle = C('skin'); ell(ctx, -3.2, -11.2, 11.6, 11.8); ctx.fill();
  ell(ctx, -13.8, -9.5, 2.4, 2.2); ctx.fill();
  ctx.fillStyle = C('hair'); ctx.beginPath(); ctx.moveTo(-12, -20); ctx.quadraticCurveTo(-4, -26, 8, -20); ctx.lineTo(9, -10); ctx.quadraticCurveTo(4, -16, -12, -18); ctx.fill();
  ctx.fillStyle = C('skinB'); ell(ctx, 3.4, -10.5, 2.8, 3.4); ctx.fill();
  ctx.fillStyle = 'rgba(214,120,104,.35)'; ell(ctx, -8, -6.5, 3.2, 2.4); ctx.fill();
  ctx.fillStyle = '#2a211d'; ell(ctx, -10.2, -12.6 - head * 1.2, 1.35, 1.6); ctx.fill();
  ctx.strokeStyle = '#4a3326'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-13, -16.4 - head); ctx.lineTo(-8, -17.2 - head); ctx.stroke();
  ctx.strokeStyle = '#a4644f'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-13.4, -4.2); ctx.lineTo(-10.8, -3.8); ctx.stroke();
  ctx.fillStyle = C('beret'); ell(ctx, -.5, -22.5, 14.5, 5.2, -.12); ctx.fill();
  ell(ctx, 0, -20.5, 12, 3.4, -.12); ctx.fill();
  ctx.fillRect(-.8, -30, 1.8, 4);
  ctx.restore();
  arm(ph + Math.PI, false, reach);
  ctx.restore();
}

/* ---------------- the balloon ---------------- */
function balloonShape(ctx) {
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * TAU, s = Math.sin(a), c = Math.cos(a);
    const ry = s > 0 ? 34 + 7.5 * s * s * s : 34;
    const rx = 28.5 * (1 - (s > 0 ? .17 * s * s * s * s : 0));
    const X = c * rx, Y = s * ry;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  }
  ctx.closePath();
}
function drawBalloon(ctx, x, y, ang, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const halo = ctx.createRadialGradient(0, 0, 20, 0, 0, 95);
  halo.addColorStop(0, 'rgba(255,70,60,.16)'); halo.addColorStop(1, 'rgba(255,70,60,0)');
  ctx.fillStyle = halo; ctx.fillRect(-95, -95, 190, 190);
  ctx.fillStyle = '#9e111b';
  ctx.beginPath(); ctx.moveTo(-4, 40); ctx.lineTo(4, 40); ctx.lineTo(2.5, 45); ctx.lineTo(-2.5, 45); ctx.closePath(); ctx.fill();
  ell(ctx, 0, 45.5, 2.6, 1.8); ctx.fill();
  balloonShape(ctx);
  const rot = -ang;
  const hx = -9 * Math.cos(rot) + 13 * Math.sin(rot), hy = -9 * Math.sin(rot) - 13 * Math.cos(rot);
  const g = ctx.createRadialGradient(hx, hy, 2, hx * .5, hy * .5, 50);
  g.addColorStop(0, '#ff8f78'); g.addColorStop(.17, '#f3453d'); g.addColorStop(.52, '#d31f2a'); g.addColorStop(.84, '#9a0e19'); g.addColorStop(1, '#690710');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const tg = ctx.createRadialGradient(-hx * .8, -hy * .8 + 16, 2, -hx * .8, -hy * .8 + 16, 30);
  tg.addColorStop(0, 'rgba(255,96,72,.5)'); tg.addColorStop(1, 'rgba(255,96,72,0)');
  ctx.fillStyle = tg; ctx.fillRect(-40, -40, 80, 90);
  const rim = ctx.createLinearGradient(hx * 3, hy * 3, -hx * 2, -hy * 2);
  rim.addColorStop(0, 'rgba(255,206,160,.55)'); rim.addColorStop(.28, 'rgba(255,206,160,0)');
  ctx.strokeStyle = rim; ctx.lineWidth = 6; balloonShape(ctx); ctx.stroke();
  ctx.fillStyle = 'rgba(205,222,255,.13)'; ell(ctx, -hx * .9, -hy * .9 - 4, 7, 13, .5); ctx.fill();
  ctx.restore();
  const sg = ctx.createRadialGradient(hx, hy - 2, 0, hx, hy - 2, 10);
  sg.addColorStop(0, 'rgba(255,255,255,.95)'); sg.addColorStop(.35, 'rgba(255,245,235,.55)'); sg.addColorStop(1, 'rgba(255,240,230,0)');
  ctx.save(); ctx.translate(hx, hy - 2); ctx.rotate(-.55); ctx.scale(.62, 1); ctx.translate(-hx, -(hy - 2));
  ctx.fillStyle = sg; ell(ctx, hx, hy - 2, 10, 10); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ell(ctx, hx + 5, hy - 9, 1.6, 1.1, -.4); ctx.fill();
  ctx.restore();
}

function drawRope(ctx, s, fr) {
  const R = SIM.rope, a = s * NR * 2, b = Math.min(s + 1, NS - 1) * NR * 2;
  const P = [];
  for (let j = 0; j < NR; j++) P.push([lerp(R[a + j * 2], R[b + j * 2], fr), lerp(R[a + j * 2 + 1], R[b + j * 2 + 1], fr)]);
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
  for (let j = 1; j < NR - 1; j++) ctx.quadraticCurveTo(P[j][0], P[j][1], (P[j][0] + P[j + 1][0]) / 2, (P[j][1] + P[j + 1][1]) / 2);
  ctx.lineTo(P[NR - 1][0], P[NR - 1][1]);
  ctx.strokeStyle = 'rgba(36,26,24,.92)'; ctx.lineWidth = 1.35; ctx.lineCap = 'round'; ctx.stroke();
  return P;
}

/* ---------------- birds ---------------- */
let PIGEONS = [];
function genPigeons() {
  const b = BUILDINGS.find(q => q.x <= 1330 && q.x + q.w > 1330);
  const ridge = b.cornice - 150;
  const xs = [b.x + 70, b.x + 118, b.x + 160, b.x + 230, b.x + 290];
  PIGEONS = xs.map((x, i) => ({ x, y: ridge - 1, to: [8.7, 8.82, 8.95, 9.1, 9.28][i], vx: [150, 190, -60, 210, 170][i], vy: [120, 95, 140, 110, 90][i], dir: [1, 1, -1, 1, 1][i], s: .95 + hash(i) * .15 }));
}
function drawPigeon(ctx, p, t) {
  const dt = t - p.to, flying = dt > 0;
  let x = p.x, y = p.y, flap = 0, dir = p.dir;
  if (flying) {
    x += p.vx * dt + 22 * dt * dt * Math.sign(p.vx); y -= p.vy * dt + 45 * dt * dt;
    flap = Math.sin(dt * 30 + p.s * 10); dir = Math.sign(p.vx);
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * p.s, p.s);
  if (!flying) {
    const bob = Math.max(0, Math.sin(t * 3.2 + p.x)) * 1.5;
    ctx.strokeStyle = '#a07b73'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(-1, -4); ctx.moveTo(2, -1); ctx.lineTo(2, -4); ctx.stroke();
    ctx.fillStyle = '#7d8592'; ell(ctx, 0, -9, 9, 5.8, -.12); ctx.fill();
    ctx.fillStyle = '#687080'; ell(ctx, -2, -9, 7, 4, -.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-15, -8); ctx.lineTo(-8, -6); ctx.fill();
    ctx.fillStyle = '#6e7683'; ell(ctx, 8 + bob, -15, 3.6, 3.4); ctx.fill();
    ctx.fillStyle = 'rgba(110,150,130,.6)'; ell(ctx, 6, -12, 3, 2.4); ctx.fill();
    ctx.fillStyle = '#d6c7b3'; ctx.fillRect(11 + bob, -15.5, 2.5, 1.2);
  } else {
    ctx.fillStyle = '#6b7380';
    ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(-8, -1 - 15 * flap); ctx.lineTo(4, -1); ctx.fill();
    ctx.fillStyle = '#7d8592'; ell(ctx, 0, 0, 9, 4.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(-15, 1); ctx.lineTo(-8, 3); ctx.fill();
    ctx.fillStyle = '#6e7683'; ell(ctx, 8.5, -2.5, 3.4, 3.2); ctx.fill();
    ctx.fillStyle = '#737b88';
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-4, -1 + 14 * flap * .6 - 12); ctx.lineTo(5, 0); ctx.fill();
  }
  ctx.restore();
}

/* =====================================================================
   Pre-rendered backgrounds
   ===================================================================== */
const BASE = { facade: '#d6c8b1', zinc: '#7e8793', zincL: '#9aa2ad', win: '#4a5260', stack: '#c4ae96', pot: '#b07d62', cornice: '#e2d7c4', tree: '#8a8744', treeL: '#c3a655', gold: '#c9ae78', copper: '#8fa89b', tower: '#7f7a8c' };
const LAYERS = {};
let CLOUDS = [], CLOUD_SPR = [], LEAF = [], LEAFB = [], TREE = null, GRAIN = [];

function paintCity(o) {
  const res = o.res, c = mkCanvas((o.x1 - o.x0) * res, (o.y1 - o.y0) * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(-o.x0, -o.y0);
  const r = mulberry(o.seed), h = o.haze, sc = o.scale;
  const C = {}; for (const k in BASE) C[k] = mix(BASE[k], HAZE, h);
  if (o.extras) o.extras(g, k => mix(BASE[k], HAZE, h), C);
  let x = o.x0 - 60;
  while (x < o.x1 + 60) {
    const w = (170 + r() * 190) * sc, mid = x + w / 2;
    let top = o.top + (r() - .5) * o.vary, low = null;
    for (const z of o.low || []) if (mid > z[0] && mid < z[1]) { top = z[2] + (r() - .5) * o.vary * .45; low = z; }
    miniBuilding(g, x, w, top, o.y1, sc, r, C, o.detail);
    x += w;
  }
  for (const z of o.low || []) {
    for (let i = 0; i < (z[3] || 0); i++) {
      const tx = z[0] + r() * (z[1] - z[0]), ty = z[2] + 6 * sc - r() * 18 * sc, rr = (20 + r() * 26) * sc;
      g.fillStyle = C.tree; ell(g, tx, ty, rr, rr * .85); g.fill();
      g.fillStyle = C.treeL; ell(g, tx - rr * .25, ty - rr * .25, rr * .6, rr * .5); g.fill();
    }
  }
  if (o.front) o.front(g, C);
  g.globalCompositeOperation = 'source-atop';
  const hg = g.createLinearGradient(0, o.top - 140 * sc, 0, o.y1);
  hg.addColorStop(0, rgba(HAZE, 0)); hg.addColorStop(1, rgba(HAZE, o.fog));
  g.fillStyle = hg; g.fillRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
  const wg = g.createLinearGradient(0, o.top - 160 * sc, 0, o.top + 160 * sc);
  wg.addColorStop(0, 'rgba(255,196,130,.22)'); wg.addColorStop(1, 'rgba(255,196,130,0)');
  g.fillStyle = wg; g.fillRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
  g.globalCompositeOperation = 'source-over';
  return { cv: blurred(c, o.blur * res), x0: o.x0, y0: o.y0, w: o.x1 - o.x0, h: o.y1 - o.y0 };
}
function miniBuilding(g, x, w, top, y1, sc, r, C, detail) {
  const mans = (44 + r() * 20) * sc;
  g.fillStyle = C.zinc;
  g.beginPath(); g.moveTo(x + 2 * sc, top); g.lineTo(x + w - 2 * sc, top); g.lineTo(x + w - 11 * sc, top - mans); g.lineTo(x + 11 * sc, top - mans); g.closePath(); g.fill();
  g.fillStyle = C.zincL; g.fillRect(x + 11 * sc, top - mans - 2 * sc, w - 22 * sc, 3 * sc);
  if (detail > 0) {
    const n = Math.max(1, Math.round(w / (58 * sc)));
    g.fillStyle = C.win;
    for (let i = 0; i < n; i++) g.fillRect(x + w * (i + .5) / n - 5 * sc, top - mans * .72, 10 * sc, 17 * sc);
  }
  const sw = (22 + r() * 28) * sc, st = top - mans - (12 + r() * 14) * sc;
  g.fillStyle = C.stack; g.fillRect(x - sw / 2, st, sw, top - st);
  const np = Math.max(2, Math.floor(sw / (8 * sc)));
  g.fillStyle = C.pot;
  for (let i = 0; i < np; i++) { const ph = (8 + r() * 8) * sc; g.fillRect(x - sw / 2 + (i + .5) * sw / np - 2.6 * sc, st - ph, 5.2 * sc, ph); }
  g.fillStyle = C.facade; g.fillRect(x, top, w + .8, y1 - top);
  g.fillStyle = C.cornice; g.fillRect(x - sc, top - 2 * sc, w + 2 * sc, 4 * sc);
  if (detail > 0) {
    const cols = Math.max(2, Math.round(w / (42 * sc))), sp = w / cols, fh = 44 * sc;
    let f = 0;
    for (let fy = top + 14 * sc; fy < y1; fy += fh, f++) {
      g.fillStyle = C.win;
      for (let c = 0; c < cols; c++) g.fillRect(x + sp * (c + .5) - 6 * sc, fy, 12 * sc, 24 * sc);
      if (f % 3 === 1) { g.fillStyle = 'rgba(40,44,50,.35)'; g.fillRect(x + 3 * sc, fy + 17 * sc, w - 6 * sc, 3 * sc); }
    }
  }
  g.fillStyle = 'rgba(60,50,45,.1)'; g.fillRect(x, top, 1.6 * sc, y1 - top);
}

function eiffel(g, x, by, H, col, lat) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - .19 * H, by);
  g.quadraticCurveTo(x - .13 * H, by - .1 * H, x - .105 * H, by - .205 * H);
  g.lineTo(x + .105 * H, by - .205 * H);
  g.quadraticCurveTo(x + .13 * H, by - .1 * H, x + .19 * H, by);
  g.lineTo(x + .135 * H, by);
  g.quadraticCurveTo(x + .1 * H, by - .085 * H, x + .06 * H, by - .115 * H);
  g.quadraticCurveTo(x, by - .145 * H, x - .06 * H, by - .115 * H);
  g.quadraticCurveTo(x - .1 * H, by - .085 * H, x - .135 * H, by);
  g.closePath(); g.fill();
  g.fillRect(x - .118 * H, by - .222 * H, .236 * H, .022 * H);
  g.beginPath(); g.moveTo(x - .095 * H, by - .205 * H); g.lineTo(x - .056 * H, by - .39 * H); g.lineTo(x + .056 * H, by - .39 * H); g.lineTo(x + .095 * H, by - .205 * H); g.closePath(); g.fill();
  g.fillRect(x - .066 * H, by - .402 * H, .132 * H, .016 * H);
  g.beginPath(); g.moveTo(x - .052 * H, by - .39 * H); g.quadraticCurveTo(x - .024 * H, by - .6 * H, x - .013 * H, by - .88 * H); g.lineTo(x + .013 * H, by - .88 * H); g.quadraticCurveTo(x + .024 * H, by - .6 * H, x + .052 * H, by - .39 * H); g.closePath(); g.fill();
  g.fillRect(x - .02 * H, by - .905 * H, .04 * H, .028 * H);
  g.fillRect(x - .004 * H, by - H, .008 * H, .1 * H);
  if (lat) {
    g.strokeStyle = lat; g.lineWidth = .9; g.beginPath();
    for (let i = 0; i < 9; i++) { const yy = by - .21 * H - i * .02 * H, hw = lerp(.1, .058, i / 9) * H; g.moveTo(x - hw, yy); g.lineTo(x + hw, yy - .02 * H); g.moveTo(x + hw, yy); g.lineTo(x - hw, yy - .02 * H); }
    g.stroke();
  }
}
function dome(g, x, by, w, h, cBody, cDome, cLight) {
  g.fillStyle = cBody; g.fillRect(x - w * .62, by - h * .5, w * 1.24, h * .5);
  g.fillRect(x - w * .44, by - h * .72, w * .88, h * .24);
  g.fillStyle = cDome; g.beginPath(); g.ellipse(x, by - h * .72, w * .44, h * .3, 0, Math.PI, 0); g.fill();
  g.fillStyle = cLight; g.beginPath(); g.ellipse(x - w * .12, by - h * .76, w * .14, h * .18, 0, Math.PI, 0); g.fill();
  g.fillStyle = cBody; g.fillRect(x - w * .07, by - h * 1.1, w * .14, h * .12);
  g.fillStyle = cDome; g.fillRect(x - w * .015, by - h * 1.24, w * .03, h * .16);
}

function paintSprites() {
  // far: the Eiffel Tower, domes and the blue haze of the city
  LAYERS.far = paintCity({
    x0: -1300, x1: 1800, y0: -270, y1: 520, res: .7, seed: 5, scale: .38, top: 110, vary: 60, haze: .6, fog: .45, blur: 1.2, detail: 0,
    extras: (g, col) => {
      eiffel(g, 267, 300, 480, col('tower'), 'rgba(234,220,203,.25)');
      dome(g, -650, 240, 110, 230, col('facade'), col('gold'), mix(BASE.gold, '#fff4dc', .6));
      dome(g, 1180, 250, 120, 220, col('facade'), col('zincL'), col('cornice'));
      g.fillStyle = col('zinc');
      for (const sx of [-260, -226]) { g.fillRect(sx - 9, 60, 18, 90); g.beginPath(); g.moveTo(sx - 9, 60); g.lineTo(sx, -40); g.lineTo(sx + 9, 60); g.fill(); }
      g.beginPath(); g.moveTo(870, 80); g.lineTo(880, -10); g.lineTo(890, 80); g.fill();
    }
  });
  LAYERS.mid = paintCity({
    x0: -1300, x1: 2450, y0: -280, y1: 440, res: .8, seed: 17, scale: .56, top: -70, vary: 70, haze: .42, fog: .38, blur: .8, detail: 1,
    low: [[800, 1600, 20, 14]],
    extras: (g, col) => { dome(g, 1417, 40, 120, 200, col('facade'), col('copper'), mix(BASE.copper, '#f4efe6', .5)); }
  });
  LAYERS.near = paintCity({
    x0: -1300, x1: 3450, y0: -500, y1: 320, res: 1, seed: 29, scale: .8, top: -350, vary: 80, haze: .22, fog: .3, blur: .5, detail: 1,
    low: [[1750, 2750, -70, 26]]
  });
  // clouds
  const r = mulberry(3);
  for (let k = 0; k < 3; k++) {
    const w = 460, h = 190, c = mkCanvas(w, h), g = c.getContext('2d');
    for (let i = 0; i < 22; i++) {
      const cx = w * (.15 + r() * .7), cy = h * (.5 + (r() - .5) * .3) - (1 - Math.abs(cx / w - .5) * 2) * h * .12, rr = w * (.07 + r() * .12);
      const gg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gg.addColorStop(0, 'rgba(255,250,244,.55)'); gg.addColorStop(.6, 'rgba(255,248,240,.3)'); gg.addColorStop(1, 'rgba(255,248,240,0)');
      g.fillStyle = gg; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, h * .35, 0, h);
    sh.addColorStop(0, 'rgba(255,214,170,.35)'); sh.addColorStop(.55, 'rgba(170,160,190,.0)'); sh.addColorStop(1, 'rgba(150,145,175,.5)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    CLOUD_SPR.push(blurred(c, 3));
  }
  CLOUDS = [[-1150, -560, 1.1, 0], [-560, -720, .8, 1], [60, -470, 1.25, 2], [640, -650, .95, 0], [1180, -520, .8, 1], [1780, -610, 1.1, 2], [2350, -430, .9, 0], [-120, -860, .7, 1]];
  // leaves
  const LC = ['#c99a3d', '#a8743a', '#d8b04c', '#a9a24a', '#bf8a3a', '#8f6a33'];
  for (let k = 0; k < 6; k++) {
    const c = mkCanvas(64, 64), g = c.getContext('2d');
    g.translate(32, 34);
    g.fillStyle = LC[k];
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = -Math.PI / 2 + (i / 60 - .5) * TAU;
      const lobes = .62 + .38 * Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), .7);
      const rr = 24 * lobes * (Math.sin(a) > .3 ? .55 : 1);
      const X = Math.cos(a) * rr, Y = Math.sin(a) * rr;
      i ? g.lineTo(X, Y) : g.moveTo(X, Y);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,50,20,.45)'; g.lineWidth = 1.6; g.beginPath();
    g.moveTo(0, 14); g.lineTo(0, -20); g.moveTo(0, 4); g.lineTo(-15, -10); g.moveTo(0, 4); g.lineTo(15, -10); g.moveTo(0, 26); g.lineTo(0, 14); g.stroke();
    LEAF.push(c); LEAFB.push(blurred(c, 3.2));
  }
  // plane tree
  {
    const res = 1.2, X0 = -300, Y0 = -800, W = 620, H = 880;
    const c = mkCanvas(W * res, H * res), g = c.getContext('2d');
    g.scale(res, res); g.translate(-X0, -Y0);
    const tr = mulberry(41);
    g.fillStyle = '#948f78';
    g.beginPath(); g.moveTo(-15, 0); g.quadraticCurveTo(-12, -200, -10, -380); g.lineTo(10, -380); g.quadraticCurveTo(9, -200, 15, 0); g.closePath(); g.fill();
    g.strokeStyle = '#8b866f'; g.lineCap = 'round';
    for (const [x1, y1, x2, y2, wd] of [[0, -370, -120, -560, 11], [0, -370, 20, -640, 12], [0, -370, 140, -580, 10], [-60, -470, -190, -520, 6], [70, -470, 200, -500, 6]]) {
      g.lineWidth = wd; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2 + 20, (y1 + y2) / 2, x2, y2); g.stroke();
    }
    g.save(); g.beginPath(); g.rect(-16, -390, 32, 390); g.clip();
    for (let i = 0; i < 70; i++) { g.fillStyle = ['#cfc8ab', '#7a7662', '#b3ad90', '#e0dac0'][i % 4]; ell(g, -14 + tr() * 28, -tr() * 390, 3 + tr() * 7, 5 + tr() * 12, tr()); g.fill(); }
    g.fillStyle = 'rgba(40,40,30,.28)'; g.fillRect(4, -390, 12, 390);
    g.restore();
    const blobs = [];
    for (let i = 0; i < 340; i++) {
      const a = tr() * TAU, rr = Math.sqrt(tr());
      const bx = Math.cos(a) * rr * 250, byy = -565 + Math.sin(a) * rr * 190;
      if (byy > -380 && Math.abs(bx) < 40) continue;
      const l = clamp(.5 - bx / 520 - (byy + 565) / 400 + (tr() - .5) * .3, 0, 1);
      blobs.push([bx, byy, 14 + tr() * 22, l]);
    }
    blobs.sort((p, q) => p[3] - q[3]);
    const TC = ['#5f6236', '#7c7a3b', '#9a8d41', '#b89f4c', '#d5b560', '#e6c874'];
    for (const [bx, byy, rr, l] of blobs) {
      g.fillStyle = TC[Math.min(5, (l * 6) | 0)];
      for (let k = 0; k < 3; k++) { ell(g, bx + (tr() - .5) * rr, byy + (tr() - .5) * rr * .8, rr * (.45 + tr() * .35), rr * (.4 + tr() * .3), tr() * 3); g.fill(); }
    }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 28; i++) { const a = tr() * TAU, rr = .55 + tr() * .45; ell(g, Math.cos(a) * rr * 250, -565 + Math.sin(a) * rr * 190, 4 + tr() * 9, 4 + tr() * 8); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(70,66,52,.8)'; g.lineWidth = 3;
    for (const [x1, y1, x2, y2] of [[-60, -470, -150, -470], [40, -520, 90, -610], [-20, -560, -70, -660]]) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    TREE = { cv: c, x0: X0, y0: Y0, w: W, h: H };
  }
  // film grain
  for (let k = 0; k < 4; k++) {
    const c = mkCanvas(200, 200), g = c.getContext('2d'), im = g.createImageData(200, 200);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (Math.random() - .5) * 190; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); GRAIN.push(c);
  }
}

/* =====================================================================
   Rendering
   ===================================================================== */
const cv = document.getElementById('film');
const ctx = cv.getContext('2d', { alpha: false });
LS_OK = 'letterSpacing' in ctx;
let DPR = 1, S = 1, stage = { x: 0, y: 0, w: 1, h: 1 };
let grainPats = [];

function render(t, opts = {}) {
  t = clamp(t, 0, T_MAX - .1);
  const fi = t / DT, s = Math.min(NS - 2, fi | 0), fr = fi - s;
  const L = a => a[s] + (a[s + 1] - a[s]) * fr;
  let camX = L(SIM.cx), camY = L(SIM.cy);
  const z = L(SIM.cz);
  if (!reduced) { camX += fbm(t * .35 + 3) * 3.5; camY += fbm(t * .3 + 9) * 2.5; }
  const rot = reduced ? 0 : fbm(t * .22 + 1) * .0022;
  const k = DPR * S * z;
  const cxD = (stage.x + stage.w / 2) * DPR, cyD = (stage.y + stage.h / 2) * DPR;
  const hw = W0 / 2 / z * 1.04 + 30, hh = H0 / 2 / z * 1.04 + 30;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.beginPath(); ctx.rect(Math.round(stage.x * DPR), Math.round(stage.y * DPR), Math.round(stage.w * DPR), Math.round(stage.h * DPR)); ctx.clip();
  const layer = p => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(cxD, cyD); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-camX * p, -camY * p); };

  // --- sky
  layer(.04);
  const scx = camX * .04, scy = camY * .04;
  const sky = ctx.createLinearGradient(0, -1000, 0, 260);
  sky.addColorStop(0, '#7497bb'); sky.addColorStop(.3, '#9fb7cc'); sky.addColorStop(.58, '#d4d0c9'); sky.addColorStop(.8, '#f0d6b6'); sky.addColorStop(1, '#f4cfa3');
  ctx.fillStyle = sky; ctx.fillRect(scx - hw, scy - hh, hw * 2, hh * 2);
  const sunX = -760, sunY = -330;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 760);
  sg.addColorStop(0, 'rgba(255,248,232,1)'); sg.addColorStop(.04, 'rgba(255,240,214,.85)'); sg.addColorStop(.2, 'rgba(255,224,180,.2)'); sg.addColorStop(1, 'rgba(255,214,170,0)');
  ctx.fillStyle = sg; ctx.fillRect(sunX - 760, sunY - 760, 1520, 1520);
  // --- clouds
  layer(.06);
  for (const [cx0, cy0, sc, kk] of CLOUDS) {
    const x = cx0 + t * 7, w = 460 * sc, h = 190 * sc;
    if (x + w / 2 < camX * .06 - hw || x - w / 2 > camX * .06 + hw) continue;
    ctx.drawImage(CLOUD_SPR[kk], x - w / 2, cy0 - h / 2, w, h);
  }
  // --- distant birds, early morning
  if (t < 11) {
    layer(.2);
    ctx.strokeStyle = 'rgba(80,80,95,.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bx = -400 + i * 70 + t * (26 + i * 3), by = -560 - i * 26 + Math.sin(t * .8 + i) * 8, fl = Math.sin(t * 7 + i * 1.7) * 5;
      ctx.beginPath(); ctx.moveTo(bx - 7, by - fl); ctx.quadraticCurveTo(bx - 3, by - 3, bx, by); ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by - fl); ctx.stroke();
    }
  }
  // --- city layers
  for (const [key, p] of [['far', .12], ['mid', .3], ['near', .55]]) {
    const Ly = LAYERS[key];
    layer(p);
    ctx.drawImage(Ly.cv, Ly.x0, Ly.y0, Ly.w, Ly.h);
    const bottom = camY * p + hh;
    if (bottom > Ly.y0 + Ly.h) { ctx.fillStyle = mix(BASE.facade, HAZE, .45); ctx.fillRect(camX * p - hw, Ly.y0 + Ly.h - 1, hw * 2, bottom - Ly.y0 - Ly.h + 2); }
  }

  // --- the street
  layer(1);
  const vx0 = camX - hw * 1.02, vx1 = camX + hw * 1.02, vy0 = camY - hh, vy1 = camY + hh;
  const vis = BUILDINGS.filter(b => b.x + b.w + 60 > vx0 && b.x - 60 < vx1 && b.cornice - 220 < vy1);
  if (vis.length && vy0 < 60) {
    for (const b of vis) drawMansard(ctx, b);
    for (const b of vis) drawStack(ctx, b);
    for (const b of vis) drawBuildingFacade(ctx, b);
  }
  if (vx1 > GAP_X0 && vx0 < GAP_X1) drawBalustrade(ctx);
  for (const p of PIGEONS) if (p.x > vx0 - 300 && p.x < vx1 + 300) drawPigeon(ctx, p, t);
  if (vy1 > -20) { drawStreet(ctx, vx0, vx1, vy1); drawGroundLeaves(ctx, vx0, vx1); }

  // light: warm sun on the upper floors, cool shade in the street
  ctx.save();
  ctx.beginPath(); ctx.rect(vx0, vy0, vx1 - vx0, vy1 - vy0); ctx.rect(GAP_X0, vy0, GAP_X1 - GAP_X0, Math.max(0, -66 - vy0)); ctx.clip('evenodd');
  ctx.globalCompositeOperation = 'multiply';
  const shg = ctx.createLinearGradient(0, -900, 0, 320);
  shg.addColorStop(0, '#ffffff'); shg.addColorStop(.27, '#ffffff'); shg.addColorStop(.42, '#dddee4'); shg.addColorStop(.62, '#c6ccd7'); shg.addColorStop(.8, '#bcc4d1'); shg.addColorStop(1, '#c6ccd6');
  ctx.fillStyle = shg; ctx.fillRect(vx0, Math.max(vy0, -900), vx1 - vx0, vy1 - Math.max(vy0, -900));
  ctx.globalCompositeOperation = 'screen';
  const wg = ctx.createLinearGradient(0, -980, 0, -470);
  wg.addColorStop(0, 'rgba(255,186,112,.3)'); wg.addColorStop(.5, 'rgba(255,186,112,.14)'); wg.addColorStop(1, 'rgba(255,186,112,0)');
  ctx.fillStyle = wg; ctx.fillRect(vx0, -980, vx1 - vx0, 520);
  ctx.restore();
  // a patch of sun through the opening, on the pavement
  if (vx1 > GAP_X0 && vx0 < GAP_X1 + 300) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const pg = ctx.createLinearGradient(GAP_X0 + 40, 0, GAP_X1 + 180, 0);
    pg.addColorStop(0, 'rgba(255,214,160,0)'); pg.addColorStop(.18, 'rgba(255,214,160,.3)'); pg.addColorStop(.8, 'rgba(255,214,160,.3)'); pg.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(GAP_X0 + 40, 0); ctx.lineTo(GAP_X1 + 40, 0); ctx.lineTo(GAP_X1 + 180, 72); ctx.lineTo(GAP_X0 + 180, 72); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // balloon shadow on the stone
  const bX = L(SIM.bx), bY = L(SIM.by), bA = L(SIM.ba);
  if (bY > -760 && bY < 40 && !(bX > GAP_X0 + 60 && bX < GAP_X1 - 20)) {
    const a = sstep(-760, -640, bY) * .2;
    const sx = bX + 62, sy = bY + 44;
    const shd = ctx.createRadialGradient(sx, sy, 4, sx, sy, 40);
    shd.addColorStop(0, `rgba(40,30,40,${a})`); shd.addColorStop(1, 'rgba(40,30,40,0)');
    ctx.fillStyle = shd; ctx.fillRect(sx - 40, sy - 40, 80, 80);
  }

  // street furniture
  if (vy1 > -350) {
    const bs = s, boyX = L(SIM.boyX);
    if (vx0 < 2700 && vx1 > 2300) drawCafeTerrace(ctx);
    const TL = SIM.leafDefs, LV = SIM.LV, NL = SIM.NL;
    for (let i = 0; i < NL; i++) { const o = (s * NL + i) * 5; if (LV[o + 4] === 2) { ctx.save(); ctx.translate(LV[o], LV[o + 1]); ctx.rotate(LV[o + 2]); ctx.scale(1, .45); ctx.drawImage(LEAF[TL[i].k], -6.5, -6.5, 13, 13); ctx.restore(); } }
    if (t >= BOY_T0 && boyX > vx0 - 60 && boyX < vx1 + 60) {
      const head = lerp(lerp(-.12, .2, s2step(TS + .1, TS + .45, t)), .82, s2step(TS + .95, TS + 2.1, t)) + .03 * Math.sin(t * 1.7) * sstep(TS + 2, TS + 3, t);
      const amp = L(SIM.boyAmp);
      drawBoy(ctx, boyX, BOY_Y, {
        ph: L(SIM.boyPh), amp, head,
        lean: -.06 * amp + .06 * s2step(TS + 1, TS + 2.3, t),
        reach: s2step(TS + 2.6, TS + 4.1, t),
        lit: sstep(GAP_X1 + 60, GAP_X1 - 140, boyX)
      });
    }
    if (vx0 < MORRIS_X + 80 && vx1 > MORRIS_X - 80) drawMorris(ctx, MORRIS_X, MORRIS_Y);
    for (const lx of LAMPS) if (lx > vx0 - 60 && lx < vx1 + 60) drawLamp(ctx, lx, LAMP_Y, lx === LAMP_X);
    if (TREE_X + 300 > vx0 && TREE_X - 300 < vx1) {
      ctx.fillStyle = '#2d302c'; ctx.fillRect(TREE_X - 62, TREE_Y - 6, 124, 11);
      ctx.fillStyle = '#4a4d47'; for (let gx = -56; gx < 58; gx += 8) ctx.fillRect(TREE_X + gx, TREE_Y - 5, 3, 9);
      ctx.save(); ctx.translate(TREE_X, TREE_Y);
      ctx.transform(1, 0, -(.012 * Math.sin(t * 1.3) + .02 * gust(t)), 1, 0, 0);
      ctx.drawImage(TREE.cv, TREE.x0, TREE.y0, TREE.w, TREE.h); ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const lx of LAMPS) if (lx > vx0 - 100 && lx < vx1 + 100) lampGlow(ctx, lx, LAMP_Y);
    ctx.restore();
  }

  // flying leaves in the balloon's plane
  const TL = SIM.leafDefs, LV = SIM.LV, NL = SIM.NL;
  const drawLeaf = (i, blur) => {
    const o = (s * NL + i) * 5; if (LV[o + 4] !== 1) return;
    const d = TL[i], sz = 12.5 * d.p;
    ctx.save(); ctx.translate(LV[o], LV[o + 1]); ctx.rotate(LV[o + 2]);
    const fl = Math.cos(LV[o + 3]); ctx.scale(Math.abs(fl) < .14 ? .14 * Math.sign(fl || 1) : fl, 1);
    ctx.drawImage(blur ? LEAFB[d.k] : LEAF[d.k], -sz / 2, -sz / 2, sz, sz); ctx.restore();
  };
  for (let i = 0; i < NL; i++) if (TL[i].p === 1) drawLeaf(i, false);
  // .85 depth leaves (slightly behind)
  layer(.85); for (let i = 0; i < NL; i++) if (TL[i].p === .85) drawLeaf(i, false);
  layer(1);

  // the string and the balloon
  const P = drawRope(ctx, s, fr);
  if (t >= TS) {
    const K = SIM.K;
    ctx.strokeStyle = 'rgba(36,26,24,.92)'; ctx.lineWidth = 1.3;
    ell(ctx, P[K][0], P[K][1] + 1.5, 3.4, 3.6); ctx.stroke();
  }
  drawBalloon(ctx, bX, bY, bA, t);

  // foreground leaves, out of focus
  for (const p of [1.35, 1.55]) { layer(p); for (let i = 0; i < NL; i++) if (TL[i].p === p) drawLeaf(i, true); }

  // --- screen-space atmosphere
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const SX = stage.x * DPR, SY = stage.y * DPR, SW = stage.w * DPR, SH = stage.h * DPR;
  const sunSX = cxD + k * (sunX - camX * .04), sunSY = cyD + k * (sunY - camY * .04);
  ctx.globalCompositeOperation = 'screen';
  const rayA = .06 + .06 * (1 - sstep(8, 14, t));
  for (let i = 0; i < 6; i++) {
    const a = .28 + i * .11 + Math.sin(t * .13 + i * 1.7) * .025, len = SW * 1.9, wdt = .025 + .02 * hash(i + 3);
    const g = ctx.createLinearGradient(sunSX, sunSY, sunSX + Math.cos(a) * len, sunSY + Math.sin(a) * len);
    g.addColorStop(0, `rgba(255,226,180,${rayA * (.7 + .3 * Math.sin(t * .4 + i))})`); g.addColorStop(1, 'rgba(255,226,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sunSX, sunSY);
    ctx.lineTo(sunSX + Math.cos(a - wdt) * len, sunSY + Math.sin(a - wdt) * len); ctx.lineTo(sunSX + Math.cos(a + wdt) * len, sunSY + Math.sin(a + wdt) * len); ctx.closePath(); ctx.fill();
  }
  // dust in the light
  for (let i = 0; i < 70; i++) {
    const dp = .6 + hash(i * 3.1) * .9;
    const u = ((hash(i) + t * .011 * dp - camX * .00018 * dp) % 1 + 1) % 1;
    const v = ((hash(i * 1.7) + t * .004 + .02 * Math.sin(t * .6 + i) - camY * .00018 * dp) % 1 + 1) % 1;
    const tw = .5 + .5 * Math.sin(t * (1 + hash(i * 5)) * 2 + i);
    ctx.fillStyle = `rgba(255,236,200,${.22 * tw})`;
    ell(ctx, SX + u * SW, SY + v * SH, (.7 + dp) * DPR * S, (.7 + dp) * DPR * S); ctx.fill();
  }
  // grade
  ctx.globalCompositeOperation = 'soft-light';
  const gg = ctx.createLinearGradient(0, SY, 0, SY + SH);
  gg.addColorStop(0, 'rgba(255,170,90,.45)'); gg.addColorStop(.55, 'rgba(255,200,150,.12)'); gg.addColorStop(1, 'rgba(40,80,120,.4)');
  ctx.fillStyle = gg; ctx.fillRect(SX, SY, SW, SH);
  ctx.globalCompositeOperation = 'multiply';
  const vg = ctx.createRadialGradient(SX + SW / 2, SY + SH * .46, SH * .55, SX + SW / 2, SY + SH / 2, SW * .72);
  vg.addColorStop(0, 'rgba(255,255,255,1)'); vg.addColorStop(1, 'rgba(128,104,90,1)');
  ctx.fillStyle = vg; ctx.fillRect(SX, SY, SW, SH);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = .075;
  const gp = grainPats[reduced ? 0 : ((t * 24) | 0) % grainPats.length];
  ctx.save(); ctx.translate(SX + (reduced ? 0 : hash(t * 24 | 0) * 200), SY + (reduced ? 0 : hash((t * 24 | 0) + 7) * 200)); ctx.fillStyle = gp; ctx.fillRect(-200, -200, SW + 400, SH + 400); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // fades
  if (!opts.poster) {
    const f = Math.max(1 - s2step(0, 2.4, t), s2step(T_END - 1.9, T_END, t));
    if (f > 0) { ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(SX, SY, SW, SH); }
  }
  ctx.restore();
}

/* =====================================================================
   Sound: a small score for piano and strings, wind, bells and footsteps,
   all synthesised with the Web Audio API.
   ===================================================================== */
let ac = null, master, reverb, runBus = null, noiseBuf, pinkBuf, wind = null, EVENTS = [], evIdx = 0, muted = false;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function makeNoise(sec, pink) {
  const b = ac.createBuffer(2, ac.sampleRate * sec, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (!pink) { d[i] = w; continue; }
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
    }
  }
  return b;
}
function makeIR(sec) {
  const len = ac.sampleRate * sec | 0, b = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const x = i / len; lp = lp * .72 + (Math.random() * 2 - 1) * .28; d[i] = lp * Math.pow(1 - x, 2.6) * (i < ac.sampleRate * .012 ? i / (ac.sampleRate * .012) : 1); }
  }
  return b;
}
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : .95;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .012; comp.release.value = .3;
    master.connect(comp); comp.connect(ac.destination);
    reverb = ac.createConvolver(); reverb.buffer = makeIR(3.6);
    const rv = ac.createGain(); rv.gain.value = .85; reverb.connect(rv); rv.connect(master);
    noiseBuf = makeNoise(3, false); pinkBuf = makeNoise(6, true);
    setupWind();
    return true;
  } catch (e) { ac = null; return false; }
}
function newRunBus() {
  if (runBus) { const old = runBus; old.gain.setTargetAtTime(0, ac.currentTime, .06); setTimeout(() => { try { old.disconnect(); } catch (e) { } }, 800); }
  runBus = ac.createGain(); runBus.gain.value = 1;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5600; lp.Q.value = .4;
  runBus.connect(lp); lp.connect(master);
  const send = ac.createGain(); send.gain.value = .45; runBus.connect(send); send.connect(reverb);
}
function panned(pan) {
  const g = ac.createGain();
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(runBus); }
  else g.connect(runBus);
  return g;
}
function piano(t, m, vel, dur) {
  const f = mtof(m), out = panned((m - 64) / 44);
  const amps = [1, .42, .26, .15, .09, .06, .035, .02];
  const tOff = t + dur, end = tOff + 1.4, base = .15 * vel;
  for (let n = 1; n <= 8; n++) {
    const fn = f * n * Math.sqrt(1 + .00038 * n * n); if (fn > 11000) break;
    const a = base * amps[n - 1] * (n > 1 ? .55 + vel * .8 : 1);
    const o = ac.createOscillator(); o.frequency.value = fn;
    if (n === 1) o.detune.value = .9; else if (n === 2) o.detune.value = -.7;
    const g = ac.createGain();
    const d1 = .32 / Math.sqrt(n), d2 = clamp(3.4 - (m - 48) * .045, .8, 4.2) / Math.pow(n, .7);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .006);
    g.gain.setTargetAtTime(a * .42, t + .006, d1);
    g.gain.setTargetAtTime(0, t + .006 + d1 * 1.5, d2);
    g.gain.setTargetAtTime(0, Math.max(tOff, t + .02 + d1 * 1.5), .2);
    o.connect(g); g.connect(out); o.start(t); o.stop(end);
    if (n === 1) { const o2 = ac.createOscillator(); o2.frequency.value = fn; o2.detune.value = -1.3; const g2 = ac.createGain(); g2.gain.value = .35; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(end); }
  }
  const ns = ac.createBufferSource(); ns.buffer = noiseBuf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 3, 4200); bp.Q.value = .9;
  const ng = ac.createGain(); ng.gain.setValueAtTime(.03 * vel, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .05);
  ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t, Math.random() * 2, .08);
}
function pad(t, notes, dur, lvl) {
  const out = panned(0);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .5;
  lp.frequency.setValueAtTime(650, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * .6); lp.frequency.linearRampToValueAtTime(800, t + dur + 2);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 1.5); g.gain.setValueAtTime(lvl, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 2.3);
  lp.connect(g); g.connect(out);
  const lfo = ac.createOscillator(); lfo.frequency.value = 4.7; const lg = ac.createGain(); lg.gain.value = 5; lfo.connect(lg);
  for (const m of notes) for (const d of [-7, 6]) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = d;
    lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 2.6);
  }
  lfo.start(t); lfo.stop(t + dur + 2.6);
}
function chime(t, m, vel) {
  const out = panned(.3), f = mtof(m);
  for (const [r, a, d] of [[1, 1, 1.9], [2.76, .22, .5], [5.4, .08, .25]]) {
    const o = ac.createOscillator(); o.frequency.value = f * r; const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06 * vel * a, t + .004); g.gain.setTargetAtTime(0, t + .004, d / 3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d * 2.5);
  }
}
function bell(t, f, vol) {
  const out = panned(-.4), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.connect(out);
  const R = [[.5, .35, 5], [1, 1, 3.4], [1.19, .5, 2.6], [1.5, .35, 2], [2, .3, 1.6], [2.52, .18, 1.1], [2.99, .12, .9], [4.07, .08, .6]];
  for (const [r, a, d] of R) {
    const o = ac.createOscillator(); o.frequency.value = f * r; const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + .01); g.gain.setTargetAtTime(0, t + .01, d / 2.5);
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + d * 3);
  }
}
function noiseHit(t, freq, q, vol, dur, pan) {
  const out = panned(pan), s = ac.createBufferSource(); s.buffer = noiseBuf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 2, dur + .02);
}
function chirp(t, pan) {
  const out = panned(pan);
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = t + i * .085;
    o.frequency.setValueAtTime(3600 + Math.random() * 500, t0); o.frequency.exponentialRampToValueAtTime(5200 + Math.random() * 600, t0 + .045);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.014, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + .06);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + .08);
  }
}
function flutter(t, pan) { for (let i = 0; i < 16; i++) noiseHit(t + i * .072 * (1 + i * .02), 900 + Math.random() * 700, 1.1, .09 * (1 - i / 17), .035, pan); }
function footstep(t, pan, vol) {
  noiseHit(t, 1500, .9, vol, .05, pan);
  const out = panned(pan), o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + .06);
  g.gain.setValueAtTime(vol * .5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + .1);
}
function snagSound(t) {
  const out = panned(-.15);
  const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  o.frequency.setValueAtTime(640, t); o.frequency.linearRampToValueAtTime(1150, t + .11); o.frequency.linearRampToValueAtTime(860, t + .24);
  lfo.frequency.value = 36; lg.gain.value = 55; lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022, t + .02); g.gain.linearRampToValueAtTime(.016, t + .18); g.gain.linearRampToValueAtTime(0, t + .3);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + .32); lfo.start(t); lfo.stop(t + .32);
  const tr = ac.createOscillator(), tg = ac.createGain(); tr.type = 'triangle'; tr.frequency.value = 196;
  tg.gain.setValueAtTime(.035, t + .02); tg.gain.exponentialRampToValueAtTime(.0001, t + .7); tr.connect(tg); tg.connect(out); tr.start(t + .02); tr.stop(t + .75);
  const bp = ac.createOscillator(), bg = ac.createGain(); bp.frequency.setValueAtTime(150, t + .05); bp.frequency.exponentialRampToValueAtTime(75, t + .2);
  bg.gain.setValueAtTime(.08, t + .05); bg.gain.exponentialRampToValueAtTime(.0001, t + .24); bp.connect(bg); bg.connect(out); bp.start(t + .05); bp.stop(t + .26);
}
function setupWind() {
  const src = ac.createBufferSource(); src.buffer = pinkBuf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = .6;
  const g1 = ac.createGain(); g1.gain.value = 0;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 4.5;
  const g2 = ac.createGain(); g2.gain.value = 0;
  const city = ac.createBiquadFilter(); city.type = 'lowpass'; city.frequency.value = 170;
  const g3 = ac.createGain(); g3.gain.value = 0;
  const bus = ac.createGain(); bus.gain.value = 1;
  src.connect(lp); lp.connect(g1); g1.connect(bus);
  src.connect(bp); bp.connect(g2); g2.connect(bus);
  src.connect(city); city.connect(g3); g3.connect(bus);
  let pan = null;
  if (ac.createStereoPanner) { pan = ac.createStereoPanner(); bus.connect(pan); pan.connect(master); } else bus.connect(master);
  const send = ac.createGain(); send.gain.value = .2; bus.connect(send); send.connect(reverb);
  src.start();
  wind = { lp, g1, bp, g2, g3, pan };
}
function updateWind(t, on) {
  if (!wind) return;
  const now = ac.currentTime;
  const f = on ? s2step(0, 2.2, t) * (1 - s2step(T_END - 2, T_END + .5, t)) : 0;
  const w = .22 + gust(t) * .95;
  wind.lp.frequency.setTargetAtTime(220 + 520 * w, now, .15);
  wind.g1.gain.setTargetAtTime((.1 + .32 * w) * f, now, .15);
  wind.bp.frequency.setTargetAtTime(650 + 950 * w, now, .2);
  wind.g2.gain.setTargetAtTime(.03 * w * w * f, now, .2);
  wind.g3.gain.setTargetAtTime(.12 * sstep(10, 14, t) * f, now, .4);
  if (wind.pan) wind.pan.pan.setTargetAtTime(Math.sin(t * .3) * .45, now, .3);
}

function buildScore() {
  const E = [], B = BAR, bt = B / 3, e8 = bt / 2, r = mulberry(21);
  const CH = [
    [[38, 57, 64, 66]], [[38, 57, 61, 66]], [[35, 54, 62, 64]], [[43, 50, 59, 66]],
    [[45, 52, 57, 61]], [[42, 49, 57, 64]], [[43, 50, 59, 66]], [[40, 47, 55, 62], [45, 52, 55, 61]],
    null, [[38, 50, 57, 64]], [[43, 50, 59, 61]], null];
  const AV = [.26, .28, .3, .32, .34, .36, .38, .4, 0, .34, .3, .28];
  const pat = [0, 1, 2, 3, 2, 1];
  CH.forEach((ch, b) => {
    if (!ch) return;
    for (let i = 0; i < 6; i++) {
      const c = ch.length > 1 && i >= 3 ? ch[1] : ch[0];
      const n = c[pat[i]], t = b * B + i * e8 + (r() - .5) * .018;
      const rest = (ch.length > 1 ? (i < 3 ? 3 : 6) : 6) * e8 - i % 3 * e8 + .25;
      E.push({ t, f: () => [piano, n, AV[b] * (i === 0 ? 1.35 : .9 + r() * .2), i === 0 ? B + .3 : rest] });
    }
  });
  const MEL = [
    [1, 0, 78, 1.5], [1, 1.5, 76, .5], [1, 2, 74, 1],
    [2, 0, 74, 1], [2, 1, 73, .5], [2, 1.5, 74, .5], [2, 2, 78, 1],
    [3, 0, 76, 2], [3, 2, 71, 1],
    [4, 0, 73, 1.5], [4, 1.5, 69, 1.5],
    [5, 0, 69, 1], [5, 1, 73, 1], [5, 2, 76, 1],
    [6, 0, 78, 1.5], [6, 1.5, 74, .5], [6, 2, 71, 1],
    [7, 0, 79, 1], [7, 1, 78, 1], [7, 2, 76, .5], [7, 2.5, 73, .5],
    [8, 0, 81, 3],
    [9, 0, 78, 1], [9, 1, 76, .5], [9, 1.5, 74, 1.5],
    [10, 0, 71, 1], [10, 1, 74, 1], [10, 2, 81, 1],
    [11, 0, 78, 3]];
  for (const [b, beat, m, d] of MEL) {
    const v = b === 8 ? .34 : .42 + (b >= 5 && b <= 7 ? .06 : 0) + (b === 9 ? .08 : 0);
    E.push({ t: b * B + beat * bt + .02, f: () => [piano, m, v, d * bt * 1.1 + .45] });
  }
  E.push({ t: 0.05, f: () => [chime, 86, .7] });
  // snag: a suspended, rolled chord and a small bell
  [47, 54, 57, 64, 69].forEach((m, i) => E.push({ t: 8 * B + i * .07, f: () => [piano, m, .3, 2.6] }));
  E.push({ t: TS + .03, f: () => [chime, 93, .55] });
  E.push({ t: TS + .45, f: () => [chime, 88, .35] });
  // the boy looks up: resolution
  [38, 50, 57, 62, 66, 69, 74].forEach((m, i) => E.push({ t: 9 * B + i * .06, f: () => [piano, m, .36, 2.9] }));
  [38, 50, 57, 64, 66, 69, 74, 78].forEach((m, i) => E.push({ t: 11 * B + i * .075, f: () => [piano, m, .33, 3.6] }));
  E.push({ t: 11 * B + 1.5 * bt, f: () => [chime, 86, .45] });
  const PADS = [[2, [54, 62, 66], .5], [3, [55, 59, 66], .6], [4, [57, 61, 64], .7], [5, [54, 57, 64], .8], [6, [55, 59, 62, 66], .9], [7, [55, 59, 62], 1],
    [8, [64, 69, 76], .55], [9, [50, 57, 62, 66, 69], 1.25], [10, [55, 59, 62, 66], 1.05], [11, [50, 57, 62, 66, 69], .95]];
  for (const [b, n, l] of PADS) E.push({ t: b * B - .4, f: () => [pad, n, B + (b === 11 ? 1.5 : .2), .016 * l] });
  for (const [b, m] of [[3, 55], [4, 57], [5, 54], [6, 55], [7, 52], [9, 50], [10, 55], [11, 50]]) E.push({ t: b * B - .3, f: () => [pad, [m - 12], B + .3, .02] });
  E.push({ t: .9, f: () => [bell, 293.66, .045] });
  E.push({ t: 3.4, f: () => [bell, 220, .035] });
  for (const [tt, p] of [[1.6, -.5], [1.9, -.45], [5.3, .6], [5.55, .55], [10.8, -.3], [11.15, -.35], [15.9, .5], [TS + 5.5, .6]]) E.push({ t: tt, f: () => [chirp, p] });
  for (const p of PIGEONS) E.push({ t: p.to, f: () => [flutter, clamp((p.x - SIM.cx[Math.round(p.to / DT)]) / 700, -.8, .8)] });
  for (const st of SIM.steps) {
    const si = Math.round(st.t / DT), z = SIM.cz[si], pan = clamp((st.x - SIM.cx[si]) / (W0 / 2 / z), -.85, .85);
    E.push({ t: st.t, f: () => [footstep, pan, .09 * sstep(16.8, 18.4, st.t)] });
  }
  E.push({ t: TS, f: () => [snagSound] });
  E.sort((a, b) => a.t - b.t);
  EVENTS = E;
}

/* =====================================================================
   Playback
   ===================================================================== */
const $ = id => document.getElementById(id);
const intro = $('intro'), endEl = $('end'), controls = $('controls'), stageEl = $('stage');
const capOpen = $('capOpen'), capEnd = $('capEnd');
let state = 'loading', base = 0, pausedAt = 0, posterT = 25.8;
const wall = () => ac ? ac.currentTime : performance.now() / 1000;
const sceneTime = () => state === 'paused' ? pausedAt : wall() - base;

function resize() {
  const iw = window.innerWidth, ih = window.innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(iw * DPR); cv.height = Math.round(ih * DPR);
  let sw = iw, sh = iw / ASPECT; if (sh > ih) { sh = ih; sw = ih * ASPECT; }
  stage = { x: (iw - sw) / 2, y: (ih - sh) / 2, w: sw, h: sh }; S = sh / H0;
  Object.assign(stageEl.style, { left: stage.x + 'px', top: stage.y + 'px', width: sw + 'px', height: sh + 'px' });
  stageEl.style.setProperty('--u', (sh / 100) + 'px');
  grainPats = GRAIN.map(g => ctx.createPattern(g, 'repeat'));
  if (state !== 'loading') { if (state === 'playing') return; render(state === 'paused' ? pausedAt : state === 'ended' ? T_END : posterT, { poster: state !== 'paused' }); }
}

function captions(t) {
  capOpen.style.opacity = (s2step(2.3, 3.5, t) * (1 - s2step(6.2, 7.4, t))).toFixed(3);
  capEnd.style.opacity = (s2step(TS + 4.0, TS + 5.3, t) * (1 - s2step(T_END - 2.4, T_END - 1.2, t))).toFixed(3);
}

function startRun() {
  if (ac && ac.state === 'suspended') ac.resume();
  if (ac) newRunBus();
  evIdx = 0;
  base = wall() + .15;
  state = 'playing';
  intro.classList.add('fade'); setTimeout(() => { intro.hidden = true; }, 700);
  endEl.classList.add('fade'); endEl.hidden = true;
  controls.hidden = false; flashControls();
  setPauseIcon(false);
}
function schedule(t) {
  if (!ac) return;
  while (evIdx < EVENTS.length && EVENTS[evIdx].t < t + .35) {
    const e = EVENTS[evIdx++];
    if (e.t < t - .04) continue;
    try { const [fn, ...args] = e.f(); fn(base + e.t, ...args); } catch (err) { }
  }
}
function togglePause() {
  if (state === 'playing') { pausedAt = sceneTime(); state = 'paused'; if (ac) ac.suspend(); setPauseIcon(true); }
  else if (state === 'paused') {
    const go = () => { base = wall() - pausedAt; state = 'playing'; setPauseIcon(false); };
    if (ac) ac.resume().then(go); else go();
  } else if (state === 'ended') startRun();
}
function setPauseIcon(p) { $('icoPause').hidden = p; $('icoPlay').hidden = !p; $('bPause').setAttribute('aria-label', p ? 'Play' : 'Pause'); }
function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : .95, ac.currentTime, .05);
  $('icoSound').hidden = muted; $('icoMuted').hidden = !muted; $('bMute').setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}
let hideTimer = 0;
function flashControls() { controls.classList.add('show'); clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (state === 'playing') controls.classList.remove('show'); }, 2200); }

function frame() {
  requestAnimationFrame(frame);
  if (state === 'playing') {
    const t = sceneTime();
    if (t >= T_END) {
      state = 'ended'; render(T_END); captions(T_END); updateWind(T_END, false);
      endEl.hidden = false; requestAnimationFrame(() => endEl.classList.remove('fade'));
      controls.classList.add('show');
      return;
    }
    render(Math.max(0, t)); captions(Math.max(0, t)); schedule(t); updateWind(Math.max(0, t), true);
  }
}

$('play').addEventListener('click', () => { if (!ac) initAudio(); startRun(); });
$('again').addEventListener('click', () => { if (!ac) initAudio(); startRun(); });
$('bPause').addEventListener('click', togglePause);
$('bMute').addEventListener('click', toggleMute);
$('bRestart').addEventListener('click', () => { if (state !== 'loading') startRun(); });
window.addEventListener('pointermove', () => { if (state === 'playing' || state === 'paused') flashControls(); });
window.addEventListener('keydown', e => {
  if (state === 'loading' || e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.key === ' ') { e.preventDefault(); if (state === 'intro') { if (!ac) initAudio(); startRun(); } else togglePause(); flashControls(); }
  else if (e.key === 'm' || e.key === 'M') { toggleMute(); flashControls(); }
  else if (e.key === 'r' || e.key === 'R') { if (!ac) initAudio(); startRun(); }
});
window.addEventListener('resize', resize);

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('500 15px Jost'), document.fonts.load('italic 400 40px "Cormorant Garamond"')]), new Promise(r => setTimeout(r, 1800))]); } catch (e) { }
  genBuildings(); genPigeons();
  simulate();
  paintSprites();
  makePatterns(ctx);
  buildScore();
  posterT = TS + 5.4;
  state = 'intro';
  resize();
  render(posterT, { poster: true });
  $('play').disabled = false; $('playLabel').textContent = 'Play with sound';
  $('play').focus({ preventScroll: true });
  requestAnimationFrame(frame);
  window.__film = { render: (t, o) => render(t, o || {}), get TS() { return TS; }, get T_END() { return T_END; }, captions };
}
boot();
})();
