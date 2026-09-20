// DOM UI for NPC interaction: interact prompt, floating speech bubbles and the dialogue panel (typewriter text + numbered choices).
import * as THREE from 'three';

export class DialogueUI {
  constructor(onOpen, onClose) {
    this.onOpen = onOpen; this.onClose = onClose; this.mgr = null; this.node = null; this.typeT = 0; this.full = '';
    this.prompt = document.getElementById('prompt'); this.panel = document.getElementById('dialogue'); this.layer = document.getElementById('bubbles'); this.bubbles = new Map();
    addEventListener('keydown', e => {
      if (!this.mgr?.active) return;
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      const n = parseInt(e.key); if (n >= 1 && this.node && n <= this.node.options.length) this.choose(n - 1);
      else if (e.code === 'Space' || e.code === 'Enter') { if (this.typed < this.full.length) this.typed = this.full.length; }
    }, true);
  }
  setPrompt(t) { if (!this.prompt) return; this.prompt.textContent = t || ''; this.prompt.classList.toggle('hidden', !t); }
  openDialogue(npc, mgr) { this.mgr = mgr; this.npc = npc; this.panel.classList.remove('hidden'); this.onOpen?.(); this.show(mgr.root(npc)); }
  show(node) {
    if (!node) return this.close(); this.node = node; this.full = node.text; this.typed = 0;
    this.panel.replaceChildren();
    const name = document.createElement('div'); name.className = 'dname'; name.textContent = `${this.npc.def.name} · ${this.npc.def.role}`;
    this.txt = document.createElement('div'); this.txt.className = 'dtext'; this.opts = document.createElement('div'); this.opts.className = 'dopts';
    node.options.forEach(([label], i) => { const b = document.createElement('button'); b.className = 'dopt'; b.textContent = `${i + 1}. ${label}`; b.onclick = () => this.choose(i); this.opts.append(b); });
    this.panel.append(name, this.txt, this.opts);
  }
  choose(i) { const opt = this.node.options[i]; if (!opt) return; this.show(opt[1]()); }
  close() { this.panel.classList.add('hidden'); this.mgr?.endTalk(); this.node = null; this.onClose?.(); }
  tick(dt) { if (!this.node || !this.txt) return; this.typed = Math.min(this.full.length, (this.typed || 0) + dt * 60); this.txt.textContent = this.full.slice(0, Math.floor(this.typed)); }
  // world-space speech bubbles projected onto the screen
  updateBubbles(npcs, camera) {
    const v = new THREE.Vector3();
    for (const n of npcs) {
      let el = this.bubbles.get(n);
      if (!n.bubble || !n.body.root.visible) { if (el) el.style.display = 'none'; continue; }
      if (!el) { el = document.createElement('div'); el.className = 'bubble'; this.layer.append(el); this.bubbles.set(n, el); }
      v.copy(n.headPos).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { el.style.display = 'none'; continue; }
      el.style.display = 'block'; if (el.textContent !== n.bubble) el.textContent = n.bubble;
      el.style.left = ((v.x * .5 + .5) * innerWidth) + 'px'; el.style.top = ((-v.y * .5 + .5) * innerHeight) + 'px';
    }
  }
}
