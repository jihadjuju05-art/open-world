// Skeletal animation runtime: clips, sampling, blending, events and a data-driven state graph.
//
// Clip JSON:
//   { name, duration, loop, keys: { bone: [[t, rx, ry, rz, ease?], ...], "hips.pos": [[t, dx, dy, dz, ease?], ...] },
//     events: [{ t, name }] }
// Rotations are Euler XYZ radians (interpolated as quaternions); "hips.pos" is an offset from the rest hips position.
// ease: 0 = linear, 1 = smooth (ease in/out), 2 = step (hold value until the next key).
import * as THREE from 'three';
import { BONE_NAMES, REST_HIPS } from './rig.js';

export class Pose {
  constructor() { this.q = {}; for (const n of BONE_NAMES) this.q[n] = new THREE.Quaternion(); this.hips = REST_HIPS.clone(); }
  copy(o) { for (const n of BONE_NAMES) this.q[n].copy(o.q[n]); this.hips.copy(o.hips); return this; }
}
export function blendPoses(out, a, b, w) {
  for (const n of BONE_NAMES) out.q[n].slerpQuaternions(a.q[n], b.q[n], w);
  out.hips.lerpVectors(a.hips, b.hips, w);
}
export function applyPose(rig, pose) {
  for (const n of BONE_NAMES) rig.bones[n].quaternion.copy(pose.q[n]);
  rig.bones.hips.position.copy(pose.hips);
}

const _e = new THREE.Euler(), _off = new THREE.Vector3();
const easeW = (a, w) => a.e === 1 ? w * w * (3 - 2 * w) : a.e === 2 ? 0 : w;
function findSegment(keys, t) {
  let lo = 0, hi = keys.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid].t <= t) lo = mid; else hi = mid; }
  return lo;
}
function sampleTrack(keys, t, dur, loop, mix) {
  const last = keys.length - 1, wrapSpan = dur - keys[last].t + keys[0].t;
  const canWrap = loop && keys.length > 1 && keys[last].t < dur - 1e-6;
  if (t >= keys[last].t) return canWrap ? mix(keys[last], keys[0], Math.min(1, easeW(keys[last], wrapSpan > 0 ? (t - keys[last].t) / wrapSpan : 0))) : mix(keys[last], keys[last], 0);
  if (t <= keys[0].t) return canWrap ? mix(keys[last], keys[0], Math.min(1, easeW(keys[last], wrapSpan > 0 ? (dur - keys[last].t + t) / wrapSpan : 0))) : mix(keys[0], keys[0], 0);
  const i = findSegment(keys, t), a = keys[i], b = keys[i + 1];
  mix(a, b, easeW(a, b.t > a.t ? (t - a.t) / (b.t - a.t) : 0));
}

export class Clip {
  constructor(data) { this.rebuild(data); }
  rebuild(data = this.data) {
    this.data = data; this.name = data.name; this.duration = Math.max(.05, data.duration); this.loop = data.loop !== false;
    this.tracks = {}; this.pos = null; this.events = [...(data.events || [])].sort((a, b) => a.t - b.t);
    for (const [bone, keys] of Object.entries(data.keys || {})) {
      if (!keys.length) continue;
      const sorted = [...keys].sort((a, b) => a[0] - b[0]);
      if (bone === 'hips.pos') this.pos = sorted.map(k => ({ t: k[0], e: k[4] || 0, v: new THREE.Vector3(k[1], k[2], k[3]) }));
      else if (BONE_NAMES.includes(bone)) this.tracks[bone] = sorted.map(k => ({ t: k[0], e: k[4] || 0, q: new THREE.Quaternion().setFromEuler(_e.set(k[1], k[2], k[3], 'XYZ')) }));
    }
  }
  wrap(t) { return this.loop ? ((t % this.duration) + this.duration) % this.duration : Math.min(Math.max(t, 0), this.duration); }
  sample(t, pose) {
    t = this.wrap(t);
    for (const n of BONE_NAMES) {
      const tr = this.tracks[n], q = pose.q[n];
      if (!tr) { q.identity(); continue; }
      sampleTrack(tr, t, this.duration, this.loop, (a, b, w) => q.slerpQuaternions(a.q, b.q, w));
    }
    pose.hips.copy(REST_HIPS);
    if (this.pos) { sampleTrack(this.pos, t, this.duration, this.loop, (a, b, w) => _off.lerpVectors(a.v, b.v, w)); pose.hips.add(_off); }
    return pose;
  }
}

