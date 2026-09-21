// NPCs: villagers built from the same realistic character kit, with wander/idle/greet AI and a dynamic dialogue system that
// answers using real world data (nearest river, terrain, time of day) and can mark places on the map.
import * as THREE from 'three';
import { GltfBody } from './character.js';
import { WATER_LEVEL } from './heightfield.js';
import { typeName } from './settlements.js';
import { routineStep, makeFamily, HOME_LINES } from './routines.js';

const FIRST = ['Elías', 'Gideon', 'Ezra', 'Caleb', 'Isaac', 'Bruno', 'Hugo', 'Ramón', 'Félix', 'Ignacio', 'Ulises', 'Wyatt', 'Clay', 'Abel', 'Otis', 'Lucas', 'Jonás', 'Mario', 'Dante', 'Casio', 'Emilio', 'Reyes', 'Ciro', 'Bartolo'];
const LAST = ['Ortega', 'Salas', 'Reyes', 'Vega', 'Cruz', 'Bravo', 'Luna', 'Rojas', 'Castro', 'Prado', 'Mora', 'Ledesma'];
const hh = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ROLE_BY_TYPE = [['sheriff', 'banquero', 'herrero', 'posadero', 'comerciante', 'granjero', 'cazador', 'viajero', 'buscador de oro'], ['herrero', 'posadero', 'comerciante', 'granjero', 'pastor', 'cazador'], ['granjero', 'pastor', 'pescador', 'cazador'], ['granjero', 'pastor'], ['viajero', 'cazador', 'buscador de oro']];

