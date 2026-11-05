// Official NASA 3D models (NASA 3D Resources, free and without copyright):
// https://github.com/nasa/NASA-3D-Resources
//   assets/sls.glb              - SLS Block 1, from NASA's 3D-printing model, split into stages by scripts/build-sls-model.py
//   assets/mobile-launcher.glb  - the Mobile Launcher tower SLS launches from (Kennedy Space Center)
//   assets/mro.glb              - Mars Reconnaissance Orbiter, a real relay orbiter for Mars rovers
//   assets/ingenuity.glb        - Ingenuity, the Mars helicopter
//   assets/pistol-grip-tool.glb - Pistol Grip Tool, the ISS spacewalk power tool (on the outpost workbench)
//   assets/wrench.glb           - Wrench (on the outpost workbench)
//   assets/nasa-astronaut.glb   - NASA's "Astronaut" model: the player (logo painted over, cut into joints in suit.js)
//   assets/gusev-height.bin     - heights sampled from NASA's 3D model of Spirit's landing site (Gusev Crater):
//                                 https://science.nasa.gov/3d-resources/mars-spirit-landing-site/
//   assets/mars-map.jpg         - Mars map from https://science.nasa.gov/3d-resources/mars/ (arrival globe)
// NASA compresses these with Draco, so the loader needs Three.js's Draco decoder.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
export const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

// Space Apps rules: no NASA logo in the game. Some NASA models have it printed on their texture, so we paint
// our Zhetalis badge over it. spots: [{ x, y, r }] as fractions of the texture (0..1); `plain` spots are just
// filled with the colour next to them (for small mission patches). Returns a new texture.
const badge = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/zhetalis-badge.png'; });
export async function replaceLogos(tex, spots) {
  const img = tex?.image, mark = await badge; if (!img?.width) return tex;
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  for (const s of spots) {
    const x = s.x * W, y = s.y * H, r = s.r * W;
    const px = g.getImageData(Math.min(W - 1, Math.round(x + r * 1.6)), Math.round(y), 1, 1).data;   // the paint colour beside it
    g.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`;
    if (s.plain) { g.fillRect(x - r, y - r * (s.h ?? 1), r * 2, r * 2 * (s.h ?? 1)); continue; }
    g.beginPath(); g.arc(x, y, r * 1.08, 0, Math.PI * 2); g.fill();
    if (mark) g.drawImage(mark, x - r * 0.95, y - r * 0.95, r * 1.9, r * 1.9);
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY; t.colorSpace = tex.colorSpace || THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4;
  return t;
}

const cache = {};
// Resolves to the loaded glTF, or null if it couldn't load (the game then keeps its simple shapes).
export function loadModel(file) {
  cache[file] ??= loader.loadAsync('assets/' + file).catch(err => { console.warn('NASA model failed to load:', file, err); return null; });
  return cache[file];
}
