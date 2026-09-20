import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:80], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

# character.js: skin tone, hair colour, scarf colour, body height
edit('src/character.js', [
    ("  outfit: 'peasant', hood: false, pauldron: false, hair: 'SimpleParted', beard: true, skin: 'Dark', tint: '#b9a78c', hat: true, hatColor: '#3d2f22', holster: true, rifle: true, scarf: true,",
     "  name: 'Forastero', outfit: 'peasant', hood: false, pauldron: false, hair: 'SimpleParted', beard: true, skin: 'Dark', skinTone: .5, hairColor: '#4a3320', tint: '#b9a78c', hat: true, hatColor: '#3d2f22', holster: true, rifle: true, scarf: true, scarfColor: '#8a3b2e', height: 1,"),
    ("    if (c.scarf) attach('neck_01', scarfRig(), [0, .04, .01]);", "    if (c.scarf) attach('neck_01', scarfRig(c.scarfColor), [0, .04, .01]);"),
    ("function scarfRig() {\n  const m = new THREE.Mesh(new THREE.TorusGeometry(.085, .038, 8, 20), new THREE.MeshStandardMaterial({ color: 0x8a3b2e, roughness: .9 }));",
     "function scarfRig(color = '#8a3b2e') {\n  const m = new THREE.Mesh(new THREE.TorusGeometry(.085, .038, 8, 20), new THREE.MeshStandardMaterial({ color, roughness: .9 }));"),
    ("    this.bones = {}; this.baseRoot.traverse(o => { if (o.isBone) this.bones[o.name] = o; });",
     """    this.applyColors();
    this.bones = {}; this.baseRoot.traverse(o => { if (o.isBone) this.bones[o.name] = o; });"""),
    ("  // Keeps only the triangles skinned mostly",
     """  // Skin tone (multiplies the skin textures; >1 lightens) and hair/beard colour.
  applyColors() {
    const c = this.cfg, t = Math.max(0, Math.min(1, c.skinTone ?? .5)), k = .55 + t * .85, skin = new THREE.Color(k * 1.02, k * .93, k * .85);
    for (const p of this.parts) p.traverse(o => {
      if (!o.isMesh || !o.material) return; const n = o.material.name || '';
      if (/Superhero|Regular_Male/i.test(n)) o.material.color.copy(skin);
      else if (/Hair/i.test(n)) o.material.color.set(c.hairColor || '#4a3320');
    });
  }
  // Keeps only the triangles skinned mostly"""),
])
# player: apply body height
edit('src/player.js', [
    ("    if (gltfBody) {                                            // realistic character driven by the same data-driven animation graph",
     "    this.applyLook = () => { if (this.gltf) this.gltf.root.scale.setScalar(CHAR_SCALE * (this.gltf.cfg.height || 1)); };\n    if (gltfBody) {                                            // realistic character driven by the same data-driven animation graph"),
    ("this.rig = { root: gltfBody.root, bones: {} }; scene.add(gltfBody.root); gltfBody.root.scale.setScalar(CHAR_SCALE);",
     "this.rig = { root: gltfBody.root, bones: {} }; scene.add(gltfBody.root); this.applyLook();"),
])
print('ok')
