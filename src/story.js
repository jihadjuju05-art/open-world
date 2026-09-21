// Story mode: cinematics (directed camera, letterbox, subtitles) + a chapter-based quest line with named characters.
// "Polvo y ceniza": the player's father Elías Reyes was murdered; the trail leads through the city sheriff, an innkeeper and a prospector
// to the hideout of the bandit chief Silas "El Cuervo" Crane.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const SAVE = 'openworld.story.v1';
const ease = t => t * t * (3 - 2 * t);
// Voice acting: assets/voice/<id>.mp3, id = FNV-1a hash of the subtitle text; only ids listed in assets/voice/index.json are played.
export const voiceId = text => { let h = 0x811c9dc5; for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
let VOICES = null; const loadVoices = () => VOICES || (VOICES = fetch('assets/voice/index.json').then(r => r.ok ? r.json() : {}).then(o => Array.isArray(o) ? Object.fromEntries(o.map(k => [k, { e: 'mp3', d: 0 }])) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? { e: v, d: 0 } : v]))).catch(() => ({})));
const $ = id => document.getElementById(id);
const dirName = (dx, dz) => ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(((Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];

// ------------------------------------------------------------------ cinematics
export class Cinematics {
  constructor({ camera, terrain, player, resolve, onStart, onEnd }) {
    Object.assign(this, { camera, terrain, player, resolve, onStart, onEnd }); this.active = false; this.typeRate = 32; loadVoices().then(m => { this.vmap = m; }); this.bars = $('cine'); this.sub = $('cinesub'); this.type = { text: '', n: 0 };
    addEventListener('keydown', e => { if (this.active && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); this.skip(); } }, true);
  }
  // shots: [{ t, at, orbit:[r0,r1,h0,h1,a0,a1], look, fov:[f0,f1], who, text, talk:[npcKey...] }]
  play(shots, done) {
    this.shots = shots; this.i = -1; this.done = done; this.active = true; this.bars.classList.add('on'); this.onStart?.(); this.fov0 = this.camera.fov; this.next();
  }
  next() {
    this.i++; if (this.i >= this.shots.length) return this.end(); const s = this.shots[this.i]; this.shot = s; this.t = 0; this.text = s.text || ''; this.typed = 0; this.typeRate = 32;
    const vm = s.text && this.vmap?.[voiceId(s.text)]; if (vm?.d) { s.t = Math.max(s.t, vm.d + .35); this.typeRate = s.text.length / (vm.d * .92); }      // shot and subtitles last as long as the voice line
    this.sub.innerHTML = s.text ? `<b>${s.who || ''}</b><span></span>` : ''; this.subSpan = this.sub.querySelector('span'); s.enter?.(); this.speak(s);
  }
  speak(s) {
    this.stopVoice(); if (!s.text) return; const id = voiceId(s.text), idx = this.i; loadVoices().then(map => { if (!map[id]?.e || !this.active || this.i !== idx) return; const a = this.voice = new Audio(`assets/voice/${id}.${map[id].e}`); a.volume = .95; a.play().catch(() => { }); });
  }
  stopVoice() { if (this.voice) { this.voice.pause(); this.voice = null; } }
  skip() { if (!this.active) return; this.stopVoice(); this.i = this.shots.length; this.end(); }
  end() { this.stopVoice(); this.active = false; this.bars.classList.remove('on'); this.sub.innerHTML = ''; this.camera.fov = this.fov0; this.camera.updateProjectionMatrix(); this.onEnd?.(); const d = this.done; this.done = null; d?.(); }
  update(dt) {
    if (!this.active) return; const s = this.shot; this.t += dt; const k = Math.min(1, this.t / s.t), e = ease(k), lerp = (a, b) => a + (b - a) * e;
    this.typed = Math.min(this.text.length, this.typed + dt * this.typeRate); if (this.subSpan) this.subSpan.textContent = this.text.slice(0, Math.floor(this.typed));
    const at = this.resolve(s.at || 'player'), o = s.orbit || [8, 8, 3, 3, 0, 1], a = lerp(o[4], o[5]) + (s.rel ? (at.yaw || 0) : 0), r = lerp(o[0], o[1]), h = lerp(o[2], o[3]);
    const pos = new V3(at.x + Math.sin(a) * r, at.y + h, at.z + Math.cos(a) * r); pos.y = Math.max(pos.y, this.terrain.height(pos.x, pos.z) + 1.2);
    const focus = new V3(at.x, at.y + (s.look ?? 1.4), at.z), f = this.terrain.clearFraction(focus, pos); if (f < 1) pos.lerpVectors(focus, pos, Math.max(.35, f));      // keep the camera out of walls and trees
    this.camera.position.copy(pos); this.camera.lookAt(at.x, at.y + (s.look ?? 1.4), at.z); if (s.fov) { this.camera.fov = lerp(s.fov[0], s.fov[1]); this.camera.updateProjectionMatrix(); }
    const talking = this.voice && !this.voice.ended && !this.voice.paused;      // let the line finish (up to 8 s past the planned length)
    if (this.t >= s.t + (s.hold ?? .4) && !(talking && this.t < s.t + 8)) this.next();
  }
}

// ------------------------------------------------------------------ story
export class Story {
  constructor({ plan, terrain, player, npcs, enemies, combat, worldMap, cine, getName, toast }) {
    Object.assign(this, { plan, terrain, player, npcs, enemies, combat, worldMap, cine, getName, toast });
    const city = this.city = plan.settlements[0], A = [Math.cos(city.axis), Math.sin(city.axis)], P = [-A[1], A[0]], at = (u, v) => ({ x: city.x + A[0] * u + P[0] * v, z: city.z + A[1] * u + P[1] * v });
    const inn = city.items.find(i => i.t === 'inn');
    this.pos = { vargas: at(9, -6), bruno: inn ? { x: inn.x + Math.sin(inn.rot) * 7.5, z: inn.z + Math.cos(inn.rot) * 7.5 } : at(-14, 8) };
    const camps = plan.settlements.filter(s => s.type === 4), d = s => Math.hypot(s.x - city.x, s.z - city.z);
    this.camp1 = camps.slice().sort((a, b) => d(a) - d(b))[0]; this.hideout = camps.filter(s => d(s) < 2700 && d(s) > 900).sort((a, b) => d(b) - d(a))[0] || camps[camps.length - 1];
    const vill = plan.settlements.filter(s => s.type === 2 && d(s) > 450).sort((a, b) => d(a) - d(b))[0] || plan.settlements.find(s => s.type === 2); this.village = vill;
    this.pos.amos = { x: vill.x + Math.cos(vill.axis + 1.57) * 9, z: vill.z + Math.sin(vill.axis + 1.57) * 9 };
    this.arena = this.pickArena(); this.stage = 'prologue'; this.kills = 0; this.log = []; this.flags = {}; this.load(); this.updateObjective(); this.ambush = []; this.bossSeen = false;
    $('journalbtn')?.addEventListener('click', () => this.toggleJournal());
    addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat && !this.cine.active) this.toggleJournal(); });
  }
  save() { try { localStorage.setItem(SAVE, JSON.stringify({ stage: this.stage, kills: this.kills, log: this.log, flags: this.flags })); } catch { } }
  load() { try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (s) { this.stage = s.stage; this.kills = s.kills || 0; this.log = s.log || []; this.flags = s.flags || {}; if (this.stage === 'free' && !this.flags.ch2) { this.stage = 'ch2_go'; this.flags.ch2 = true; this.log.push('El medallón de mi padre empezó a brillar.'); } } } catch { } }
  snapshot() { return { stage: this.stage, kills: this.kills, log: [...this.log], flags: { ...this.flags } }; }
  restore(s) {
    this.stage = s?.stage || 'prologue'; this.kills = s?.kills || 0; this.log = s?.log || []; this.flags = s?.flags || {}; if (this.stage === 'ambush') this.stage = 'find_amos';
    this.valkBusy = false; this.bossSeen = false; this.ambush = []; this.ambushSpawned = false; for (const e of this.enemies.list.filter(e => e.boss)) { e.dispose(); this.enemies.list.splice(this.enemies.list.indexOf(e), 1); }
    this.save(); this.updateObjective(); this.toggleJournal(false);
  }
  reset() { this.stage = 'prologue'; this.kills = 0; this.log = []; this.flags = {}; this.save(); this.updateObjective(); this.toggleJournal(false); }
  name() { return this.getName() || 'Forastero'; }
  where(p) { const P = this.player.pos, d = Math.hypot(p.x - P.x, p.z - P.z); return d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; }
  // ---- objective / markers ----
  objective() {
    const c = this.city.name;
    switch (this.stage) {
      case 'talk_vargas': return { text: `Habla con el sheriff Ramón Vargas en ${c}.`, at: this.pos.vargas };
      case 'clear_camp': return { text: `Elimina a los bandidos del ${this.camp1.name} (${Math.min(this.kills, 3)}/3).`, at: this.camp1 };
      case 'return_vargas': return { text: `Vuelve con el sheriff Vargas en ${c}.`, at: this.pos.vargas };
      case 'talk_bruno': return { text: `Habla con Bruno Salas, el posadero de ${c}.`, at: this.pos.bruno };
      case 'find_amos': return { text: `Encuentra al buscador de oro Amos Reed en ${this.village.name}.`, at: this.pos.amos };
      case 'ambush': return { text: 'Sobrevive a la emboscada.', at: null };
      case 'return2': return { text: `Lleva la mitad del mapa al sheriff Vargas en ${c}.`, at: this.pos.vargas };
      case 'boss': return { text: `Derrota a Silas «El Cuervo» en su guarida: ${this.hideout.name}.`, at: this.hideout };
      case 'ch2_go': return { text: `El medallón de tu padre brilla con luz turquesa. Sigue su llamada hasta ${this.arena.name}.`, at: this.arena };
      case 'ch2_boss': return { text: `Derrota a Kaelith, la Segadora, en ${this.arena.name}.`, at: this.arena };
      case 'free': return { text: 'Fin del capítulo 2. Explora el mundo libremente: hay más campamentos, pueblos y secretos.', at: null };
      default: return null;
    }
  }
  updateObjective() {
    const o = this.objective(), el = $('objective'); if (!el) return;
    if (!o) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.textContent = '◆ ' + o.text + (o.at ? `  ·  ${this.where(o.at)}` : ''); this.worldMap.wp = o.at ? { x: o.at.x, z: o.at.z } : null;
  }
  set(stage, note) {
    this.stage = stage; this.kills = 0; if (note) this.log.push(note); this.save(); this.updateObjective(); this.onStage?.(stage); const o = this.objective();
    if (o && stage !== 'free') this.toast?.('Nuevo objetivo', o.text);
  }
  toggleJournal(force) {
    const el = $('journal'); const on = force ?? el.classList.contains('hidden'); el.classList.toggle('hidden', !on); if (!on) return; const o = this.objective();
    el.innerHTML = `<h3>DIARIO</h3><h4>${this.flags.ch2 || this.stage.startsWith('ch2') ? 'El canto de las hoces' : 'Polvo y ceniza'}</h4>${o ? `<p class="cur">◆ ${o.text}</p>` : ''}<ul>${this.log.map(l => `<li>✓ ${l}</li>`).join('')}</ul><p class="tip">R espada · clic atacar (mantener: fuerte) · clic der. bloquear · V esquivar · 1-6 emociones · Q caballo · M mapa · J diario</p><button class="mbtn" id="jreset">Reiniciar historia</button>`;
    $('jreset').onclick = () => this.reset();
  }
  // ---- anchors used by cutscenes ----
  resolve = a => {
    const T = this.terrain; if (a === 'player') return Object.assign(new V3(this.player.pos.x, this.player.pos.y, this.player.pos.z), { yaw: this.player.yaw }); if (a === 'city') return new V3(this.city.x, T.height(this.city.x, this.city.z) + 6, this.city.z);
    if (a === 'arena') return new V3(this.arena.x, T.height(this.arena.x, this.arena.z), this.arena.z); if (a === 'valk') { const b = this.enemies.list.find(e => e.valk); return b ? Object.assign(new V3(b.pos.x, b.pos.y, b.pos.z), { yaw: b.yaw }) : this.resolve('arena'); }
    if (a === 'hideout') return new V3(this.hideout.x, T.height(this.hideout.x, this.hideout.z), this.hideout.z); if (a === 'boss') { const b = this.enemies.list.find(e => e.boss); return b ? Object.assign(new V3(b.pos.x, b.pos.y, b.pos.z), { yaw: b.yaw }) : this.resolve('hideout'); }
    const p = this.pos[a], nn = this.npcs?.storyNpcs?.[a]; return p ? Object.assign(nn ? new V3(nn.pos.x, nn.pos.y, nn.pos.z) : new V3(p.x, T.height(p.x, p.z), p.z), { yaw: nn ? nn.yaw : 0 }) : new V3(this.player.pos.x, this.player.pos.y, this.player.pos.z);
  };
  // ---- events ----
  start() { if (this.stage === 'prologue') setTimeout(() => this.playPrologue(), 1200); else this.updateObjective(); }
  playPrologue() {
    const n = this.name(), c = this.city.name;
    this.cine.play([
      { t: 7, at: 'city', orbit: [70, 46, 26, 14, 0, 1.6], look: 4, fov: [55, 42], who: 'Narrador', text: 'Dicen que el oeste no perdona. Yo aprendí que tampoco olvida.' },
      { t: 6, at: 'player', orbit: [9, 5, 3, 1.6, 2.6, 3.4], look: 1.5, fov: [50, 38], who: n, text: 'Hace tres noches, unos hombres encapuchados quemaron el rancho de mi padre, Elías Reyes.' },
      { t: 6.5, at: 'player', orbit: [3.4, 2.6, 1.6, 1.7, 3.6, 3.0], look: 1.65, fov: [38, 32], who: n, text: 'No dejó más que un medallón y una carta: «Busca al sheriff Vargas. Solo él sabe la verdad».' },
      { t: 7, at: 'city', orbit: [40, 26, 12, 8, 3.2, 4.1], look: 3, fov: [46, 40], who: n, text: `Así que aquí estoy: ${c}. Una ciudad de polvo, deudas y promesas rotas.` },
    ], () => { this.toast?.('Capítulo 1', 'Polvo y ceniza'); this.set('talk_vargas', 'Llegué a ' + c + ' con el medallón de mi padre.'); });
  }
  onKill(e) {
    if (this.stage === 'clear_camp' && e.camp && e.camp.id === this.camp1.id) { this.kills++; this.updateObjective(); if (this.kills >= 3) this.set('return_vargas', `Acabé con los bandidos del ${this.camp1.name}.`); }
    if (this.stage === 'ambush') { this.ambush = this.ambush.filter(x => x !== e); if (!this.ambush.length) this.set('return2', 'Sobreviví a la emboscada de los hombres de Cuervo.'); }
    if (e.boss && !e.valk && this.stage === 'boss') setTimeout(() => this.playEpilogue(), 2500);
    if (e.valk) this.flags.valkDead = true;
    if (e.valk && this.stage === 'ch2_boss') setTimeout(() => this.playValkEpilogue(), 3200);
  }
  playEpilogue() {
    const n = this.name();
    this.cine.play([
      { t: 6, at: 'boss', rel: true, orbit: [5, 3.2, 1.3, 1.4, .5, .1], look: 1.0, fov: [40, 32], who: 'Silas «El Cuervo»', text: 'Tu padre... también luchó así. Y tampoco supo lo que había en el mapa.' },
      { t: 6, at: 'player', orbit: [4, 3, 1.7, 1.6, 2.2, 2.9], look: 1.6, fov: [38, 34], who: n, text: 'La mitad de este mapa señala un lugar que no aparece en ningún plano.' },
      { t: 7, at: 'hideout', orbit: [50, 30, 22, 10, 0, 2.2], look: 3, fov: [52, 40], who: 'Narrador', text: 'Pero eso es otra historia. Fin del capítulo 1: Polvo y ceniza.' },
    ], () => { this.flags.ch2 = true; this.toast?.('Capítulo 1 completado', 'Polvo y ceniza'); this.set('ch2_go', 'Derroté a Silas «El Cuervo» y recuperé la mitad del mapa del Oro Viejo.'); setTimeout(() => this.toast?.('Capítulo 2', 'El canto de las hoces'), 2500); });
  }
  // ---- chapter 2: "El canto de las hoces" ----
  // A flat, dry clearing far from every settlement where the guardian waits.
  pickArena() {
    const T = this.terrain, c = this.city, sets = this.plan.settlements;
    for (let r = 650; r <= 1500; r += 75) for (let i = 0; i < 48; i++) {
      const a = i * Math.PI / 24 + r * .013, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, h = T.height(x, z); if (h < 4 || h > 45 || T.slopeAt(x, z) > .1 || T.hf.forest(x, z) > .1) continue;
      if (sets.some(s => Math.hypot(s.x - x, s.z - z) < 180) || T.riverAt(x, z).t > .02) continue; let ok = true;
      for (let k = 0; k < 8 && ok; k++) { const xx = x + Math.cos(k * .785) * 22, zz = z + Math.sin(k * .785) * 22; if (Math.abs(T.height(xx, zz) - h) > 3.5 || T.riverAt(xx, zz).t > .02 || T.hf.forest(xx, zz) > .1 || T.hf.forest(x + Math.cos(k * .785) * 40, z + Math.sin(k * .785) * 40) > .1) ok = false; }
      if (ok) return { x, z, name: 'el Claro del Alba' };
    }
    const h = this.hideout; return { x: h.x + 60, z: h.z + 60, name: 'el Claro del Alba' };
  }
  // Optional AI-made video (assets/video/ch2_boss.mp4, e.g. from Runway); skipped silently when the file does not exist.
  async playVideo(src) {
    let ok = false; try { ok = (await fetch(src, { method: 'HEAD' })).ok; } catch { } if (!ok) return;
    await new Promise(res => {
      const box = document.createElement('div'); box.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
      const v = document.createElement('video'); v.src = src; v.autoplay = true; v.playsInline = true; v.style.cssText = 'max-width:100%;max-height:100%'; box.append(v);
      const hint = document.createElement('div'); hint.textContent = 'Clic o Esc para saltar'; hint.style.cssText = 'position:absolute;right:18px;bottom:14px;color:#fff8;font:12px sans-serif'; box.append(hint); document.body.append(box);
      this.cine.onStart?.(); let done = false; const end = () => { if (done) return; done = true; removeEventListener('keydown', key, true); box.remove(); this.cine.onEnd?.(); res(); };
      const key = e => { if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); end(); } }; addEventListener('keydown', key, true);
      v.onended = end; v.onerror = end; box.onclick = end; v.play?.().catch(end);
    });
  }
  flashScreen(color, ms = 700) { const d = document.createElement('div'); d.style.cssText = `position:fixed;inset:0;background:${color};opacity:.85;pointer-events:none;z-index:9998;transition:opacity ${ms}ms ease-out`; document.body.append(d); requestAnimationFrame(() => requestAnimationFrame(() => { d.style.opacity = 0; })); setTimeout(() => d.remove(), ms + 100); }
  async playValkIntro() {
    this.valkBusy = true; const A = this.arena, n = this.name(); let v = this.enemies.list.find(e => e.valk);
    if (!v) { v = await this.enemies.spawnValkyrie(A.x, A.z, false); }
    v.yaw = Math.atan2(this.player.pos.x - v.pos.x, this.player.pos.z - v.pos.z);
    await this.playVideo('assets/video/ch2_boss.mp4');
    this.cine.play([
      { t: 7, at: 'arena', orbit: [46, 30, 18, 9, 2.2, 3.0], look: 2, fov: [58, 44], who: 'Narrador', text: 'El medallón de Elías Reyes no era una joya. Era una llave.' },
      { t: 5.5, at: 'player', orbit: [4.4, 3.2, 1.7, 1.6, 3.2, 2.7], look: 1.6, fov: [40, 32], who: n, text: 'Vibra contra mi pecho... como si algo, al otro lado, respondiera.' },
      { t: 6.5, at: 'valk', rel: true, orbit: [10, 5.4, 1.7, 1.2, .55, .1], look: 1.4, fov: [50, 30], who: 'Kaelith, la Segadora', text: 'Tres veces han venido a buscar lo que guardas. Tres veces las hoces cantaron.', enter: () => { v.showAttack?.(); v.burst?.(); this.flashScreen('#40f5e6'); } },
      { t: 5.5, at: 'valk', rel: true, orbit: [3.2, 2.4, 1.4, 1.9, -.35, -.05], look: 1.75, fov: [34, 26], who: 'Kaelith, la Segadora', text: 'Tu padre juró que nadie más vendría. Mintió... o tú eres su promesa rota.' },
      { t: 5, at: 'valk', rel: true, orbit: [12, 6, 2.2, 3.4, 1.9, 2.6], look: 1.4, fov: [56, 40], who: 'Kaelith, la Segadora', text: 'Empuña tu acero, forastero. Las hoces no preguntan.', enter: () => { v.burst?.(); this.flashScreen('#ffffff', 500); } },
    ], () => { v.aggro = true; v.state = 'chase'; this.set('ch2_boss', 'Kaelith, la Segadora custodia el Claro del Alba.'); });
  }
  playValkEpilogue() {
    const n = this.name();
    this.cine.play([
      { t: 6, at: 'valk', rel: true, orbit: [5, 3.4, 1.2, 1.5, .5, .1], look: 1.0, fov: [40, 30], who: 'Kaelith, la Segadora', text: 'El Oro Viejo... nunca fue oro. Es lo que sellamos bajo la montaña.' },
      { t: 5.5, at: 'player', orbit: [4, 3, 1.7, 1.6, 2.4, 3.0], look: 1.6, fov: [38, 34], who: n, text: 'Mi padre lo sabía. Por eso lo mataron.' },
      { t: 7, at: 'arena', orbit: [50, 34, 24, 12, 0, 1.4], look: 3, fov: [54, 42], who: 'Narrador', text: 'Pero eso es otra historia. Fin del capítulo 2: El canto de las hoces.' },
    ], () => { this.set('free', 'Derroté a Kaelith, la Segadora, guardiana del Claro del Alba.'); this.toast?.('Capítulo 2 completado', 'El canto de las hoces'); });
  }
  talk(key, on) { const npc = this.npcs?.storyNpcs?.[key]; if (!npc) return; if (on) { npc.state = 'talk'; } else { npc.state = 'idle'; npc.timer = 4; } }
  playAmos() {
    const n = this.name(); this.talk('amos', true);
    this.cine.play([
      { t: 6.5, at: 'amos', rel: true, orbit: [4.2, 3.4, 1.6, 1.5, .5, .1], look: 1.6, fov: [40, 34], who: 'Amos Reed', text: `¿Reyes? ¿Tienes su medallón? Entonces es verdad que Elías ha muerto...` },
      { t: 6.5, at: 'amos', rel: true, orbit: [3.2, 2.8, 1.5, 1.6, -.5, -.1], look: 1.6, fov: [36, 30], who: 'Amos Reed', text: 'Guardaba esta mitad del mapa del Oro Viejo. Cuervo mató por la otra. Llévala a Vargas, y que no te siga nadie.' },
      { t: 5, at: 'player', orbit: [5, 4, 2, 1.7, 2.4, 3.0], look: 1.6, fov: [46, 40], who: n, text: 'Sentí que alguien nos observaba desde los árboles.' },
    ], () => { this.talk('amos', false); this.flags.mapA = true; this.set('ambush', 'Amos me dio su mitad del mapa del Oro Viejo.'); this.startAmbush(); });
  }
  startAmbush() {
    const P = this.player.pos; this.ambushSpawned = true; this.ambush = this.enemies.spawnAmbush(P.x, P.z, 3, 26); this.toast?.('¡Emboscada!', 'Hombres de Cuervo te rodean');
  }
  playBossIntro() {
    const n = this.name();
    this.cine.play([
      { t: 6, at: 'boss', rel: true, orbit: [7, 4.5, 1.5, 1.7, .6, .1], look: 1.6, fov: [48, 34], who: 'Silas «El Cuervo»', text: 'Reyes... tienes la misma mirada que tu padre. Él también creyó que podía detenerme.' },
      { t: 4.5, at: 'player', orbit: [4, 3.4, 1.7, 1.6, 3.4, 2.9], look: 1.6, fov: [36, 32], who: n, text: 'Vengo por el mapa. Y por lo que hiciste en el rancho.' },
      { t: 4.5, at: 'boss', rel: true, orbit: [4, 2.6, 1.3, 1.9, -.5, -.1], look: 1.7, fov: [34, 28], who: 'Silas «El Cuervo»', text: 'Entonces ven a buscarlo. Muchachos... no dejéis nada.' },
    ], () => { const b = this.enemies.list.find(e => e.boss); if (b) { b.aggro = true; b.state = 'chase'; } });
  }
  update(dt) {
    this.t = (this.t || 0) - dt; const P = this.player.pos;
    if (this.t <= 0) {
      this.t = .6; this.updateObjective();
      if (this.stage === 'boss') {
        const h = this.hideout, d = Math.hypot(P.x - h.x, P.z - h.z);
        if (d < 150 && !this.enemies.list.some(e => e.boss) && !this.flags.bossDead) this.enemies.spawnBoss(h);
        const boss = this.enemies.list.find(e => e.boss); if (boss && !this.bossSeen && d < 34 && !this.cine.active) { this.bossSeen = true; this.playBossIntro(); }
      }
      if (this.stage === 'ch2_boss' && !this.flags.valkDead && !this.valkBusy && !this.enemies.list.some(e => e.valk) && Math.hypot(P.x - this.arena.x, P.z - this.arena.z) < 160) { this.valkBusy = true; this.enemies.spawnValkyrie(this.arena.x, this.arena.z, false).then(v => { v.yaw = Math.atan2(P.x - v.pos.x, P.z - v.pos.z); }); }      // loaded a save in the middle of the fight
      if (this.stage === 'ch2_go' && !this.valkBusy && !this.cine.active) { const A = this.arena, d = Math.hypot(P.x - A.x, P.z - A.z); if (d < 75) this.playValkIntro(); }
      if (this.stage === 'ambush' && !this.ambush.length && this.flags.mapA && this.ambushSpawned) this.set('return2', 'Sobreviví a la emboscada.');
    }
  }
  // ---- dialogue with the named characters ----
  dialogue(npc) {
    const k = npc.def.storyKey, n = this.name(), s = this.stage, city = this.city.name, end = [['Adiós.', () => null]];
    const chain = (lines, last, opts) => { const step = i => i >= lines.length ? last() : ({ text: lines[i], options: [[i === lines.length - 1 ? (opts?.[0] || 'Entendido.') : 'Continuar…', () => step(i + 1)]] }); return step(0); };
    if (k === 'vargas') {
      if (s === 'talk_vargas') return chain([`Ese medallón... Lo conozco. Es de Elías Reyes. Tú debes de ser su hijo, ${n}.`, 'Elías fue mi compañero cuando esta tierra no era de nadie. Lo que quemaron no fue solo un rancho: buscaban algo que él guardaba.', 'Los hombres de Silas Crane, «El Cuervo», se esconden en campamentos alrededor de ' + city + '. Antes de contarte más necesito saber si sabes pelear.',
        `Al ${dirName(this.camp1.x - this.city.x, this.camp1.z - this.city.z)} hay uno: el ${this.camp1.name}. Límpialo. Saca la espada con R, ataca con el clic, bloquea con el clic derecho y esquiva con V. Vuelve entero.`], () => { this.set('clear_camp', 'El sheriff Vargas me encargó limpiar el ' + this.camp1.name + '.'); return null; }, 'Cuenta conmigo.');
      if (s === 'clear_camp') return { text: `Aún hay bandidos en el ${this.camp1.name}. Ve con cuidado: bloquea justo cuando ataquen para desviar sus golpes.`, options: end };
      if (s === 'return_vargas') return chain(['Sabía que no me equivocaba contigo. Pero estos solo eran perros; el amo tiene la mitad de un mapa: el del Oro Viejo, la mina que tu padre encontró.', 'Elías lo partió en dos antes de morir. Una mitad la guarda un buscador, Amos Reed. Habla primero con Bruno, el posadero: él sabe dónde se esconde.'], () => { this.set('talk_bruno', 'Vargas me habló del mapa del Oro Viejo y de Amos Reed.'); return null; });
      if (s === 'return2') return chain(['Dos mitades... y Cuervo tiene la otra. Su guarida está en ' + this.hideout.name + `, al ${dirName(this.hideout.x - this.city.x, this.hideout.z - this.city.z)} de aquí, muy vigilada.`, `Toma este consejo: la esquiva te salva de un golpe fuerte; el bloqueo a tiempo, además, deja al enemigo aturdido. Ve, ${n}. Elías estaría orgulloso.`], () => { this.set('boss', 'Vargas me señaló la guarida de Cuervo en ' + this.hideout.name + '.'); return null; });
      if (s === 'ch2_go' || s === 'ch2_boss') return { text: 'Ese medallón brilla... Nunca lo vi hacerlo. Sigue su luz, pero no vayas con la guardia baja. Yo vigilo la ciudad.', options: end };
      if (s === 'free') return { text: 'Cuervo ha caído, pero el Oro Viejo sigue sin aparecer. Este es solo el principio.', options: end };
      return { text: 'Aquí la ley soy yo. Ándate con ojo, forastero.', options: end };
    }
    if (k === 'bruno') {
      if (s === 'talk_bruno') return chain(['Amos... Lleva semanas escondido, con miedo a que Cuervo le encuentre. Está en ' + this.village.name + `, al ${dirName(this.village.x - this.city.x, this.village.z - this.city.z)}.`, 'Dile que vas de parte de Elías. Y ten cuidado: Cuervo tiene ojos en cada camino.'], () => { this.set('find_amos', 'Bruno me dijo dónde encontrar a Amos Reed.'); return null; });
      return { text: 'Sopa, cama y silencio. Lo demás no lo sirvo.', options: [['¿Una partida de dados?', () => { setTimeout(() => this.npcs?.shop?.open('dice', npc), 40); return null; }], ...end] };
    }
    if (k === 'amos') {
      if (s === 'find_amos') { setTimeout(() => this.playAmos(), 50); return null; }
      return { text: 'Ya te di lo que tenía. Que el cielo te acompañe.', options: end };
    }
    return null;
  }
}