const DIRS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
const dirName = (dx, dz) => DIRS[Math.round(((Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pick = a => a[Math.floor(Math.random() * a.length)];
const timeWord = h => h < 5 ? 'de madrugada' : h < 8 ? 'al amanecer' : h < 12 ? 'por la mañana' : h < 14.5 ? 'a mediodía' : h < 19 ? 'por la tarde' : h < 21 ? 'al atardecer' : 'de noche';

export const NPC_DEFS = [
  { name: 'Tomás', role: 'granjero', look: { outfit: 'peasant', hair: 'SimpleParted', beard: false, tint: '#b3a17f', hat: true, hatColor: '#8a7a4a', rifle: false, holster: false, scarf: false },
    greet: ['¡Buenos días, forastero!', '¡Eh, hola! ¿Vienes de lejos?'], rumors: ['Dicen que el río se lleva las cosechas de quien vive demasiado cerca. Yo siembro lejos de la orilla.', 'Los cuervos vienen antes de la lluvia; es lo único que sé del tiempo.', 'Mi abuelo enterró algo bajo un pino torcido. Nunca lo encontramos.'], trade: 'Cultivo maíz y algo de trigo. Si tienes hambre, aquí siempre hay un plato.' },
  { name: 'Silas', role: 'cazador', look: { outfit: 'peasant', hair: 'Buzzed', beard: true, tint: '#8f8064', hat: true, hatColor: '#3b2c1c', rifle: true, holster: true, scarf: true },
    greet: ['Silencio... ah, eres tú. Hola.', 'No espantes la caza, forastero.'], rumors: ['Vi huellas de oso cerca de los pinos altos. Grandes como mi mano abierta.', 'Los ciervos beben en el río al amanecer. Quien sabe esperar, come.', 'Hay un claro donde el viento no llega. Ideal para acampar.'], trade: 'Caza y pieles. No vendo mis trampas, pero te cuento dónde no ponerlas.' },
  { name: 'Amos', role: 'buscador de oro', look: { outfit: 'peasant', hair: 'Long', beard: true, tint: '#7f7357', hat: true, hatColor: '#5a4a34', rifle: false, holster: true, scarf: true },
    greet: ['¡Chsss! No lo grites: aquí hay oro en el río.', '¿Traes pala? Ah, no. Lástima.'], rumors: ['El oro se esconde donde el río hace curvas suaves. Yo lo lavo cada mañana.', 'Encontré una pepita como una nuez. La perdí en una partida de cartas.', 'Los ríos de esta tierra cambian de humor con las lluvias.'], trade: 'Oro, oro, oro. Pero hoy solo he sacado barro.' },
  { name: 'Jebediah', role: 'pastor', look: { outfit: 'peasant', hair: 'SimpleParted', beard: true, tint: '#a08f70', hat: false, hatColor: '#333', rifle: false, holster: false, scarf: false },
    greet: ['Que la paz te acompañe, viajero.', 'Mis ovejas y yo te damos la bienvenida.'], rumors: ['Las praderas altas dan la mejor hierba, pero el viento allí arriba corta la piel.', 'Anoche oí aullidos muy lejos. Puede que solo fuera el viento.', 'Quien camina de noche cerca del agua suele volver con historias raras.'], trade: 'Lana y queso. Nada más humilde ni más honrado.' },
  { name: 'Rafael', role: 'viajero', look: { outfit: 'peasant', hair: 'SimpleParted', beard: false, tint: '#6f7a86', hat: true, hatColor: '#26221e', rifle: true, holster: true, scarf: true },
    greet: ['Buen camino. ¿Sabes hacia dónde queda el mar?', 'Otro viajero... este mundo es más grande de lo que parece.'], rumors: ['Llevo semanas caminando y aún no veo el final de estas montañas.', 'Dicen que al oeste todo son ríos y lagos. Iré cuando descanse.', 'Anoche vi estrellas fugaces. Pedí un mapa mejor.'], trade: 'No vendo nada, solo pregunto. ¿Y tú?' },
  { name: 'Mateo', role: 'pescador', look: { outfit: 'peasant', hair: 'Buns', beard: false, tint: '#8aa090', hat: true, hatColor: '#6b6a55', rifle: false, holster: false, scarf: true },
    greet: ['Shhh... están picando. Hola en voz baja.', '¡Buenas! Hoy el río está de mi lado.'], rumors: ['La trucha sube por las aguas frías del norte. Sé exactamente dónde.', 'Nunca nades con la corriente fuerte; te lleva más lejos de lo que crees.', 'Hay un remanso tranquilo donde el agua se ve como un espejo.'], trade: 'Pesco lo justo. Si quieres un buen sitio, puedo marcártelo.' },
];

// Lines are written per trade so what an NPC says always fits who they are. {town} is replaced by the settlement name.
const LINES = {
  sheriff: { greet: ['Buenas. Aquí en {town} la ley soy yo.', 'Mantén las manos a la vista y serás bienvenido.', 'Si buscas problemas, este no es el sitio.'], trade: 'Vigilo {town} y los caminos de los alrededores. Últimamente hay demasiados bandidos.',
    rumors: ['Hay bandidos acampando fuera de los pueblos. No me alcanzan los ayudantes.', 'Encontré huellas de caballos sin herrar junto al camino. No son de por aquí.', 'Quien robe en {town} acaba en el calabozo, sea quien sea.'] },
  banquero: { greet: ['Bienvenido a {town}. ¿Viene a depositar o a pedir prestado?', 'Un cliente. Qué agradable.'], trade: 'Guardo el dinero de {town}. Y hago preguntas sobre el que lo pide.', rumors: ['Los bandidos vigilan las diligencias que salen cargadas. Alguien les da los horarios.', 'El oro del río ya no llega como antes.', 'Dicen que hay un tesoro escondido en una ruina al pie de las montañas.'] },
  herrero: { greet: ['Ojo con las chispas, forastero.', 'Si necesitas un buen acero, has llegado al sitio.'], trade: 'Hierro, herraduras y filo. Todo el pueblo pasa por mi yunque.', rumors: ['Me piden más espadas que arados. Mala señal.', 'El buen acero se templa despacio. Como la paciencia.', 'Un viajero me pagó con una moneda que no conocía. Tenía un águila grabada.'] },
  posadero: { greet: ['Pasa, pasa. Hay sopa caliente y cama limpia.', 'Bienvenido a la posada de {town}.'], trade: 'Sirvo comida y doy techo. Y oigo mucho más de lo que digo.', rumors: ['Un forastero pagó tres noches por adelantado y no ha salido de su cuarto.', 'Los arrieros cuentan que hay campamentos nuevos al norte del camino.', 'Aquí se juega a las cartas, pero yo no apuesto.'] },
  comerciante: { greet: ['¡Buenos días! Tengo de todo un poco.', 'Mira, mira. Precios justos en {town}.'], trade: 'Compro y vendo lo que trae el camino.', rumors: ['Las caravanas ya no se atreven a cruzar de noche.', 'Los precios suben cuando los caminos se vuelven peligrosos.', 'Oí que un cazador pagó bien por una piel de lobo blanco.'] },
  granjero: { greet: ['Buenas. Perdone la tierra en las botas.', 'Hola. Ando con la cosecha, disculpe si no me detengo.'], trade: 'Cultivo y crío animales cerca de {town}. Lo que sobra va al mercado.', rumors: ['Los lobos rondan más cerca de los corrales este año.', 'El río se llevó parte del maizal la última crecida.', 'Los bandidos se llevaron dos vacas. Nadie hizo nada.'] },
  pastor: { greet: ['Paz, viajero. Mis ovejas no muerden.', 'Buen día. Cuidado con los perros, son celosos.'], trade: 'Cuido el rebaño y vendo lana y queso en {town}.', rumors: ['Anoche oí aullidos en la sierra. Cerré el corral.', 'Las mejores praderas están cerca de los ríos.', 'Vi humo de una hoguera en la loma. Nadie de aquí acampa allí.'] },
  cazador: { greet: ['Silencio. Vas a espantar la caza.', 'No hagas ruido, hay ciervos cerca.'], trade: 'Cazo y vendo pieles en {town}. Los bosques me conocen.', rumors: ['Vi un oso enorme cerca de los pinos altos. Ni me acerqué.', 'Los lobos vigilan desde la sierra y bajan de noche.', 'Quien entra en el bosque de noche sin fuego no suele contarlo.'] },
  pescador: { greet: ['Chsss. Están picando.', 'Buen día. El agua está buena hoy.'], trade: 'Pesco en los ríos cerca de {town}. Lo justo.', rumors: ['La trucha sube por el agua fría. Sé dónde.', 'Nunca cruces el río con la corriente fuerte.', 'Una noche vi luces en el lago. No eran pescadores.'] },
  viajero: { greet: ['Buen camino. ¿Sabes cuánto falta para el siguiente pueblo?', 'Otro caminante. Qué raro es hoy cruzarse con alguien.'], trade: 'Voy de pueblo en pueblo. Llevo noticias y recojo otras.', rumors: ['Los caminos de tierra son los seguros; los atajos, no.', 'En {town} me dieron buen trato. Es más de lo que puedo decir de otros sitios.', 'Se dice que hay bandidos que asaltan al caer la noche.'] },
  'buscador de oro': { greet: ['Chsss, no lo grites: aquí hay oro en el río.', '¿Traes pala? Ah, no.'], trade: 'Lavo grava en el río cerca de {town}. Hoy solo he sacado barro.', rumors: ['El oro se esconde donde el río hace curvas suaves.', 'Encontré una pepita como una nuez. La perdí jugando a las cartas.', 'Hay una mina abandonada al pie de las montañas. Nadie vuelve de allí.'] },
};

// Named characters of the story (fixed places, see story.js).
const STORY_DEFS = {
  vargas: { name: 'Ramón Vargas', role: 'sheriff', storyKey: 'vargas', fixed: true, look: { outfit: 'peasant', hair: 'SimpleParted', beard: true, hairColor: '#8a8a8a', skinTone: .45, tint: '#6f7a86', hat: true, hatColor: '#3d2f22', rifle: true, holster: true, scarf: false }, greet: ['Forastero. Acércate, tengo que hablar contigo.'], rumors: [], trade: 'Soy la ley en esta ciudad.' },
  bruno: { name: 'Bruno Salas', role: 'posadero', storyKey: 'bruno', fixed: true, look: { outfit: 'peasant', hair: 'Buzzed', beard: false, skinTone: .55, tint: '#a08f70', hat: false, rifle: false, holster: false, scarf: false }, greet: ['Pasa, pasa. Hay sopa caliente.'], rumors: [], trade: 'Llevo la posada.' },
  amos: { name: 'Amos Reed', role: 'buscador de oro', storyKey: 'amos', fixed: true, look: { outfit: 'peasant', hair: 'Long', beard: true, hairColor: '#4a3320', skinTone: .35, tint: '#7f7357', hat: true, hatColor: '#5a4a34', rifle: false, holster: true, scarf: true }, greet: ['¿Quién anda ahí? ...Ah. Ven, acércate.'], rumors: [], trade: 'Lavo grava en el río.' },
};

export class NPCManager {
  constructor({ scene, terrain, player, assets, sky, worldMap, ui, camera }) {
    Object.assign(this, { scene, terrain, player, assets, sky, worldMap, ui, camera }); this.npcs = []; this.active = null; this.nearest = null;
    this.plan = terrain.hf.plan(); this.by = new Map(); this.scanT = 0; this.max = 34; this.serial = 0; this.fams = new Map();
  }
  // NPCs live in settlements: they are created when the player gets close and removed when far away.
  makeDef(s, k) {
    const seed = s.id * 31 + k, tpl = NPC_DEFS[Math.floor(hh(seed, 1) * NPC_DEFS.length)], roles = ROLE_BY_TYPE[s.type], role = roles[Math.floor(hh(seed, 2) * roles.length)];
    const hair = ['SimpleParted', 'Buzzed', 'Long', 'Buns'][Math.floor(hh(seed, 3) * 4)], tints = ['#b3a17f', '#8f8064', '#7f7357', '#a08f70', '#6f7a86', '#8aa090', '#7a5c44', '#5c6b4a'];
    const hats = ['#8a7a4a', '#3b2c1c', '#5a4a34', '#26221e', '#6b6a55'];
    const L = LINES[role] || LINES.viajero, fill = t => t.replace(/\{town\}/g, s.name);
    return { ...tpl, greet: L.greet.map(fill), rumors: L.rumors.map(fill), trade: fill(L.trade), name: FIRST[Math.floor(hh(seed, 4) * FIRST.length)] + ' ' + LAST[Math.floor(hh(seed, 5) * LAST.length)], role, settlement: s,
      look: { outfit: 'peasant', hair, beard: hh(seed, 6) < .5, skinTone: .25 + hh(seed, 7) * .6, hairColor: ['#1e1510', '#4a3320', '#7a5230', '#b58a4b', '#8a8a8a'][Math.floor(hh(seed, 8) * 5)], tint: tints[Math.floor(hh(seed, 9) * tints.length)], hat: hh(seed, 10) < .65, hatColor: hats[Math.floor(hh(seed, 11) * hats.length)], rifle: role === 'sheriff' || role === 'cazador', holster: role === 'sheriff' || hh(seed, 12) < .3, scarf: hh(seed, 13) < .4 } };
  }
  syncStory() {
    if (!this.story) return; const P = this.player.pos; this.storyNpcs ??= {};
    for (const [k, def] of Object.entries(STORY_DEFS)) {
      const p = this.story.pos[k], d = Math.hypot(p.x - P.x, p.z - P.z), have = this.storyNpcs[k];
      if (d < 200 && !have) { const n = new NPC(this, { ...def, settlement: this.plan.settlements[0] }, p.x, p.z); this.storyNpcs[k] = n; this.npcs.push(n); }
      else if (d > 320 && have) { this.scene.remove(have.body.root); const i = this.npcs.indexOf(have); if (i >= 0) this.npcs.splice(i, 1); if (this.active === have) this.endTalk(); delete this.storyNpcs[k]; }
    }
  }
  rolesFor(s) { return ROLE_BY_TYPE[Math.min(s.type, ROLE_BY_TYPE.length - 1)]; }
  // Households: families that live in the townhouses near the player.
  syncFamilies() {
    const P = this.player.pos;
    for (const s of this.plan.settlements) {
      if (s.type > 2 || Math.hypot(s.x - P.x, s.z - P.z) > 300) continue;
      const homes = s.items.filter(o => o.t === 'home' && o.hp?.size === 'town').map(o => ({ o, d: Math.hypot(o.x - P.x, o.z - P.z) })).sort((a, b) => a.d - b.d);
      for (const { o, d } of homes) {
        const key = Math.round(o.x) + ',' + Math.round(o.z), have = this.fams.get(key);
        if (have && d > 170) { for (const n of have) { this.scene.remove(n.body.root); const i = this.npcs.indexOf(n); if (i >= 0) this.npcs.splice(i, 1); if (this.active === n) this.endTalk(); } this.fams.delete(key); }
        else if (!have && d < 95) {
          const fam = makeFamily(this, s, o, 0); if (this.npcs.length + fam.length > this.max) break;
          const made = []; this.fams.set(key, made);
          for (const f of fam) { const n = new NPC(this, this.familyDef(s, f), o.x, o.z); made.push(n); this.npcs.push(n); const d0 = ['sleep', 'kitchen', 'eat', 'living'].includes(require0(n, this.sky.hour)) ? 'in' : 'out'; n.where = d0; if (d0 === 'out') { const a = f.sched.work; n.pos.set(a.x, this.terrain.height(a.x, a.z), a.z); } }
        }
      }
    }
  }
  familyDef(s, f) {
    const { mem, sSeed, first, surname } = f, r = k => hh(sSeed, k), fem = mem.sex === 'f', child = mem.kind === 'child';
    const L = HOME_LINES[mem.role] || LINES[mem.role] || LINES.viajero, fill = t => t.replace(/\{town\}/g, s.name);
    const tints = ['#b3a17f', '#8f8064', '#a08f70', '#6f7a86', '#8aa090', '#7a5c44', '#5c6b4a', '#9a6a58'], skirts = ['#7a3b3b', '#3b5a7a', '#6b5a3a', '#4a6b4a', '#7a6a3b', '#5a3b6b'];
    const hairs = fem ? ['Long', 'Buns', 'BuzzedFemale', 'SimpleParted'] : ['SimpleParted', 'Buzzed', 'Long', 'Buns'], hairColors = ['#1e1510', '#4a3320', '#7a5230', '#b58a4b', '#8a8a8a'];
    return { name: first + ' ' + surname, role: mem.role, settlement: s, greet: L.greet.map(fill), rumors: L.rumors.map(fill), trade: fill(L.trade), sched: f.sched, scale: child ? .62 + r(2) * .12 : fem ? .92 + r(2) * .05 : .95 + r(2) * .07,
      look: { outfit: 'peasant', sex: fem ? 'f' : 'm', child, skirt: false, skirtColor: skirts[Math.floor(r(3) * skirts.length)], hair: hairs[Math.floor(r(4) * hairs.length)], beard: !fem && !child && r(5) < .45, skinTone: .25 + r(6) * .6, hairColor: hairColors[Math.floor(r(7) * 5)], tint: tints[Math.floor(r(8) * tints.length)], hat: !fem && !child && r(9) < .6, hatColor: ['#8a7a4a', '#3b2c1c', '#5a4a34', '#26221e'][Math.floor(r(10) * 4)], rifle: false, holster: false, scarf: !child && r(11) < .3 } };
  }
  sync() {
    this.syncStory(); this.syncFamilies(); const P = this.player.pos;
    for (const s of this.plan.settlements) {
      const d = Math.hypot(s.x - P.x, s.z - P.z), want = [3, 2, 1, 1, 1][s.type], list = this.by.get(s.id);
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
  }
  validSpot(x, z) {
    const h = this.terrain.height(x, z); if (!(h > 2.5 && h < 40 && this.terrain.slopeAt(x, z) < .22 && this.terrain.riverAt(x, z).t < .05)) return false;
    const t = { x, z }; this.terrain.pushOut(t, .6); return Math.hypot(t.x - x, t.z - z) < .05;          // not inside a building, tree or rock
  }
  spawn() {
    const c = this.player.pos; let i = 0, tries = 0;
    while (this.npcs.length < NPC_DEFS.length && tries++ < 400) {
      const a = Math.random() * 6.283, r = 25 + Math.random() * 110, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (!this.validSpot(x, z) || this.npcs.some(n => Math.hypot(n.home.x - x, n.home.z - z) < 30)) continue;
      this.npcs.push(new NPC(this, NPC_DEFS[i++], x, z));
    }
  }
  // ---- world queries used by the dialogue
  nearestWater(x, z) {
    let best = null;
    for (let r = 12; r <= 420 && !best; r += 12) for (let a = 0; a < 6.283; a += Math.max(.15, 12 / r)) {
      const wx = x + Math.cos(a) * r, wz = z + Math.sin(a) * r; if (this.terrain.height(wx, wz) < WATER_LEVEL - .3) { best = { x: wx, z: wz, d: r }; break; }
    }
    return best;
  }
  nearestMountain(x, z) {
    let best = null, bh = 0;
    for (let r = 100; r <= 700; r += 60) for (let a = 0; a < 6.283; a += .3) { const wx = x + Math.cos(a) * r, wz = z + Math.sin(a) * r, h = this.terrain.height(wx, wz); if (h > 60 && h > bh) { bh = h; best = { x: wx, z: wz, d: r, h }; } }
    return best;
  }
  update(dt) {
    if ((this.scanT -= dt) <= 0) { this.scanT = 1; this.sync(); }
    const hour = this.sky.hour; let best = null, bd = 3.2;
    for (const n of this.npcs) { n.update(dt, hour); const d = dist(n.pos, this.player.pos); if (d < bd && !this.active && !n.hidden && !n.asleep) { best = n; bd = d; } }
    this.nearest = best; this.ui.setPrompt(best && !this.active ? `E — Hablar con ${best.def.name} (${best.def.role})` : null);
    this.ui.updateBubbles(this.npcs, this.camera);
    this.worldMap.markers = this.npcs.filter(n => !n.hidden && !n.def.sched).map(n => ({ x: n.pos.x, z: n.pos.z, label: n.def.name, color: '#ffd166' }));
  }
  interact() { if (this.nearest && !this.active) this.startTalk(this.nearest); }
  startTalk(npc) { this.active = npc; npc.state = 'talk'; npc.met++; this.ui.openDialogue(npc, this); }
  endTalk() { if (this.active) { this.active.state = 'idle'; this.active.timer = 3 + Math.random() * 3; } this.active = null; }

  // ---- dialogue tree (built on demand so answers use live world data)
  root(npc) {
    if (npc.def.storyKey && this.story) { const n = this.story.dialogue(npc); if (n !== undefined && (n || npc.def.storyKey === 'amos')) return n; }
    const d = npc.def, hello = npc.met <= 1 ? pick(d.greet) : `Otra vez tú. ${pick(['¿Necesitas algo?', '¿Qué se te ofrece?', 'Dime.'])}`;
    return { text: hello, options: [['¿Qué hay por aquí?', () => this.aroundNode(npc)], ['¿Dónde hay agua?', () => this.waterNode(npc)], [`¿Qué haces por aquí, ${d.role}?`, () => ({ text: d.trade, options: this.backOptions(npc) })],
      ['Cuéntame un rumor.', () => this.rumorNode(npc)], ['¿Qué lugar es este?', () => this.placeNode(npc)], ['¿Qué hora es?', () => this.timeNode(npc)], ['Adiós.', () => null]] };
  }
  backOptions(npc) { return [['Tengo otra pregunta.', () => this.root(npc)], ['Adiós.', () => null]]; }
  aroundNode(npc) {
    const p = npc.pos, h = this.terrain.height(p.x, p.z), w = this.nearestWater(p.x, p.z), m = this.nearestMountain(p.x, p.z), parts = [];
    parts.push(h > 45 ? 'Estamos muy arriba, en terreno alto y ventoso.' : h > 15 ? 'Estamos en una zona de colinas suaves.' : 'Estamos en tierras bajas, buenas para caminar.');
    if (w) parts.push(`El agua más cercana está al ${dirName(w.x - p.x, w.z - p.z)}, a unos ${Math.round(w.d)} metros.`);
    if (m) parts.push(`Hacia el ${dirName(m.x - p.x, m.z - p.z)} se levantan montañas de más de ${Math.round(m.h)} metros.`);
    return { text: parts.join(' '), options: this.backOptions(npc) };
  }
  waterNode(npc) {
    const p = npc.pos, w = this.nearestWater(p.x, p.z);
    if (!w) return { text: 'Aquí cerca no hay agua que valga la pena. Tendrías que caminar mucho.', options: this.backOptions(npc) };
    return { text: `Hay agua al ${dirName(w.x - p.x, w.z - p.z)}, a unos ${Math.round(w.d)} metros. ${npc.def.role === 'pescador' ? 'Ahí es donde pesco yo.' : 'Cuidado con la corriente.'} ¿Quieres que te lo marque en el mapa?`,
      options: [['Sí, márcalo.', () => { this.worldMap.wp = { x: w.x, z: w.z }; return { text: 'Hecho. Míralo en el mapa (M).', options: this.backOptions(npc) }; }], ['No hace falta.', () => this.root(npc)]] };
  }
  rumorNode(npc) {
    npc.rumorsHeard = (npc.rumorsHeard || 0) + 1;
    if (npc.rumorsHeard > 4) return { text: 'Ya te he contado todo lo que sé. Déjame trabajar.', options: [['Perdona.', () => this.root(npc)], ['Adiós.', () => null]] };
    return { text: pick(npc.def.rumors), options: [['Otro rumor.', () => this.rumorNode(npc)], ...this.backOptions(npc)] };
  }
  placeNode(npc) {
    const s = npc.def.settlement, P = npc.pos, others = this.plan.settlements.filter(o => o !== s && o.type <= 2).sort((a, b) => dist(a, P) - dist(b, P)), n = others[0];
    const here = s ? `Esto es ${s.name}, ${['la ciudad más grande de la región', 'un pueblo con su iglesia y su herrero', 'una aldea tranquila', 'un rancho pequeño', 'un campamento de paso'][s.type]}.` : 'Un sitio cualquiera del camino.';
    if (!n) return { text: here, options: this.backOptions(npc) };
    return { text: `${here} ${n.name} queda al ${dirName(n.x - P.x, n.z - P.z)}, a unos ${(dist(n, P) / 1000).toFixed(1)} km por el camino. ¿Te lo marco en el mapa?`,
      options: [['Sí, márcalo.', () => { this.worldMap.wp = { x: n.x, z: n.z }; return { text: 'Hecho. Sigue el camino de tierra y no te perderás.', options: this.backOptions(npc) }; }], ['No hace falta.', () => this.root(npc)]] };
  }
  timeNode(npc) {
    const h = this.sky.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return { text: `Serán las ${hh}:${String(mm).padStart(2, '0')}, ${timeWord(h)}.${h > 20 || h < 5 ? ' Deberías buscar dónde pasar la noche.' : ''}`, options: this.backOptions(npc) };
  }
}

class NPC {
  constructor(mgr, def, x, z) {
    this.mgr = mgr; this.def = def; this.home = { x, z }; this.pos = new THREE.Vector3(x, mgr.terrain.height(x, z), z); this.yaw = Math.random() * 6.283; this.met = 0; this.greeted = false;
    this.body = new GltfBody(mgr.assets, def.look); this.body.root.scale.setScalar(def.scale || (.9 + Math.random() * .08)); this.sched = def.sched || null; this.where = 'out'; this.hidden = false; this.body.setDrawn(false); if (this.body.sword) this.body.sword.visible = false; mgr.scene.add(this.body.root);
    this.state = 'idle'; this.timer = 1 + Math.random() * 4; this.target = null; this.speed = 0; this.bubble = null; this.bubbleT = 0; this.headPos = new THREE.Vector3();
  }
  say(text, secs = 3.5) { this.bubble = text; this.bubbleT = secs; }
  update(dt, hour) {
    const m = this.mgr, P = m.player.pos, d = dist(this.pos, P), night = hour > 21.5 || hour < 5;
    this.body.root.visible = !this.hidden && d < 260; if (d >= 260) return;
    this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null;
    // reactions
    if (this.state !== 'talk' && !this.hidden && !this.asleep) {
      if (d < 8 && !this.greeted && !night) { this.greeted = true; this.say(this.def.greet[Math.floor(Math.random() * this.def.greet.length)]); this.face = 2.5; }
      if (d > 25) this.greeted = false;
      if (d < 3 && m.player.speed > 4.5 && !this.startled) { this.startled = true; this.say(['¡Cuidado!', '¡Eh, mira por dónde vas!', '¡Vaya prisa!'][Math.floor(Math.random() * 3)], 2.5); }
      if (d > 8 || m.player.speed < 3) this.startled = d < 3 ? this.startled : false;
    }
    let anim = 'Idle_Loop', rate = 1, want = 0;
    if (this.state === 'talk') { this.turnTo(P.x - this.pos.x, P.z - this.pos.z, dt, 8); anim = 'Idle_Talking_Loop'; }
    else {
      this.timer -= dt; this.face = (this.face || 0) - dt;
      if (this.face > 0 && d < 10) this.turnTo(P.x - this.pos.x, P.z - this.pos.z, dt, 5);
      if (this.sched) { const r = routineStep(this, dt, hour, d); anim = r.anim; rate = r.rate || 1; this.body.root.visible = !this.hidden && d < 260; }
      else if (this.state === 'idle') {
        if (this.timer <= 0) {
          if (night) { this.state = 'idle'; this.timer = 8; }          // asleep-ish at night: stays home
          else { const a = Math.random() * 6.283, r = this.def.fixed ? 1 + Math.random() * 2.5 : 6 + Math.random() * 22, tx = this.home.x + Math.cos(a) * r, tz = this.home.z + Math.sin(a) * r; if (m.validSpot(tx, tz)) { this.target = { x: tx, z: tz }; this.state = 'walk'; } else this.timer = 1; }
        }
      } else if (this.state === 'walk' && this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, L = Math.hypot(dx, dz);
        this.walkT = (this.walkT || 0) + dt; if (this.walkT > 18) { this.state = 'idle'; this.timer = 1; this.target = null; this.walkT = 0; }         // gave up: pick another destination
        if (L < .8) { this.state = 'idle'; this.timer = 3 + Math.random() * 7; this.target = null; this.walkT = 0; }
        else { this.turnTo(dx, dz, dt, 6); want = 1.25; anim = 'Walk_Loop'; rate = 1.25 / .98;
          const nx = this.pos.x + Math.sin(this.yaw) * want * dt, nz = this.pos.z + Math.cos(this.yaw) * want * dt;
          if (m.terrain.height(nx, nz) < .3 || m.terrain.slopeAt(nx, nz) > .45) { this.state = 'idle'; this.timer = 1.5; this.target = null; }
          else { const ox = this.pos.x, oz = this.pos.z; this.pos.x = nx; this.pos.z = nz; m.terrain.pushOut(this.pos, .45); if (Math.hypot(this.pos.x - ox, this.pos.z - oz) < want * dt * .3) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 1.2) { this.state = 'idle'; this.timer = .5; this.target = null; this.stuck = 0; } } else this.stuck = 0; } }
      }
    }
    if (!this.sched) this.pos.y = m.terrain.height(this.pos.x, this.pos.z); else if (this.where !== 'in') this.pos.y = m.terrain.walkY(this.pos.x, this.pos.z, this.pos.y);
    if (anim) this.body.play(anim, .3, rate); if (d < 120 || (m.frame = (m.frame || 0) + 1) % 3 === 0) this.body.update(dt * (d < 120 ? 1 : 3));
    const r = this.body.root; r.position.copy(this.pos); r.rotation.y = this.yaw;
    this.headPos.set(this.pos.x, this.pos.y + 2.05, this.pos.z);
  }
  turnTo(dx, dz, dt, speed) { const t = Math.atan2(dx, dz); let a = t - this.yaw; a = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; this.yaw += a * Math.min(1, dt * speed); }
}

import { desire as require0f } from './routines.js';
function require0(n, h) { return require0f(n, h).k; }
