// Runtime side of the procedural houses: materials, shells (merged meshes, cached per design), lazily built interiors with furniture,
// animated doors, interactions (sit, sleep, search, lamps, read, cook) and a small inventory.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getShell, furnish, STYLES, SIZES, WALL_HEIGHT, FLOOR2_Y, WALL2_H } from './housegen.js';

const TEX = 'assets/tex/';
const STYLE_MATS = {                                // exterior / roof textures and tints per style
  western: { ext: ['brown_planks_05', 0xc9a27a], roof: ['roof_slates_02', 0x8a7f78], wall: ['beige_wall_001', 0xd8c7a6], trim: 0x4a3626 },
  victorian: { ext: ['brick_wall_005', 0xd9a58a], roof: ['clay_roof_tiles_02', 0xb58a7a], wall: ['beige_wall_001', 0xe3d6b8], trim: 0xf0e8d8 },
  modern: { ext: ['beige_wall_001', 0xf6f3ec], roof: ['roof_slates_02', 0x59606a], wall: ['beige_wall_001', 0xf4f1ea], trim: 0x30343a },
  rustic: { ext: ['dark_planks', 0xb8a08a], roof: ['clay_roof_tiles_02', 0x9a6a58], wall: ['clay_plaster', 0xd9c6a4], trim: 0x352a20 },
};
const hash = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const LOOT = [['Monedas', 'coin', 1, 25], ['Pan', 'food', 1, 2], ['Manzana', 'food', 1, 3], ['Vendaje', 'heal', 1, 2], ['Reloj de bolsillo', 'trinket', 1, 1], ['Carta amarillenta', 'trinket', 1, 1], ['Llave oxidada', 'trinket', 1, 1], ['Munición', 'ammo', 3, 12], ['Whisky', 'drink', 1, 1], ['Vela', 'trinket', 1, 2]];

export class Inventory {
  constructor() { this.items = {}; try { this.items = JSON.parse(localStorage.getItem('openworld.inv.v1') || '{}'); } catch { } }
  add(name, n = 1) { this.items[name] = (this.items[name] || 0) + n; this.save(); }
  take(name, n = 1) { if ((this.items[name] || 0) < n) return false; this.items[name] -= n; if (this.items[name] <= 0) delete this.items[name]; this.save(); return true; }
  save() { try { localStorage.setItem('openworld.inv.v1', JSON.stringify(this.items)); } catch { } }
}

