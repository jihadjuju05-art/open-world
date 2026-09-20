import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/heightfield.js', [
("import { makeNoise, fbm, hash2, smoothstep } from './noise.js';",
 "import { makeNoise, fbm, hash2, smoothstep } from './noise.js';\nimport { buildPlan, BLD_NAMES, WORLD_R } from './settlements.js';"),
("""  function baseHeight(x, z) {
    const cont = fbm(nCont, x * .0007, z * .0007, 3), hills = fbm(nHill, x * .0045, z * .0045, 4);
    const ridge = 1 - Math.abs(fbm(nRidge, x * .0016, z * .0016, 4));
    const mask = smoothstep(.3, .72, fbm(nMask, x * .0005 + 9.1, z * .0005 - 4.3, 2) * .5 + .5);          // mountains only in some regions
    return 3 + cont * 30 + hills * 8 + mask * ridge * ridge * ridge * 150;
  }""",
"""  // Designed geography: three mountain ranges, a lone peak, a lake basin and a mountain rim that closes the world.
  const RANGES = [{ p: [[-4200, -2900], [-2000, -3300], [0, -2800], [2200, -3300], [4200, -2700]], w: 520 }, { p: [[-3300, -3500], [-3600, -800], [-3200, 1500], [-3700, 3500]], w: 420 }, { p: [[3700, -1500], [3300, 300], [3800, 2000]], w: 360 }];
  const segDist = (px, pz, pts) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az; let t = ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t; best = Math.min(best, Math.hypot(px - ax - dx * t, pz - az - dz * t)); } return best; };
  function baseHeight(x, z) {
    const wx = x + fbm(nMask, x * .0015 + 3, z * .0015, 2) * 260, wz = z + fbm(nMask, x * .0015, z * .0015 + 9, 2) * 260;
    let m = 0; for (const r of RANGES) m = Math.max(m, 1 - smoothstep(r.w * .15, r.w * 1.6, segDist(wx, wz, r.p)));
    m = Math.max(m, 1 - smoothstep(60, 520, Math.hypot(wx - 700, wz - 900)), smoothstep(3700, 4500, Math.hypot(x, z)));
    const cont = fbm(nCont, x * .0007, z * .0007, 3), hills = fbm(nHill, x * .0045, z * .0045, 4), ridge = 1 - Math.abs(fbm(nRidge, x * .004, z * .004, 4));
    const lake = 1 - smoothstep(250, 700, Math.hypot(x - 1500, z - 1900));
    return 5 + cont * 10 + hills * 5 + m * m * (30 + 145 * ridge * ridge) - lake * lake * 20;
  }"""),
("""  function height(x, z) {
    const b = baseHeight(x, z), p = riverParts(x, z, b);""",
"""  function rawHeight(x, z) {
    const b = baseHeight(x, z), p = riverParts(x, z, b);"""),
("""  function river(x, z) {                         // { t: 0..1 channel amount, fx, fz: flow direction }""",
"""  // Settlements flatten the ground, roads follow a smoothed profile (rivers become shallow fords where a road crosses).
  let _plan = null; const plan = () => _plan || (_plan = buildPlan(seed, { h: rawHeight, slope: (x, z) => { const e = 3; return Math.hypot(rawHeight(x + e, z) - rawHeight(x - e, z), rawHeight(x, z + e) - rawHeight(x, z - e)) / (2 * e); }, river: (x, z) => riverParts(x, z, baseHeight(x, z)) }));
  function height(x, z) {
    let h = rawHeight(x, z); const P = plan(), st = P.settlementAt(x, z);
    if (st) { const w = 1 - smoothstep(.8, 1.45, st.d); if (w > 0) h += (st.s.h - h) * w; }
    const rd = P.roadAt(x, z); if (rd.d < 14) { const w = 1 - smoothstep(3, 14, rd.d); h += (Math.max(rd.h, -.3) - h) * w * w * (3 - 2 * w) ; }
    return h;
  }
  function river(x, z) {                         // { t: 0..1 channel amount, fx, fz: flow direction }"""),
# roads/towns on the ground colour + splat
("""  function color(h, slp, x, z, riverT, out, o) {""",
"""  function color(h, slp, x, z, riverT, out, o) {
    const P = plan(), rd = P.roadAt(x, z), st = P.settlementAt(x, z);
    const roadW = rd.d < 8 ? 1 - smoothstep(.5, 5.5 + rd.w * .2, rd.d) : 0, townW = st ? (1 - smoothstep(.35, .95, st.d)) * (st.s.type > 2 ? .55 : .8) * (.6 + .4 * hash2(x * .5, z * .5, 3)) : 0, packed = Math.max(roadW, townW);"""),
("""    out[o] = R; out[o + 1] = G; out[o + 2] = B;
    // texture splat""",
"""    if (packed > 0 && h > .3) { const k = .1 * hash2(x * 2, z * 2, 7); R = mix(R, .40 + k, packed * .85); G = mix(G, .31 + k, packed * .85); B = mix(B, .2 + k * .6, packed * .85); }
    out[o] = R; out[o + 1] = G; out[o + 2] = B;
    // texture splat"""),
("""    wRock = Math.min(1, wRock); const rest""",
"""    if (packed > 0 && h > .3) { wDirt = Math.max(wDirt, packed); wRock = Math.min(wRock, 1 - packed * .8); wSand *= 1 - packed; }
    wRock = Math.min(1, wRock); const rest"""),
])
print('ok')
