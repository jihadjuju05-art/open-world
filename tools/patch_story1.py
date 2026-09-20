import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/enemies.js', [
("  constructor(mgr, camp, k, puppet = false) {\n    this.puppet = puppet; this.mgr = mgr;", "  constructor(mgr, camp, k, puppet = false, opts = {}) {\n    this.puppet = puppet; this.boss = !!opts.boss; this.mgr = mgr;"),
("this.body = new GltfBody(mgr.assets, look); this.body.root.scale.setScalar(.92);", "if (this.boss) Object.assign(look, { outfit: 'peasant', tint: '#1e1e24', hat: true, hatColor: '#111114', scarf: true, scarfColor: '#5a1712', beard: true, hair: 'Long', hairColor: '#8a8a8a', skinTone: .35 });\n    this.body = new GltfBody(mgr.assets, look); this.body.root.scale.setScalar(this.boss ? .99 : .92);"),
("this.maxHp = 55; this.hp = this.maxHp;", "this.maxHp = this.boss ? 260 : 55; this.hp = this.maxHp;"),
("this.name = NAMES[Math.floor(hh(seed, 9) * NAMES.length)];", "this.name = this.boss ? 'Silas «El Cuervo»' : NAMES[Math.floor(hh(seed, 9) * NAMES.length)];"),
("dmg: Math.round(s.dmg * .6 * h.mult)", "dmg: Math.round(s.dmg * (this.boss ? .95 : .6) * h.mult)"),
("const heavy = Math.random() < .3, spec", "const heavy = Math.random() < (this.boss ? .45 : .3), spec"),
("this.state = 'idle'; this.t = 1 + hh(seed, 10) * 3;", "this.state = 'idle'; this.t = 1 + hh(seed, 10) * 3; if (this.boss) { this.aggro = false; }"),
("  get targets() { return this.list.filter(e => !e.dead); }", """  get targets() { return this.list.filter(e => !e.dead); }
  // ---- story helpers ----
  spawnAmbush(x, z, n, radius) { const out = []; this.ambushId = (this.ambushId || 900) + 1; const camp = { id: this.ambushId, x, z, type: 4 };
    for (let k = 0; k < n; k++) { const e = new Bandit(this, camp, k); const a = k * 2.1 + Math.random(), r = radius * (.8 + Math.random() * .4); e.pos.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r); e.pos.y = this.terrain.height(e.pos.x, e.pos.z); e.aggro = true; e.state = 'chase'; this.list.push(e); out.push(e); } return out; }
  spawnBoss(camp) { const e = new Bandit(this, camp, 99, false, { boss: true }); e.pos.set(camp.x + 2, 0, camp.z + 2); e.pos.y = this.terrain.height(e.pos.x, e.pos.z); this.list.push(e); return e; }"""),
("      e.update(dt, P, this.combat);", "      e.update(dt, P, this.combat);") if False else ("  allTargets() {", "  allTargets() {"),
])
# guard the boss against auto-aggro range/leash and register kill hooks
edit('src/enemies.js', [
("    if (!this.aggro && d < 20 && pc.alive) this.aggro = true;", "    if (!this.aggro && d < (this.boss ? 0 : 20) && pc.alive) this.aggro = true;"),
("    if (this.aggro && (d > 60 || !pc.alive)) {", "    if (this.aggro && (d > (this.boss ? 140 : 60) || !pc.alive)) {"),
])

edit('index.html', [
('#exitscreen{', """#cine{position:fixed;inset:0;z-index:17;pointer-events:none;display:none}#cine.on{display:block}
#cine:before,#cine:after{content:"";position:absolute;left:0;right:0;height:11vh;background:#000}#cine:before{top:0}#cine:after{bottom:0}
#cinesub{position:fixed;left:50%;bottom:14vh;transform:translateX(-50%);width:min(820px,90vw);z-index:18;text-align:center;font:italic 22px/1.45 Georgia,serif;color:#f5ecd6;text-shadow:0 2px 8px #000,0 0 3px #000;pointer-events:none}
#cinesub b{display:block;font:600 13px system-ui,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#e0a24a;margin-bottom:6px;font-style:normal}
#objective{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:12;background:rgba(20,14,8,.72);border:1px solid #6b5630;padding:6px 16px;color:#f1e6cc;font:14px Georgia,serif;letter-spacing:.5px;max-width:64vw;text-align:center;pointer-events:none}
#journal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:26;width:min(560px,92vw);max-height:78vh;overflow:auto;padding:22px 28px;background:linear-gradient(#211a11,#17120c);border:1px solid #6b5630;box-shadow:0 0 0 4px #17120c,0 0 0 5px #4b3d26,0 20px 60px #000}
#journal h3{margin:0;letter-spacing:6px;color:#e6c98a;font-weight:normal}#journal h4{margin:4px 0 14px;color:#a89a7c;font-weight:normal;font-style:italic}#journal .cur{color:#ffd76a;font-size:16px}#journal li{color:#c9b88f;margin:6px 0;font-size:14px}#journal ul{padding-left:18px;list-style:none}#journal .tip{color:#8f8161;font:12px/1.5 system-ui,sans-serif}
#exitscreen{"""),
('<div id="toast"></div>', '<div id="cine"></div><div id="cinesub"></div><div id="objective" class="hidden"></div><div id="journal" class="hidden"></div>\n<div id="toast"></div>'),
])

edit('src/npc.js', [
("  root(npc) {\n", "  root(npc) {\n    if (npc.def.storyKey && this.story) { const n = this.story.dialogue(npc); if (n !== undefined && (n || npc.def.storyKey === 'amos')) return n; }\n"),
])
print('ok')
