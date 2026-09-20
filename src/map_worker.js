// Web Worker: renders the world map (terrain colours + hillshade + water + forest) in horizontal bands.
import { createHeightField } from './heightfield.js';

self.onmessage = e => {
  const { seed, R, mpp } = e.data, hf = createHeightField(seed), N = Math.ceil(2 * R / mpp), BAND = 32, x0 = -R, z0 = -R;
  const lerp = (a, b, t) => a + (b - a) * t, cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  for (let y0 = 0; y0 < N; y0 += BAND) {
    const rows = Math.min(BAND, N - y0), W = N + 2, H = rows + 2, hs = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) hs[j * W + i] = hf.height(x0 + (i - 1) * mpp, z0 + (y0 + j - 1) * mpp);
    const out = new Uint8ClampedArray(N * rows * 4);
    for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) {
      const k = (j + 1) * W + (i + 1), h = hs[k], wx = x0 + i * mpp, wz = z0 + (y0 + j) * mpp;
      const shade = cl(.5 + ((hs[k - 1] - hs[k + 1]) * .7 + (hs[k - W] - hs[k + W]) * .7) * .05 / (mpp / 12), 0, 1);      // light from the north-west
      let r, g, b;
      if (h < 0) { const d = cl(-h / 6); r = lerp(96, 34, d); g = lerp(164, 88, d); b = lerp(186, 130, d); }
      else if (h < 1.2) { r = 206; g = 190; b = 140; }                                                                     // shore / sand
      else {
        const t = cl((h - 2) / 40); r = lerp(104, 150, t); g = lerp(134, 138, t); b = lerp(70, 84, t);
        const f = hf.forest(wx, wz) * (1 - cl((h - 50) / 30)); r = lerp(r, 52, f * .75); g = lerp(g, 88, f * .75); b = lerp(b, 46, f * .75);
        const rock = cl((h - 55) / 30); r = lerp(r, 132, rock); g = lerp(g, 124, rock); b = lerp(b, 112, rock);
        const snow = cl((h - 100) / 18); r = lerp(r, 240, snow); g = lerp(g, 242, snow); b = lerp(b, 246, snow);
      }
      const s = .62 + shade * .76, o = (j * N + i) * 4; out[o] = r * s * 1.02; out[o + 1] = g * s; out[o + 2] = b * s * .94; out[o + 3] = 255;   // slight warm tint
    }
    postMessage({ y0, rows, N, data: out }, [out.buffer]);
  }
  postMessage({ done: true });
};
