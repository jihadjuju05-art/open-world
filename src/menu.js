// In-game pause menu (Esc): resume, settings (graphics / game / audio / diagnostics), controls, exit.
import { PRESETS, applyPreset, saveSettings, DEFAULTS } from './settings.js';
import { fmtPlay } from './save.js';

const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

export class GameMenu {
  constructor(settings, hooks) {
    this.s = settings; this.h = hooks; this.open = false; this.page = 'main'; this.tab = 'gfx';
    this.root = el('div', { id: 'menu', class: 'hidden' }); document.body.append(this.root);
    addEventListener('keydown', e => { if (e.code === 'Escape' && !this.hooks_blockEsc()) { e.preventDefault(); this.toggle(); } });
    this.diagT = setInterval(() => { if (this.open && this.page === 'settings' && this.tab === 'diag') this.refreshDiag(); }, 500);
  }
  hooks_blockEsc() { return this.h.blockEsc ? this.h.blockEsc() : false; }
  toggle() { this.open ? this.close() : this.show(); }
  show(page = 'main') { this.open = true; this.page = page; this.root.classList.remove('hidden'); document.exitPointerLock?.(); this.h.onOpen?.(); this.render(); }
  close() { this.open = false; this.root.classList.add('hidden'); this.h.onClose?.(); }
  change(fn, save = true) { fn(); if (save) saveSettings(this.s); this.h.onChange?.(this.s); }

  render() {
    this.root.replaceChildren();
    const box = el('div', { class: 'menu-box' });
    if (this.page === 'main') this.renderMain(box); else if (this.page === 'saves') this.renderSaves(box); else if (this.page === 'settings') this.renderSettings(box); else if (this.page === 'controls') this.renderControls(box); else if (this.page === 'exit') this.renderExit(box);
    this.root.append(box);
  }
  renderMain(b) {
    b.append(el('h1', {}, 'PAUSA'), el('div', { class: 'sub' }, 'Open World'),
      this.btn('Continuar', () => this.close(), 'primary'), this.btn('Mapa  (M)', () => { this.close(); this.h.onMap?.(); }), this.btn('Guardar / cargar partida', () => { this.page = 'saves'; this.render(); }), this.btn('Ajustes', () => { this.page = 'settings'; this.render(); }),
      this.btn('Controles', () => { this.page = 'controls'; this.render(); }), this.btn('Salir del juego', () => { this.page = 'exit'; this.render(); }, 'danger'));
  }
  renderExit(b) {
    b.append(el('h1', {}, '¿Salir del juego?'), el('div', { class: 'sub' }, 'Se guardan tus ajustes. Guarda la partida antes si quieres conservar tu progreso.'),
      this.btn('Sí, salir', () => { this.h.onExit?.(); }, 'danger'), this.btn('Volver', () => { this.page = 'main'; this.render(); }));
  }
  renderSaves(b) {
    const S = this.h.saves, started = this.h.isStarted?.(); b.classList.add('wide'); if (!document.getElementById('savecss')) document.head.append(Object.assign(document.createElement('style'), { id: 'savecss', textContent: '.sv{display:flex;gap:12px;align-items:center;padding:10px;border:1px solid #4b3d26;margin:8px 0;background:#1c150d}.sv img,.sv .ph{width:112px;height:63px;object-fit:cover;background:#0d0a06;flex:none;border:1px solid #3b2e1c}.sv .t{flex:1;font:13px system-ui,sans-serif;color:#d9c9a0}.sv .t b{display:block;font:16px Georgia,serif;color:#e6c98a;margin-bottom:3px}.sv .bt{display:flex;flex-direction:column;gap:5px}.sv .bt button{padding:6px 12px;background:#3b2e1c;border:1px solid #6b5630;color:#f1e6cc;cursor:pointer;font:12px system-ui,sans-serif}.sv .bt button:hover{background:#6b4e1e}' }));
    b.append(el('h1', {}, 'PARTIDAS'), el('div', { class: 'sub' }, started ? 'Guarda o carga tu progreso (posición, vida, dinero, inventario, mejoras e historia)' : 'Elige la partida que quieres continuar'));
    for (const { id, meta } of S.slots()) {
      const d = meta ? new Date(meta.ts).toLocaleString('es') : '', btns = [];
      if (started && id !== 'auto') btns.push(el('button', { onclick: () => { S.write(id); this.h.onSaved?.(id); this.render(); } }, meta ? 'Sobrescribir' : 'Guardar aquí'));
      if (meta) btns.push(el('button', { onclick: () => { this.h.onLoad?.(id); } }, 'Cargar'));
      if (meta && id !== 'auto') btns.push(el('button', { onclick: () => { if (confirm('¿Borrar esta partida?')) { S.remove(id); this.render(); } } }, 'Borrar'));
      b.append(el('div', { class: 'sv' }, meta?.thumb ? el('img', { src: meta.thumb }) : el('div', { class: 'ph' }),
        el('div', { class: 't' }, el('b', {}, id === 'auto' ? 'Autoguardado' : 'Ranura ' + id), meta ? `${meta.name || 'Forastero'} · ${meta.region || '—'}` : 'Vacía', meta ? el('br') : null, meta ? `◎ ${meta.money ?? 0} · ${fmtPlay(meta.play)} · ${d}` : ''), el('div', { class: 'bt' }, btns)));
    }
    b.append(el('div', { class: 'foot' }, this.btn('Volver', () => { if (started) { this.page = 'main'; this.render(); } else this.close(); }, 'primary')));
  }
  btn(label, fn, cls = '') { return el('button', { class: 'mbtn ' + cls, onclick: fn, type: 'button' }, label); }

