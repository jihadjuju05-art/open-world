// Save games: an autosave plus three manual slots in localStorage. A save holds the position, health, time of day, money / inventory,
// weapon upgrades, story progress, looted containers and a small screenshot.
const KEY = id => 'openworld.save.' + id;
export const SLOT_IDS = ['auto', 1, 2, 3];

export class SaveManager {
  constructor(ctx) { this.c = ctx; this.lastAuto = 0; this.playBase = 0; }
  meta(id) {
    try { const d = JSON.parse(localStorage.getItem(KEY(id)) || 'null'); return d ? { id, ts: d.ts, name: d.name, region: d.region, money: d.money, play: d.play, thumb: d.thumb, stage: d.story?.stage } : null; } catch { return null; }
  }
  slots() { return SLOT_IDS.map(id => ({ id, meta: this.meta(id) })); }
  latest() { let best = null; for (const id of SLOT_IDS) { const m = this.meta(id); if (m && (!best || m.ts > best.ts)) best = m; } return best; }
  read(id) { try { return JSON.parse(localStorage.getItem(KEY(id)) || 'null'); } catch { return null; } }
  remove(id) { try { localStorage.removeItem(KEY(id)); } catch { } }
  collect() {
    const c = this.c, P = c.player.pos;
    return { v: 1, ts: Date.now(), name: c.getName(), region: c.getRegion(), play: this.playBase + c.getPlay(), hour: c.sky.hour, pos: { x: P.x, z: P.z, yaw: c.player.yaw }, hp: c.combat.hp, stamina: c.combat.stamina, money: c.economy.gold,
      inv: { ...c.houses.inv.items }, searched: [...c.houses.searched], economy: c.economy.snapshot(), story: c.story.snapshot(), thumb: c.capture?.() || null };
  }
  write(id) { try { localStorage.setItem(KEY(id), JSON.stringify(this.collect())); return true; } catch (e) { console.warn('save failed', e); return false; } }
  // Autosave: only when nothing is happening (no fight, no cutscene, no menu) and not more than once every 20 s.
  auto(reason) {
    const c = this.c, now = performance.now(); if (!c.started() || !c.combat.alive || c.combat.state !== 'free' || c.cine.active || c.isPaused() || c.net?.active || now - this.lastAuto < 20000) return false;
    this.lastAuto = now; const ok = this.write('auto'); if (ok) c.toast?.('Partida guardada', reason || 'Autoguardado'); return ok;
  }
  apply(d) {
    const c = this.c; if (!d) return false; const x = d.pos.x, z = d.pos.z;
    c.player.pos.set(x, c.terrain.height(x, z) + .3, z); c.player.yaw = d.pos.yaw || 0; if (c.player.vel?.set) c.player.vel.set(0, 0, 0);
    c.combat.gearHp = 0; c.combat.gearSta = 0; c.combat.reset(); c.combat.alive = true; c.combat.body?.endAction?.();
    c.houses.inv.items = { ...d.inv }; c.houses.inv.save(); c.houses.searched = new Set(d.searched || []);
    c.economy.restore(d.economy); c.combat.hp = Math.min(c.combat.maxHp, Math.max(5, d.hp)); c.combat.stamina = Math.min(c.combat.maxStamina, d.stamina ?? c.combat.maxStamina);
    c.sky.set(d.hour); c.story.restore(d.story); this.playBase = d.play || 0; return true;
  }
  // brand new game: wipes progress (the character look and the settings stay)
  newGame() {
    const c = this.c; c.houses.inv.items = {}; c.houses.inv.save(); c.houses.searched = new Set(); c.combat.gearHp = 0; c.combat.gearSta = 0; c.combat.reset(); c.economy.restore(null); c.story.reset(); this.playBase = 0;
  }
}
export const fmtPlay = s => { const m = Math.floor((s || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
