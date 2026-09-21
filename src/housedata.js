// Pure data side of the procedural houses (no THREE, so it can run inside the terrain worker): sizes, styles and the room plan.
// A plan describes one or two levels (BSP rooms, walls, door / window openings) plus the staircase. Local frame: origin at the footprint
// centre on the ground, +Z = front (main door), +X = right. Deterministic per seed.

export const SIZES = { small: [8, 7], medium: [10.5, 8.5], large: [13, 9.5], mansion: [17, 12], town: [5.2, 9.6] };       // 'town': the 2-storey townhouse whose interior is a hand-made model (assets/house/townhouse.glb)
export const STYLES = ['western', 'victorian', 'modern', 'rustic'];
export const WALL_H = 2.9, T = .22, FLOOR_Y = .18, DOOR_W = 1.0, DOOR_H = 2.15, WIN_W = 1.25, WIN_Y0 = .95, WIN_Y1 = 2.15;
export const WALL2_H = 2.7, FLOOR2_Y = WALL_H + .32, STAIR_W = 1.1, STAIR_L = 3.9;      // second level: walkable surface height, wall height, stair size
export const WALL_HEIGHT = WALL_H;
export const rnd = (seed, i) => { let h = Math.imul((seed * 7919 + i * 104729) | 0, 374761393) ^ Math.imul(i | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Recursive room subdivision of a rectangle. Adds rooms, internal walls and one door per split.
function subdivide(seed, x0, z0, x1, z1, maxA, minDim, out, salt, depth = 0) {
  const w = x1 - x0, d = z1 - z0;
  if (w * d <= maxA || (w < minDim * 2 && d < minDim * 2) || depth > 4) { out.rooms.push({ x0, z0, x1, z1 }); return; }
  const r = .4 + rnd(seed, salt + depth * 13 + out.rooms.length + Math.floor(x0 * 3)) * .2;
  if (w >= d && w >= minDim * 2) { const x = x0 + Math.round(w * r * 2) / 2; out.walls.push({ ax: 'x', c: x, a: z0, b: z1 }); out.doors.push({ ax: 'x', c: x, at: z0 + 1 + rnd(seed, salt + depth * 7 + 3) * (d - 2.6), w: DOOR_W }); subdivide(seed, x0, z0, x, z1, maxA, minDim, out, salt, depth + 1); subdivide(seed, x, z0, x1, z1, maxA, minDim, out, salt, depth + 1); }
  else if (d >= minDim * 2) { const z = z0 + Math.round(d * r * 2) / 2; out.walls.push({ ax: 'z', c: z, a: x0, b: x1 }); out.doors.push({ ax: 'z', c: z, at: x0 + 1 + rnd(seed, salt + depth * 11 + 5) * (w - 2.6), w: DOOR_W }); subdivide(seed, x0, z0, x1, z, maxA, minDim, out, salt, depth + 1); subdivide(seed, x0, z, x1, z1, maxA, minDim, out, salt, depth + 1); }
  else out.rooms.push({ x0, z0, x1, z1 });
}
const area = r => (r.x1 - r.x0) * (r.z1 - r.z0);

// The townhouse: exterior walls, windows and door are generated around the modelled interior; no procedural rooms / slabs / stairs.
export const TOWN = { F1: .127, F2: 2.956, TOP: 5.863 };
function planTown(seed, style) {
  const [W, D] = SIZES.town, hx = W / 2, hz = D / 2, fx = -1.0, ext = [{ ax: 'z', c: hz, a: -hx, b: hx, ext: true }, { ax: 'z', c: -hz, a: -hx, b: hx, ext: true }, { ax: 'x', c: -hx, a: -hz, b: hz, ext: true }, { ax: 'x', c: hx, a: -hz, b: hz, ext: true }];
  const win = (level, list) => { for (const [ax, c, at] of [['z', hz, 1.3], ['z', -hz, -.5], ['z', -hz, 1.3], ['x', -hx, -3], ['x', -hx, -.6], ['x', -hx, 2.6], ['x', hx, -3], ['x', hx, -.6], ['x', hx, 1.9]]) { if (level === 0 && ax === 'z' && c === hz && at > fx - 2 && at < fx + 2) continue; list.push({ ax, c, at, w: 1.15 }); } if (level === 1) list.push({ ax: 'z', c: hz, at: -1, w: 1.15 }); };
  const wins0 = [], wins1 = []; win(0, wins0); win(1, wins1);
  const r = { x0: -hx + T / 2, x1: hx - T / 2, z0: -hz + T / 2, z1: hz - T / 2 };
  const levels = [{ y0: TOWN.F1, h: TOWN.F2 - TOWN.F1, rooms: [{ ...r, type: 'living' }], walls: ext, doors: [{ ax: 'z', c: hz, at: fx, w: 1.05, front: true, ext: true }], wins: wins0 }, { y0: TOWN.F2, h: TOWN.TOP - TOWN.F2, rooms: [{ ...r, type: 'bedroom' }], walls: ext, doors: [], wins: wins1 }];
  return { seed, style, sizeKey: 'town', W, D, floors: 2, stair: null, custom: true, levels, rooms: levels[0].rooms, walls: ext, doors: levels[0].doors, wins: wins0, fx };
}

export function planHouse(seed, style, sizeKey) {
  if (sizeKey === 'town') return planTown(seed, style);
  const [W, D] = SIZES[sizeKey], hx = W / 2, hz = D / 2, maxA = { small: 60, medium: 34, large: 30, mansion: 26 }[sizeKey];
  const L0 = { rooms: [], walls: [], doors: [], wins: [] };
  subdivide(seed, -hx + T / 2, -hz + T / 2, hx - T / 2, hz - T / 2, maxA, 2.8, L0, 0);
  const rooms = L0.rooms;
  // ---- level 0 roles: the room touching the front door is the living room, the biggest back room the kitchen, small ones bathrooms
  const fx = Math.max(-hx + 2, Math.min(hx - 2, (rnd(seed, 91) - .5) * W * .5)); const entry = rooms.find(r => fx >= r.x0 && fx <= r.x1 && r.z1 >= hz - .5) || rooms[0]; entry.type = 'living';
  const rest = rooms.filter(r => r !== entry).sort((a, b) => area(b) - area(a));
  const kitchen = rest.find(r => r.z1 < hz - 1) || rest[0]; if (kitchen) kitchen.type = 'kitchen';
  const bath = rest.filter(r => !r.type).sort((a, b) => area(a) - area(b))[0]; if (bath && rooms.length > 3) bath.type = 'bathroom';
  let bi = 0; for (const r of rest) if (!r.type) r.type = (bi++ % 3 === 2 && sizeKey !== 'small') ? 'study' : 'bedroom';
  if (!rooms.some(r => r.type === 'bedroom')) { const r = rest.find(x => x.type !== 'kitchen' && x.type !== 'bathroom'); if (r) r.type = 'bedroom'; }
  // ---- floors: bigger houses get a second level with a straight staircase in the living room
  let floors = sizeKey === 'small' ? 1 : sizeKey === 'medium' ? (rnd(seed, 71) < .4 ? 2 : 1) : sizeKey === 'large' ? (rnd(seed, 71) < .8 ? 2 : 1) : 2, stair = null;
  if (floors === 2) {
    const fit = r => { const ew = r.x1 - r.x0, ed = r.z1 - r.z0; if (ed >= STAIR_L + 1.8 && ew >= 3.2) { const left = fx > (r.x0 + r.x1) / 2 || r !== entry, sx0 = left ? r.x0 + .25 : r.x1 - .25 - STAIR_W; return { x0: sx0, x1: sx0 + STAIR_W, z0: r.z0 + .25, z1: r.z0 + .25 + STAIR_L, axis: 'z' }; } if (ew >= STAIR_L + 1.8 && ed >= 3.0) return { x0: r.x0 + .25, x1: r.x0 + .25 + STAIR_L, z0: r.z0 + .25, z1: r.z0 + .25 + STAIR_W, axis: 'x' }; return null; };
    for (const r of [entry, ...rest.filter(x => x.type !== 'kitchen' && x.type !== 'bathroom')]) { const st = fit(r); if (st) { stair = st; if (r !== entry) r.type = 'hall'; break; } }
    if (!stair) floors = 1;
  }
  // ---- exterior openings for a level (front door only on level 0)
  const openings = (level, doors, wins) => {
    for (const [ax, c, a, b] of [['z', hz, -hx, hx], ['z', -hz, -hx, hx], ['x', -hx, -hz, hz], ['x', hx, -hz, hz]]) {
      const len = b - a, cnt = Math.max(1, Math.floor(len / 3.1));
      for (let i = 0; i < cnt; i++) { const at = a + (i + .5) * len / cnt + (rnd(seed, i + 40 + c + level * 17) - .5) * .4; if (level === 0 && doors.some(d => d.ax === ax && Math.abs(d.c - c) < .1 && Math.abs(d.at - at) < 1.4)) continue; if (at < a + 1.1 || at > b - 1.1) continue; wins.push({ ax, c, at, w: WIN_W + (rnd(seed, i + 55 + level * 9) < .3 ? .5 : 0) }); }
    }
  };
  L0.doors.push({ ax: 'z', c: hz, at: fx, w: DOOR_W * 1.05, front: true, ext: true });
  if (sizeKey !== 'small' && rnd(seed, 33) < .7) L0.doors.push({ ax: 'z', c: -hz, at: (rnd(seed, 34) - .5) * (W - 4), w: DOOR_W, ext: true });
  openings(0, L0.doors, L0.wins);
  const ext = [{ ax: 'z', c: hz, a: -hx, b: hx, ext: true }, { ax: 'z', c: -hz, a: -hx, b: hx, ext: true }, { ax: 'x', c: -hx, a: -hz, b: hz, ext: true }, { ax: 'x', c: hx, a: -hz, b: hz, ext: true }];
  const levels = [{ y0: FLOOR_Y, h: WALL_H, rooms, walls: [...ext, ...L0.walls], doors: L0.doors, wins: L0.wins }];
  // ---- level 1: a corridor strip around the stair top, bedrooms on both sides
  if (floors === 2) {
    const L1 = { rooms: [], walls: [], doors: [], wins: [] }, x0 = -hx + T / 2, x1 = hx - T / 2, z0 = -hz + T / 2, z1 = hz - T / 2, alongZ = stair.axis === 'z';
    const c = alongZ ? (stair.x0 + stair.x1) / 2 : (stair.z0 + stair.z1) / 2, lo = alongZ ? -hx + T / 2 : -hz + T / 2, hi = alongZ ? hx - T / 2 : hz - T / 2, h0 = Math.max(lo, c - 1.15), h1 = Math.min(hi, c + 1.15);
    const hall = alongZ ? { x0: h0, x1: h1, z0, z1, type: 'hall' } : { x0, x1, z0: h0, z1: h1, type: 'hall' }; L1.rooms.push(hall);
    const sides = []; if (h0 - lo >= 2.8) { sides.push([lo, h0 - T / 2]); L1.walls.push(alongZ ? { ax: 'x', c: h0, a: -hz, b: hz } : { ax: 'z', c: h0, a: -hx, b: hx }); } if (hi - h1 >= 2.8) { sides.push([h1 + T / 2, hi]); L1.walls.push(alongZ ? { ax: 'x', c: h1, a: -hz, b: hz } : { ax: 'z', c: h1, a: -hx, b: hx }); }
    const sub = { rooms: [], walls: [], doors: [] };
    for (const [a2, b2] of sides) { if (alongZ) subdivide(seed, a2, z0, b2, z1, 26, 2.8, sub, 300); else subdivide(seed, x0, a2, x1, b2, 26, 2.8, sub, 300); }
    for (const r of sub.rooms) {                                    // one door per room on the side that touches the corridor
      if (alongZ) { const d = Math.abs(r.x1 - (h0 - T / 2)) < .3 ? h0 : Math.abs(r.x0 - (h1 + T / 2)) < .3 ? h1 : null; if (d !== null) L1.doors.push({ ax: 'x', c: d, at: (r.z0 + r.z1) / 2 + (rnd(seed, Math.floor(r.z0 * 9)) - .5) * .6, w: DOOR_W }); }
      else { const d = Math.abs(r.z1 - (h0 - T / 2)) < .3 ? h0 : Math.abs(r.z0 - (h1 + T / 2)) < .3 ? h1 : null; if (d !== null) L1.doors.push({ ax: 'z', c: d, at: (r.x0 + r.x1) / 2 + (rnd(seed, Math.floor(r.x0 * 9)) - .5) * .6, w: DOOR_W }); }
    }
    L1.rooms.push(...sub.rooms); L1.walls.push(...sub.walls); L1.doors.push(...sub.doors);
    const rs = sub.rooms.slice().sort((a, b) => area(a) - area(b)); rs.forEach((r, i) => r.type = i === 0 && rs.length > 2 ? 'bathroom' : (i === rs.length - 1 && rs.length > 3) ? 'study' : 'bedroom');
    if (!rs.length) floors = 1; else { openings(1, L1.doors, L1.wins); levels.push({ y0: FLOOR2_Y, h: WALL2_H, rooms: L1.rooms, walls: [...ext, ...L1.walls], doors: L1.doors, wins: L1.wins }); }
  }
  if (floors === 1) stair = null;
  const l0 = levels[0];
  return { seed, style, sizeKey, W, D, floors, stair, levels, rooms: l0.rooms, walls: l0.walls, doors: l0.doors, wins: l0.wins, fx };
}
