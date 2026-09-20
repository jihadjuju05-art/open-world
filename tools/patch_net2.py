import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/net.js', [
("import { GltfBody, DEFAULT_CHAR } from './character.js';", "import { GltfBody, DEFAULT_CHAR } from './character.js';\nimport { bodySpheres } from './combat.js';"),
("  set(m) { this.target.set(m.x, m.y, m.z); this.tyaw = m.yaw; this.st = m.st; this.speed = m.sp; this.rid = m.rd; if (this.first)",
 "  set(m) { this.target.set(m.x, m.y, m.z); this.tyaw = m.yaw; this.st = m.st; this.speed = m.sp; this.rid = m.rd; this.pv = m.pv; this.hp = m.hp ?? 100; if (!!m.dr !== !!this.body.drawn) this.body.setDrawn(!!m.dr);\n    const ac = m.ac || ''; if (ac !== (this.ac || '')) { this.ac = ac; if (ac) { const loop = /Loop$/.test(ac); this.body.startAction(ac, { fade: .1, loop, rate: ac === 'Sword_Block' ? 2.2 : ac === 'Roll' ? 1.45 : ac.startsWith('Sword_Regular') ? .85 : ac === 'Sword_Attack' ? .95 : 1 }); } else this.body.endAction(); }\n    this.acState = /^Sword_(Regular|Attack)/.test(ac) ? 'attack' : ac === 'Sword_Block' ? 'block' : ac === 'Roll' ? 'dodge' : 'free'; if (this.first)"),
("    this.body.play(CLIP[this.st] || 'Idle_Loop', .25, this.st === 'walk' ? Math.max(.6, this.speed / 1.5) : this.st === 'jog' ? Math.max(.7, this.speed / 4.4) : 1); this.body.update(dt);",
 "    if (this.ac && this.ac === 'Sword_Block' && this.body.actionProgress() > .38) for (const m of this.body.mixers) m.timeScale = 0;\n    if (!this.body.action) this.body.play(CLIP[this.st] || 'Idle_Loop', .25, this.st === 'walk' ? Math.max(.6, this.speed / 1.5) : this.st === 'jog' ? Math.max(.7, this.speed / 4.4) : 1); this.body.update(dt);"),
("  constructor({ scene, player, assets, camera, worldMap, getLook, onStatus }) {\n    Object.assign(this, { scene, player, assets, camera, worldMap, getLook, onStatus });",
 "  constructor({ scene, player, assets, camera, worldMap, getLook, onStatus, combat, enemies }) {\n    Object.assign(this, { scene, player, assets, camera, worldMap, getLook, onStatus, combat, enemies }); this.pvp = true;"),
# handle new messages
("    else if (m.t === 'chat') {", """    else if (m.t === 'dmg') { if (m.to === this.myId) this.receiveDmg(m, c); else if (this.role === 'host') this.conns.get(m.to)?.send(m); }
    else if (m.t === 'res') { if (m.to === this.myId) { if (m.res === 'parried') this.combat?.enterStagger(true); } else if (this.role === 'host') this.conns.get(m.to)?.send(m); }
    else if (m.t === 'hitE') { if (this.role === 'host' && this.enemies) { const e = this.enemies.list.find(x => x.id === m.id); if (e && !e.dead) e.takeHit({ dmg: m.dmg, heavy: !!m.heavy, from: new THREE.Vector3(m.fx, 0, m.fz), attacker: { stagger() { } } }); } }
    else if (m.t === 'en') { if (this.role === 'client' && this.enemies) { this.enemies.puppetMode = true; this.enemies.applySnapshot(m.l); } }
    else if (m.t === 'chat') {"""),
("  chat(text) {", """  // ---- combat over the network ----
  // Remote players as attackable targets (duels). Damage is resolved on the victim's machine so dodging and blocking feel fair.
  pvpTargets() {
    if (!this.role || !this.pvp) return []; const out = [];
    for (const r of this.remotes.values()) if (r.pv && !r.first && (r.hp ?? 100) > 0) out.push({ id: 'p:' + r.id, pos: r.pos, dead: false, spheres: () => bodySpheres(r.body), takeHit: info => { this.send(r.id, { t: 'dmg', to: r.id, from: this.myId, dmg: info.dmg, heavy: info.heavy, fx: info.from.x, fz: info.from.z, part: info.part }); return 'hit'; } });
    return out;
  }
  receiveDmg(m, c) {
    if (!this.combat || !this.pvp) return; const self = this; const res = this.combat.takeHit({ dmg: m.dmg, heavy: m.heavy, from: new THREE.Vector3(m.fx, 0, m.fz), attacker: { stagger() { self.send(m.from, { t: 'res', to: m.from, res: 'parried' }); } } });
    if (res === 'dead') this.status('Te ha derrotado ' + (this.remotes.get(m.from)?.name || 'otro jugador') + '.');
  }
  send(to, m) { if (this.role === 'host') this.conns.get(to)?.send(m); else this.conns.get(this.hostId)?.send(m); }
  get hostId() { return 'ow-' + this.code; }
  // Enemies as seen by the host: every remote player is a target for them.
  remoteTargets() { return [...this.remotes.values()].filter(r => !r.first).map(r => ({ id: r.id, pos: r.pos, get alive() { return (r.hp ?? 100) > 0; }, get state() { return r.acState || 'free'; }, spheres: () => bodySpheres(r.body), takeHit: info => { this.send(r.id, { t: 'dmg', to: r.id, from: 'enemy', dmg: info.dmg, heavy: info.heavy, fx: info.from.x, fz: info.from.z }); return 'hit'; } })); }
  puppetHit(e, info) { this.send(this.hostId, { t: 'hitE', id: e.id, dmg: info.dmg, heavy: info.heavy, fx: info.from.x, fz: info.from.z }); }
  chat(text) {"""),
# state packet extras + enemy snapshots
("rd: P.mounted ? 1 : 0 });", "rd: P.mounted ? 1 : 0, dr: this.combat?.drawn ? 1 : 0, ac: this.combat?.state === 'dead' ? 'Death01' : (P.gltf?.action?.name || ''), pv: this.pvp ? 1 : 0, hp: Math.round(this.combat?.hp ?? 100) });\n      if (this.role === 'host' && this.enemies) { this.enemyT = (this.enemyT || 0) - .08; if (this.enemyT <= 0) { this.enemyT = .12; this.broadcast({ t: 'en', l: this.enemies.snapshot() }); } }"),
])
edit('src/main.js', [
("const net = new Multiplayer({ scene, player, assets: charAssets, camera, worldMap, getLook:", "const net = new Multiplayer({ scene, player, assets: charAssets, camera, worldMap, combat, enemies, getLook:"),
("$('mp-leave').onclick = () => { net.stop();", "$('mp-pvp').onchange = e => { net.pvp = e.target.checked; };\n$('mp-leave').onclick = () => { net.stop();"),
])
edit('index.html', [
('<div id="mp-status"></div>', '<label style="display:block;margin:8px 0;font:14px system-ui,sans-serif;color:#d9c9a0"><input type="checkbox" id="mp-pvp" checked> Permitir duelos entre jugadores</label><div id="mp-status"></div>'),
])
print('ok')
