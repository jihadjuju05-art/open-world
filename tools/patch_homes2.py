import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/heightfield.js', [
("import { buildPlan, BLD_NAMES, WORLD_R } from './settlements.js';", "import { buildPlan, BLD_NAMES, WORLD_R } from './settlements.js';\nimport { SIZES, STYLES } from './housedata.js';"),
("bld.push(BLD_NAMES.indexOf(it.t), it.x - ox, it.z - oz, height(it.x, it.z) - .12, it.rot, it.sc);", "bld.push(BLD_NAMES.indexOf(it.t), it.x - ox, it.z - oz, height(it.x, it.z) - .05, it.rot, it.sc, it.hp ? it.hp.seed : 0, it.hp ? STYLES.indexOf(it.hp.style) * 10 + Object.keys(SIZES).indexOf(it.hp.size) : -1);"),
])

edit('src/terrain.js', [
("import { BLD, BLD_NAMES } from './settlements.js';", "import { BLD, BLD_NAMES } from './settlements.js';\nimport { getShell, STYLES, SIZES } from './housegen.js';\nconst SIZE_KEYS = Object.keys(SIZES);"),
# colliders in onChunk
("    for (let i = 0; i < m.bld.length; i += 6) {                                     // buildings collide as oriented boxes fitted to the model bounds\n      const [proto, target, cr] = BLD[BLD_NAMES[m.bld[i]]]; if (cr <= 0) continue;",
 """    for (let i = 0; i < m.bld.length; i += 8) {                                     // buildings collide as oriented boxes fitted to the model bounds
      if (BLD_NAMES[m.bld[i]] === 'home') {                                          // procedural house: one box per wall piece + a blocker per door
        const sh = getShell(m.bld[i + 6], STYLES[Math.floor(m.bld[i + 7] / 10)], SIZE_KEYS[m.bld[i + 7] % 10]), th = m.bld[i + 4], c0 = Math.cos(th), s0 = Math.sin(th), bx = ox + m.bld[i + 1], bz = oz + m.bld[i + 2], info = { doorCols: {} };
        for (const w of sh.colliders) rocks.push({ x: bx + (w.x * c0 + w.z * s0), z: bz + (-w.x * s0 + w.z * c0), r: 0, obb: { hx: w.hx, hz: w.hz, c: c0, s: s0, h: 3 } });
        for (const d of sh.doors) { const lx = d.ax === 'z' ? (d.u0 + d.u1) / 2 : d.c, lz = d.ax === 'z' ? d.c : (d.u0 + d.u1) / 2, e = { x: bx + (lx * c0 + lz * s0), z: bz + (-lx * s0 + lz * c0), r: 0, open: false, obb: { hx: d.ax === 'z' ? (d.u1 - d.u0) / 2 : .07, hz: d.ax === 'z' ? .07 : (d.u1 - d.u0) / 2, c: c0, s: s0, h: 2.3 } }; rocks.push(e); info.doorCols[d.id] = e; }
        this.homeCol.set(Math.round(bx) + ',' + Math.round(bz), info); continue;
      }
      const [proto, target, cr] = BLD[BLD_NAMES[m.bld[i]]]; if (cr <= 0) continue;"""),
("    this.chunks = new Map(); this.pending = new Map();", "    this.homeCol = new Map(); this.houses = null; this.chunks = new Map(); this.pending = new Map();"),
# pushOut: skip open door blockers
("    for (const r of n.rocks) {\n      const dx = pos.x - r.x, dz = pos.z - r.z;\n      if (r.obb) {", "    for (const r of n.rocks) {\n      if (r.open) continue; const dx = pos.x - r.x, dz = pos.z - r.z;\n      if (r.obb) {"),
])
print('ok')
