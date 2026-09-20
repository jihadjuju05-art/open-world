import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/horse.js', [
("    this.speed += (want - this.speed) * Math.min(1, dt * (Math.abs(want) > Math.abs(this.speed) ? 1.6 : 3.2));",
 """    const g0 = T.height(this.pos.x, this.pos.z), depth = Math.max(0, -g0); this.depth = depth; this.swimming = depth > 1.05;       // wades through shallows, swims (with or without rider) when it is deep
    want *= this.swimming ? .5 : 1 - Math.min(.35, depth * .3);
    this.speed += (want - this.speed) * Math.min(1, dt * (Math.abs(want) > Math.abs(this.speed) ? 1.6 : 3.2));"""),
("      if (nh < -.9 || Math.abs(nh - this.pos.y) > .8 + Math.abs(this.speed) * dt) { this.speed *= .2; } else { this.pos.x = nx; this.pos.z = nz; }",
 "      const wet = nh < -.1 || g0 < -.1;\n      if (!wet && Math.abs(nh - this.pos.y) > .8 + Math.abs(this.speed) * dt) { this.speed *= .2; } else { this.pos.x = nx; this.pos.z = nz; }\n      if (depth > .12) { const rv = T.riverAt(this.pos.x, this.pos.z), push = rv.t * (.6 + .5 * Math.min(1, depth)); this.pos.x += rv.fx * push * dt; this.pos.z += rv.fz * push * dt; }      // river current"),
("    this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 14);", "    const yT = this.swimming ? -.85 + Math.sin(performance.now() * .002) * .04 : gh; this.pos.y += (yT - this.pos.y) * Math.min(1, dt * (this.swimming ? 6 : 14));"),
("this.pitch += (Math.atan2(T.height(this.pos.x - f, this.pos.z - ff) - T.height(this.pos.x + f, this.pos.z + ff), 1.8) - this.pitch) * Math.min(1, dt * 6);",
 "this.pitch += ((this.swimming ? 0 : Math.atan2(T.height(this.pos.x - f, this.pos.z - ff) - T.height(this.pos.x + f, this.pos.z + ff), 1.8)) - this.pitch) * Math.min(1, dt * 6);"),
("    } else if (this.distance > 14 && this.distance < 90) { this.mode = 'come'; }", "    } else if (this.distance > 14 && this.distance < 160) { this.mode = 'come'; }"),
("this.play(this.gait === 'gallop' ? 'run' : this.gait === 'idle' ? 'idle' : 'walk', this.gait === 'trot' ? 1.75 :", "this.play(this.gait === 'gallop' && !this.swimming ? 'run' : this.gait === 'idle' ? 'idle' : 'walk', this.swimming ? .9 : this.gait === 'trot' ? 1.75 :"),
])
print('ok')
