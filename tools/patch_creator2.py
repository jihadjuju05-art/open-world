import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:80], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/main.js', [
    ("import { loadCharacterAssets, GltfBody } from './character.js';",
     "import { loadCharacterAssets, GltfBody } from './character.js';\nimport { CharacterCreator, loadSavedLook } from './creator.js';"),
    ("  charAssets = await loadCharacterAssets(); charBody = new GltfBody(charAssets, cfgChar);",
     "  charAssets = await loadCharacterAssets(); charBody = new GltfBody(charAssets, { ...cfgChar, ...(loadSavedLook() || {}) });"),
    ("let paused = false, started = false, lastFps = 60, cpuMs = 0;",
     "let paused = true, started = false, lastFps = 60, cpuMs = 0;\nconst hasSavedLook = !!loadSavedLook();"),
    ("    if (terrain.chunks.size >= 24) { ready = true; started = true; $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 800); }",
     "    if (terrain.chunks.size >= 24) { ready = true; $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 800); showTitle(); }"),
    ("function openMap() {",
     """// ---------- title screen + character creator ----------
const creator = charAssets ? new CharacterCreator($('creator'), charAssets, cfg => {
  if (cfg) { charBody.setConfig(cfg); player.applyLook(); }
  $('title').classList.remove('hidden');
}) : null;
function showTitle() {
  const t = $('title'); t.classList.remove('hidden');
  $('t-name').textContent = charBody ? charBody.cfg.name || 'Forastero' : '';
  $('t-play').onclick = () => { t.classList.add('hidden'); paused = false; started = true; canvas.requestPointerLock?.(); ambience.start(); };
  $('t-char').onclick = () => { if (!creator) return; t.classList.add('hidden'); creator.cfg = { ...creator.cfg, ...charBody.cfg }; creator.open(); };
  $('t-set').onclick = () => { t.classList.add('hidden'); menu.show(); };
  if (!hasSavedLook && creator) $('t-char').click();      // first launch: create the character first
}
function openMap() {"""),
    ("    npcs?.update(dt); dialogue.tick(dt);", "    npcs?.update(dt); dialogue.tick(dt);"),
    ("  const q = gpuBegin(); renderer.render(scene, camera); gpuEnd(q); gpuPoll();",
     "  creator?.update(dt);\n  const q = gpuBegin(); renderer.render(scene, camera); gpuEnd(q); gpuPoll();"),
])
edit('index.html', [
    ("#exitscreen{", """#title{position:fixed;inset:0;z-index:18;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:9vh;background:linear-gradient(transparent 40%,rgba(8,5,2,.85))}
#title h1{margin:0;font-weight:normal;font-size:64px;letter-spacing:12px;color:#f1dfae;text-shadow:0 4px 24px #000}#title p{margin:6px 0 26px;color:#c9b88f;letter-spacing:3px;font-size:14px}#title .mbtn{width:300px}
#creator{position:fixed;inset:0;z-index:19;display:flex;background:#100c07}
.cc-panel{width:360px;max-width:44vw;overflow:auto;padding:22px 24px;background:linear-gradient(#211a11,#17120c);border-right:1px solid #6b5630;box-sizing:border-box}
.cc-panel h2{margin:0 0 12px;font-weight:normal;letter-spacing:5px;color:#e6c98a;font-size:22px}.cc-panel h3{margin:18px 0 6px;font-weight:normal;letter-spacing:3px;color:#d9b26a;font-size:13px;text-transform:uppercase;border-bottom:1px solid #3b2e1c;padding-bottom:4px}
.cc-field{margin:8px 0}.cc-field>label{display:block;font-size:12px;color:#a89a7c;margin-bottom:4px}.cc-field input[type=text],.cc-field select{width:100%;box-sizing:border-box;background:#2a2116;color:#f1e6cc;border:1px solid #5b4a2b;padding:7px 9px;font:14px Georgia,serif}.cc-field input[type=range]{width:100%;accent-color:#d9b26a}
.cc-chk{display:block;margin:6px 0;font-size:14px;cursor:pointer}.cc-sw{display:flex;gap:6px;flex-wrap:wrap}.cc-color{width:26px;height:26px;border:2px solid #3b2e1c;border-radius:50%;cursor:pointer;padding:0}.cc-color.on{border-color:#fff;box-shadow:0 0 0 2px #d9b26a}
.cc-foot{display:flex;gap:8px;margin-top:20px}.cc-foot .mbtn{margin:0;padding:10px 4px;font-size:13px}
.cc-view{flex:1;position:relative;background:radial-gradient(ellipse at 50% 60%,#4a3a26,#14100a 75%)}.cc-view canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab}.cc-hint{position:absolute;bottom:14px;width:100%;text-align:center;color:#a89a7c;font:12px system-ui,sans-serif;pointer-events:none}
#exitscreen{"""),
    ('<div id="toast"></div>', '<div id="title" class="hidden"><h1>OPEN WORLD</h1><p>Bienvenido, <b id="t-name"></b></p><button class="mbtn primary" id="t-play">Jugar</button><button class="mbtn" id="t-char">Crear / editar personaje</button><button class="mbtn" id="t-set">Ajustes</button></div>\n<div id="creator" class="hidden"></div>\n<div id="toast"></div>'),
])
edit('src/main.js', [("onClose: () => { if (!worldMap.bigOpen) paused = false; },", "onClose: () => { if (!worldMap.bigOpen) paused = !started; if (!started) $('title').classList.remove('hidden'); },")])
print('ok')
