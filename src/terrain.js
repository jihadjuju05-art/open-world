// Chunked open-world terrain. All heavy generation happens in a Web Worker; the main thread only uploads buffers.
// Realism: PBR ground textures blended by slope/height, real tree/plant/rock models (3 LOD tiers), wind, shore water.
// Performance: LOD rings for the ground mesh, skirts against cracks, instancing per model, frustum culling, shadows only nearby.
import * as THREE from 'three';
import { BLD, BLD_NAMES } from './settlements.js';
import { getShell, STYLES, SIZES, FLOOR2_Y } from './housegen.js';
import { FLOOR_Y, TOWN } from './housedata.js';
const SIZE_KEYS = Object.keys(SIZES);
import { createHeightField, gridIndices, CHUNK, WATER_LEVEL } from './heightfield.js';
import { createShoreWaterMaterial, updateShoreWater, mergeWater } from './water.js';
import { windTime } from './wind.js';
import { TREE_SETS, PLANT_SETS, GRASS_SET, ROCK_SET, makeTerrainMaterial, loadGroundTextures } from './vegetation.js';
export { WATER_LEVEL, windTime };

// Wind sway for the low-poly far proxies (vertex-coloured).
function patchWind(mat, sway, tint = 0) {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = vec2(0.0);
        #endif
        float hgt = max(position.y, 0.0);
        float ph = uTime * 1.5 + ip.x * 0.21 + ip.y * 0.17;
        float amt = hgt * hgt * ${sway.toFixed(4)};
        transformed.x += sin(ph) * amt + sin(ph * 2.3 + 1.7) * amt * 0.35;
        transformed.z += cos(ph * 0.9) * amt * 0.6;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        #if defined(USE_COLOR) && defined(USE_INSTANCING)
          float tv = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
          vColor.rgb *= ${(1 - tint).toFixed(3)} + tv * ${(tint * 2).toFixed(3)};
        #endif`);
  };
  return mat;
}
function merge(parts) {
  const P = [], N = [], C = [];
  for (const { geo, rgb, pos = [0, 0, 0], scale = [1, 1, 1] } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i) * scale[0] + pos[0], p.getY(i) * scale[1] + pos[1], p.getZ(i) * scale[2] + pos[2]); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(...rgb); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return out;
}
const fract = v => v - Math.floor(v);

