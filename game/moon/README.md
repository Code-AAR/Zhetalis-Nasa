# Moon Mission

Open `/game/moon/` from the same static server as Mars. No build step is needed.

Choose an Artemis I uncrewed Orion flyby, an Artemis II crewed flyby, or a future lunar surface training mission. Artemis I and II do not land. The surface lander is an HLS-inspired training model, not a verified flight design.

Settings shares music, ambience, effects, voice, graphics, screen layout and the Information library with Mars. Short facts link to sources, diagrams and equations there. The default detail limit covers the full 240 m minimap circle with at most 16 terrain chunks; distant terrain remains visible. A full game day lasts five minutes; the real lunar solar day is about 29.53 Earth days.

## Data and accuracy

NASA Image and Video Library pictures and LRO LOLA-derived horizon samples are archived with provenance in `../data/moon-*.json`. Local terrain is procedural training terrain, not a surveyed landing site. Orbital routes, mission duration and resource rates are simplified for play. Gravity is 1.62 m/s²; there is no wind or parachute landing on the Moon.

DONKI was unavailable during the 8 November 2026 refresh. Space-weather exercises are labelled practice drills, not live alerts. `tools/fetch-moon-data.mjs` can refresh data server-side; keep NASA_API_KEY only in the ignored local .env. Never ship it in browser code.

## Checks

Run `node game/moon/tests/moon-core.test.mjs` from the repository root. `tests/browser-smoke.js` runs in a served Moon page and checks flyby geometry reuse, orbit radius, walking, lunar jumping, chunk limits and saving. It replaces local test progress; use an isolated browser profile.

Desktop and phone-sized browser layouts have been checked. Physical-phone performance has not been measured.

## Full quality and phone Lite

Auto detects phones using browser mobile hints, user agent, touch input and physical screen dimensions. A small desktop window is not classified as a phone; tablets use full quality. Settings → Display & world allows a phone to select Full quality. Full uses the unchanged NASA LRO topographic GLB (81.5 MB, 2,021,340 vertices, original 8192×4096 texture); phone Lite uses a separate 2.37 MB derivative. NASA's detailed Orion capsule replaces the simple capsule mesh. Source and adaptation notes are in ../assets/nasa/MODELS.md.

Walking is 2 m/s and Shift sprint is 4 m/s. A jump launches at 2.9 m/s with real 1.62 m/s² gravity, rising approximately 2.6 m on level ground. Those movement speeds are tuned game choices, not measured spacesuit performance. Lunar dust particles are 89% smaller in diameter and remain ballistic.

Efficiency comes from shared assets, bounded terrain residency, disposing replaced geometry, avoiding idle chunk planning and loading only the chosen phone/full Moon asset. Full geometry and textures are not automatically reduced on computers or tablets.
