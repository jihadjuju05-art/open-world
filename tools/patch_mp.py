import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
edit('index.html', [
('<script type="module" src="src/main.js"></script>', '<script src="lib/peerjs.min.js"></script>\n<script type="module" src="src/main.js"></script>'),
('#exitscreen{', """#mp{position:fixed;inset:0;z-index:31;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center}
#mp .menu-box{width:min(430px,92vw)}#mp input{background:#2a2116;color:#f1e6cc;border:1px solid #5b4a2b;padding:11px;font:20px Georgia,serif;letter-spacing:6px;text-align:center;text-transform:uppercase;flex:1;min-width:0}
#mp .r2{display:flex;gap:8px;margin:9px 0}#mp-status{min-height:38px;color:#e6c98a;font:13px/1.4 system-ui,sans-serif;text-align:center;margin:8px 0}
#mpinfo{position:fixed;right:16px;top:10px;z-index:12;background:rgba(20,14,8,.7);border:1px solid #6b5630;padding:5px 12px;color:#e6c98a;font:13px system-ui,sans-serif;cursor:pointer}
.nameplate{position:fixed;z-index:11;transform:translate(-50%,-100%);pointer-events:none;text-align:center;font:600 14px Georgia,serif;text-shadow:0 1px 3px #000,0 0 6px #000;white-space:nowrap}
.nameplate span{display:block;background:rgba(250,244,228,.94);color:#2a1d10;border-radius:10px;padding:2px 9px;font:13px Georgia,serif;margin-top:2px;max-width:220px;white-space:normal}.nameplate span:empty{display:none}
#chatlog{position:fixed;left:12px;bottom:110px;z-index:12;font:13px/1.5 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;max-width:46vw;pointer-events:none}#chatin{position:fixed;left:12px;bottom:76px;z-index:13;width:min(420px,60vw);background:rgba(20,14,8,.85);color:#fff;border:1px solid #6b5630;padding:6px 10px;font:14px system-ui,sans-serif}
#exitscreen{"""),
('<button class="mbtn" id="t-set">Ajustes</button>', '<button class="mbtn" id="t-mp">Multijugador</button><button class="mbtn" id="t-set">Ajustes</button>'),
('<div id="creator" class="hidden"></div>', """<div id="creator" class="hidden"></div>
<div id="mp" class="hidden"><div class="menu-box"><h1 style="font-size:24px">MULTIJUGADOR</h1><div class="sub">Uno crea la sala y los demás entran con el código</div>
<button class="mbtn primary" id="mp-host">Crear sala</button><div class="r2"><input id="mp-code" placeholder="CÓDIGO" maxlength="6"><button class="mbtn" id="mp-join" style="width:auto;margin:0;padding:0 20px">Unirse</button></div>
<div id="mp-status"></div><button class="mbtn" id="mp-leave">Salir de la sala</button><button class="mbtn" id="mp-close">Cerrar</button></div></div>
<div id="mpinfo" class="hidden" title="Clic para copiar el código"></div><div id="chatlog"></div><input id="chatin" class="hidden" maxlength="120" placeholder="Escribe y pulsa Enter (Esc cancela)">"""),
])
edit('src/main.js', [
("import { AnimalManager } from './animals.js';", "import { AnimalManager } from './animals.js';\nimport { Multiplayer } from './net.js';"),
("// ---------- settings ----------", """// ---------- multiplayer ----------
const chatin = $('chatin'), chatlog = $('chatlog');
const net = new Multiplayer({ scene, player, assets: charAssets, camera, worldMap, getLook: () => charBody?.cfg || {}, onStatus: (t, chat) => {
  if (!chat) $('mp-status').textContent = t; const d = document.createElement('div'); d.textContent = (chat ? '' : '🌐 ') + t; chatlog.append(d); setTimeout(() => d.remove(), chat ? 12000 : 6000); while (chatlog.children.length > 7) chatlog.firstChild.remove(); } });
$('t-mp').onclick = () => { $('mp').classList.remove('hidden'); };
$('mp-close').onclick = () => $('mp').classList.add('hidden');
$('mp-host').onclick = async () => { const c = await net.host(); if (c) $('mp-code').value = c; };
$('mp-join').onclick = () => net.join($('mp-code').value);
$('mp-leave').onclick = () => { net.stop(); $('mp-status').textContent = 'Has salido de la sala.'; };
$('mpinfo').onclick = () => { try { navigator.clipboard.writeText(net.code); } catch { } };
chatin.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter') { net.chat(chatin.value.trim()); chatin.value = ''; chatin.classList.add('hidden'); chatin.blur(); } else if (e.code === 'Escape') { chatin.value = ''; chatin.classList.add('hidden'); chatin.blur(); } });

// ---------- settings ----------"""),
("  if (menu.open || inDialogue) return;\n", "  if (menu.open || inDialogue || document.activeElement === chatin || !$('mp').classList.contains('hidden')) return;\n  if (e.code === 'Enter' && net.active && started) { chatin.classList.remove('hidden'); chatin.focus(); e.preventDefault(); return; }\n"),
("npcs?.update(dt); dialogue.tick(dt); animals.update(dt);", "npcs?.update(dt); dialogue.tick(dt); animals.update(dt); net.update(dt); if (net.active) worldMap.markers = (worldMap.markers || []).concat(net.markers());"),
("window.__game = { horse,", "window.__game = { net, horse,"),
])
edit('src/map.js', [
("if (this.view.zoom > 1.1) { ctx.fillStyle = '#fff3d0'; ctx.font = '11px Georgia, serif';", "if (this.view.zoom > 1.1 || m.always) { ctx.fillStyle = '#fff3d0'; ctx.font = '11px Georgia, serif';"),
])
print('ok')
