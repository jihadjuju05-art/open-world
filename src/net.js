// Peer-to-peer multiplayer (WebRTC through PeerJS). One player creates a room and shares its code; friends join with it.
// Star topology: the host relays every player's state to everyone else. Remote players are full characters with name plates,
// map markers and a simple text chat (Enter).
import * as THREE from 'three';
import { GltfBody, DEFAULT_CHAR } from './character.js';
import { bodySpheres } from './combat.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLIP = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop', jump: 'Jump_Loop', swim: 'Swim_Fwd_Loop', swimIdle: 'Swim_Idle_Loop', ride: 'Idle_Loop' };
const COLORS = ['#5cc8ff', '#ff8f5c', '#9cff7a', '#ff6ad5', '#ffd85c', '#b48cff'];

class Remote {
  constructor(net, id, name, look) {
    this.net = net; this.id = id; this.name = name; this.look = look; this.body = new GltfBody(net.assets, { ...DEFAULT_CHAR, ...look }); net.scene.add(this.body.root); this.body.root.scale.setScalar(.92 * (look.height || 1));
    this.pos = new THREE.Vector3(); this.target = new THREE.Vector3(); this.yaw = 0; this.tyaw = 0; this.st = 'idle'; this.speed = 0; this.first = true; this.bubble = null; this.bubbleT = 0;
    this.color = COLORS[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
    this.tag = document.createElement('div'); this.tag.className = 'nameplate'; this.tag.innerHTML = '<b></b><span></span>'; this.tag.firstChild.textContent = name; this.tag.firstChild.style.color = this.color; net.tagRoot.append(this.tag);
  }
  set(m) { this.target.set(m.x, m.y, m.z); this.tyaw = m.yaw; this.st = m.st; this.speed = m.sp; this.rid = m.rd; this.pv = m.pv; this.hp = m.hp ?? 100; if (!!m.dr !== !!this.body.drawn) this.body.setDrawn(!!m.dr);
    const ac = m.ac || ''; if (ac !== (this.ac || '')) { this.ac = ac; if (ac) { const loop = /Loop$/.test(ac); this.body.startAction(ac, { fade: .1, loop, rate: ac === 'Sword_Block' ? 2.2 : ac === 'Roll' ? 1.45 : ac.startsWith('Sword_Regular') ? .85 : ac === 'Sword_Attack' ? .95 : 1 }); } else this.body.endAction(); }
    this.acState = /^Sword_(Regular|Attack)/.test(ac) ? 'attack' : ac === 'Sword_Block' ? 'block' : ac === 'Roll' ? 'dodge' : 'free'; if (this.first) { this.pos.copy(this.target); this.yaw = this.tyaw; this.first = false; } }
  say(text) { this.bubble = text; this.bubbleT = 6; }
  update(dt, cam) {
    const k = 1 - Math.exp(-10 * dt); this.pos.lerp(this.target, k); let a = this.tyaw - this.yaw; a = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; this.yaw += a * k;
    const r = this.body.root; r.position.copy(this.pos); r.rotation.y = this.yaw;
    if (this.ac && this.ac === 'Sword_Block' && this.body.actionProgress() > .38) for (const m of this.body.mixers) m.timeScale = 0;
    if (!this.body.action) this.body.play(CLIP[this.st] || 'Idle_Loop', .25, this.st === 'walk' ? Math.max(.6, this.speed / 1.5) : this.st === 'jog' ? Math.max(.7, this.speed / 4.4) : 1); this.body.update(dt);
    const p = new THREE.Vector3(this.pos.x, this.pos.y + 2.25, this.pos.z), d = p.distanceTo(cam.position); p.project(cam);
    const vis = p.z < 1 && d < 160 && Math.abs(p.x) < 1.1; this.tag.style.display = vis ? '' : 'none';
    if (vis) { this.tag.style.left = ((p.x * .5 + .5) * innerWidth) + 'px'; this.tag.style.top = ((-p.y * .5 + .5) * innerHeight) + 'px'; this.tag.style.opacity = Math.max(.35, 1 - d / 170); }
    this.bubbleT -= dt; this.tag.lastChild.textContent = this.bubbleT > 0 ? this.bubble : '';
  }
  dispose() { this.net.scene.remove(this.body.root); this.tag.remove(); }
}

export class Multiplayer {
  constructor({ scene, player, assets, camera, worldMap, getLook, onStatus, combat, enemies }) {
    Object.assign(this, { scene, player, assets, camera, worldMap, getLook, onStatus, combat, enemies }); this.pvp = true; this.remotes = new Map(); this.conns = new Map(); this.peer = null; this.role = null; this.code = null; this.sendT = 0; this.myId = null;
    this.tagRoot = document.getElementById('bubbles'); this.info = document.getElementById('mpinfo');
  }
  get active() { return !!this.role; }
  status(t) { this.onStatus?.(t); }
  me() { return { id: this.myId, name: this.getLook().name || 'Forastero', look: this.getLook() }; }
  refreshInfo() { if (!this.info) return; if (!this.role) { this.info.classList.add('hidden'); return; } this.info.classList.remove('hidden'); this.info.textContent = `Sala ${this.code} · ${this.remotes.size + 1} jugador${this.remotes.size ? 'es' : ''}`; }
  start(peer, role) {
    this.peer = peer; this.role = role; peer.on('error', e => { this.status('Error de red: ' + (e.type || e.message)); if (!this.myId) this.stop(); });
    return new Promise((res, rej) => { peer.on('open', id => { this.myId = id; res(id); }); peer.on('error', rej); });
  }
  async host() {
    if (typeof Peer === 'undefined') return this.status('La red no está disponible (falta PeerJS).');
    this.stop(); const code = Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
    try { await this.start(new Peer('ow-' + code, { debug: 0 }), 'host'); } catch (e) { return this.status('No se pudo crear la sala: ' + (e.type || e)); }
    this.code = code; this.peer.on('connection', c => this.attach(c)); this.refreshInfo(); this.status('Sala creada. Código: ' + code); return code;
  }
  async join(code) {
    if (typeof Peer === 'undefined') return this.status('La red no está disponible (falta PeerJS).');
    code = (code || '').trim().toUpperCase(); if (code.length < 4) return this.status('Escribe el código de la sala.'); this.stop();
    try { await this.start(new Peer({ debug: 0 }), 'client'); } catch (e) { return this.status('No se pudo conectar a la red: ' + (e.type || e)); }
    this.code = code; const c = this.peer.connect('ow-' + code, { reliable: true, serialization: 'json' }); this.host_ = c; this.status('Conectando…');
    const to = setTimeout(() => { if (!c.open) { this.status('No se encontró la sala ' + code + '. Comprueba el código.'); this.stop(); } }, 12000);
    c.on('open', () => { clearTimeout(to); this.attach(c); this.status('Conectado a la sala ' + code); this.refreshInfo(); });
    return code;
  }
  attach(c) {
    const send0 = () => { c.send({ t: 'hello', ...this.me() }); if (this.role === 'host') for (const r of this.remotes.values()) if (r.id !== c.peer) c.send({ t: 'hello', id: r.id, name: r.name, look: r.look }); };
    const start = () => { this.conns.set(c.peer, c); send0(); };
    if (c.open) start(); else c.on('open', start);
    c.on('data', m => this.onData(c, m)); c.on('close', () => this.drop(c.peer)); c.on('error', () => this.drop(c.peer));
  }
  drop(id) { this.conns.delete(id); const r = this.remotes.get(id); if (r) { r.dispose(); this.remotes.delete(id); this.status(`${r.name} se ha ido.`); if (this.role === 'host') this.broadcast({ t: 'bye', id }); } this.refreshInfo(); if (this.role === 'client' && !this.conns.size) { this.status('Se perdió la conexión con la sala.'); this.stop(); } }
  broadcast(m, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(m); }
  onData(c, m) {
    if (!m || !m.t) return;
    if (m.t === 'hello') { if (m.id === this.myId) return; if (!this.remotes.has(m.id)) { this.remotes.set(m.id, new Remote(this, m.id, m.name, m.look || {})); this.status(`${m.name} se ha unido.`); } this.refreshInfo(); if (this.role === 'host') this.broadcast(m, c.peer); }
    else if (m.t === 's') { this.remotes.get(m.id)?.set(m); if (this.role === 'host') this.broadcast(m, c.peer); }
    else if (m.t === 'bye') { const r = this.remotes.get(m.id); if (r) { r.dispose(); this.remotes.delete(m.id); this.refreshInfo(); } }
    else if (m.t === 'dmg') { if (m.to === this.myId) this.receiveDmg(m, c); else if (this.role === 'host') this.conns.get(m.to)?.send(m); }
    else if (m.t === 'res') { if (m.to === this.myId) { if (m.res === 'parried') this.combat?.enterStagger(true); } else if (this.role === 'host') this.conns.get(m.to)?.send(m); }
    else if (m.t === 'hitE') { if (this.role === 'host' && this.enemies) { const e = this.enemies.list.find(x => x.id === m.id); if (e && !e.dead) e.takeHit({ dmg: m.dmg, heavy: !!m.heavy, from: new THREE.Vector3(m.fx, 0, m.fz), attacker: { stagger() { } } }); } }
    else if (m.t === 'en') { if (this.role === 'client' && this.enemies) { if (!this.enemies.puppetMode) { this.enemies.puppetMode = true; for (const e of this.enemies.list.filter(x => !x.puppet)) { e.dispose(); this.enemies.list.splice(this.enemies.list.indexOf(e), 1); } this.enemies.byCamp.clear(); } this.enemies.applySnapshot(m.l); } }
    else if (m.t === 'chat') { this.remotes.get(m.id)?.say(m.text); this.log(`${m.name}: ${m.text}`); if (this.role === 'host') this.broadcast(m, c.peer); }
  }
  // ---- combat over the network ----
  // Remote players as attackable targets (duels). Damage is resolved on the victim's machine so dodging and blocking feel fair.
  pvpTargets() {
    if (!this.role || !this.pvp) return []; const out = [];
    for (const r of this.remotes.values()) if (r.pv && !r.first && (r.hp ?? 100) > 0) out.push({ id: 'p:' + r.id, pos: r.pos, dead: false, spheres: () => bodySpheres(r.body), takeHit: info => { this.send(r.id, { t: 'dmg', to: r.id, from: this.myId, dmg: info.dmg, heavy: info.heavy, fx: info.from.x, fz: info.from.z, part: info.part }); return 'hit'; } });
    return out;
  }
  receiveDmg(m, c) {
    if (!this.combat || (m.from !== 'enemy' && !this.pvp)) return; const self = this; const res = this.combat.takeHit({ dmg: m.dmg, heavy: m.heavy, from: new THREE.Vector3(m.fx, 0, m.fz), attacker: { stagger() { if (m.from !== 'enemy') self.send(m.from, { t: 'res', to: m.from, res: 'parried' }); } } });
    if (res === 'dead') this.status('Te ha derrotado ' + (this.remotes.get(m.from)?.name || 'otro jugador') + '.');
  }
  send(to, m) { if (this.role === 'host') this.conns.get(to)?.send(m); else this.conns.get(this.hostId)?.send(m); }
  get hostId() { return 'ow-' + this.code; }
  // Enemies as seen by the host: every remote player is a target for them.
  remoteTargets() { return [...this.remotes.values()].filter(r => !r.first).map(r => ({ id: r.id, pos: r.pos, get alive() { return (r.hp ?? 100) > 0; }, get state() { return r.acState || 'free'; }, spheres: () => bodySpheres(r.body), takeHit: info => { this.send(r.id, { t: 'dmg', to: r.id, from: 'enemy', dmg: info.dmg, heavy: info.heavy, fx: info.from.x, fz: info.from.z }); return 'hit'; } })); }
  puppetHit(e, info) { this.send(this.hostId, { t: 'hitE', id: e.id, dmg: info.dmg, heavy: info.heavy, fx: info.from.x, fz: info.from.z }); }
  chat(text) { if (!this.role || !text) return; this.broadcast({ t: 'chat', id: this.myId, name: this.me().name, text }); this.log(`${this.me().name}: ${text}`); }
  log(t) { this.onStatus?.(t, true); }
  stop() {
    if (this.enemies) { this.enemies.puppetMode = false; for (const e of this.enemies.list.filter(x => x.puppet)) { e.dispose(); this.enemies.list.splice(this.enemies.list.indexOf(e), 1); } }
    for (const r of this.remotes.values()) r.dispose(); this.remotes.clear(); this.conns.clear(); try { this.peer?.destroy(); } catch { } this.peer = null; this.role = null; this.code = null; this.myId = null; this.refreshInfo();
  }
  markers() { return [...this.remotes.values()].map(r => ({ x: r.pos.x, z: r.pos.z, label: r.name, color: r.color, always: true })); }
  update(dt) {
    if (!this.role) return; const P = this.player;
    for (const r of this.remotes.values()) r.update(dt, this.camera);
    if ((this.sendT -= dt) <= 0 && this.conns.size) {
      this.sendT = .08; const st = P.mounted ? 'ride' : P.swimming ? (P.speed > .3 ? 'swim' : 'swimIdle') : P.state === 'jump' ? 'jump' : P.state;
      this.broadcast({ t: 's', id: this.myId, x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(3), st: CLIP[st] ? st : 'idle', sp: +P.speed.toFixed(2), rd: P.mounted ? 1 : 0, dr: this.combat?.drawn ? 1 : 0, ac: this.combat?.state === 'dead' ? 'Death01' : (P.gltf?.action?.name || ''), pv: this.pvp ? 1 : 0, hp: Math.round(this.combat?.hp ?? 100) });
      if (this.role === 'host' && this.enemies) { this.enemyT = (this.enemyT || 0) - .08; if (this.enemyT <= 0) { this.enemyT = .12; this.broadcast({ t: 'en', l: this.enemies.snapshot() }); } }
    }
  }
}
