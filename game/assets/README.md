# Game model assets

All shipped Mars and Moon model files are collected under this folder. Existing mesh and texture quality is unchanged.

| Location | Models / use |
| --- | --- |
| `sls.glb`, `mobile-launcher.glb`, `vab.glb` | Earth launch scene |
| `nasa/orion/orion-eyes.glb` | NASA/JPL Eyes Orion for Artemis flybys and briefing |
| `nasa/orion-capsule.stl` | Retained printable Orion capsule source |
| `nasa/saturn-v-history.glb` | User-supplied historical Apollo launch model; Stanley Creative, CC BY-ND 4.0 |
| `nasa/apollo-lunar-module.glb` | Apollo descent / history exhibit |
| `nasa/lro-orbiter.glb` | Lunar survey exhibit |
| `nasa/moon-lro.glb` | Full NASA LRO topographic Moon |
| `nasa/moon-lro-lite.glb` | Separate phone Lite derivative |
| `nasa/apollo-10017-15.glb` | Apollo sample exhibit |
| `mars-rocks.glb`, `block-island.stl` | Mars rock assets; retaining a file does not mean every scene loads it |
| `perseverance.glb`, `perseverance-animated.glb`, `mer-rover.glb`, `sev.glb`, `ingenuity.glb` | Rover / helicopter assets |
| `mars-base/`, `hab.glb`, `lander.glb`, `greenhouse-walkway.glb` | Habitat and surface assets |
| `crew/`, `astronaut.glb`, `nasa-astronaut.glb` | Character models and animation |
| `space-pack/` | Supplemental space models; see its own manifest |

The HLS-inspired and Mars Starship variants are generated 3D geometry in `../src/starship-model.js`, not downloaded GLB files or final engineering models. Integration and provenance: `../MISSION-MODELS.md`, `../moon/LUNAR-EXHIBITS.md`, `nasa/MODELS.md`, and `nasa/orion/source-manifest.json`.

Keep `nasa/draco/` and `nasa/orion/basis/` with the models: compressed meshes and textures need these decoders. Source-only crew authoring inputs remain in the repository's `source-assets/`; they are not runtime downloads. Moon information photographs remain in `../moon/assets/nasa/`.