export class HouseManager {
  constructor({ scene, terrain, sky }) {
    Object.assign(this, { scene, terrain, sky }); this.player = { pos: new THREE.Vector3(1e6, 0, 1e6), yaw: 0 }; this.combat = { busy: false }; this.shellCache = new Map(); this.mats = new Map(); this.texs = new Map(); this.loader = new GLTFLoader(); this.protos = new Map(); this.pending = new Map();
    this.houses = new Map(); this.inv = new Inventory(); this.target = null; this.scan = 0; this.searched = new Set(); this.doorAnim = []; this.lightPool = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffd9a0, 0, 14, 1.6); l.position.set(0, -50, 0); scene.add(l); this.lightPool.push(l); }
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0xbfd9e6, roughness: .05, metalness: 0, transparent: true, opacity: .28, side: THREE.DoubleSide }); this.doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: .8 });
    this.ui = document.getElementById('invbox');
  }
  bind({ player, combat, camera, toast }) { Object.assign(this, { player, combat, camera, toast }); }
  // ---- materials ----
  tex(name, srgb) { const k = name + srgb; let t = this.texs.get(k); if (!t) { t = new THREE.TextureLoader().load(TEX + name + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; this.texs.set(k, t); } return t; }
  pbr(id, tint, rep = 1) { const m = new THREE.MeshStandardMaterial({ map: this.tex(id + '_diff', true), normalMap: this.tex(id + '_nor', false), roughnessMap: this.tex(id + '_rough', false), color: tint, roughness: 1, envMapIntensity: .6 }); return m; }
  mat(style, key) {
    const k = style + ':' + key; let m = this.mats.get(k); if (m) return m; const S = STYLE_MATS[style] || STYLE_MATS.western;
    switch (key) {
      case 'ext': case 'gable': m = this.pbr(S.ext[0], S.ext[1]); break; case 'roof': m = this.pbr(S.roof[0], S.roof[1]); break; case 'wall': m = this.pbr(S.wall[0], S.wall[1]); m.envMapIntensity = .25; break;
      case 'floor': m = this.pbr('brown_planks_03', 0xc9b193); m.envMapIntensity = .25; break; case 'tile': m = this.pbr('brown_floor_tiles', 0xd8d0c4); m.envMapIntensity = .25; break;
      case 'ceil': m = this.pbr('clay_plaster', 0xeee6d6); m.envMapIntensity = .2; break; case 'found': m = this.pbr('cobblestone_floor_04', 0x9a948a); break; case 'porch': m = this.pbr('brown_planks_05', 0xb59572); break;
      case 'chim': m = this.pbr('brick_wall_005', 0xb07a66); break; case 'roofflat': m = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: .95 }); break;
      case 'glass': m = this.glass; break; default: m = new THREE.MeshStandardMaterial({ color: S.trim, roughness: .75 });          // 'trim'
    }
    this.mats.set(k, m); return m;
  }
  // ---- design cache ----
  shell(seed, style, size) { return getShell(seed, style, size); }
  key(x, z) { return Math.round(x) + ',' + Math.round(z); }
  // Called by the terrain when a chunk (tier <= 1) shows a home. Returns the Object3D to add.
  create(x, z, y, rot, seed, style, size, colInfo) {
    const key = this.key(x, z), old = this.houses.get(key); if (old) return old.group;
    const sh = this.shell(seed, style, size), group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rot; group.updateMatrixWorld();
    for (const p of sh.parts) { const m = new THREE.Mesh(p.geo, this.mat(style, p.key)); m.castShadow = p.key !== 'glass'; m.receiveShadow = true; if (p.key === 'glass') { m.castShadow = false; m.renderOrder = 3; } group.add(m); }
    const inst = { key, x, z, y, rot, seed, style, size, group, shell: sh, interior: null, doors: [], built: false, colInfo, doorObjs: [] }; this.houses.set(key, inst); this.scene.add(group);
    // doors: leaves hinged on the left edge
    for (const d of sh.doors) { const w = d.u1 - d.u0, leaf = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(w - .04, 2.05, .05), this.doorMat); mesh.position.set((w - .04) / 2, 1.03, 0); mesh.castShadow = true; leaf.add(mesh); const knob = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: .8, roughness: .3 })); knob.position.set(w - .18, 1.0, .05); leaf.add(knob);
      if (d.ax === 'z') { leaf.position.set(d.u0 + .02, d.y0, d.c); } else { leaf.position.set(d.c, d.y0, d.u0 + .02); leaf.rotation.y = -Math.PI / 2; leaf.userData.rot0 = -Math.PI / 2; }
      leaf.userData.rot0 = leaf.rotation.y; group.add(leaf); const o = { id: d.id, d, leaf, open: 0, target: 0, col: colInfo?.doorCols?.[d.id] }; inst.doorObjs.push(o); }
    return group;
  }
  remove(x, z) { const key = this.key(x, z), inst = this.houses.get(key); if (!inst) return; this.dropInterior(inst); this.scene.remove(inst.group); this.houses.delete(key); }
  // ---- props ----
  loadProto(file) {
    if (this.protos.has(file)) return Promise.resolve(this.protos.get(file)); if (this.pending.has(file)) return this.pending.get(file);
    const p = this.loader.loadAsync(`assets/interior/${file}.glb`).then(g => { g.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.envMapIntensity = .35; o.material.roughness = Math.max(o.material.roughness ?? .8, .6); o.material.metalness = Math.min(o.material.metalness ?? 0, .3); } } });
      const r = { scene: g.scene, max: Math.max(size.x, size.y, size.z, .001), cx: c.x, cz: c.z, minY: box.min.y }; this.protos.set(file, r); return r; }).catch(() => { this.protos.set(file, null); return null; });
    this.pending.set(file, p); return p;
  }
  // The townhouse interior is one hand-made model (static mesh with vertex colours + 4 hinged doors); interactive items come from its JSON.
  loadTown() { if (!this.townP) this.townP = this.loader.loadAsync('assets/house/townhouse.glb').then(g => g.scene).catch(() => null); return this.townP; }
  async buildTown(inst) {
    inst.building = true; const T = inst.shell.town, root = await this.loadTown(); if (!root || !T) { inst.building = false; return; }
    const grp = new THREE.Group(); inst.interior = grp; inst.group.add(grp); inst.inter = [];
    if (!this.townMat) this.townMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, envMapIntensity: .3 });
    root.traverse(o => { if (!o.isMesh) return; const m = new THREE.Mesh(o.geometry, this.townMat); m.castShadow = true; m.receiveShadow = true; const dm = /^door_(\d)/.exec(o.name) || (o.parent && /^door_(\d)/.exec(o.parent.name));
      if (dm) { const id = +dm[1], d = T.doors.find(q => q.id === id); if (!d) return; const leaf = new THREE.Group(); leaf.position.set(d.hinge[0], d.hinge[1], d.hinge[2]); m.position.set(0, 0, 0); leaf.add(m); grp.add(leaf); leaf.userData.rot0 = 0; inst.doorObjs.push({ id: 100 + id, model: true, d: { ax: d.axis }, local: new THREE.Vector3(d.cx, (d.y0 + d.y1) / 2, d.cz), leaf, open: 0, target: 0, col: inst.colInfo?.doorCols?.[100 + id], sgn: d.axis === 'x' ? 1 : -1 }); }
      else { m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); grp.add(m); } });
    for (const it of T.interact) { const holder = new THREE.Group(); holder.position.set(it.x, it.y0, it.z); holder.rotation.y = Math.atan2(-it.x, -it.z); grp.add(holder); inst.inter.push({ it: { role: it.name, interact: it.kind, x: it.x, z: it.z }, holder, inst }); }
    inst.building = false;
  }
  async buildInterior(inst) {
    if (inst.interior || inst.building) return; if (inst.shell.plan.custom) return this.buildTown(inst); inst.building = true; const plan = inst.shell.plan, items = furnish(plan), grp = new THREE.Group(); inst.interior = grp; inst.group.add(grp); inst.inter = [];
    const protos = await Promise.all(items.map(it => this.loadProto(it.file))); if (inst.interior !== grp) return;                      // dropped meanwhile
    items.forEach((it, i) => {
      const pr = protos[i]; if (!pr) return; const k = it.size / pr.max, o = pr.scene.clone(true); const holder = new THREE.Group(); o.scale.setScalar(k); o.position.set(-pr.cx * k, -pr.minY * k, -pr.cz * k); holder.add(o); holder.position.set(it.x, it.y + (it.flat ? .01 : 0), it.z); holder.rotation.y = it.rot + (FIX[it.file] || 0); grp.add(holder);
      const e = { it, holder, inst }; if (it.interact && it.interact !== 'none') inst.inter.push(e); if (it.role === 'lamp') { e.lamp = true; e.on = false; inst.inter.push(e); e.it.interact = 'lamp'; }
    });
    // ceiling light in each room (glow disc; real light comes from the pooled point lights)
    if (!plan.custom) for (const lv of plan.levels) for (const r of lv.rooms) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .05, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); m.position.set((r.x0 + r.x1) / 2, lv.y0 + lv.h - .12, (r.z0 + r.z1) / 2); grp.add(m); }
    inst.building = false;
  }
  dropInterior(inst) { if (inst.interior) { inst.group.remove(inst.interior); inst.interior = null; inst.inter = []; inst.doorObjs = inst.doorObjs.filter(o => !o.model); } }
  // ---- per-frame ----
  update(dt) {
    const P = this.player.pos; this.scan -= dt;
    if (this.scan <= 0) {
      this.scan = .4; const near = [];
      for (const inst of this.houses.values()) { inst.dist = Math.hypot(inst.x - P.x, inst.z - P.z); near.push(inst); }
      near.sort((a, b) => a.dist - b.dist); this.near = near.filter(i => i.dist < 40);
      near.forEach((inst, k) => { const R = Math.max(inst.shell.plan.W, inst.shell.plan.D) / 2 + 16; if (k < 3 && inst.dist < R) { if (!inst.interior && !inst.building) this.buildInterior(inst); } else if (inst.interior && (k >= 3 || inst.dist > R + 10)) this.dropInterior(inst); });      // furniture only for the 3 nearest houses
      // pooled lights: rooms of the nearest houses, warm at night and inside
      const night = this.sky.hour < 7 || this.sky.hour > 18.5; let li = 0; const inside = near[0] && this.isInside(near[0], P);
      for (const inst of near.slice(0, 2)) for (const lv of inst.shell.plan.levels) for (const r of lv.rooms) { if (li >= this.lightPool.length) break; const l = this.lightPool[li++], c = new THREE.Vector3((r.x0 + r.x1) / 2, lv.y0 + lv.h - .5, (r.z0 + r.z1) / 2).applyMatrix4(inst.group.matrixWorld); l.position.copy(c); l.intensity = inside || night ? 9 : 2.5; }
      for (; li < this.lightPool.length; li++) this.lightPool[li].intensity = 0;
    }
    // door animation
    for (const inst of this.houses.values()) for (const o of inst.doorObjs) { if (o.open !== o.target) { o.open += Math.sign(o.target - o.open) * Math.min(Math.abs(o.target - o.open), dt * 3.2); o.leaf.rotation.y = o.leaf.userData.rot0 + o.open * -1.75 * (o.sgn || 1); if (o.col) o.col.open = o.open > .3; } }
    this.pick();
  }
  isInside(inst, p) { const l = inst.group.worldToLocal(p.clone()), pl = inst.shell.plan; return Math.abs(l.x) < pl.W / 2 && Math.abs(l.z) < pl.D / 2; }
  // choose the closest interactable in front of the player
  pick() {
    if (!this.near || this.combat.busy || this.player.mounted) { this.target = null; return; } const P = this.player.pos, fwd = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw)); let best = null, bs = 1e9;
    for (const inst of this.near.slice(0, 3)) {
      const cand = [];
      for (const o of inst.doorObjs) { const w = (o.local ? o.local.clone() : new THREE.Vector3(o.d.ax === 'z' ? (o.d.u0 + o.d.u1) / 2 : o.d.c, 1, o.d.ax === 'z' ? o.d.c : (o.d.u0 + o.d.u1) / 2)).applyMatrix4(inst.group.matrixWorld); cand.push({ kind: 'door', o, pos: w, label: o.target ? 'Cerrar puerta' : 'Abrir puerta', r: 2.3 }); }
      for (const e of inst.inter || []) { const w = e.holder.getWorldPosition(new THREE.Vector3()), t = e.it.interact, done = this.searched.has(inst.key + e.it.role + e.it.x + e.it.z); if (t === 'search' && done) continue; cand.push({ kind: t, e, pos: w, label: { sit: 'Sentarse', sleep: 'Dormir', search: 'Registrar', sink: 'Beber agua', stove: 'Cocinar', read: 'Leer un libro', fire: 'Calentarse', lamp: e.on ? 'Apagar lámpara' : 'Encender lámpara' }[t] || 'Usar', r: t === 'sleep' ? 2.6 : 1.9 }); }
      for (const c of cand) { const dx = c.pos.x - P.x, dz = c.pos.z - P.z, d = Math.hypot(dx, dz); if (d > c.r || Math.abs(c.pos.y - P.y) > 2.4) continue; const ang = Math.abs(((Math.atan2(dx, dz) - this.player.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI); if (ang > 1.15 && d > .9) continue; const s = d + ang * .8; if (s < bs) { bs = s; best = c; } }
    }
    this.target = best;
  }
  interact() {
    const t = this.target; if (!t) return false;
    if (t.kind === 'door') { t.o.target = t.o.target ? 0 : 1; return true; }
    const e = t.e;
    if (t.kind === 'sit') { const p = t.pos; this.player.pos.set(p.x, this.terrain.walkY(p.x, p.z, p.y) + .18, p.z); this.player.yaw = e.holder.getWorldQuaternion(new THREE.Quaternion()) && this.yawOf(e.holder); this.combat.emote = { clip: 'Sitting_Idle_Loop', loop: true }; this.combat.body.startAction('Sitting_Idle_Loop', { loop: true, fade: .25 }); this.toast?.('Sentado', 'Muévete para levantarte'); return true; }
    if (t.kind === 'sleep') { this.sleep(); return true; }
    if (t.kind === 'lamp') { e.on = !e.on; e.holder.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone?.() || o.material; o.material.emissive = new THREE.Color(e.on ? 0xffc870 : 0x000000); o.material.emissiveIntensity = e.on ? .9 : 0; } }); return true; }
    if (t.kind === 'search') { this.searched.add(t.e.inst.key + e.it.role + e.it.x + e.it.z); this.loot(); return true; }
    if (t.kind === 'sink') { this.combat.hp = Math.min(this.combat.maxHp, this.combat.hp + 8); this.toast?.('Agua fresca', '+8 vida'); return true; }
    if (t.kind === 'stove') { if (this.inv.take('Pan')) { this.combat.hp = Math.min(this.combat.maxHp, this.combat.hp + 25); this.toast?.('Tostada caliente', '+25 vida'); } else this.toast?.('Sin ingredientes', 'Necesitas pan'); return true; }
    if (t.kind === 'read') { this.toast?.('Un libro', ['«El oeste no perdona.»', 'Un diario con páginas arrancadas.', 'Tratado de armería: bloquea justo antes del golpe.', 'Cartas de amor sin destinatario.'][Math.floor(Math.random() * 4)]); return true; }
    if (t.kind === 'fire') { this.combat.stamina = this.combat.maxStamina; this.toast?.('Junto al fuego', 'Resistencia recuperada'); return true; }
    return false;
  }
  yawOf(o) { const q = o.getWorldQuaternion(new THREE.Quaternion()), f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); }
  loot() {
    const n = 1 + (Math.random() < .4 ? 1 : 0), got = []; for (let i = 0; i < n; i++) { const L = LOOT[Math.floor(Math.random() * LOOT.length)], q = L[2] + Math.floor(Math.random() * (L[3] - L[2] + 1)); this.inv.add(L[0], q); got.push(`${q > 1 ? q + '× ' : ''}${L[0]}`); }
    this.toast?.('Has encontrado', got.join(' · ')); this.renderInv();
  }
  sleep() {
    const f = document.getElementById('fade'); if (!f) return; f.style.opacity = 1; setTimeout(() => { this.sky.set(8); this.combat.hp = this.combat.maxHp; this.combat.stamina = this.combat.maxStamina; f.style.opacity = 0; this.toast?.('Buenos días', 'Has dormido hasta las 08:00'); }, 1400);
  }
  renderInv() { if (!this.ui) return; const e = Object.entries(this.inv.items); this.ui.innerHTML = '<h3>INVENTARIO</h3>' + (e.length ? e.map(([n, q]) => `<div class="it"><span>${n}</span><b>×${q}</b>${n === 'Vendaje' || n === 'Pan' || n === 'Manzana' ? `<button data-use="${n}">Usar</button>` : ''}</div>`).join('') : '<p class="tag">Vacío. Registra cajones y armarios.</p>'); this.ui.querySelectorAll('[data-use]').forEach(b => b.onclick = () => this.use(b.dataset.use)); }
  use(n) { const heal = { Vendaje: 35, Pan: 15, Manzana: 8 }[n]; if (heal && this.inv.take(n)) { this.combat.hp = Math.min(this.combat.maxHp, this.combat.hp + heal); this.toast?.('Has usado ' + n, '+' + heal + ' vida'); this.renderInv(); } }
  toggleInv() { if (!this.ui) return; this.ui.classList.toggle('hidden'); if (!this.ui.classList.contains('hidden')) this.renderInv(); }
}
const FIX = {};             // per-file rotation fixes for models whose front is not +Z
export { STYLES, SIZES };
