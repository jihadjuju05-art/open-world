// Chapter 2 boss: "Kaelith, la Segadora" - a stylised scythe warrior (Stylized Female Character, RetroStyleGames) with three phases.
// Same interface as Bandit so EnemyManager / PlayerCombat / Story treat it as any other enemy.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { HEAVY, TUNING, arcHit } from './combat.js';

const V3 = THREE.Vector3, D = 'assets/boss/';
const angDiff = (a, b) => { let d = a - b; d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return d; };
export const VALK_NAME = 'Kaelith, la Segadora';

// ---- assets (loaded once, on demand)
let ASSETS = null, PENDING = null;
export function loadValkyrie() {
  if (ASSETS) return Promise.resolve(ASSETS); if (PENDING) return PENDING;
  const tl = new THREE.TextureLoader();
  const tex = (n, srgb) => { const t = tl.load(D + n + '.jpg'); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  PENDING = new GLTFLoader().loadAsync(D + 'valkyrie.glb').then(g => {
    const mk = (n, o = {}) => { const m = new THREE.MeshStandardMaterial({ map: tex(n + '_BaseColor', true), normalMap: tex(n + '_Normal', false), roughness: o.r ?? .55, metalness: o.m ?? 0, envMapIntensity: .9 }); if (o.em) { m.emissiveMap = tex(n + '_Emissive', true); m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = o.em; } return m; };
    const mats = { M_Character_F_Body: mk('Body', { r: .6 }), M_Character_F_Outfit: mk('Outfit', { r: .65 }), M_Character_F_Helmet: mk('Helmet', { r: .35, m: .5, em: .8 }), M_Character_F_Shoes: mk('Shoes', { r: .5, m: .3, em: .8 }), M_Character_F_Tail_01: mk('Tail', { r: .6 }), M_Character_F_Weapon: mk('Weapon', { r: .3, m: .55, em: 1.1 }),
      M_Eyes_Transparent: new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .12, roughness: .05 }) };
    let rest = new THREE.Vector3(); g.scene.traverse(o => { if (o.name === 'rootx') rest = o.position.clone(); });
    for (const c of g.animations) for (const t of c.tracks) if (/^rootx\.position$/.test(t.name)) {       // root motion is in cm and drifts: keep only the bob, in metres, centred on the bind pose
      const v = t.values, n = v.length / 3; for (let k = 0; k < 3; k++) { let m = 0; for (let i = 0; i < n; i++) m += v[i * 3 + k]; m /= n; for (let i = 0; i < n; i++) v[i * 3 + k] = rest.getComponent(k) + (v[i * 3 + k] - m) * .01; }
    }
    ASSETS = { scene: g.scene, clips: g.animations, mats }; return ASSETS;
  });
  return PENDING;
}

