// Living wildlife and livestock: animated CC0 animals (Quaternius) spawned deterministically around the player by habitat,
// with a small state machine (idle / graze / wander / flee). Also exports the loader used by the horse system.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// len: body length (m); walk/run: m/s; fear: distance at which it flees (0 = never); hop: moves by bouncing (no walk clip)
export const SPECIES = {
  Deer: { len: 1.9, walk: 1.2, run: 9, fear: 38 }, Stag: { len: 2.1, walk: 1.2, run: 9, fear: 42 }, Fox: { len: 1.0, walk: 1.4, run: 8, fear: 22 },
  Wolf: { len: 1.4, walk: 1.5, run: 8.5, fear: 14, night: true }, Cow: { len: 2.3, walk: .9, run: 5, fear: 6 }, Bull: { len: 2.5, walk: .9, run: 5, fear: 5 },
  Horse: { len: 2.5, walk: 1.5, run: 11, fear: 16 }, HorseWhite: { len: 2.5, walk: 1.5, run: 11, fear: 16 }, Donkey: { len: 1.8, walk: 1.2, run: 7, fear: 12 },
  Alpaca: { len: 1.3, walk: 1, run: 6, fear: 12 }, Shiba: { len: .85, walk: 1.5, run: 7, fear: 0 }, Husky: { len: 1.1, walk: 1.6, run: 8, fear: 0 },
  Pig: { len: 1.2, walk: .8, run: 4, fear: 4, hop: true }, Sheep: { len: 1.1, walk: .8, run: 4.5, fear: 7, hop: true }, Llama: { len: 1.5, walk: 1, run: 5, fear: 9, hop: true },
  kit_rabbit: { len: .5, walk: 1, run: 7, fear: 12, hop: true }, kit_bear: { len: 2.0, walk: 1.2, run: 6, fear: 10, hop: true }, kit_duck: { len: .5, walk: .7, run: 3, fear: 8, hop: true },
};
const hash = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clipOf = (clips, ...pats) => { for (const p of pats) { const c = clips.find(k => new RegExp('^(?:\\w+\\|)?' + p + '$', 'i').test(k.name)); if (c) return c; } return null; };

export class AnimalLibrary {
  constructor() { this.models = new Map(); this.loader = new GLTFLoader(); this.pending = new Map(); }
  load(name) {
    if (this.models.has(name)) return Promise.resolve(this.models.get(name));
    if (!this.pending.has(name)) this.pending.set(name, this.loader.loadAsync(`assets/animals/${name}.glb`).then(g => {
      g.scene.updateMatrixWorld(true); const box = new THREE.Box3();   // skinned meshes: measure the posed bounds (their geometry is authored in different units than the bones)
      g.scene.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } else if (o.isMesh) box.union(new THREE.Box3().setFromObject(o)); });
      const size = box.getSize(new THREE.Vector3()), sp = SPECIES[name] || { len: 1.5 };
      const m = { scene: g.scene, clips: g.animations, k: sp.len / Math.max(size.x, size.z, .01), lift: -box.min.y };
      m.hgt = size.y * m.k;
      g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; const mt = o.material; if (mt) { mt.envMapIntensity = .5; mt.roughness = Math.max(mt.roughness ?? .9, .85); mt.metalness = 0; } } });
      this.models.set(name, m); return m;
    }).catch(e => { console.warn('animal failed', name, e.message); return null; }));
    return this.pending.get(name);
  }
  // A fresh instance: { root (Object3D scaled to size), mixer, actions }
  async spawn(name, tint) {
    const m = await this.load(name); if (!m) return null;
    const root = new THREE.Group(), inner = SkeletonUtils.clone(m.scene); inner.scale.setScalar(m.k); inner.position.y = m.lift * m.k; root.add(inner);
    inner.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; if (tint && /^(main|main_light)$/i.test(o.material.name || '')) o.material.color.multiply(new THREE.Color(tint)); } });
    const mixer = new THREE.AnimationMixer(inner), act = {};
    for (const [key, pats] of Object.entries({ idle: ['Idle'], idle2: ['Idle_2'], graze: ['Idle_Headlow', 'Idle_2_HeadLow', 'Eating'], walk: ['Walk'], run: ['Gallop'], death: ['Death'] })) { const c = clipOf(m.clips, ...pats); if (c) act[key] = mixer.clipAction(c); }
    return { root, inner, mixer, act, k: m.k, name };
  }
}

