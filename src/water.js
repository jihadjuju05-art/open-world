// Gerstner-wave water shared by the game and the Studio's Water Lab.
// The GPU vertex shader and the CPU sampler (waveHeight) use the same maths, so floating objects match the visible surface.
import * as THREE from 'three';

export const DEFAULT_WATER = {
  level: 0, amp: 1, opacity: .8, foam: .55, specular: 1.4, skyReflect: .8, timeScale: 1,
  shallow: '#2f9aa8', deep: '#0b3c5c',
  waves: [                       // dir = wind angle (rad), steep 0..1, len = wavelength (m)
    { dir: .35, steep: .22, len: 46 }, { dir: 1.1, steep: .16, len: 27 }, { dir: -.5, steep: .12, len: 16 }, { dir: 2.2, steep: .08, len: 9 },
  ],
  buoyancy: { k: 26, damp: 2.6, density: 1 },
};
export const WATER_PRESETS = {
  calma: { amp: .35, waves: [{ dir: .3, steep: .12, len: 50 }, { dir: 1.2, steep: .08, len: 30 }, { dir: -.6, steep: .05, len: 18 }, { dir: 2.2, steep: .04, len: 10 }] },
  brisa: { amp: 1, waves: DEFAULT_WATER.waves },
  tormenta: { amp: 2.4, foam: .9, waves: [{ dir: .3, steep: .42, len: 70 }, { dir: .9, steep: .32, len: 38 }, { dir: -.2, steep: .25, len: 22 }, { dir: 1.6, steep: .18, len: 12 }] },
};
export const mergeWater = (p = {}) => ({ ...DEFAULT_WATER, ...p, waves: (p.waves || DEFAULT_WATER.waves).map(w => ({ ...w })), buoyancy: { ...DEFAULT_WATER.buoyancy, ...(p.buoyancy || {}) } });

const G = 9.81;
// Surface height above `level` at world (x,z) and time t.
export function waveHeight(p, x, z, t) {
  let y = 0;
  for (const w of p.waves) {
    const k = 2 * Math.PI / w.len, c = Math.sqrt(G / k), dx = Math.cos(w.dir), dz = Math.sin(w.dir);
    y += (w.steep / k) * Math.sin(k * (dx * x + dz * z - c * t * p.timeScale)) * p.amp;
  }
  return p.level + y;
}
export function waveNormal(p, x, z, t, e = .6) {
  const hx = waveHeight(p, x + e, z, t) - waveHeight(p, x - e, z, t), hz = waveHeight(p, x, z + e, t) - waveHeight(p, x, z - e, t);
  return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
}

