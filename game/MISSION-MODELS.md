# Mission model integration

- Artemis I/II flybys and the Moon-orbit briefing load the NASA/JPL Eyes Orion asset on demand. This is the Artemis II visualization model, used as a visual proxy for Artemis I; it is not a Mars transit spacecraft. See `moon/assets/nasa/orion/source-manifest.json` for exact inputs and hashes.
- Lunar survey & history now offers **Fly Apollo mission**: the supplied Saturn V and NASA Apollo Lunar Module in a 38-second historical illustration. Launch, a labelled time jump and powered lunar descent are shown. Staging, docking and the multi-day journey are omitted, not claimed as simulated. Saturn V remains the unchanged Stanley Creative CC BY-ND 4.0 asset, not a NASA-authored model.
- The Moon surface training lander and lunar briefing share a detailed white HLS-inspired concept. Elevator, hatch, feet and existing interaction coordinates remain compatible.
- Mars landing uses the corresponding stainless/heat-shield concept with four animated flaps, six engine bells and landing legs. No parachute is shown. The generic Mars transit habitat remains an explicitly illustrative future vehicle.
- SLS continues to use its existing NASA model for Earth launch. LRO remains a real-model survey demonstration; Apollo rocks and other surface assets retain their existing research roles.

## Scope and sources

The Starship variants are original educational geometry referenced to [NASA's 2024 concept illustrations](https://www.nasa.gov/humans-in-space/nasa-spacex-illustrate-key-moments-of-artemis-lunar-lander-mission/). They are not downloaded final NASA/SpaceX engineering designs. Dimensions, engine details and landing trajectories are gameplay illustrations. The reference article is dated; its historical mission-number wording does not override the game's current mission chronology. Artemis I/II do not land astronauts.

[NASA/JPL Eyes](https://eyes.nasa.gov/apps/solar-system/#/sc_artemis_2) supplies Orion. The imported model retains its full meshes and compressed textures. Models use real 3D geometry, not flat spacecraft pictures.

## Loading and checks

Orion requests begin only when needed, have a timeout and cancellation, and dispose late results after a screen closes. Decoder workers are bounded. Starship static parts are merged by material and heat-shield tiles are instanced; this reduces draw calls without lowering the desktop texture resolution.

Tests: `scripts/test-starship-model.mjs`, `game/moon/tests/apollo-mission.test.mjs`, and `game/moon/tests/test-apollo-browser.py`. The Three.js geometry test supports local ESM runtime paths via `THREE_TEST_MODULE` and `THREE_UTILS_MODULE`. Browser checks cover actual Orion decoding, distinct lunar/Mars variants, all six Mars footpads at touchdown, and cleanup. Software-rendered browser checks do not establish real-device frame rates.
