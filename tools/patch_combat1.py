import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/character.js', [
("  const [base, anims, ranger, peasant, hairSP, hairB, hairL, hairU, beard, brows] = await Promise.all([\n    load(D + 'Superhero_Male_FullBody.gltf'), load(D + 'anims/UAL1_Standard.glb'),",
 "  const [base, anims, ranger, peasant, hairSP, hairB, hairL, hairU, beard, brows, anims2] = await Promise.all([\n    load(D + 'Superhero_Male_FullBody.gltf'), load(D + 'anims/UAL1_Standard.glb'),"),
("load(D + 'hair/Eyebrows_Regular.gltf'),\n  ]);",
 "load(D + 'hair/Eyebrows_Regular.gltf'), load(D + 'anims/UAL2_Standard.glb').catch(() => ({ animations: [] }))\n  ]);"),
("  return { base, clips: anims.animations, ranger,", "  const have = new Set(anims.animations.map(c => c.name));\n  return { base, clips: [...anims.animations, ...anims2.animations.filter(c => !have.has(c.name))], ranger,"),
# sword mesh
("// ---- procedural western accessories (attached to bones) ----",
 """// ---- one-handed sword: blade along local +Y, grip at the origin. userData.base / tip are the hitbox segment ends (local space) ----
export function swordMesh() {
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: .28, metalness: .9 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: .8 }), brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: .4, metalness: .8 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.05, .86, .012), steel); blade.position.y = .55; g.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.0355, .07, 4), steel); tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, .25); tip.position.y = 1.02; g.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.2, .025, .04), brass); guard.position.y = .115; g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .18, 8), dark); grip.position.y = .02; g.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(.028, 8, 6), brass); pommel.position.y = -.075; g.add(pommel);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.userData.base = new THREE.Vector3(0, .13, 0); g.userData.tip = new THREE.Vector3(0, 1.05, 0);
  return g;
}

// ---- procedural western accessories (attached to bones) ----"""),
# sword attach in build
("    if (c.rifle) attach('spine_03', rifleRig(), [-.04, -.02, -.17], [0, 0, .95], .78);\n    this.play(this.cfg.states.idle, 0);",
 "    if (c.rifle) attach('spine_03', rifleRig(), [-.04, -.02, -.17], [0, 0, .95], .78);\n    this.sword = swordMesh(); this.acc.push(this.sword); this.setDrawn(!!this.drawn);\n    this.play(this.cfg.states.idle, 0);"),
("  setConfig(patch) { Object.assign(this.cfg, patch); this.build(); }",
 """  setConfig(patch) { Object.assign(this.cfg, patch); this.build(); }
  // Sword in the right hand (drawn) or sheathed on the left hip. HAND_POSE is tuned to the rig so the blade points out of the fist.
  setDrawn(on) {
    this.drawn = on; const s = this.sword; if (!s) return; s.parent?.remove(s);
    if (on) { const h = this.bones.hand_r; if (!h) return; const P = SWORD_HAND; s.position.set(...P.pos); s.rotation.set(...P.rot); s.scale.setScalar(1); h.add(s); }
    else { const p = this.bones.pelvis; if (!p) return; s.position.set(-.2, -.06, .02); s.rotation.set(0, 0, 2.05); s.scale.setScalar(.9); p.add(s); }
  }
  swordSegment(a, b) { const s = this.sword; if (!s) return false; s.updateWorldMatrix(true, false); a.copy(s.userData.base).applyMatrix4(s.matrixWorld); b.copy(s.userData.tip).applyMatrix4(s.matrixWorld); return true; }
  // One-shot actions (attacks, dodge, hit reactions) override the locomotion graph until endAction().
  startAction(name, { fade = .1, rate = 1, loop = false } = {}) {
    const clip = this.clipMap[name]; if (!clip) return false; this.action = { name, rate, loop };
    for (const m of this.mixers) {
      const next = m.clipAction(clip); next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.setEffectiveTimeScale(1); next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); next.clampWhenFinished = !loop;
      if (m._cur && m._cur !== next) next.crossFadeFrom(m._cur, fade, false); else next.fadeIn(fade); next.play(); m._cur = next; m.timeScale = rate;
    }
    this.cur = name; this.rate = rate; return true;
  }
  endAction() { if (!this.action) return; this.action = null; this.cur = null; for (const m of this.mixers) { if (m._cur) m._cur.setLoop(THREE.LoopRepeat, Infinity); m._cur && (m._cur.clampWhenFinished = false); } }
  actionProgress() { const a = this.mixers[0]?._cur, c = a?.getClip(); return c && c.duration ? a.time / c.duration : 0; }"""),
("const D = ", "const SWORD_HAND = { pos: [0, .02, 0], rot: [0, 0, 0] };\nconst D = ") if False else ("export async function loadCharacterAssets() {", "export const SWORD_HAND = { pos: [0, .03, 0], rot: [0, 0, 0] };\nexport async function loadCharacterAssets() {"),
("  update(dt) {\n    const c = this.cur, st = this.body.cfg.states;\n    if (c) {",
 "  update(dt) {\n    if (this.body.action) { this.body.update(dt); return; }\n    const c = this.cur, st = this.body.cfg.states;\n    if (c) {"),
])
print('ok')
