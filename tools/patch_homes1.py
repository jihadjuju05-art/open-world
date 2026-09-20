import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/housegen.js', [
("// Builds the shell: returns", "const SHELLS = new Map();\nexport function getShell(seed, style, sizeKey) { const k = seed + '|' + style + '|' + sizeKey; let s = SHELLS.get(k); if (!s) SHELLS.set(k, s = buildShell(planHouse(seed, style, sizeKey))); return s; }\n// Builds the shell: returns"),
])
edit('src/houses.js', [
("import { planHouse, buildShell, furnish, STYLES, SIZES, WALL_HEIGHT } from './housegen.js';", "import { getShell, furnish, STYLES, SIZES, WALL_HEIGHT } from './housegen.js';"),
("  shell(seed, style, size) { const k = seed + style + size; let s = this.shellCache.get(k); if (!s) { const plan = planHouse(seed, style, size); s = buildShell(plan); s.items = null; this.shellCache.set(k, s); } return s; }", "  shell(seed, style, size) { return getShell(seed, style, size); }"),
("  constructor({ scene, terrain, player, combat, sky, camera, toast, setPrompt }) {\n    Object.assign(this, { scene, terrain, player, combat, sky, camera, toast, setPrompt });", "  constructor({ scene, terrain, sky }) {\n    Object.assign(this, { scene, terrain, sky }); this.player = { pos: new THREE.Vector3(1e6, 0, 1e6), yaw: 0 }; this.combat = { busy: false };"),
("  // ---- materials ----", "  bind({ player, combat, camera, toast }) { Object.assign(this, { player, combat, camera, toast }); }\n  // ---- materials ----"),
])

# ---------------------------------------------------------------- settlements: homes
edit('src/settlements.js', [
("import { hash2, smoothstep } from './noise.js';", "import { hash2, smoothstep } from './noise.js';\nimport { SIZES, STYLES } from './housegen.js';"),
("  fence: ['props/far_Fence', 5.9, 0],", "  home: ['props/none', 10, 0], fence: ['props/far_Fence', 5.9, 0],"),
("  const put = (s, type, x, z, rot, sc = 1) => {\n    const h = H(x, z); if (h < 1 || S(x, z) > .5) return false; const it = { t: type, x, z, rot, sc, s: s.id }; s.items.push(it);",
 "  const put = (s, type, x, z, rot, sc = 1, hp = null) => {\n    const h = H(x, z); if (h < 1 || S(x, z) > .5) return false; const it = { t: type, x, z, rot, sc, s: s.id, hp }; s.items.push(it);"),
])
print('ok')
