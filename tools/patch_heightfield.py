import os
base = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\src'

def edit(fn, pairs):
    path = os.path.join(base, fn); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (fn, o[:80], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('heightfield.js', [
    # splat weights (grass, rock, dirt, sand) appended after the RGB colour
    ("    out[o] = R; out[o + 1] = G; out[o + 2] = B;\n  }",
     """    out[o] = R; out[o + 1] = G; out[o + 2] = B;
    // texture splat weights for the PBR terrain shader: [grass, rock, dirt/path, sand]
    let wSand = smoothstep(2.4, 1.1, h), wRock = rock, wDirt = h < 1.7 ? 0 : Math.max(0, mix(0, .9, smoothstep(.06, 0, Math.abs(fbm(nType, x * .004, z * .004, 2)))) * (1 - smoothstep(.3, .6, slp)) + smoothstep(.62, .9, fbm(nColor, x * .006 + 30, z * .006, 2) * .5 + .5) * .35);
    wRock = Math.min(1, wRock); const rest = Math.max(0, 1 - wSand - wRock - wDirt); let sum = rest + wSand + wRock + wDirt || 1;
    out[o + 3] = rest / sum; out[o + 4] = wRock / sum; out[o + 5] = wDirt / sum; out[o + 6] = wSand / sum;
  }"""),
    # plants (bushes, ferns, flowers, mushrooms, clover)
    ("    if (wantGrass) {",
     """    const plants = [], PC = 3.6, np = Math.floor(CHUNK / PC);
    for (let j = 0; j < np; j++) for (let i = 0; i < np; i++) {
      const gi = cx * np + i, gj = cz * np + j, lx = (i + hash2(gi, gj, 31)) * PC, lz = (j + hash2(gi, gj, 32)) * PC, x = ox + lx, z = oz + lz, h = height(x, z);
      if (h < 2.2 || h > 55) continue; if (river(x, z).t > .02 || slope(x, z) > .45) continue;
      const forest = smoothstep(-.05, .3, fbm(nForest, x * .012, z * .012, 3)), r = hash2(gi, gj, 33), s = .8 + hash2(gi, gj, 34) * .7;
      if (forest > .5) { if (r < .22) plants.push(lx, lz, h, s, 1); else if (r < .3) plants.push(lx, lz, h, s * .9, 0); else if (r < .34) plants.push(lx, lz, h, s, 4); }
      else { if (r < .14) plants.push(lx, lz, h, s, 2 + (hash2(gi, gj, 35) < .5 ? 0 : 1)); else if (r < .2) plants.push(lx, lz, h, s, 0); else if (r < .3) plants.push(lx, lz, h, s, 5); }
    }
    if (wantGrass) {"""),
    ("    return { trees, rocks, grass };", "    return { trees, rocks, grass, plants };"),
])
edit('terrain_worker.js', [
    ("tmp = new Float32Array(3);", "tmp = new Float32Array(7), spl = new Float32Array(nv * 4);"),
    ("hf.color(h, 1 - ny / L, x, z, rt, tmp, 0); col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2];",
     "hf.color(h, 1 - ny / L, x, z, rt, tmp, 0); col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2]; spl[k * 4] = tmp[3]; spl[k * 4 + 1] = tmp[4]; spl[k * 4 + 2] = tmp[5]; spl[k * 4 + 3] = tmp[6];"),
    ("nor.copyWithin(dst * 3, src * 3, src * 3 + 3); col.copyWithin(dst * 3, src * 3, src * 3 + 3);", "nor.copyWithin(dst * 3, src * 3, src * 3 + 3); col.copyWithin(dst * 3, src * 3, src * 3 + 3); spl.copyWithin(dst * 4, src * 4, src * 4 + 4);"),
    ("const out = { id, cx, cz, res, terrain: { pos, nor, col } };\n  const transfer = [pos.buffer, nor.buffer, col.buffer];", "const out = { id, cx, cz, res, terrain: { pos, nor, col, spl } };\n  const transfer = [pos.buffer, nor.buffer, col.buffer, spl.buffer];"),
    ("out.trees = new Float32Array(veg.trees); out.rocks = new Float32Array(veg.rocks); out.grass = new Float32Array(veg.grass);\n  transfer.push(out.trees.buffer, out.rocks.buffer, out.grass.buffer);",
     "out.trees = new Float32Array(veg.trees); out.rocks = new Float32Array(veg.rocks); out.grass = new Float32Array(veg.grass); out.plants = new Float32Array(veg.plants);\n  transfer.push(out.trees.buffer, out.rocks.buffer, out.grass.buffer, out.plants.buffer);"),
])
print('ok')
