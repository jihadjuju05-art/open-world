// Melee combat: light/heavy sword chains, block with a parry window, i-frame dodge, stamina and health, hit-stop and screen feedback.
// Hits are detected against the real bone positions of the target (head / torso / pelvis / legs / arms spheres) by sweeping the blade segment
// taken from the sword mesh, only during the active part of each animation. Enemies (bandits) use exactly the same rules as the player.
import * as THREE from 'three';
import { GltfBody } from './character.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return d; };

// Attack data. win = active fraction of the clip, chain = fraction from which the next input is accepted, endAt = fraction where it ends.
export const LIGHT = [
  { clip: 'Sword_Regular_A', rate: .85, win: [.3, .62], dmg: 16, cost: 9, chain: .5, endAt: .95 },
  { clip: 'Sword_Regular_B', rate: .85, win: [.3, .62], dmg: 18, cost: 9, chain: .5, endAt: .95 },
  { clip: 'Sword_Regular_C', rate: 1.35, win: [.1, .27], dmg: 26, cost: 13, chain: .3, endAt: .5, heavy: true },
];
export const HEAVY = { clip: 'Sword_Attack', rate: .95, win: [.36, .56], dmg: 40, cost: 24, chain: 1, endAt: .88, heavy: true };
// Every number the combat feel depends on lives here so the Studio can edit it (config/combat.json) without touching code.
export const TUNING = {
  player: { hp: 100, stamina: 100, regen: 24, regenBlock: 9, regenDelay: 1 },
  dodge: { speed: 7.5, iframes: .5, cost: 16, rate: 1.45, end: .82 },
  block: { parry: .25, hold: .38, rate: 2.2, lightCost: .8, heavyCost: 1.3, chip: .1 },
  stagger: { light: .35, heavy: .8 },
  enemy: { hp: 55, dmg: .6, bossHp: 260, bossDmg: .95, aggro: 20, reach: 1.95 },
};
export const DEFAULT_ATTACKS = JSON.parse(JSON.stringify({ light: LIGHT, heavy: HEAVY }));
export function applyTuning(t) {
  if (!t) return; for (const k of Object.keys(TUNING)) if (t[k]) Object.assign(TUNING[k], t[k]);
  if (t.light) t.light.forEach((a, i) => LIGHT[i] && Object.assign(LIGHT[i], a)); if (t.heavy) Object.assign(HEAVY, t.heavy);
}
export const currentTuning = () => JSON.parse(JSON.stringify({ ...TUNING, light: LIGHT, heavy: HEAVY }));
export const EMOTES = [['Saludar', 'Interact', false], ['Bailar', 'Dance_Loop', true], ['Asentir', 'Yes', false], ['Brazos cruzados', 'Idle_FoldArms_Loop', true], ['Sentarse', 'Sitting_Idle_Loop', true], ['Farolillo', 'Idle_Lantern_Loop', true]];

// Distance from point p to segment ab.
const segPt = (a, b, p, tmp = new V3()) => { const ab = tmp.subVectors(b, a), t = clamp(ab.dot(new V3().subVectors(p, a)) / (ab.lengthSq() || 1), 0, 1); return new V3().copy(a).addScaledVector(ab, t).distanceTo(p); };

// Body hit spheres from the live skeleton (world space). scale = character scale.
const PARTS = [['Head', .17, 'head', 1.6], ['spine_03', .25, 'torso', 1], ['spine_01', .22, 'torso', 1], ['pelvis', .2, 'legs', .9], ['calf_l', .12, 'legs', .8], ['calf_r', .12, 'legs', .8], ['lowerarm_l', .08, 'arm', .8], ['lowerarm_r', .08, 'arm', .8]];
export function bodySpheres(body, scale = .92) {
  const out = []; for (const [bone, r, part, mult] of PARTS) { const b = body.bones[bone]; if (!b) continue; b.updateWorldMatrix(true, false); out.push({ c: b.getWorldPosition(new V3()), r: r * scale, part, mult }); } return out;
}
// Sweep the blade of `body` against a list of spheres; returns the first hit { part, mult, point } or null.
export function bladeHit(body, spheres, a = new V3(), b = new V3()) {
  if (!body.swordSegment(a, b)) return null; let best = null;
  for (const s of spheres) { const d = segPt(a, b, s.c); if (d < s.r + .04 && (!best || d < best.d)) best = { d, part: s.part, mult: s.mult, point: s.c }; }
  return best;
}

