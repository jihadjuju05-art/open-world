// Designed world layout: settlements (city / towns / villages / farms / camps), the road network that links them
// (A* over the raw terrain, smoothed, with a per-road height profile) and every building placement.
// Pure maths (no THREE) so it runs in the terrain worker, the map worker and the main thread; deterministic per seed.
import { hash2, smoothstep } from './noise.js';
import { SIZES, STYLES } from './housedata.js';

export const WORLD_R = 3600;
export const FRONT_OFFSET = 0;                       // model front is +Z; tweak if a pack faces another way
// building type -> [glb proto, target footprint (m), collision radius (m)]
export const BLD = {
  house1: ['props/vil_House_1', 6, 4.6], house2: ['props/vil_House_2', 6.8, 5], house3: ['props/vil_House_3', 6, 4.6], house4: ['props/vil_House_4', 5.2, 4],
  inn: ['props/vil_Inn', 10.5, 7.5], smith: ['props/vil_Blacksmith', 7.5, 5.5], stable: ['props/vil_Stable', 9, 6.5], tower: ['props/vil_Bell_Tower', 5.2, 3.6],
  mill: ['props/far_TowerWindmill', 9, 4.2], sawmill: ['props/vil_Sawmill', 7.5, 5], well: ['props/vil_Well', 2, 1.5], stall1: ['props/vil_MarketStand_1', 2.7, 1.9], stall2: ['props/vil_MarketStand_2', 2.7, 1.9],
  cart: ['props/vil_Cart', 2.7, 1.7], barrel: ['props/vil_Barrel', 0.9, .5], hay: ['props/vil_Hay', 1.8, 1], bench: ['props/vil_Bench_1', 1.8, 0], gazebo: ['props/vil_Gazebo', 3.8, 2.6],
  barn: ['props/far_Barn', 9, 4.8], bigbarn: ['props/far_BigBarn', 10, 5.2], openbarn: ['props/far_OpenBarn', 7, 3.6], sbarn: ['props/far_Small_Barn', 7, 3.8], silo: ['props/far_Silo', 4, 2.2], coop: ['props/far_ChickenCoop', 2.6, 1.4],
  home: ['props/none', 10, 0], fence: ['props/far_Fence', 5.9, 0], tent: ['props/sur_tent_1', 3.6, 1.8], tent2: ['props/sur_tentClosed_1', 3.4, 1.8], fire: ['props/sur_campfire_1', 1.4, .6], crate: ['props/sur_box_1', 1, .5],
};
export const BLD_NAMES = Object.keys(BLD);
const TYPE = { 0: 'Ciudad', 1: 'Pueblo', 2: 'Aldea', 3: 'Granja', 4: 'Campamento' };
const RADIUS = [150, 105, 75, 42, 22];
const PA = ['Roca', 'Valle', 'Pino', 'Cañón', 'Río', 'Piedra', 'Sol', 'Luna', 'Álamo', 'Cobre', 'Hierro', 'Oro', 'Polvo', 'Sauce', 'Cuervo', 'Halcón', 'Mesa', 'Arroyo', 'Trigal', 'Ceniza', 'Nogal', 'Espino', 'Cedro', 'Coyote', 'Bisonte', 'Mina', 'Colina', 'Fuerte'];
const PB = ['Seco', 'Alto', 'Bravo', 'Dorado', 'Perdido', 'Blanco', 'Rojo', 'del Norte', 'del Sur', 'Viejo', 'Nuevo', 'Hondo', 'Claro', 'Ciego', 'Grande', 'Tranquilo'];
export const typeName = t => TYPE[t];

