# Optional lunar survey and history

Entry point: Moon menu → **Lunar survey & history**. `flyby.js` mounts the entry once; no index/main UI hook is required. The only main.js change imports `TERRAIN_SOURCE` and corrects source credits. Parent owns import-map cache versions.

## Loading and interaction

- Flyby construction requests no Moon GLB. The existing 458 KB Moon / 513 KB Earth background images remain. `start()` begins the quality-selected Moon GLB asynchronously, keeps the sphere until success, deduplicates requests, and permits retry on a later start after failure.
- Opening the museum loads viewer JS and creates one temporary renderer, but downloads no exhibit model. Buttons enable when controls are ready. Each click fetches only its selected model; switching cancels the previous fetch. One model occupies GPU memory at a time. Browser HTTP caching may reuse downloaded bytes; parsed models are not cached indefinitely.
- NASA originals are Draco compressed. The local decoder starts only when required. The JS decoder fallback is included for browsers without WASM. Existing game model loaders may independently use other decoders.
- Download **and parse** share a 45-second deadline. Cancellation/timeout ends the UI wait even if parsing stalls. Late results are disposed. Failures offer retry by selecting the exhibit again.
- Pointer/pinch controls, keyboard rotation/reset buttons, Escape, native modal focus containment and restored launch focus are supported. Closing frees the model, textures, image bitmaps, controls, observer, renderer and WebGL context. Ordinary museum views render only on interaction/resize; the menu backdrop is suspended while open.
- **Survey demo**, available only after loading LRO, animates an illustrative polar orbit around a schematic Moon. The procedural Moon requires no globe download. Stop, switch or close ends the animation and releases schematic geometry. This is not live ephemeris, measured coverage, a landing-site assessment or a real-time terrain measurement; orbit, speed and relative sizes are illustrative. Hidden documents do not advance the demo.

## Provenance (retrieved 13 November 2026)

All GLBs are preserved byte-for-byte. Display transforms only centre/fit them; models are not compared at a common scale. Use does not imply NASA endorsement.

| File | Bytes | Credit / source |
|---|---:|---|
| `lro-orbiter.glb` | 654500 | NASA / Christopher R. Meaney; [official LRO (A)](https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-a/) |
| `apollo-lunar-module.glb` | 716840 | NASA / Michael D. Carbajal; [official Apollo Lunar Module](https://science.nasa.gov/3d-resources/apollo-lunar-module/) |
| `saturn-v-history.glb` | 4821512 | Stanley Creative; user-supplied `Downloads/saturn_v_-_nasa(1).glb`; [original source](https://sketchfab.com/3d-models/saturn-v-nasa-7a2c9709ff8144c8b3b18ec84b5e112e), [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/). Not an official NASA model. Historical exhibit only. |

SHA-256:

```
b9547bc7c8c37c44675a80c3c3e27b647a9ff1293cf40030ef36f806b9c616b1  lro-orbiter.glb
379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e  apollo-lunar-module.glb
2122e5618e3cf5820b81eb7f1e26e978e2943c7ef4cd39f189cdf762749c24db  saturn-v-history.glb
```

`tools/fetch-lunar-exhibits.mjs` records the exact official download URLs and restores the two NASA files plus Draco runtime binaries from pinned Three.js 0.160.0 distribution URLs. It validates GLB headers, standalone buffers/images and supported required extensions before writing. `--verify` checks the two packaged NASA files without downloading. Saturn V is local and intentionally not automatically downloaded. Draco files are Google Draco, Apache-2.0; upstream license is included in `../assets/nasa/draco/LICENSE` (https://github.com/google/draco/blob/1.5.6/LICENSE). Keep the license when regenerating runtime files.

## Terrain provenance in main.js

The new local terrain uses `TERRAIN_SOURCE` exported by the terrain agent: 5 m interpolated NASA LOLA DEM centred at −89.4624°, −137.7808°, relative to its own origin elevation, plus synthetic pad/craters/grain/ice-shadow overlays. The existing archived horizon uses CGI Moon Kit global elevation at 16 pixels/degree, about 1.9 km meridionally, centred at the same coordinates. Matching centres do not make them the same elevation product: the archived horizon was **not** regenerated from the 5 m DEM. No terrain code, horizon data, coordinates or world hook were changed by the exhibit integration.

## Validation

Run `node --test game/moon/tests/lunar-assets.test.mjs` and `node --test game/moon/tests/*.test.mjs`. Serve the repository over HTTP. The isolated `tests/lunar-assets-harness.html` creates the real Flyby without the costly surface world, and is useful for network assertions and fallback testing. Actual Moon menu was also tested: exhibit entry present; zero Moon/exhibit GLBs before selection. Desktop inherits existing quality policy (even `graphics=lite` selects full on desktop); phone Auto selects Lite.

Browser checks: all three GLBs render, on-open model requests remain zero, rotation/reset, mobile overflow, Escape/focus restoration, HTTP failure/retry, rapid switching, closing in-flight, and flyby full-globe success/deduplication. Unit checks cover exact sizes, standalone validity, local WASM, one-time disposal of shared resources, stalled parse cancellation and late-result cleanup. No commits or pushes are part of this work.
