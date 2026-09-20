import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
edit('src/vegetation.js', [
("        const g = await loader.loadAsync(M + n + '.glb'), cat = /Tree|Pine/.test(n) ? 'tree'",
 "        const g = await loader.loadAsync(n.includes('/') ? 'assets/' + n + '.glb' : M + n + '.glb'), cat = n.startsWith('props/') ? 'prop' : /Tree|Pine/.test(n) ? 'tree'"),
])
edit('src/terrain.js', [
("import { createHeightField", "import { BLD, BLD_NAMES } from './settlements.js';\nimport { createHeightField"),
("    for (let i = 0; i < m.rocks.length; i += 5) rocks.push({ x: ox + m.rocks[i], z: oz + m.rocks[i + 1], r: m.rocks[i + 3] * 1.15 });",
 "    for (let i = 0; i < m.rocks.length; i += 5) rocks.push({ x: ox + m.rocks[i], z: oz + m.rocks[i + 1], r: m.rocks[i + 3] * 1.15 });\n    for (let i = 0; i < m.bld.length; i += 6) { const r = BLD[BLD_NAMES[m.bld[i]]][2]; if (r > 0) rocks.push({ x: ox + m.bld[i + 1], z: oz + m.bld[i + 2], r, building: true }); }"),
("data: { trees: m.trees, rocks: m.rocks, plants: m.plants },", "data: { trees: m.trees, rocks: m.rocks, plants: m.plants, bld: m.bld },"),
("    // --- rocks / boulders\n    const R5 = D.rocks, rg = new Map();",
"""    // --- buildings (villages, farms, camps)
    if (veg && D.bld.length) {
      const bg = new Map(), B6 = D.bld;
      for (let i = 0; i < B6.length; i += 6) {
        const key = BLD_NAMES[B6[i]], [proto, target] = BLD[key], pr = veg.get(proto); if (!pr) continue;
        const size = pr.box.getSize(new THREE.Vector3()), k = target / Math.max(.01, Math.max(size.x, size.z)) * B6[i + 5];
        q.setFromAxisAngle(up, B6[i + 4]); s.setScalar(k); p.set(B6[i + 1], B6[i + 3] - pr.box.min.y * k - .1, B6[i + 2]); mtx.compose(p, q, s);
        const v = fract(B6[i + 1] * 12.9 + B6[i + 2] * 7.7); col.setRGB(.88 + v * .2, .88 + fract(v * 7) * .2, .88 + fract(v * 13) * .2);
        if (!bg.has(key)) bg.set(key, { pr, list: [] }); bg.get(key).list.push({ matrix: mtx.clone(), color: col.clone() });
      }
      for (const { pr, list } of bg.values()) this.addInstances(c, g, pr, list);
    }
    // --- rocks / boulders
    const R5 = D.rocks, rg = new Map();"""),
])
print('ok')