const VERT = /* glsl */`
  uniform float time; uniform float amp; uniform float level; uniform vec4 waves[4];
  varying vec3 vWorld; varying vec3 vN; varying float vH;
  #include <fog_pars_vertex>
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 p = wp.xyz; vec3 tangent = vec3(1.,0.,0.), binormal = vec3(0.,0.,1.); vec3 disp = vec3(0.);
    for(int i=0;i<4;i++){
      vec4 w = waves[i]; float k = 6.2831853/w.w; float c = sqrt(9.81/k); vec2 d = vec2(cos(w.x), sin(w.x));
      float f = k*(dot(d, p.xz) - c*time); float s = w.y*amp, a = w.y/k*amp;
      disp += vec3(d.x*a*cos(f), a*sin(f), d.y*a*cos(f));
      tangent  += vec3(-d.x*d.x*s*sin(f), d.x*s*cos(f), -d.x*d.y*s*sin(f));
      binormal += vec3(-d.x*d.y*s*sin(f), d.y*s*cos(f), -d.y*d.y*s*sin(f));
    }
    vec3 pos = vec3(p.x, level, p.z) + disp;
    vN = normalize(cross(binormal, tangent)); vH = disp.y; vWorld = pos;
    vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FRAG = /* glsl */`
  uniform vec3 shallow, deep, sunDir, sunColor, camPos; uniform float opacity, foam, specular, skyReflect, ampSum; uniform vec3 skyColor;
  varying vec3 vWorld; varying vec3 vN; varying float vH;
  #include <fog_pars_fragment>
  void main(){
    vec3 N = normalize(vN); if(N.y < 0.0) N = -N;
    vec3 V = normalize(camPos - vWorld);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    float hh = clamp(0.5 + vH / max(ampSum, 0.001) * 0.6, 0.0, 1.0);
    vec3 col = mix(deep, shallow, hh);
    col = mix(col, skyColor, clamp(fres * skyReflect * 0.6 + 0.02, 0.0, 1.0));
    vec3 H = normalize(sunDir + V);
    col += sunColor * pow(max(dot(N, H), 0.0), 220.0) * specular;
    float crest = smoothstep(0.88, 1.0, vH / max(ampSum, 0.001) * 0.5 + 0.5) * foam;
    col = mix(col, vec3(0.95, 0.98, 1.0), crest);
    gl_FragColor = vec4(col, clamp(opacity + crest * 0.4, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export function createWater(params, { size = 900, segments = 256 } = {}) {
  const p = mergeWater(params);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, amp: { value: 1 }, level: { value: 0 }, waves: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      shallow: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(1, 1, 1) },
      skyColor: { value: new THREE.Color(.5, .7, .95) }, camPos: { value: new THREE.Vector3() }, opacity: { value: .8 }, foam: { value: .5 }, specular: { value: 1 }, skyReflect: { value: .8 }, ampSum: { value: 1 },
    }]),
  });
  const geo = new THREE.PlaneGeometry(size, size, segments, segments); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  const api = {
    mesh, params: p,
    setParams(np) { api.params = mergeWater(np); },
    update(time, camPos, sunDir, sunColor, skyColor) {
      const P = api.params, u = mat.uniforms;
      u.time.value = time * P.timeScale; u.amp.value = P.amp; u.level.value = P.level;
      P.waves.slice(0, 4).forEach((w, i) => u.waves.value[i].set(w.dir, w.steep, 0, w.len));
      u.shallow.value.set(P.shallow); u.deep.value.set(P.deep); u.opacity.value = P.opacity; u.foam.value = P.foam; u.specular.value = P.specular; u.skyReflect.value = P.skyReflect;
      u.ampSum.value = P.waves.reduce((s, w) => s + w.steep / (2 * Math.PI / w.len), 0) * P.amp;
      if (camPos) u.camPos.value.copy(camPos); if (sunDir) u.sunDir.value.copy(sunDir); if (sunColor) u.sunColor.value.copy(sunColor); if (skyColor) u.skyColor.value.copy(skyColor);
      const s = (size / segments) * 6; mesh.position.x = Math.round((camPos ? camPos.x : 0) / s) * s; mesh.position.z = Math.round((camPos ? camPos.z : 0) / s) * s;
    },
    height: (x, z, t) => waveHeight(P(), x, z, t),
  };
  const P = () => api.params;
  return api;
}


