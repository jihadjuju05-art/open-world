// Daily life of the villagers: households (adults + children) that sleep in their townhouse, cook, eat, work, play and visit the
// inn on a schedule. Members walk to the front door, the door opens, and they reappear inside (only while the interior is loaded).
import { TOWN } from './housedata.js';
import { getTownData } from './housegen.js';

export const SURNAMES = ['Ortega', 'Salas', 'Reyes', 'Vega', 'Cruz', 'Bravo', 'Luna', 'Rojas', 'Castro', 'Prado', 'Mora', 'Ledesma', 'Herrera', 'Navarro', 'Campos', 'Ibarra'];
export const FIRST_M = ['Elías', 'Gideon', 'Ezra', 'Caleb', 'Isaac', 'Bruno', 'Hugo', 'Ramón', 'Félix', 'Ignacio', 'Wyatt', 'Clay', 'Abel', 'Otis', 'Lucas', 'Jonás', 'Mario', 'Dante', 'Emilio'];
export const FIRST_F = ['Ana', 'Clara', 'Elena', 'Inés', 'Lucía', 'Marta', 'Nora', 'Olivia', 'Rosa', 'Sara', 'Teresa', 'Violeta', 'Julia', 'Mabel', 'Irene', 'Paloma', 'Adela', 'Beatriz', 'Carmen'];
export const KID_M = ['Tomasito', 'Nico', 'Pablo', 'Leo', 'Martín', 'Sami', 'Toño', 'Gael'];
export const KID_F = ['Lola', 'Mía', 'Chelo', 'Nina', 'Alba', 'Rita', 'Cleo', 'Luz'];
const rnd = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const pick = (a, r) => a[Math.floor(r * a.length) % a.length];

// ---- lines for the roles that only exist in households
export const HOME_LINES = {
  'ama de casa': { greet: ['Buenas. Perdone el desorden, estoy con la casa.', 'Hola, forastero. ¿Busca a alguien?'], trade: 'Cuido de mi familia y de la casa. Es más trabajo que cualquier mina.', rumors: ['Mi marido dice que hay bandidos cerca del camino; yo cierro con llave por las noches.', 'La panadera vende el mejor pan de la región, pero se acaba temprano.', 'Los niños no paran quietos, qué le voy a hacer.'] },
  niño: { greet: ['¡Hola! ¿Tienes un caballo?', '¡Una espada de verdad!', '¡Mi papá dice que no hable con extraños!'], trade: 'Juego. Y ayudo a mamá cuando me obligan.', rumors: ['Vi un zorro cerca del río. ¡Enorme!', 'Dicen que en la colina hay un fantasma, pero yo no tengo miedo.', 'Mi hermano escondió una moneda bajo la piedra grande.'] },
};

// ---- schedule: where a member should be at a given hour
const jit = (npc, k) => rnd(npc.sched.seed, k);
export function desire(npc, h) {
  const S = npc.sched, kind = S.kind;
  if (kind === 'child') {
    if (h >= 21 || h < 7) return { k: 'sleep' }; if (h < 8) return { k: 'kitchen', anim: 'Consume', sit: true }; if (h >= 12 && h < 13) return { k: 'eat' };
    if (h >= 20) return { k: 'living' }; return { k: 'play' };
  }
  if (h >= 22 || h < 6) return { k: 'sleep' }; if (h < 7) return { k: kind === 'mother' ? 'kitchen' : 'eat' }; if (h >= 12 && h < 13) return { k: 'eat' };
  if (h >= 20) return { k: 'living' };
  if (h >= 18) return S.bar && S.hasInn ? { k: 'bar' } : { k: 'porch' };
  if (kind === 'mother') return h < 12 || h >= 17 ? { k: h % 2 < 1 ? 'kitchen' : 'living' } : { k: 'shop' };
  return { k: 'work' };
}
const WORK_ANIM = { granjero: 'Farm_Harvest', herrero: 'Fixing_Kneeling', posadero: 'Idle_Talking_Loop', comerciante: 'Idle_Talking_Loop', banquero: 'Idle_Talking_Loop', sheriff: 'Idle_FoldArms_Loop', pastor: 'Idle_Loop', cazador: 'Idle_Loop', pescador: 'Idle_Loop', viajero: 'Idle_Loop', 'buscador de oro': 'Fixing_Kneeling' };