export function buildPlan(seed, raw) {
  const H = raw.h, S = raw.slope, hs = (a, b, c) => hash2(a + seed * .001, b, c);
  const settlements = [], placed = (x, z, d) => settlements.every(s => Math.hypot(s.x - x, s.z - z) >= d);
  const flat = (x, z, r) => { let m = 0, lo = 1e9; for (let k = 0; k < 8; k++) { const a = k * .785, h = H(x + Math.cos(a) * r, z + Math.sin(a) * r); if (h < 1.2) return -1; m = Math.max(m, Math.abs(h - H(x, z))); lo = Math.min(lo, h); } return m; };

  // ---------- candidate sites ----------
  const cands = [];
  for (let gz = -3300; gz <= 3300; gz += 300) for (let gx = -3300; gx <= 3300; gx += 300) {
    const x = gx + (hs(gx, gz, 1) - .5) * 240, z = gz + (hs(gx, gz, 2) - .5) * 240, h = H(x, z);
    if (Math.hypot(x, z) > 3400 || h < 3 || h > 40) continue;
    const rv = raw.river(x, z); if (rv.chan > .01) continue;
    const dh = flat(x, z, 60); if (dh < 0 || dh > 9 || S(x, z) > .14) continue;
    cands.push({ x, z, h, score: -dh * .35 + (rv.val > .05 ? 1.3 : 0) + hs(gx, gz, 3) * .9 - Math.hypot(x, z) / 4200 });
  }
  cands.sort((a, b) => b.score - a.score);
  const add = (c, type) => { const s = { id: settlements.length, type, x: c.x, z: c.z, r: RADIUS[type], name: '', axis: hs(c.x, c.z, 9) * Math.PI, items: [] }; s.h = c.h; settlements.push(s); return s; };
  const central = cands.filter(c => Math.hypot(c.x, c.z) < 1400)[0] || cands[0]; if (central) add(central, 0);
  for (const c of cands) { if (settlements.filter(s => s.type === 1).length >= 5) break; if (placed(c.x, c.z, 1000)) add(c, 1); }
  for (const c of cands) { if (settlements.filter(s => s.type === 2).length >= 13) break; if (placed(c.x, c.z, 560)) add(c, 2); }
  // farms around villages/towns, camps in the wild
  const hubs = settlements.slice();
  for (const hub of hubs) for (let k = 0; k < (hub.type === 2 ? 1 : 2); k++) for (let t = 0; t < 8; t++) {
    const a = hs(hub.id, k, 20 + t) * 6.283, d = hub.r * 1.5 + 60 + hs(hub.id, k, 40 + t) * 120, x = hub.x + Math.cos(a) * d, z = hub.z + Math.sin(a) * d, h = H(x, z);
    if (h < 3 || h > 45 || S(x, z) > .12 || raw.river(x, z).val > .2 || flat(x, z, 30) < 0 || !placed(x, z, 170)) continue; add({ x, z, h }, 3); break;
  }
  for (let t = 0; t < 400 && settlements.filter(s => s.type === 4).length < 16; t++) {
    const x = (hs(t, 1, 50) - .5) * 6400, z = (hs(t, 2, 50) - .5) * 6400, h = H(x, z);
    if (Math.hypot(x, z) > 3500 || h < 4 || h > 90 || S(x, z) > .2 || raw.river(x, z).val > .1 || flat(x, z, 16) < 0 || !placed(x, z, 320)) continue; add({ x, z, h }, 4);
  }
  settlements.forEach((s, i) => {
    let m = 0; for (let k = 0; k < 9; k++) { const a = k * .7, r = k ? s.r * .5 : 0; m += H(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r); } s.h = m / 9;
    s.name = s.type === 4 ? 'Campamento ' + PA[Math.floor(hs(i, 1, 60) * PA.length)] : (s.type === 3 ? 'Rancho ' : '') + PA[Math.floor(hs(i, 2, 61) * PA.length)] + (s.type === 3 ? '' : ' ' + PB[Math.floor(hs(i, 3, 62) * PB.length)]);
  });

  // ---------- roads: A* over a coarse grid ----------
  const G = 48, N = Math.ceil(7800 / G), OFF = -3900, cost = new Float32Array(N * N).fill(NaN), used = new Uint8Array(N * N);
  const cell = (i, j) => { const k = j * N + i; let c = cost[k]; if (c !== c) { const x = OFF + (i + .5) * G, z = OFF + (j + .5) * G, h = H(x, z), s = S(x, z); c = 1 + s * s * 70 + (h < -.2 ? (h < -2.5 ? 90 : raw.river(x, z).chan > .05 ? 7 : 40) : 0) + (h > 45 ? (h - 45) * .06 : 0) + Math.hypot(x, z) / 3300 * (Math.hypot(x, z) > 3450 ? 60 : 0); cost[k] = c; } return used[k] ? c * .3 : c; };
  function astar(a, b) {
    const ai = Math.floor((a.x - OFF) / G), aj = Math.floor((a.z - OFF) / G), bi = Math.floor((b.x - OFF) / G), bj = Math.floor((b.z - OFF) / G);
    const g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N), heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    const s0 = aj * N + ai, goal = bj * N + bi; g[s0] = 0; push(s0, 0);
    while (heap.length) {
      const k = pop(); if (done[k]) continue; done[k] = 1; if (k === goal) break; const i = k % N, j = (k / N) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = nj * N + ni; if (done[nk]) continue;
        const step = (di && dj ? 1.414 : 1) * G, ng = g[k] + step * (cell(i, j) + cell(ni, nj)) * .5 / G; if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(nk, ng + Math.hypot(bi - ni, bj - nj) * .9); }
      }
    }
    const path = []; for (let k = goal; k >= 0; k = from[k]) { path.push([OFF + ((k % N) + .5) * G, OFF + (((k / N) | 0) + .5) * G]); used[k] = 1; if (k === s0) break; }
    path.reverse(); path[0] = [a.x, a.z]; path[path.length - 1] = [b.x, b.z]; return path;
  }
  const chaikin = p => { const o = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } o.push(p[p.length - 1]); return o; };
  const resample = (p, step) => { const o = [p[0]]; let acc = 0; for (let i = 1; i < p.length; i++) { let a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); while (acc + L >= step) { const t = (step - acc) / L; a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; o.push(a); L = Math.hypot(b[0] - a[0], b[1] - a[1]); acc = 0; } acc += L; } o.push(p[p.length - 1]); return o; };

  const nodes = settlements.filter(s => s.type <= 2), edges = new Set(), links = [];
  const link = (a, b, kind) => { const key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id); if (edges.has(key)) return; edges.add(key); links.push([a, b, kind]); };
  if (nodes.length) { const inT = new Set([nodes[0].id]); while (inT.size < nodes.length) { let best = null; for (const a of nodes) if (inT.has(a.id)) for (const b of nodes) if (!inT.has(b.id)) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (!best || d < best.d) best = { a, b, d }; } inT.add(best.b.id); link(best.a, best.b, best.a.type + best.b.type <= 2 ? 0 : 1); } }
  for (const a of nodes) { const near = nodes.filter(b => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)); for (let k = 0; k < 1 + (a.type === 0 ? 2 : 0) && k < near.length; k++) if (Math.hypot(near[k].x - a.x, near[k].z - a.z) < 1700) link(a, near[k], 1); }
  for (const f of settlements.filter(s => s.type === 3 || (s.type === 4 && hs(s.id, 0, 70) < .45))) { const near = nodes.slice().sort((p, q) => Math.hypot(p.x - f.x, p.z - f.z) - Math.hypot(q.x - f.x, q.z - f.z))[0]; if (near) link(f, near, 2); }
  links.sort((p, q) => p[2] - q[2]);                                                    // main roads first so spurs reuse them
  const roads = [];
  for (const [a, b, kind] of links) {
    let p = astar(a, b); if (p.length < 2) continue; p = resample(chaikin(chaikin(p)), 12);
    const hh = p.map(q => Math.max(H(q[0], q[1]), -.25)), prof = hh.map((_, i) => { let m = 0, n = 0; for (let k = -5; k <= 5; k++) { const v = hh[i + k]; if (v !== undefined) { m += v; n++; } } return m / n; });
    roads.push({ pts: p, h: prof, w: [6.5, 5, 3.4][kind], kind, a: a.id, b: b.id });
  }

  // ---------- spatial hashes ----------
  const RC = 48, PAD = 15, rh = new Map(), segs = [];
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) {
    const A = r.pts[i], B = r.pts[i + 1], sg = { ax: A[0], az: A[1], bx: B[0], bz: B[1], ha: r.h[i], hb: r.h[i + 1], w: r.w, dx: B[0] - A[0], dz: B[1] - A[1] }; sg.L2 = sg.dx * sg.dx + sg.dz * sg.dz || 1; segs.push(sg);
    for (let cz = Math.floor((Math.min(A[1], B[1]) - PAD) / RC); cz <= Math.floor((Math.max(A[1], B[1]) + PAD) / RC); cz++) for (let cx = Math.floor((Math.min(A[0], B[0]) - PAD) / RC); cx <= Math.floor((Math.max(A[0], B[0]) + PAD) / RC); cx++) { const k = (cx + 1024) * 4096 + cz + 1024; (rh.get(k) || rh.set(k, []).get(k)).push(sg); }
  }
  const NONE = { d: 1e9, h: 0, w: 0, dx: 1, dz: 0 };
  function roadAt(x, z) {                              // nearest road centre: { d, h, w, dx, dz }
    const l = rh.get((Math.floor(x / RC) + 1024) * 4096 + Math.floor(z / RC) + 1024); if (!l) return NONE; let best = NONE;
    for (const s of l) { let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - (s.ax + s.dx * t), z - (s.az + s.dz * t)) - s.w * .5; if (d < best.d) best = { d, h: s.ha + (s.hb - s.ha) * t, w: s.w, dx: s.dx, dz: s.dz }; }
    return best;
  }
  const SC = 128, sh = new Map();
  for (const s of settlements) { const R = s.r * 1.7; for (let cz = Math.floor((s.z - R) / SC); cz <= Math.floor((s.z + R) / SC); cz++) for (let cx = Math.floor((s.x - R) / SC); cx <= Math.floor((s.x + R) / SC); cx++) { const k = (cx + 1024) * 4096 + cz + 1024; (sh.get(k) || sh.set(k, []).get(k)).push(s); } }
  function settlementAt(x, z) {                        // nearest settlement whose influence covers the point: { s, d } (d normalised by radius)
    const l = sh.get((Math.floor(x / SC) + 1024) * 4096 + Math.floor(z / SC) + 1024); let best = null;
    if (l) for (const s of l) { const d = Math.hypot(x - s.x, z - s.z) / s.r; if (d < 1.7 && (!best || d < best.d)) best = { s, d }; } return best;
  }

  // ---------- building layouts ----------
  const chunks = new Map(), colliders = [];
  const put = (s, type, x, z, rot, sc = 1, hp = null) => {
    const h = H(x, z); if (h < 1 || S(x, z) > .5) return false; const it = { t: type, x, z, rot, sc, s: s.id, hp }; s.items.push(it);
    const k = Math.floor(x / 64) + ',' + Math.floor(z / 64); (chunks.get(k) || chunks.set(k, []).get(k)).push(it); return true;
  };
  const houseKeys = ['house1', 'house2', 'house3', 'house4'];
  for (const s of settlements) {
    const rd = roadAt(s.x, s.z); if (rd.d < 30) s.axis = Math.atan2(rd.dz, rd.dx);
    const A = [Math.cos(s.axis), Math.sin(s.axis)], P = [-A[1], A[0]], face = sgn => Math.atan2(-sgn * P[0], -sgn * P[1]) + FRONT_OFFSET;
    const at = (u, v) => [s.x + A[0] * u + P[0] * v, s.z + A[1] * u + P[1] * v], rnd = (a, b, c) => hs(s.id * 13 + a, b, c);
    s.style = s.type === 0 ? 'victorian' : s.type === 1 ? (rnd(1, 1, 90) < .6 ? 'western' : 'victorian') : s.type === 2 ? ['western', 'rustic', 'modern', 'western'][Math.floor(rnd(2, 3, 91) * 4)] : 'rustic';
    const pickSize = (q, i) => s.type === 0 ? (q < .15 ? 'small' : q < .45 ? 'medium' : q < .8 || i % 3 !== 1 ? 'large' : 'mansion') : s.type === 1 ? (q < .3 ? 'small' : q < .75 ? 'medium' : 'large') : (q < .55 ? 'small' : q < .9 ? 'medium' : 'large');
    const home = (u, sgn, i, row2) => {                                                                     // a procedural house with a real interior
      const q = rnd(i, sgn, row2 ? 61 : 60), size = row2 && SIZES[pickSize(q, i)][0] > 11 ? 'medium' : pickSize(q, i), [Wd, Dp] = SIZES[size], v = sgn * ((row2 ? 25 : 9.5) + Dp / 2), [x, z] = at(u + (rnd(i, sgn, 3) - .5) * 1.5, v);
      const sty = rnd(i, sgn, 64) < .2 ? STYLES[Math.floor(rnd(i, sgn, 65) * 4)] : s.style; put(s, 'home', x, z, face(sgn) + (rnd(i, sgn, 5) - .5) * .05, 1, { seed: 1 + Math.floor(rnd(i, sgn, row2 ? 63 : 62) * 1e6), style: sty, size }); return size;
    };
    if (s.type <= 2) {
      const L = [130, 85, 55][s.type], gap = [16, 16, 17][s.type];
      const [wx, wz] = at(0, 0); put(s, 'well', wx, wz, 0);
      for (const sgn of [-1, 1]) for (let u = -L, i = 0; u <= L; u += gap + rnd(i, sgn, 1) * 4, i++) {
        if (Math.abs(u) < 9 && !s.type) continue; if (Math.abs(u) < 7) continue;
        const v = sgn * (10 + rnd(i, sgn, 2) * 2.5), [x, z] = at(u + (rnd(i, sgn, 3) - .5) * 2, v), r = rnd(i, sgn, 4);
        const special = (sgn === 1 && Math.abs(u + gap * 1.2) < gap * .6) ? 'inn' : (sgn === -1 && Math.abs(u - gap * 1.4) < gap * .6) ? 'smith' : (s.type < 2 && sgn === 1 && u > L - gap * 1.2 && u < L) ? 'tower' : (sgn === -1 && u < -L + gap * 1.5 && s.type < 2) ? 'stable' : null;
        if (special === 'inn' || special === 'stable') { put(s, special, x, z, face(sgn), 1); continue; } if (special) { put(s, special, x, z, face(sgn), 1); continue; }
        const sz0 = home(u, sgn, i, false); if (sz0 === 'mansion') u += 8; void r; void x; void z;
        if (rnd(i, sgn, 15) < [.6, .5, .3][s.type]) home(u, sgn, i, true);      // second row behind
      }
      for (let k = 0; k < 2 + (2 - s.type) * 2; k++) { const [x, z] = at((k - 1.5) * 6, 5.5 * (k % 2 ? 1 : -1)); put(s, k % 3 === 0 ? 'stall1' : k % 3 === 1 ? 'stall2' : 'cart', x, z, face(k % 2 ? -1 : 1) + rnd(k, 0, 8) * .3); }
      if (s.type < 2) {                                                                         // cross street
        const l2 = [70, 45][s.type];
        for (const sgn of [-1, 1]) for (let u = 22, i = 0; u < l2; u += 15 + rnd(i, sgn, 11) * 4, i++) { const cx = s.x + P[0] * sgn * u, cz = s.z + P[1] * sgn * u; for (const side of [-1, 1]) { const px = cx + A[0] * side * (10 + rnd(i, side, 12) * 2), pz = cz + A[1] * side * (10 + rnd(i, side, 12) * 2); put(s, 'home', px, pz, Math.atan2(-side * A[0], -side * A[1]), 1, { seed: 1 + Math.floor(rnd(i + sgn * 9, side, 13) * 1e6), style: s.style, size: 'small' }); } }
      }
      if (s.type < 2) { const [x, z] = at(L * .3, 34 * (rnd(1, 1, 30) < .5 ? 1 : -1)); put(s, 'mill', x, z, hs(s.id, 2, 31) * 6.28); }
      for (let k = 0; k < 3 + (2 - s.type) * 2; k++) { const [x, z] = at((rnd(k, 5, 32) - .5) * L * 1.6, (rnd(k, 6, 32) < .5 ? -1 : 1) * 7.5); put(s, k % 2 ? 'barrel' : 'hay', x, z, rnd(k, 7, 33) * 6.28); }
    } else if (s.type === 3) {
      const kinds = ['barn', 'bigbarn', 'sbarn', 'openbarn'], main = kinds[Math.floor(rnd(1, 1, 40) * 4)];
      let [x, z] = at(0, 0); put(s, main, x, z, face(1)); [x, z] = at(-12, -8); put(s, 'silo', x, z, 0); [x, z] = at(11, -9); put(s, 'coop', x, z, face(1) + .3); [x, z] = at(-9, 12); put(s, 'home', x, z, face(-1), 1, { seed: 1 + Math.floor(rnd(2, 2, 41) * 1e6), style: 'rustic', size: 'small' });
      for (let k = -3; k <= 3; k++) { [x, z] = at(k * 5.9, 20); put(s, 'fence', x, z, Math.atan2(A[0], A[1]) + 1.5708); [x, z] = at(k * 5.9, -20); put(s, 'fence', x, z, Math.atan2(A[0], A[1]) + 1.5708); [x, z] = at(-18, k * 5.9); put(s, 'fence', x, z, Math.atan2(P[0], P[1]) + 1.5708); [x, z] = at(18, k * 5.9); put(s, 'fence', x, z, Math.atan2(P[0], P[1]) + 1.5708); }
    } else {
      let [x, z] = at(0, 0); put(s, 'fire', x, z, 0);
      for (let k = 0; k < 2 + Math.floor(rnd(1, 1, 50) * 3); k++) { const a = k * 2.1 + rnd(k, 2, 51), [tx, tz] = [s.x + Math.cos(a) * 5.5, s.z + Math.sin(a) * 5.5]; put(s, k % 2 ? 'tent' : 'tent2', tx, tz, Math.atan2(-Math.cos(a), -Math.sin(a)) + 0); }
      [x, z] = at(3, 4); put(s, 'crate', x, z, 0.4); [x, z] = at(-4, 3); put(s, 'barrel', x, z, 0);
    }
  }
  for (const s of settlements) for (const it of s.items) { const r = BLD[it.t][2]; if (r > 0) colliders.push(it); }
  const spawn = settlements[0] ? { x: settlements[0].x + Math.cos(settlements[0].axis + 1.57) * 22, z: settlements[0].z + Math.sin(settlements[0].axis + 1.57) * 22 } : { x: 0, z: 0 };
  return { settlements, roads, roadAt, settlementAt, buildingsForChunk: (cx, cz) => chunks.get(cx + ',' + cz) || [], spawn };
}
