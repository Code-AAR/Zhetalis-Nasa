# Space Pack (web models)

17 original low-poly models made by the team for the Unity project, converted to GLB so the web game can load
them with three.js. Preview them all: open `space-pack-preview.html` (choose a model, drag to turn, download).

| File | Model |
|---|---|
| `01_ArtemisInspiredRocket.glb` | Artemis-inspired launch rocket, 25.1 m tall (not an engineering-accurate SLS: the NASA SLS model is `../sls.glb`) |
| `02_ResearchSatellite.glb` | Research satellite |
| `03_LunarRover.glb` | Six-wheel lunar rover |
| `04_ExplorerAstronaut.glb` | Explorer astronaut, 1.93 m, static parts (no skeleton) |
| `05_OrbitalResearchStation.glb` | Orbital research station |
| `06_Mercury` ... `15_Sun.glb` | Planets, Moon and Sun, radius 1 (sizes and patterns are illustrative) |
| `hab.glb`, `lander.glb` | Habitat and lander from the same pack |

- Units metres, Y up, +Z forward. Each named part of the original is its own node, so code can find e.g. `Core_stage`.
- Flat-shaded colour materials, no textures. `manifest.json` lists triangles, part names, bounds and file size.
- Load: `loadModel('space-pack/01_ArtemisInspiredRocket.glb')` from `src/nasamodels.js`, or `GLTFLoader` directly.
- Rebuild from the editable originals in `source-assets/space-pack/`: `python scripts/build-space-pack.py`.
- Licence (from the pack README): original work, free to use, modify and redistribute; no attribution required.
  It contains no NASA insignia.