// Forgiving arc test used when the blade segment just misses: the target must be inside a short cone in front of the attacker.
export function arcHit(from, yaw, spheres, reach = 2.15, half = .62) {
  let best = null; for (const s of spheres) { const dx = s.c.x - from.x, dz = s.c.z - from.z, d = Math.hypot(dx, dz); if (d > reach + s.r) continue; const a = Math.abs(angDiff(Math.atan2(dx, dz), yaw)); if (a < half && (s.part === 'torso' || s.part === 'head') && (!best || d < best.d)) best = { d, part: s.part, mult: s.mult, point: s.c }; }
  return best;
}

export class PlayerCombat {
  constructor({ player, terrain, getTargets, onEvent }) {
    Object.assign(this, { player, terrain, getTargets, onEvent }); this.reset(); this.drawn = false; this.shake = 0; this.hitstop = 0; this.flash = 0; this.buffer = null; this.lmb = null; this.emote = null; this.alive = true; this.kills = 0;
  }
  reset() { this.hp = this.maxHp = TUNING.player.hp; this.stamina = this.maxStamina = TUNING.player.stamina; this.state = 'free'; this.t = 0; this.combo = 0; this.hitSet = new Set(); this.iframes = 0; this.blockT = 0; this.blocking = false; this.deadT = 0; this.stagT = 0; this.regenDelay = 0; }
  get body() { return this.player.gltf; }
  get busy() { return this.state !== 'free' && this.state !== 'block'; }
  moveScale() { return this.state === 'free' ? (this.emote && !this.emote.loop ? .4 : 1) : this.state === 'block' ? .45 : 0; }
  forward() { return new V3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw)); }
  // ---- inputs (called from main.js) ----
  toggleDraw() { if (this.busy || !this.alive || this.player.mounted) return; this.setDrawn(!this.drawn); }
  setDrawn(on) { this.drawn = on; this.body?.setDrawn(on); this.cancelEmote(); }
  attackDown() { if (!this.alive || this.player.mounted) return; this.lmb = { t: 0, fired: false }; if (!this.drawn && !this.busy) this.setDrawn(true); }
  attackUp() { const l = this.lmb; this.lmb = null; if (l && !l.fired) this.lightAttack(); }
  lightAttack() {
    if (!this.alive || this.player.mounted || !this.drawn) return;
    if (this.state === 'attack') { if (this.body.actionProgress() >= .28) this.buffer = 'light'; return; }
    if (this.busy) return; this.startAttack(LIGHT[this.combo % LIGHT.length]);
  }
  heavyAttack() { if (!this.alive || !this.drawn || this.busy) return; this.startAttack(HEAVY, true); }
  blockDown() { if (!this.alive || this.player.mounted) return; if (!this.drawn && !this.busy) this.setDrawn(true); this.blocking = true; }
  blockUp() { this.blocking = false; }
  dodge(dir) {
    if (!this.alive || this.player.mounted || this.state === 'stagger' || this.state === 'dodge' || this.stamina < TUNING.dodge.cost) return;
    this.cancelEmote(); this.stamina -= TUNING.dodge.cost; this.regenDelay = .9; this.state = 'dodge'; this.t = 0; this.iframes = TUNING.dodge.iframes; this.dodgeDir = dir && dir.lengthSq() > .01 ? dir.clone().normalize() : this.forward().multiplyScalar(-1);
    this.player.yaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z); this.body.startAction('Roll', { rate: TUNING.dodge.rate, fade: .06 }); this.onEvent?.('dodge');
  }
  playEmote(i) { const e = EMOTES[i]; if (!e || this.busy || !this.alive || this.player.mounted) return; this.emote = { clip: e[1], loop: e[2] }; this.body.startAction(e[1], { loop: e[2], fade: .2 }); }
  cancelEmote() { if (this.emote) { this.emote = null; if (this.state === 'free') this.body?.endAction(); } }
  // ---- attacks ----
  startAttack(spec, heavy = false) {
    if (this.stamina < spec.cost) { this.onEvent?.('tired'); return; }
    this.cancelEmote(); this.stamina -= spec.cost; this.regenDelay = 1; this.state = 'attack'; this.t = 0; this.spec = spec; this.hitSet.clear(); this.buffer = null;
    if (!heavy) this.combo = (this.combo + 1) % LIGHT.length; else this.combo = 0;
    const tgt = this.lockT = this.nearestTarget(5.5, 1.05); if (tgt) this.player.yaw = Math.atan2(tgt.pos.x - this.player.pos.x, tgt.pos.z - this.player.pos.z);       // soft lock-on
    else if (this.camYaw !== undefined) this.player.yaw = this.camYaw + Math.PI;
    this.body.startAction(spec.clip, { rate: spec.rate, fade: .07 }); this.onEvent?.('swing', spec);
  }
  nearestTarget(range, cone) {
    let best = null, bd = range, P = this.player.pos, f = this.camYaw !== undefined ? this.camYaw + Math.PI : this.player.yaw;
    for (const t of this.getTargets()) { if (t.dead) continue; const dx = t.pos.x - P.x, dz = t.pos.z - P.z, d = Math.hypot(dx, dz); if (d < bd && Math.abs(angDiff(Math.atan2(dx, dz), f)) < cone) { best = t; bd = d; } }
    return best;
  }
  // ---- being hit ----
  // info: { dmg, heavy, from: Vector3 (attacker position), attacker }.  Returns 'hit' | 'blocked' | 'parried' | 'dodged' | 'dead'.
  takeHit(info) {
    if (!this.alive) return 'dead'; if (this.iframes > 0) return 'dodged';
    const toA = Math.atan2(info.from.x - this.player.pos.x, info.from.z - this.player.pos.z), facing = Math.abs(angDiff(toA, this.player.yaw)) < 1.25;
    if (this.state === 'block' && facing) {
      if (this.blockT < TUNING.block.parry) { info.attacker?.stagger?.(true); this.onEvent?.('parry'); this.hitstop = .12; this.shake = .5; return 'parried'; }
      const cost = info.dmg * (info.heavy ? TUNING.block.heavyCost : TUNING.block.lightCost); this.stamina -= cost; this.regenDelay = 1.2; this.hp -= info.dmg * TUNING.block.chip; this.shake = .25; this.onEvent?.('block');
      if (this.stamina <= 0) { this.stamina = 0; this.enterStagger(true); this.onEvent?.('guardbreak'); } return 'blocked';
    }
    this.hp -= info.dmg; this.flash = 1; this.shake = info.heavy ? .8 : .45; this.hitstop = .07; this.regenDelay = 2; this.onEvent?.('hurt', info);
    if (this.hp <= 0) { this.die(); return 'dead'; }
    this.enterStagger(!!info.heavy); return 'hit';
  }
  enterStagger(heavy) { this.cancelEmote(); this.state = 'stagger'; this.t = 0; this.stagT = heavy ? TUNING.stagger.heavy : TUNING.stagger.light; this.buffer = null; this.body.startAction(heavy ? 'Hit_Knockback' : 'Hit_Chest', { rate: heavy ? 1 : 1, fade: .05 }); }
  die() { this.alive = false; this.hp = 0; this.state = 'dead'; this.deadT = 0; this.body.startAction('Death01', { rate: 1, fade: .1 }); this.onEvent?.('died'); }
  respawn(pos) { this.reset(); this.alive = true; this.body.endAction(); if (pos) { this.player.pos.set(pos.x, this.terrain.height(pos.x, pos.z), pos.z); } this.onEvent?.('respawn'); }
  // ---- per-frame ----
  update(dt, input, camYaw) {
    this.camYaw = camYaw; if (!this.player.gltf) return;
    this.shake = Math.max(0, this.shake - dt * 3); this.flash = Math.max(0, this.flash - dt * 2.5); this.hitstop = Math.max(0, this.hitstop - dt); this.iframes = Math.max(0, this.iframes - dt);
    if (this.lmb) { this.lmb.t += dt; if (!this.lmb.fired && this.lmb.t > .22) { this.lmb.fired = true; this.heavyAttack(); } }
    this.regenDelay -= dt; if (this.alive && this.regenDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + (this.state === 'block' ? TUNING.player.regenBlock : TUNING.player.regen) * dt);
    if (this.alive && this.state === 'free' && this.regenDelay < -4) this.hp = Math.min(this.maxHp, this.hp + 2 * dt);
    const b = this.body; this.t += dt;
    switch (this.state) {
      case 'free':
        if (this.blocking && this.drawn && this.stamina > 4) { this.state = 'block'; this.blockT = 0; this.cancelEmote(); b.startAction('Sword_Block', { rate: TUNING.block.rate, fade: .06 }); }
        else if (this.emote) { /* emote clip keeps playing */ }
        else if (this.drawn && b.action) b.endAction();
        break;
      case 'block': {
        this.blockT += dt; if (b.actionProgress() > TUNING.block.hold) for (const m of b.mixers) m.timeScale = 0;      // hold the guard pose
        if (!this.blocking || this.stamina <= 0) { this.state = 'free'; b.endAction(); }
        break; }
      case 'attack': {
        const p = b.actionProgress(), s = this.spec;
        const lk = this.lockT; if (lk && !lk.dead && p < s.win[1]) { const P = this.player.pos, dx = lk.pos.x - P.x, dz = lk.pos.z - P.z, d = Math.hypot(dx, dz); if (d > 1.55 && d < 5) { const st = Math.min(d - 1.5, 5 * dt); P.x += dx / d * st; P.z += dz / d * st; this.terrain.pushOut(P, .4); } if (d > .1 && p < s.win[0]) this.player.yaw = Math.atan2(dx, dz); }   // step into the strike (attack magnetism)
        if (p >= s.win[0] && p <= s.win[1]) this.sweep(s);
        if (this.buffer && p >= s.chain) { const n = LIGHT[this.combo % LIGHT.length]; this.buffer = null; if (this.stamina >= n.cost) { this.state = 'free'; this.startAttack(n); break; } }
        if (p >= s.endAt) { this.state = 'free'; this.buffer = null; b.endAction(); }
        break; }
      case 'dodge': {
        const p = b.actionProgress(), sp = TUNING.dodge.speed * (1 - p * .7), P = this.player.pos; P.x += this.dodgeDir.x * sp * dt; P.z += this.dodgeDir.z * sp * dt; this.terrain.pushOut(P, .4);
        if (p >= TUNING.dodge.end) { this.state = 'free'; b.endAction(); }
        break; }
      case 'stagger': if (this.t >= this.stagT) { this.state = 'free'; b.endAction(); } break;
      case 'dead': this.deadT += dt; if (this.deadT > 5) this.onEvent?.('needRespawn'); break;
    }
  }
  sweep(spec) {
    const a = new V3(), c = new V3(); const targets = this.getTargets();
    for (const t of targets) {
      if (t.dead || this.hitSet.has(t.id)) continue; const sp = t.spheres?.(); if (!sp) continue; const h = bladeHit(this.body, sp, a, c) || arcHit(this.player.pos, this.player.yaw, sp); if (!h) continue;
      this.hitSet.add(t.id); const dmg = Math.round(spec.dmg * h.mult); const res = t.takeHit({ dmg, heavy: !!spec.heavy, from: this.player.pos.clone(), attacker: this.player, part: h.part, attackerId: 'me' });
      if (res === 'hit' || res === 'dead') { this.hitstop = spec.heavy ? .1 : .06; this.shake = Math.max(this.shake, spec.heavy ? .5 : .25); this.onEvent?.('hitdone', { target: t, part: h.part, dmg, res }); if (res === 'dead') this.kills++; }
      else if (res === 'blocked' || res === 'parried') { this.onEvent?.('blocked'); if (res === 'parried') this.enterStagger(true); }
    }
  }
}
