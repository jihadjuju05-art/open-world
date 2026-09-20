// Day/night cycle: sky dome (gradient, sun, stars, drifting clouds), sun/moon light, fog and ambient colour.
import * as THREE from 'three';
import { makeNoise, fbm } from './noise.js';

const KEYS = [   // hour, zenith, horizon, sun colour, light intensity, ambient intensity, fog far (m)
  [0,  '#04060f', '#0b1226', '#8fa6ff', .18, .16, 260],
  [5,  '#0a1030', '#2a2a4a', '#8fa6ff', .18, .16, 300],
  [6.2,'#3a4d86', '#f2a468', '#ffb56b', 1.1, .38, 380],
  [8,  '#4a86d6', '#cfe2f3', '#fff1d6', 2.4, .6, 620],
  [12, '#3676d4', '#bcd8f5', '#ffffff', 3.0, .7, 760],
  [17, '#3e78c8', '#d8dccb', '#ffe2b0', 2.5, .62, 700],
  [19, '#3b3a78', '#ff8f55', '#ff8a4a', 1.1, .4, 440],
  [20.3,'#0c1230', '#3a2c4a', '#8fa6ff', .2, .18, 300],
  [24, '#04060f', '#0b1226', '#8fa6ff', .18, .16, 260],
].map(k => ({ t: k[0], top: new THREE.Color(k[1]), bot: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), i: k[4], a: k[5], far: k[6] }));

function cloudTexture(size = 256) {
  const n = makeNoise(4242), c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = fbm(n, x * .022, y * .022, 5, 2, .52) * .5 + .5, o = (y * size + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.max(0, Math.min(255, v * 255)); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping; tex.colorSpace = THREE.NoColorSpace; return tex;
}

export class Sky {
  constructor(scene) {
    this.scene = scene; this.hour = 9; this.time = 0; this.cover = .5;
    this.uniforms = {
      top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() },
      night: { value: 0 }, clouds: { value: cloudTexture() }, time: { value: 0 }, cover: { value: .5 },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.uniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top, bottom, sunDir, sunColor; uniform float night, time, cover; uniform sampler2D clouds;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          vec3 d = normalize(vP); float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
          vec3 col = mix(bottom, top, t);
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.28 + pow(sd, 3.0) * 0.06);
          vec3 cell = floor(d * 260.0); float star = step(0.9975, h(cell)) * night * smoothstep(0.02, 0.3, d.y);
          col += vec3(star);
          if (d.y > 0.01) {
            vec2 uv = d.xz / (d.y + 0.16) * 0.42 + vec2(time * 0.0035, time * 0.0018);
            float c = texture2D(clouds, uv).r * 0.7 + texture2D(clouds, uv * 2.7 + 3.1).r * 0.3;
            float dens = smoothstep(cover, cover + 0.28, c) * smoothstep(0.01, 0.2, d.y);
            float lit = 0.55 + 0.45 * pow(sd, 0.6);                                     // brighter toward the sun
            vec3 cloudCol = mix(bottom * 0.55 + vec3(0.06), vec3(1.0, 0.98, 0.95), (1.0 - night) * lit) + sunColor * pow(sd, 6.0) * 0.5;
            cloudCol *= mix(1.0, 0.35, night);
            col = mix(col, cloudCol, dens * 0.92);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    this.envScene = new THREE.Scene(); this.envScene.add(new THREE.Mesh(this.dome.geometry, this.dome.material));      // used to build image-based lighting
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 320 });
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .6;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x3a3226, .6); scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xaaccee, 60, 600);
  }
  set(hour) { this.hour = ((hour % 24) + 24) % 24; }
  update(dt, focus, cam) {
    this.time += dt; this.uniforms.time.value = this.time;
    const h = this.hour; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].t <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], w = (h - a.t) / (b.t - a.t);
    this.uniforms.top.value.copy(a.top).lerp(b.top, w); this.uniforms.bottom.value.copy(a.bot).lerp(b.bot, w); this.uniforms.sunColor.value.copy(a.sun).lerp(b.sun, w);
    const inten = a.i + (b.i - a.i) * w, amb = a.a + (b.a - a.a) * w, far = a.far + (b.far - a.far) * w;
    const ang = (h - 6) / 24 * Math.PI * 2, dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), .35).normalize();
    this.uniforms.sunDir.value.copy(dir); this.uniforms.night.value = Math.max(0, Math.min(1, -dir.y * 4 + .3)); this.uniforms.cover.value = this.cover;
    const src = dir.y > -.05 ? dir : dir.clone().negate();
    this.sun.position.copy(focus).addScaledVector(src, 160); this.sun.target.position.copy(focus);
    this.sun.color.copy(this.uniforms.sunColor.value); this.sun.intensity = inten * (1 - this.cover * .18);
    this.hemi.intensity = amb * 2.2; this.hemi.color.copy(this.uniforms.top.value).lerp(new THREE.Color(1, 1, 1), .35);
    this.scene.fog.color.copy(this.uniforms.bottom.value).lerp(this.uniforms.top.value, .15);
    this.scene.fog.near = 40; this.scene.fog.far = far;
    this.dome.position.copy(cam.position);
  }
}
