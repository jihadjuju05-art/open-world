import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Sky } from './sky.js';
import { Player } from './player.js';
import { Clip } from './anim.js';
import { mergeWater } from './water.js';
import { Birds } from './wildlife.js';
import { Ambience } from './audio.js';
import { WaterFX } from './effects.js';
import { loadSettings } from './settings.js';
import { GameMenu } from './menu.js';
import { WorldMap } from './map.js';
import { NPCManager } from './npc.js';
import { AnimalManager } from './animals.js';
import { PlayerCombat, EMOTES, applyTuning } from './combat.js';
import { EnemyManager } from './enemies.js';
import { Cinematics, Story } from './story.js';
import { Multiplayer } from './net.js';
import { HouseManager } from './houses.js';
import { Economy } from './economy.js';
import { SaveManager } from './save.js';
import { setTownData } from './housegen.js';
import { PlayerHorse, DEFAULT_HORSE } from './horse.js';
import { DialogueUI } from './dialogue_ui.js';
import { loadCharacterAssets, GltfBody } from './character.js';
import { CharacterCreator, loadSavedLook } from './creator.js';
import { BLD, typeName } from './settlements.js';
import { Vegetation, TREE_SETS, PLANT_SETS, GRASS_SET, ROCK_SET } from './vegetation.js';
import * as GEN from './gen.js';

const $ = id => document.getElementById(id);
const settings = loadSettings();
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, .3, 1400);

// ---------- GPU diagnostics ----------
const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'desconocida';
const softwareGL = /swiftshader|llvmpipe|software|basic render|microsoft basic|softpipe/i.test(gpuName);
const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); const queries = []; let gpuMs = null, probeN = 0;
function gpuBegin() { if (!tq || queries.length > 6) return null; const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); return q; }
function gpuEnd(q) { if (!q) return; gl.endQuery(tq.TIME_ELAPSED_EXT); queries.push(q); }
function gpuPoll() {
  if (!tq) return; const disjoint = gl.getParameter(tq.GPU_DISJOINT_EXT);
  while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
    const q = queries.shift(); if (!disjoint) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gpuMs = gpuMs == null ? ms : gpuMs + (ms - gpuMs) * .1; } gl.deleteQuery(q);
  }
}

// real vegetation/rock models (prepared with Blender); the game still runs with low-poly proxies if they fail to load
const veg = new Vegetation();
{
  const names = [...Object.values(TREE_SETS).flat().flatMap(n => [n, n + '_lod1']), ...Object.values(PLANT_SETS).flat(), ...GRASS_SET, ...Object.values(ROCK_SET).flat(), ...new Set(Object.values(BLD).map(b => b[0]))];
  $('loadmsg').textContent = 'Cargando vegetación…'; await veg.load([...new Set(names)], f => { $('loadbar').style.width = (f * 40) + '%'; });
}
setTownData(await fetch('assets/house/townhouse.json').then(r => r.ok ? r.json() : null).catch(() => null));      // hand-made townhouse interior (colliders, stairs, doors, interactives)
const sky = new Sky(scene), terrain = new Terrain(scene, 20240519, veg), birds = new Birds(scene), ambience = new Ambience();
const houses = new HouseManager({ scene, terrain, sky }); terrain.houses = houses;
const cfgWater = mergeWater(await fetch('config/water.json').then(r => r.ok ? r.json() : null).catch(() => null) || {});
const fx = new WaterFX(scene, cfgWater.level);
const clips = {}; for (const [k, d] of Object.entries(GEN.defaults())) clips[k] = new Clip(d);
try { for (const f of await (await fetch('anims/index.json')).json()) { const d = await (await fetch('anims/' + f)).json(); clips[d.name] = new Clip(d); } } catch { }
const graph = await fetch('config/graph.json').then(r => r.ok ? r.json() : null).catch(() => null) || GEN.defaultGraph();

