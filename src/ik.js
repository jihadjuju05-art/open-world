// Analytic two-bone inverse kinematics for the humanoid rig (arms and legs).
// Bones point along their local -Y, so the "direction" of a bone is toward its child joint.
import * as THREE from 'three';

const V = () => new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

function aimBone(bone, childPos, wantDir) {
  const p = bone.getWorldPosition(V()), cur = childPos.clone().sub(p), want = wantDir.clone();
  if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
  cur.normalize(); want.normalize();
  const delta = _qa.setFromUnitVectors(cur, want);
  const world = bone.getWorldQuaternion(_qb).premultiply(delta);
  const parentW = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentW.invert().multiply(world)).normalize();
  bone.updateMatrixWorld(true);
}

// chain = [upper, lower, end] joint objects. Moves the end joint toward `target` bending toward `pole`.
export function solveTwoBone(chain, target, pole) {
  const [u, l, e] = chain; u.parent.updateWorldMatrix(true, false); u.updateWorldMatrix(true, true);
  const A = u.getWorldPosition(V()), B = l.getWorldPosition(V()), C = e.getWorldPosition(V());
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  const toT = target.clone().sub(A), dir = toT.clone().normalize();
  const d = Math.min(Math.max(toT.length(), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  const pd = pole.clone().sub(A); pd.addScaledVector(dir, -pd.dot(dir)); if (pd.lengthSq() < 1e-6) pd.set(0, 0, 1); pd.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const Bn = A.clone().addScaledVector(dir, a).addScaledVector(pd, hgt), Tn = A.clone().addScaledVector(dir, d);
  aimBone(u, B, Bn.clone().sub(A));
  const B2 = l.getWorldPosition(V()), C2 = e.getWorldPosition(V());
  aimBone(l, C2, Tn.clone().sub(B2));
}

// Handles used by the Studio: name -> joint chain + pole hint (relative to the upper joint, in world space).
export const IK_CHAINS = {
  handL: { chain: ['upperArmL', 'lowerArmL', 'handL'], pole: [.35, -.25, -1] },
  handR: { chain: ['upperArmR', 'lowerArmR', 'handR'], pole: [-.35, -.25, -1] },
  footL: { chain: ['upperLegL', 'lowerLegL', 'footL'], pole: [0, 0, 1] },
  footR: { chain: ['upperLegR', 'lowerLegR', 'footR'], pole: [0, 0, 1] },
};
export function solveHandle(rig, name, target) {
  const c = IK_CHAINS[name], chain = c.chain.map(n => rig.bones[n]);
  chain[0].updateWorldMatrix(true, false);
  const pole = chain[0].getWorldPosition(V()).add(new THREE.Vector3(...c.pole).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  solveTwoBone(chain, target, pole);
  return c.chain.slice(0, 2);
}