// ---- interior spots (house-local: x, z, floor, facing)
function spots() {
  const T = getTownData(); if (!T) return null; if (T._spots) return T._spots;
  const f0 = TOWN.F1 + .05, f1 = TOWN.F2 + .05, by = n => T.interact.find(i => i.name === n);
  const bed = n => { const b = by(n); if (!b) return null; const alongX = b.w >= b.d, head = alongX ? [b.x > 0 ? 1 : -1, 0] : [0, b.z > 0 ? 1 : -1]; return { x: b.x, z: b.z, y: b.y0 + .5, head, across: alongX ? [0, 1] : [1, 0] }; };
  T._spots = { beds: [bed('letto'), bed('letto2')].filter(Boolean), chairs: ['sedia_cucina', 'sedia_cucina1', 'sedia_cucina2'].map(by).filter(Boolean).map(c => ({ x: c.x, z: c.z, y: f0 - .05 + .18, look: [1.25, -3.2] })),
    sofa: [[1.6, 1.5, [-.5, 1.5]], [.5, 3.0, [0, 1.5]], [.75, .1, [0, 1.5]]].map(([x, z, l]) => ({ x, z, y: f0 - .05 + .18, look: l })), stove: { x: -1.0, z: -3.75, y: f0, look: [-1.2, -4.6] }, door: { x: -1, z: 6.1 }, f0, f1 };
  return T._spots;
}

// ---- helpers: house-local -> world
export function homeXf(m, it) { const inst = m.houses?.houses.get(Math.round(it.x) + ',' + Math.round(it.z)); const y = inst ? inst.y : m.terrain.height(it.x, it.z); const c = Math.cos(it.rot), s = Math.sin(it.rot); return { inst, y, rot: it.rot, W: (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c] }; }
const openDoor = (inst) => { const o = inst?.doorObjs?.find(d => !d.model); if (!o) return; o.target = 1; setTimeout(() => { o.target = 0; }, 2400); };

// Moves toward a spot outdoors. Returns true when arrived. Teleports when the walk is hopeless (stuck / far from the player).
function walk(npc, tx, tz, dt, speed = 1.3) {
  const m = npc.mgr, dx = tx - npc.pos.x, dz = tz - npc.pos.z, L = Math.hypot(dx, dz); if (L < .7) return true;
  npc.turnTo(dx, dz, dt, 7); const nx = npc.pos.x + Math.sin(npc.yaw) * speed * dt, nz = npc.pos.z + Math.cos(npc.yaw) * speed * dt, ox = npc.pos.x, oz = npc.pos.z;
  npc.pos.x = nx; npc.pos.z = nz; m.terrain.pushOut(npc.pos, .45);
  if (Math.hypot(npc.pos.x - ox, npc.pos.z - oz) < speed * dt * .35) { npc.stuck = (npc.stuck || 0) + dt; if (npc.stuck > 2.5) { npc.pos.x = tx; npc.pos.z = tz; npc.stuck = 0; return true; } } else npc.stuck = 0;
  npc.walkT = (npc.walkT || 0) + dt; if (npc.walkT > L / speed * 2.5 + 8) { npc.pos.x = tx; npc.pos.z = tz; npc.walkT = 0; return true; }
  return false;
}

