import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/enemies.js', [
("    const alive = pc.alive && !this.mgr.player.mounted || (this.mgr.player.mounted && d < 30);\n", ""),
("    void alive;\n", ""),
("const ps = bodySpheres(this.mgr.player.gltf), h = bladeHit(b, ps)", "const ps = pc.spheres(), h = bladeHit(b, ps)"),
# puppet update + snapshot helpers
("  update(dt, P, pc) {\n", """  // Puppets (clients in a co-op session) only follow the host's snapshots.
  applyNet(m) {
    this.tpos = this.tpos || new V3(); this.tpos.set(m.x, this.mgr.terrain.height(m.x, m.z), m.z); this.tyaw = m.yaw; this.net = m; this.lastNet = performance.now(); const hpNew = m.hp * this.maxHp; if (hpNew < this.hp - 1) this.hpFlash = 1; this.hp = hpNew;
    if (m.dead && !this.dead) { this.dead = true; this.body.startAction('Death01', { fade: .1 }); this.t = 0; }
  }
  updatePuppet(dt) {
    const m = this.net, b = this.body; if (!m || !this.tpos) { this.sync(dt); return; }
    const k = 1 - Math.exp(-10 * dt), moved = this.pos.distanceTo(this.tpos) / Math.max(dt, .001); this.pos.lerp(this.tpos, k); this.yaw += angDiff(this.tyaw, this.yaw) * k;
    if (!this.dead) {
      if (m.ac) { if (this.puppetAc !== m.ac) { this.puppetAc = m.ac; b.startAction(m.ac, { fade: .08, rate: m.ac.startsWith('Sword_Regular') ? .85 * .8 : m.ac === 'Sword_Attack' ? .95 * .8 : m.ac === 'Sword_Block' ? 2.2 : 1 }); } if (m.ac === 'Sword_Block' && b.actionProgress() > .38) for (const mx of b.mixers) mx.timeScale = 0; }
      else { if (this.puppetAc) { this.puppetAc = null; b.endAction(); } this.anim(moved > 4.5 ? 'Sprint_Loop' : moved > 2.2 ? 'Jog_Fwd_Loop' : moved > .5 ? 'Walk_Loop' : m.st === 'fight' ? 'Sword_Idle' : 'Idle_Loop', moved > 4.5 ? .8 : moved > 2.2 ? .75 : 1); }
    } else this.t -= dt;
    this.sync(dt);
  }
  update(dt, P, pc) {
    if (this.puppet) { this.updatePuppet(dt); return; }
"""),
("  dispose() { this.mgr.scene.remove(this.body.root); this.bar.remove(); }", "  dispose() { this.mgr.scene.remove(this.body.root); this.bar.remove(); }\n  snap() { return { id: this.id, x: +this.pos.x.toFixed(2), z: +this.pos.z.toFixed(2), yaw: +this.yaw.toFixed(2), st: this.state, hp: +(Math.max(0, this.hp) / this.maxHp).toFixed(2), ac: this.body.action?.name || '', dead: this.dead ? 1 : 0, c: this.camp.id, k: +this.id.split('_')[1] }; }"),
("  constructor(mgr, camp, k) {\n    this.mgr = mgr;", "  constructor(mgr, camp, k, puppet = false) {\n    this.puppet = puppet; this.mgr = mgr;"),
# manager: targets, puppets, authority
("    Object.assign(this, { scene, terrain, player, combat, assets, camera }); this.plan = plan;",
 "    Object.assign(this, { scene, terrain, player, combat, assets, camera }); this.plan = plan; this.puppetMode = false; this.extraTargets = () => []; this.snapT = 0;\n    this.local = { get pos() { return player.pos; }, get alive() { return combat.alive; }, get state() { return combat.state; }, takeHit: i => combat.takeHit(i), spheres: () => bodySpheres(player.gltf) };"),
("  get targets() { return this.list.filter(e => !e.dead); }", """  get targets() { return this.list.filter(e => !e.dead); }
  allTargets() { const a = []; if (this.combat.alive) a.push(this.local); for (const t of this.extraTargets()) if (t.alive) a.push(t); return a; }
  nearestTarget(e) { let best = null, bd = 1e9; for (const t of this.allTargets()) { const d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z); if (d < bd) { bd = d; best = t; } } return best || this.local; }
  // ---- co-op networking: the host owns the enemies, clients render puppets ----
  snapshot() { const P = this.player.pos; return this.list.filter(e => Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 200 || this.allTargets().some(t => Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) < 200)).map(e => e.snap()); }
  applySnapshot(list) {
    for (const m of list) {
      let e = this.list.find(x => x.id === m.id); if (!e) { const camp = this.plan.settlements[m.c]; if (!camp) continue; e = new Bandit(this, camp, m.k, true); e.pos.set(m.x, this.terrain.height(m.x, m.z), m.z); this.list.push(e); }
      e.applyNet(m);
    }
    const now = performance.now(); for (const e of this.list.slice()) if (e.puppet && now - (e.lastNet || now) > 2500) { e.dispose(); this.list.splice(this.list.indexOf(e), 1); }
  }"""),
("    const P = this.player.pos;\n    if ((this.scan -= dt) <= 0) {", "    const P = this.player.pos;\n    if (this.puppetMode) { for (const e of this.list.slice()) { e.update(dt); if (e.dead && e.t < -8) { e.dispose(); this.list.splice(this.list.indexOf(e), 1); } } return; }\n    if ((this.scan -= dt) <= 0) {"),
("        if (s.type !== 4) continue; const d = Math.hypot(s.x - P.x, s.z - P.z), have = this.byCamp.get(s.id);",
 "        if (s.type !== 4) continue; const d = Math.min(Math.hypot(s.x - P.x, s.z - P.z), ...this.extraTargets().map(t => Math.hypot(s.x - t.pos.x, s.z - t.pos.z))), have = this.byCamp.get(s.id);"),
("      e.update(dt, P, this.combat);", "      const tg = this.nearestTarget(e); e.update(dt, tg.pos, tg);"),
])
print('ok')
