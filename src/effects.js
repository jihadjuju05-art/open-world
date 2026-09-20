// Water effects: expanding ripple rings on the surface and splash droplets.
import * as THREE from 'three';

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 62); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(.62, 'rgba(255,255,255,0)'); grad.addColorStop(.78, 'rgba(255,255,255,.95)'); grad.addColorStop(.9, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class WaterFX {
  constructor(scene, level = 0) {
    this.level = level; this.rings = []; const tex = ringTexture(), geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff }));
      m.visible = false; m.renderOrder = 6; scene.add(m); this.rings.push({ m, age: 1, life: 1, size: 1, op: .5 });
    }
    this.N = 220; this.pos = new Float32Array(this.N * 3).fill(-9999); this.vel = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.next = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.attr = g.attributes.position;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: .13, color: 0xe6f7ff, transparent: true, opacity: .85, depthWrite: false, sizeAttenuation: true })); this.points.frustumCulled = false; scene.add(this.points);
    this.rr = 0;
  }
  ring(x, z, size = 1.4, life = 1.3, op = .55) {
    const r = this.rings[this.rr++ % this.rings.length]; r.age = 0; r.life = life; r.size = size; r.op = op; r.m.position.set(x, this.level + .04, z); r.m.visible = true;
  }
  splash(x, z, n = 10, power = 1) {
    for (let i = 0; i < n; i++) {
      const k = this.next++ % this.N, a = Math.random() * 6.283, s = (.6 + Math.random() * 1.6) * power;
      this.pos[k * 3] = x + Math.cos(a) * .12; this.pos[k * 3 + 1] = this.level + .05; this.pos[k * 3 + 2] = z + Math.sin(a) * .12;
      this.vel[k * 3] = Math.cos(a) * s * .7; this.vel[k * 3 + 1] = (1.8 + Math.random() * 2.4) * power; this.vel[k * 3 + 2] = Math.sin(a) * s * .7; this.life[k] = .9;
    }
    this.ring(x, z, 1.2 + power * .6, 1.0, .6);
  }
  update(dt) {
    for (const r of this.rings) {
      if (r.age >= r.life) { r.m.visible = false; continue; }
      r.age += dt; const t = Math.min(1, r.age / r.life); r.m.scale.setScalar(r.size * (.25 + t * 1.6)); r.m.material.opacity = r.op * (1 - t) * (1 - t);
    }
    for (let k = 0; k < this.N; k++) {
      if (this.life[k] <= 0) continue; this.life[k] -= dt; this.vel[k * 3 + 1] -= 9.8 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      if (this.pos[k * 3 + 1] < this.level || this.life[k] <= 0) { this.life[k] = 0; this.pos[k * 3 + 1] = -9999; }
    }
    this.attr.needsUpdate = true;
  }
}
