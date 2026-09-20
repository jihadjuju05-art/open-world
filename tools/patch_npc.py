import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:80], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('index.html', [
    ("#exitscreen{position:fixed;", """#prompt{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:rgba(20,14,8,.78);border:1px solid #6b5630;padding:8px 18px;color:#f1e6cc;font:15px Georgia,serif;letter-spacing:1px;z-index:12}
#bubbles{position:fixed;inset:0;pointer-events:none;z-index:11}
.bubble{position:absolute;transform:translate(-50%,-100%);background:rgba(250,244,228,.94);color:#2a1d10;border-radius:14px;padding:6px 12px;font:14px Georgia,serif;max-width:240px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#dialogue{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);width:min(760px,94vw);background:linear-gradient(#211a11,#17120c);border:1px solid #6b5630;box-shadow:0 0 0 4px #17120c,0 0 0 5px #4b3d26,0 16px 50px rgba(0,0,0,.7);padding:18px 24px;z-index:25}
#dialogue .dname{color:#e6c98a;letter-spacing:3px;text-transform:uppercase;font-size:13px;margin-bottom:8px}
#dialogue .dtext{font:18px/1.5 Georgia,serif;min-height:54px;color:#f5ecd6}
#dialogue .dopts{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.dopt{text-align:left;background:#2a2116;color:#f1e6cc;border:1px solid #5b4a2b;padding:8px 12px;font:15px Georgia,serif;cursor:pointer}.dopt:hover{background:#3b2e1c;border-color:#d9b26a}
#exitscreen{position:fixed;"""),
    ('<div id="loading">', '<div id="prompt" class="hidden"></div><div id="bubbles"></div><div id="dialogue" class="hidden"></div>\n<div id="loading">'),
    ("<b>M</b> mapa · <b>Esc</b> menú", "<b>E</b> hablar · <b>M</b> mapa · <b>Esc</b> menú"),
])

edit('src/map.js', [
    ("      if (this.wp) { const [wx, wz] = this.toPx(this.wp.x, this.wp.z); ctx.fillStyle = '#ff4d3d';",
     "      for (const m of this.markers || []) { const [mx2, mz2] = this.toPx(m.x, m.z); ctx.fillStyle = m.color; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.2 / k; ctx.beginPath(); ctx.arc(mx2, mz2, 3.4 / k, 0, 7); ctx.fill(); ctx.stroke(); }\n      if (this.wp) { const [wx, wz] = this.toPx(this.wp.x, this.wp.z); ctx.fillStyle = '#ff4d3d';"),
    ("    // waypoint\n    if (this.wp) {",
     "    for (const m of this.markers || []) {                                                        // NPC markers with names\n      const x = ox + m.x * s, z = oz + m.z * s; ctx.fillStyle = m.color; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, z, 5, 0, 7); ctx.fill(); ctx.stroke();\n      if (this.view.zoom > 1.1) { ctx.fillStyle = '#fff3d0'; ctx.font = '11px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(m.label, x, z - 9); }\n    }\n    // waypoint\n    if (this.wp) {"),
])

edit('src/main.js', [
    ("import { WorldMap } from './map.js';", "import { WorldMap } from './map.js';\nimport { NPCManager } from './npc.js';\nimport { DialogueUI } from './dialogue_ui.js';"),
    ("let charBody = null;\ntry {", "let charBody = null, charAssets = null;\ntry {"),
    ("  charBody = new GltfBody(await loadCharacterAssets(), cfgChar);", "  charAssets = await loadCharacterAssets(); charBody = new GltfBody(charAssets, cfgChar);"),
    ("const worldMap = new WorldMap({ seed: terrain.seed, R: 3000, mpp: 12 }); worldMap.hfHeight = (x, z) => terrain.height(x, z);",
     """const worldMap = new WorldMap({ seed: terrain.seed, R: 3000, mpp: 12 }); worldMap.hfHeight = (x, z) => terrain.height(x, z);
let inDialogue = false;
const dialogue = new DialogueUI(() => { inDialogue = true; document.exitPointerLock?.(); keys.clear(); }, () => { inDialogue = false; });
const npcs = charAssets ? new NPCManager({ scene, terrain, player, assets: charAssets, sky, worldMap, ui: dialogue, camera }) : null;"""),
    ("  if (menu.open) return;\n  if (e.code === 'Escape')", "  if (menu.open || inDialogue) return;\n  if (e.code === 'Escape')"),
    ("  if (e.code === 'KeyM') {", "  if (e.code === 'KeyE') npcs?.interact();\n  if (e.code === 'KeyM') {"),
    ("    const input = { x: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), z: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),",
     "    const input = { x: inDialogue ? 0 : (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), z: inDialogue ? 0 : (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),"),
    ("    birds.update(dt, gameTime, player.pos, day);", "    birds.update(dt, gameTime, player.pos, day);\n    npcs?.update(dt); dialogue.tick(dt);"),
])
print('ok')