// realistic character (glTF); falls back to the procedural mannequin if the assets cannot be loaded
let charBody = null, charAssets = null;
try {
  $('loadmsg').textContent = 'Cargando el personaje…';
  const cfgChar = await fetch('config/character.json').then(r => r.ok ? r.json() : null).catch(() => null) || {};
  charAssets = await loadCharacterAssets(); charBody = new GltfBody(charAssets, { ...cfgChar, ...(loadSavedLook() || {}) });
} catch (e) { console.warn('Character assets unavailable, using the procedural rig', e); }
$('loadmsg').textContent = 'Generando el terreno…';
const player = new Player(scene, terrain, clips, graph, cfgWater.level, charBody);
player.spawnNearOrigin(); sky.set(9);
player.onFootstep = (name, wading) => { ambience.footstep(wading, player.speed > 4 ? 1 : 0); if (wading > .2) fx.splash(player.pos.x + (Math.random() - .5) * .5, player.pos.z + (Math.random() - .5) * .5, 6 + Math.floor(player.speed * 1.5), .5 + player.speed * .12); };
const worldMap = new WorldMap({ seed: terrain.seed, R: 4200, mpp: 12 }); worldMap.hfHeight = (x, z) => terrain.height(x, z); worldMap.setPlan(terrain.hf.plan());
let inDialogue = false;
const dialogue = new DialogueUI(() => { inDialogue = true; document.exitPointerLock?.(); keys.clear(); }, () => { inDialogue = false; });
const npcs = charAssets ? new NPCManager({ scene, terrain, player, assets: charAssets, sky, worldMap, ui: dialogue, camera }) : null;
const animals = new AnimalManager({ scene, terrain, player, sky });
const horse = new PlayerHorse({ scene, terrain, player, lib: animals.lib }); horse.look = { ...DEFAULT_HORSE, ...(loadSavedLook()?.horse || {}) };

// ---------- combat ----------
applyTuning(await fetch('config/combat.json').then(r => r.ok ? r.json() : null).catch(() => null));      // edited in the Studio
const respawnPoint = () => { const P = player.pos, s = terrain.hf.plan().settlements.filter(o => o.type <= 2).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; return s ? { x: s.x + Math.cos(s.axis + 1.57) * 14, z: s.z + Math.sin(s.axis + 1.57) * 14 } : null; };
let enemies = null;
const combat = new PlayerCombat({ player, terrain, getTargets: () => enemies ? enemies.targets.concat(window.__game?.net?.pvpTargets?.() || []) : [], onEvent: (ev, data) => {
  if (ev === 'hurt') ambience.footstep?.(0, 1);
  if (ev === 'died') { $('deadscr').classList.remove('hidden'); economy.deathPenalty(); }
  if (ev === 'needRespawn') { $('deadscr').classList.add('hidden'); combat.respawn(respawnPoint()); }
  window.__game?.net?.combatEvent?.(ev, data);
} });
enemies = charAssets ? new EnemyManager({ scene, terrain, player, combat, assets: charAssets, camera, plan: terrain.hf.plan() }) : null;

// ---------- story + cinematics ----------
function showToast(small, big) { const t = $('toast'); t.innerHTML = '<small>' + small + '</small>' + big; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 4600); }
let story = null;
const cine = new Cinematics({ camera, terrain, player, resolve: a => story.resolve(a), onStart: () => { inDialogue = true; keys.clear(); document.body.classList.add('cinema'); }, onEnd: () => { inDialogue = false; document.body.classList.remove('cinema'); } });
story = new Story({ plan: terrain.hf.plan(), terrain, player, npcs, enemies, combat, worldMap, cine, getName: () => charBody?.cfg?.name, toast: showToast });
houses.bind({ player, combat, camera, toast: showToast });
const economy = new Economy({ inv: houses.inv, combat, toast: showToast, sword: (c, l) => charBody?.setBlade?.(c, l), hooks: { onOpen: () => { inDialogue = true; document.exitPointerLock?.(); keys.clear(); }, onClose: () => { inDialogue = false; } } });
if (npcs) { npcs.story = story; npcs.houses = houses; npcs.shop = economy; } if (enemies) enemies.onKill = e => { story.onKill(e); economy.reward(e); };
let lastRegion = '', pendingChunks = 0, lastAutoT = 0;
function captureThumb() { try { renderer.render(scene, camera); const c = document.createElement('canvas'); c.width = 192; c.height = 108; c.getContext('2d').drawImage(renderer.domElement, 0, 0, 192, 108); return c.toDataURL('image/jpeg', .55); } catch { return null; } }
const save = new SaveManager({ player, terrain, sky, combat, houses, economy, story, cine, net: null, toast: showToast, getName: () => charBody?.cfg?.name || 'Forastero', getRegion: () => lastRegion, getPlay: () => gameTime, started: () => started, isPaused: () => paused, capture: captureThumb });
houses.onSlept = () => save.auto('Has dormido'); story.onStage = () => setTimeout(() => save.auto('Progreso de la historia'), 2500);

