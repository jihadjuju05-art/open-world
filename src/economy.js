// Money and services: blacksmith (upgrades + blades), general store (buy / sell loot), doctor, bank and dice at the inn.
// Money is the "Monedas" item of the inventory. Everything here is saved with the game (see save.js).
export const MONEY = 'Monedas';

export const BLADES = {
  iron: { name: 'Espada de hierro', dmg: 1, rate: 1, price: 0, color: 0xc9ced4, len: 1, desc: 'La espada de siempre.' },
  saber: { name: 'Sable de acero', dmg: 1.15, rate: 1.08, price: 220, color: 0xe2e8f0, len: 1.04, desc: '+15% de daño y algo más rápido.' },
  broad: { name: 'Espadón del herrero', dmg: 1.38, rate: .9, price: 520, color: 0xa9b8d0, len: 1.16, desc: '+38% de daño, golpes más lentos.' },
  dawn: { name: 'Hoja del Alba', dmg: 1.6, rate: 1.05, price: 1400, color: 0x7ff5e6, len: 1.1, desc: '+60% de daño. Forjada con el brillo de las hoces.' },
};
export const UPGRADES = {
  sharp: { name: 'Afilar la hoja', max: 5, cost: [60, 120, 220, 380, 600], desc: '+8% de daño por nivel' },
  grip: { name: 'Empuñadura reforzada', max: 3, cost: [90, 180, 320], desc: '+12 de resistencia por nivel' },
  vest: { name: 'Chaleco de cuero', max: 3, cost: [100, 220, 420], desc: '-7% de daño recibido por nivel' },
  tonic: { name: 'Tónico del doctor', max: 3, cost: [80, 160, 300], desc: '+12 de vida máxima por nivel' },
};
// name -> { buy price (0 = not sold), sell price, description }
export const GOODS = {
  Pan: { buy: 4, sell: 1, desc: 'Recupera 15 de vida' }, Manzana: { buy: 3, sell: 1, desc: 'Recupera 8 de vida' }, Vendaje: { buy: 14, sell: 5, desc: 'Recupera 35 de vida' },
  Whisky: { buy: 10, sell: 4, desc: 'Un trago para el camino' }, Vela: { buy: 3, sell: 1, desc: 'Da algo de luz' }, Munición: { buy: 6, sell: 2, desc: 'Para armas que aún no existen' },
  'Reloj de bolsillo': { buy: 0, sell: 45, desc: 'Objeto de valor' }, 'Carta amarillenta': { buy: 0, sell: 15, desc: 'Papel viejo' }, 'Llave oxidada': { buy: 0, sell: 12, desc: 'No abre nada conocido' },
  'Piel de ciervo': { buy: 0, sell: 22, desc: 'Curtida y suave' }, Carne: { buy: 0, sell: 6, desc: 'Fresca' }, Trucha: { buy: 0, sell: 9, desc: 'Del río' }, 'Piel de lobo': { buy: 0, sell: 35, desc: 'Gruesa' },
};
const TOWN_MULT = [1.12, 1, .9, .9, 1];      // city, town, village, farm, camp
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `#shop{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#shop .box{width:min(560px,94vw);max-height:86vh;overflow:auto;padding:22px 26px;background:linear-gradient(#211a11,#17120c);border:1px solid #6b5630;box-shadow:0 0 0 4px #17120c,0 0 0 5px #4b3d26,0 20px 60px #000;font:14px system-ui,sans-serif;color:#f1e6cc}
#shop h2{margin:0;text-align:center;font:normal 26px Georgia,serif;letter-spacing:5px;color:#e6c98a}#shop .who{text-align:center;color:#a89a7c;margin:2px 0 10px;font:italic 13px Georgia,serif}
#shop .wal{display:flex;justify-content:center;gap:22px;margin:6px 0 12px;color:#e6c98a}#shop .wal b{color:#ffe08a}
#shop .tabs{display:flex;gap:6px;margin-bottom:10px}#shop .tabs button{flex:1;padding:8px;background:#2a2116;color:#d9c9a0;border:1px solid #5b4a2b;cursor:pointer;font:13px Georgia,serif;letter-spacing:2px;text-transform:uppercase}#shop .tabs button.on{background:#6b4e1e;border-color:#d9b26a;color:#fff}
#shop .row{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #2f2618}#shop .row .t{flex:1}#shop .row .t small{display:block;color:#a89a7c;margin-top:2px}#shop .row .p{color:#ffe08a;min-width:64px;text-align:right}
#shop button.act{padding:6px 12px;background:#3b2e1c;border:1px solid #6b5630;color:#f1e6cc;cursor:pointer;font:12px system-ui,sans-serif;letter-spacing:1px}#shop button.act:hover:not([disabled]){background:#6b4e1e}#shop button.act[disabled]{opacity:.4;cursor:default}
#shop .msg{min-height:20px;text-align:center;color:#e6c98a;margin:8px 0;font:italic 14px Georgia,serif}#shop .foot{text-align:center;margin-top:12px}
#shop .dice{font-size:44px;text-align:center;margin:10px 0;letter-spacing:12px}#shop .bets{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:6px 0}#shop .bets button.on{background:#6b4e1e;border-color:#d9b26a}
#money{position:fixed;left:calc(50% + min(180px,25vw) + 14px);bottom:22px;z-index:12;color:#ffe08a;font:600 15px Georgia,serif;letter-spacing:1px;text-shadow:0 1px 3px #000;pointer-events:none}#money i{font-style:normal;color:#a8e6a0;margin-left:6px;opacity:0;transition:opacity .4s}#money i.on{opacity:1}
body.cinema #money{display:none!important}`;

