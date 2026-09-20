// Pure data side of the procedural houses (no THREE, so it can run inside the terrain worker): sizes, styles and the room plan.
// Procedural houses with real interiors: a room plan (BSP), walls with door / window openings, floors, ceilings, roofs in several styles,
// wall colliders and a furniture plan. Local frame: origin at the footprint centre on the ground, +Z = front (main door), +X = right.
// The plan is pure data (deterministic per seed); build() turns it into merged THREE geometry, one mesh per material.

export const SIZES = { small: [8, 7], medium: [10.5, 8.5], large: [13, 9.5], mansion: [17, 12] };
export const STYLES = ['western', 'victorian', 'modern', 'rustic'];
export const WALL_H = 2.9, T = .22, FLOOR_Y = .18, DOOR_W = 1.0, DOOR_H = 2.15, WIN_W = 1.25, WIN_Y0 = .95, WIN_Y1 = 2.15;
export const WALL_HEIGHT = WALL_H;
export const rnd = (seed, i) => { let h = Math.imul((seed * 7919 + i * 104729) | 0, 374761393) ^ Math.imul(i | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- plan
export function planHouse(seed, style, sizeKey) {
  const [W, D] = SIZES[sizeKey], rooms = [], walls = [], doors = [], wins = [], hx = W / 2, hz = D / 2;
  const maxA = { small: 60, medium: 34, large: 30, mansion: 26 }[sizeKey];
  const split = (x0, z0, x1, z1, depth) => {
    const w = x1 - x0, d = z1 - z0, area = w * d;
    if (area <= maxA || (w < 5.6 && d < 5.6) || depth > 4) { rooms.push({ x0, z0, x1, z1 }); return; }
    const alongX = w >= d ? true : false, r = .4 + rnd(seed, depth * 13 + rooms.length + Math.floor(x0 * 3)) * .2;
    if (alongX && w >= 5.6) { const x = x0 + Math.round(w * r * 2) / 2; walls.push({ ax: 'x', c: x, a: z0, b: z1 }); doors.push({ ax: 'x', c: x, at: z0 + 1 + rnd(seed, depth * 7 + 3) * (d - 2.6), w: DOOR_W }); split(x0, z0, x, z1, depth + 1); split(x, z0, x1, z1, depth + 1); }
    else if (d >= 5.6) { const z = z0 + Math.round(d * r * 2) / 2; walls.push({ ax: 'z', c: z, a: x0, b: x1 }); doors.push({ ax: 'z', c: z, at: x0 + 1 + rnd(seed, depth * 11 + 5) * (w - 2.6), w: DOOR_W }); split(x0, z0, x1, z, depth + 1); split(x0, z, x1, z1, depth + 1); }
    else rooms.push({ x0, z0, x1, z1 });
  };
  split(-hx + T / 2, -hz + T / 2, hx - T / 2, hz - T / 2, 0);
  // room roles: the room touching the front door is the living room, the biggest back room the kitchen, small ones bathrooms, others bedrooms/studies
  const fx = Math.max(-hx + 2, Math.min(hx - 2, (rnd(seed, 91) - .5) * W * .5)); const entry = rooms.find(r => fx >= r.x0 && fx <= r.x1 && r.z1 >= hz - .5) || rooms[0]; entry.type = 'living';
  const rest = rooms.filter(r => r !== entry).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0)), area = r => (r.x1 - r.x0) * (r.z1 - r.z0);
  const kitchen = rest.find(r => r.z1 < hz - 1) || rest[0]; if (kitchen) kitchen.type = 'kitchen';
  const bath = rest.filter(r => !r.type).sort((a, b) => area(a) - area(b))[0]; if (bath && rooms.length > 3) bath.type = 'bathroom';
  let bi = 0; for (const r of rest) if (!r.type) r.type = (bi++ % 3 === 2 && sizeKey !== 'small') ? 'study' : 'bedroom';
  if (!rooms.some(r => r.type === 'bedroom')) { const r = rest.find(x => x.type !== 'kitchen' && x.type !== 'bathroom'); if (r) r.type = 'bedroom'; }
  if (rooms.length === 1) entry.type = 'living';
  // exterior openings: front door, optional back door, windows on every exterior wall
  const front = { ax: 'z', c: hz, at: fx, w: DOOR_W * 1.05, front: true, ext: true }; doors.push(front);
  if (sizeKey !== 'small' && rnd(seed, 33) < .7) doors.push({ ax: 'z', c: -hz, at: (rnd(seed, 34) - .5) * (W - 4), w: DOOR_W, ext: true });
  for (const [ax, c, a, b, n] of [['z', hz, -hx, hx, 1], ['z', -hz, -hx, hx, -1], ['x', -hx, -hz, hz, 0], ['x', hx, -hz, hz, 0]]) {
    const len = b - a, cnt = Math.max(1, Math.floor(len / 3.1));
    for (let i = 0; i < cnt; i++) { const at = a + (i + .5) * len / cnt + (rnd(seed, i + 40 + c) - .5) * .4; if (doors.some(d => d.ax === ax && Math.abs(d.c - c) < .1 && Math.abs(d.at - at) < 1.4)) continue; if (at < a + 1.1 || at > b - 1.1) continue; wins.push({ ax, c, at, w: WIN_W + (rnd(seed, i + 55) < .3 ? .5 : 0) }); }
  }
  // exterior walls (thin solid) and the interior splits
  const ext = [{ ax: 'z', c: hz, a: -hx, b: hx, ext: true }, { ax: 'z', c: -hz, a: -hx, b: hx, ext: true }, { ax: 'x', c: -hx, a: -hz, b: hz, ext: true }, { ax: 'x', c: hx, a: -hz, b: hz, ext: true }];
  return { seed, style, sizeKey, W, D, rooms, walls: [...ext, ...walls], doors, wins, fx };
}

