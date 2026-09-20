import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/npc.js', [
("export class NPCManager {", """// Named characters of the story (fixed places, see story.js).
const STORY_DEFS = {
  vargas: { name: 'Ramón Vargas', role: 'sheriff', storyKey: 'vargas', fixed: true, look: { outfit: 'peasant', hair: 'SimpleParted', beard: true, hairColor: '#8a8a8a', skinTone: .45, tint: '#6f7a86', hat: true, hatColor: '#3d2f22', rifle: true, holster: true, scarf: false }, greet: ['Forastero. Acércate, tengo que hablar contigo.'], rumors: [], trade: 'Soy la ley en esta ciudad.' },
  bruno: { name: 'Bruno Salas', role: 'posadero', storyKey: 'bruno', fixed: true, look: { outfit: 'peasant', hair: 'Buzzed', beard: false, skinTone: .55, tint: '#a08f70', hat: false, rifle: false, holster: false, scarf: false }, greet: ['Pasa, pasa. Hay sopa caliente.'], rumors: [], trade: 'Llevo la posada.' },
  amos: { name: 'Amos Reed', role: 'buscador de oro', storyKey: 'amos', fixed: true, look: { outfit: 'peasant', hair: 'Long', beard: true, hairColor: '#4a3320', skinTone: .35, tint: '#7f7357', hat: true, hatColor: '#5a4a34', rifle: false, holster: true, scarf: true }, greet: ['¿Quién anda ahí? ...Ah. Ven, acércate.'], rumors: [], trade: 'Lavo grava en el río.' },
};

export class NPCManager {"""),
("  sync() {\n    const P = this.player.pos;", """  syncStory() {
    if (!this.story) return; const P = this.player.pos; this.storyNpcs ??= {};
    for (const [k, def] of Object.entries(STORY_DEFS)) {
      const p = this.story.pos[k], d = Math.hypot(p.x - P.x, p.z - P.z), have = this.storyNpcs[k];
      if (d < 200 && !have) { const n = new NPC(this, { ...def, settlement: this.plan.settlements[0] }, p.x, p.z); this.storyNpcs[k] = n; this.npcs.push(n); }
      else if (d > 320 && have) { this.scene.remove(have.body.root); const i = this.npcs.indexOf(have); if (i >= 0) this.npcs.splice(i, 1); if (this.active === have) this.endTalk(); delete this.storyNpcs[k]; }
    }
  }
  sync() {
    this.syncStory(); const P = this.player.pos;"""),
("const a = Math.random() * 6.283, r = 6 + Math.random() * 22, tx", "const a = Math.random() * 6.283, r = this.def.fixed ? 1 + Math.random() * 2.5 : 6 + Math.random() * 22, tx"),
])

edit('src/main.js', [
("import { EnemyManager } from './enemies.js';", "import { EnemyManager } from './enemies.js';\nimport { Cinematics, Story } from './story.js';"),
("// ---------- multiplayer ----------", """// ---------- story + cinematics ----------
function showToast(small, big) { const t = $('toast'); t.innerHTML = '<small>' + small + '</small>' + big; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 4600); }
let story = null;
const cine = new Cinematics({ camera, terrain, player, resolve: a => story.resolve(a), onStart: () => { inDialogue = true; keys.clear(); document.body.classList.add('cinema'); }, onEnd: () => { inDialogue = false; document.body.classList.remove('cinema'); } });
story = new Story({ plan: terrain.hf.plan(), terrain, player, npcs, enemies, combat, worldMap, cine, getName: () => charBody?.cfg?.name, toast: showToast });
if (npcs) npcs.story = story; if (enemies) enemies.onKill = e => story.onKill(e);

// ---------- multiplayer ----------"""),
("$('t-play').onclick = () => { t.classList.add('hidden'); paused = false; started = true;", "$('t-play').onclick = () => { t.classList.add('hidden'); paused = false; started = true; story.start();"),
("npcs?.update(dt); enemies?.update(dt);", "npcs?.update(dt); enemies?.update(cine.active ? 0 : dt); story.update(dt);"),
("  creator?.update(dt);", "  cine.update(dt);\n  creator?.update(dt);"),
("addEventListener('mousedown', e => { if (paused || !started ||", "addEventListener('mousedown', e => { if (cine.active || paused || !started ||"),
("window.__game = { combat,", "window.__game = { story, cine, combat,"),
])
edit('index.html', [
('#exitscreen{', "body.cinema #hud,body.cinema #minimap,body.cinema #help,body.cinema #hpwrap,body.cinema #objective,body.cinema #mpinfo,body.cinema #chatlog{display:none!important}\n#exitscreen{"),
])
print('ok')