export class Terrain {
  constructor(scene, seed = 20240519, veg = null) {
    this.scene = scene; this.seed = seed; this.hf = createHeightField(seed); this.veg = veg;
    this.homeCol = new Map(); this.houses = null; this.chunks = new Map(); this.pending = new Map(); this.inflight = 0; this.maxInflight = 3; this.radius = 7; this.stats = { built: 0 };
    this.q = { shadowsOn: true, shadowRing: 1.45, grass: true, grassDensity: 1, grassRing: 1.6 }; this.version = 0; this._near = null; this._dirty = true; this._lt = 0;
    this.terrainMat = makeTerrainMaterial(loadGroundTextures());
    this.waterMat = createShoreWaterMaterial(); this.waterParams = mergeWater();
    this.idxCache = new Map(); this.waterIdx = new Map();
    // low-poly far proxies (used beyond the textured-model rings)
    const cyl = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 6), ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
    const bark = [.2, .13, .08], pineG = [.07, .24, .09], pineL = [.09, .3, .11], oakG = [.16, .34, .07], oakL = [.22, .42, .09];
    this.pineLow = merge([{ geo: cyl(.2, .3, 2.6), rgb: bark, pos: [0, 1.3, 0] }, { geo: new THREE.ConeGeometry(2.0, 4.2, 5), rgb: pineG, pos: [0, 4.2, 0] }, { geo: new THREE.ConeGeometry(1.3, 3.4, 5), rgb: pineL, pos: [0, 6.4, 0] }]);
    this.oakLow = merge([{ geo: cyl(.25, .38, 3.0), rgb: bark, pos: [0, 1.5, 0] }, { geo: ico(2.2, 0), rgb: oakG, pos: [0, 4.6, 0], scale: [1.1, .9, 1.1] }, { geo: ico(1.5, 0), rgb: oakL, pos: [1.1, 4.4, .4] }]);
    this.pineMat = patchWind(new THREE.MeshLambertMaterial({ vertexColors: true }), .0085, .22);
    this.oakMat = patchWind(new THREE.MeshLambertMaterial({ vertexColors: true }), .0075, .25);
    // fallback grass blades if the grass models are not available
    const blade = a => { const g = new THREE.BufferGeometry(), c = Math.cos(a), s = Math.sin(a), w = .045; g.setAttribute('position', new THREE.Float32BufferAttribute([-w * c, 0, -w * s, w * c, 0, w * s, 0, .45, 0, w * c, 0, w * s, -w * c, 0, -w * s, 0, .45, 0], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(6).fill([0, 1, 0]).flat(), 3)); return g; };
    this.grassGeo = merge([0, 1, 2].map(i => ({ geo: blade(i * 1.05 + .2), rgb: [1, 1, 1] })));
    { const col = this.grassGeo.attributes.color, pos = this.grassGeo.attributes.position; for (let i = 0; i < pos.count; i++) { const t = Math.min(1, pos.getY(i) / .45); col.setXYZ(i, .05 + t * .26, .16 + t * .34, .03 + t * .1); } }
    this.grassMat = patchWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 1.4, .2);
    this.rockGeo = new THREE.IcosahedronGeometry(1, 0); this.rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8580, flatShading: true });
    this.worker = new Worker(new URL('./terrain_worker.js', import.meta.url), { type: 'module' });
    this.worker.postMessage({ type: 'init', seed });
    this.worker.onmessage = e => this.onChunk(e.data);
    this.worker.onerror = e => console.error('terrain worker', e.message);
  }

  height(x, z) { return this.hf.height(x, z); }
  slopeAt(x, z) { return this.hf.slope(x, z); }
  riverAt(x, z) { return this.hf.river(x, z); }

  // ----- streaming -----
  lodFor(d, cur) {
    let r = d <= 2.2 ? 64 : d <= 4.2 ? 32 : 16;
    if (cur === 64 && d <= 2.9) r = 64; else if (cur === 32 && d > 1.5 && d <= 4.9) r = 32; else if (cur === 16 && d > 3.5) r = 16;
    return r;
  }
  tierFor(d, cur) {                                       // 0: full models, 1: reduced models, 2: low-poly proxies
    let t = d <= 1.3 ? 0 : d <= 3.2 ? 1 : 2;
    if (cur === 0 && d <= 1.7) t = 0; else if (cur === 1 && d > 1.0 && d <= 3.7) t = 1;
    return t;
  }
  setQuality(s) {
    const q = this.q, prevDens = q.grassDensity;
    this.radius = s.viewRadius; q.shadowsOn = s.shadows > 0; q.shadowRing = s.shadowRing; q.grass = s.grass && s.grassDensity > 0; q.grassDensity = s.grassDensity; q.grassRing = s.grassRing;
    if (!q.grass || prevDens !== q.grassDensity) for (const c of this.chunks.values()) this.dropGrass(c);
    this._dirty = true;
  }
  update(px, pz, budget) {
    this._px = px; this._pz = pz;
    const cx0 = Math.floor(px / CHUNK), cz0 = Math.floor(pz / CHUNK), now = performance.now();
    if (cx0 === this._lcx && cz0 === this._lcz && !this._dirty && now - this._lt < 120) return this.inflight;
    this._lt = now; this._lcx = cx0; this._lcz = cz0; this._dirty = false;
    const ccx = cx0, ccz = cz0, R = this.radius, need = []; let rebuilds = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dz); if (d > R + .5) continue;
      const cx = ccx + dx, cz = ccz + dz, key = cx + ',' + cz, c = this.chunks.get(key), res = this.lodFor(d, c?.res);
      if (!c) { if (!this.pending.has(key)) need.push({ cx, cz, key, res, d, kind: 'terrain' }); }
      else {
        c.d2 = d;
        if (c.res !== res && !this.pending.has(key)) need.push({ cx, cz, key, res, d: d + 5, kind: 'terrain' });
        const wantGrass = this.q.grass && (c.grass ? d <= this.q.grassRing + .8 : d <= this.q.grassRing);
        if (wantGrass && !c.grass && !c.grassPending && c.res === 64) need.push({ cx, cz, key, res, d, kind: 'grass' });
        if (!wantGrass && c.grass) this.dropGrass(c);
        const tier = this.tierFor(d, c.tier), plantsOn = d <= (c.plantsOn ? 2.1 : 1.7);
        if ((tier !== c.tier || plantsOn !== c.plantsOn) && rebuilds < 4) { c.tier = tier; c.plantsOn = plantsOn; this.buildVeg(c); rebuilds++; }
        const sh = this.q.shadowsOn && d <= this.q.shadowRing; if (sh !== c.shadow) this.setShadow(c, sh);
      }
    }
    for (const [key, c] of this.chunks) if (Math.hypot(c.cx - ccx, c.cz - ccz) > R + 1.6) this.unload(key);
    need.sort((a, b) => a.d - b.d);
    const max = budget ?? this.maxInflight; if (need.length || rebuilds) this._dirty = true;
    for (const n of need) {
      if (this.inflight >= max) break;
      if (n.kind === 'terrain') { this.pending.set(n.key, n.res); this.inflight++; this.worker.postMessage({ id: n.key, cx: n.cx, cz: n.cz, res: n.res, grass: false, kind: 'terrain' }); }
      else { const c = this.chunks.get(n.key); c.grassPending = true; this.inflight++; this.worker.postMessage({ id: n.key, cx: n.cx, cz: n.cz, res: 64, grass: true, kind: 'grass' }); }
    }
    return need.length + this.inflight;
  }
  setShadow(c, on) { c.shadow = on; for (const m of c.casters) m.castShadow = on; c.terrain.receiveShadow = on || c.d2 < 3; }
  dropGrass(c) { if (!c.grass) return; c.group.remove(c.grass); for (const m of c.grassMeshes) m.dispose(); c.grass = null; c.grassMeshes = []; }
  disposeVeg(c) { if (c.vegGroup) { c.group.remove(c.vegGroup); for (const m of c.vegMeshes) m.dispose(); } c.vegGroup = null; c.vegMeshes = []; c.casters = []; }
  unload(key) {
    const c = this.chunks.get(key); if (!c) return; this.scene.remove(c.group); this.disposeVeg(c); this.dropGrass(c); for (const hk of c.homeSet || []) { const [hx, hz] = hk.split(',').map(Number); this.houses?.remove(hx, hz); this.homeCol.delete(hk); }
    c.terrain.geometry.dispose(); if (c.water) c.water.geometry.dispose();
    this.chunks.delete(key); this.version++;
  }
  index(res) { let a = this.idxCache.get(res); if (!a) { a = new THREE.BufferAttribute(gridIndices(res), 1); this.idxCache.set(res, a); } return a; }
  wIndex(res) { let a = this.waterIdx.get(res); if (!a) { a = new THREE.BufferAttribute(gridIndices(res, false), 1); this.waterIdx.set(res, a); } return a; }

  onChunk(m) {
    this.inflight = Math.max(0, this.inflight - 1);
    const key = m.id, old = this.chunks.get(key);
    if (m.terrain === undefined) { if (!old) return; old.grassPending = false; if (old.grass || old.res !== 64) return; this.attachGrass(old, m.grass); return; }
    this.pending.delete(key);
    const d = Math.hypot(m.cx - Math.floor((this._px ?? 0) / CHUNK), m.cz - Math.floor((this._pz ?? 0) / CHUNK));
    if (d > this.radius + 1.6) return;
    if (old) this.unload(key);
    const T = m.terrain, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(T.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(T.nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(T.col, 3)); geo.setAttribute('splat', new THREE.BufferAttribute(T.spl, 4));
    geo.setIndex(this.index(m.res)); geo.computeBoundingSphere();
    const terrain = new THREE.Mesh(geo, this.terrainMat); terrain.receiveShadow = d < 3;
    const group = new THREE.Group(); group.position.set(m.cx * CHUNK, 0, m.cz * CHUNK); group.add(terrain);
    const ox = m.cx * CHUNK, oz = m.cz * CHUNK, trees = [], rocks = [];
    for (let i = 0; i < m.trees.length; i += 7) trees.push({ x: ox + m.trees[i], z: oz + m.trees[i + 1], h: m.trees[i + 2], s: m.trees[i + 3] });
    for (let i = 0; i < m.rocks.length; i += 5) rocks.push({ x: ox + m.rocks[i], z: oz + m.rocks[i + 1], r: m.rocks[i + 3] * 1.15 });
    const homes = []; for (let i = 0; i < m.bld.length; i += 8) {                                     // buildings collide as oriented boxes fitted to the model bounds
      if (BLD_NAMES[m.bld[i]] === 'home') {                                          // procedural house: one box per wall piece + a blocker per door
        const sh = getShell(m.bld[i + 6], STYLES[Math.floor(m.bld[i + 7] / 10)], SIZE_KEYS[m.bld[i + 7] % 10]), th = m.bld[i + 4], c0 = Math.cos(th), s0 = Math.sin(th), bx = ox + m.bld[i + 1], bz = oz + m.bld[i + 2], info = { doorCols: {} };
        const hy = m.bld[i + 3]; homes.push({ x: bx, z: bz, c: c0, s: s0, y: hy, plan: sh.plan, town: sh.town });
        for (const w of sh.colliders) rocks.push({ x: bx + (w.x * c0 + w.z * s0), z: bz + (-w.x * s0 + w.z * c0), r: 0, obb: { hx: w.hx, hz: w.hz, c: c0, s: s0, h: 3, y0: hy + w.y0, y1: hy + w.y1 } });
        for (const d of sh.doors) { const lx = d.ax === 'z' ? (d.u0 + d.u1) / 2 : d.c, lz = d.ax === 'z' ? d.c : (d.u0 + d.u1) / 2, e = { x: bx + (lx * c0 + lz * s0), z: bz + (-lx * s0 + lz * c0), r: 0, open: false, obb: { hx: d.ax === 'z' ? (d.u1 - d.u0) / 2 : .07, hz: d.ax === 'z' ? .07 : (d.u1 - d.u0) / 2, c: c0, s: s0, h: 2.3, y0: hy + d.y0, y1: hy + d.y1 } }; rocks.push(e); info.doorCols[d.id] = e; }
        if (sh.town) for (const d of sh.town.doors) { const e = { x: bx + (d.cx * c0 + d.cz * s0), z: bz + (-d.cx * s0 + d.cz * c0), r: 0, open: false, obb: { hx: d.hx, hz: d.hz, c: c0, s: s0, h: 2, y0: hy + d.y0, y1: hy + d.y1 } }; rocks.push(e); info.doorCols[100 + d.id] = e; }
        this.homeCol.set(Math.round(bx) + ',' + Math.round(bz), info); continue;
      }
      const [proto, target, cr] = BLD[BLD_NAMES[m.bld[i]]]; if (cr <= 0) continue;
      const pr = this.veg?.get(proto), th = m.bld[i + 4], bx = ox + m.bld[i + 1], bz = oz + m.bld[i + 2];
      if (pr) { const sz = pr.box.getSize(new THREE.Vector3()), ct = pr.box.getCenter(new THREE.Vector3()), k = target / Math.max(.01, Math.max(sz.x, sz.z)) * m.bld[i + 5], c0 = Math.cos(th), s0 = Math.sin(th);
        rocks.push({ x: bx + (ct.x * c0 + ct.z * s0) * k, z: bz + (-ct.x * s0 + ct.z * c0) * k, r: 0, obb: { hx: sz.x * k * .46, hz: sz.z * k * .46, c: c0, s: s0, h: sz.y * k } }); }
      else rocks.push({ x: bx, z: bz, r: cr, building: true });
    }
    const c = { cx: m.cx, cz: m.cz, res: m.res, group, terrain, grass: null, grassMeshes: [], shadow: false, d2: d, water: null, trees, rocks, homes, data: { trees: m.trees, rocks: m.rocks, plants: m.plants, bld: m.bld },
      vegGroup: null, vegMeshes: [], casters: [], tier: this.tierFor(d, -1), plantsOn: d <= 1.7 };
    if (m.water) {
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(m.water.pos, 3)); wg.setAttribute('aDepth', new THREE.BufferAttribute(m.water.depth, 1)); wg.setAttribute('aFlow', new THREE.BufferAttribute(m.water.flow, 3));
      wg.setIndex(this.wIndex(m.res)); wg.boundingSphere = new THREE.Sphere(new THREE.Vector3(CHUNK / 2, 0, CHUNK / 2), CHUNK * .8);
      const wm = new THREE.Mesh(wg, this.waterMat); wm.renderOrder = 5; c.water = wm; group.add(wm);
    }
    this.chunks.set(key, c); this.buildVeg(c); if (d <= this.q.shadowRing && this.q.shadowsOn) this.setShadow(c, true);
    this.scene.add(group); this.stats.built++; this.version++;
  }

  // ----- vegetation instancing -----
  addInstances(c, g, proto, mats, { cast = true } = {}) {
    if (!mats.length) return;
    for (const part of proto.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, mats.length);
      mats.forEach((m, k) => { im.setMatrixAt(k, m.matrix); if (m.color) im.setColorAt(k, m.color); });
      im.computeBoundingSphere(); im.receiveShadow = true; g.add(im); c.vegMeshes.push(im); if (cast) c.casters.push(im);
    }
  }
  buildVeg(c) {
    this.disposeVeg(c); const g = new THREE.Group(); c.vegGroup = g; c.group.add(g);
    const veg = this.veg && this.veg.ready ? this.veg : null, D = c.data, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    // --- trees
    const T7 = D.trees, groups = new Map(), proxyPine = [], proxyOak = [];
    for (let i = 0; i < T7.length; i += 7) {
      const v = T7[i + 5], kind = T7[i + 6] | 0, sc = T7[i + 3];
      q.setFromAxisAngle(up, T7[i + 4]); p.set(T7[i], T7[i + 2] - .1, T7[i + 1]);
      if (c.tier >= 2 || !veg) { s.setScalar(sc); mtx.compose(p, q, s); (kind === 0 ? proxyPine : proxyOak).push(mtx.clone()); continue; }
      const set = v < .035 ? 'dead' : kind === 0 ? 'pine' : 'broad', names = TREE_SETS[set], name = names[Math.floor(fract(v * 137.13) * (c.tier === 0 ? names.length : Math.min(2, names.length))) % names.length];
      const pr = veg.get(c.tier === 0 ? name : name + '_lod1') || veg.get(name); if (!pr) continue;
      s.setScalar(sc * 1.15); mtx.compose(p, q, s); col.setRGB(.86 + fract(v * 91.7) * .28, .88 + fract(v * 53.1) * .24, .86 + fract(v * 17.3) * .22);
      if (!groups.has(pr.name)) groups.set(pr.name, { pr, list: [] }); groups.get(pr.name).list.push({ matrix: mtx.clone(), color: col.clone() });
    }
    for (const { pr, list } of groups.values()) this.addInstances(c, g, pr, list);
    for (const [arr, geo, mat] of [[proxyPine, this.pineLow, this.pineMat], [proxyOak, this.oakLow, this.oakMat]]) {
      if (!arr.length) continue; const im = new THREE.InstancedMesh(geo, mat, arr.length); arr.forEach((m, k) => im.setMatrixAt(k, m)); im.computeBoundingSphere(); im.receiveShadow = true; g.add(im); c.vegMeshes.push(im); c.casters.push(im);
    }
    // --- buildings (villages, farms, camps)
    const B8 = D.bld, proxies = []; c.homeSet ??= new Set();
    if (veg && B8.length) {
      const bg = new Map();
      for (let i = 0; i < B8.length; i += 8) {
        const key = BLD_NAMES[B8[i]];
        if (key === 'home') {                                                       // procedural houses: full shell up close, cheap proxy far away
          const bx = c.cx * CHUNK + B8[i + 1], bz = c.cz * CHUNK + B8[i + 2], hk = Math.round(bx) + ',' + Math.round(bz);
          if (c.tier <= 1 && this.houses) { if (!c.homeSet.has(hk)) { this.houses.create(bx, bz, B8[i + 3], B8[i + 4], B8[i + 6], STYLES[Math.floor(B8[i + 7] / 10)], SIZE_KEYS[B8[i + 7] % 10], this.homeCol.get(hk)); c.homeSet.add(hk); } }
          else { if (c.homeSet.has(hk)) { this.houses?.remove(bx, bz); c.homeSet.delete(hk); } proxies.push(i); }
          continue;
        }
        const [proto, target] = BLD[key], pr = veg.get(proto); if (!pr) continue;
        const size = pr.box.getSize(new THREE.Vector3()), k = target / Math.max(.01, Math.max(size.x, size.z)) * B8[i + 5];
        q.setFromAxisAngle(up, B8[i + 4]); s.setScalar(k); p.set(B8[i + 1], B8[i + 3] - pr.box.min.y * k - .1, B8[i + 2]); mtx.compose(p, q, s);
        const v = fract(B8[i + 1] * 12.9 + B8[i + 2] * 7.7); col.setRGB(.88 + v * .2, .88 + fract(v * 7) * .2, .88 + fract(v * 13) * .2);
        if (!bg.has(key)) bg.set(key, { pr, list: [] }); bg.get(key).list.push({ matrix: mtx.clone(), color: col.clone() });
      }
      for (const { pr, list } of bg.values()) this.addInstances(c, g, pr, list);
    }
    if (proxies.length) {
      const geo = this.homeProxyGeo ??= merge([{ geo: new THREE.BoxGeometry(1, 2.9, 1), rgb: [.72, .64, .5], pos: [0, 1.45, 0] }, { geo: new THREE.CylinderGeometry(0, .92, 1.7, 4, 1).rotateY(Math.PI / 4), rgb: [.34, .25, .2], pos: [0, 3.75, 0] }]);
      const mat = this.homeProxyMat ??= new THREE.MeshLambertMaterial({ vertexColors: true }), im = new THREE.InstancedMesh(geo, mat, proxies.length);
      proxies.forEach((i, k) => { const [W, Dp] = SIZES[SIZE_KEYS[B8[i + 7] % 10]]; q.setFromAxisAngle(up, B8[i + 4]); s.set(W, 1, Dp); p.set(B8[i + 1], B8[i + 3], B8[i + 2]); mtx.compose(p, q, s); im.setMatrixAt(k, mtx); });
      im.computeBoundingSphere(); im.receiveShadow = true; g.add(im); c.vegMeshes.push(im); c.casters.push(im);
    }
    // --- rocks / boulders
    const R5 = D.rocks, rg = new Map();
    for (let i = 0; i < R5.length; i += 5) {
      const sc = R5[i + 3], rot = R5[i + 4];
      q.setFromAxisAngle(up, rot);
      if (!veg) { s.set(sc * 1.3, sc, sc * 1.1); p.set(R5[i], R5[i + 2] + sc * .25, R5[i + 1]); mtx.compose(p, q, s); (rg.get('proxy') || rg.set('proxy', { list: [] }).get('proxy')).list.push({ matrix: mtx.clone() }); continue; }
      const big = sc > 1.5, names = big ? ROCK_SET.big : ROCK_SET.small, pr = veg.get(names[Math.floor(fract(rot * 3.7) * names.length) % names.length]); if (!pr) continue;
      const target = big ? sc * 1.1 : sc * .55, k = Math.max(.3, Math.min(8, target / Math.max(.05, pr.height)));
      s.set(k * (1 + fract(rot * 5.1) * .25), k, k * (1 + fract(rot * 2.3) * .25)); p.set(R5[i], R5[i + 2] - pr.box.min.y * k * .85, R5[i + 1]); mtx.compose(p, q, s);
      if (!rg.has(pr.name)) rg.set(pr.name, { pr, list: [] }); rg.get(pr.name).list.push({ matrix: mtx.clone() });
    }
    for (const [key, { pr, list }] of rg) {
      if (key === 'proxy') { const im = new THREE.InstancedMesh(this.rockGeo, this.rockMat, list.length); list.forEach((m, k) => im.setMatrixAt(k, m.matrix)); im.computeBoundingSphere(); g.add(im); c.vegMeshes.push(im); c.casters.push(im); }
      else this.addInstances(c, g, pr, list);
    }
    // --- ground plants (near only)
    if (veg && c.plantsOn) {
      const P5 = D.plants, pg = new Map(), H = { 0: 1.15, 1: .75, 2: .5, 3: .5, 4: .18, 5: .3 };
      for (let i = 0; i < P5.length; i += 5) {
        const kind = P5[i + 4] | 0, names = PLANT_SETS[kind], rot = fract((P5[i] * 12.9 + P5[i + 1] * 7.7) * .17) * 6.283, pr = veg.get(names[Math.floor(fract(P5[i] * 3.1 + P5[i + 1] * 1.7) * names.length) % names.length]); if (!pr) continue;
        const k = Math.max(.2, Math.min(5, (H[kind] * P5[i + 3]) / Math.max(.05, pr.height))); q.setFromAxisAngle(up, rot); s.setScalar(k); p.set(P5[i], P5[i + 2] - .02, P5[i + 1]); mtx.compose(p, q, s);
        col.setRGB(.9 + fract(rot * 7.3) * .2, .9 + fract(rot * 3.9) * .2, .9 + fract(rot * 5.5) * .15);
        if (!pg.has(pr.name)) pg.set(pr.name, { pr, list: [], cast: kind === 0 }); pg.get(pr.name).list.push({ matrix: mtx.clone(), color: col.clone() });
      }
      for (const { pr, list, cast } of pg.values()) this.addInstances(c, g, pr, list, { cast });
    }
    if (this.q.shadowsOn && c.shadow) for (const m of c.casters) m.castShadow = true;
  }
  attachGrass(c, G) {
    const total = G.length / 5, n = Math.max(1, Math.floor(total * this.q.grassDensity * .2)); if (!total) { c.grass = new THREE.Group(); c.grassMeshes = []; return; }      // empty (towns/roads): mark as done so it is not requested again      // clumps are big and detailed: ~450 per chunk is enough
    const veg = this.veg && this.veg.ready ? this.veg : null, grp = new THREE.Group(), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const buckets = new Map(); c.grassMeshes = [];
    for (let i = 0, k = 0; i < G.length && k < n; i += 5, k++) {
      const rot = fract((G[i] * 12.9 + G[i + 1] * 7.7) * .13) * 6.283, dry = G[i + 4]; q.setFromAxisAngle(up, rot);
      let key = 'blade', pr = null;
      if (veg) { pr = veg.get(GRASS_SET[Math.floor(fract(rot * 2.7) * GRASS_SET.length) % GRASS_SET.length]); key = pr ? pr.name : 'blade'; }
      s.setScalar(pr ? Math.max(.15, (.4 + fract(rot * 3.1) * .35) * G[i + 3] / Math.max(.2, pr.height)) : G[i + 3]); p.set(G[i], G[i + 2] - .03, G[i + 1]); mtx.compose(p, q, s); col.setRGB(1 + dry * .6, 1 + dry * .3, 1 - dry * .45);
      if (!buckets.has(key)) buckets.set(key, { pr, list: [] }); buckets.get(key).list.push({ matrix: mtx.clone(), color: col.clone() });
    }
    for (const { pr, list } of buckets.values()) {
      const parts = pr ? pr.parts : [{ geo: this.grassGeo, mat: this.grassMat }];
      for (const part of parts) { const im = new THREE.InstancedMesh(part.geo, part.mat, list.length); list.forEach((m, k) => { im.setMatrixAt(k, m.matrix); im.setColorAt(k, m.color); }); im.computeBoundingSphere(); im.receiveShadow = true; grp.add(im); c.grassMeshes.push(im); }
    }
    c.group.add(grp); c.grass = grp;
  }

  tick(time, params, camPos, sunDir, sunColor, skyColor) {
    windTime.value = time; if (params) this.waterParams = params;
    updateShoreWater(this.waterMat, this.waterParams, time, camPos, sunDir, sunColor, skyColor);
  }

  // ----- collision helpers -----
  nearby(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), n = this._near;
    if (n && n.cx === cx && n.cz === cz && n.ver === this.version) return n.val;
    const out = { trees: [], rocks: [] };
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = this.chunks.get((cx + dx) + ',' + (cz + dz)); if (c) { for (const t of c.trees) out.trees.push(t); for (const r of c.rocks) out.rocks.push(r); } }
    this._near = { cx, cz, ver: this.version, val: out }; return out;
  }
  pushOut(pos, radius) {
    const n = this.nearby(pos.x, pos.z);
    for (const t of n.trees) { const dx = pos.x - t.x, dz = pos.z - t.z, R = radius + .3 * t.s, d2 = dx * dx + dz * dz; if (d2 < R * R) { const d = Math.sqrt(d2) || .001; pos.x = t.x + dx / d * R; pos.z = t.z + dz / d * R; } }
    for (const r of n.rocks) {
      if (r.open) continue; const dx = pos.x - r.x, dz = pos.z - r.z;
      if (r.obb) {
        if (r.obb.y1 !== undefined && pos.y !== undefined && (pos.y > r.obb.y1 || pos.y + 1.7 < r.obb.y0)) continue;                  // other storey
        const { hx, hz, c, s } = r.obb, ex = hx + radius, ez = hz + radius, lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) { let nx = lx, nz = lz; if (ex - Math.abs(lx) < ez - Math.abs(lz)) nx = Math.sign(lx || 1) * ex; else nz = Math.sign(lz || 1) * ez; pos.x = r.x + nx * c + nz * s; pos.z = r.z - nx * s + nz * c; }
        continue;
      }
      const R = radius + r.r, d2 = dx * dx + dz * dz; if (d2 < R * R) { const d = Math.sqrt(d2) || .001; pos.x = r.x + dx / d * R; pos.z = r.z + dz / d * R; }
    }
  }
  insideTree(p, n) {
    for (const t of n.trees) {
      const dy = p.y - t.h; if (dy < 0 || dy > 8.2 * t.s) continue;
      const rad = dy < 2.4 * t.s ? .45 * t.s : 2.0 * t.s * (1 - (dy - 2.4 * t.s) / (5.8 * t.s));
      const dx = p.x - t.x, dz = p.z - t.z; if (dx * dx + dz * dz < rad * rad) return true;
    }
    return false;
  }
  // Walkable surface height: terrain, or the floors / staircase / porch of the houses (y = current height, to tell storeys apart).
  nearHomes(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), n = this._nh; if (n && n.cx === cx && n.cz === cz && n.ver === this.version) return n.val;
    const out = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = this.chunks.get((cx + dx) + ',' + (cz + dz)); if (c?.homes) for (const h of c.homes) out.push(h); }
    this._nh = { cx, cz, ver: this.version, val: out }; return out;
  }
  walkY(x, z, y) {
    const h = this.height(x, z), list = this.nearHomes(x, z); if (!list.length) return h;
    for (const H of list) {
      const dx = x - H.x, dz = z - H.z; if (dx * dx + dz * dz > 400) continue; const lx = dx * H.c - dz * H.s, lz = dx * H.s + dz * H.c, pl = H.plan, hw = pl.W / 2 + .11, hd = pl.D / 2 + .11;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
        if (pl.custom) {                                                            // townhouse: stairs are a stack of steps from the model
          const T = H.town; let best = -1; if (T) for (const st of T.stairs) if (lx > st.x0 && lx < st.x1 && lz > st.z0 && lz < st.z1) { const t = H.y + st.top; if (t <= y + .45 && t >= y - .5 && t > best) best = t; }
          if (best > 0) return best; return y > H.y + TOWN.F1 + 1.4 ? H.y + TOWN.F2 : H.y + TOWN.F1;
        }
        const f1 = H.y + FLOOR_Y, S = pl.stair;
        if (S) { const f2 = H.y + FLOOR2_Y; if (lx > S.x0 && lx < S.x1 && lz > S.z0 && lz < S.z1) { const t = Math.max(0, Math.min(1, S.axis === 'z' ? (S.z1 - lz) / (S.z1 - S.z0) : (S.x1 - lx) / (S.x1 - S.x0))); return f1 + t * (f2 - f1); } if (y > f1 + 1.4) return f2; }
        return f1;
      }
      if (lx > pl.fx - 1.6 && lx < pl.fx + 1.6 && lz >= hd - .2 && lz < pl.D / 2 + 1.5) return Math.max(h, H.y + FLOOR_Y * .8);            // porch
    }
    return h;
  }
  insideBuilding(p, n) {
    for (const r of n.rocks) { if (!r.obb) continue; const dx = p.x - r.x, dz = p.z - r.z, { hx, hz, c, s, h } = r.obb, lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < hx + .3 && Math.abs(lz) < hz + .3 && (r.obb.y1 !== undefined ? (p.y > r.obb.y0 - .3 && p.y < r.obb.y1 + .3) : p.y < this.height(r.x, r.z) + h + .3)) return true; }
    return false;
  }
  clearFraction(from, to) {
    const n = this.nearby((from.x + to.x) / 2, (from.z + to.z) / 2), p = new THREE.Vector3();
    for (let i = 0; i <= 20; i++) { const f = i / 20; p.lerpVectors(from, to, f); if (this.insideTree(p, n) || this.insideBuilding(p, n)) return Math.max(.12, (i - 1.5) / 20); }
    return 1;
  }
  waterNear(x, z) {
    let w = 0; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, r = 6 + (i % 3) * 10; if (this.height(x + Math.cos(a) * r, z + Math.sin(a) * r) < WATER_LEVEL) w += 1 / (1 + r * .08); }
    return Math.min(1, w / 3);
  }
}
