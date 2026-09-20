import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
def edit(rel, pairs):
    path = os.path.join(root, rel); s = open(path, encoding='utf-8').read()
    for o, n in pairs:
        assert s.count(o) >= 1, (rel, o[:70], s.count(o)); s = s.replace(o, n)
    open(path, 'w', encoding='utf-8').write(s)

edit('src/combat.js', [
("export const EMOTES =", """// Every number the combat feel depends on lives here so the Studio can edit it (config/combat.json) without touching code.
export const TUNING = {
  player: { hp: 100, stamina: 100, regen: 24, regenBlock: 9, regenDelay: 1 },
  dodge: { speed: 7.5, iframes: .5, cost: 16, rate: 1.45, end: .82 },
  block: { parry: .25, hold: .38, rate: 2.2, lightCost: .8, heavyCost: 1.3, chip: .1 },
  stagger: { light: .35, heavy: .8 },
  enemy: { hp: 55, dmg: .6, bossHp: 260, bossDmg: .95, aggro: 20, reach: 1.95 },
};
export const DEFAULT_ATTACKS = JSON.parse(JSON.stringify({ light: LIGHT, heavy: HEAVY }));
export function applyTuning(t) {
  if (!t) return; for (const k of Object.keys(TUNING)) if (t[k]) Object.assign(TUNING[k], t[k]);
  if (t.light) t.light.forEach((a, i) => LIGHT[i] && Object.assign(LIGHT[i], a)); if (t.heavy) Object.assign(HEAVY, t.heavy);
}
export const currentTuning = () => JSON.parse(JSON.stringify({ ...TUNING, light: LIGHT, heavy: HEAVY }));
export const EMOTES ="""),
("this.hp = this.maxHp = 100; this.stamina = this.maxStamina = 100;", "this.hp = this.maxHp = TUNING.player.hp; this.stamina = this.maxStamina = TUNING.player.stamina;"),
("this.state === 'dodge' || this.stamina < 16) return;", "this.state === 'dodge' || this.stamina < TUNING.dodge.cost) return;"),
("this.stamina -= 16; this.regenDelay = .9; this.state = 'dodge'; this.t = 0; this.iframes = .5;", "this.stamina -= TUNING.dodge.cost; this.regenDelay = .9; this.state = 'dodge'; this.t = 0; this.iframes = TUNING.dodge.iframes;"),
("this.body.startAction('Roll', { rate: 1.45, fade: .06 });", "this.body.startAction('Roll', { rate: TUNING.dodge.rate, fade: .06 });"),
("if (this.blockT < .25) {", "if (this.blockT < TUNING.block.parry) {"),
("const cost = info.dmg * (info.heavy ? 1.3 : .8); this.stamina -= cost; this.regenDelay = 1.2; this.hp -= info.dmg * .1;", "const cost = info.dmg * (info.heavy ? TUNING.block.heavyCost : TUNING.block.lightCost); this.stamina -= cost; this.regenDelay = 1.2; this.hp -= info.dmg * TUNING.block.chip;"),
("this.stagT = heavy ? .8 : .35;", "this.stagT = heavy ? TUNING.stagger.heavy : TUNING.stagger.light;"),
("this.stamina + (this.state === 'block' ? 9 : 24) * dt", "this.stamina + (this.state === 'block' ? TUNING.player.regenBlock : TUNING.player.regen) * dt"),
("b.startAction('Sword_Block', { rate: 2.2, fade: .06 });", "b.startAction('Sword_Block', { rate: TUNING.block.rate, fade: .06 });"),
("if (b.actionProgress() > .38) for (const m of b.mixers) m.timeScale = 0;      // hold the guard pose", "if (b.actionProgress() > TUNING.block.hold) for (const m of b.mixers) m.timeScale = 0;      // hold the guard pose"),
("sp = 7.5 * (1 - p * .7)", "sp = TUNING.dodge.speed * (1 - p * .7)"),
("if (p >= .82) { this.state = 'free'; b.endAction(); }", "if (p >= TUNING.dodge.end) { this.state = 'free'; b.endAction(); }"),
])
edit('src/enemies.js', [
("import { LIGHT, HEAVY, bodySpheres, bladeHit, arcHit } from './combat.js';", "import { LIGHT, HEAVY, TUNING, bodySpheres, bladeHit, arcHit } from './combat.js';"),
("this.maxHp = this.boss ? 260 : 55;", "this.maxHp = this.boss ? TUNING.enemy.bossHp : TUNING.enemy.hp;"),
("d < (this.boss ? 0 : 20) && pc.alive", "d < (this.boss ? 0 : TUNING.enemy.aggro) && pc.alive"),
("Math.round(s.dmg * (this.boss ? .95 : .6) * h.mult)", "Math.round(s.dmg * (this.boss ? TUNING.enemy.bossDmg : TUNING.enemy.dmg) * h.mult)"),
("arcHit(this.pos, this.yaw, ps, 1.95, .5)", "arcHit(this.pos, this.yaw, ps, TUNING.enemy.reach, .5)"),
])
edit('src/main.js', [
("import { PlayerCombat, EMOTES } from './combat.js';", "import { PlayerCombat, EMOTES, applyTuning } from './combat.js';"),
("// ---------- combat ----------", "// ---------- combat ----------\napplyTuning(await fetch('config/combat.json').then(r => r.ok ? r.json() : null).catch(() => null));      // edited in the Studio"),
])
print('ok')