// One update of a household member. Returns { anim, rate } and sets npc.hidden / npc.pos / npc.yaw.
export function routineStep(npc, dt, hour, dPlayer) {
  const m = npc.mgr, S = npc.sched, X = homeXf(m, S.home), sp = spots(), want = desire(npc, hour), far = dPlayer > 90; let anim = 'Idle_Loop', rate = 1;
  const R = { anim, rate }; if (!sp) return R;
  const doorOut = X.W(sp.door.x, sp.door.z), inside = ['sleep', 'kitchen', 'eat', 'living'].includes(want.k);
  const showIn = X.inst?.interior && dPlayer < 32;
  if (npc.where === 'in' && !inside) {                                       // leave the house: door opens, step out
    npc.where = 'out'; npc.pos.set(doorOut[0], m.terrain.walkY(doorOut[0], doorOut[1], X.y + 1), doorOut[1]); npc.hidden = false; npc.asleep = false; npc.body.play('Idle_Loop', .1); if (!far) openDoor(X.inst);
    npc.yaw = Math.atan2(doorOut[0] - X.W(-1, 3)[0], doorOut[1] - X.W(-1, 3)[1]);
  }
  if (npc.where !== 'in' && inside) {                                        // go home
    if (far || dPlayer > 60) { npc.where = 'in'; } else { const arrived = walk(npc, doorOut[0], doorOut[1], dt); npc.pos.y = m.terrain.walkY(npc.pos.x, npc.pos.z, npc.pos.y); npc.hidden = false; if (!arrived) return { anim: 'Walk_Loop', rate: 1.3 / .98 }; openDoor(X.inst); npc.where = 'in'; npc.doorT = 1.2; }
  }
  if (npc.where === 'in') {
    if (npc.doorT > 0) { npc.doorT -= dt; }
    // interior spot for this activity
    let spot = null, a = 'Idle_Loop', lay = false, fy = sp.f0 - .05;
    if (want.k === 'sleep') { const b = sp.beds[S.bed % sp.beds.length]; const off = S.kind === 'child' ? (S.slot % 2 ? .38 : -.38) : 0; spot = { x: b.x + b.across[0] * off, z: b.z + b.across[1] * off, y: b.y, head: b.head }; lay = true; }
    else if (want.k === 'kitchen') { const st = sp.stove; spot = { ...st, y: fy }; a = want.sit ? 'Idle_Loop' : 'Interact'; }
    else if (want.k === 'eat') { const c = sp.chairs[S.slot % sp.chairs.length]; spot = c; a = 'Sitting_Idle_Loop'; }
    else { const c = sp.sofa[S.slot % sp.sofa.length]; spot = c; a = S.kind === 'child' ? 'Sitting_Idle_Loop' : 'Sitting_Talking_Loop'; }
    const wp = X.W(spot.x, spot.z), vis = !!showIn; npc.hidden = !vis; npc.asleep = lay;
    npc.pos.set(wp[0], X.y + spot.y, wp[1]);
    if (lay) { const hx = spot.head[0], hz = spot.head[1], c = Math.cos(X.rot), s = Math.sin(X.rot), wx = hx * c + hz * s, wz = -hx * s + hz * c; npc.yaw = Math.atan2(-wx, -wz); if (vis) npc.body.freezePose('LayToIdle', .05); return { anim: null, rate: 0, keep: true }; }
    if (spot.look) { const lw = X.W(spot.look[0], spot.look[1]); npc.yaw = Math.atan2(lw[0] - wp[0], lw[1] - wp[1]); }
    npc.inHouseY = true; return { anim: a, rate: 1, inHouse: true };
  }
  // ---- outdoors
  npc.hidden = false; const P = npc.pos;
  const dest = outdoorSpot(npc, X, sp, want, hour);
  if (far && Math.hypot(dest.x - P.x, dest.z - P.z) > 30) { P.x = dest.x; P.z = dest.z; }
  const arrived = walk(npc, dest.x, dest.z, dt, dest.run ? 2.6 : 1.3);
  if (!arrived) return { anim: dest.run ? 'Jog_Fwd_Loop' : 'Walk_Loop', rate: dest.run ? 2.6 / 5.36 : 1.3 / .98 };
  if (dest.face) npc.turnTo(dest.face[0] - P.x, dest.face[1] - P.z, dt, 5);
  return { anim: dest.anim || 'Idle_Loop', rate: 1 };
}

// Outdoor destination for work / play / porch / bar / shop (stable per member, re-rolled for play every few seconds).
function outdoorSpot(npc, X, sp, want, hour) {
  const S = npc.sched, m = npc.mgr, s = S.settlement;
  if (want.k === 'porch') { const p = X.W(-1 + (S.slot - 1) * .9, 7.4); return { x: p[0], z: p[1], face: X.W(-1, 5), anim: S.kind === 'child' ? 'Idle_Loop' : 'Idle_Talking_Loop' }; }
  if (want.k === 'bar') { const q = S.inn || { x: s.x, z: s.z }; return { x: q.x + (S.slot - 1) * 1.4 + 1.5, z: q.z + 2.5, anim: 'Idle_FoldArms_Loop' }; }
  if (want.k === 'shop') { const q = S.stall || { x: s.x, z: s.z }; return { x: q.x + 1.5 + S.slot * .9, z: q.z + 2, anim: 'Idle_Talking_Loop' }; }
  if (want.k === 'play') {
    if (!npc.playT || npc.playT <= 0 || !npc.playSpot) { const a = rnd(S.seed, Math.floor(npc.age0 = (npc.age0 || 0) + 1)) * 6.283, r = 3 + rnd(S.seed, npc.age0 + 50) * 9, sx = S.home.x + Math.cos(a) * r, sz = S.home.z + Math.sin(a) * r; npc.playSpot = m.validSpot(sx, sz) ? { x: sx, z: sz } : { x: npc.pos.x, z: npc.pos.z }; npc.playT = 4 + rnd(S.seed, npc.age0 + 90) * 8; npc.playAnim = rnd(S.seed, npc.age0 + 7) < .25 ? 'Dance_Loop' : 'Idle_Loop'; }
    npc.playT -= .016; return { x: npc.playSpot.x, z: npc.playSpot.z, anim: npc.playAnim, run: S.kind === 'child' };
  }
  const w = S.work; return { x: w.x, z: w.z, anim: w.anim, face: w.face };
}

