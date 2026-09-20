import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
edit('src/npc.js', [
("import { WATER_LEVEL } from './heightfield.js';", "import { WATER_LEVEL } from './heightfield.js';\nimport { typeName } from './settlements.js';\n\nconst FIRST = ['Elías', 'Gideon', 'Ezra', 'Caleb', 'Isaac', 'Bruno', 'Hugo', 'Ramón', 'Félix', 'Ignacio', 'Ulises', 'Wyatt', 'Clay', 'Abel', 'Otis', 'Lucas', 'Jonás', 'Mario', 'Dante', 'Casio', 'Emilio', 'Reyes', 'Ciro', 'Bartolo'];\nconst LAST = ['Ortega', 'Salas', 'Reyes', 'Vega', 'Cruz', 'Bravo', 'Luna', 'Rojas', 'Castro', 'Prado', 'Mora', 'Ledesma'];\nconst hh = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };\nconst ROLE_BY_TYPE = [['sheriff', 'banquero', 'herrero', 'posadero', 'comerciante', 'granjero', 'cazador', 'viajero', 'buscador de oro'], ['herrero', 'posadero', 'comerciante', 'granjero', 'pastor', 'cazador'], ['granjero', 'pastor', 'pescador', 'cazador'], ['granjero', 'pastor'], ['viajero', 'cazador', 'buscador de oro']];"),
("    this.spawn();\n  }", """    this.plan = terrain.hf.plan(); this.by = new Map(); this.scanT = 0; this.max = 18; this.serial = 0;
  }
  // NPCs live in settlements: they are created when the player gets close and removed when far away.
  makeDef(s, k) {
    const seed = s.id * 31 + k, tpl = NPC_DEFS[Math.floor(hh(seed, 1) * NPC_DEFS.length)], roles = ROLE_BY_TYPE[s.type], role = roles[Math.floor(hh(seed, 2) * roles.length)];
    const hair = ['SimpleParted', 'Buzzed', 'Long', 'Buns'][Math.floor(hh(seed, 3) * 4)], tints = ['#b3a17f', '#8f8064', '#7f7357', '#a08f70', '#6f7a86', '#8aa090', '#7a5c44', '#5c6b4a'];
    const hats = ['#8a7a4a', '#3b2c1c', '#5a4a34', '#26221e', '#6b6a55'];
    return { ...tpl, name: FIRST[Math.floor(hh(seed, 4) * FIRST.length)] + ' ' + LAST[Math.floor(hh(seed, 5) * LAST.length)], role, settlement: s,
      look: { outfit: 'peasant', hair, beard: hh(seed, 6) < .5, skinTone: .25 + hh(seed, 7) * .6, hairColor: ['#1e1510', '#4a3320', '#7a5230', '#b58a4b', '#8a8a8a'][Math.floor(hh(seed, 8) * 5)], tint: tints[Math.floor(hh(seed, 9) * tints.length)], hat: hh(seed, 10) < .65, hatColor: hats[Math.floor(hh(seed, 11) * hats.length)], rifle: role === 'sheriff' || role === 'cazador', holster: role === 'sheriff' || hh(seed, 12) < .3, scarf: hh(seed, 13) < .4 } };
  }
  sync() {
    const P = this.player.pos;
    for (const s of this.plan.settlements) {
      const d = Math.hypot(s.x - P.x, s.z - P.z), want = [9, 6, 3, 1, 1][s.type], list = this.by.get(s.id);
      if (d < 210 && !list && this.npcs.length + want <= this.max) {
        const made = []; this.by.set(s.id, made); const A = [Math.cos(s.axis), Math.sin(s.axis)];
        for (let k = 0; k < want; k++) {
          for (let t = 0; t < 12; t++) {
            const u = (hh(s.id, k, 40 + t) - .5) * s.r * 1.1, v = (hh(s.id, k, 60 + t) - .5) * 9, x = s.x + A[0] * u - A[1] * v, z = s.z + A[1] * u + A[0] * v; if (!this.validSpot(x, z)) continue;
            const n = new NPC(this, this.makeDef(s, k), x, z); made.push(n); this.npcs.push(n); break;
          }
        }
      } else if (d > 320 && list) { for (const n of list) { this.scene.remove(n.body.root); const i = this.npcs.indexOf(n); if (i >= 0) this.npcs.splice(i, 1); if (this.active === n) this.endTalk(); } this.by.delete(s.id); }
    }
  }"""),
("    const hour = this.sky.hour; let best = null, bd = 3.2;", "    if ((this.scanT -= dt) <= 0) { this.scanT = 1; this.sync(); }\n    const hour = this.sky.hour; let best = null, bd = 3.2;"),
("['Cuéntame un rumor.', () => this.rumorNode(npc)], ['¿Qué hora es?', () => this.timeNode(npc)], ['Adiós.', () => null]] };",
 "['Cuéntame un rumor.', () => this.rumorNode(npc)], ['¿Qué lugar es este?', () => this.placeNode(npc)], ['¿Qué hora es?', () => this.timeNode(npc)], ['Adiós.', () => null]] };"),
("  timeNode(npc) {", """  placeNode(npc) {
    const s = npc.def.settlement, P = npc.pos, others = this.plan.settlements.filter(o => o !== s && o.type <= 2).sort((a, b) => dist(a, P) - dist(b, P)), n = others[0];
    const here = s ? `Esto es ${s.name}, ${['la ciudad más grande de la región', 'un pueblo con su iglesia y su herrero', 'una aldea tranquila', 'un rancho pequeño', 'un campamento de paso'][s.type]}.` : 'Un sitio cualquiera del camino.';
    if (!n) return { text: here, options: this.backOptions(npc) };
    return { text: `${here} ${n.name} queda al ${dirName(n.x - P.x, n.z - P.z)}, a unos ${(dist(n, P) / 1000).toFixed(1)} km por el camino. ¿Te lo marco en el mapa?`,
      options: [['Sí, márcalo.', () => { this.worldMap.wp = { x: n.x, z: n.z }; return { text: 'Hecho. Sigue el camino de tierra y no te perderás.', options: this.backOptions(npc) }; }], ['No hace falta.', () => this.root(npc)]] };
  }
  timeNode(npc) {"""),
])
print('ok')
