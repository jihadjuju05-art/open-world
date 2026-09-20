// Geometry side of the procedural houses: walls with door / window openings, floors, ceilings, roofs, colliders and the furniture plan.
import * as THREE from 'three';
import { SIZES, STYLES, WALL_H, T, FLOOR_Y, DOOR_W, DOOR_H, WIN_W, WIN_Y0, WIN_Y1, WALL_HEIGHT, rnd, planHouse } from './housedata.js';
export { SIZES, STYLES, WALL_HEIGHT, planHouse };

const trim = 'trim';
// ---------------------------------------------------------------- geometry
class MB {                                     // merged geometry per material key
  constructor() { this.m = new Map(); }
  g(k) { let o = this.m.get(k); if (!o) this.m.set(k, o = { p: [], n: [], u: [], i: [] }); return o; }
  quad(k, a, b, c, d, n, uv) { const g = this.g(k), o = g.p.length / 3; g.p.push(...a, ...b, ...c, ...d); for (let i = 0; i < 4; i++) g.n.push(n[0], n[1], n[2]); g.u.push(...uv); g.i.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  // axis aligned box; faces choose their material through matFor(faceName) ('px','nx','py','ny','pz','nz'); world-scale planar UVs (tile metres)
  box(x0, y0, z0, x1, y1, z1, matFor, tile = 2) {
    const f = (name, a, b, c, d, n, us, vs) => { const k = matFor(name); if (!k) return; this.quad(k, a, b, c, d, n, [us[0] / tile, vs[0] / tile, us[1] / tile, vs[0] / tile, us[1] / tile, vs[1] / tile, us[0] / tile, vs[1] / tile]); };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, x1], [y0, y1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [x1, x0], [y0, y1]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [z1, z0], [y0, y1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, z1], [y0, y1]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, x1], [z1, z0]); f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [x0, x1], [z0, z1]);
  }
  build(mats) {
    const out = []; for (const [k, o] of this.m) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2)); g.setIndex(o.i); g.computeBoundingSphere(); out.push({ key: k, geo: g }); } return out;
  }
}

