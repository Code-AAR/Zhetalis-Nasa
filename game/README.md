# Zhetalis · Mars Outpost

Double-click **Start Mars.cmd**, then choose your mission and launch.
Python 3 and an internet connection are needed: Python serves the files locally,
and the game loads Three.js, Draco decoders and optional live NASA/NOAA feeds.
The launcher serves only this folder at `http://127.0.0.1:8777/`.

## Integrated exploration update (8 November 2026)

The new `Downloads/UNITY/game` browser build is merged into this game. See
[INTEGRATION.md](INTEGRATION.md) for features, retained fixes and validation.

## Hands-on first base mission

New Mars missions begin in first person (V switches view). Collect the landed kits at the locker, open the workbench and fit the three parts into their matching highlighted slots in order. At the remote power field, equip the pickaxe (1), clear four marked rocks, then place the three panels. Assemble and place the battery, select Solar OUT then Battery IN, and connect Battery OUT to Base IN. Use E, click, or touch Use; R or the Drop button releases a held part/cable without losing fitted parts.

Most ordinary surface rocks can be cleared with several strikes; the largest boulders remain obstacles. Only identified mineral deposits yield samples. Fitted parts, site clearance and removed rocks persist in saves. Previously commissioned bases retain their progress. The charger has its own assembly, placement and socket connection steps after the first food mission.

Zhetela uses the team's original sprite artwork for short, dismissible guidance on Mars and Moon, respecting reduced-motion preferences. Mars's first-base milestones cover power, habitat connection, processed water and a prepared meal. The quest log contains the learning debrief. Assembly, rock breaking and mission times are simplified training interactions, not engineering procedures. Moon receives the shared guide; the new physical construction system is currently Mars-only.

Validation: construction state/circuit/save tests, Mars objectives, first-meal delivery, rover charging and Moon quest regressions pass. Browser checks exercised assembly, site clearance, placement, all three cables, ordinary-rock ray picking/removal and reload persistence. Phone layout and 44 px dismiss controls were checked at 390 x 844; physical-phone play testing is still needed.

## Graphics detail

Use **Settings → Display & world** on the title screen or in the mission menu. **Low memory** reduces terrain detail, procedural texture size, dust particles and pixel resolution, and disables shadows and antialiasing. Auto picks a device-appropriate budget; Balanced and High offer more detail.

**World limit** defaults to **Match minimap**, a 240 m circle following the astronaut or rover. All intersecting 64 m tiles are included, with a tile-edge margin. Smaller/larger manual options select a 1, 2 or 3-chunk radius (at most 9, 25 or 49 detailed tiles). Each tile covers 64 x 64 game metres. Detailed terrain is created nearest-first, one tile per frame. Leaving the radius disposes its geometry instead of retaining an ever-growing cache. A coarse 100-tile horizon remains visible, so there is no void beyond the limit. Nearby rocks are submitted separately from their stable collision mesh; distant rocks are not drawn. Buildings and mission entities remain loaded: this limits terrain residency, not every asset or total browser RAM, and cannot guarantee that a device will never crash.

Low memory plus 1-chunk radius is the lightest combination. Changing settings saves and reloads; choose Resume. Chunk unloading never deletes buildings, discoveries, flags, supplies or mission progress. The same height sampler and rock collision shapes are retained. Quality controls interpolate the existing terrain data rather than adding new measured NASA detail.

Validation: chunk planner tests cover limits, edges and movement; browser travel checks verified disposal of outgoing geometry, the nine-tile budget, retained rock ray contacts, disabled shadows and 1x pixel ratio in Low memory mode. Existing rover slope and landing integration tests pass.

The detail update adds procedural sand/grit bump maps, muted basalt/dust colours, ground-level drifting dust, smoother dish and landing-ship curves, additional ship seams and panel fasteners. Existing rock outlines and collision geometry are unchanged. Imported habitat texture resolution is unchanged; this is not a photogrammetric reconstruction.

References: [NASA's Observation Mountain sand ripples](https://science.nasa.gov/blog/reading-the-ripples-at-observation-mountain/) and [Perseverance's clear-sky panorama](https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-rover-captures-mars-vista-as-clear-as-day/). Generated surface patterns illustrate these features; they are not NASA imagery.

## Play

- WASD / arrows: walk. Shift: run. Space: jump. Click the game: mouse look.
- Esc or C: release/capture the mouse. V: first/third person. E: interact.
- B: open the builder recipe menu. Plant flags from the map (G). Hold F indoors or in the pressurised rover to eat.
- G: surface operations map. P: power. L: Settings information library. M: mute.
- Enter the green-marked airlock for the six linked crew modules. Power, storage,
  workshop, life support, shelter, observation and hazard stations are inside.
- The rover is near camp. Use it for longer survey trips; suit air and the return
  journey matter. A first survey at each field site adds eight science to transmit.
