import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/houses.js', [
("import { getShell, furnish, STYLES, SIZES, WALL_HEIGHT } from './housegen.js';", "import { getShell, furnish, STYLES, SIZES, WALL_HEIGHT, FLOOR2_Y, WALL2_H } from './housegen.js';"),
("      if (d.ax === 'z') { leaf.position.set(d.u0 + .02, .18, d.c); } else { leaf.position.set(d.c, .18, d.u0 + .02); leaf.rotation.y = -Math.PI / 2; leaf.userData.rot0 = -Math.PI / 2; }",
 "      if (d.ax === 'z') { leaf.position.set(d.u0 + .02, d.y0, d.c); } else { leaf.position.set(d.c, d.y0, d.u0 + .02); leaf.rotation.y = -Math.PI / 2; leaf.userData.rot0 = -Math.PI / 2; }"),
("    for (const r of plan.rooms) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .05, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); m.position.set((r.x0 + r.x1) / 2, WALL_HEIGHT - .05, (r.z0 + r.z1) / 2); grp.add(m); }",
 "    for (const lv of plan.levels) for (const r of lv.rooms) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .05, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); m.position.set((r.x0 + r.x1) / 2, lv.y0 + lv.h - .12, (r.z0 + r.z1) / 2); grp.add(m); }"),
("for (const inst of near.slice(0, 2)) for (const r of inst.shell.plan.rooms) { if (li >= this.lightPool.length) break; const l = this.lightPool[li++], c = new THREE.Vector3((r.x0 + r.x1) / 2, WALL_HEIGHT - .5, (r.z0 + r.z1) / 2).applyMatrix4(inst.group.matrixWorld);",
 "for (const inst of near.slice(0, 2)) for (const lv of inst.shell.plan.levels) for (const r of lv.rooms) { if (li >= this.lightPool.length) break; const l = this.lightPool[li++], c = new THREE.Vector3((r.x0 + r.x1) / 2, lv.y0 + lv.h - .5, (r.z0 + r.z1) / 2).applyMatrix4(inst.group.matrixWorld);"),
])

edit('src/terrain.js', [
("import { getShell, STYLES, SIZES } from './housegen.js';", "import { getShell, STYLES, SIZES, FLOOR2_Y } from './housegen.js';\nimport { FLOOR_Y } from './housedata.js';"),
("        for (const w of sh.colliders) rocks.push({ x: bx + (w.x * c0 + w.z * s0), z: bz + (-w.x * s0 + w.z * c0), r: 0, obb: { hx: w.hx, hz: w.hz, c: c0, s: s0, h: 3 } });",
 "        const hy = m.bld[i + 3]; homes.push({ x: bx, z: bz, c: c0, s: s0, y: hy, plan: sh.plan });\n        for (const w of sh.colliders) rocks.push({ x: bx + (w.x * c0 + w.z * s0), z: bz + (-w.x * s0 + w.z * c0), r: 0, obb: { hx: w.hx, hz: w.hz, c: c0, s: s0, h: 3, y0: hy + w.y0, y1: hy + w.y1 } });"),
("c: c0, s: s0, h: 2.3 } }; rocks.push(e); info.doorCols[d.id] = e; }", "c: c0, s: s0, h: 2.3, y0: hy + d.y0, y1: hy + d.y1 } }; rocks.push(e); info.doorCols[d.id] = e; }"),
("    for (let i = 0; i < m.bld.length; i += 8) {                                     // buildings collide", "    const homes = []; for (let i = 0; i < m.bld.length; i += 8) {                                     // buildings collide"),
("data: { trees: m.trees, rocks: m.rocks, plants: m.plants, bld: m.bld },", "homes, data: { trees: m.trees, rocks: m.rocks, plants: m.plants, bld: m.bld },"),
# pushOut height-aware
("      if (r.open) continue; const dx = pos.x - r.x, dz = pos.z - r.z;\n      if (r.obb) {", "      if (r.open) continue; const dx = pos.x - r.x, dz = pos.z - r.z;\n      if (r.obb) {\n        if (r.obb.y1 !== undefined && pos.y !== undefined && (pos.y > r.obb.y1 || pos.y + 1.7 < r.obb.y0)) continue;                  // other storey"),
("Math.abs(lz) < hz + .3 && p.y < this.height(r.x, r.z) + h + .3) return true; }", "Math.abs(lz) < hz + .3 && (r.obb.y1 !== undefined ? (p.y > r.obb.y0 - .3 && p.y < r.obb.y1 + .3) : p.y < this.height(r.x, r.z) + h + .3)) return true; }"),
("  insideBuilding(p, n) {", """  // Walkable surface height: terrain, or the floors / staircase / porch of the houses (y = current height, to tell storeys apart).
  nearHomes(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), n = this._nh; if (n && n.cx === cx && n.cz === cz && n.ver === this.version) return n.val;
    const out = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = this.chunks.get((cx + dx) + ',' + (cz + dz)); if (c?.homes) for (const h of c.homes) out.push(h); }
    this._nh = { cx, cz, ver: this.version, val: out }; return out;
  }
  walkY(x, z, y) {
    const h = this.height(x, z), list = this.nearHomes(x, z); if (!list.length) return h;
    for (const H of list) {
      const dx = x - H.x, dz = z - H.z; if (dx * dx + dz * dz > 400) continue; const lx = dx * H.c - dz * H.s, lz = dx * H.s + dz * H.c, pl = H.plan, hw = pl.W / 2 + .11, hd = pl.D / 2 + .11;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
        const f1 = H.y + FLOOR_Y, S = pl.stair;
        if (S) { const f2 = H.y + FLOOR2_Y; if (lx > S.x0 && lx < S.x1 && lz > S.z0 && lz < S.z1) { const t = Math.max(0, Math.min(1, (S.z1 - lz) / (S.z1 - S.z0))); return f1 + t * (f2 - f1); } if (y > f1 + 1.4) return f2; }
        return f1;
      }
      if (lx > pl.fx - 1.6 && lx < pl.fx + 1.6 && lz >= hd - .2 && lz < pl.D / 2 + 1.5) return Math.max(h, H.y + FLOOR_Y * .8);            // porch
    }
    return h;
  }
  insideBuilding(p, n) {"""),
])

edit('src/player.js', [
("    const ground = T.height(this.pos.x, this.pos.z), depth =", "    const ground = T.walkY(this.pos.x, this.pos.z, this.pos.y), depth ="),
("    const newGround = T.height(this.pos.x, this.pos.z), rise = newGround - ground;\n    if (this.grounded && rise > Math.max(.06, this.speed * dt * 1.2)) {", "    const newGround = T.walkY(this.pos.x, this.pos.z, this.pos.y), rise = newGround - ground;\n    if (this.grounded && rise > Math.max(.2, this.speed * dt * 1.2)) {"),
("    T.pushOut(this.pos, .32);\n    const g = T.height(this.pos.x, this.pos.z);", "    T.pushOut(this.pos, .32);\n    const g = T.walkY(this.pos.x, this.pos.z, this.pos.y);"),
])
print('ok')
