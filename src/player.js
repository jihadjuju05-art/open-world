// Third-person character controller: movement, terrain following, foot IK and additive procedural animation.
import * as THREE from 'three';
import { buildRig } from './rig.js';
import { Animator, AnimGraph } from './anim.js';
import { solveHandle, solveTwoBone } from './ik.js';
import { GltfAnimator } from './character.js';
import { WATER_LEVEL } from './heightfield.js';

export const GAITS = { walk: 1.6, jog: 3.0, run: 5.6 };
export const GAITS_GLTF = { walk: 1.5, jog: 4.4, run: 7.0 };     // matched to the library clips' natural speeds (walk .98, jog 5.4, sprint 8.3 m/s)
const CHAR_SCALE = .92;     // ground speeds (m/s) matched to the walk/jog/run clips' stride length
const UP = new THREE.Vector3(0, 1, 0), ANKLE = .09;

export class Player {
  constructor(scene, terrain, clips, graph, waterLevel = WATER_LEVEL, gltfBody = null) {
    this.terrain = terrain; this.clips = clips; this.waterLevel = waterLevel; this.onFootstep = null; this.gltf = gltfBody; this.gaits = gltfBody ? GAITS_GLTF : GAITS; this.ankle = ANKLE;
    this.applyLook = () => { if (this.gltf) this.gltf.root.scale.setScalar(CHAR_SCALE * (this.gltf.cfg.height || 1)); };
    if (gltfBody) {                                            // realistic character driven by the same data-driven animation graph
      this.rig = { root: gltfBody.root, bones: {} }; scene.add(gltfBody.root); this.applyLook();
      this.anim = new GltfAnimator(gltfBody); const g2 = JSON.parse(JSON.stringify(graph)), cl = {};
      for (const k of ['idle', 'walk', 'jog', 'run', 'jump', 'swim']) cl[k] = { stateKey: k };
      for (const k of ['walk', 'jog', 'run', 'swim']) if (g2.states[k] && gltfBody.cfg.rateDiv[k]) g2.states[k].rateDiv = gltfBody.cfg.rateDiv[k];
      this.graph = new AnimGraph(this.anim, cl, g2);
    } else {
      this.rig = buildRig(); scene.add(this.rig.root);
      this.anim = new Animator(this.rig); this.graph = new AnimGraph(this.anim, clips, graph);
      this.anim.onEvent = name => this.onFootstep && this.onFootstep(name, this.wading);
    }
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.grounded = true; this.speed = 0; this.wading = 0;
    this.state = this.graph.state; this.swim = 0; this.swimming = false; this.depth = 0; this.current = 0; this.accel = 0; this.turn = 0; this.lean = 0; this.bank = 0; this.ikOn = true;
  }
  // Riding: the horse moves the player; here only the body is animated and seated.
  rideUpdate(dt) {
    this.state = 'ride'; this.grounded = true; this.swimming = false; this.wading = 0; this.depth = 0;
    if (this.gltf) this.mounted.ride(dt);
  }
  spawnNearOrigin() {
    const sp = this.terrain.hf.plan().spawn; if (sp) { this.pos.set(sp.x, this.terrain.height(sp.x, sp.z), sp.z); return; }
    for (let r = 0; r < 800; r += 8) for (let a = 0; a < 6.28; a += .6) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.terrain.height(x, z);
      if (h > 4 && h < 40 && this.terrain.slopeAt(x, z) < .2) { this.pos.set(x, h, z); return; }
    }
    this.pos.set(0, this.terrain.height(0, 0), 0);
  }
  update(dt, input, camYaw) {
    const T = this.terrain, want = new THREE.Vector3(input.x, 0, input.z);
    const ground = T.height(this.pos.x, this.pos.z), depth = Math.max(0, this.waterLevel - ground), wading = depth > .1 ? Math.min(1, depth / 1.0) : 0; this.wading = wading; this.depth = depth;
    const swimT = depth > 1.15 ? 1 : 0; this.swim += (swimT - this.swim) * Math.min(1, dt * 6); const swimming = this.swim > .5; this.swimming = swimming;
    let target = 0, yawTarget = this.yaw;
    if (want.lengthSq() > 0) {
      want.normalize().applyAxisAngle(UP, camYaw);
      target = swimming ? (input.gait === 'run' ? 2.5 : 1.5) : (this.gaits[input.gait] || this.gaits.jog) * (1 - Math.min(.55, depth * .45));
      yawTarget = Math.atan2(want.x, want.z);
    }
    const prevYaw = this.yaw; this.yaw = lerpAngle(this.yaw, yawTarget, 1 - Math.exp(-(this.speed > 3.5 ? 9 : 13) * dt));
    this.turn += (angleDiff(this.yaw, prevYaw) / Math.max(dt, 1e-3) - this.turn) * Math.min(1, dt * 10);
    const acc = this.grounded ? (target > this.speed ? 7 : 11) : 3, prevSpeed = this.speed;
    this.speed += (target - this.speed) * (1 - Math.exp(-acc * dt));
    this.accel += ((this.speed - prevSpeed) / Math.max(dt, 1e-3) - this.accel) * Math.min(1, dt * 8);
    const dirv = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), old = this.pos.clone();
    this.pos.x += dirv.x * this.speed * dt; this.pos.z += dirv.z * this.speed * dt;
    if (depth > .12) {                                             // river current pushes you downstream
      const rv = T.riverAt(this.pos.x, this.pos.z), push = rv.t * (.9 + .7 * Math.min(1, depth)) * (swimming ? 1.3 : 1);
      this.pos.x += rv.fx * push * dt; this.pos.z += rv.fz * push * dt; this.current = push;
    } else this.current = 0;
    const newGround = T.height(this.pos.x, this.pos.z), rise = newGround - ground;
    if (this.grounded && rise > Math.max(.06, this.speed * dt * 1.2)) { this.pos.x = old.x; this.pos.z = old.z; this.speed *= .5; }     // too steep
    T.pushOut(this.pos, .32);
    const g = T.height(this.pos.x, this.pos.z);
    if (this.grounded && input.jump && wading < .6 && !swimming) { this.vel.y = 6.6; this.grounded = false; }
    if (swimming) {                                                // float with the head above water
      this.grounded = true; this.vel.y = 0; const bob = Math.sin(performance.now() * .0022) * .045;
      this.pos.y += (this.waterLevel - (this.gltf ? .03 : .92) + bob - this.pos.y) * (1 - Math.exp(-8 * dt));      // prone crawl floats with the back at the surface
    } else if (!this.grounded) { this.vel.y -= 19 * dt; this.pos.y += this.vel.y * dt; if (this.pos.y <= g && this.vel.y <= 0) { this.pos.y = g; this.vel.y = 0; this.grounded = true; } }
    else { this.pos.y += (g - this.pos.y) * (1 - Math.exp(-30 * dt)); if (this.pos.y < g - .3) this.pos.y = g; if (g < this.pos.y - .35) this.grounded = false; }

    // animation: data-driven state graph (config/graph.json, edited in the Studio)
    this.graph.params.speed = this.speed; this.graph.params.grounded = this.grounded ? 1 : 0; this.graph.params.swim = swimming ? 1 : 0;
    this.graph.update(dt); this.state = this.graph.state;

    // additive layer: lean into speed/acceleration, bank into turns
    const leanT = Math.max(-.12, Math.min(.35, this.speed * (this.gltf ? .02 : .028) + this.accel * .012)), bankT = Math.max(-.18, Math.min(.18, -this.turn * this.speed * .012));
    this.lean += (leanT - this.lean) * Math.min(1, dt * 8); this.bank += (bankT - this.bank) * Math.min(1, dt * 8);
    const root = this.rig.root;
    if (this.gltf) {
      this.anim.swimIdle = swimming && this.speed < .3;
      if (this.grounded && !swimming) for (const b of this.gltf.partBones) { b.spine_02?.rotateX(this.lean * .5); b.spine_03?.rotateX(this.lean * .4); b.pelvis?.rotateZ(this.bank * .4); b.spine_02?.rotateZ(this.bank * .4); }
      root.position.copy(this.pos); root.position.y -= swimming ? 0 : wading * .2; root.rotation.y = this.yaw; root.updateMatrixWorld(true);
      if (this.ikOn && this.swim < .3) this.plantFeetGltf();
      this.footsteps();
    } else {
      const b = this.rig.bones;
      if (this.grounded && !swimming) { b.spine.rotateX(this.lean * .55); b.chest.rotateX(this.lean * .45); b.hips.rotateZ(this.bank * .5); b.spine.rotateZ(this.bank * .5); b.head.rotateX(-this.lean * .5); }
      root.position.copy(this.pos); root.position.y -= swimming ? 0 : wading * .25; root.rotation.y = this.yaw; root.updateMatrixWorld(true);
      if (this.ikOn && this.swim < .3) this.plantFeet();
    }
    return wading;
  }
  // glTF version: every part (body, clothes, hair) has its own copy of the skeleton, so the same solve is applied to each.
  plantFeetGltf() {
    const T = this.terrain, base = this.gltf.partBones[0], standing = this.grounded && this.speed < .5, v = new THREE.Vector3(), fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (!this._ankleSet && this.speed < .1) { base.foot_l.getWorldPosition(v); this.ankle = Math.max(.05, v.y - this.rig.root.position.y); this._ankleSet = true; }
    for (const s of ['l', 'r']) {
      base['foot_' + s].getWorldPosition(v);
      const gy = T.height(v.x, v.z) + this.ankle - this.wading * .2; let ty = standing ? gy : Math.max(v.y, gy); ty = Math.max(v.y - .3, Math.min(v.y + .3, ty));
      if (Math.abs(ty - v.y) <= .004) continue;
      const target = new THREE.Vector3(v.x, ty, v.z);
      for (const pb of this.gltf.partBones) {
        const chain = [pb['thigh_' + s], pb['calf_' + s], pb['foot_' + s]]; if (!chain[0] || !chain[2]) continue;
        const pole = chain[0].getWorldPosition(new THREE.Vector3()).add(fwd); solveTwoBone(chain, target, pole);
      }
      this.rig.root.updateMatrixWorld(true);
    }
  }
  // Footstep events from the lower-foot switch (the glTF clips carry no event markers).
  footsteps() {
    if (!this.grounded || this.swimming || this.speed < .4) { this._low = null; return; }
    const b = this.gltf.partBones[0], l = b.foot_l.getWorldPosition(new THREE.Vector3()).y, r = b.foot_r.getWorldPosition(new THREE.Vector3()).y, low = l < r ? 'l' : 'r';
    if (this._low && low !== this._low && Math.abs(l - r) > .02) this.onFootstep && this.onFootstep('footstep_' + low, this.wading);
    this._low = low;
  }
  // Keeps both feet on the terrain (no sinking into slopes, planted feet when standing).
  plantFeet() {
    const T = this.terrain, standing = this.grounded && this.speed < .5, v = new THREE.Vector3();
    for (const side of ['footL', 'footR']) {
      this.rig.bones[side].getWorldPosition(v);
      const gy = T.height(v.x, v.z) + ANKLE - this.wading * .25;
      let ty = standing ? gy : Math.max(v.y, gy);
      ty = Math.max(v.y - .3, Math.min(v.y + .3, ty));
      if (Math.abs(ty - v.y) > .004) { solveHandle(this.rig, side, new THREE.Vector3(v.x, ty, v.z)); this.rig.root.updateMatrixWorld(true); }
    }
  }
}
function angleDiff(a, b) { return ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }
function lerpAngle(a, b, t) { return a + angleDiff(b, a) * t; }