// ---------- multiplayer ----------
const chatin = $('chatin'), chatlog = $('chatlog');
const net = new Multiplayer({ scene, player, assets: charAssets, camera, worldMap, combat, enemies, getLook: () => charBody?.cfg || {}, onStatus: (t, chat) => {
  if (!chat) $('mp-status').textContent = t; const d = document.createElement('div'); d.textContent = (chat ? '' : '🌐 ') + t; chatlog.append(d); setTimeout(() => d.remove(), chat ? 12000 : 6000); while (chatlog.children.length > 7) chatlog.firstChild.remove(); } });
if (enemies) { enemies.onPuppetHit = (e, info) => net.puppetHit(e, info); enemies.extraTargets = () => net.role === 'host' ? net.remoteTargets() : []; }
save.c.net = net;
$('t-mp').onclick = () => { $('mp').classList.remove('hidden'); };
$('mp-close').onclick = () => $('mp').classList.add('hidden');
$('mp-host').onclick = async () => { const c = await net.host(); if (c) $('mp-code').value = c; };
$('mp-join').onclick = () => net.join($('mp-code').value);
$('mp-pvp').onchange = e => { net.pvp = e.target.checked; };
$('mp-leave').onclick = () => { net.stop(); $('mp-status').textContent = 'Has salido de la sala.'; };
$('mpinfo').onclick = () => { try { navigator.clipboard.writeText(net.code); } catch { } };
chatin.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter') { net.chat(chatin.value.trim()); chatin.value = ''; chatin.classList.add('hidden'); chatin.blur(); } else if (e.code === 'Escape') { chatin.value = ''; chatin.classList.add('hidden'); chatin.blur(); } });

// ---------- settings ----------
let maxRatio = 1, ratio = 1, camDist = settings.camDist, camYaw = Math.PI, camPitch = .28, timeScale = 1, shadowSize = -1;
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
function applySettings() {
  maxRatio = Math.max(.5, Math.min(devicePixelRatio, settings.resScale)); ratio = settings.adaptive ? Math.min(ratio, maxRatio) : maxRatio; renderer.setPixelRatio(ratio);
  const on = settings.shadows > 0, toggled = renderer.shadowMap.enabled !== on; renderer.shadowMap.enabled = on; sky.sun.castShadow = on;
  if (on && shadowSize !== settings.shadows) { shadowSize = settings.shadows; sky.sun.shadow.mapSize.set(shadowSize, shadowSize); sky.sun.shadow.map?.dispose(); sky.sun.shadow.map = null; }
  if (toggled) scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });   // shader variants change only when shadows are switched
  terrain.setQuality(settings); camera.fov = settings.fov; camDist = settings.camDist; resize();
  ambience.setVolumes(settings.volMaster, settings.volAmbient, settings.volFx);
  $('hud').style.display = settings.showHud ? '' : 'none'; $('minimap').style.display = settings.showMinimap ? '' : 'none';
}
ratio = Math.min(devicePixelRatio, settings.resScale, 1); applySettings();

