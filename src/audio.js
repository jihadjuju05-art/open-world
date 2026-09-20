// Procedural ambience with WebAudio (no audio files): wind, running water, crickets at night, bird calls and footsteps.
export class Ambience {
  constructor() { this.ctx = null; this.t = 0; this.nextChirp = 3; this.vol = { master: .7, ambient: 1, fx: 1 }; }
  setVolumes(master, ambient, fx) { this.vol = { master, ambient, fx }; if (this.ctx) { this.master.gain.value = master; this.amb.gain.value = ambient; this.fxBus.gain.value = fx; } }
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = this.master = ctx.createGain(); master.gain.value = this.vol.master; master.connect(ctx.destination);
      this.amb = ctx.createGain(); this.amb.gain.value = this.vol.ambient; this.amb.connect(master); this.fxBus = ctx.createGain(); this.fxBus.gain.value = this.vol.fx; this.fxBus.connect(master);
      const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2 + w * .15; }       // pinkish noise
      this.buf = buf;
      const loop = (freq, q, type) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.amb); s.start(0, Math.random() * 2); return { f, g }; };
      this.wind = loop(420, .5, 'lowpass'); this.water = loop(1100, .6, 'bandpass'); this.water2 = loop(2600, 1.2, 'bandpass');
      const osc = ctx.createOscillator(), am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), out = ctx.createGain(); osc.frequency.value = 4300; lfo.frequency.value = 22; lg.gain.value = .5; am.gain.value = .5;
      lfo.connect(lg).connect(am.gain); osc.connect(am).connect(out).connect(this.amb); out.gain.value = 0; osc.start(); lfo.start(); this.crickets = { g: out };
    } catch (e) { this.ctx = null; }
  }
  set(node, v, dt, k = 2) { if (node) node.gain.value += (v - node.gain.value) * Math.min(1, dt * k); }
  update(dt, { water = 0, hour = 12, speed = 0, wind = .5 }) {
    if (!this.ctx) return; this.t += dt; const night = hour < 5.5 || hour > 20.5 ? 1 : 0, day = 1 - night;
    const gust = .5 + .5 * Math.sin(this.t * .23) * Math.sin(this.t * .11 + 1);
    this.set(this.wind.g, .05 + .09 * gust * wind, dt, 1.2); this.wind.f.frequency.value = 300 + 500 * gust;
    this.set(this.water.g, .16 * water, dt); this.set(this.water2.g, .05 * water, dt);
    this.set(this.crickets.g, .018 * night, dt, .5);
    this.nextChirp -= dt;
    if (this.nextChirp <= 0 && day) { this.chirp(); this.nextChirp = 2 + Math.random() * 7; }
  }
  chirp() {
    const ctx = this.ctx, t0 = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 2400 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + i * .13; o.type = 'sine';
      o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .4), s + .09);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.022, s + .01); g.gain.exponentialRampToValueAtTime(.0001, s + .11); o.connect(g).connect(this.amb); o.start(s); o.stop(s + .13);
    }
  }
  footstep(wading = 0, run = 0) {
    if (!this.ctx) return; const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.buf; const f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    f.type = wading > .2 ? 'bandpass' : 'lowpass'; f.frequency.value = wading > .2 ? 900 : 420 + Math.random() * 240; f.Q.value = wading > .2 ? .8 : .6;
    const vol = (wading > .2 ? .32 : .2) * (.6 + run * .5); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + (wading > .2 ? .28 : .11));
    s.connect(f).connect(g).connect(this.fxBus); s.start(t, Math.random() * 2, .3);
  }
}