- Mining, building greenhouses, farming, upgrades, solar storms, day/night,
  landing/launch, the lander's cabin, quiz and badges reuse the existing game code.
- The game saves automatically in this browser. This version has its own save
  identifier and does not replace saves made by the original project.

## Included changes

The supplied Mars One base is the playable settlement, with 512px textures,
lighting-aware materials, enlarged crew-scale fitting (roughly 8.9 m module diameter), six module collision footprints,
a connected interior and a working exterior airlock. Survey tasks and a map are
integrated into the normal game; there are no model-comparison controls.

Mars terrain now uses a native 512 × 512 crop of NASA MOLA MEGDR signed elevation samples. See `assets/terrain/gusev-mola-128.json` for provenance, geographic bounds, scale and checksum. Regenerate with `python scripts/fetch-mola-terrain.py`. The 4-degree regional crop is compressed into 640 game metres; vertical differences use a 0.015 scale, and the central base apron is flattened. No procedural hills are added. Rocks and sand remain illustrative. The Moon terrain is unchanged.
The same height function positions terrain, rocks, astronaut and rover. Daylight
remains dusty/tan, sunset blue near the Sun, and gravity is approximately 3.71 m/s².
Surface positions and the future settlement are game design rather than a surveyed
reconstruction or a NASA-approved engineering habitat. The in-game NASA data panel
contains credits and distinguishes measured data from balance numbers.

The Zhetalis.com-style loading screen, planet menu, independent globe rotation
and orbiting Moon are included. View the loader alone at `loading-preview.html`.

## Sources and attribution

Based on **“Mars One” Mission – Base** by **admone**, CC BY 4.0:
https://sketchfab.com/3d-models/mars-one-mission-base-83ced347037f47aba8473147d65df074
The original licence is retained in `assets/mars-base/license.txt`. Adaptations:
export terrain removal, texture reduction, lit materials, scaling and gameplay integration.
NASA assets and science references are credited in the game's data panel.

`data/science-check.json` records the 6 November 2026 Singapore-time NASA audit.
NASA EPIC authenticated successfully; DONKI was unavailable. Curiosity's latest
usable feed record was dated 25 August 2026 and is archived. No API key is packaged.

## Verification and limits

Browser checks exercised launch/landing, all five interior connectors, power
console, exterior return, three survey completions, the map, rover entry,
independent saves and resume without JavaScript runtime errors. Results are in
`checks.json`. Phone layout was inspected; physical-device performance and a full
multi-sol mission balance pass have not been completed. See `BUILD-NOTES.md` for
remaining polish work.

The camp was enlarged to a 102 m overall footprint on 6 November: module bodies are roughly 8.9 m across and 7.3 m tall, with 8 m-wide interiors, 6.6 m interior ceilings and 3 m-high connecting corridors. Embedded static astronaut figures are removed; the playable astronaut stays at 1.85 m. The rover, lander, active panels, airlock and collision footprints move with the new layout.


Revision 3: integrates the repository walk-in greenhouse and four working hydroponic beds with persistent First Harvest quest (+12 science, once), piped water, power-gated growth and food harvest. Original repository code credited in Git to Zagyu. Reuses its distance-based gait and exponential movement easing, smooths the follow-camera target and throttles HUD DOM writes to 10 Hz. Static supplied astronaut mesh removed; playable NASA suit remains animated. No remote push.


Access revision 7: replaces decorative stairs with six 2.4 m-wide, 2.4 m-high stair approaches and 2.65 m-tall airlock doors. Movement now follows the stair surface, module colliders permit the marked entrance lanes, and every module has its own E interaction. Entry and exit preserve the selected module, including after save/resume. Pressure links are 4.4 m in diameter. The greenhouse is behind the habitat row so its larger tube leaves all front stairways clear. Browser checks climbed and descended all six stairs using the normal movement update, entered and exited using E, checked remaining wall collisions, and verified save/resume plus the greenhouse hatch route without runtime errors. No push.


Revision 8: greenhouse glass and all three lander windows now look into the actual outside scene, using an aligned world camera and a second interior render pass. The former painted panorama and cabin window textures were removed. Views follow player position, terrain, camp geometry, sky, weather and time of day; the player and the matching exterior building are hidden only during the outside render pass and restored afterwards. Cabin pressure-shell geometry and frames have real window apertures. Upper bulkheads fill the gaps above passage and airlock openings, leaving 8 m rooms and 3 m connector headroom unchanged. The greenhouse tunnel hatch now aligns with the habitat direction. Six journey chapters and five landing chapters use interactive 3D art, NASA surface maps and the existing SLS/lander assets, additional explanations, chapter navigation and science notes. No publishing or push. Validation exercised every chapter, phone layout, greenhouse/cabin parallax, all three window sightlines, day/night, farming, five connectors and greenhouse save/resume without runtime errors.


