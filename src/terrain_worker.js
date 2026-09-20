// Web Worker: builds all per-chunk vertex data off the main thread.
import { createHeightField, CHUNK, WATER_LEVEL } from './heightfield.js';

let hf = null;
self.onmessage = e => {
  const m = e.data;
  if (m.type === 'init') { hf = createHeightField(m.seed); return; }
  if (m.kind === 'grass') {                                          // grass-only request (cheap, sent when the player gets close)
    const g = new Float32Array(hf.vegetation(m.cx, m.cz, true).grass); postMessage({ id: m.id, cx: m.cx, cz: m.cz, grass: g }, [g.buffer]); return;
  }
  const { id, cx, cz, res, grass } = m, ox = cx * CHUNK, oz = cz * CHUNK, N = res, W = N + 3, STEP = CHUNK / N, VW = N + 1;
  const hs = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) hs[j * W + i] = hf.height(ox + (i - 1) * STEP, oz + (j - 1) * STEP);
  const nv = VW * VW + 4 * VW, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), tmp = new Float32Array(7), spl = new Float32Array(nv * 4);
  let minH = 1e9;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * VW + i, hi = (j + 1) * W + (i + 1), h = hs[hi]; minH = Math.min(minH, h);
    const dx = hs[hi + 1] - hs[hi - 1], dz = hs[hi + W] - hs[hi - W], nx = -dx, ny = 2 * STEP, nz = -dz, L = Math.hypot(nx, ny, nz);
    pos[k * 3] = i * STEP; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * STEP; nor[k * 3] = nx / L; nor[k * 3 + 1] = ny / L; nor[k * 3 + 2] = nz / L;
    const x = ox + i * STEP, z = oz + j * STEP, rt = h < 4 ? hf.river(x, z).t : 0;
    hf.color(h, 1 - ny / L, x, z, rt, tmp, 0); col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2]; spl[k * 4] = tmp[3]; spl[k * 4 + 1] = tmp[4]; spl[k * 4 + 2] = tmp[5]; spl[k * 4 + 3] = tmp[6];
  }
  const base = VW * VW, edge = [k => k, k => N * VW + k, k => k * VW, k => k * VW + N];   // skirts hide cracks between LOD levels
  for (let s = 0; s < 4; s++) for (let k = 0; k <= N; k++) {
    const src = edge[s](k), dst = base + s * VW + k;
    pos[dst * 3] = pos[src * 3]; pos[dst * 3 + 1] = pos[src * 3 + 1] - 6; pos[dst * 3 + 2] = pos[src * 3 + 2];
    nor.copyWithin(dst * 3, src * 3, src * 3 + 3); col.copyWithin(dst * 3, src * 3, src * 3 + 3); spl.copyWithin(dst * 4, src * 4, src * 4 + 4);
  }
  const out = { id, cx, cz, res, terrain: { pos, nor, col, spl } };
  const transfer = [pos.buffer, nor.buffer, col.buffer, spl.buffer];
  if (minH < WATER_LEVEL + .05) {                                   // water surface with per-vertex depth and river flow
    const wpos = new Float32Array(VW * VW * 3), wdepth = new Float32Array(VW * VW), wflow = new Float32Array(VW * VW * 3);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * VW + i, h = hs[(j + 1) * W + (i + 1)], x = ox + i * STEP, z = oz + j * STEP, r = hf.river(x, z);
      wpos[k * 3] = i * STEP; wpos[k * 3 + 1] = WATER_LEVEL; wpos[k * 3 + 2] = j * STEP; wdepth[k] = WATER_LEVEL - h;
      wflow[k * 3] = r.fx; wflow[k * 3 + 1] = r.fz; wflow[k * 3 + 2] = h < WATER_LEVEL + 3 ? r.t : 0;
    }
    out.water = { pos: wpos, depth: wdepth, flow: wflow }; transfer.push(wpos.buffer, wdepth.buffer, wflow.buffer);
  }
  const veg = hf.vegetation(cx, cz, grass);
  out.trees = new Float32Array(veg.trees); out.rocks = new Float32Array(veg.rocks); out.grass = new Float32Array(veg.grass); out.plants = new Float32Array(veg.plants); out.bld = new Float32Array(veg.bld);
  transfer.push(out.trees.buffer, out.rocks.buffer, out.grass.buffer, out.plants.buffer, out.bld.buffer);
  postMessage(out, transfer);
};
