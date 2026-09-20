import os
base = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\src'
def edit(fn, pairs):
    path = os.path.join(base, fn); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (fn, o[:80], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
edit('terrain.js', [
    ("    let t = d <= 1.7 ? 0 : d <= 3.7 ? 1 : 2;\n    if (cur === 0 && d <= 2.2) t = 0; else if (cur === 1 && d > 1.3 && d <= 4.2) t = 1;",
     "    let t = d <= 1.3 ? 0 : d <= 3.2 ? 1 : 2;\n    if (cur === 0 && d <= 1.7) t = 0; else if (cur === 1 && d > 1.0 && d <= 3.7) t = 1;"),
    ("plantsOn = d <= (c.plantsOn ? 2.6 : 2.2);", "plantsOn = d <= (c.plantsOn ? 2.1 : 1.7);"),
    ("tier: this.tierFor(d, -1), plantsOn: d <= 2.2 };", "tier: this.tierFor(d, -1), plantsOn: d <= 1.7 };"),
    ("name = names[Math.floor(fract(v * 137.13) * names.length) % names.length];",
     "name = names[Math.floor(fract(v * 137.13) * (c.tier === 0 ? names.length : Math.min(2, names.length))) % names.length];"),
    ("H = { 0: 1.2, 1: .9, 2: .55, 3: .55, 4: .28, 5: .35 };", "H = { 0: 1.15, 1: .75, 2: .5, 3: .5, 4: .18, 5: .3 };"),
    ("const total = G.length / 5, n = Math.max(1, Math.floor(total * this.q.grassDensity)); if (!total) return;",
     "const total = G.length / 5, n = Math.max(1, Math.floor(total * this.q.grassDensity * .2)); if (!total) return;      // clumps are big and detailed: ~450 per chunk is enough"),
    ("      s.setScalar(G[i + 3] * (pr ? 1.3 : 1)); p.set(G[i], G[i + 2] - .03, G[i + 1]);",
     "      s.setScalar(pr ? Math.max(.15, (.4 + fract(rot * 3.1) * .35) * G[i + 3] / Math.max(.2, pr.height)) : G[i + 3]); p.set(G[i], G[i + 2] - .03, G[i + 1]);"),
])
edit('vegetation.js', [
    ("export const ROCK_SET = { big: ['namaqualand_boulder_02', 'Rock_Medium_1', 'Rock_Medium_2'], small: ['rock_07', 'rock_09', 'Rock_Medium_3'], stump: ['tree_stump_01', 'dead_tree_trunk'] };",
     "export const ROCK_SET = { big: ['namaqualand_boulder_02', 'Rock_Medium_1', 'Rock_Medium_2'], small: ['rock_07', 'Rock_Medium_3'], stump: ['tree_stump_01'] };"),
    ("export const GRASS_SET = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall'];", "export const GRASS_SET = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short'];"),
])
print('ok')
