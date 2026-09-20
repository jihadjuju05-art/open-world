// Player-facing settings with quality presets, persisted in localStorage.
export const PRESETS = {
  bajo:  { resScale: 1,   viewRadius: 4, shadows: 0,    shadowRing: 1.0, grass: false, grassDensity: 0,  grassRing: 1.0 },
  medio: { resScale: 1,   viewRadius: 5, shadows: 1024, shadowRing: 1.2, grass: true,  grassDensity: .5, grassRing: 1.3 },
  alto:  { resScale: 1.25, viewRadius: 7, shadows: 2048, shadowRing: 1.45, grass: true, grassDensity: 1,  grassRing: 1.6 },
  ultra: { resScale: 2,   viewRadius: 9, shadows: 4096, shadowRing: 2.2, grass: true,  grassDensity: 1,  grassRing: 2.4 },
};
export const DEFAULTS = { preset: 'alto', ...PRESETS.alto, adaptive: false, fpsCap: 241, fov: 60, sens: 1, invertY: false, camDist: 5.2, dayLength: 25, volMaster: .7, volAmbient: 1, volFx: 1, showHud: true, showMinimap: true };
const KEY = 'openworld.settings.v2';

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { } }
export function applyPreset(s, name) { Object.assign(s, PRESETS[name], { preset: name }); return s; }
