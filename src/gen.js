// Procedural animation generators. Each returns clip JSON (same format the studio edits and exports).
// A function of loop phase p in [0,1) returns { bone: [rx,ry,rz], 'hips.pos': [dx,dy,dz] }.
const TAU = Math.PI * 2;

export function build(name, duration, loop, fn, samples = 24) {
  const keys = {};
  for (let i = 0; i <= samples; i++) {
    const p = i / samples, t = p * duration, f = fn(p);
    for (const [b, v] of Object.entries(f)) (keys[b] ??= []).push([+t.toFixed(4), ...v.map(x => +x.toFixed(4))]);
  }
  return { name, duration, loop, keys };
}

// Locomotion cycle. `amp` leg swing, `knee` peak knee flex, `arm` arm swing, `elbow` base elbow flex,
// `lean` forward torso lean, `bob` vertical hip travel.
export function locomotion({ name = 'walk', dur = 1.0, amp = .45, knee = .75, arm = .5, elbow = .35, lean = .05, bob = .035, twist = .08 } = {}) {
  const clip = build(name, dur, true, p => {
    const th = p * TAU, out = {};
    for (const [n, ph, armSign] of [['L', 0, 1], ['R', Math.PI, 1]]) {
      const s = Math.sin(th + ph), c = Math.cos(th + ph);
      const swing = amp * s, bend = knee * Math.max(0, c) + .06;
      const up = -swing;                                    // forward swing = negative rx
      out[`upperLeg${n}`] = [up, 0, n === 'L' ? .02 : -.02];
      out[`lowerLeg${n}`] = [bend, 0, 0];
      out[`foot${n}`] = [-(up + bend) * .8, 0, 0];
      // arms oppose the same-side leg
      out[`upperArm${n}`] = [arm * s, 0, (n === 'L' ? 1 : -1) * .07];
      out[`lowerArm${n}`] = [-(elbow + .2 * arm * (1 - s) / 2 + .1 * c * arm), 0, 0];
      out[`hand${n}`] = [0, 0, 0];
    }
    const sT = Math.sin(th);
    out.hips = [0, twist * sT, .03 * sT];
    out.spine = [lean * .5, -twist * .7 * sT, -.02 * sT];
    out.chest = [lean * .5, -twist * .5 * sT, 0];
    out.neck = [-lean * .4, twist * .3 * sT, 0];
    out.head = [-lean * .3, 0, 0];
    out['hips.pos'] = [0, bob * Math.cos(2 * th) - bob * .5, lean * .05];
    return out;
  });
  clip.events = [{ t: +(.25 * dur).toFixed(3), name: 'footstep_L' }, { t: +(.75 * dur).toFixed(3), name: 'footstep_R' }];
  return clip;
}
export const walk = (o = {}) => locomotion({ name: 'walk', dur: 1.0, ...o });
export const run = (o = {}) => locomotion({ name: 'run', dur: .62, amp: .95, knee: 1.75, arm: .95, elbow: 1.35, lean: .2, bob: .075, twist: .16, ...o });
export const jog = (o = {}) => locomotion({ name: 'jog', dur: .8, amp: .7, knee: 1.2, arm: .7, elbow: .9, lean: .12, bob: .05, twist: .12, ...o });

export function idle({ name = 'idle', dur = 4 } = {}) {
  return build(name, dur, true, p => {
    const th = p * TAU, br = Math.sin(th), sw = Math.sin(th + 1.2);
    return {
      hips: [0, .02 * sw, .012 * sw], spine: [.01 * br, -.015 * sw, 0], chest: [.02 * br, 0, 0], neck: [-.01 * br, .04 * sw, 0], head: [.01, .06 * sw, 0],
      upperArmL: [.04 + .02 * br, 0, .09], lowerArmL: [-.16, 0, 0], handL: [0, 0, 0],
      upperArmR: [.04 - .02 * br, 0, -.09], lowerArmR: [-.16, 0, 0], handR: [0, 0, 0],
      upperLegL: [-.015, 0, .04], lowerLegL: [.03, 0, 0], footL: [-.01, 0, 0],
      upperLegR: [-.015, 0, -.04], lowerLegR: [.03, 0, 0], footR: [-.01, 0, 0],
      'hips.pos': [0, -.006 * br - .004, 0],
    };
  }, 16);
}

