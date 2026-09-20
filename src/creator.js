// Character creator: live 3D preview + customisation panel. Saves the look in localStorage ('openworld.character.v1').
import * as THREE from 'three';
import { GltfBody, DEFAULT_CHAR } from './character.js';
import { AnimalLibrary } from './animals.js';
import { buildSaddle, DEFAULT_HORSE, HORSE_MODELS } from './horse.js';

export const CHAR_KEY = 'openworld.character.v1';
export const loadSavedLook = () => { try { const s = localStorage.getItem(CHAR_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
export const saveLook = cfg => { try { const { name, outfit, hood, pauldron, hair, beard, skinTone, hairColor, tint, hat, hatColor, holster, rifle, scarf, scarfColor, height, horse } = cfg; localStorage.setItem(CHAR_KEY, JSON.stringify({ name, outfit, hood, pauldron, hair, beard, skinTone, hairColor, tint, hat, hatColor, holster, rifle, scarf, scarfColor, height, horse })); } catch { } };

const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const PALETTES = { hair: ['#1e1510', '#4a3320', '#7a5230', '#b58a4b', '#d8c9a3', '#8a8a8a', '#a33b20'], cloth: ['#b9a78c', '#8f8064', '#6f7a86', '#7f7357', '#a08f70', '#5c6b4a', '#7a3f2e', '#3a3f4a'], hat: ['#3d2f22', '#26221e', '#6b5a3a', '#8a7a4a', '#5a3a26', '#4a4f57'], scarf: ['#8a3b2e', '#2f4b6b', '#d8c9a3', '#3d5a3a', '#1e1e22', '#b58a2b'], coat: ['#ffffff', '#d9b98d', '#b08a5e', '#8a6a4a', '#5a4030', '#2b2320', '#9a9a9a'], saddle: ['#6b3f22', '#3a2a1e', '#8a5a2b', '#2e2e34', '#7a2f2a', '#c8b48a'] };

export class CharacterCreator {
  constructor(root, assets, onDone) {
    this.root = root; this.assets = assets; this.onDone = onDone; this.active = false;
    this.cfg = { ...DEFAULT_CHAR, ...(loadSavedLook() || {}) }; this.cfg.horse = { ...DEFAULT_HORSE, ...(this.cfg.horse || {}) }; this.tab = 'char'; this.lib = new AnimalLibrary();
    this.build();
  }
  build(keepView = false) {
    this.root.replaceChildren(); let view = this.view;
    const panel = el('div', { class: 'cc-panel' }); if (!(keepView && view)) { view = this.view = el('div', { class: 'cc-view' }); this.canvas = el('canvas'); view.append(this.canvas, el('div', { class: 'cc-hint' }, 'Arrastra para girar · rueda para acercar')); }
    this.root.append(panel, view);
    panel.append(el('h2', {}, this.tab === 'char' ? 'CREAR PERSONAJE' : 'TU CABALLO'));
    panel.append(el('div', { class: 'tabs', style: 'margin:0 0 10px;justify-content:flex-start' }, ...[['char', 'Personaje'], ['horse', 'Caballo']].map(([k, l]) => el('button', { class: this.tab === k ? 'on' : '', type: 'button', onclick: () => { this.tab = k; this.build(true); this.showTab(); } }, l))));
    if (this.tab === 'horse') { this.buildHorsePanel(panel); return; }
    const name = el('input', { type: 'text', maxlength: 18, value: this.cfg.name, placeholder: 'Nombre' }); name.addEventListener('input', () => { this.cfg.name = name.value.trim() || 'Forastero'; });
    panel.append(this.field('Nombre', name));
    const sel = (key, opts) => { const s = el('select', {}, opts.map(([v, l]) => el('option', { value: v }, l))); s.value = String(this.cfg[key]); s.addEventListener('change', () => this.set({ [key]: s.value })); return s; };
    const chk = (label, key) => { const c = el('input', { type: 'checkbox' }); c.checked = !!this.cfg[key]; c.addEventListener('change', () => this.set({ [key]: c.checked })); return el('label', { class: 'cc-chk' }, c, ' ' + label); };
    const range = (label, key, min, max, step) => { const i = el('input', { type: 'range', min, max, step, value: this.cfg[key] }); i.addEventListener('input', () => this.set({ [key]: +i.value }, false)); return this.field(label, i); };
    const swatches = (label, key, list) => { const row = el('div', { class: 'cc-sw' }); list.forEach(c => { const b = el('button', { class: 'cc-color', style: `background:${c}`, title: c, type: 'button' }); b.addEventListener('click', () => { this.set({ [key]: c }); [...row.children].forEach(x => x.classList.toggle('on', x === b)); }); if (c.toLowerCase() === String(this.cfg[key]).toLowerCase()) b.classList.add('on'); row.append(b); }); return this.field(label, row); };
    panel.append(range('Tono de piel', 'skinTone', 0, 1, .01), range('Altura', 'height', .9, 1.08, .005),
      el('h3', {}, 'Pelo'), this.field('Peinado', sel('hair', [['SimpleParted', 'Raya al lado'], ['Buzzed', 'Rapado'], ['Long', 'Largo'], ['Buns', 'Moños'], ['none', 'Sin pelo']])), swatches('Color', 'hairColor', PALETTES.hair), chk('Barba', 'beard'),
      el('h3', {}, 'Ropa'), this.field('Estilo', sel('outfit', [['peasant', 'Camisa y pantalón'], ['ranger', 'Cuero de explorador']])), swatches('Color de la ropa', 'tint', PALETTES.cloth),
      el('h3', {}, 'Accesorios'), chk('Sombrero de vaquero', 'hat'), swatches('Color del sombrero', 'hatColor', PALETTES.hat), chk('Pañuelo', 'scarf'), swatches('Color del pañuelo', 'scarfColor', PALETTES.scarf), chk('Cinturón y funda', 'holster'), chk('Rifle a la espalda', 'rifle'));
    panel.append(el('div', { class: 'cc-foot' }, el('button', { class: 'mbtn', onclick: () => { this.cfg = { ...DEFAULT_CHAR, horse: { ...DEFAULT_HORSE } }; this.build(); this.initScene(); } }, 'Restablecer'), el('button', { class: 'mbtn', onclick: () => this.finish(false) }, 'Volver'), el('button', { class: 'mbtn primary', onclick: () => this.finish(true) }, 'Guardar')));
  }
  buildHorsePanel(panel) {
    const H = this.cfg.horse, set = patch => { Object.assign(H, patch); this.refreshHorse(); };
    const name = el('input', { type: 'text', maxlength: 16, value: H.name }); name.addEventListener('input', () => { H.name = name.value.trim() || 'Trueno'; });
    const model = el('select', {}, Object.entries(HORSE_MODELS).map(([v, l]) => el('option', { value: v }, l))); model.value = H.model; model.addEventListener('change', () => set({ model: model.value }));
    const sw = (label, key, list) => { const row = el('div', { class: 'cc-sw' }); list.forEach(c => { const b = el('button', { class: 'cc-color' + (c.toLowerCase() === String(H[key]).toLowerCase() ? ' on' : ''), style: `background:${c}`, type: 'button' }); b.addEventListener('click', () => { set({ [key]: c }); [...row.children].forEach(x => x.classList.toggle('on', x === b)); }); row.append(b); }); return this.field(label, row); };
    panel.append(this.field('Nombre', name), this.field('Raza', model), sw('Pelaje (tinte)', 'tint', PALETTES.coat), sw('Silla de montar', 'saddle', PALETTES.saddle), el('p', { style: 'font:12px system-ui,sans-serif;color:#a89a7c;line-height:1.5' }, 'En el juego: Q silba a tu caballo · E monta y desmonta · W/S acelerar y frenar · A/D girar · C paso · Shift galope.'));
    panel.append(el('div', { class: 'cc-foot' }, el('button', { class: 'mbtn', onclick: () => this.finish(false) }, 'Volver'), el('button', { class: 'mbtn primary', onclick: () => this.finish(true) }, 'Guardar')));
  }
  async refreshHorse() {
    if (!this.scene) return; const H = this.cfg.horse, token = this._ht = (this._ht || 0) + 1;
    const o = await this.lib.spawn(H.model, H.tint !== '#ffffff' ? H.tint : null); if (!o || token !== this._ht || !this.scene) return;
    if (this.horse) this.scene.remove(this.horse.root); const hg = this.lib.models.get(H.model)?.hgt || 1.5; const sd = buildSaddle(H.saddle); sd.position.set(0, hg * .68, 0); o.root.add(sd);
    o.act.idle?.play(); this.horse = o; this.scene.add(o.root); o.root.visible = this.tab === 'horse';
  }
  showTab() { if (!this.body) return; this.body.root.visible = this.tab === 'char'; if (this.horse) this.horse.root.visible = this.tab === 'horse'; if (this.tab === 'horse' && !this.horse) this.refreshHorse(); this.dist = this.tab === 'horse' ? 6.2 : 4.6; }
  field(label, control) { return el('div', { class: 'cc-field' }, el('label', {}, label), control); }
  initScene() {
    this.dispose(); const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true }); r.toneMapping = THREE.ACESFilmicToneMapping; r.setClearColor(0x000000, 0); r.shadowMap.enabled = true;
    const s = this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
    s.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a38, 1.5)); const key = new THREE.DirectionalLight(0xfff0dc, 3.2); key.position.set(2.5, 4, 3.5); key.castShadow = true; s.add(key); const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-3, 2.5, -3); s.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshStandardMaterial({ color: 0x2a2116, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    this.body = new GltfBody(this.assets, this.cfg); s.add(this.body.root); this.body.play('Idle_Loop', 0); this.horse = null; this.showTab();
    this.yaw = .5; this.dist = 4.6; let drag = null; const c = this.canvas;
    c.onmousedown = e => drag = e.clientX; addEventListener('mouseup', this._up = () => drag = null);
    addEventListener('mousemove', this._mv = e => { if (drag != null) { this.yaw -= (e.clientX - drag) * .01; drag = e.clientX; } });
    c.onwheel = e => { this.dist = Math.max(1.8, Math.min(6, this.dist * (1 + Math.sign(e.deltaY) * .08))); e.preventDefault(); };
  }
  set(patch, rebuild = true) {
    Object.assign(this.cfg, patch); if (!this.body) return;
    if ('height' in patch && !rebuild) { this.body.cfg.height = this.cfg.height; return; }
    this.body.setConfig(this.cfg); this.body.play('Idle_Loop', 0);
  }
  open() { this.tab = 'char'; this.cfg.horse = { ...DEFAULT_HORSE, ...(this.cfg.horse || {}) }; this.active = true; this.root.classList.remove('hidden'); this.build(); this.initScene(); }
  finish(save) { if (save) saveLook(this.cfg); this.active = false; this.root.classList.add('hidden'); this.dispose(); this.onDone?.(save ? this.cfg : null); }
  dispose() { if (this.renderer) { this.renderer.dispose(); this.renderer = null; } removeEventListener('mouseup', this._up); removeEventListener('mousemove', this._mv); this.body = null; this.horse = null; this._ht = (this._ht || 0) + 1; }
  update(dt) {
    if (!this.active || !this.renderer) return;
    const p = this.canvas.parentElement, w = p.clientWidth, h = p.clientHeight; if (this.canvas.width !== Math.floor(w * devicePixelRatio) || this.canvas.height !== Math.floor(h * devicePixelRatio)) { this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.tab === 'horse') this.horse?.mixer.update(Math.min(dt, .05)); else this.body.update(Math.min(dt, .05)); this.body.root.scale.setScalar(.92 * (this.cfg.height || 1));
    this.camera.position.set(Math.sin(this.yaw) * this.dist, 1.15, Math.cos(this.yaw) * this.dist); this.camera.lookAt(0, this.tab === 'horse' ? .85 : 1.0, 0); this.renderer.render(this.scene, this.camera);
  }
}