const SHELLS = new Map();
export function getShell(seed, style, sizeKey) { const k = seed + '|' + style + '|' + sizeKey; let s = SHELLS.get(k); if (!s) SHELLS.set(k, s = buildShell(planHouse(seed, style, sizeKey))); return s; }
// Builds the shell: returns { parts:[{key,geo}], colliders:[{x,z,hx,hz}], doors:[{...}], plan, glass:[...] }.
export function buildShell(plan) {
  const { W, D, style, seed } = plan, hx = W / 2, hz = D / 2, mb = new MB(), colliders = [], doorList = [];
  const ext = 'ext', wall = 'wall', floor = 'floor';
  const openings = w => {                                      // openings of one wall, as [u0,u1,y0,y1,kind]
    const list = []; for (const d of plan.doors) if (d.ax === w.ax && Math.abs(d.c - w.c) < .05 && d.at > w.a && d.at < w.b) list.push([d.at - d.w / 2, d.at + d.w / 2, FLOOR_Y, FLOOR_Y + DOOR_H, 'door', d]);
    for (const o of plan.wins) if (o.ax === w.ax && Math.abs(o.c - w.c) < .05 && o.at > w.a && o.at < w.b) list.push([o.at - o.w / 2, o.at + o.w / 2, WIN_Y0, WIN_Y1, 'win', o]); return list.sort((p, q) => p[0] - q[0]);
  };
  const wallBox = (x0, y0, z0, x1, y1, z1, isExt, ax, outSign) => {                       // one solid piece of wall; exterior side gets the exterior material
    mb.box(x0, y0, z0, x1, y1, z1, face => { if (face === 'py') return trim; if (face === 'ny') return wall; const n = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] }[face]; if (!n) return wall; return isExt && ((n[0] * outSign[0] + n[1] * outSign[1]) > 0) ? ext : wall; }, style === 'modern' ? 3 : 2);
  };
  for (const w of plan.walls) {
    const ops = openings(w), isExt = !!w.ext; const outSign = w.ax === 'z' ? [0, Math.sign(w.c) || 1] : [Math.sign(w.c) || 1, 0], a = w.a - (w.ext ? T / 2 : 0), b = w.b + (w.ext ? T / 2 : 0);
    let cur = a; const seg = (u0, u1, y0, y1) => { if (u1 - u0 < .01 || y1 - y0 < .01) return; if (w.ax === 'z') wallBox(u0, y0, w.c - T / 2, u1, y1, w.c + T / 2, isExt, 'z', outSign); else wallBox(w.c - T / 2, y0, u0, w.c + T / 2, y1, u1, isExt, 'x', outSign); };
    for (const [u0, u1, y0, y1, kind, ref] of ops) { seg(cur, u0, FLOOR_Y, WALL_H); seg(u0, u1, y1, WALL_H); if (kind === 'win') { seg(u0, u1, FLOOR_Y, y0); } cur = u1;
      if (kind === 'door') doorList.push({ ax: w.ax, c: w.c, u0, u1, y0, y1, ext: isExt, front: !!ref.front, id: doorList.length });
      if (kind === 'win') { for (const [q0, q1, q2, q3] of [[u0 - .06, u0, y0 - .04, y1 + .04], [u1, u1 + .06, y0 - .04, y1 + .04], [u0 - .06, u1 + .06, y0 - .06, y0], [u0 - .06, u1 + .06, y1, y1 + .05]]) { const th = T + .05; if (w.ax === 'z') mb.box(q0, q2, w.c - th / 2, q1, q3, w.c + th / 2, () => trim, 1); else mb.box(w.c - th / 2, q2, q0, w.c + th / 2, q3, q1, () => trim, 1); }
        const gk = 'glass', gt = .02; if (w.ax === 'z') mb.box(u0, y0, w.c - gt, u1, y1, w.c + gt, () => gk, 1); else mb.box(w.c - gt, y0, u0, w.c + gt, y1, u1, () => gk, 1); } }
    seg(cur, b, FLOOR_Y, WALL_H);
    // colliders: solid pieces (door gaps stay open; the manager adds a blocker for closed doors)
    let c0 = a; const col = (u0, u1) => { if (u1 - u0 < .05) return; if (w.ax === 'z') colliders.push({ x: (u0 + u1) / 2, z: w.c, hx: (u1 - u0) / 2, hz: T / 2 }); else colliders.push({ x: w.c, z: (u0 + u1) / 2, hx: T / 2, hz: (u1 - u0) / 2 }); };
    for (const [u0, u1, , , kind] of ops) { if (kind === 'door') { col(c0, u0); c0 = u1; } } col(c0, b);
    for (const [u0, u1, , , kind] of ops) if (kind === 'win') { /* sills are low: still solid for the player */ }
  }
  // floors (per room, different material for kitchens / bathrooms) and one ceiling slab
  for (const r of plan.rooms) { const mk = r.type === 'kitchen' || r.type === 'bathroom' ? 'tile' : floor; mb.box(r.x0 - T / 2, 0, r.z0 - T / 2, r.x1 + T / 2, FLOOR_Y, r.z1 + T / 2, f => f === 'py' ? mk : (f === 'ny' ? null : 'found'), 2.4); }
  mb.box(-hx - T, 0, -hz - T, hx + T, .04, hz + T, () => 'found', 3);
  mb.box(-hx - T / 2, WALL_H, -hz - T / 2, hx + T / 2, WALL_H + .16, hz + T / 2, f => f === 'py' ? null : f === 'ny' ? 'ceil' : trim, 2);
  // porch in front of the door
  const px = plan.fx; mb.box(px - 1.6, 0, hz + T / 2, px + 1.6, FLOOR_Y * .8, hz + 1.5, f => f === 'py' ? 'porch' : 'found', 1.6);
  if (style !== 'modern') for (const s of [-1, 1]) mb.box(px + s * 1.45 - .07, FLOOR_Y * .8, hz + 1.35, px + s * 1.45 + .07, 2.55, hz + 1.5, () => trim, 1);
  // roof
  roof(mb, plan, hx, hz);
  return { parts: mb.build(), colliders, doors: doorList, plan };
}

