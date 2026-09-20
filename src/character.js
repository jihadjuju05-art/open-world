// Realistic character: Quaternius "Universal Base Characters" body + "Modular Outfits" clothing + hair, animated with the
// "Universal Animation Library" (all CC0). Parts are separate glTF files that share the same 65-bone humanoid skeleton,
// so each one is animated by its own AnimationMixer with the same clip.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const D = 'assets/character/';
export const NATURAL_SPEED = { walk: .98, jog: 5.36, run: 8.25, swim: 2.18 };       // ground speed (m/s) each library clip covers
export const DEFAULT_CHAR = {
  name: 'Forastero', outfit: 'peasant', hood: false, pauldron: false, hair: 'SimpleParted', beard: true, skin: 'Dark', skinTone: .5, hairColor: '#4a3320', tint: '#b9a78c', hat: true, hatColor: '#3d2f22', holster: true, rifle: true, scarf: true, scarfColor: '#8a3b2e', height: 1,
  states: { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop', jump: 'Jump_Loop', swim: 'Swim_Fwd_Loop', swimIdle: 'Swim_Idle_Loop' },
  rateDiv: { walk: .98, jog: 5.36, run: 8.25, swim: 2.18 },
};

export const SWORD_HAND = { pos: [-.02, .07, 0], rot: [1.12, 0, 0] };
export async function loadCharacterAssets() {
  const L = new GLTFLoader(), load = u => L.loadAsync(u);
  const [base, anims, ranger, peasant, hairSP, hairB, hairL, hairU, beard, brows, anims2] = await Promise.all([
    load(D + 'Superhero_Male_FullBody.gltf'), load(D + 'anims/UAL1_Standard.glb'), load(D + 'outfits/Male_Ranger.gltf'), load(D + 'outfits/Male_Peasant.gltf'),
    load(D + 'hair/Hair_SimpleParted.gltf'), load(D + 'hair/Hair_Buns.gltf'), load(D + 'hair/Hair_Long.gltf'), load(D + 'hair/Hair_Buzzed.gltf'), load(D + 'hair/Hair_Beard.gltf'), load(D + 'hair/Eyebrows_Regular.gltf'), load(D + 'anims/UAL2_Standard.glb').catch(() => ({ animations: [] }))
  ]);
  const have = new Set(anims.animations.map(c => c.name));
  return { base, clips: [...anims.animations, ...anims2.animations.filter(c => !have.has(c.name))], ranger, peasant, hair: { SimpleParted: hairSP, Buns: hairB, Long: hairL, Buzzed: hairU }, beard, brows };
}

// ---- one-handed sword: blade along local +Y, grip at the origin. userData.base / tip are the hitbox segment ends (local space) ----
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

// ---- procedural western accessories (attached to bones) ----
function hatMesh(color) {
  const pts = [[0, .118], [.055, .13], [.1, .118], [.108, .06], [.11, .0], [.2, -.004], [.245, .018], [.262, .045], [.255, .05], [.2, .008], [.113, .012], [.1, .108], [.055, .118], [0, .108]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.113, .116, .028, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d130c, roughness: .7 })); band.position.y = .028; m.add(band);
  m.castShadow = true; return m;
}
const leather = c => new THREE.MeshStandardMaterial({ color: c, roughness: .75 });
function beltRig() {
  const g = new THREE.Group();
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(.168, .172, .05, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: .7, side: THREE.DoubleSide })); g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(.055, .045, .012), new THREE.MeshStandardMaterial({ color: 0xc9a13a, metalness: .8, roughness: .35 })); buckle.position.set(0, 0, .172); g.add(buckle);
  return g;
}
function holsterRig() {
  const g = new THREE.Group();
  const hol = new THREE.Mesh(new THREE.BoxGeometry(.07, .2, .1), leather(0x4a2f1a)); hol.position.set(0, -.12, 0); g.add(hol);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.035, .1, .045), leather(0x2a1c12)); grip.position.set(0, .0, .01); grip.rotation.x = -.25; g.add(grip);
  return g;
}
function rifleRig() {
  const g = new THREE.Group(), wood = leather(0x6b4a2c), steel = new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: .7, roughness: .4 });
  const stock = new THREE.Mesh(new THREE.BoxGeometry(.05, .3, .07), wood); stock.position.y = -.42; g.add(stock);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.045, .5, .05), wood); body.position.y = -.05; g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .55, 8), steel); barrel.position.y = .45; g.add(barrel);
  return g;
}
function scarfRig(color = '#8a3b2e') {
  const m = new THREE.Mesh(new THREE.TorusGeometry(.085, .038, 8, 20), new THREE.MeshStandardMaterial({ color, roughness: .9 })); m.rotation.x = Math.PI / 2; return m;
}