// ---------------------------------------------------------------------------------------------
// Shore water: one mesh per chunk that touches water. Per-vertex attributes carry the signed depth
// (waterLevel - terrainHeight) and the river flow, so lakes get waves while shallows and rivers get calm, flowing ripples
// with foam along the banks.
const SHORE_VERT = /* glsl */`
  uniform float time; uniform float amp; uniform vec4 waves[4];
  attribute float aDepth; attribute vec3 aFlow;
  varying vec3 vWorld; varying vec3 vN; varying float vH; varying float vDepth; varying vec3 vFlow;
  #include <fog_pars_vertex>
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0); vec3 p = wp.xyz;
    float m = smoothstep(0.3, 3.5, aDepth) * (1.0 - aFlow.z * 0.9);
    vec3 tangent = vec3(1.,0.,0.), binormal = vec3(0.,0.,1.), disp = vec3(0.);
    for(int i=0;i<4;i++){
      vec4 w = waves[i]; float k = 6.2831853/w.w; float c = sqrt(9.81/k); vec2 d = vec2(cos(w.x), sin(w.x));
      float f = k*(dot(d, p.xz) - c*time); float s = w.y*amp*m, a = w.y/k*amp*m;
      disp += vec3(d.x*a*cos(f), a*sin(f), d.y*a*cos(f));
      tangent  += vec3(-d.x*d.x*s*sin(f), d.x*s*cos(f), -d.x*d.y*s*sin(f));
      binormal += vec3(-d.x*d.y*s*sin(f), d.y*s*cos(f), -d.y*d.y*s*sin(f));
    }
    vec3 pos = p + disp; vN = normalize(cross(binormal, tangent)); vH = disp.y; vWorld = pos; vDepth = aDepth; vFlow = aFlow;
    vec4 mvPosition = viewMatrix * vec4(pos, 1.0); gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const SHORE_FRAG = /* glsl */`
  uniform vec3 shallow, deep, sunDir, sunColor, camPos, skyColor; uniform float opacity, foam, specular, skyReflect, ampSum, time;
  varying vec3 vWorld; varying vec3 vN; varying float vH; varying float vDepth; varying vec3 vFlow;
  #include <fog_pars_fragment>
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float ripple(vec2 uv){ return vnoise(uv) * 0.6 + vnoise(uv * 2.3 + 7.1) * 0.4; }
  void main(){
    if (vDepth <= 0.0) discard;
    vec3 N = normalize(vN); if (N.y < 0.0) N = -N;
    // flowing ripples: rivers scroll along their flow direction, still water only shimmers
    vec2 flow = vFlow.xy * vFlow.z * 1.6;
    vec2 uv = vWorld.xz * 0.55 - flow * time + vec2(time * 0.03, time * 0.02) * (1.0 - vFlow.z);
    float e = 0.12; float r0 = ripple(uv);
    vec2 g = vec2(ripple(uv + vec2(e, 0.0)) - r0, ripple(uv + vec2(0.0, e)) - r0) / e;
    float ripAmt = mix(0.08, 0.35, vFlow.z) * (0.4 + 0.6 * smoothstep(0.0, 1.2, vDepth));
    N = normalize(N + vec3(-g.x, 0.0, -g.y) * ripAmt);
    vec3 V = normalize(camPos - vWorld);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    float d = clamp(vDepth, 0.0, 6.0);
    vec3 col = mix(shallow, deep, smoothstep(0.1, 4.0, d));
    col = mix(col, skyColor, clamp(fres * skyReflect * 0.65 + 0.03, 0.0, 1.0));
    vec3 H = normalize(sunDir + V); col += sunColor * pow(max(dot(N, H), 0.0), 180.0) * specular;
    float crest = smoothstep(0.88, 1.0, vH / max(ampSum, 0.001) * 0.5 + 0.5) * foam * step(0.6, vDepth);
    float shoreFoam = smoothstep(0.42, 0.0, vDepth) * (0.55 + 0.45 * vnoise(vWorld.xz * 2.8 + time * 0.6)) * foam;
    float rapids = smoothstep(0.55, 0.9, ripple(uv * 1.7 + 3.0)) * vFlow.z * 0.35;
    col = mix(col, vec3(0.95, 0.98, 1.0), clamp(crest + shoreFoam + rapids, 0.0, 1.0));
    float a = mix(0.32, opacity, smoothstep(0.0, 1.6, vDepth)); a = clamp(a + shoreFoam * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
export function createShoreWaterMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: SHORE_VERT, fragmentShader: SHORE_FRAG, transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, amp: { value: 1 }, waves: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      shallow: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(1, 1, 1) },
      skyColor: { value: new THREE.Color(.5, .7, .95) }, camPos: { value: new THREE.Vector3() }, opacity: { value: .85 }, foam: { value: .5 }, specular: { value: 1 }, skyReflect: { value: .8 }, ampSum: { value: 1 },
    }]),
  });
}
export function updateShoreWater(mat, P, time, camPos, sunDir, sunColor, skyColor) {
  const u = mat.uniforms; u.time.value = time * P.timeScale; u.amp.value = P.amp;
  P.waves.slice(0, 4).forEach((w, i) => u.waves.value[i].set(w.dir, w.steep, 0, w.len));
  u.shallow.value.set(P.shallow); u.deep.value.set(P.deep); u.opacity.value = P.opacity; u.foam.value = P.foam; u.specular.value = P.specular; u.skyReflect.value = P.skyReflect;
  u.ampSum.value = P.waves.reduce((s, w) => s + w.steep / (2 * Math.PI / w.len), 0) * P.amp;
  u.camPos.value.copy(camPos); u.sunDir.value.copy(sunDir); u.sunColor.value.copy(sunColor); u.skyColor.value.copy(skyColor);
}