// ---- ground ring used to telegraph the shockwave
function ringMesh() { const m = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 48), new THREE.MeshBasicMaterial({ color: 0x40f5e6, transparent: true, opacity: .0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; }

export class Valkyrie {
  constructor(mgr, camp, opts = {}) {
    this.mgr = mgr; this.camp = camp || { id: 997, x: 0, z: 0, type: 4 }; this.puppet = false; this.boss = true; this.valk = true; this.id = 'valk'; this.name = VALK_NAME; this.dead = false; this.remove = false; this.aggro = !!opts.aggro; this.fade = 1;
    const A = ASSETS; this.root = new THREE.Group(); this.holder = new THREE.Group(); this.model = SkeletonUtils.clone(A.scene);
    this.model.scale.setScalar(112); this.model.rotation.x = -Math.PI / 2;      // the FBX import left the armature at 0.01 and lying down
    this.holder.add(this.model); this.root.add(this.holder);
    this.cloned = new Map();      // cloned materials so a flash does not touch the shared ones
    this.model.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; o.castShadow = !/Eyes_Transp/.test(o.name); o.receiveShadow = false; const src = Array.isArray(o.material) ? o.material[0] : o.material, base = A.mats[src?.name] || A.mats.M_Character_F_Body; let m = this.cloned.get(base); if (!m) { m = base.clone(); this.cloned.set(base, m); } o.material = m; if (/Brows|Lashes/.test(o.name)) { o.material = m.clone(); o.material.map = null; o.material.color.set(0x2a1418); } });
    mgr.scene.add(this.root); this.mixer = new THREE.AnimationMixer(this.model); this.acts = {}; for (const c of A.clips) this.acts[c.name] = this.mixer.clipAction(c); this.cur = null;
    this.maxHp = Math.round(TUNING.enemy.bossHp * 2.4); this.hp = this.maxHp; this.pos = new V3(); this.yaw = 0; this.state = 'idle'; this.t = 1; this.cool = 2; this.hitSet = new Set(); this.phase = 1; this.flinch = 0; this.flash = 0; this.strafe = 1; this.blinkCd = 6; this.waveCd = 5; this.combo = 0;
    this.ring = ringMesh(); this.ring.visible = false; mgr.scene.add(this.ring);
    this.bar = document.createElement('div'); this.bar.className = 'ebar'; this.bar.innerHTML = '<span></span><i></i>'; this.bar.firstChild.textContent = this.name; mgr.tagRoot.append(this.bar); this.hpFill = this.bar.lastChild; this.play('Idle');
  }
  // ---- animation helpers
  play(name, fade = .2, rate = 1, once = false) {
    const a = this.acts[name]; if (!a) return; if (this.cur === a && !once) { a.timeScale = rate; return; }
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = rate; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false); else a.fadeIn(fade); a.play(); this.cur = a; this.curName = name;
  }
  progress() { const a = this.cur; const d = a?.getClip().duration || 1; return Math.min(1, a.time / d); }
  spheres() {
    if (this.dead) return null; const p = this.pos, k = 1.12; const S = (y, r, part, mult) => ({ c: new V3(p.x, p.y + y * k, p.z), r: r * k, part, mult }); return [S(1.62, .22, 'head', 1.6), S(1.3, .34, 'torso', 1), S(.95, .3, 'torso', 1), S(.5, .28, 'legs', .8)];
  }
  // ---- receiving damage
  takeHit(info) {
    if (this.dead) return 'dead'; this.aggro = true; this.hp -= info.dmg * (this.state === 'attack' || this.state === 'wave' ? .85 : 1); this.mgr.onSfx?.('hit', this.pos); this.flash = 1; this.hpFlash = 1;
    if (this.hp <= 0) { this.die(); return 'dead'; }
    if ((info.heavy || info.dmg > 30) && !['attack', 'wave', 'blink'].includes(this.state) && Math.random() < .45) { this.flinch = .35; this.state = 'fight'; this.t = .5; this.hitSet.clear(); }
    return 'hit';
  }
  die() { this.dead = true; this.state = 'dead'; this.t = 0; this.ring.visible = false; this.play('Idle', .2, .3); this.mgr.onKill?.(this); }
  // ---- movement (same helpers as the bandits)
  turn(x, z, dt, rate) { const a = angDiff(Math.atan2(x - this.pos.x, z - this.pos.z), this.yaw); this.yaw += a * Math.min(1, dt * rate); }
  move(dx, dz, speed, dt) { const T = this.mgr.terrain, nx = this.pos.x + dx * speed * dt, nz = this.pos.z + dz * speed * dt; if (T.height(nx, nz) > -.5) { this.pos.x = nx; this.pos.z = nz; } T.pushOut(this.pos, .55); }
  hurtPlayer(pc, dmg, heavy = true) { if (!pc.alive) return; pc.takeHit({ dmg: Math.round(dmg * TUNING.enemy.bossDmg), heavy, from: this.pos.clone(), attacker: this }); }
  // ---- AI
  update(dt, P, pc) {
    const T = this.mgr.terrain, d = Math.hypot(P.x - this.pos.x, P.z - this.pos.z); this.t -= dt; this.cool -= dt; this.blinkCd -= dt; this.waveCd -= dt; this.flinch = Math.max(0, this.flinch - dt); this.flash = Math.max(0, this.flash - dt * 4);
    const ratio = this.hp / this.maxHp; if (!this.dead) { const ph = ratio < .35 ? 3 : ratio < .7 ? 2 : 1; if (ph > this.phase) { this.phase = ph; this.onPhase(); } }
    if (this.dead) { this.deadT = (this.deadT || 0) + dt; this.fade = Math.max(0, this.fade - (this.deadT > 3 ? dt / 5 : 0)); if (this.deadT > 9) this.remove = true; this.sync(dt); return; }
    if (this.aggro && !pc.alive) { this.aggro = false; this.state = 'idle'; this.hp = this.maxHp; this.phase = 1; }
    const speedK = [1, 1.18, 1.35][this.phase - 1];
    switch (this.state) {
      case 'idle': this.play('Idle'); if (this.aggro) this.state = 'chase'; else if (d < 22 && pc.alive) this.aggro = true; break;
      case 'chase': {
        this.turn(P.x, P.z, dt, 8);
        if (d > 3.4) { const dx = (P.x - this.pos.x) / d, dz = (P.z - this.pos.z) / d; this.move(dx, dz, (d > 10 ? 8.5 : 5.6) * speedK, dt); this.play(d > 8 ? 'Run' : 'Run', .2, d > 10 ? 1.15 : .85); }
        else { this.state = 'fight'; this.t = .35; this.strafe = Math.random() < .5 ? 1 : -1; } break; }
      case 'fight': {
        this.turn(P.x, P.z, dt, 9); const rd = (P.x - this.pos.x) / (d || 1), rz = (P.z - this.pos.z) / (d || 1);
        if (d > 6) { this.state = 'chase'; break; } this.move(-rz * this.strafe, rd * this.strafe, 1.6 * speedK, dt); if (d < 2.2) this.move(-rd, -rz, 1.4, dt); else if (d > 3.4) this.move(rd, rz, 1.6, dt);
        this.play(this.flinch > 0 ? 'CombatIdle' : 'CombatIdle', .2, 1);
        if (this.t <= 0 && this.flinch <= 0) this.choose(d, pc); break; }
      case 'attack': {
        const p = this.progress(), win = this.win; if (p < win[0]) this.turn(P.x, P.z, dt, 8);
        if (p < win[1] && d > 1.6 && d < 7) { const st = Math.min(d - 1.6, (this.lunge || 4) * dt); this.pos.x += (P.x - this.pos.x) / d * st; this.pos.z += (P.z - this.pos.z) / d * st; T.pushOut(this.pos, .55); }
        if (p >= win[0] && p <= win[1] && !this.hitSet.has('p') && pc.alive) { const h = arcHit(this.pos, this.yaw, pc.spheres(), 3.5, .95); if (h) { this.hitSet.add('p'); this.hurtPlayer(pc, this.dmg * h.mult, true); } }
        if (p >= .97) { if (this.combo > 0) { this.combo--; this.swing(1.3, 1); } else { this.state = 'fight'; this.t = [.5, .35, .2][this.phase - 1] + Math.random() * .4; this.cool = [1.6, 1.2, .8][this.phase - 1]; } } break; }
      case 'wave': {                                                   // telegraphed ground shockwave: rising ring, damage when it lands
        this.turn(P.x, P.z, dt, 3); const k = 1 - this.t / this.waveT; this.play('CombatIdle', .1, 1.4); this.ring.position.set(this.pos.x, T.height(this.pos.x, this.pos.z) + .08, this.pos.z);
        this.ring.material.opacity = k < .75 ? .25 + k * .5 : .9 * (1 - (k - .75) * 3); const r = k < .75 ? 5.6 : 5.6 + (k - .75) * 8; this.ring.scale.set(k < .75 ? 5.6 : r, k < .75 ? 5.6 : r, 1); this.setGlow(1 + k * 3);
        if (k >= .75 && !this.hitSet.has('w')) { this.hitSet.add('w'); if (d < 5.8 && pc.alive && pc.state !== 'dodge') this.hurtPlayer(pc, this.dmg * .9, true); this.mgr.onSfx?.('hit', this.pos); this.shake?.(); }
        if (this.t <= 0) { this.ring.visible = false; this.setGlow(1); this.state = 'fight'; this.t = .6; this.cool = 1.2; this.waveCd = [9, 7, 5][this.phase - 1]; } break; }
      case 'blink': {                                                  // phase 3: vanishes in a burst and reappears behind the player
        this.setGlow(3); if (this.t <= 0) { const a = Math.atan2(P.x - this.pos.x, P.z - this.pos.z) + Math.PI + (Math.random() - .5) * .6; this.pos.x = P.x - Math.sin(a) * 2.6; this.pos.z = P.z - Math.cos(a) * 2.6; T.pushOut(this.pos, .55); this.model.visible = true; this.yaw = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); this.setGlow(1); this.swing(1.5, 1, true); this.blinkCd = 8; } break; }
    }
    this.pos.y += (T.height(this.pos.x, this.pos.z) - this.pos.y) * Math.min(1, dt * 14);
    this.sync(dt);
  }
  get dmg() { return HEAVY.dmg * .9; }
  choose(d, pc) {
    if (this.phase >= 3 && this.blinkCd <= 0) { this.state = 'blink'; this.t = .45; this.model.visible = false; this.mgr.onSfx?.('hit', this.pos); return; }
    if (this.phase >= 2 && this.waveCd <= 0 && d < 7) { this.state = 'wave'; this.waveT = this.t = 1.35; this.hitSet.clear(); this.ring.visible = true; return; }
    if (this.cool > 0) { this.t = .3 + Math.random() * .4; if (Math.random() < .3) this.strafe *= -1; return; }
    if (d > 3.9) { this.swing(1.25, 1, false, 9); return; }
    this.combo = this.phase >= 2 ? (Math.random() < .55 ? 1 : 0) + (this.phase >= 3 && Math.random() < .5 ? 1 : 0) : 0; this.swing(1.05 + this.phase * .08, 1);
  }
  swing(rate, _n, _blink, lunge = 4) { this.state = 'attack'; this.hitSet.clear(); this.win = [.28, .6]; this.lunge = lunge; this.play('Attack', .08, rate, true); this.mgr.onSfx?.('swing', this.pos); }
  onPhase() { this.flash = 1.6; this.flinch = 0; this.cool = 0; if (this.state !== 'wave') { this.state = 'wave'; this.waveT = this.t = 1.35; this.hitSet.clear(); this.ring.visible = true; } this.mgr.onPhase?.(this); }
  showAttack() { this.play('Attack', .08, .8, true); }
  burst() { this.burstT = 1.4; this.ring.visible = true; this.flash = 1.6; }          // cinematic shockwave
  idleTick(dt) { this.sync(dt); }
  setGlow(k) { for (const m of this.cloned.values()) if (m.emissiveMap) m.emissiveIntensity = (m.userData.e0 ??= m.emissiveIntensity) * k; }
  sync(dt) {
    if (this.burstT > 0) { this.burstT -= dt; const k = 1 - this.burstT / 1.4, T = this.mgr.terrain; this.ring.position.set(this.pos.x, T.height(this.pos.x, this.pos.z) + .08, this.pos.z); const rr = 1 + k * 14; this.ring.scale.set(rr, rr, 1); this.ring.material.opacity = .9 * (1 - k); if (this.burstT <= 0 && this.state !== 'wave') this.ring.visible = false; }
    this.mixer.update(dt); const r = this.root; r.position.copy(this.pos); r.rotation.y = this.yaw;
    if (this.dead) this.holder.rotation.x = -1.5 * Math.min(1, (this.deadT || 0) / .9) ** 2;
    else if (this.flinch > 0) { this.holder.rotation.x = -.35 * Math.sin(this.flinch / .35 * Math.PI); } else this.holder.rotation.x = 0;
    const f = this.flash; for (const m of this.cloned.values()) { if (m === this.cloned.get(ASSETS.mats.M_Eyes_Transparent)) continue; m.color.setRGB(1 + f * .5, 1 + f * .9, 1 + f * .9); }
    const cam = this.mgr.camera, p = new V3(this.pos.x, this.pos.y + 2.7, this.pos.z), dd = p.distanceTo(cam.position); p.project(cam);
    const show = !this.dead && (this.aggro || this.hp < this.maxHp) && p.z < 1 && dd < 60 && Math.abs(p.x) < 1.1; this.bar.style.display = show ? '' : 'none';
    if (show) { this.bar.style.left = ((p.x * .5 + .5) * innerWidth) + 'px'; this.bar.style.top = ((-p.y * .5 + .5) * innerHeight) + 'px'; this.hpFill.style.width = Math.max(0, this.hp / this.maxHp * 100) + '%'; }
    if (this.dead) { const k = Math.max(0, this.fade); this.model.traverse(o => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity ?? 1, k); } }); }
  }
  dispose() { this.mgr.scene.remove(this.root); this.mgr.scene.remove(this.ring); this.bar.remove(); }
  snap() { return { id: this.id, x: +this.pos.x.toFixed(2), z: +this.pos.z.toFixed(2), yaw: +this.yaw.toFixed(2), st: this.state, hp: +(Math.max(0, this.hp) / this.maxHp).toFixed(2), ac: '', dead: this.dead ? 1 : 0, c: this.camp.id, k: 99 }; }
}
