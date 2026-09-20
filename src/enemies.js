// Bandits: sword fighters with the same rules as the player (stamina-free but with telegraphed swings, blocking, staggering, dying).
// They live in camps (settlements of type 4) and only exist while the player is near.
import * as THREE from 'three';
import { GltfBody } from './character.js';
import { LIGHT, HEAVY, TUNING, bodySpheres, bladeHit, arcHit } from './combat.js';

const V3 = THREE.Vector3;
const angDiff = (a, b) => { let d = a - b; d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return d; };
const hh = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const NAMES = ['Bandido', 'Forajido', 'Salteador', 'Matón', 'Renegado'];

export class Bandit {
  constructor(mgr, camp, k, puppet = false, opts = {}) {
    this.puppet = puppet; this.boss = !!opts.boss; this.mgr = mgr; this.camp = camp; this.id = 'b' + camp.id + '_' + k; const seed = camp.id * 17 + k;
    const look = { outfit: 'peasant', hair: ['Buzzed', 'Long', 'SimpleParted'][Math.floor(hh(seed, 1) * 3)], beard: hh(seed, 2) < .6, skinTone: .3 + hh(seed, 3) * .5, hairColor: '#1e1510', tint: ['#4a3f38', '#3a3f4a', '#5a3a2e', '#2f3a30'][Math.floor(hh(seed, 4) * 4)], hat: hh(seed, 5) < .7, hatColor: '#26221e', scarf: true, scarfColor: '#7a2f2a', holster: true, rifle: false };
    if (this.boss) Object.assign(look, { outfit: 'peasant', tint: '#1e1e24', hat: true, hatColor: '#111114', scarf: true, scarfColor: '#5a1712', beard: true, hair: 'Long', hairColor: '#8a8a8a', skinTone: .35 });
    this.body = new GltfBody(mgr.assets, look); this.body.root.scale.setScalar(this.boss ? .99 : .92); mgr.scene.add(this.body.root); this.body.setDrawn(true);
    const a = hh(seed, 6) * 6.28, r = 3 + hh(seed, 7) * 5; this.pos = new V3(camp.x + Math.cos(a) * r, 0, camp.z + Math.sin(a) * r); this.pos.y = mgr.terrain.height(this.pos.x, this.pos.z);
    this.yaw = hh(seed, 8) * 6.28; this.name = this.boss ? 'Silas «El Cuervo»' : NAMES[Math.floor(hh(seed, 9) * NAMES.length)]; this.maxHp = this.boss ? TUNING.enemy.bossHp : TUNING.enemy.hp; this.hp = this.maxHp; this.state = 'idle'; this.t = 1 + hh(seed, 10) * 3; if (this.boss) { this.aggro = false; } this.dead = false; this.hitSet = new Set(); this.cool = 1; this.blockCd = 0; this.strafe = 1; this.target = null; this.aggro = false; this.fade = 1; this.walkTo = null;
    this.bar = document.createElement('div'); this.bar.className = 'ebar'; this.bar.innerHTML = '<span></span><i></i>'; this.bar.firstChild.textContent = this.name; mgr.tagRoot.append(this.bar); this.hpFill = this.bar.lastChild;
  }
  spheres() { return this.dead ? null : bodySpheres(this.body); }
  turn(x, z, dt, rate) { const a = angDiff(Math.atan2(x - this.pos.x, z - this.pos.z), this.yaw); this.yaw += a * Math.min(1, dt * rate); }
  // Obstacle avoidance: try the desired heading, then swing left/right until the point 1.4 m ahead is free.
  steer(dx, dz) {
    const T = this.mgr.terrain, base = Math.atan2(dx, dz), tmp = { x: 0, z: 0 };
    for (const off of [0, .6, -.6, 1.15, -1.15, 1.7, -1.7]) {
      const a = base + off, ax = Math.sin(a), az = Math.cos(a); tmp.x = this.pos.x + ax * 1.4; tmp.z = this.pos.z + az * 1.4; const bx = tmp.x, bz = tmp.z; T.pushOut(tmp, .5);
      if (Math.hypot(tmp.x - bx, tmp.z - bz) < .06 && T.height(bx, bz) > -.5) { this.lastSteer = off; return [ax, az]; }
    }
    return [dx, dz];
  }
  move(dx, dz, speed, dt) { const T = this.mgr.terrain, nx = this.pos.x + dx * speed * dt, nz = this.pos.z + dz * speed * dt; if (T.height(nx, nz) > -.5) { this.pos.x = nx; this.pos.z = nz; } T.pushOut(this.pos, .45); }
  // ---- receiving damage ----
  takeHit(info) {
    if (this.puppet) { this.mgr.onPuppetHit?.(this, info); return this.hp - info.dmg <= 0 ? 'dead' : 'hit'; }
    if (this.dead) return 'dead'; this.aggro = true;
    const toA = Math.atan2(info.from.x - this.pos.x, info.from.z - this.pos.z), facing = Math.abs(angDiff(toA, this.yaw)) < 1.2;
    if (this.state === 'block' && facing) { if (info.heavy) { this.stagger(true); this.body.startAction('Hit_Knockback', { fade: .05 }); this.hp -= info.dmg * .3; return 'blocked'; } this.hp -= info.dmg * .1; this.mgr.onSfx?.('block', this.pos); return 'blocked'; }
    this.hp -= info.dmg; this.mgr.onSfx?.('hit', this.pos); this.hpFlash = 1;
    if (this.hp <= 0) { this.die(); return 'dead'; }
    this.stagger(!!info.heavy || info.dmg > 30); return 'hit';
  }
  stagger(heavy) { this.state = 'stagger'; this.t = heavy ? .75 : .38; this.hitSet.clear(); this.body.startAction(heavy ? 'Hit_Knockback' : 'Hit_Chest', { fade: .05 }); }
  die() { this.dead = true; this.state = 'dead'; this.t = 0; this.body.startAction('Death01', { fade: .1 }); this.mgr.onKill?.(this); }
  // ---- AI ----
  // Puppets (clients in a co-op session) only follow the host's snapshots.
  applyNet(m) {
    this.tpos = this.tpos || new V3(); this.tpos.set(m.x, this.mgr.terrain.height(m.x, m.z), m.z); this.tyaw = m.yaw; this.net = m; this.lastNet = performance.now(); const hpNew = m.hp * this.maxHp; if (hpNew < this.hp - 1) this.hpFlash = 1; this.hp = hpNew;
    if (m.dead && !this.dead) { this.dead = true; this.body.startAction('Death01', { fade: .1 }); this.t = 0; }
  }
  updatePuppet(dt) {
    const m = this.net, b = this.body; if (!m || !this.tpos) { this.sync(dt); return; }
    const k = 1 - Math.exp(-10 * dt), moved = this.pos.distanceTo(this.tpos) / Math.max(dt, .001); this.pos.lerp(this.tpos, k); this.yaw += angDiff(this.tyaw, this.yaw) * k;
    if (!this.dead) {
      if (m.ac) { if (this.puppetAc !== m.ac) { this.puppetAc = m.ac; b.startAction(m.ac, { fade: .08, rate: m.ac.startsWith('Sword_Regular') ? .85 * .8 : m.ac === 'Sword_Attack' ? .95 * .8 : m.ac === 'Sword_Block' ? 2.2 : 1 }); } if (m.ac === 'Sword_Block' && b.actionProgress() > .38) for (const mx of b.mixers) mx.timeScale = 0; }
      else { if (this.puppetAc) { this.puppetAc = null; b.endAction(); } this.anim(moved > 4.5 ? 'Sprint_Loop' : moved > 2.2 ? 'Jog_Fwd_Loop' : moved > .5 ? 'Walk_Loop' : m.st === 'fight' ? 'Sword_Idle' : 'Idle_Loop', moved > 4.5 ? .8 : moved > 2.2 ? .75 : 1); }
    } else this.t -= dt;
    this.sync(dt);
  }
  update(dt, P, pc) {
    if (this.puppet) { this.updatePuppet(dt); return; }
    const T = this.mgr.terrain, d = Math.hypot(P.x - this.pos.x, P.z - this.pos.z), b = this.body; this.t -= dt; this.cool -= dt; this.blockCd -= dt;
    if (this.dead) { this.fade -= dt / 8; if (this.t < -6) { this.remove = true; } this.sync(dt); return; }
    if (!this.aggro && d < (this.boss ? 0 : TUNING.enemy.aggro) && pc.alive) this.aggro = true;
    if (this.aggro && (d > (this.boss ? 140 : 60) || !pc.alive)) { this.aggro = false; if (this.state !== 'stagger') this.state = 'idle'; this.hp = Math.min(this.maxHp, this.hp + 20); }
    switch (this.state) {
      case 'idle': case 'wander': {
        if (this.aggro) { this.state = 'chase'; break; }
        if (this.state === 'idle') { if (this.t <= 0) { const a = Math.random() * 6.28, r = Math.random() * 9; this.walkTo = { x: this.camp.x + Math.cos(a) * r, z: this.camp.z + Math.sin(a) * r }; this.state = 'wander'; this.t = 6; } this.anim('Idle_Loop'); }
        else { const dx = this.walkTo.x - this.pos.x, dz = this.walkTo.z - this.pos.z, L = Math.hypot(dx, dz); if (L < .8 || this.t <= 0) { this.state = 'idle'; this.t = 3 + Math.random() * 6; } else { this.turn(this.walkTo.x, this.walkTo.z, dt, 6); this.move(dx / L, dz / L, 1.3, dt); this.anim('Walk_Loop', 1.3 / .98); } }
        break; }
      case 'chase': {
        if (!this.aggro) { this.state = 'idle'; break; }
        this.turn(P.x, P.z, dt, 8);
        if (d > 3.1) { const [dx, dz] = this.steer((P.x - this.pos.x) / d, (P.z - this.pos.z) / d); this.move(dx, dz, d > 9 ? 5.6 : 3.6, dt); this.anim(d > 9 ? 'Sprint_Loop' : 'Jog_Fwd_Loop', d > 9 ? .8 : .75); }
        else { this.state = 'fight'; this.t = .3 + Math.random() * .5; this.strafe = Math.random() < .5 ? 1 : -1; }
        break; }
      case 'fight': {
        this.turn(P.x, P.z, dt, 9);
        const rd = (P.x - this.pos.x) / (d || 1), rz = (P.z - this.pos.z) / (d || 1);
        if (d > 4.4) { this.state = 'chase'; break; }
        // circle the player and keep the distance
        this.move(-rz * this.strafe, rd * this.strafe, .9, dt); if (d < 2.0) this.move(-rd, -rz, 1.2, dt); else if (d > 3.0) this.move(rd, rz, 1.2, dt); this.anim('Sword_Idle', 1);
        if (pc.state === 'attack' && d < 3.4 && this.blockCd <= 0 && Math.random() < dt * 3.5) { this.state = 'block'; this.t = .55 + Math.random() * .3; this.blockCd = 2.2; b.startAction('Sword_Block', { rate: 2.2, fade: .06 }); this.hold = false; break; }
        if (this.t <= 0) { if (this.cool <= 0 && d < 3.6) this.startAttack(); else { this.t = .4 + Math.random() * .6; if (Math.random() < .3) this.strafe *= -1; } }
        break; }
      case 'block': { if (b.actionProgress() > .38) for (const m of b.mixers) m.timeScale = 0; this.turn(P.x, P.z, dt, 9); if (this.t <= 0) { this.state = 'fight'; this.t = .3; b.endAction(); } break; }
      case 'attack': {
        const p = b.actionProgress(), s = this.spec; if (p < s.win[0]) this.turn(P.x, P.z, dt, 7);                     // tracks the player during the wind-up only
        if (p < s.win[1] && d > 1.5 && d < 5) { const st = Math.min(d - 1.45, 4 * dt); this.pos.x += (P.x - this.pos.x) / d * st; this.pos.z += (P.z - this.pos.z) / d * st; this.mgr.terrain.pushOut(this.pos, .45); }   // lunge
        if (p >= s.win[0] && p <= s.win[1] && pc.alive && !this.hitSet.has('p')) {
          const ps = pc.spheres(), h = bladeHit(b, ps) || arcHit(this.pos, this.yaw, ps, TUNING.enemy.reach, .5);
          if (h) { this.hitSet.add('p'); pc.takeHit({ dmg: Math.round(s.dmg * (this.boss ? TUNING.enemy.bossDmg : TUNING.enemy.dmg) * h.mult), heavy: !!s.heavy, from: this.pos.clone(), attacker: this }); }
        }
        if (p >= s.endAt) { this.state = 'fight'; this.t = .35 + Math.random() * .5; this.cool = 1.1 + Math.random() * .9; b.endAction(); }
        break; }
      case 'stagger': if (this.t <= 0) { this.state = 'fight'; this.t = .3; b.endAction(); } break;
    }
    this.pos.y += (T.height(this.pos.x, this.pos.z) - this.pos.y) * Math.min(1, dt * 14);
    this.sync(dt);
  }
  anim(name, rate = 1) { if (!this.body.action) this.body.play(name, .2, rate); }
  startAttack() { const heavy = Math.random() < (this.boss ? .45 : .3), spec = heavy ? HEAVY : LIGHT[Math.floor(Math.random() * 2)]; this.spec = spec; this.state = 'attack'; this.hitSet.clear(); this.body.startAction(spec.clip, { rate: spec.rate * .8, fade: .1 }); }
  sync(dt) {
    const r = this.body.root; r.position.copy(this.pos); r.rotation.y = this.yaw; this.body.update(dt);
    const cam = this.mgr.camera, p = new V3(this.pos.x, this.pos.y + 2.2, this.pos.z), d = p.distanceTo(cam.position); p.project(cam);
    const show = !this.dead && (this.aggro || this.hp < this.maxHp) && p.z < 1 && d < 40 && Math.abs(p.x) < 1.1; this.bar.style.display = show ? '' : 'none';
    if (show) { this.bar.style.left = ((p.x * .5 + .5) * innerWidth) + 'px'; this.bar.style.top = ((-p.y * .5 + .5) * innerHeight) + 'px'; this.hpFill.style.width = Math.max(0, this.hp / this.maxHp * 100) + '%'; }
  }
  dispose() { this.mgr.scene.remove(this.body.root); this.bar.remove(); }
  snap() { return { id: this.id, x: +this.pos.x.toFixed(2), z: +this.pos.z.toFixed(2), yaw: +this.yaw.toFixed(2), st: this.state, hp: +(Math.max(0, this.hp) / this.maxHp).toFixed(2), ac: this.body.action?.name || '', dead: this.dead ? 1 : 0, c: this.camp.id, k: +this.id.split('_')[1] }; }
}