// ---- creation
export function makeFamily(mgr, s, it, idx) {
  const seed = Math.floor(rnd(s.id, it.x | 0, it.z | 0) * 1e9), R = k => rnd(seed, k), out = [];
  const surname = pick(SURNAMES, R(1)), single = R(2) < .22, kids = single ? (R(3) < .4 ? 1 : 0) : (R(3) < .25 ? 0 : R(3) < .55 ? 1 : R(3) < .85 ? 2 : 3);
  const roles = mgr.rolesFor(s), role1 = pick(roles, R(4));
  const sex1 = R(5) < .78 ? 'm' : 'f', A1 = { kind: sex1 === 'm' ? 'father' : 'mother', sex: sex1, role: role1 };
  const list = [A1]; if (!single) { const sex2 = sex1 === 'm' ? 'f' : 'm'; list.push({ kind: sex2 === 'f' ? 'mother' : 'father', sex: sex2, role: R(6) < .6 ? 'ama de casa' : pick(roles, R(7)) }); }
  for (let k = 0; k < kids; k++) list.push({ kind: 'child', sex: R(10 + k) < .5 ? 'm' : 'f', role: 'niño' });
  const items = s.items, find = t => items.filter(o => o.t === t), inn = find('inn')[0], stalls = [...find('stall1'), ...find('stall2')], smith = find('smith')[0];
  const bar = R(8) < .45;
  list.forEach((mem, i) => {
    const sSeed = Math.floor(R(20 + i) * 1e9), first = mem.kind === 'child' ? pick(mem.sex === 'm' ? KID_M : KID_F, rnd(sSeed, 1)) : pick(mem.sex === 'm' ? FIRST_M : FIRST_F, rnd(sSeed, 1));
    const tp = { x: it.x, z: it.z }; let work = { x: it.x, z: it.z, anim: WORK_ANIM[mem.role] || 'Idle_Loop' };
    if (mem.kind !== 'child' && mem.role !== 'ama de casa') work = pickWork(mgr, s, it, mem.role, smith, inn, stalls, sSeed);
    out.push({ mem, sSeed, first, surname, sched: { seed: sSeed, home: it, kind: mem.kind === 'child' ? 'child' : mem.role === 'ama de casa' ? 'mother' : 'father', slot: i, bed: mem.kind === 'child' ? 0 : (i === 0 ? 1 : 0), work, bar: bar && mem.sex === 'm', hasInn: !!inn, inn, stall: stalls[0], settlement: s, tp } });
  });
  // the lone parent takes bed 1; children sleep in bed 0 (a second adult takes bed 0)
  return out;
}
function pickWork(mgr, s, it, role, smith, inn, stalls, seed) {
  const anim = WORK_ANIM[role] || 'Idle_Loop'; let base;
  if (role === 'granjero' || role === 'pastor') base = { x: it.x, z: it.z, back: true };
  else if (role === 'herrero' && smith) base = smith; else if (role === 'posadero' && inn) base = inn; else if (role === 'comerciante' && stalls[0]) base = stalls[0]; else base = { x: s.x, z: s.z, plaza: true };
  for (let t = 0; t < 14; t++) {
    const a = rnd(seed, 100 + t) * 6.283, r = base.back ? 7 + rnd(seed, 120 + t) * 4 : (base.plaza ? 3 + rnd(seed, 120 + t) * 10 : 3 + rnd(seed, 120 + t) * 2.5), x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
    if (mgr.validSpot(x, z)) return { x, z, anim, face: [base.x, base.z] };
  }
  return { x: base.x, z: base.z + 5, anim, face: [base.x, base.z] };
}
