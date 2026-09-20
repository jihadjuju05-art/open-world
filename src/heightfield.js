// Pure-maths world generator shared by the main thread (collision, spawning) and the chunk worker (meshing).
// No THREE dependency so it can run inside a Web Worker.
import { makeNoise, fbm, hash2, smoothstep } from './noise.js';
import { buildPlan, BLD_NAMES, WORLD_R } from './settlements.js';
import { SIZES, STYLES } from './housedata.js';

export const WATER_LEVEL = 0;
export const CHUNK = 64;
const mix = (a, b, t) => a + (b - a) * t;

export function createHeightField(seed = 20240519) {
  const nCont = makeNoise(seed), nHill = makeNoise(seed + 1), nRidge = makeNoise(seed + 2), nMask = makeNoise(seed + 3),
    nColor = makeNoise(seed + 4), nForest = makeNoise(seed + 5), nRiver = makeNoise(seed + 6), nW1 = makeNoise(seed + 7), nW2 = makeNoise(seed + 8), nType = makeNoise(seed + 9);

  // Designed geography: three mountain ranges, a lone peak, a lake basin and a mountain rim that closes the world.
  const RANGES = [{ p: [[-4200, -2900], [-2000, -3300], [0, -2800], [2200, -3300], [4200, -2700]], w: 520 }, { p: [[-3300, -3500], [-3600, -800], [-3200, 1500], [-3700, 3500]], w: 420 }, { p: [[3700, -1500], [3300, 300], [3800, 2000]], w: 360 }];
  const segDist = (px, pz, pts) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az; let t = ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t; best = Math.min(best, Math.hypot(px - ax - dx * t, pz - az - dz * t)); } return best; };
  function baseHeight(x, z) {
    const wx = x + fbm(nMask, x * .0015 + 3, z * .0015, 2) * 260, wz = z + fbm(nMask, x * .0015, z * .0015 + 9, 2) * 260;
    let m = 0; for (const r of RANGES) m = Math.max(m, 1 - smoothstep(r.w * .15, r.w * 1.6, segDist(wx, wz, r.p)));
    m = Math.max(m, 1 - smoothstep(60, 520, Math.hypot(wx - 700, wz - 900)), smoothstep(3700, 4500, Math.hypot(x, z)));
    const cont = fbm(nCont, x * .0007, z * .0007, 3), hills = fbm(nHill, x * .0045, z * .0045, 4), ridge = 1 - Math.abs(fbm(nRidge, x * .004, z * .004, 4));
    const lake = 1 - smoothstep(250, 700, Math.hypot(x - 1500, z - 1900));
    return 9 + cont * 7 + hills * 4.5 + m * m * (30 + 145 * ridge * ridge) - lake * lake * 28;
  }
  // Rivers are the zero-crossings of a domain-warped noise field, so they meander and never end abruptly.
  function riverNoise(x, z) {
    const wx = x + fbm(nW1, x * .0025, z * .0025, 2) * 120, wz = z + fbm(nW2, x * .0025 + 7, z * .0025 + 3, 2) * 120;
    return fbm(nRiver, wx * .00105, wz * .00105, 3);
  }
  // Rivers sit in a wide, gentle floodplain (VALLEY_W) with a narrower channel (RIVER_W) cut slightly below the water level.
  const RIVER_W = .024, VALLEY_W = .14, BED = WATER_LEVEL - 1.8;
  function riverParts(x, z, baseH) {
    const rn = Math.abs(riverNoise(x, z)), m = 1 - smoothstep(12, 30, baseH);   // rivers only run through the lowlands
    return { chan: (1 - smoothstep(0, RIVER_W * 2.3, rn)) * m, val: (1 - smoothstep(0, VALLEY_W, rn)) * m };
  }
  function rawHeight(x, z) {
    const b = baseHeight(x, z), p = riverParts(x, z, b);
    const v = p.val * p.val * (3 - 2 * p.val), floor = WATER_LEVEL + .6 + (b - WATER_LEVEL) * .12;
    let hgt = mix(b, Math.min(b, floor), v);                                   // flatten the valley floor around the river
    const s = p.chan * p.chan * (3 - 2 * p.chan);
    return mix(hgt, Math.min(hgt, BED), s);                                    // cut the channel
  }
  // Settlements flatten the ground, roads follow a smoothed profile (rivers become shallow fords where a road crosses).
  let _plan = null; const plan = () => _plan || (_plan = buildPlan(seed, { h: rawHeight, slope: (x, z) => { const e = 3; return Math.hypot(rawHeight(x + e, z) - rawHeight(x - e, z), rawHeight(x, z + e) - rawHeight(x, z - e)) / (2 * e); }, river: (x, z) => riverParts(x, z, baseHeight(x, z)) }));
  function height(x, z) {
    let h = rawHeight(x, z); const P = plan(), st = P.settlementAt(x, z);
    let tw = 0; if (st) { tw = 1 - smoothstep(.8, 1.45, st.d); if (tw > 0) h += (st.s.h - h) * tw; }
    const rd = P.roadAt(x, z); if (rd.d < 14) { const w = (1 - smoothstep(3, 14, rd.d)) * (1 - tw); h += (Math.max(rd.h, -.3) - h) * w * w * (3 - 2 * w); }      // inside a town the ground stays flat
    return h;
  }
  function river(x, z) {                         // { t: 0..1 channel amount, fx, fz: flow direction }
    const b = baseHeight(x, z), t = riverParts(x, z, b).chan, e = 4;
    let gx = riverNoise(x + e, z) - riverNoise(x - e, z), gz = riverNoise(x, z + e) - riverNoise(x, z - e);
    const L = Math.hypot(gx, gz) || 1; return { t, fx: -gz / L, fz: gx / L };
  }
  function slope(x, z) { const e = 1.5; return Math.hypot(height(x + e, z) - height(x - e, z), height(x, z + e) - height(x, z - e)) / (2 * e); }

  // Ground colour written into out[o..o+2] (linear RGB).
  function color(h, slp, x, z, riverT, out, o) {
    const P = plan(), rd = P.roadAt(x, z), st = P.settlementAt(x, z);
    const roadW = rd.d < 8 ? 1 - smoothstep(.5, 5.5 + rd.w * .2, rd.d) : 0, townW = st ? (1 - smoothstep(.35, .95, st.d)) * (st.s.type > 2 ? .55 : .8) * (.6 + .4 * hash2(x * .5, z * .5, 3)) : 0, packed = Math.max(roadW, townW);
    const v = fbm(nColor, x * .04, z * .04, 2) * .5 + .5, r = hash2(x * 10, z * 10) * .06;
    let R, G, B;
    if (h < 1.7) { const wet = smoothstep(.9, -.4, h); R = mix(.55 + v * .08, .27, wet); G = mix(.5 + v * .06, .22, wet); B = mix(.3, .14, wet); }
    else {
      R = .13 + v * .08 + r; G = .3 + v * .12 + r; B = .07 + v * .04;
      const dry = smoothstep(.55, .85, fbm(nColor, x * .006 + 30, z * .006, 2) * .5 + .5) * .55; R = mix(R, .34, dry); G = mix(G, .3, dry); B = mix(B, .12, dry);
      const path = smoothstep(.06, 0, Math.abs(fbm(nType, x * .004, z * .004, 2))) * (1 - smoothstep(.3, .6, slp)) * .8;  // dusty trails
      R = mix(R, .42, path); G = mix(G, .33, path); B = mix(B, .2, path);
    }
    const rock = Math.max(smoothstep(.55, .95, slp), smoothstep(48, 85, h));
    if (rock > 0) { R = mix(R, .3 + v * .08, rock); G = mix(G, .28 + v * .07, rock); B = mix(B, .26 + v * .06, rock); }
    const snow = smoothstep(95, 118, h + v * 8) * (1 - smoothstep(.9, 1.3, slp));
    if (snow > 0) { R = mix(R, .92, snow); G = mix(G, .94, snow); B = mix(B, .98, snow); }
    if (packed > 0 && h > .3) { const k = .1 * hash2(x * 2, z * 2, 7); R = mix(R, .40 + k, packed * .85); G = mix(G, .31 + k, packed * .85); B = mix(B, .2 + k * .6, packed * .85); }
    out[o] = R; out[o + 1] = G; out[o + 2] = B;
    // texture splat weights for the PBR terrain shader: [grass, rock, dirt/path, sand]
    let wSand = smoothstep(2.4, 1.1, h), wRock = rock, wDirt = h < 1.7 ? 0 : Math.max(0, mix(0, .9, smoothstep(.06, 0, Math.abs(fbm(nType, x * .004, z * .004, 2)))) * (1 - smoothstep(.3, .6, slp)) + smoothstep(.62, .9, fbm(nColor, x * .006 + 30, z * .006, 2) * .5 + .5) * .35);
    if (packed > 0 && h > .3) { wDirt = Math.max(wDirt, packed); wRock = Math.min(wRock, 1 - packed * .8); wSand *= 1 - packed; }
    wRock = Math.min(1, wRock); const rest = Math.max(0, 1 - wSand - wRock - wDirt); let sum = rest + wSand + wRock + wDirt || 1;
    out[o + 3] = rest / sum; out[o + 4] = wRock / sum; out[o + 5] = wDirt / sum; out[o + 6] = wSand / sum;
  }

  // Vegetation for one chunk (positions are chunk-local). kind: 0 pine, 1 broadleaf.
  function vegetation(cx, cz, wantGrass) {
    const ox = cx * CHUNK, oz = cz * CHUNK, CELL = 5.5, n = Math.floor(CHUNK / CELL), trees = [], rocks = [], grass = [], P = plan();
    const noTree = (x, z) => { const st = P.settlementAt(x, z); return (st && st.d < 1.08) || P.roadAt(x, z).d < 6; };
    const noGround = (x, z) => { const st = P.settlementAt(x, z); return (st && st.d < .75) || P.roadAt(x, z).d < 3.2; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const gi = cx * n + i, gj = cz * n + j, lx = (i + hash2(gi, gj, 1)) * CELL, lz = (j + hash2(gi, gj, 2)) * CELL, x = ox + lx, z = oz + lz;
      const h = height(x, z); if (h < 2 || noTree(x, z)) continue;
      const rv = river(x, z); if (rv.t > .02) continue;
      const slp = slope(x, z), forest = fbm(nForest, x * .012, z * .012, 3), typ = fbm(nType, x * .006, z * .006, 2);
      const dens = smoothstep(-.05, .3, forest) * .95 + .04, alt = 1 - smoothstep(55, 80, h);
      if (slp < .42 && hash2(gi, gj, 3) < dens * alt) trees.push(lx, lz, h, .8 + hash2(gi, gj, 4) * .9, hash2(gi, gj, 5) * 6.28, hash2(gi, gj, 6), typ > .05 && h < 40 ? 1 : 0);
      else if (slp > .36 && hash2(gi, gj, 7) < .11) rocks.push(lx, lz, h, .6 + hash2(gi, gj, 8) * 1.8, hash2(gi, gj, 9) * 6.28);
    }
    const plants = [], PC = 3.6, np = Math.floor(CHUNK / PC);
    for (let j = 0; j < np; j++) for (let i = 0; i < np; i++) {
      const gi = cx * np + i, gj = cz * np + j, lx = (i + hash2(gi, gj, 31)) * PC, lz = (j + hash2(gi, gj, 32)) * PC, x = ox + lx, z = oz + lz, h = height(x, z);
      if (h < 2.2 || h > 55 || noGround(x, z)) continue; if (river(x, z).t > .02 || slope(x, z) > .45) continue;
      const forest = smoothstep(-.05, .3, fbm(nForest, x * .012, z * .012, 3)), r = hash2(gi, gj, 33), s = .8 + hash2(gi, gj, 34) * .7;
      if (forest > .5) { if (r < .22) plants.push(lx, lz, h, s, 1); else if (r < .3) plants.push(lx, lz, h, s * .9, 0); else if (r < .34) plants.push(lx, lz, h, s, 4); }
      else { if (r < .14) plants.push(lx, lz, h, s, 2 + (hash2(gi, gj, 35) < .5 ? 0 : 1)); else if (r < .2) plants.push(lx, lz, h, s, 0); else if (r < .3) plants.push(lx, lz, h, s, 5); }
    }
    if (wantGrass) {
      const N = 54;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const gi = cx * N + i, gj = cz * N + j, lx = (i + hash2(gi, gj, 21)) * (CHUNK / N), lz = (j + hash2(gi, gj, 22)) * (CHUNK / N);
        if (hash2(gi, gj, 23) > .8) continue;
        const x = ox + lx, z = oz + lz, h = height(x, z); if (h < 1.9 || h > 60 || noGround(x, z)) continue;
        const slp = slope(x, z); if (slp > .5) continue;
        const dry = smoothstep(.55, .85, fbm(nColor, x * .006 + 30, z * .006, 2) * .5 + .5);
        grass.push(lx, lz, h, .6 + hash2(gi, gj, 24) * .7, dry * .8 + hash2(gi, gj, 25) * .2);
      }
    }
    const bld = []; for (const it of P.buildingsForChunk(cx, cz)) bld.push(BLD_NAMES.indexOf(it.t), it.x - ox, it.z - oz, height(it.x, it.z) - .05, it.rot, it.sc, it.hp ? it.hp.seed : 0, it.hp ? STYLES.indexOf(it.hp.style) * 10 + Object.keys(SIZES).indexOf(it.hp.size) : -1);
    return { trees, rocks, grass, plants, bld };
  }
  // Forest density 0..1 (for the world map)
  function forest(x, z) { const f = fbm(nForest, x * .012, z * .012, 3), b = baseHeight(x, z); return (smoothstep(-.05, .3, f) * .95 + .04) * (1 - smoothstep(55, 80, b)); }
  return { height, baseHeight, river, slope, color, vegetation, forest, plan };
}

// Triangle indices for an (res+1)^2 grid plus 4 skirt strips (vertices appended after the grid: bottom, top, left, right).
export function gridIndices(res, skirts = true) {
  const W = res + 1, idx = [];
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const a = j * W + i, b = a + 1, d = a + W, e = d + 1; idx.push(a, d, b, b, d, e); }
  if (!skirts) return new Uint32Array(idx);
  const base = W * W;                                  // skirt vertex k of edge s = base + s*W + k
  const edge = [k => k, k => res * W + k, k => k * W, k => k * W + res];
  for (let s = 0; s < 4; s++) for (let k = 0; k < res; k++) {
    const a = edge[s](k), b = edge[s](k + 1), sa = base + s * W + k, sb = base + s * W + k + 1;
    idx.push(a, b, sa, b, sb, sa, a, sa, b, b, sa, sb);   // both windings so the skirt is visible from either side
  }
  return new Uint32Array(idx);
}
