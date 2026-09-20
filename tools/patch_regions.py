import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:80], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/map.js', [
    ("  canvas() { const c = document.createElement('canvas');",
     """  // ---- named regions (deterministic, 800 m cells): the name depends on the terrain of the cell
  regionAt(x, z) {
    const S = 800, cx = Math.floor(x / S), cz = Math.floor(z / S), key = cx + ',' + cz; this._reg ??= new Map();
    let r = this._reg.get(key); if (r) return r;
    const hash = (a, b, s) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const mx = (cx + .5) * S, mz = (cz + .5) * S; let hs = 0, water = 0, n = 0;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const h = this.hfHeight ? this.hfHeight(mx + i * 150, mz + j * 150) : 20; hs += h; if (h < 0) water++; n++; }
    const avg = hs / n, pick = (a, s) => a[Math.floor(hash(cx, cz, s) * a.length)];
    const kind = avg > 50 ? ['Sierra', 'Altos', 'Páramo', 'Cumbres'] : water > 1 ? ['Ribera', 'Cañada', 'Remanso', 'Vega'] : avg > 18 ? ['Colinas', 'Bosque', 'Sierra Baja', 'Loma'] : ['Valle', 'Llanura', 'Pradera', 'Campiña'];
    const tail = ['del Cuervo', 'de los Pinos', 'del Lobo', 'Escondido', 'de las Nieblas', 'del Oro', 'del Halcón', 'de la Luna', 'Rojo', 'del Roble', 'del Águila', 'de la Aurora', 'del Viento', 'de las Sombras'];
    r = { name: `${pick(kind, 1)} ${pick(tail, 2)}`, cx, cz, x: mx, z: mz }; this._reg.set(key, r); return r;
  }
  canvas() { const c = document.createElement('canvas');"""),
    # labels on the big map
    ("    if (this.progress < 1) { ctx.fillStyle = 'rgba(0,0,0,.6)';",
     """    ctx.textAlign = 'center'; ctx.font = `italic ${Math.max(12, Math.min(26, 13 * this.view.zoom + 4))}px Georgia, serif`;
    for (let cx = -4; cx < 4; cx++) for (let cz = -4; cz < 4; cz++) {
      const r = this.regionAt((cx + .5) * 800, (cz + .5) * 800), x = ox + r.x * s, z = oz + r.z * s; if (x < -100 || x > W + 100 || z < -20 || z > H + 20) continue;
      const [fx, fz] = this.toPx(r.x, r.z), a = this.fog.getContext('2d').getImageData(Math.max(0, Math.min(this.N - 1, fx | 0)), Math.max(0, Math.min(this.N - 1, fz | 0)), 1, 1).data[3];
      ctx.fillStyle = `rgba(255,243,208,${a < 200 ? .85 : .25})`; ctx.strokeStyle = 'rgba(20,12,4,.8)'; ctx.lineWidth = 3; ctx.strokeText(r.name, x, z); ctx.fillText(r.name, x, z);
    }
    if (this.progress < 1) { ctx.fillStyle = 'rgba(0,0,0,.6)';"""),
])
edit('index.html', [
    ("#prompt{position:fixed;", "#toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);color:#f5ecd6;font:italic 30px Georgia,serif;letter-spacing:3px;text-shadow:0 2px 12px #000,0 0 3px #000;z-index:12;opacity:0;transition:opacity 1.2s;pointer-events:none;text-align:center}#toast.show{opacity:1}#toast small{display:block;font:12px system-ui,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#d9b26a;margin-bottom:6px}\n#prompt{position:fixed;"),
    ('<div id="prompt" class="hidden"></div>', '<div id="toast"></div><div id="prompt" class="hidden"></div>'),
])
edit('src/main.js', [
    ("    npcs?.update(dt); dialogue.tick(dt);",
     """    npcs?.update(dt); dialogue.tick(dt);
    if (started) { const rg = worldMap.regionAt(player.pos.x, player.pos.z); if (rg.name !== lastRegion) { lastRegion = rg.name; const t = $('toast'); t.innerHTML = '<small>Entrando en</small>' + rg.name; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 4200); } }"""),
    ("let fxT = 0, fps = 60,", "let lastRegion = '', fxT = 0, fps = 60,") if False else ("let fxT = 0, fpsAcc = 0,", "let lastRegion = '', fxT = 0, fpsAcc = 0,"),
])
print('ok')