Phone revision 9: dynamic viewport sizing, safe-area-aware controls, at least 44 px touch targets, narrower joystick on small screens, multitouch movement and look, cancellation on rotation/focus loss, suspended controls while menus are open, scrollable panels with sticky dismiss buttons, and messages hidden behind menu/modal overlays. Tested at 320x568, 360x640, 390x844, 430x932, 640x360 and 844x390 with emulated native touch events. Touch stair climbing and Use entry, power-panel scrolling, map fit, simultaneous movement/look and rotation release passed without runtime errors. Room dimensions, planet diameter ratios and world scale are unchanged. Real-device Safari/Chrome browser chrome, safe areas and sustained frame rate still need hardware testing. For a local phone preview, run Start Phone Preview.cmd on the computer and open its displayed URL from a phone on the same private Wi-Fi; it does not change firewall rules and stops when Enter is pressed. The published GitHub Pages URL is directly usable from a phone. No additional Unity/engine splash was added, per the user’s follow-up.

At normal speed, one complete day/night cycle takes 5 real minutes (about 2.5 minutes each). A real Martian sol lasts about 24 Earth hours 39 minutes. Faster speed settings shorten the cycle; pausing stops it.

## Settings, soundtrack and information

**Settings** combines Sound & music, Display & world, Controls and Information. Music, environment ambience, effects/movement and recorded voice have separate persistent volumes and a master mute. The quiet music is an original synthesized score, not a recording of sound travelling in space. The optional Mars wind track remains separately adjustable.

Facts during play use short, simple summaries. **More in Settings → Information** opens the exact article, with explanations, sources and applicable diagrams/equations. Search or filter by destination and topic. Three credited diagrams come from the supplied Singapore Polytechnic EM0508 lecture slides; equations include units and assumptions. The library distinguishes observed data, future mission concepts and tuned game rules. Mars' full day/night cycle lasts five real minutes; a real sol is about 24 h 39 min 35 s.

Science corrections include dry explanations for dark Mars slope streaks, condition-specific RAD radiation measurements, orbital-height-dependent speed, and a clear distinction between Orion flybys and lunar surface landers. Procedural terrain is not a reconstruction of a surveyed site.

The NASA API key stays in local `.env` and fetch scripts; browser modules never need it. NASA Image Library records do not require an API key. Saved media/data show their source and retrieval date instead of being described as live.


## Moon companion

Choose **Explore the Moon** from the Mars title, or open `moon/`. Artemis I and II offer interactive Orion flybys with photo objectives; both are labelled as flights that did not land. The separate south-pole mission is a future training scenario with an HLS-inspired lander, astronaut, pressurised rover, footprints/tracks, solar masts, ice processing, oxygen production and science tasks.

The Moon uses 1.62 m/s² gravity and no wind. Dust follows ballistic paths. Its five-minute game cycle represents a 29.53-Earth-day lunar day. NASA LRO/LOLA elevation informs the distant horizon; local traversable craters are procedural. See `moon/README.md` for data provenance, controls and tests. Settings and the information library are shared across both destinations.


Auto graphics now uses full quality on computers/tablets and phone-only Lite. A narrow desktop window still stays full quality. Choose Full quality in Settings to override Lite on a phone. The Moon flyby uses NASA LRO topographic geometry and an 8K texture (unchanged original for full quality), plus NASA Orion capsule geometry. Sources: [NASA Moon model](https://svs.gsfc.nasa.gov/14959/) and [NASA Orion capsule](https://science.nasa.gov/3d-resources/orion-capsule/). See moon/assets/nasa/MODELS.md for original and Lite asset details.

## Builder recipes and renewable ore

Equip the builder from the locker, or open its menu with B / Menu → Builder. Choose greenhouse, extra battery or extra solar panel and Track materials & build. The tracked quest shows missing ore counts, points to the nearest matching deposit, then asks you to unload at the locker, find parts and build. Starter power quests retain priority until the habitat is connected. The existing landed-kit assembly remains unchanged.

Mineral deposits are seeded, clustered surface patches. Depleted deposits replenish once per game sol at their original positions, except occupied spots near the player or structures; these wait for another sol. Mined scenery boulders stay cleared. Reloading during the same sol does not renew deposits. This is explicitly a game rule, not real mineral regrowth; recipe costs abstract processing and imported electronics.

## Tool controls and field guide

Press 1 or 2 / tap a belt slot to equip; repeat to unequip. Q / Empty hands puts away the current tool without removing it from the belt. Equipment choices now save immediately and show a short confirmation. Slot numbers follow your actual belt order.

Open T → Tutorial & current step, or expand the current quest and choose How do I do this? Seven lessons track actual practice: equip, unequip, mine, unload, track a recipe, assemble/connect and build an expansion. The first unfinished lesson opens automatically, and Repeat current hint asks Zhetela to explain the active objective again. Tutorial progress survives reload and never resets mission progress.