export class GltfBody {
  constructor(assets, cfg = {}) {
    this.assets = assets; this.cfg = { ...DEFAULT_CHAR, ...cfg, states: { ...DEFAULT_CHAR.states, ...(cfg.states || {}) }, rateDiv: { ...DEFAULT_CHAR.rateDiv, ...(cfg.rateDiv || {}) } };
    this.root = new THREE.Group(); this.root.name = 'character'; this.clipMap = Object.fromEntries(assets.clips.map(c => [c.name, c]));
    this.parts = []; this.mixers = []; this.cur = null; this.rate = 1; this.acc = [];
    this.build();
  }
  addPart(gltf, name, hideFn) {
    const r = skClone(gltf.scene); r.name = name;
    r.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.name) { o.visible = false; return; }          // rig helper shapes
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); if (o.material.map) o.material.map.anisotropy = 4; } if (hideFn && hideFn(o.name)) o.visible = false; } });
    this.root.add(r); this.parts.push(r); this.mixers.push(new THREE.AnimationMixer(r)); return r;
  }
  build() {
    for (const p of this.parts) this.root.remove(p); this.parts = []; this.mixers = []; for (const a of this.acc) a.parent?.remove(a); this.acc = []; this.cur = null;
    const c = this.cfg, A = this.assets;
    const clothed = c.outfit !== 'none';
    // base body: hidden clothes region is covered by the outfit, so the base mesh stays for head/neck/hands
    this.baseRoot = this.addPart(A.base, 'base');
    this.baseRoot.traverse(o => {
      if (o.isSkinnedMesh && /SuperHero_Male|Sphere/i.test(o.name)) { if (clothed) this.cropToHead(o); else o.material.color.set(c.tint); }
    });
    if (clothed) this.addPart(A[c.outfit], 'outfit', n => (!c.hood && /Hood/i.test(n)) || (!c.pauldron && /Pauldron/i.test(n)));
    if (c.hair && c.hair !== 'none' && A.hair[c.hair]) this.addPart(A.hair[c.hair], 'hair');
    this.addPart(A.brows, 'brows'); if (c.beard) this.addPart(A.beard, 'beard');
    // tint clothing (multiplies the texture)
    this.parts.find(p => p.name === 'outfit')?.traverse(o => { if (o.isMesh && o.material && /Ranger|Peasant/i.test(o.material.name || '')) o.material.color.set(c.tint); });
    // bones (from the base skeleton) for accessories / IK
    this.applyColors();
    this.bones = {}; this.baseRoot.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.partBones = this.parts.map(p => { const m = {}; p.traverse(o => { if (o.isBone) m[o.name] = o; }); return m; });
    const attach = (bone, obj, pos, rot = [0, 0, 0], s = 1) => { const b = this.bones[bone]; if (!b) return; obj.position.set(...pos); obj.rotation.set(...rot); obj.scale.setScalar(s); b.add(obj); this.acc.push(obj); };
    if (c.hat) attach('Head', hatMesh(c.hatColor), [0, .13, .012], [-.08, 0, 0]);
    if (c.scarf) attach('neck_01', scarfRig(c.scarfColor), [0, .04, .01]);
    attach('pelvis', beltRig(), [0, .1, 0]);
    if (c.holster) attach('pelvis', holsterRig(), [.17, .04, .02], [0, 0, 0]);
    if (c.rifle) attach('spine_03', rifleRig(), [-.04, -.02, -.17], [0, 0, .95], .78);
    this.sword = swordMesh(); this.acc.push(this.sword); this.setDrawn(!!this.drawn);
    this.play(this.cfg.states.idle, 0);
  }
  // Skin tone (multiplies the skin textures; >1 lightens) and hair/beard colour.
  applyColors() {
    const c = this.cfg, t = Math.max(0, Math.min(1, c.skinTone ?? .5)), k = .55 + t * .85, skin = new THREE.Color(k * 1.02, k * .93, k * .85);
    for (const p of this.parts) p.traverse(o => {
      if (!o.isMesh || !o.material) return; const n = o.material.name || '';
      if (/Superhero|Regular_Male/i.test(n)) o.material.color.copy(skin);
      else if (/Hair/i.test(n)) o.material.color.set(c.hairColor || '#4a3320');
    });
  }
  // Keeps only the triangles skinned mostly to the head/neck bones: the outfit provides torso, arms, hands, legs and feet.
  cropToHead(mesh) {
    const g = mesh.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index; if (!si || !idx) return;
    const keep = new Set(); mesh.skeleton.bones.forEach((b, i) => { if (/^(Head|neck_01)$/.test(b.name)) keep.add(i); });
    const w = v => { let t = 0; for (let k = 0; k < 4; k++) if (keep.has(si.getComponent(v, k))) t += sw.getComponent(v, k); return t; };
    const out = [], min = this.cfg.neckCut ?? .5;
    for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), d = idx.getX(i + 2); if (w(a) >= min && w(b) >= min && w(d) >= min) out.push(a, b, d); }
    g.setIndex(out); mesh.geometry = g;
  }
  setConfig(patch) { Object.assign(this.cfg, patch); this.build(); }
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
  actionProgress() { const a = this.mixers[0]?._cur, c = a?.getClip(); return c && c.duration ? a.time / c.duration : 0; }
  clip(name) { return this.clipMap[name]; }
  play(name, fade = .2, rate = 1) {
    const clip = this.clipMap[name]; if (!clip) return; this.rate = rate;
    if (this.cur === name) { for (const m of this.mixers) m.timeScale = rate; return; }
    for (const m of this.mixers) {
      const next = m.clipAction(clip); next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.setEffectiveTimeScale(1);
      if (m._cur && m._cur !== next) { next.crossFadeFrom(m._cur, fade, false); } else next.fadeIn(fade);
      next.play(); m._cur = next; m.timeScale = rate;
    }
    this.cur = name;
  }
  update(dt) { for (const m of this.mixers) m.update(dt); }
  get duration() { return this.clipMap[this.cur]?.duration || 0; }
}

// Adapter so the existing data-driven AnimGraph (config/graph.json) can drive the glTF character.
export class GltfAnimator {
  constructor(body) { this.body = body; this.rate = 1; this.cur = null; this.swimIdle = false; this.fade = .2; }
  play(clip, fade = .2) { this.cur = clip; this.fade = fade; }
  update(dt) {
    if (this.body.action) { this.body.update(dt); return; }
    const c = this.cur, st = this.body.cfg.states;
    if (c) {
      let name = st[c.stateKey] || st.idle; if (c.stateKey === 'swim' && this.swimIdle) name = st.swimIdle;
      this.body.play(name, this.fade, this.rate);
    }
    this.body.update(dt);
  }
}
