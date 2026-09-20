import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
edit('src/heightfield.js', [
("""    const ox = cx * CHUNK, oz = cz * CHUNK, CELL = 5.5, n = Math.floor(CHUNK / CELL), trees = [], rocks = [], grass = [];""",
"""    const ox = cx * CHUNK, oz = cz * CHUNK, CELL = 5.5, n = Math.floor(CHUNK / CELL), trees = [], rocks = [], grass = [], P = plan();
    const noTree = (x, z) => { const st = P.settlementAt(x, z); return (st && st.d < 1.08) || P.roadAt(x, z).d < 6; };
    const noGround = (x, z) => { const st = P.settlementAt(x, z); return (st && st.d < .75) || P.roadAt(x, z).d < 3.2; };"""),
("""      const h = height(x, z); if (h < 2) continue;
      const rv = river(x, z); if (rv.t > .02) continue;""",
"""      const h = height(x, z); if (h < 2 || noTree(x, z)) continue;
      const rv = river(x, z); if (rv.t > .02) continue;"""),
("""      if (h < 2.2 || h > 55) continue; if (river(x, z).t > .02 || slope(x, z) > .45) continue;""",
"""      if (h < 2.2 || h > 55 || noGround(x, z)) continue; if (river(x, z).t > .02 || slope(x, z) > .45) continue;"""),
("""        const x = ox + lx, z = oz + lz, h = height(x, z); if (h < 1.9 || h > 60) continue;""",
"""        const x = ox + lx, z = oz + lz, h = height(x, z); if (h < 1.9 || h > 60 || noGround(x, z)) continue;"""),
("""    return { trees, rocks, grass, plants };""",
"""    const bld = []; for (const it of P.buildingsForChunk(cx, cz)) bld.push(BLD_NAMES.indexOf(it.t), it.x - ox, it.z - oz, height(it.x, it.z) - .12, it.rot, it.sc);
    return { trees, rocks, grass, plants, bld };"""),
("""  return { height, baseHeight, river, slope, color, vegetation, forest };""",
"""  return { height, baseHeight, river, slope, color, vegetation, forest, plan };"""),
])
print('ok')