export class AnimalManager {
  constructor({ scene, terrain, player, sky, lib = new AnimalLibrary() }) {
    this.scene = scene; this.terrain = terrain; this.player = player; this.sky = sky; this.lib = lib; this.cells = new Map(); this.list = []; this.t = 0; this.frame = 0; this.CELL = 90; this.R = 230; this.max = 42; this.enabled = true; this.scan = 0;
    this.hf = terrain.hf; this.plan = this.hf.plan(); this.sBy = new Map();
    for (const st of this.plan.settlements) { const k = Math.floor(st.x / this.CELL) + ',' + Math.floor(st.z / this.CELL); (this.sBy.get(k) || this.sBy.set(k, []).get(k)).push(st); }
  }
  // Which species live here?  returns [[species, count]...] or null
  habitat(x, z, r) {
    const h = this.terrain.height(x, z); if (h < 1.5) return null;
    const st = this.plan.settlementAt(x, z), forest = this.hf.forest(x, z);
    if (st && st.d < 1.3) return null;
    if (h > 62) return r < .35 ? [['Wolf', 2]] : r < .5 ? [['kit_bear', 1]] : null;
    if (forest > .55) return r < .4 ? [['Deer', 3]] : r < .55 ? [['Stag', 1], ['Deer', 2]] : r < .68 ? [['Fox', 1]] : r < .8 ? [['Wolf', 3]] : r < .87 ? [['kit_bear', 1]] : [['kit_rabbit', 4]];
    return r < .22 ? [['Horse', 3]] : r < .34 ? [['Deer', 3]] : r < .5 ? [['kit_rabbit', 4]] : r < .58 ? [['Cow', 3]] : r < .64 ? [['Donkey', 2]] : r < .7 ? [['HorseWhite', 2]] : r < .76 ? [['Alpaca', 2]] : r < .8 ? [['Fox', 1]] : null;
  }
  ensureCell(cx, cz) {
    const key = cx + ',' + cz; if (this.cells.has(key)) return; const cell = { key, animals: [] }; this.cells.set(key, cell);
    const spawnGroup = (groups, x0, z0, spread, seed) => {
      for (const [name, n] of groups) for (let i = 0; i < n; i++) {
        const x = x0 + (hash(cx, cz, seed + 10 + i) - .5) * spread, z = z0 + (hash(cx, cz, seed + 30 + i) - .5) * spread, h = this.terrain.height(x, z); if (h < .8) continue;
        const a = { name, x, z, yaw: hash(cx, cz, seed + 50 + i) * 6.28, state: 'idle', t: hash(cx, cz, seed + 70 + i) * 4, speed: 0, home: [x0, z0], obj: null, loading: false, y: h, pitch: 0, bob: 0 };
        cell.animals.push(a); this.list.push(a);
      }
    };
    for (const st of this.sBy.get(key) || []) {                                              // livestock and pets that belong to a settlement
      const r = hash(st.id, 3, 4);
      if (st.type === 3) spawnGroup(r < .4 ? [['Cow', 3], ['Sheep', 3], ['Pig', 2]] : r < .75 ? [['Cow', 2], ['Horse', 2], ['Sheep', 2], ['Llama', 1]] : [['Pig', 3], ['Sheep', 3], ['Bull', 1], ['Donkey', 1]], st.x, st.z, 26, 100);
      else if (st.type <= 2) spawnGroup([['Shiba', 1], ['Husky', 1], ['Horse', st.type === 2 ? 1 : 3], ['Donkey', 1]], st.x, st.z, st.r * 1.1, 200);
      else spawnGroup([['Horse', 1]], st.x, st.z, 14, 300);
    }
    const r = hash(cx, cz, 1), x0 = (cx + .5) * this.CELL, z0 = (cz + .5) * this.CELL; if (r > .62) return;
    const groups = this.habitat(x0, z0, hash(cx, cz, 2)); if (!groups) return; spawnGroup(groups, x0, z0, 30, 0);
  }
  async attach(a) {
    if (a.loading || a.obj) return; a.loading = true; const o = await this.lib.spawn(a.name); a.loading = false; if (!o || a.dead) return;
    a.obj = o; this.scene.add(o.root); o.root.position.set(a.x, a.y, a.z); const first = o.act.idle || o.act.graze; first?.play(); a.cur = first;
    if (first) o.mixer.update(Math.random() * 2);
  }
  detach(a) { if (a.obj) { this.scene.remove(a.obj.root); a.obj.mixer.stopAllAction(); a.obj.root.traverse(o => { if (o.isMesh) o.material.dispose(); }); a.obj = null; a.cur = null; } }
  play(a, key, fade = .3) {
    const o = a.obj; if (!o) return; const next = o.act[key] || (key === 'graze' ? o.act.idle : key === 'run' ? o.act.walk : null) || o.act.idle; if (!next || next === a.cur) return;
    next.reset().fadeIn(fade).play(); a.cur?.fadeOut(fade); a.cur = next; next.timeScale = key === 'walk' ? Math.max(.6, a.speed / (SPECIES[a.name].walk || 1)) * .9 : 1;
  }
  update(dt) {
    if (!this.enabled) return; this.t += dt; this.frame++;
    const P = this.player.pos, C = this.CELL, night = this.sky.hour < 6 || this.sky.hour > 20;
    if ((this.scan -= dt) <= 0) {                                                        // (re)scan cells around the player twice a second
      this.scan = .5; const rc = Math.ceil(this.R / C), cx0 = Math.floor(P.x / C), cz0 = Math.floor(P.z / C);
      for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) if (Math.hypot(dx, dz) * C < this.R) this.ensureCell(cx0 + dx, cz0 + dz);
      for (const [key, cell] of this.cells) { const [cx, cz] = key.split(',').map(Number); if (Math.hypot((cx + .5) * C - P.x, (cz + .5) * C - P.z) > this.R + 90) { for (const a of cell.animals) { a.dead = true; this.detach(a); } this.list = this.list.filter(a => !a.dead); this.cells.delete(key); } }
      let live = this.list.filter(a => a.obj).length;
      const near = this.list.filter(a => !a.obj && !a.loading).sort((p, q) => Math.hypot(p.x - P.x, p.z - P.z) - Math.hypot(q.x - P.x, q.z - P.z));
      for (const a of near) { if (live >= this.max || Math.hypot(a.x - P.x, a.z - P.z) > this.R * .75) break; this.attach(a); live++; }
      for (const a of this.list) if (a.obj && Math.hypot(a.x - P.x, a.z - P.z) > this.R * .95) this.detach(a);
    }
    for (const a of this.list) {
      const o = a.obj; if (!o) continue; const sp = SPECIES[a.name], dxp = P.x - a.x, dzp = P.z - a.z, dp = Math.hypot(dxp, dzp);
      if (dp > 140 && (this.frame + a.t * 7 | 0) % 4) continue;                          // far animals update at 1/4 rate (dt is compensated below)
      const step = dp > 140 ? dt * 4 : dt;
      a.t -= step; const scared = sp.fear && dp < sp.fear * (this.player.speed > 4 ? 1.4 : 1) && !(sp.night && !night && dp > 8);
      const predator = a.name === 'Wolf' || a.name === 'kit_bear';
      if (scared && a.state !== 'flee') { a.state = 'flee'; a.t = 2.5 + Math.random() * 2; a.yaw = Math.atan2(-dxp, -dzp) + (Math.random() - .5) * .8; }
      else if (a.state === 'flee' && a.t <= 0) { a.state = 'idle'; a.t = 1 + Math.random() * 3; }
      else if (a.t <= 0 && a.state !== 'flee') {
        const r = Math.random();
        if (a.state === 'walk' || r < .22) { a.state = r < .5 ? 'graze' : 'idle'; a.t = 3 + Math.random() * 7; }
        else { a.state = 'walk'; a.t = 3 + Math.random() * 6; a.yaw = Math.random() * 6.28; const hx = a.home[0] - a.x, hz = a.home[1] - a.z; if (Math.hypot(hx, hz) > 40) a.yaw = Math.atan2(hx, hz); }
      }
      void predator;
      const target = a.state === 'flee' ? sp.run : a.state === 'walk' ? sp.walk : 0; a.speed += (target - a.speed) * Math.min(1, step * 4);
      if (a.speed > .05) {
        const nx = a.x + Math.sin(a.yaw) * a.speed * step, nz = a.z + Math.cos(a.yaw) * a.speed * step, nh = this.terrain.height(nx, nz);
        if (nh < .5 || Math.abs(nh - a.y) > .9 * Math.max(.3, a.speed * step + .3)) { a.yaw += 1.7 + Math.random(); a.speed *= .3; } else { a.x = nx; a.z = nz; }
        const tmp = { x: a.x, z: a.z }; this.terrain.pushOut(tmp, .6); a.x = tmp.x; a.z = tmp.z;
      }
      const gh = this.terrain.height(a.x, a.z), fx = Math.sin(a.yaw) * .7, fz = Math.cos(a.yaw) * .7, hf = this.terrain.height(a.x + fx, a.z + fz), hb = this.terrain.height(a.x - fx, a.z - fz);
      a.y += (gh - a.y) * Math.min(1, step * 12); a.pitch += (Math.atan2(hb - hf, 1.4) - a.pitch) * Math.min(1, step * 6);
      if (sp.hop && a.speed > .1) { a.bob += step * (4 + a.speed * 1.4); }
      const bounce = sp.hop && a.speed > .1 ? Math.abs(Math.sin(a.bob)) * .12 * Math.min(1, a.speed / 2) : 0;
      o.root.position.set(a.x, a.y + bounce, a.z); o.root.rotation.set(a.pitch, a.yaw, 0, 'YXZ');
      this.play(a, a.state === 'flee' ? 'run' : a.state === 'walk' ? 'walk' : a.state === 'graze' ? 'graze' : 'idle');
      o.mixer.update(step);
    }
  }
}
