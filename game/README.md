# Zhetalis · Mars Outpost

Double-click **Start Mars.cmd**, then choose your mission and launch.
Python 3 and an internet connection are needed: Python serves the files locally,
and the game loads Three.js, Draco decoders and optional live NASA/NOAA feeds.
The launcher serves only this folder at `http://127.0.0.1:8777/`.

## Integrated exploration update (8 November 2026)

The new `Downloads/UNITY/game` browser build is merged into this game. See
[INTEGRATION.md](INTEGRATION.md) for features, retained fixes and validation.

## Play

- WASD / arrows: walk. Shift: run. Space: jump. Click the game: mouse look.
- Esc or C: release/capture the mouse. V: first/third person. E: interact.
- B: plant a map flag. Hold F indoors or in the pressurised rover to eat.
- G: surface operations map. P: power. L: logbook. M: sound.
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

NASA's Spirit/Gusev-derived terrain is retained with less exaggerated relief.
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
