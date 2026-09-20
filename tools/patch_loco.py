import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) == 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/player.js', [
("export const GAITS_GLTF = { walk: 1.5, jog: 4.4, run: 7.0 };", "export const GAITS_GLTF = { walk: 1.25, jog: 3.4, run: 5.6 };"),
("    this.graph.params.speed = this.speed; this.graph.params.grounded = this.grounded ? 1 : 0; this.graph.params.swim = swimming ? 1 : 0;\n    this.graph.update(dt); this.state = this.graph.state;",
 "    if (this.gltf) this.gltfLoco(dt, swimming);\n    else { this.graph.params.speed = this.speed; this.graph.params.grounded = this.grounded ? 1 : 0; this.graph.params.swim = swimming ? 1 : 0; this.graph.update(dt); this.state = this.graph.state; }"),
("if (this.grounded && input.jump && wading < .6 && !swimming) { this.vel.y = 6.6; this.grounded = false; }",
 "if (this.grounded && input.jump && wading < .6 && !swimming) { this.vel.y = 6.6 + Math.min(1.2, this.speed * .15); this.grounded = false; this.airT = 0; this.jumped = true; }"),
("  spawnNearOrigin() {", """  // Locomotion for the glTF character: gait chosen from the real ground speed with hysteresis, playback rate matched to each clip's natural
  // speed (never sped up much beyond 1.3x, which is what made the old cadence look frantic), and take-off / landing phases for jumps.
  gltfLoco(dt, swimming) {
    const b = this.gltf, s = this.speed, NAT = { walk: .95, jog: 3.3, run: 5.2, swim: 2.18 }, clamp = (v, a, c) => Math.max(a, Math.min(c, v));
    if (this.locoOnce > 0) { this.locoOnce -= dt; if (this.locoOnce <= 0) { this.locoOnce = 0; if (b.action && this.locoOwn) { b.endAction(); this.locoOwn = false; } } }
    if (b.action && !this.locoOwn) { this.state = 'action'; b.update(dt); return; }                          // combat / emote clips own the body
    const air = !this.grounded && !swimming; this.airT = air ? (this.airT || 0) + dt : 0;
    if (air && this.jumped && this.airT < .02) { b.startAction('Jump_Start', { rate: 1.9, fade: .05 }); this.locoOwn = true; this.locoOnce = .22; this.jumped = false; }
    if (!air && this.wasAir && this.wasAirT > .3 && !swimming) { b.startAction('Jump_Land', { rate: 1.7, fade: .05 }); this.locoOwn = true; this.locoOnce = .26; }
    this.wasAir = air; this.wasAirT = air ? this.airT : this.wasAirT;
    if (!this.locoOwn || !b.action) {
      let st = this.state === 'walk' ? 'walk' : this.state === 'jog' ? 'jog' : this.state === 'run' ? 'run' : 'idle';
      if (swimming) st = s > .3 ? 'swim' : 'swimIdle';
      else if (air) st = 'jump';
      else if (s < .12) st = 'idle';
      else if (st === 'idle') st = s < 2.0 ? 'walk' : s < 4.5 ? 'jog' : 'run';
      else if (st === 'walk') st = s < .1 ? 'idle' : s > 2.1 ? 'jog' : 'walk';
      else if (st === 'jog') st = s < 1.7 ? 'walk' : s > 4.6 ? 'run' : 'jog';
      else if (st === 'run') st = s < 4.1 ? 'jog' : 'run';
      else st = s < 2.0 ? 'walk' : s < 4.5 ? 'jog' : 'run';
      this.state = st; const c = b.cfg.states;
      const name = st === 'jump' ? c.jump : st === 'swimIdle' ? c.swimIdle : c[st], rate = st === 'walk' ? clamp(s / NAT.walk, .6, 1.4) : st === 'jog' ? clamp(s / NAT.jog, .7, 1.3) : st === 'run' ? clamp(s / NAT.run, .8, 1.25) : st === 'swim' ? clamp(s / NAT.swim, .5, 1.4) : 1;
      b.play(name, st === 'jump' ? .12 : .28, rate);
    }
    b.update(dt);
  }
  spawnNearOrigin() {"""),
])
print('ok')
