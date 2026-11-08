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