export class EnemyManager {
  constructor({ scene, terrain, player, combat, assets, camera, plan }) {
    Object.assign(this, { scene, terrain, player, combat, assets, camera }); this.plan = plan; this.puppetMode = false; this.extraTargets = () => []; this.snapT = 0;
    this.local = { get pos() { return player.pos; }, get alive() { return combat.alive; }, get state() { return combat.state; }, takeHit: i => combat.takeHit(i), spheres: () => bodySpheres(player.gltf) }; this.list = []; this.byCamp = new Map(); this.respawn = new Map(); this.scan = 0; this.tagRoot = document.getElementById('bubbles'); this.kills = 0;
  }
  get targets() { return this.list.filter(e => !e.dead); }
  // ---- story helpers ----
  spawnAmbush(x, z, n, radius) { const out = []; this.ambushId = (this.ambushId || 900) + 1; const camp = { id: this.ambushId, x, z, type: 4 };
    for (let k = 0; k < n; k++) { const e = new Bandit(this, camp, k); const a = k * 2.1 + Math.random(), r = radius * (.8 + Math.random() * .4); e.pos.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r); e.pos.y = this.terrain.height(e.pos.x, e.pos.z); e.aggro = true; e.state = 'chase'; this.list.push(e); out.push(e); } return out; }
  spawnBoss(camp) { const e = new Bandit(this, camp, 99, false, { boss: true }); e.pos.set(camp.x + 2, 0, camp.z + 2); e.pos.y = this.terrain.height(e.pos.x, e.pos.z); this.list.push(e); return e; }
  allTargets() { const a = []; if (this.combat.alive) a.push(this.local); for (const t of this.extraTargets()) if (t.alive) a.push(t); return a; }
  nearestTarget(e) { let best = null, bd = 1e9; for (const t of this.allTargets()) { const d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z); if (d < bd) { bd = d; best = t; } } return best || this.local; }
  // ---- co-op networking: the host owns the enemies, clients render puppets ----
  snapshot() { const P = this.player.pos; return this.list.filter(e => Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 200 || this.allTargets().some(t => Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) < 200)).map(e => e.snap()); }
  applySnapshot(list) {
    for (const m of list) {
      let e = this.list.find(x => x.id === m.id); if (!e) { const camp = this.plan.settlements[m.c]; if (!camp) continue; e = new Bandit(this, camp, m.k, true); e.pos.set(m.x, this.terrain.height(m.x, m.z), m.z); this.list.push(e); }
      e.applyNet(m);
    }
    const now = performance.now(); for (const e of this.list.slice()) if (e.puppet && now - (e.lastNet || now) > 2500) { e.dispose(); this.list.splice(this.list.indexOf(e), 1); }
  }
  update(dt) {
    const P = this.player.pos;
    if (this.puppetMode) { for (const e of this.list.slice()) { e.update(dt); if (e.dead && e.t < -8) { e.dispose(); this.list.splice(this.list.indexOf(e), 1); } } return; }
    if ((this.scan -= dt) <= 0) {
      this.scan = 1; const now = performance.now();
      for (const s of this.plan.settlements) {
        if (s.type !== 4) continue; const d = Math.min(Math.hypot(s.x - P.x, s.z - P.z), ...this.extraTargets().map(t => Math.hypot(s.x - t.pos.x, s.z - t.pos.z))), have = this.byCamp.get(s.id);
        if (d < 170 && !have && (this.respawn.get(s.id) || 0) < now) { const n = 3 + (s.id % 2), made = []; for (let k = 0; k < n; k++) { const e = new Bandit(this, s, k); made.push(e); this.list.push(e); } this.byCamp.set(s.id, made); }
        else if (d > 260 && have) { for (const e of have) { e.dispose(); this.list.splice(this.list.indexOf(e), 1); } this.byCamp.delete(s.id); }
      }
    }
    for (const e of this.list.slice()) {
      const tg = this.nearestTarget(e); e.update(dt, tg.pos, tg);
      if (e.remove) { e.dispose(); this.list.splice(this.list.indexOf(e), 1); const arr = this.byCamp.get(e.camp.id); if (arr) { arr.splice(arr.indexOf(e), 1); if (!arr.length) { this.byCamp.delete(e.camp.id); this.respawn.set(e.camp.id, performance.now() + 240000); } } }
    }
    // keep fighters from stacking on each other
    for (let i = 0; i < this.list.length; i++) for (let j = i + 1; j < this.list.length; j++) { const a = this.list[i], b = this.list[j]; if (a.dead || b.dead) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz); if (d < .9 && d > .001) { const k = (.9 - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; } }
  }
}