export class Economy {
  constructor({ inv, combat, toast, hooks = {}, sword }) {
    Object.assign(this, { inv, combat, toast, hooks, sword }); this.state = this.fresh(); this.view = null; this.justClosed = 0;
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    this.el = document.createElement('div'); this.el.id = 'shop'; this.el.className = 'hidden'; document.body.append(this.el);
    this.hudEl = document.createElement('div'); this.hudEl.id = 'money'; document.body.append(this.hudEl);
    this.el.addEventListener('click', e => { if (e.target === this.el) return this.close(); const b = e.target.closest('[data-act]'); if (b && !b.disabled) this.act(b.dataset.act, b.dataset); });
    addEventListener('keydown', e => { if (this.isOpen && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); } }, true);
    this.applyGear(true); this.hud();
  }
  fresh() { return { bank: 0, gear: { sharp: 0, grip: 0, vest: 0, tonic: 0 }, blades: ['iron'], blade: 'iron' }; }
  get isOpen() { return !!this.view; }
  get blockEsc() { return this.isOpen || performance.now() - this.justClosed < 250; }
  get gold() { return this.inv.items[MONEY] || 0; }
  snapshot() { return JSON.parse(JSON.stringify(this.state)); }
  restore(s) { this.state = { ...this.fresh(), ...(s || {}), gear: { ...this.fresh().gear, ...(s?.gear || {}) } }; if (!BLADES[this.state.blade]) this.state.blade = 'iron'; this.applyGear(true); this.hud(); }
  // ---- money
  pay(n) { if (this.gold < n) return false; this.inv.take(MONEY, n); this.hud(); return true; }
  earn(n, quiet) { this.inv.add(MONEY, n); this.hud(quiet ? 0 : n); }
  reward(e) { const n = e.valk ? 400 : e.boss ? 200 : 6 + Math.floor(Math.random() * 9); this.earn(n); if (e.boss) this.toast?.('Recompensa', `+${n} monedas`); }
  deathPenalty() { const lost = Math.floor(this.gold * .15); if (lost > 0) { this.inv.take(MONEY, lost); this.hud(); this.toast?.('Has perdido dinero', `-${lost} monedas (lo que guardas en el banco está a salvo)`); } }
  hud(gain = 0) { this.hudEl.innerHTML = `◎ ${this.gold}${this.state.bank ? ` <small style="opacity:.6">· banco ${this.state.bank}</small>` : ''}<i class="${gain ? 'on' : ''}">${gain ? '+' + gain : ''}</i>`; if (gain) { clearTimeout(this._h); this._h = setTimeout(() => this.hudEl.querySelector('i')?.classList.remove('on'), 1600); } }
  // ---- gear (applied to the combat system)
  applyGear(silent) {
    const g = this.state.gear, b = BLADES[this.state.blade] || BLADES.iron, c = this.combat; if (!c) return;
    const hp0 = c.gearHp || 0, st0 = c.gearSta || 0; c.gear = { dmg: b.dmg * (1 + g.sharp * .08), rate: b.rate, armor: g.vest * .07, hp: g.tonic * 12, sta: g.grip * 12 };
    c.maxHp += c.gear.hp - hp0; c.maxStamina += c.gear.sta - st0; c.gearHp = c.gear.hp; c.gearSta = c.gear.sta; if (!silent) { c.hp = Math.min(c.maxHp, c.hp + Math.max(0, c.gear.hp - hp0)); }
    this.sword?.(b.color, b.len);
  }
  // ---- windows
  price(p) { return Math.max(1, Math.round(p * this.mult)); }
  open(kind, npc) {
    const s = npc?.def?.settlement; this.mult = TOWN_MULT[s?.type ?? 1] ?? 1; this.view = { kind, npc, tab: kind === 'smith' ? 'up' : kind === 'store' ? 'buy' : 'main', bet: 10, dice: null, msg: '' }; this.hooks.onOpen?.(); this.render();
  }
  close() { if (!this.view) return; this.view = null; this.el.classList.add('hidden'); this.justClosed = performance.now(); this.hooks.onClose?.(); }
  say(m) { this.view.msg = m; this.render(); }
  render() {
    const v = this.view; if (!v) return; const T = { smith: 'HERRERÍA', store: 'TIENDA', doctor: 'DOCTOR', bank: 'BANCO', dice: 'DADOS' }[v.kind], tabs = { smith: [['up', 'Mejoras'], ['blades', 'Armas']], store: [['buy', 'Comprar'], ['sell', 'Vender']] }[v.kind];
    let body = ''; if (v.kind === 'smith') body = v.tab === 'up' ? this.smithUp() : this.smithBlades(); else if (v.kind === 'store') body = v.tab === 'buy' ? this.storeBuy() : this.storeSell(); else if (v.kind === 'doctor') body = this.doctor(); else if (v.kind === 'bank') body = this.bank(); else body = this.dice();
    this.el.innerHTML = `<div class="box"><h2>${T}</h2><div class="who">${esc(v.npc?.def?.name || '')}${v.npc?.def?.settlement ? ' · ' + esc(v.npc.def.settlement.name) : ''}</div><div class="wal"><span>Monedas <b>${this.gold}</b></span>${v.kind === 'bank' || this.state.bank ? `<span>Banco <b>${this.state.bank}</b></span>` : ''}</div>`
      + (tabs ? `<div class="tabs">${tabs.map(([id, l]) => `<button data-act="tab" data-id="${id}" class="${v.tab === id ? 'on' : ''}">${l}</button>`).join('')}</div>` : '') + body + `<div class="msg">${esc(v.msg || '')}</div><div class="foot"><button class="act" data-act="close">Salir</button></div></div>`;
    this.el.classList.remove('hidden');
  }
  row(t, sub, price, btn) { return `<div class="row"><div class="t">${t}<small>${sub}</small></div>${price != null ? `<div class="p">${price}</div>` : ''}${btn}</div>`; }
  btn(act, data, label, dis) { return `<button class="act" data-act="${act}" ${Object.entries(data).map(([k, x]) => `data-${k}="${esc(x)}"`).join(' ')} ${dis ? 'disabled' : ''}>${label}</button>`; }
  smithUp() {
    return Object.entries(UPGRADES).map(([k, u]) => { const lv = this.state.gear[k], maxed = lv >= u.max, p = maxed ? 0 : this.price(u.cost[lv]); return this.row(`${u.name} <small style="display:inline">(nivel ${lv}/${u.max})</small>`, u.desc, maxed ? 'MÁX' : p, this.btn('up', { k }, maxed ? 'Completo' : 'Mejorar', maxed || this.gold < p)); }).join('');
  }
  smithBlades() {
    return Object.entries(BLADES).map(([k, b]) => { const own = this.state.blades.includes(k), eq = this.state.blade === k, p = this.price(b.price); return this.row(esc(b.name), b.desc, own ? '' : p, own ? this.btn('equip', { k }, eq ? 'Equipada' : 'Equipar', eq) : this.btn('buyblade', { k }, 'Comprar', this.gold < p)); }).join('');
  }
  storeBuy() { return Object.entries(GOODS).filter(([, g]) => g.buy).map(([n, g]) => this.row(esc(n), g.desc, this.price(g.buy), this.btn('buy', { n }, 'Comprar', this.gold < this.price(g.buy)))).join(''); }
  storeSell() {
    const items = Object.entries(this.inv.items).filter(([n]) => n !== MONEY && GOODS[n]); if (!items.length) return '<p style="text-align:center;color:#a89a7c">No llevas nada que vender. Registra casas, cajones y campamentos.</p>';
    return items.map(([n, q]) => { const p = Math.max(1, Math.round(GOODS[n].sell * (this.mult >= 1 ? 1 : .9))); return this.row(`${esc(n)} <small style="display:inline">×${q}</small>`, GOODS[n].desc, p + ' c/u', this.btn('sell', { n, all: 0 }, 'Vender 1') + ' ' + this.btn('sell', { n, all: 1 }, 'Todo')); }).join('');
  }
  doctor() {
    const c = this.combat, miss = Math.ceil(c.maxHp - c.hp), cure = miss > 0 ? this.price(Math.max(5, Math.ceil(miss / 2))) : 0;
    return this.row('Curar heridas', miss > 0 ? `Te faltan ${miss} de vida` : 'Estás sano', miss > 0 ? cure : '', this.btn('cure', {}, 'Curar', miss <= 0 || this.gold < cure))
      + this.row('Vendaje', 'Recupera 35 de vida', this.price(GOODS.Vendaje.buy), this.btn('buy', { n: 'Vendaje' }, 'Comprar', this.gold < this.price(GOODS.Vendaje.buy)))
      + (() => { const u = UPGRADES.tonic, lv = this.state.gear.tonic, maxed = lv >= u.max, p = maxed ? 0 : this.price(u.cost[lv]); return this.row(`${u.name} <small style="display:inline">(nivel ${lv}/${u.max})</small>`, u.desc, maxed ? 'MÁX' : p, this.btn('up', { k: 'tonic' }, maxed ? 'Completo' : 'Beber', maxed || this.gold < p)); })();
  }
  bank() {
    const a = n => this.btn('dep', { n }, `Depositar ${n}`, this.gold < n), w = n => this.btn('wd', { n }, `Retirar ${n}`, this.state.bank < n);
    return `<p style="text-align:center;color:#c9b88f">Lo que guardas aquí no se pierde si mueres.</p><div class="bets">${[10, 50, 100, 500].map(a).join('')}${this.btn('dep', { n: 'all' }, 'Depositar todo', this.gold <= 0)}</div><div class="bets">${[10, 50, 100, 500].map(w).join('')}${this.btn('wd', { n: 'all' }, 'Retirar todo', this.state.bank <= 0)}</div>`;
  }
  dice() {
    const v = this.view, d = v.dice, face = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'], bets = [5, 10, 25, 50, 100];
    return `<p style="text-align:center;color:#c9b88f">Dos dados. Apuesta a <b>bajo</b> (2-6) o <b>alto</b> (8-12): pagan doble. A <b>siete</b>: paga cuádruple.</p><div class="dice">${d ? face[d[0] - 1] + ' ' + face[d[1] - 1] : '🎲 🎲'}</div>`
      + `<div class="bets">${bets.map(b => this.btn('bet', { n: b }, b + '', false).replace('class="act"', `class="act ${v.bet === b ? 'on' : ''}"`)).join('')}</div><div class="bets">${this.btn('roll', { p: 'low' }, 'Bajo ×2', this.gold < v.bet)}${this.btn('roll', { p: 'seven' }, 'Siete ×4', this.gold < v.bet)}${this.btn('roll', { p: 'high' }, 'Alto ×2', this.gold < v.bet)}</div>`;
  }
  act(a, d) {
    const v = this.view, g = this.state.gear;
    if (a === 'close') return this.close(); if (a === 'tab') { v.tab = d.id; v.msg = ''; return this.render(); }
    if (a === 'up') { const u = UPGRADES[d.k], lv = g[d.k], p = this.price(u.cost[lv] ?? 0); if (lv >= u.max || !this.pay(p)) return this.say('No tienes suficiente dinero.'); g[d.k]++; this.applyGear(); return this.say(`${u.name}: nivel ${g[d.k]}.`); }
    if (a === 'buyblade') { const b = BLADES[d.k], p = this.price(b.price); if (!this.pay(p)) return this.say('No tienes suficiente dinero.'); this.state.blades.push(d.k); this.state.blade = d.k; this.applyGear(); return this.say(`Ahora empuñas: ${b.name}.`); }
    if (a === 'equip') { this.state.blade = d.k; this.applyGear(); return this.say(`Empuñas: ${BLADES[d.k].name}.`); }
    if (a === 'buy') { const p = this.price(GOODS[d.n].buy); if (!this.pay(p)) return this.say('No tienes suficiente dinero.'); this.inv.add(d.n, 1); return this.say(`Compraste ${d.n}.`); }
    if (a === 'sell') { const q = this.inv.items[d.n] || 0, n = +d.all ? q : Math.min(1, q), p = Math.max(1, Math.round(GOODS[d.n].sell * (this.mult >= 1 ? 1 : .9))); if (!n || !this.inv.take(d.n, n)) return; this.earn(n * p, true); return this.say(`Vendiste ${n} × ${d.n} por ${n * p} monedas.`); }
    if (a === 'cure') { const miss = Math.ceil(this.combat.maxHp - this.combat.hp), p = this.price(Math.max(5, Math.ceil(miss / 2))); if (miss <= 0 || !this.pay(p)) return this.say('No se puede curar.'); this.combat.hp = this.combat.maxHp; return this.say('Como nuevo.'); }
    if (a === 'dep') { const n = d.n === 'all' ? this.gold : +d.n; if (n <= 0 || !this.pay(n)) return; this.state.bank += n; this.hud(); return this.say(`Depositaste ${n} monedas.`); }
    if (a === 'wd') { const n = d.n === 'all' ? this.state.bank : +d.n; if (n <= 0 || this.state.bank < n) return; this.state.bank -= n; this.earn(n, true); return this.say(`Retiraste ${n} monedas.`); }
    if (a === 'bet') { v.bet = +d.n; return this.render(); }
    if (a === 'roll') {
      if (!this.pay(v.bet)) return this.say('No tienes suficiente dinero.'); const r = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], s = r[0] + r[1]; v.dice = r;
      const win = d.p === 'low' ? s <= 6 : d.p === 'high' ? s >= 8 : s === 7, mult = d.p === 'seven' ? 4 : 2;
      if (win) { this.earn(v.bet * mult, true); return this.say(`¡Salió ${s}! Ganas ${v.bet * (mult - 1)} monedas.`); } return this.say(`Salió ${s}. Pierdes ${v.bet} monedas.`);
    }
  }
}
