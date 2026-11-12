# Regional LOLA terrain and Apollo sample

## What is measured

The playable 960 m square uses a static 1.6 km, 321×321 grid derived from the
[NASA PGDA south-pole LOLA mosaic](https://pgda.gsfc.nasa.gov/products/81).
The origin is 89.4624°S, 137.7808°W, matching the existing training site.
The grid is 5 m; x is east and z south. Heights are metres relative to the
interpolated source elevation at the origin (1935.604893 m). No vertical
exaggeration is applied to the regional component.

`regional-terrain.json` records the original URL, source projection, exact
pixel window, extraction method, timestamp, and hashes. Spherical geodesic
positions are projected into the source south-polar stereographic map and
bilinearly sampled at pixel centres. Storage is signed decimetres (maximum
rounding error 0.05 m), not a claim of decimetre measurement accuracy.

Citation: Barker et al. (2021), *Improved LOLA Elevation Maps for South Pole
Landing Sites: Error Estimates and Their Impact on Illumination Conditions*,
Planetary and Space Science 203, 105119,
https://doi.org/10.1016/j.pss.2020.105119.

## Explicit synthetic additions and limitations

- Landing pad flattened within 24 m, blending to measured relief by 70 m.
- Existing seeded craters, fine regolith noise, rocks, ice scenario and shadow
  rules remain training features, not measured craters, deposits or illumination.
- The source is an interpolated DEM, not a laser return at every grid point.
  Source return-count and error maps are not included. Grid spacing is not
  equivalent to resolving power.
- Beyond the playable square, the regional component blends out between 600
  and 800 m on either horizontal axis. Distant terrain remains the pre-existing
  stylized horizon informed by the coarser SVS LOLA dataset; it is not a 3-D
  reconstruction of distant ridges from the new patch.
- Existing sunlight/horizon estimates remain based on the old dataset. This is
  not a landing-site suitability, illumination, or traversability simulator.

Static ES-module data loads before `heightAt` can be called. There is no fetch,
asynchronous configuration, or runtime replacement in the pure terrain modules.
The same sampler serves mesh construction, spawn, collisions, rover and minimap.
The planner uses a smaller candidate rectangle with identical output; crater
evaluation skips square roots outside each crater's finite influence. Desktop
mesh/texture quality settings are unchanged.

## Apollo exhibit

[NASA ARES sample 10017,15](https://ares.jsc.nasa.gov/astromaterials3d/sample-details.htm?sample=10017-15)
is an Apollo 11 basalt subsample from the LM site, Mare Tranquillitatis.
The NASA OBJ explicitly declares metre units. The 200,000 source triangles and
original JPEG are retained in a self-contained GLB. UV V is converted from OBJ
to glTF convention. The source has no normals; area-weighted smooth normals are
generated across UV seams. Source and output hashes and bounds are recorded in
`apollo-10017-15.json`. No decimation or texture resize is used.

The exhibit at x=-22, z=18 is labelled as an imported replica at **20× linear
scale**, not a south-pole discovery. Its original longest dimension is about
5.12 cm, displayed at about 1.02 m. Walk within 4 m and press E / Use for the
source and explanation. The plinth participates in astronaut/rover collisions.
The full model is requested once when surface play approaches within 100 m,
through the shared optional queue (two attempts, 30-second overall deadline).
Entry does not await it. A failed load leaves a labelled plinth and explanation;
reload retries. A timed-out late GLTF result is disposed. The plaque and plinth
remain small resident objects; there is no continuous animation or second renderer.

## Reproduce and test

From repository root (network needed only for regeneration):

```sh
python -m pip install numpy rasterio
python game/moon/tools/fetch-regional-terrain.py --out game/moon/data
python game/moon/tools/fetch-apollo-sample.py --out /tmp/apollo-sample
```

For the Apollo result, put the GLB in `game/moon/assets/nasa` and its provenance
JSON in `game/moon/data`. The generator does not update runtime files itself.
The DEM tool uses HTTP byte ranges rather than downloading the 3.3 GB mosaic;
it rejects nonfinite source windows instead of filling gaps.

```sh
node game/moon/tests/moon-core.test.mjs
node game/moon/tests/quests.test.mjs
node game/moon/tests/measured-sample.test.mjs
```

The new suite checks the terrain hash, exact grid samples, bilinear interpolation,
coverage, seam continuity, 2,401 reference-planner comparisons, GLB integrity,
all 200,000 triangles and byte-identical embedded NASA texture.

Browser integration (Python Playwright and installed Edge):

```sh
python game/moon/tests/measured-sample-browser.py
```

Checks deferred full-quality loading, E interaction, plinth collision, duplicate
requests, missing-asset failure and disposal. Screenshots go to a temporary
folder by default; use `--out PATH` to retain them in a chosen location.
