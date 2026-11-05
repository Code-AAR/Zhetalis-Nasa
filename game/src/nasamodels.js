// Official NASA 3D models (NASA 3D Resources, free and without copyright):
// https://github.com/nasa/NASA-3D-Resources
//   assets/sls.glb              - SLS Block 1, from NASA's 3D-printing model, split into stages by scripts/build-sls-model.py
//   assets/mobile-launcher.glb  - the Mobile Launcher tower SLS launches from (Kennedy Space Center)
//   assets/mro.glb              - Mars Reconnaissance Orbiter, a real relay orbiter for Mars rovers
//   assets/ingenuity.glb        - Ingenuity, the Mars helicopter
//   assets/nasa-astronaut.glb   - NASA's "Astronaut" model: the player (logo painted over, cut into joints in suit.js)
//   assets/gusev-height.bin     - heights sampled from NASA's 3D model of Spirit's landing site (Gusev Crater):
//                                 https://science.nasa.gov/3d-resources/mars-spirit-landing-site/
//   assets/mars-map.jpg         - Mars map from https://science.nasa.gov/3d-resources/mars/ (arrival globe)
// NASA compresses these with Draco, so the loader needs Three.js's Draco decoder.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
export const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const cache = {};
// Resolves to the loaded glTF, or null if it couldn't load (the game then keeps its simple shapes).
export function loadModel(file) {
  cache[file] ??= loader.loadAsync('assets/' + file).catch(err => { console.warn('NASA model failed to load:', file, err); return null; });
  return cache[file];
}
