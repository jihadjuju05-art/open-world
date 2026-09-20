// The player's own horse: customisable (coat, saddle, name), whistled with Q, mounted/dismounted with E (with animation), ridden with
// W/S (speed), A/D (steer), C walk / default trot / Shift gallop. Uses the animated CC0 horse models from animals.js.
import * as THREE from 'three';
import { AnimalLibrary, SPECIES } from './animals.js';

export const HORSE_MODELS = { Horse: 'Caballo castaño', HorseWhite: 'Caballo claro', Donkey: 'Burro' };
export const DEFAULT_HORSE = { model: 'Horse', tint: '#ffffff', saddle: '#6b3f22', name: 'Trueno' };
const SPEED = { walk: 2.3, trot: 5.6, gallop: 11.5 };

export function buildSaddle(color = '#6b3f22') {
  const g = new THREE.Group(), leather = new THREE.MeshStandardMaterial({ color, roughness: .8 }), cloth = new THREE.MeshStandardMaterial({ color: 0x8a2f2a, roughness: .95 }), metal = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: .4, metalness: .8 });
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(.62, .05, .82), cloth); blanket.position.y = .02; g.add(blanket);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.42, .09, .52), leather); seat.position.y = .09; g.add(seat);
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .13, 10), leather); pommel.position.set(0, .16, .27); g.add(pommel);
  const cantle = new THREE.Mesh(new THREE.BoxGeometry(.4, .12, .06), leather); cantle.position.set(0, .16, -.27); g.add(cantle);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(.03, .34, .1), leather); st.position.set(s * .27, -.15, 0); g.add(st); const ring = new THREE.Mesh(new THREE.TorusGeometry(.06, .012, 6, 12), metal); ring.position.set(s * .27, -.34, 0); ring.rotation.y = Math.PI / 2; g.add(ring); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class PlayerHorse {
  constructor({ scene, terrain, player, lib = new AnimalLibrary() }) {
    Object.assign(this, { scene, terrain, player, lib }); this.look = { ...DEFAULT_HORSE }; this.obj = null; this.loading = false; this.mounted = false; this.riding = false; this.trans = null;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.speed = 0; this.pitch = 0; this.roll = 0; this.turnRate = 0; this.cur = null; this.gait = 'idle'; this.near = false; this.height = 1.4; this.mode = 'idle'; this.torsoBase = null; this.cal = null;
  }
  setLook(look) { const changed = look.model !== this.look.model || look.tint !== this.look.tint || look.saddle !== this.look.saddle; this.look = { ...DEFAULT_HORSE, ...look }; if (changed && this.obj && !this.riding) { const was = this.obj.root.position.clone(); this.dispose(); this.spawnAt(was.x, was.z); } }
  dispose() { if (this.obj) { this.scene.remove(this.obj.root); this.obj.mixer.stopAllAction(); this.obj = null; this.cur = null; this.torsoBase = null; } }
  async spawnAt(x, z) {
    if (this.loading) return; this.loading = true; const o = await this.lib.spawn(this.look.model, this.look.tint !== '#ffffff' ? this.look.tint : null); this.loading = false; if (!o) return;
    this.height = this.lib.models.get(this.look.model)?.hgt || 1.5;
    const saddle = buildSaddle(this.look.saddle); saddle.position.set(0, this.height * .68, 0); o.root.add(saddle); o.saddle = saddle; o.torso = o.inner.getObjectByName('Torso2') || o.inner.getObjectByName('Back');
    this.obj = o; this.scene.add(o.root); this.pos.set(x, this.terrain.height(x, z), z); o.root.position.copy(this.pos); this.play('idle', 0); this.torsoBase = null;
  }
  play(key, rate = 1) {
    const o = this.obj; if (!o) return; const a = o.act[key === 'trot' ? 'walk' : key]; if (!a) return; if (this.cur !== a) { a.reset().fadeIn(.25).play(); this.cur?.fadeOut(.25); this.cur = a; } a.timeScale = rate;
  }
  call() {                                            // whistle: the horse arrives from behind the player
    const P = this.player.pos, a = this.player.yaw + Math.PI + (Math.random() - .5);
    if (!this.obj) { this.spawnAt(P.x + Math.sin(a) * 30, P.z + Math.cos(a) * 30); this.mode = 'come'; }
    else if (!this.riding) { this.mode = 'come'; if (Math.hypot(this.pos.x - P.x, this.pos.z - P.z) > 180) { this.pos.set(P.x + Math.sin(a) * 40, 0, P.z + Math.cos(a) * 40); } }
  }
  get distance() { return this.obj ? Math.hypot(this.pos.x - this.player.pos.x, this.pos.z - this.player.pos.z) : 1e9; }
  side() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }        // the horse's left (mounting side)
  toggleMount() {
    if (this.trans) return true;
    if (this.mounted) { this.mounted = false; this.trans = { dir: -1, t: 0 }; this.speed = 0; return true; }
    if (this.obj && this.distance < 4.6 && !this.riding) { this.riding = true; this.player.mounted = this; this.trans = { dir: 1, t: 0, from: this.player.pos.clone() }; this.mode = 'idle'; return true; }
    return false;
  }
  // input: { x: steer (D=+1), z: forward (W=+1), gait: 'walk'|'jog'|'run' }
  update(dt, input) {
    const o = this.obj; if (!o) return; const T = this.terrain, P = this.player.pos;
    this.near = !this.riding && this.distance < 4.6;
    let want = 0, turn = 0;
    if (this.mounted) {
      const g = input.gait === 'run' ? 'gallop' : input.gait === 'walk' ? 'walk' : 'trot';
      want = input.z > 0 ? SPEED[g] : input.z < 0 ? -1.4 : 0; turn = -input.x * (1.9 - Math.min(1, this.speed / 12) * .7);
      want *= 1 - Math.max(0, Math.min(.5, -this.pitch * 1.4)) * .9;                    // slower uphill
    } else if (this.trans) { want = 0; }
    else if (this.mode === 'come') {
      const dx = P.x - this.pos.x, dz = P.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 3.2) { this.mode = 'idle'; want = 0; } else { let a = Math.atan2(dx, dz) - this.yaw; a = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; turn = Math.max(-2.6, Math.min(2.6, a * 3)); want = d > 25 ? SPEED.gallop : d > 9 ? SPEED.trot : SPEED.walk; }
    } else if (this.distance > 14 && this.distance < 160) { this.mode = 'come'; }                 // trots after its owner if left behind
    const g0 = T.height(this.pos.x, this.pos.z), depth = Math.max(0, -g0); this.depth = depth; this.swimming = depth > 1.05;       // wades through shallows, swims (with or without rider) when it is deep
    want *= this.swimming ? .7 : 1 - Math.min(.35, depth * .3);
    this.speed += (want - this.speed) * Math.min(1, dt * (Math.abs(want) > Math.abs(this.speed) ? 1.6 : 3.2));
    const tr = turn * (Math.abs(this.speed) > .3 ? 1 : .3); this.turnRate += (tr - this.turnRate) * Math.min(1, dt * 6); this.yaw += this.turnRate * dt;
    if (Math.abs(this.speed) > .02) {
      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt, nh = T.height(nx, nz);
      const wet = nh < -.1 || g0 < -.1;
      if (!wet && Math.abs(nh - this.pos.y) > .8 + Math.abs(this.speed) * dt) { this.speed *= .2; } else { this.pos.x = nx; this.pos.z = nz; }
      if (depth > .12) { const rv = T.riverAt(this.pos.x, this.pos.z), push = rv.t * (.6 + .5 * Math.min(1, depth)); this.pos.x += rv.fx * push * dt; this.pos.z += rv.fz * push * dt; }      // river current
      T.pushOut(this.pos, 1.0);
    }
    const gh = T.height(this.pos.x, this.pos.z), f = Math.sin(this.yaw) * .9, ff = Math.cos(this.yaw) * .9;
    const yT = this.swimming ? -.85 + Math.sin(performance.now() * .002) * .04 : gh; this.pos.y += (yT - this.pos.y) * Math.min(1, dt * (this.swimming ? 6 : 14)); this.pitch += ((this.swimming ? 0 : Math.atan2(T.height(this.pos.x - f, this.pos.z - ff) - T.height(this.pos.x + f, this.pos.z + ff), 1.8)) - this.pitch) * Math.min(1, dt * 6);
    const s = Math.abs(this.speed); this.roll += (-this.turnRate * Math.min(1, s / 9) * .16 - this.roll) * Math.min(1, dt * 5);   // leans into turns
    o.root.position.copy(this.pos); o.root.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.gait = s > 8 ? 'gallop' : s > 3.4 ? 'trot' : s > .4 ? 'walk' : 'idle';
    this.play(this.gait === 'gallop' && !this.swimming ? 'run' : this.gait === 'idle' ? 'idle' : 'walk', this.swimming ? .9 : this.gait === 'trot' ? 1.75 : this.gait === 'walk' ? s / (SPECIES[this.look.model]?.walk || 1.5) * .5 + .5 : 1);
    o.mixer.update(dt); o.root.updateMatrixWorld(true);
    if (o.torso && this.torsoBase === null && this.gait === 'idle') this.torsoBase = o.torso.getWorldPosition(new THREE.Vector3()).y - this.pos.y;
    if (this.mounted) { this.player.pos.set(this.pos.x, this.pos.y, this.pos.z); this.player.speed = s; this.player.yaw = this.yaw; }
  }
  // The rig's local axes differ per bone: find which axis/sign of a bone moves its end bone forward.
  calibrate(g) {
    const b = g.partBones[0], root = g.root, V = THREE.Vector3; root.updateMatrixWorld(true); const fwd = new V(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())), res = {};
    for (const [key, bone, end, dir] of [['thigh', 'thigh', 'foot', 1], ['calf', 'calf', 'foot', -1], ['arm', 'upperarm', 'hand', 1], ['fore', 'lowerarm', 'hand', 1]]) for (const sd of ['l', 'r']) {
      const bn = b[bone + '_' + sd], en = b[end + '_' + sd]; if (!bn || !en) continue; const e0 = en.getWorldPosition(new V()); let best = null;
      for (const ax of ['X', 'Y', 'Z']) { const q = bn.quaternion.clone(); bn['rotate' + ax](.5); root.updateMatrixWorld(true); const d = en.getWorldPosition(new V()).sub(e0).dot(fwd) * dir; bn.quaternion.copy(q); root.updateMatrixWorld(true); if (!best || Math.abs(d) > Math.abs(best.d)) best = { ax, sign: Math.sign(d) || 1, d }; }
      res[key + sd] = best;
    }
    return res;
  }
  // Seat the rider after the body has been animated. w (0..1) blends the sitting pose; the seat follows the horse back bone (bobbing with the gait).
  seatRider(w = 1, base = null) {
    const p = this.player, o = this.obj; if (!o || !p.gltf) return; const g = p.gltf, root = g.root, h = this.height;
    if (!this.cal) this.cal = this.calibrate(g);
    const eul = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'), bob = o.torso && this.torsoBase !== null ? o.torso.getWorldPosition(new THREE.Vector3()).y - this.pos.y - this.torsoBase : 0;
    const seat = new THREE.Vector3(0, h * .68 + .12 + bob, 0).applyEuler(eul).add(this.pos); seat.y -= .8;
    if (base && w < 1) { const k = w * w * (3 - 2 * w); root.position.lerpVectors(base, seat, k); root.position.y += Math.sin(Math.PI * w) * .55; } else root.position.copy(seat);
    root.rotation.set(this.pitch * .6, this.yaw, this.roll * .8, 'YXZ');
    const gal = this.gait === 'gallop' ? 1 : this.gait === 'trot' ? .5 : 0, rot = (b, key, ang) => { const c = this.cal[key]; if (b && c) b['rotate' + c.ax](c.sign * ang * w); };
    for (const b of g.partBones) {
      for (const sd of ['l', 'r']) { rot(b['thigh_' + sd], 'thigh' + sd, 1.15); rot(b['calf_' + sd], 'calf' + sd, 1.25); rot(b['upperarm_' + sd], 'arm' + sd, .55 + gal * .25); rot(b['lowerarm_' + sd], 'fore' + sd, .5); }
      b.spine_02?.rotateX((.08 + gal * .12) * w); b.pelvis?.rotateX(.05 * w);
    }
    root.updateMatrixWorld(true);
  }
  // Called every frame while riding (mounting, mounted or dismounting).
  ride(dt) {
    const p = this.player, tr = this.trans; p.gltf.play('Idle_Loop', .2, 1); p.gltf.update(dt);
    if (!tr) { this.seatRider(1); return; }
    tr.t += dt / 1.0; const w = tr.dir > 0 ? Math.min(1, tr.t) : Math.max(0, 1 - tr.t), sidePos = this.pos.clone().addScaledVector(this.side(), 1.15); sidePos.y = this.terrain.height(sidePos.x, sidePos.z);
    this.seatRider(w, sidePos); p.pos.copy(this.pos);
    if (tr.t >= 1) { this.trans = null; if (tr.dir > 0) this.mounted = true; else { this.riding = false; p.mounted = null; p.pos.copy(sidePos); p.yaw = this.yaw; this.mode = 'idle'; } }
  }
}