  // --- settings
  renderSettings(b) {
    const tabs = [['gfx', 'Gráficos'], ['game', 'Juego'], ['audio', 'Audio'], ['diag', 'Diagnóstico']];
    b.classList.add('wide');
    b.append(el('h1', {}, 'AJUSTES'), el('div', { class: 'tabs' }, tabs.map(([id, label]) => el('button', { class: id === this.tab ? 'on' : '', onclick: () => { this.tab = id; this.render(); } }, label))));
    const body = el('div', { class: 'body' }); b.append(body);
    if (this.tab === 'gfx') this.tabGfx(body); else if (this.tab === 'game') this.tabGame(body); else if (this.tab === 'audio') this.tabAudio(body); else this.tabDiag(body);
    b.append(el('div', { class: 'foot' }, this.btn('Restablecer', () => this.change(() => { Object.assign(this.s, DEFAULTS); this.render(); })), this.btn('Volver', () => { this.page = 'main'; this.render(); }, 'primary')));
  }
  row(label, control, hint) { return el('div', { class: 'row' }, el('div', { class: 'lab' }, label, hint ? el('small', {}, hint) : null), control); }
  slider(key, min, max, step, fmt = v => v, after) {
    const val = el('span', { class: 'val' }, fmt(this.s[key])), i = el('input', { type: 'range', min, max, step, value: this.s[key] });
    i.addEventListener('input', () => { this.change(() => { this.s[key] = +i.value; if (after) after(); }); val.textContent = fmt(this.s[key]); });
    return el('div', { class: 'ctl' }, i, val);
  }
  toggle_(key, after) { const c = el('input', { type: 'checkbox' }); c.checked = !!this.s[key]; c.addEventListener('change', () => this.change(() => { this.s[key] = c.checked; if (after) after(); })); return el('label', { class: 'sw' }, c, el('span', {})); }
  select(key, opts, after) {
    const s = el('select', {}, opts.map(([v, l]) => el('option', { value: v }, l))); s.value = this.s[key]; s.addEventListener('change', () => this.change(() => { const v = s.value; this.s[key] = isNaN(+v) || v === '' ? v : +v; if (after) after(v); })); return s;
  }
  custom() { this.s.preset = 'personalizado'; }
  tabGfx(b) {
    const preset = el('select', {}, [...Object.keys(PRESETS), 'personalizado'].map(p => el('option', { value: p }, p[0].toUpperCase() + p.slice(1))));
    preset.value = this.s.preset; preset.addEventListener('change', () => { if (preset.value !== 'personalizado') this.change(() => { applyPreset(this.s, preset.value); this.render(); }); });
    b.append(this.row('Calidad gráfica', preset, 'Los presets cambian todo lo de abajo de una vez'),
      this.row('Escala de resolución', this.slider('resScale', .5, 2, .05, v => Math.round(v * 100) + '%', () => this.custom()), 'Máximo; con resolución dinámica baja sola si hace falta'),
      this.row('Resolución dinámica', this.toggle_('adaptive'), 'Baja la resolución si los fps caen'),
      this.row('Límite de fps', this.slider('fpsCap', 20, 241, 1, v => v > 240 ? 'Sin límite' : v + ' fps'), 'Limita los fotogramas por segundo (ahorra batería y calor). El máximo es sin límite'),
      this.row('Distancia de visión', this.slider('viewRadius', 3, 10, 1, v => v * 64 + ' m', () => this.custom()), 'Más distancia = más carga'),
      this.row('Sombras', this.select('shadows', [[0, 'Desactivadas'], [1024, 'Medias (1024)'], [2048, 'Altas (2048)'], [4096, 'Ultra (4096)']], () => this.custom())),
      this.row('Distancia de sombras', this.slider('shadowRing', 1, 3, .05, v => Math.round(v * 64) + ' m', () => this.custom())),
      this.row('Hierba', this.toggle_('grass', () => this.custom())),
      this.row('Densidad de hierba', this.slider('grassDensity', .1, 1, .05, v => Math.round(v * 100) + '%', () => this.custom())),
      this.row('Campo de visión', this.slider('fov', 45, 90, 1, v => v + '°')),
      this.row('Mostrar información en pantalla', this.toggle_('showHud')), this.row('Mostrar minimapa', this.toggle_('showMinimap')));
  }
  tabGame(b) {
    b.append(this.row('Sensibilidad del ratón', this.slider('sens', .3, 2.5, .05, v => v.toFixed(2))), this.row('Invertir eje Y', this.toggle_('invertY')),
      this.row('Distancia de la cámara', this.slider('camDist', 2.5, 10, .1, v => v.toFixed(1) + ' m')), this.row('Duración de un día', this.slider('dayLength', 5, 120, 1, v => v + ' min'), 'Minutos reales que dura un día completo'));
  }
  tabAudio(b) {
    b.append(this.row('Volumen general', this.slider('volMaster', 0, 1, .01, v => Math.round(v * 100) + '%')), this.row('Ambiente (viento, agua, pájaros)', this.slider('volAmbient', 0, 1.5, .01, v => Math.round(v * 100) + '%')), this.row('Efectos (pasos)', this.slider('volFx', 0, 1.5, .01, v => Math.round(v * 100) + '%')));
  }
  tabDiag(b) { this.diagBox = el('div', { class: 'diag' }); b.append(this.diagBox); this.refreshDiag(); }
  refreshDiag() {
    if (!this.diagBox) return; const d = this.h.getDiag ? this.h.getDiag() : {};
    const line = (k, v, warn) => el('div', { class: 'dl' + (warn ? ' warn' : '') }, el('span', {}, k), el('b', {}, v));
    this.diagBox.replaceChildren(
      line('Tarjeta gráfica', d.gpu || '—', d.software), d.software ? el('div', { class: 'warnbox' }, 'El navegador está renderizando por SOFTWARE, no por tu tarjeta. Activa "Usar aceleración por hardware" en los ajustes del navegador (Sistema) y reinicia. Esto explica los fps bajos con un buen PC.') : null,
      line('FPS', d.fps != null ? d.fps.toFixed(0) : '—'), line('Tiempo de CPU (JS) por fotograma', d.cpu != null ? d.cpu.toFixed(1) + ' ms' : '—', d.cpu > 14),
      line('Tiempo de GPU por fotograma', d.gpu_ms != null ? d.gpu_ms.toFixed(1) + ' ms' : 'no disponible en este navegador', d.gpu_ms > 14),
      line('Resolución actual', d.res != null ? Math.round(d.res * 100) + '%' : '—'), line('Draw calls', d.calls ?? '—'), line('Triángulos', d.tris != null ? (d.tris / 1000).toFixed(0) + 'k' : '—'),
      line('Chunks cargados', d.chunks ?? '—'), line('Geometrías / texturas en memoria', d.mem || '—'),
      el('div', { class: 'tag' }, 'Si CPU > 14 ms el límite es el procesador o el código; si GPU > 14 ms el límite es la tarjeta: baja calidad, sombras o distancia.'));
  }
  renderControls(b) {
    const rows = [['W A S D', 'Mover'], ['Shift', 'Correr'], ['C', 'Caminar'], ['Espacio', 'Saltar'], ['Ratón', 'Cámara (clic para capturar)'], ['Rueda', 'Zoom de cámara'], ['R', 'Sacar / guardar la espada'], ['Clic izq.', 'Atacar (mantén: golpe fuerte)'], ['Clic der.', 'Bloquear (justo antes del golpe = parada)'], ['V', 'Esquivar'], ['E', 'Hablar / usar / montar / abrir'], ['Q', 'Llamar al caballo'], ['I', 'Inventario'], ['J', 'Diario de misiones'], ['M', 'Mapa'], ['1-6', 'Emociones'], ['Esc', 'Pausa / menú'], ['[  ]', 'Cambiar la hora'], ['P', 'Pausar el tiempo'], ['H', 'Ocultar ayuda']];
    b.append(el('h1', {}, 'CONTROLES'), el('div', { class: 'keys' }, rows.map(([k, v]) => el('div', { class: 'kr' }, el('kbd', {}, k), el('span', {}, v)))), this.btn('Volver', () => { this.page = 'main'; this.render(); }, 'primary'));
  }
}
