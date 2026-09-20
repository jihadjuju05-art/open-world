import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
p = os.path.join(root, 'src/player.js'); s = open(p, encoding='utf-8').read()
a = s.index("  rideUpdate(dt) {"); b = s.index("  spawnNearOrigin() {")
s = s[:a] + "  rideUpdate(dt) {\n    this.state = 'ride'; this.grounded = true; this.swimming = false; this.wading = 0; this.depth = 0;\n    if (this.gltf) this.mounted.ride(dt);\n  }\n" + s[b:]
open(p, 'w', encoding='utf-8').write(s)
edit('src/main.js', [
("if (horse.mounted) { horse.update(dt, { x: input.x, z: input.z, gait: input.gait }); player.rideUpdate(dt); wading = 0; }", "if (horse.riding) { horse.update(dt, { x: input.x, z: input.z, gait: input.gait }); player.rideUpdate(dt); wading = 0; }"),
("if (e.code === 'KeyE') { if (horse.mounted || !npcs?.nearest) horse.toggleMount(); else npcs.interact(); }", "if (e.code === 'KeyE') { if (horse.riding || !npcs?.nearest) horse.toggleMount(); else npcs.interact(); }"),
])
print('ok')
