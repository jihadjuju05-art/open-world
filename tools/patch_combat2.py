import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('index.html', [
('#exitscreen{', """#hpwrap{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:12;width:min(360px,50vw);pointer-events:none}
#hpwrap .bar2{height:10px;background:rgba(0,0,0,.55);border:1px solid #5b4a2b;margin-top:4px;overflow:hidden}#hpwrap .bar2 i{display:block;height:100%;width:100%;transition:width .12s}
#hp{background:linear-gradient(#d9483b,#8f231b)}#st{background:linear-gradient(#e8c766,#a8842c)}#hpwrap small{display:block;text-align:center;color:#e6c98a;font:11px system-ui,sans-serif;letter-spacing:2px;text-shadow:0 1px 2px #000}
#hitflash{position:fixed;inset:0;z-index:10;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,rgba(170,20,10,.6));opacity:0}
#deadscr{position:fixed;inset:0;z-index:16;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;flex-direction:column;color:#c63a2c;font:44px Georgia,serif;letter-spacing:10px;pointer-events:none}
#deadscr small{font:14px system-ui,sans-serif;letter-spacing:2px;color:#e6c98a;margin-top:10px}
.ebar{position:fixed;z-index:11;transform:translate(-50%,-100%);pointer-events:none;width:74px;text-align:center;font:600 11px Georgia,serif;color:#f3d9b0;text-shadow:0 1px 3px #000}
.ebar i{display:block;height:5px;background:#c63a2c;margin-top:2px;border:1px solid #000;box-sizing:border-box;width:100%}
#emotes{position:fixed;left:12px;bottom:150px;z-index:12;font:12px system-ui,sans-serif;color:#e6c98a;background:rgba(20,14,8,.7);padding:6px 10px;border:1px solid #6b5630}
#exitscreen{"""),
('<div id="toast"></div>', '<div id="hitflash"></div><div id="deadscr" class="hidden">HAS MUERTO<small>Reapareciendo en el pueblo más cercano…</small></div>\n<div id="hpwrap"><small id="swordstate"></small><div class="bar2"><i id="hp"></i></div><div class="bar2"><i id="st"></i></div></div>\n<div id="toast"></div>'),
])

edit('src/main.js', [
("import { AnimalManager } from './animals.js';", "import { AnimalManager } from './animals.js';\nimport { PlayerCombat, EMOTES } from './combat.js';\nimport { EnemyManager } from './enemies.js';"),
("// ---------- multiplayer ----------", """// ---------- combat ----------
const respawnPoint = () => { const P = player.pos, s = terrain.hf.plan().settlements.filter(o => o.type <= 2).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; return s ? { x: s.x + Math.cos(s.axis + 1.57) * 14, z: s.z + Math.sin(s.axis + 1.57) * 14 } : null; };
let enemies = null;
const combat = new PlayerCombat({ player, terrain, getTargets: () => enemies ? enemies.targets.concat(window.__game?.net?.pvpTargets?.() || []) : [], onEvent: (ev, data) => {
  if (ev === 'hurt') ambience.footstep?.(0, 1);
  if (ev === 'died') $('deadscr').classList.remove('hidden');
  if (ev === 'needRespawn') { $('deadscr').classList.add('hidden'); combat.respawn(respawnPoint()); }
  window.__game?.net?.combatEvent?.(ev, data);
} });
enemies = charAssets ? new EnemyManager({ scene, terrain, player, combat, assets: charAssets, camera, plan: terrain.hf.plan() }) : null;

// ---------- multiplayer ----------"""),
# input scaling + combat update
("    else { wading = player.update(dt, { x: input.x, z: -input.z, gait: input.gait, jump: input.jump }, camYaw); horse.update(dt, input); }",
 "    else { combat.update(dt, input, camYaw); const ms = combat.moveScale(); wading = player.update(dt, { x: input.x * ms, z: -input.z * ms, gait: input.gait, jump: input.jump && ms > 0 }, camYaw); horse.update(dt, input); }"),
("npcs?.update(dt); dialogue.tick(dt);", "npcs?.update(dt); enemies?.update(dt); dialogue.tick(dt);"),
("window.__game = { net,", "window.__game = { combat, enemies, net,"),
# mouse + keys
("addEventListener('keyup', e => keys.delete(e.code));", """addEventListener('keyup', e => keys.delete(e.code));
addEventListener('mousedown', e => { if (paused || !started || document.pointerLockElement !== canvas) return; if (e.button === 0) combat.attackDown(); else if (e.button === 2) combat.blockDown(); });
addEventListener('mouseup', e => { if (e.button === 0) combat.attackUp(); else if (e.button === 2) combat.blockUp(); });
addEventListener('contextmenu', e => { if (document.pointerLockElement === canvas) e.preventDefault(); });
addEventListener('keydown', e => {
  if (paused || !started || menu.open || inDialogue || document.activeElement === chatin || horse.riding) return;
  if (e.code === 'KeyR' && !e.repeat) combat.toggleDraw();
  if (e.code === 'KeyV' && !e.repeat) { const f = new THREE.Vector3(), r = new THREE.Vector3(); const dx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), dz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0); f.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)); r.set(Math.cos(camYaw), 0, -Math.sin(camYaw)); combat.dodge(dx || dz ? f.multiplyScalar(dz).addScaledVector(r, dx) : null); }
  if (/^Digit[1-6]$/.test(e.code) && !e.repeat) combat.playEmote(+e.code.slice(5) - 1);
});"""),
# HUD + shake + hitstop in frame
("function frame(dt) {\n  const t0 = performance.now(); dt = Math.min(dt, .05);", "function frame(dt) {\n  const t0 = performance.now(); dt = Math.min(dt, .05); if (combat.hitstop > 0) dt *= .1;"),
("  creator?.update(dt);", "  { const bx = $('hp'), sx = $('st'); bx.style.width = Math.max(0, combat.hp / combat.maxHp * 100) + '%'; sx.style.width = combat.stamina / combat.maxStamina * 100 + '%'; $('hitflash').style.opacity = combat.flash; $('swordstate').textContent = combat.drawn ? 'ESPADA EN MANO · clic ataque · mantener clic fuerte · clic der. bloquear · V esquivar' : ''; if (combat.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5) * combat.shake * .12, (Math.random() - .5) * combat.shake * .12, 0)); }\n  creator?.update(dt);"),
])
print('ok')