function roof(mb, plan, hx, hz) {
  const { style } = plan, y0 = WALL_H + .16, o = style === 'modern' ? .25 : .55, X = hx + o, Z = hz + o;
  if (style === 'modern') {                                        // flat roof with parapet
    mb.box(-X, y0, -Z, X, y0 + .22, Z, f => f === 'py' ? 'roofflat' : trim, 2); mb.box(-X, y0 + .22, -Z, X, y0 + .55, -Z + .12, () => trim, 1); mb.box(-X, y0 + .22, Z - .12, X, y0 + .55, Z, () => trim, 1); mb.box(-X, y0 + .22, -Z, -X + .12, y0 + .55, Z, () => trim, 1); mb.box(X - .12, y0 + .22, -Z, X, y0 + .55, Z, () => trim, 1); return;
  }
  const alongX = hx >= hz, rise = (alongX ? hz : hx) * (style === 'victorian' ? .82 : .62) + .4, tile = 2.2;
  const slope = (a, b, c, d, n, uv) => mb.quad('roof', a, b, c, d, n, uv);
  if (alongX) {                                                    // ridge along X, slopes front/back
    const L = 2 * X, s = Math.hypot(rise, Z), nz = rise / s, ny = Z / s;
    slope([-X, y0, Z], [X, y0, Z], [X, y0 + rise, 0], [-X, y0 + rise, 0], [0, ny, nz], [0, 0, L / tile, 0, L / tile, s / tile, 0, s / tile]);
    slope([X, y0, -Z], [-X, y0, -Z], [-X, y0 + rise, 0], [X, y0 + rise, 0], [0, ny, -nz], [0, 0, L / tile, 0, L / tile, s / tile, 0, s / tile]);
    for (const sx of [-1, 1]) { const g = mb.g('gable'), b = g.p.length / 3, xx = sx * (hx + .01); g.p.push(xx, y0, hz, xx, y0, -hz, xx, y0 + rise * (hz / Z), 0); for (let i = 0; i < 3; i++) g.n.push(sx, 0, 0); g.u.push(0, 0, 1, 0, .5, .6); g.i.push(...(sx > 0 ? [b, b + 1, b + 2] : [b + 1, b, b + 2])); }
    mb.box(-X - .02, y0 + rise - .06, -.09, X + .02, y0 + rise + .07, .09, () => trim, 1);
    if (style !== 'victorian') { mb.box(-X, y0 - .06, Z - .05, X, y0 + .04, Z + .03, () => trim, 1); mb.box(-X, y0 - .06, -Z - .03, X, y0 + .04, -Z + .05, () => trim, 1); }
  } else {                                                          // ridge along Z, slopes left/right
    const L = 2 * Z, s = Math.hypot(rise, X), nx = rise / s, ny = X / s;
    slope([X, y0, Z], [X, y0, -Z], [0, y0 + rise, -Z], [0, y0 + rise, Z], [nx, ny, 0], [0, 0, L / tile, 0, L / tile, s / tile, 0, s / tile]);
    slope([-X, y0, -Z], [-X, y0, Z], [0, y0 + rise, Z], [0, y0 + rise, -Z], [-nx, ny, 0], [0, 0, L / tile, 0, L / tile, s / tile, 0, s / tile]);
    for (const sz of [-1, 1]) { const g = mb.g('gable'), b = g.p.length / 3, zz = sz * (hz + .01); g.p.push(-hx, y0, zz, hx, y0, zz, 0, y0 + rise * (hx / X), zz); for (let i = 0; i < 3; i++) g.n.push(0, 0, sz); g.u.push(0, 0, 1, 0, .5, .6); g.i.push(...(sz > 0 ? [b, b + 1, b + 2] : [b + 1, b, b + 2])); }
    mb.box(-.09, y0 + rise - .06, -Z - .02, .09, y0 + rise + .07, Z + .02, () => trim, 1);
  }
  // chimney
  if (style !== 'modern') mb.box(hx * .45, y0, -hz * .3, hx * .45 + .6, y0 + rise + .9, -hz * .3 + .6, f => f === 'py' ? trim : 'chim', 1.2);
}

