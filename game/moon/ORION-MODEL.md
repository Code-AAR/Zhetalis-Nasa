# Orion flight model — NASA/JPL Eyes

Retrieved 13 November 2026. The complete craft is from NASA/JPL's **Eyes on the Solar System**, not a complete-craft GLB from the 3D Resources catalog. That catalog and NASA's corresponding GitHub tree supplied only printable Orion capsule STL files when checked. The old STL startup download is removed from `orion.js`.

- Official visualization: https://eyes.nasa.gov/apps/solar-system/#/sc_artemis_2
- NASA product page: https://science.nasa.gov/eyes/
- Original glTF: https://eyes.nasa.gov/assets/static/models/sc_artemis/artemis_ii.gltf
- The official app's public `app.js` maps `sc_artemis_2` to that glTF; `config.js` provides `https://eyes.nasa.gov/assets/static` as its asset root.
- Packaged file: `../assets/nasa/orion/orion-eyes.glb`, **24,336,596 bytes**.
- SHA-256: `e2a568ea8f5b5e6dbc2756080a683f5a5e9769a06dc0185cee87f68cc886cb5b`.

Credit NASA/JPL-Caltech (Eyes on the Solar System). This is their Artemis II visualization asset, also used as an explicitly documented visual proxy for Artemis I; it does not certify mission-specific hardware configuration or camera calibration. It is **not** a Mars transit craft or Starship/HLS model. No NASA endorsement is implied.

`tools/fetch-orion-model.mjs` losslessly packages the original glTF buffer and all original KTX2 image bytes into one GLB. No mesh simplification, texture resizing or material rewriting occurs. The original glTF document and a per-source URL/size/SHA-256 manifest are retained alongside it. Node tests compare all scene/mesh/material/accessor metadata and every compressed binary/image payload against those source hashes.

The model uses local Draco (already included for the lunar exhibits) and local Basis Universal KTX2 transcoders from the pinned Three.js 0.160.0 distribution. Basis's upstream README and Apache-2.0 license are included in `orion/basis/`. Runtime model/decoder requests stay on the game's own origin; Three.js loader modules follow the existing import map.

Runtime branding follows the existing `nasamodels.js` convention: only primitives using `Logo_and_Flag` or `Worm.002` are hidden. The first is a combined logo/flag overlay, so its flag is hidden with it. Structural crew/service-module meshes, arrays, ESA markings and all source textures remain unchanged. The packaged source hash is unaffected; provenance remains in this document and the manifest.

## Shared API

```js
import { loadNasaOrion, disposeNasaOrion, ORION_SOURCE } from './moon/src/orion-model.js';
const controller = new AbortController();
const model = await loadNasaOrion(renderer, {signal:controller.signal, timeoutMs:45000});
rig.add(model);
// On teardown: abort any pending request; remove and dispose the returned model.
controller.abort();
rig.remove(model);
disposeNasaOrion(model);
```

Each call returns an independently owned Three Group. No parsed model is shared between renderers or kept in a global cache; the browser may cache source bytes normally. The renderer is required for KTX2 capability detection. Importing the module makes no requests. `timeoutMs` defaults to 45 seconds and bounds fetch, module import and parsing/decoding together. Rejects on HTTP/decode failure, caller cancellation or timeout. Late results after abort are disposed rather than attached. Dispose is idempotent and releases unique geometry/material/texture resources and image bitmaps. Decoder workers are torn down after completion or cancellation.

NASA native model coordinates are preserved: approximately metre units, +Y along the crew-module axis, heat-shield region near Y=0. Bounds measured after loading in an identity rig: X −8.815..8.815 m, Y −3.782..3.474 m, Z −5.641..5.641 m. Do not blindly normalize by the largest dimension. The flyby rig applies its existing +90° X rotation to map the craft axis into its flight frame; other cinematics should own their placement and scale.

## Flyby integration

`buildOrion(mission, renderer)` creates the same flight rig and four stable wing-camera anchors immediately, then starts loading the NASA model. The procedural craft is solely a loading/error fallback. Success disposes that fallback and replaces only the visual child. All NASA surfaces and arrays participate in the existing flyby rotation/animation. The body and camera anchors are never replaced. The Artemis II crew-window view intentionally hides the exterior to prevent the hull occluding the view; its transforms are unchanged.

`root.userData.modelReady` resolves true on replacement or false on failure/cancellation. `modelStatus` reports loading/ready/failed (fallback when no renderer is supplied), and `modelError` records a failure message. `disposeOrion(root)` aborts loading and disposes the appropriate visual. `Flyby.start()` uses it before switching missions. LRO remains in its explicitly illustrative survey demo; adding a fabricated LRO encounter to an Artemis flyby would misrepresent the scene.

## Checks

- `node --test game/moon/tests/orion-model.test.mjs` — lossless asset packaging, timeout, late-result disposal and shared-resource/idempotent cleanup.
- Browser: no Orion GLB/STL/decoder request on menu; official GLB parses with all 61 mesh objects; Artemis I camera shift on swap = 0; native bounds recorded above; screenshot inspected.
- Additional browser regressions check Artemis II window transforms/visibility, rapid switching, HTTP failure/retry and decoded model disposal.

Parent owns import-map cache-version updates. The only requested `main.js` edit is the Orion credit string; all other main logic and lander files remain outside this integration.