// ---------- menu / pause ----------
let paused = true, started = false, lastFps = 60, cpuMs = 0;
const hasSavedLook = !!loadSavedLook();
const menu = new GameMenu(settings, {
  onOpen: () => { paused = true; }, onClose: () => { if (!worldMap.bigOpen) paused = !started; if (!started) $('title').classList.remove('hidden'); },
  onChange: applySettings, onMap: () => openMap(), blockEsc: () => worldMap.bigOpen || economy.blockEsc, saves: save, isStarted: () => started, onLoad: id => loadGame(id), onSaved: () => showToast('Partida guardada', 'Ranura guardada'),
  onExit: () => { try { window.close(); } catch { } document.body.append(Object.assign(document.createElement('div'), { id: 'exitscreen', innerHTML: '<h2>HAS SALIDO DEL JUEGO</h2><button class="mbtn primary" style="width:260px" onclick="location.reload()">Volver a jugar</button>' })); exited = true; ambience.ctx?.suspend?.(); },
  getDiag: () => ({ gpu: gpuName, software: softwareGL, fps: lastFps, cpu: cpuMs, gpu_ms: gpuMs, res: ratio, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: terrain.chunks.size, mem: `${renderer.info.memory.geometries} / ${renderer.info.memory.textures}` }),
});
// ---------- title screen + character creator ----------
const creator = charAssets ? new CharacterCreator($('creator'), charAssets, cfg => {
  if (cfg) { charBody.setConfig(cfg); player.applyLook(); horse.setLook(cfg.horse || {}); }
  $('title').classList.remove('hidden');
}) : null;
function beginPlay() { $('title').classList.add('hidden'); paused = false; started = true; story.start(); canvas.requestPointerLock?.(); ambience.start(); }
// Loads a save: teleports, restores the state and waits for the terrain around the new position before revealing it.
async function loadGame(id) {
  const d = save.read(id); if (!d) return; const wasOpen = menu.open; if (wasOpen) menu.close(); $('title').classList.add('hidden'); const f = $('fade'); f.style.opacity = 1; await new Promise(r => setTimeout(r, 450));
  save.apply(d); camYaw = (d.pos.yaw || 0) - Math.PI; paused = true; let calm = 0; for (let i = 0; i < 160 && calm < 6; i++) { await new Promise(r => setTimeout(r, 60)); calm = pendingChunks === 0 ? calm + 1 : 0; }
  if (!started) beginPlay(); else { paused = false; canvas.requestPointerLock?.(); } f.style.opacity = 0; showToast('Partida cargada', d.region || '');
}
function showTitle() {
  const t = $('title'); t.classList.remove('hidden');
  $('t-name').textContent = charBody ? charBody.cfg.name || 'Forastero' : '';
  const last = save.latest(); if (!$('t-cont')) { const mk = (id, label) => Object.assign(document.createElement('button'), { id, className: 'mbtn', type: 'button', textContent: label }), play = $('t-play'); play.before(mk('t-cont', 'Continuar')); play.after(mk('t-load', 'Cargar partida')); }
  $('t-cont').classList.toggle('hidden', !last); $('t-load').classList.toggle('hidden', !last); $('t-cont').classList.add('primary'); $('t-play').classList.toggle('primary', !last); $('t-play').textContent = last ? 'Nueva partida' : 'Jugar';
  $('t-cont').onclick = () => loadGame(save.latest().id); $('t-load').onclick = () => { t.classList.add('hidden'); menu.show('saves'); };
  $('t-play').onclick = () => { if (last && !confirm('¿Empezar una partida nueva? Tus ranuras guardadas se conservan, pero el progreso actual se reinicia.')) return; if (last) save.newGame(); beginPlay(); };
  $('t-char').onclick = () => { if (!creator) return; t.classList.add('hidden'); creator.cfg = { ...creator.cfg, ...charBody.cfg }; creator.open(); };
  $('t-set').onclick = () => { t.classList.add('hidden'); menu.show(); };
  if (!hasSavedLook && creator) $('t-char').click();      // first launch: create the character first
}
function openMap() { paused = true; worldMap.openBig(player.pos.x, player.pos.z); document.exitPointerLock?.(); }
function closeMap() { worldMap.closeBig(); if (!menu.open) paused = false; }