// ---------------------------------------------------------------- furniture plan
// role -> catalogue of [file, size m (longest side), extra]. Item front faces +Z in its own frame.
export const CATALOG = {
  bed: [['h_Bed', 2.0], ['q_Bed_King', 2.05]], nightstand: [['q_NightStand_1', .55], ['q_NightStand_2', .55]], wardrobe: [['i_LargeWardrobe1', 1.9], ['p_Closet_LeftDoor', 1.9]], dresser: [['h_Dresser', 1.2], ['i_WideDresser1', 1.3]],
  couch: [['h_Couch', 2.1], ['q_Couch_Large1', 2.3], ['p_Sofa', 2.0]], armchair: [['h_Armchair', 1.0], ['q_Couch_Small2', 1.2]], table: [['h_Table', 1.5], ['p_Table', 1.5], ['q_Table_RoundSmall', 1.1]], chair: [['h_Chair', .95], ['p_Chair', .95], ['i_WoodenChair1', .95]],
  shelf: [['h_Bookshelf', 1.9], ['p_BookCase_Single', 1.9], ['i_MediumBookShelf1', 1.7]], desk: [['h_Desk', 1.4], ['i_LShapedDesk1', 1.5]], deskchair: [['p_OfficeChair', .95]], lamp: [['h_Lamp_with_shade', 1.5], ['i_FloorLamp1', 1.6], ['q_Light_Floor2', 1.6]],
  plant: [['q_Houseplant_3', 1.1], ['q_Houseplant_5', 1.2]], rug: [['q_Carpet_1', 2.2], ['i_WoolCarpet1', 2.4]], painting: [['h_Painting', .9], ['i_PaintingCanvas1', .9]], clock: [['h_Grandfathers_clock', 2.0]], fireplace: [['i_Fireplace1', 1.5]],
  fridge: [['c_fridge', 1.9], ['h_Refrigirator', 1.8]], stove: [['h_Stove', .95], ['i_GasStove1', .95]], counter: [['c_countertop_straight_A', 1.5], ['c_countertop_straight_C', 1.5]], sink: [['c_countertop_sink', 1.6]], wallcab: [['c_wall_cabinet_straight', 1.5]],
  toilet: [['q_Bathroom_Toilet', .8]], bsink: [['q_Bathroom_Sink', .9], ['h_Bathroom_sink', .9]], bath: [['h_Bathtub', 1.8]], coatrack: [['h_Coat_rack', 1.8]], safe: [['h_Safe', .6]], books: [['h_Books', .3]], candle: [['h_Candlestick', .3]], globe: [['h_Globe', .5]],
};
const FRONT = { bed: 'head', wardrobe: 'front', dresser: 'front', shelf: 'front', fridge: 'front', stove: 'front', counter: 'front', sink: 'front', couch: 'front', desk: 'front', fireplace: 'front', clock: 'front', toilet: 'back', bsink: 'front', bath: 'side', nightstand: 'front', wallcab: 'front' };