export function jump({ name = 'jump' } = {}) {
  const pose = e => ({
    hips: [.08 * e, 0, 0], spine: [.06 * e, 0, 0], chest: [.04 * e, 0, 0], neck: [-.08 * e, 0, 0], head: [-.05 * e, 0, 0],
    upperArmL: [-.9 * e, 0, .5 * e], lowerArmL: [-.5 * e, 0, 0], handL: [0, 0, 0],
    upperArmR: [-.9 * e, 0, -.5 * e], lowerArmR: [-.5 * e, 0, 0], handR: [0, 0, 0],
    upperLegL: [-.55 * e, 0, .05], lowerLegL: [.95 * e, 0, 0], footL: [-.2 * e, 0, 0],
    upperLegR: [-.2 * e, 0, -.05], lowerLegR: [.4 * e, 0, 0], footR: [-.1 * e, 0, 0],
    'hips.pos': [0, .05 * e, 0],
  });
  return build(name, .5, false, p => pose(1 - Math.pow(1 - Math.min(1, p * 2), 2)), 10);
}

export function crouch({ name = 'crouch' } = {}) {
  return build(name, 3, true, p => {
    const br = Math.sin(p * TAU);
    return {
      hips: [.25, 0, 0], spine: [.15, 0, 0], chest: [.1 + .01 * br, 0, 0], neck: [-.2, 0, 0], head: [-.1, 0, 0],
      upperArmL: [-.3, 0, .1], lowerArmL: [-.6, 0, 0], upperArmR: [-.3, 0, -.1], lowerArmR: [-.6, 0, 0],
      upperLegL: [-1.1, 0, .06], lowerLegL: [1.6, 0, 0], footL: [-.3, 0, 0],
      upperLegR: [-1.1, 0, -.06], lowerLegR: [1.6, 0, 0], footR: [-.3, 0, 0],
      'hips.pos': [0, -.42, .05],
    };
  }, 12);
}

// Treading water: upright body, alternating bicycle kicks and sweeping arms.
export function swim({ name = 'swim' } = {}) {
  return build(name, 1.3, true, p => {
    const th = p * TAU, out = {};
    for (const [n, ph, sg] of [['L', 0, 1], ['R', Math.PI, -1]]) {
      const s = Math.sin(th + ph), c = Math.cos(th + ph);
      out[`upperLeg${n}`] = [-.45 - .35 * s, 0, sg * .08]; out[`lowerLeg${n}`] = [.9 + .55 * Math.max(0, c), 0, 0]; out[`foot${n}`] = [-.3, 0, 0];
      out[`upperArm${n}`] = [-1.0 + .55 * c, 0, sg * (.75 + .25 * s)]; out[`lowerArm${n}`] = [-.6 - .3 * s, 0, 0]; out[`hand${n}`] = [0, 0, 0];
    }
    out.hips = [.1, .05 * Math.sin(th), 0]; out.spine = [.12, 0, 0]; out.chest = [.1, .05 * Math.sin(th + 1), 0]; out.neck = [-.15, 0, 0]; out.head = [-.1, 0, 0];
    out['hips.pos'] = [0, -.05 + .03 * Math.sin(th * 2), 0]; return out;
  }, 20);
}
export const PRESETS = { walk, jog, run, idle, jump, crouch, swim };
export const defaults = () => ({ walk: walk(), jog: jog(), run: run(), idle: idle(), jump: jump(), crouch: crouch(), swim: swim() });

// Default animation state graph (edited in the Studio's "Estados" tab, saved to config/graph.json).
export const defaultGraph = () => ({
  params: { speed: 0, grounded: 1, swim: 0 }, entry: 'idle',
  states: {
    idle: { clip: 'idle' },
    walk: { clip: 'walk', rateParam: 'speed', rateDiv: 1.55 },     // rateDiv ~ ground speed the clip's stride covers
    jog:  { clip: 'jog',  rateParam: 'speed', rateDiv: 2.9 },
    run:  { clip: 'run',  rateParam: 'speed', rateDiv: 4.7 },
    jump: { clip: 'jump' },
    swim: { clip: 'swim', rateParam: 'speed', rateDiv: 1.4 },
  },
  transitions: [
    { from: '*',    to: 'swim', when: [['swim', '>', 0.5]], fade: .25 },
    { from: 'swim', to: 'idle', when: [['swim', '<', 0.5]], fade: .25 },
    { from: '*',    to: 'jump', when: [['grounded', '<', 0.5]], fade: .08 },
    { from: 'jump', to: 'idle', when: [['grounded', '>', 0.5]], fade: .12 },
    { from: 'idle', to: 'walk', when: [['speed', '>', 0.3]], fade: .18 },
    { from: 'walk', to: 'idle', when: [['speed', '<', 0.25]], fade: .18 },
    { from: 'walk', to: 'jog',  when: [['speed', '>', 2.3]], fade: .22 },
    { from: 'jog',  to: 'walk', when: [['speed', '<', 2.0]], fade: .22 },
    { from: 'jog',  to: 'run',  when: [['speed', '>', 4.3]], fade: .22 },
    { from: 'run',  to: 'jog',  when: [['speed', '<', 4.0]], fade: .22 },
  ],
});
