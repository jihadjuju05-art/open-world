import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/main.js', [
("import { Multiplayer } from './net.js';", "import { Multiplayer } from './net.js';\nimport { HouseManager } from './houses.js';"),
("const sky = new Sky(scene), terrain = new Terrain(scene, 20240519, veg), birds = new Birds(scene), ambience = new Ambience();", "const sky = new Sky(scene), terrain = new Terrain(scene, 20240519, veg), birds = new Birds(scene), ambience = new Ambience();\nconst houses = new HouseManager({ scene, terrain, sky }); terrain.houses = houses;"),
("if (npcs) npcs.story = story;", "houses.bind({ player, combat, camera, toast: showToast });\nif (npcs) npcs.story = story;"),
("if (e.code === 'KeyE') { if (horse.riding || !npcs?.nearest) horse.toggleMount(); else npcs.interact(); }", "if (e.code === 'KeyE') { if (horse.riding) horse.toggleMount(); else if (npcs?.nearest) npcs.interact(); else if (houses.target) houses.interact(); else horse.toggleMount(); }\n  if (e.code === 'KeyI') houses.toggleInv();"),
("npcs?.update(dt); enemies?.update(cine.active ? 0 : dt); story.update(dt);", "npcs?.update(dt); enemies?.update(cine.active ? 0 : dt); story.update(dt); houses.update(dt);"),
("else if (horse.mounted) dialogue.setPrompt('E — Desmontar');", "else if (horse.mounted) dialogue.setPrompt('E — Desmontar'); else if (houses.target && !npcs?.nearest) dialogue.setPrompt('E — ' + houses.target.label);"),
("window.__game = { story,", "window.__game = { houses, story,"),
])
edit('index.html', [
('#exitscreen{', """#invbox{position:fixed;right:18px;top:60px;z-index:26;width:260px;max-height:70vh;overflow:auto;padding:14px 16px;background:linear-gradient(#211a11,#17120c);border:1px solid #6b5630;box-shadow:0 0 0 3px #17120c,0 0 0 4px #4b3d26}
#invbox h3{margin:0 0 8px;letter-spacing:5px;color:#e6c98a;font-weight:normal;font-size:15px}#invbox .it{display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #2f2618;font:13px system-ui,sans-serif}#invbox .it span{flex:1}#invbox .it b{color:#e6c98a}#invbox button{background:#3b2e1c;border:1px solid #5b4a2b;color:#f1e6cc;padding:2px 8px;font:12px system-ui;cursor:pointer}
#fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:22;transition:opacity 1.2s}
#exitscreen{"""),
('<div id="toast"></div>', '<div id="invbox" class="hidden"></div><div id="fade"></div>\n<div id="toast"></div>'),
])
print('ok')