// ---------- input ----------
const keys = new Set(); let jumpPressed = false;
addEventListener('keydown', e => {
  if (menu.open || inDialogue || document.activeElement === chatin || !$('mp').classList.contains('hidden')) return;
  if (e.code === 'Enter' && net.active && started) { chatin.classList.remove('hidden'); chatin.focus(); e.preventDefault(); return; }
  if (e.code === 'Escape') { if (worldMap.bigOpen) { closeMap(); e.preventDefault(); } return; }
  if (!keys.has(e.code) && e.code === 'Space') jumpPressed = true;
  keys.add(e.code); ambience.start();
  if (e.code === 'KeyQ') horse.call();
  if (e.code === 'KeyE') { if (horse.riding) horse.toggleMount(); else if (npcs?.nearest) npcs.interact(); else if (houses.target) houses.interact(); else horse.toggleMount(); }
  if (e.code === 'KeyI') houses.toggleInv();
  if (e.code === 'KeyM') { worldMap.bigOpen ? closeMap() : openMap(); }
  if (worldMap.bigOpen) return;
  if (e.code === 'BracketRight') sky.set(sky.hour + 1); if (e.code === 'BracketLeft') sky.set(sky.hour - 1);
  if (e.code === 'KeyP') timeScale = timeScale ? 0 : 1; if (e.code === 'KeyH') $('help').classList.toggle('hide');
  if (e.code === 'KeyG') player.ikOn = !player.ikOn;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('mousedown', e => { if (cine.active || paused || !started || document.pointerLockElement !== canvas) return; if (e.button === 0) combat.attackDown(); else if (e.button === 2) combat.blockDown(); });
addEventListener('mouseup', e => { if (e.button === 0) combat.attackUp(); else if (e.button === 2) combat.blockUp(); });
addEventListener('contextmenu', e => { if (document.pointerLockElement === canvas) e.preventDefault(); });
addEventListener('keydown', e => {
  if (paused || !started || menu.open || inDialogue || document.activeElement === chatin || horse.riding) return;
  if (e.code === 'KeyR' && !e.repeat) combat.toggleDraw();
  if (e.code === 'KeyV' && !e.repeat) { const f = new THREE.Vector3(), r = new THREE.Vector3(); const dx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), dz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0); f.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)); r.set(Math.cos(camYaw), 0, -Math.sin(camYaw)); combat.dodge(dx || dz ? f.multiplyScalar(dz).addScaledVector(r, dx) : null); }
  if (/^Digit[1-6]$/.test(e.code) && !e.repeat) combat.playEmote(+e.code.slice(5) - 1);
});
addEventListener('blur', () => keys.clear());
canvas.addEventListener('click', () => { if (!paused) { canvas.requestPointerLock?.(); ambience.start(); } });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && started && !menu.open && !worldMap.bigOpen && !inDialogue && !economy.isOpen) menu.show(); });   // Esc while playing opens the menu
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && !paused) { camYaw -= e.movementX * .0025 * settings.sens; camPitch = Math.max(-.35, Math.min(1.25, camPitch + e.movementY * .0025 * settings.sens * (settings.invertY ? -1 : 1))); } });
canvas.addEventListener('wheel', e => { if (!paused) { camDist = Math.max(2.2, Math.min(14, camDist * (1 + Math.sign(e.deltaY) * .08))); e.preventDefault(); } }, { passive: false });
addEventListener('resize', resize);

// ---------- image-based lighting from the sky (updated as the time of day changes) ----------
const pmrem = new THREE.PMREMGenerator(renderer); let envTarget = null, envHour = -99;
function updateEnv() { sky.update(0, player.pos, camera); const t = pmrem.fromScene(sky.envScene, 0, .1, 2000); envTarget?.dispose(); envTarget = t; scene.environment = t.texture; envHour = sky.hour; }
updateEnv();