// Returns [{role, file, size, x, z, y, rot, kind}] for one house. rot: rotation around Y so that +Z of the item faces the room interior wall-normal.
export function furnish(plan) {
  const items = [], { seed } = plan; let idx = 0; const R = () => rnd(seed, 500 + idx++), pick = role => { const c = CATALOG[role]; const p = c[Math.floor(R() * c.length)]; return p; };
  const add = (role, x, z, rot, opts = {}) => { const [file, size] = opts.pick || pick(role); items.push({ role, file, size: size * (opts.k || 1), x, z, y: opts.y || 0, rot, ...opts }); };
  const face = { n: Math.PI, s: 0, e: -Math.PI / 2, w: Math.PI / 2 };                  // rot when an item's front faces north(-z)... (+Z faces the given direction)
  for (const r of plan.rooms) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, m = .12, t = r.type;
    // helpers: place along a wall. side 'n' = wall at z0 (item front faces +z), 's' = wall at z1 (front faces -z), 'w' = x0 (front +x), 'e' = x1 (front -x)
    const along = (side, role, u, opts = {}) => {
      const it = (opts.pick || CATALOG[role][0]), depth = (opts.depth ?? (it[1] * .42)) + m;
      if (side === 'n') add(role, u, r.z0 + depth, 0, { ...opts, wall: 'n' }); else if (side === 's') add(role, u, r.z1 - depth, Math.PI, { ...opts, wall: 's' }); else if (side === 'w') add(role, r.x0 + depth, u, Math.PI / 2, { ...opts, wall: 'w' }); else add(role, r.x1 - depth, u, -Math.PI / 2, { ...opts, wall: 'e' });
    };
    const longSide = w >= d ? ['n', 's'] : ['w', 'e'], lenAlong = w >= d ? w : d, mid = w >= d ? cx : cz, other = side => side === 'n' ? 's' : side === 's' ? 'n' : side === 'w' ? 'e' : 'w';
    const backWall = r.z0 < 0 && r.z1 < plan.D / 2 - .5 ? 'n' : longSide[0];
    if (t === 'living') {
      along(backWall, 'couch', mid, { depth: .55 }); along(backWall, 'lamp', mid - (lenAlong / 2 - .6), { depth: .3 }); along(backWall, 'plant', mid + (lenAlong / 2 - .6), { depth: .3 });
      add('rug', cx, cz, 0, { k: 1, flat: true }); add('table', cx + (w >= d ? 0 : .3), cz + (backWall === 'n' ? 1.2 : -1.2) * .9, 0, { interact: 'none' });
      if (lenAlong > 4.5) along(other(backWall), 'shelf', mid - lenAlong / 4, { depth: .3 }); if (lenAlong > 5.6) along(other(backWall), 'clock', mid + lenAlong / 4, { depth: .3 }); add('armchair', cx + lenAlong * .3 * (w >= d ? 1 : 0), cz, w >= d ? -Math.PI / 2 : 0, { interact: 'sit' });
      if (w * d > 24) add('fireplace', r.x0 + .35, cz, Math.PI / 2, { interact: 'fire' });
    } else if (t === 'kitchen') {
      const s = backWall; const start = mid - lenAlong / 2 + 1.0; along(s, 'fridge', start, { depth: .35 }); along(s, 'counter', start + 1.35, { depth: .4 }); along(s, 'sink', start + 2.95, { depth: .4, interact: 'sink' }); along(s, 'stove', start + 4.4, { depth: .4, interact: 'stove' }); if (lenAlong > 6.2) along(s, 'counter', start + 5.5, { depth: .4 });
      add('table', cx, cz + (s === 'n' ? 1.1 : -1.1), 0, {}); for (const [dx, dz, ry] of [[-.8, 0, Math.PI / 2 * -1], [.8, 0, Math.PI / 2], [0, -.75, 0], [0, .75, Math.PI]]) add('chair', cx + dx, cz + (s === 'n' ? 1.1 : -1.1) + dz, ry, { interact: 'sit' });
    } else if (t === 'bedroom') {
      const s = longSide[Math.floor(R() * 2)], b = s; along(b, 'bed', mid, { interact: 'sleep', depth: 1.0 }); along(b, 'nightstand', mid - 1.3, { depth: .3 }); along(b, 'nightstand', mid + 1.3, { depth: .3 });
      const o = other(b); along(o, 'wardrobe', mid - lenAlong / 4, { depth: .4, interact: 'search' }); along(o, 'dresser', mid + lenAlong / 4, { depth: .3, interact: 'search' }); add('rug', cx, cz, 0, { flat: true }); if (R() < .6) along(o, 'plant', mid + lenAlong / 2 - .6, { depth: .25 });
    } else if (t === 'study') {
      const s = longSide[0]; along(s, 'desk', mid, { depth: .5, interact: 'search' }); add('deskchair', cx, cz + (s === 'n' ? .9 : -.9), s === 'n' ? 0 : Math.PI, { interact: 'sit' }); along(other(s), 'shelf', mid - lenAlong / 4, { depth: .3, interact: 'read' }); along(other(s), 'shelf', mid + lenAlong / 4, { depth: .3, interact: 'read' }); if (R() < .6) add('globe', cx + 1, cz, 0, {}); along(s, 'lamp', mid + lenAlong / 2 - .5, { depth: .3 });
    } else if (t === 'bathroom') {
      const s = longSide[0]; along(s, 'bath', mid - lenAlong / 4, { depth: .5 }); along(s, 'toilet', mid + lenAlong / 4, { depth: .3 }); along(other(s), 'bsink', mid, { depth: .3 });
    }
  }
  // entrance: coat rack near the front door
  items.push({ role: 'coatrack', file: 'h_Coat_rack', size: 1.8, x: plan.fx + 1.3, z: plan.D / 2 - .6, y: 0, rot: Math.PI });
  for (const it of items) it.y = (it.y || 0) + FLOOR_Y;
  return items;
}
