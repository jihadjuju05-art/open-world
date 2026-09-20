import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)
edit('src/map.js', [
("constructor({ seed, R = 3000, mpp = 12 }) {", "constructor({ seed, R = 4200, mpp = 12 }) {"),
("localStorage.getItem('openworld.fog.' + seed)", "localStorage.getItem('openworld.fog.' + seed + '.' + R)"),
("localStorage.setItem('openworld.fog.' + this.seed,", "localStorage.setItem('openworld.fog.' + this.seed + '.' + this.R,"),
("  canvas() {", """  // Roads (Path2D in map-pixel space, drawn between the terrain and the fog) and settlement icons.
  setPlan(plan) {
    this.places = plan.settlements; this.roadPaths = [[], [], []];
    for (const r of plan.roads) { const p = new Path2D(); r.pts.forEach(([x, z], i) => { const [px, pz] = this.toPx(x, z); i ? p.lineTo(px, pz) : p.moveTo(px, pz); }); this.roadPaths[r.kind].push(p); }
  }
  drawRoads(ctx, scalePx) {
    if (!this.roadPaths) return; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [kind, w, col] of [[2, 1.6, '#8a7048'], [1, 2.2, '#b08f58'], [0, 3, '#c8a468']]) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(w, 2.2 / scalePx); for (const p of this.roadPaths[kind]) ctx.stroke(p); }
  }
  discovered(x, z) { const [fx, fz] = this.toPx(x, z); return this.fog.getContext('2d').getImageData(Math.max(0, Math.min(this.N - 1, fx | 0)), Math.max(0, Math.min(this.N - 1, fz | 0)), 1, 1).data[3] < 200; }
  canvas() {"""),
("      ctx.drawImage(this.map, 0, 0); ctx.drawImage(this.fog, 0, 0);\n      for (const m of this.markers || [])",
 "      ctx.drawImage(this.map, 0, 0); this.drawRoads(ctx, k); ctx.drawImage(this.fog, 0, 0);\n      for (const p of this.places || []) if (p.type <= 3 && this.known(p)) { const [qx, qz] = this.toPx(p.x, p.z); ctx.fillStyle = p.type === 0 ? '#ffd76a' : '#f1e6cc'; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1 / k; ctx.beginPath(); ctx.arc(qx, qz, (p.type === 0 ? 5 : p.type === 1 ? 4 : 3) / k, 0, 7); ctx.fill(); ctx.stroke(); }\n      for (const m of this.markers || [])"),
("ctx.scale(k, k); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.map, 0, 0); ctx.drawImage(this.fog, 0, 0); ctx.restore();",
 "ctx.scale(k, k); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.map, 0, 0); this.drawRoads(ctx, k); ctx.drawImage(this.fog, 0, 0); ctx.restore();"),
("    for (let cx = -4; cx < 4; cx++) for (let cz = -4; cz < 4; cz++) {", "    const RG = Math.ceil(this.R / 800);\n    for (let cx = -RG; cx < RG; cx++) for (let cz = -RG; cz < RG; cz++) {"),
("    if (this.progress < 1) { ctx.fillStyle = 'rgba(0,0,0,.6)'",
"""    for (const p of this.places || []) {                                                       // settlements: city / towns always known, the rest once discovered
      if (!this.known(p)) continue; const x = ox + p.x * s, z = oz + p.z * s; if (x < -40 || x > W + 40 || z < -40 || z > H + 40) continue;
      const z0 = this.view.zoom, r = [9, 7, 5.5, 4, 4][p.type]; ctx.fillStyle = p.type === 0 ? '#ffd76a' : '#f4e9cf'; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2; ctx.beginPath();
      if (p.type === 0) { for (let i = 0; i < 10; i++) { const a = -1.57 + i * .628, rr = i % 2 ? r * .5 : r; ctx.lineTo(x + Math.cos(a) * rr, z + Math.sin(a) * rr); } ctx.closePath(); } else if (p.type === 1) ctx.rect(x - r, z - r, r * 2, r * 2); else if (p.type === 4) { ctx.moveTo(x, z - r); ctx.lineTo(x + r, z + r); ctx.lineTo(x - r, z + r); ctx.closePath(); } else ctx.arc(x, z, r, 0, 7);
      ctx.fill(); ctx.stroke();
      if (p.type <= 1 || (p.type === 2 && z0 > 1.1) || (p.type >= 3 && z0 > 2.4)) { ctx.font = `${p.type <= 1 ? 'bold ' : ''}${p.type === 0 ? 15 : p.type === 1 ? 13 : 11}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff3d0'; ctx.strokeStyle = 'rgba(20,12,4,.9)'; ctx.lineWidth = 3; ctx.strokeText(p.name, x, z - r - 5); ctx.fillText(p.name, x, z - r - 5); }
    }
    if (this.progress < 1) { ctx.fillStyle = 'rgba(0,0,0,.6)'"""),
("  discovered(x, z) {", "  known(p) { if (p.type <= 1) return true; if (p._k === undefined || performance.now() - (p._kt || 0) > 2000) { p._k = this.discovered(p.x, p.z); p._kt = performance.now(); } return p._k; }\n  discovered(x, z) {"),
])
edit('src/main.js', [
("const worldMap = new WorldMap({ seed: terrain.seed, R: 3000, mpp: 12 }); worldMap.hfHeight = (x, z) => terrain.height(x, z);",
 "const worldMap = new WorldMap({ seed: terrain.seed, R: 4200, mpp: 12 }); worldMap.hfHeight = (x, z) => terrain.height(x, z); worldMap.setPlan(terrain.hf.plan());"),
])
print('ok')
