// Humanoid skeleton + a stylised "western" mannequin built from primitives (no external models needed).
// Conventions: character faces +Z, left side is +X, units are metres, origin at the feet.
// Rotations are Euler XYZ radians. For a limb hanging DOWN, +X rotation swings it BACKWARD (so forward = negative rx).
// For a bone pointing UP (spine, neck), +X rotation leans it FORWARD.
import * as THREE from 'three';

const side = (n, sx, up = 1) => [
  [`upperArm${n}`, 'chest', [sx * .21, .24, 0]],
  [`lowerArm${n}`, `upperArm${n}`, [0, -.29, 0]],
  [`hand${n}`, `lowerArm${n}`, [0, -.27, 0]],
  [`upperLeg${n}`, 'hips', [sx * .10, -.06, 0]],
  [`lowerLeg${n}`, `upperLeg${n}`, [0, -.44, 0]],
  [`foot${n}`, `lowerLeg${n}`, [0, -.43, 0]],
];
export const BONE_DEFS = [
  ['hips', null, [0, .98, 0]],
  ['spine', 'hips', [0, .08, 0]],
  ['chest', 'spine', [0, .22, 0]],
  ['neck', 'chest', [0, .30, 0]],
  ['head', 'neck', [0, .09, 0]],
  ...side('L', 1), ...side('R', -1),
];
export const BONE_NAMES = BONE_DEFS.map(d => d[0]);
export const REST_HIPS = new THREE.Vector3(0, .98, 0);

const COL = { skin: 0xd9a274, shirt: 0xb9b19a, vest: 0x4a2f20, pants: 0x3b4252, boot: 0x2b1d14, hat: 0x5a4632, band: 0x2a1c12, belt: 0x3a2618, gold: 0xd4af37, coat: 0x2f2a26, hair: 0x2b1d14, rifle: 0x6b4a2c, steel: 0x555a60 };
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: 0, ...o });

export function buildRig(colors = {}) {
  const C = { ...COL, ...colors }, M = k => mat(C[k]);
  const root = new THREE.Group(); root.name = 'rig';
  const bones = {};
  for (const [name, parent, off] of BONE_DEFS) {
    const b = new THREE.Group(); b.name = name; b.position.set(...off);
    (parent ? bones[parent] : root).add(b); bones[name] = b;
  }
  const add = (bone, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    bones[bone].add(mesh); return mesh;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 8);

  // torso
  add('hips', box(.31, .17, .20), M('pants'), 0, -.02, 0);
  add('hips', box(.325, .05, .22), M('belt'), 0, .07, 0);
  add('hips', box(.06, .05, .02), M('gold'), 0, .07, .115);
  add('spine', box(.30, .20, .19), M('shirt'), 0, .10, 0);
  add('chest', box(.35, .26, .21), M('shirt'), 0, .13, 0);
  add('chest', box(.365, .27, .05), M('vest'), 0, .13, .085);                 // vest front
  add('chest', box(.365, .27, .05), M('vest'), 0, .13, -.085);                // vest back
  add('neck', new THREE.CylinderGeometry(.05, .055, .12, 8), M('skin'), 0, .05, 0);
  // head + hat
  const head = add('head', new THREE.SphereGeometry(.105, 14, 12), M('skin'), 0, .12, 0); head.scale.set(.95, 1.1, 1);
  add('head', box(.03, .045, .04), M('skin'), 0, .115, .105);                 // nose (shows facing)
  add('head', new THREE.CylinderGeometry(.23, .23, .018, 18), M('hat'), 0, .21, 0);
  add('head', new THREE.CylinderGeometry(.115, .135, .13, 14), M('hat'), 0, .275, 0);
  add('head', new THREE.CylinderGeometry(.137, .137, .03, 14), M('band'), 0, .225, 0);
  // hair, eyes, neckerchief, holstered rifle on the back
  add('head', box(.2, .09, .09), M('hair'), 0, .1, -.06); add('head', box(.03, .028, .02), mat(0x15100c), .045, .13, .1); add('head', box(.03, .028, .02), mat(0x15100c), -.045, .13, .1);
  add('neck', box(.13, .07, .13), mat(0x8a3b2e), 0, .0, .0);
  const rifle = add('chest', box(.05, .95, .05), M('rifle'), -.06, .0, -.15); rifle.rotation.z = .55; add('chest', box(.06, .2, .07), M('rifle'), -.36, -.34, -.15).rotation.z = .55; add('chest', box(.035, .5, .035), M('steel'), .12, .38, -.15).rotation.z = .55;
  // long coat panels hang from the thighs so they swing with the stride
  for (const n of ['L', 'R']) { add(`upperLeg${n}`, box(.19, .58, .035), M('coat'), 0, -.3, .115); add(`upperLeg${n}`, box(.19, .58, .035), M('coat'), 0, -.3, -.115); add(`upperLeg${n}`, box(.035, .5, .2), M('coat'), n === 'L' ? .11 : -.11, -.27, 0); }
  // arms
  for (const n of ['L', 'R']) {
    add(`upperArm${n}`, cap(.052, .19), M('shirt'), 0, -.145, 0);
    add(`lowerArm${n}`, cap(.046, .18), M('shirt'), 0, -.135, 0);
    add(`hand${n}`, new THREE.SphereGeometry(.05, 8, 8), M('skin'), 0, -.04, 0);
    add(`upperLeg${n}`, cap(.078, .29), M('pants'), 0, -.22, 0);
    add(`lowerLeg${n}`, cap(.062, .29), M('pants'), 0, -.22, 0);
    add(`foot${n}`, box(.105, .085, .27), M('boot'), 0, -.045, .06);
    add(`foot${n}`, box(.11, .04, .07), M('boot'), 0, -.09, -.03);
  }
  return { root, bones };
}
