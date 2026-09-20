// Ambient life: a flock of birds circling above the player, plus drifting pollen/dust motes near the camera.
import * as THREE from 'three';

export class Birds {
  constructor(scene, n = 14) {
    this.birds = []; this.group = new THREE.Group(); scene.add(this.group);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1b1a19, side: THREE.DoubleSide });
    const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .12, 0, 0, -.12, 1.1, .05, -.05], 3));
    const body = new THREE.BoxGeometry(.12, .1, .5);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(), b = new THREE.Mesh(body, mat), l = new THREE.Group(), r = new THREE.Group();
      const wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat); wr.scale.x = -1; l.add(wl); r.add(wr); l.position.x = .05; r.position.x = -.05;
      g.add(b, l, r); g.scale.setScalar(1.6 + Math.random() * .8); this.group.add(g);
      this.birds.push({ g, l, r, a: Math.random() * 6.28, rad: 25 + Math.random() * 45, alt: 22 + Math.random() * 26, sp: .12 + Math.random() * .14, ph: Math.random() * 6.28, fl: 5 + Math.random() * 3, ox: (Math.random() - .5) * 40, oz: (Math.random() - .5) * 40 });
    }
  }
  update(dt, t, center, day) {
    this.group.visible = day > .15;
    if (!this.group.visible) return;
    for (const b of this.birds) {
      b.a += b.sp * dt; const x = center.x + b.ox + Math.cos(b.a) * b.rad, z = center.z + b.oz + Math.sin(b.a) * b.rad, y = center.y + b.alt + Math.sin(t * .3 + b.ph) * 3;
      const dx = -Math.sin(b.a), dz = Math.cos(b.a); b.g.position.set(x, y, z); b.g.rotation.set(0, Math.atan2(dx, dz), Math.sin(t * .7 + b.ph) * .25);
      const flap = Math.sin(t * b.fl + b.ph) * .7 * (Math.sin(t * .35 + b.ph) > .3 ? .15 : 1);          // periodic gliding
      b.l.rotation.z = flap; b.r.rotation.z = -flap;
    }
  }
}