// ---------- frame ----------
let orbitT = 0; const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3(), skyCol = new THREE.Color();
let fxT = 0, fpsAcc = 0, fpsN = 0, hudT = 0, gameTime = 0, adaptT = 0, slowT = 0, fastT = 0, ready = false, loadT = 0;
terrain.update(player.pos.x, player.pos.z, 8);
function frame(dt) {
  const t0 = performance.now(); dt = Math.min(dt, .05); if (combat.hitstop > 0) dt *= .1; fpsAcc += dt; fpsN++;
  let wading = player.wading;
  if (!started && paused) { orbitT += dt * .08; const px = player.pos.x, pz = player.pos.z; camera.position.set(px + Math.cos(orbitT) * 42, player.pos.y + 17, pz + Math.sin(orbitT) * 42); camera.lookAt(px, player.pos.y + 5, pz); }   // title screen: slow fly-around of the starting town
  if (!paused) {
    gameTime += dt;
    camYaw -= ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * 1.8 * dt;
    const input = { x: inDialogue ? 0 : (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), z: inDialogue ? 0 : (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
      gait: keys.has('ShiftLeft') || keys.has('ShiftRight') ? 'run' : keys.has('KeyC') ? 'walk' : 'jog', jump: jumpPressed };
    jumpPressed = false;
    if (horse.riding) { horse.update(dt, { x: input.x, z: input.z, gait: input.gait }); player.rideUpdate(dt); wading = 0; }
    else { if (combat.emote && (input.x || input.z || input.jump)) combat.cancelEmote(); combat.update(dt, input, camYaw); const ms = combat.moveScale(); wading = player.update(dt, { x: input.x * ms, z: -input.z * ms, gait: input.gait, jump: input.jump && ms > 0 }, camYaw); horse.update(dt, input); }   // D = camera right, W = camera forward
    sky.set(sky.hour + dt * timeScale * 24 / (settings.dayLength * 60));
    worldMap.reveal(player.pos.x, player.pos.z); worldMap.persist(dt);
    const focus = new THREE.Vector3(player.pos.x, player.pos.y + (charBody ? 1.65 : 1.55), player.pos.z), cp = Math.cos(camPitch);
    camPos.set(focus.x + Math.sin(camYaw) * cp * camDist, focus.y + Math.sin(camPitch) * camDist, focus.z + Math.cos(camYaw) * cp * camDist);
    const f = terrain.clearFraction(focus, camPos); if (f < 1) camPos.lerpVectors(focus, camPos, f);
    const gh = Math.max(terrain.height(camPos.x, camPos.z) + .6, cfgWater.level + .35); if (camPos.y < gh) camPos.y = gh;
    camera.position.lerp(camPos, 1 - Math.exp(-22 * dt)); lookAt.lerp(focus, 1 - Math.exp(-22 * dt)); camera.lookAt(lookAt);
    const day = Math.max(0, Math.min(1, sky.uniforms.sunDir.value.y * 3 + .3));
    birds.update(dt, gameTime, player.pos, day);
    npcs?.update(dt); enemies?.update(cine.active ? 0 : dt, dt); story.update(dt); houses.update(dt); dialogue.tick(dt); animals.update(dt); net.update(dt); if (net.active) worldMap.markers = (worldMap.markers || []).concat(net.markers()); if (horse.near && !npcs?.nearest) dialogue.setPrompt(`E — Montar a ${horse.look.name}`); else if (horse.mounted) dialogue.setPrompt('E — Desmontar'); else if (houses.target && !npcs?.nearest) dialogue.setPrompt('E — ' + houses.target.label);
    if (started) { const rg0 = worldMap.regionAt(player.pos.x, player.pos.z), stt = terrain.hf.plan().settlementAt(player.pos.x, player.pos.z), inTown = stt && stt.d < .95, rg = inTown ? { name: stt.s.name } : rg0; if (rg.name !== lastRegion) { lastRegion = rg.name; if (inTown) save.auto('Entraste en ' + rg.name); const t = $('toast'); t.innerHTML = '<small>' + (inTown ? typeName(stt.s.type) : 'Entrando en') + '</small>' + rg.name; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 4200); } }
    if (player.depth > .1 && player.speed > .25) { fxT -= dt; if (fxT <= 0) { fxT = .22 / (1 + player.speed * .35); const a = Math.random() * 6.283, r = player.swimming ? .5 : .28; fx.ring(player.pos.x + Math.cos(a) * r, player.pos.z + Math.sin(a) * r, 1.0 + Math.min(1, player.depth) * .9, 1.4, .5); } }
    fx.update(dt); if (started && gameTime - lastAutoT > 240) { lastAutoT = gameTime; save.auto('Autoguardado'); }
    if (Math.floor(gameTime * 4) !== Math.floor((gameTime - dt) * 4)) ambience.update(.25, { water: terrain.waterNear(player.pos.x, player.pos.z), hour: sky.hour, speed: player.speed });
  }
  const pending = terrain.update(player.pos.x, player.pos.z); pendingChunks = pending;
  if (!ready) {
    loadT = Math.min(1, terrain.chunks.size / 24); $('loadbar').style.width = (loadT * 100) + '%';
    if (terrain.chunks.size >= 24) { ready = true; $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 800); showTitle(); }
  }
  sky.update(dt, player.pos, camera);
  if (Math.abs(sky.hour - envHour) > .3 && Math.abs(sky.hour - envHour) < 23) updateEnv();
  skyCol.copy(sky.uniforms.top.value).lerp(sky.uniforms.bottom.value, .5);
  terrain.tick(gameTime, cfgWater, camera.position, sky.uniforms.sunDir.value, sky.uniforms.sunColor.value, skyCol);
  { const bx = $('hp'), sx = $('st'); bx.style.width = Math.max(0, combat.hp / combat.maxHp * 100) + '%'; sx.style.width = combat.stamina / combat.maxStamina * 100 + '%'; $('hitflash').style.opacity = combat.flash; $('swordstate').textContent = combat.drawn ? 'ESPADA EN MANO · clic ataque · mantener clic fuerte · clic der. bloquear · V esquivar' : ''; if (combat.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5) * combat.shake * .12, (Math.random() - .5) * combat.shake * .12, 0)); }
  cine.update(dt);
  creator?.update(dt);
  const q = gpuBegin(); renderer.render(scene, camera); gpuEnd(q); gpuPoll();
  if (!tq && (++probeN % 20) === 0) { const t1 = performance.now(); gl.finish(); const ms = performance.now() - t1; gpuMs = gpuMs == null ? ms : gpuMs + (ms - gpuMs) * .2; }   // GPUs without timer queries: measure the wait for the GPU to drain
  if (!worldMap.bigOpen) worldMap.drawMini(player.pos.x, player.pos.z, camYaw); else worldMap.drawBig(player.pos.x, player.pos.z, camYaw);

  // dynamic resolution
  adaptT += dt; if (adaptT >= 1) {
    const cur = fpsN / fpsAcc; lastFps = cur; adaptT = 0; fpsAcc = 0; fpsN = 0;
    if (settings.adaptive && !paused) {
      // judge by real work time (CPU + GPU) so a capped refresh rate (30/60 Hz, vsync, power saving) doesn't wrongly shrink the image
      const work = gpuMs != null ? Math.max(cpuMs, gpuMs) + Math.min(cpuMs, gpuMs) * .3 : 1000 / cur, slow = gpuMs != null ? work > 22 : cur < 42, fast = gpuMs != null ? work < 14 : cur > 57;
      if (slow) { slowT++; fastT = 0; } else if (fast) { fastT++; slowT = 0; } else { slowT = fastT = 0; }
      if (slowT >= 2 && ratio > .5) { ratio = Math.max(.5, ratio - .15); renderer.setPixelRatio(ratio); resize(); slowT = 0; }
      if (fastT >= 2 && ratio < maxRatio) { ratio = Math.min(maxRatio, ratio + .15); renderer.setPixelRatio(ratio); resize(); fastT = 0; }
    }
  }
  cpuMs += (performance.now() - t0 - cpuMs) * .08;
  hudT += dt; if (hudT > .25) {
    hudT = 0; const h = Math.floor(sky.hour), m = Math.floor((sky.hour - h) * 60), i = renderer.info.render, warn = softwareGL ? '<span class="warn"> · ⚠ GPU por software: activa la aceleración por hardware del navegador</span>' : '';
    $('hud').innerHTML = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${lastFps.toFixed(0)} fps · CPU ${cpuMs.toFixed(1)} ms${gpuMs != null ? ' · GPU ' + gpuMs.toFixed(1) + ' ms' : ''} · res ${(ratio * 100).toFixed(0)}% · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · chunks ${terrain.chunks.size}${pending ? ' (+' + pending + ')' : ''} · ${player.state}${player.swimming ? ' · nadando' : wading ? ' · vadeando' : ''}${warn}`;
  }
}
let last = performance.now(), exited = false;
(function loop(now) {
  if (exited) return; requestAnimationFrame(loop);
  const cap = settings.fpsCap; if (cap <= 240 && now - last < 1000 / cap - 1.5) return;      // user fps limit
  frame((now - last) / 1000); last = now;
})(last);
window.__game = { economy, save, houses, story, cine, combat, enemies, net, horse, animals, player, terrain, sky, camera, scene, keys, renderer, birds, ambience, settings, menu, worldMap, npcs, dialogue, applySettings, tick: (dt = 1 / 60) => frame(dt), setCam: (y, p, d) => { camYaw = y; camPitch = p; camDist = d; }, get ratio() { return ratio; }, get paused() { return paused; } };
