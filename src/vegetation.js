// Loads the lightweight vegetation/rock models (prepared with Blender) and the PBR ground textures.
// Prototypes are shared: each has geometry+material parts that are instanced per chunk.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { windTime } from './wind.js';

const M = 'assets/models/';
export const TREE_SETS = {
  pine: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4'],
  broad: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4'],
  twisted: ['TwistedTree_1', 'TwistedTree_2'],
  dead: ['DeadTree_1', 'DeadTree_2'],
};
export const PLANT_SETS = { 0: ['Bush_Common', 'Bush_Common_Flowers'], 1: ['Fern_1', 'Plant_1_Big'], 2: ['Flower_3_Group'], 3: ['Flower_4_Group'], 4: ['Mushroom_Common'], 5: ['Clover_1', 'Plant_7_Big'] };
export const GRASS_SET = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short'];
export const ROCK_SET = { big: ['namaqualand_boulder_02', 'Rock_Medium_1', 'Rock_Medium_2'], small: ['rock_07', 'Rock_Medium_3'], stump: ['tree_stump_01'] };

const SWAY = { tree: .0075, plant: .05, grass: .9, rock: 0 };

function windPatch(mat, sway) {
  if (!sway) return mat; const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = shader => {
    prev?.(shader); shader.uniforms.uTime = windTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
      #else
        vec2 ip = vec2(0.0);
      #endif
      float hgt = max(position.y, 0.0);
      float ph = uTime * 1.5 + ip.x * 0.21 + ip.y * 0.17;
      float amt = hgt * hgt * ${sway.toFixed(4)};
      transformed.x += sin(ph) * amt + sin(ph * 2.3 + 1.7) * amt * 0.35;
      transformed.z += cos(ph * 0.9) * amt * 0.6;`);
  };
  return mat;
}

export class Vegetation {
  constructor() { this.protos = new Map(); this.textures = new Map(); this.ready = false; }
  // De-duplicate identical textures across models (bark/leaf atlases are embedded in every .glb).
  shareTextures(mat) {
    for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
      const t = mat[k]; if (!t) continue; const key = k + ':' + (t.name || t.image?.width + 'x' + t.image?.height + ':' + (t.source?.data?.currentSrc || '')) + ':' + (t.name ? '' : mat.name);
      const prev = this.textures.get(key); if (prev) { mat[k] = prev; } else { t.anisotropy = 8; this.textures.set(key, t); }
    }
  }
  async load(names, onProgress) {
    const loader = new GLTFLoader(); let done = 0;
    await Promise.all(names.map(async n => {
      try {
        const g = await loader.loadAsync(n.includes('/') ? 'assets/' + n + '.glb' : M + n + '.glb'), cat = n.startsWith('props/') ? 'prop' : /Tree|Pine/.test(n) ? 'tree' : /Grass/.test(n) ? 'grass' : /Rock|rock|boulder|stump|trunk/.test(n) ? 'rock' : 'plant';
        g.scene.updateMatrixWorld(true); const parts = [], box = new THREE.Box3();
        g.scene.traverse(o => {
          if (!o.isMesh) return; const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.computeBoundingBox(); box.union(geo.boundingBox);
          const mat = o.material; this.shareTextures(mat);
          if (mat.transparent || mat.alphaTest > 0 || (mat.map && /Leaves|Leaf|Grass|Flowers|Mushrooms/i.test(mat.map.name || mat.name))) { mat.transparent = false; mat.alphaTest = .45; mat.depthWrite = true; mat.side = THREE.DoubleSide; }
          mat.envMapIntensity = .7; mat.roughness = Math.max(mat.roughness ?? .8, .75); mat.metalness = 0; windPatch(mat, SWAY[cat]);
          parts.push({ geo, mat });
        });
        const size = box.getSize(new THREE.Vector3());
        this.protos.set(n, { name: n, cat, parts, height: size.y, radius: Math.max(size.x, size.z) / 2, box });
      } catch (e) { console.warn('model failed', n, e.message); }
      onProgress?.(++done / names.length);
    }));
    this.ready = true;
  }
  get(n) { return this.protos.get(n); }
  list(set) { return set.map(n => this.protos.get(n)).filter(Boolean); }
}

// ---- PBR ground textures + splat shader -------------------------------------------------------------------------
export function loadGroundTextures() {
  const L = new THREE.TextureLoader(), T = {};
  for (const n of ['grass', 'rock', 'dirt', 'sand', 'forest']) {
    for (const [k, srgb] of [['diff', true], ['nor', false]]) {
      const t = L.load(`assets/terrain/${n}_${k}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; T[n + '_' + k] = t;
    }
  }
  return T;
}
export function makeTerrainMaterial(T) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, envMapIntensity: .5 });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { tGrass: { value: T.grass_diff }, tRock: { value: T.rock_diff }, tDirt: { value: T.dirt_diff }, tSand: { value: T.sand_diff }, nGrass: { value: T.grass_nor }, nRock: { value: T.rock_nor }, nDirt: { value: T.dirt_nor }, nSand: { value: T.sand_nor } });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 splat; varying vec4 vSplat; varying vec3 vWPos;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vSplat = splat; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec4 vSplat; varying vec3 vWPos;
      uniform sampler2D tGrass, tRock, tDirt, tSand, nGrass, nRock, nDirt, nSand;
      vec3 sampleTiled(sampler2D t, vec2 uv) { return 0.55 * texture2D(t, uv).rgb + 0.45 * texture2D(t, uv * 0.173 + vec2(0.37, 0.61)).rgb; }`)
    .replace('#include <color_fragment>', `
      vec2 tuv = vWPos.xz * 0.19;
      vec3 tex = sampleTiled(tGrass, tuv) * vSplat.x + sampleTiled(tRock, tuv * 0.8) * vSplat.y + sampleTiled(tDirt, tuv) * vSplat.z + sampleTiled(tSand, tuv * 1.2) * vSplat.w;
      float lum = dot(vColor.rgb, vec3(0.333)); vec3 macro = vColor.rgb / max(lum, 0.05);          // large-scale colour variation from the world generator
      float snow = smoothstep(0.78, 0.9, vColor.r) * smoothstep(0.78, 0.9, vColor.b);
      diffuseColor.rgb = mix(tex * mix(vec3(1.0), macro, 0.55) * 1.15, vec3(0.93, 0.95, 0.98), snow);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 wN = inverseTransformDirection(normal, viewMatrix);
        vec3 nm = (sampleTiled(nGrass, tuv) * vSplat.x + sampleTiled(nRock, tuv * 0.8) * vSplat.y + sampleTiled(nDirt, tuv) * vSplat.z + sampleTiled(nSand, tuv * 1.2) * vSplat.w) * 2.0 - 1.0;
        vec3 pert = normalize(wN + vec3(nm.x, 0.0, -nm.y) * 0.9 * (1.0 - snow * 0.7));
        normal = normalize((viewMatrix * vec4(pert, 0.0)).xyz);
      }`);
  };
  return mat;
}
