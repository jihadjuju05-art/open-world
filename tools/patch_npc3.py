import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/settings.js', [
("adaptive: true, fpsCap: 241,", "adaptive: false, fpsCap: 241,"),
("const KEY = 'openworld.settings.v1';", "const KEY = 'openworld.settings.v2';"),
])

edit('src/npc.js', [
# role based dialogue pools
("export class NPCManager {", """// Lines are written per trade so what an NPC says always fits who they are. {town} is replaced by the settlement name.
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

export class NPCManager {"""),
("    return { ...tpl, name: FIRST[Math.floor(hh(seed, 4) * FIRST.length)] + ' ' + LAST[Math.floor(hh(seed, 5) * LAST.length)], role, settlement: s,",
 "    const L = LINES[role] || LINES.viajero, fill = t => t.replace(/\\{town\\}/g, s.name);\n    return { ...tpl, greet: L.greet.map(fill), rumors: L.rumors.map(fill), trade: fill(L.trade), name: FIRST[Math.floor(hh(seed, 4) * FIRST.length)] + ' ' + LAST[Math.floor(hh(seed, 5) * LAST.length)], role, settlement: s,"),
# free spot: not inside a building
("  validSpot(x, z) { const h = this.terrain.height(x, z); return h > 2.5 && h < 40 && this.terrain.slopeAt(x, z) < .22 && this.terrain.riverAt(x, z).t < .05; }",
 "  validSpot(x, z) {\n    const h = this.terrain.height(x, z); if (!(h > 2.5 && h < 40 && this.terrain.slopeAt(x, z) < .22 && this.terrain.riverAt(x, z).t < .05)) return false;\n    const t = { x, z }; this.terrain.pushOut(t, .6); return Math.hypot(t.x - x, t.z - z) < .05;          // not inside a building, tree or rock\n  }"),
# stuck detection while walking
("        if (L < .8) { this.state = 'idle'; this.timer = 3 + Math.random() * 7; this.target = null; }",
 "        this.walkT = (this.walkT || 0) + dt; if (this.walkT > 18) { this.state = 'idle'; this.timer = 1; this.target = null; this.walkT = 0; }         // gave up: pick another destination\n        if (L < .8) { this.state = 'idle'; this.timer = 3 + Math.random() * 7; this.target = null; this.walkT = 0; }"),
("          else { this.pos.x = nx; this.pos.z = nz; m.terrain.pushOut(this.pos, .35); } }",
 "          else { const ox = this.pos.x, oz = this.pos.z; this.pos.x = nx; this.pos.z = nz; m.terrain.pushOut(this.pos, .45); if (Math.hypot(this.pos.x - ox, this.pos.z - oz) < want * dt * .3) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 1.2) { this.state = 'idle'; this.timer = .5; this.target = null; this.stuck = 0; } } else this.stuck = 0; } }"),
])
print('ok')