// Cross-fading animator driving a rig. Fires clip events (e.g. "footstep") through onEvent(name, clip).
export class Animator {
  constructor(rig) {
    this.rig = rig; this.cur = null; this.prev = null; this.t = 0; this.prevT = 0; this.rate = 1;
    this.fadeT = 0; this.fadeDur = .2; this.pa = new Pose(); this.pb = new Pose(); this.out = new Pose(); this.onEvent = null;
  }
  play(clip, fade = .2, restart = false) {
    if (this.cur === clip && !restart) return;
    this.prev = this.cur; this.prevT = this.t; this.cur = clip; this.t = 0; this.fadeT = 0; this.fadeDur = fade;
  }
  update(dt) {
    if (!this.cur) return;
    const t0 = this.t; this.t += dt * this.rate; this.prevT += dt * this.rate; this.fadeT += dt;
    if (this.onEvent && this.cur.events.length) this._events(t0, this.t);
    this.cur.sample(this.t, this.pa);
    const w = this.prev ? Math.min(1, this.fadeT / this.fadeDur) : 1;
    if (this.prev && w < 1) { this.prev.sample(this.prevT, this.pb); blendPoses(this.out, this.pb, this.pa, w); }
    else { this.prev = null; this.out.copy(this.pa); }
    applyPose(this.rig, this.out);
  }
  _events(a, b) {
    const c = this.cur, d = c.duration;
    for (const ev of c.events) {
      if (c.loop) { const n0 = Math.floor(a / d), n1 = Math.floor(b / d); for (let n = n0; n <= n1; n++) { const tt = ev.t + n * d; if (tt > a && tt <= b) this.onEvent(ev.name, c); } }
      else if (ev.t > a && ev.t <= b) this.onEvent(ev.name, c);
    }
  }
}

// Data-driven state graph:
//   { params: {speed:0, grounded:1}, entry: 'idle',
//     states: { idle: { clip:'idle', rateParam?:'speed', rateDiv?:2.3 }, ... },
//     transitions: [ { from:'idle'|'*', to:'walk', when:[['speed','>',0.3]], fade:.18 }, ... ] }
// Transitions are tested in order; the first whose `from` matches the current state (or '*') and whose conditions all hold wins.
export class AnimGraph {
  constructor(animator, clips, graph) {
    this.anim = animator; this.clips = clips; this.setGraph(graph);
  }
  setGraph(graph) {
    this.graph = graph; this.params = { ...graph.params }; this.state = graph.entry;
    const st = graph.states[this.state]; if (st && this.clips[st.clip]) this.anim.play(this.clips[st.clip], 0, true);
  }
  static test(op, a, b) { return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : op === '>=' ? a >= b : op === '==' ? a === b : a !== b; }
  update(dt) {
    const g = this.graph;
    for (const tr of g.transitions) {
      if (tr.to === this.state || (tr.from !== '*' && tr.from !== this.state)) continue;
      if (!tr.when.every(([p, op, v]) => AnimGraph.test(op, this.params[p] ?? 0, v))) continue;
      const st = g.states[tr.to], clip = st && this.clips[st.clip];
      if (clip) { this.state = tr.to; this.anim.play(clip, tr.fade ?? .18); }
      break;
    }
    const st = g.states[this.state];
    this.anim.rate = st && st.rateParam ? Math.max(.25, (this.params[st.rateParam] ?? 0) / (st.rateDiv || 1)) : (st?.rate ?? 1);
    this.anim.update(dt);
  }
}
