# Mission sequences (Blender → GLB)

Twelve animated sequences for the game's flow, built in Blender 5.3 from the game's own 3D models. Each one is
a `.blend` file, a web GLB with named animation clips that three.js can play with `AnimationMixer`, and a preview
video with captions.

| Folder | What's in it |
|---|---|
| `scripts/` | One Python script per sequence (`seq_*.py`) plus the shared `common.py` and `mars_kit.py`. The scripts are the source: every `.blend` and GLB is rebuilt from them. |
| `blend/` | The Blender scenes, opened with Blender 5.3 or newer. |
| `glb/` | The web files: meshes, materials, one camera and the animation clips. |
| `previews/` | 960×540 MP4s with captions, for watching. The captions are not in the GLBs. |
| `viewer.html` | Dev viewer: serve `game/` (`python serve.py`) and open `/animation/viewer.html` to play any clip through its own camera, or with a free orbit camera. |

## The clips

Blender's timeline runs at 24 fps; the GLB clips are sampled at 12 fps (three.js interpolates between keys). Clip times start at 0. Play the two EDL clips one after the other for the whole landing. Meshes are Draco-compressed, so load them with the game's `loadModel()` (`src/nasamodels.js`), or any `GLTFLoader` with a `DRACOLoader` set. Textures are JPEG. The camera in each GLB is the shot camera: render through
`gltf.cameras[0]` to see the sequence as framed, or use your own camera.

| GLB | Clip | Length | Game moment |
|---|---|---|---|
| `ares_vi_briefing.glb` | `ares_vi_briefing` | 58.6 s | 1. New game, first: **Ares VI: Final Stage Briefing**, built from the team's storyboard (`storyboards/ares-vi-final-stage-briefing.html`): same 7 shots, camera moves and lines. Director Hale and the crew of four are the game's rigged characters (`assets/crew`, animations retargeted like `src/hab-crew.js`); the storyboard's model slots are filled with the Ares VI lander (descent stage + ascent vehicle), habitat, fission unit, solar tracker and ISRU plant as holograms over the table. Captions carry speaker and phase. |
| `briefing_mission.glb` (0.5 MB) | `briefing_mission` | 34.6 s | 1. New game: the mission plan. Sun, Earth and Mars on real orbits (distances to scale), the launch window (Mars 44° ahead), the 259-day transfer ellipse solved with Kepler's equation, and the 26-month goal. |
| `launch_earth.glb` (1.7 MB) | `launch_earth` | 30.6 s | 1. The ship launches after landing-site choice: SLS on Mobile Launcher 1 at Pad 39B. RS-25 start at 1.7 s, liftoff at 4.0 s, real time until it clears the tower, then about 19× faster: boosters drop at 17.6 s, abort tower off at 20.7 s. |
| `cruise_loop.glb` (0.4 MB) | `cruise_loop` | 16.0 s, seamless loop | 2. The seven-month trip as the loading screen (load saves here). The camera circles the transit ship once per loop; the ion-thruster glow and lights repeat exactly. Set `action.setLoop(THREE.LoopRepeat)`. |
| `mars_approach.glb` (0.4 MB) | `mars_approach` | 18.6 s | 2→3. Arrival: the docked capsule's engine brakes the ship into orbit, then the landing pod undocks. Plays right before you choose where to land. |
| `edl_mars.glb` (0.5 MB) | `entry` | 11.1 s | 3. Entry: heat shield glow at hypersonic speed. |
| | `descent_landing` | 23.5 s | Shell opens, engine fires while supersonic, powered descent, legs out at 9.6 s, touchdown at 15.0 s, dust. |
| `outpost_26_months.glb` (1.0 MB) | `outpost_26_months` | 42.6 s | 3. From the two landing pods to a full outpost, 1.5 s per month (month *m* starts at 1.33 + 1.5·*m* s). The empty `month_counter` holds the month number in `scale.x`. |
| `dust_storm.glb` (1.1 MB) | `dust_storm` | 23.9 s | 4. Random event: a regional dust storm. The front reaches the base at 7.9 s. The empty `sun_factor` holds the sunlight fraction in `scale.x` (1.0 → 0.35, matching the game's "about a third" power). |
| `failure_solar_panel.glb` (0.7 MB) | `panel_failure` | 10.7 s | 4. Random failure: a tracker motor stalls (2.9 s), the bracket gives and the panel sags (5.0 s), red beacon flashing. The empty `row_power` holds the row's output in `scale.x` (1.0 → 0.8). |
| | `panel_repair` | 10.6 s | The fix: rover brings a spare unit (NASA's Orbital Replacement Unit model), astronaut swaps it, panel back up, green light at 6.4 s into the clip. |
| `failure_rover_stuck.glb` | `rover_stuck` | 12.5 s | 4. Random failure: the rover digs into soft sand (Spirit, Troy, 2009). |
| | `rover_freed` | 20.8 s | The fix: two astronauts climb out with shovels, kneel and dig, carry and lay traction boards, step clear, and the rover backs out (Opportunity, Purgatory dune, 2005). Timed at natural speed, with close-ups of the stuck wheel, the shovel and the boards. |
| `failure_air_leak.glb` | `air_leak` | 10.0 s | 4. Random failure: a walkway seal fails and cabin air vents as a frozen plume. The empty `cabin_pressure` holds pressure in `scale.x`. |
| | `leak_patched` | 9.9 s | The fix: patch the seal, top up the air, green light. |
| `ascent_mars.glb` (1.1 MB) | `ascent_mars` | 26.6 s | 3. Leaving Mars after 26 months: fixed camera like the Apollo 17 liftoff film, then a chase shot. Ignition at 3.0 s. |

Reading a control empty in the game (its value is the node's `scale.x`, so read it after `mixer.update`):

```js
const gltf = await loadModel('../animation/glb/dust_storm.glb');   // or a GLTFLoader with DRACOLoader
const mixer = new THREE.AnimationMixer(gltf.scene);
mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'dust_storm')).play();
const sunFactor = gltf.scene.getObjectByName('sun_factor');
// each frame:
mixer.update(dt);
sun.intensity = baseSun * sunFactor.scale.x;
```

## Where each film plays in the game

`src/cinematic.js` plays a GLB full screen through its own camera with its captions (`glb/<name>.captions.json`).
Click, Space, Enter or Esc skips; with reduced motion, or if a file can't load, the game carries straight on.

| Moment | Film |
|---|---|
| Start a new game | `ares_vi_briefing`, then `briefing_mission`, then the live launch countdown (`src/launch.js`, unchanged) |
| After launch, and when you continue a saved game | the loading screen plays `cruise_loop` behind it (at least 9 s after launch, 4 s for a save) |
| Reaching Mars | `mars_approach`, then the landing-site picker |
| Landing | `edl_mars` (`entry` then `descent_landing`), replacing the old sky-crane film for the crew lander |
| Right after landing (new game) | `outpost_26_months`: the goal |
| First dust storm | `dust_storm` film; later storms use the in-world storm in your own base |
| Random failures (new) | `panel_failure`, `rover_stuck` or `air_leak`, then a pop-up. The fixes play `panel_repair` (press E at the solar panels, 1 part), `rover_freed` (press E at the rover) and `leak_patched` (patch from the pop-up or at an airlock door, 1 part). Unfixed panels and leaks get fixed by the rest of the crew after 8 and 5 sols. |
| Winning the mission | `ascent_mars`, then the mission-complete screen |
| Cutscenes menu | every film, to watch again |

## Outpost layout (every Mars film)

The landing pod stands on its own; crews walk across to the habitats. Pressurised walkways join habitat 1 to
habitat 2 and to the arched greenhouse (month 8–9), each running wall to wall with a sealed airlock collar at both
ends, through gaps left in the bagged-soil shielding walls. Rover and astronaut routes are checked against every
building and walkway (`route_problems()` in `mars_kit.py`), so nothing drives or walks through them. All films run
4/3 slower than their script frame numbers (`STRETCH` in `common.py`).

## Polish applied to every film

- Space-pack models (landing pods, habitats, transit station, crew capsule) are smooth-shaded with sharp edges kept above 40°,
  instead of flat facets. SLS keeps 60% of its triangles; the SEV rover 7% with 1024 px textures.
- Every rocket plume has a hot inner core tinted to its flame, a soft glow at the nozzle, and shock diamonds in the
  clean-burning RS-25 and methane/oxygen engines.
- **Astronauts** wear NASA's Z-2 suit (`assets/models/nasa-spacesuits/z2-suit-web.glb`, a web copy - 12k faces,
  1024 px textures - of NASA 3D Resources' "Z2 Spacesuit", NASA/LaRC/Advanced Concepts Lab). `scripts/astro_kit.py`
  rigs it (pelvis, spine, thighs, shins, upper arms, forearms; skin weights from capsules around each bone, because
  Blender's bone-heat weighting fails on the suit's open seams) and gives it actions: walk (the stride follows the
  distance actually covered, so feet do not slide), kneel, dig, carry, repair, with a shovel, board or spare unit fixed
  to the hand. It can also rig the game's player suit (`nasa-astronaut.glb`) exactly like `src/suit.js`.
- **The SEV rover's six wheels** are cut out of its mesh: they roll by the distance driven (backwards when reversing),
  spin in place when stuck, the body rides its suspension, and dark tread marks are left behind (`rover_motion()`).
- **Dust, steam and smoke** are crossed soft cards whose vertex alpha fades to nothing at a lumpy rim, in three
  shapes and tints. Unlike a Blender-only shader trick, this survives glTF export (three.js multiplies alpha by
  `COLOR_0.a`). The air leak adds a directional jet.
- The soil texture tiles every 11 m and the ground carries broad colour patches, so the tiling does not show.
- Long captions are split in two automatically (no line over ~58 characters), and the in-game subtitles are larger,
  at most three lines, and kept clear of the phone's safe areas.
- Every rover and astronaut route is checked against buildings and walkways, and the films with both were checked
  for rover-astronaut clearance (at least 3 m) through the live Blender MCP.
- Previews render with EEVEE ray tracing (soft reflections, contact shadows, ambient light) at 32 samples.

## Captions for the game

Every film's subtitles are in `glb/<name>.captions.json` (start and end in seconds, plus `who` and `phase` for the
Ares VI briefing). The player shows them, and the preview videos have them burnt in. Lines are written short for
young players and phones: one line each, 55 characters at most; anything longer is split in two at the punctuation
nearest the middle. One wording change from the storyboard for accuracy: the ISRU line says it "pulls water from
icy soil and oxygen from the CO₂ air" (MOXIE on Perseverance makes oxygen from Mars's CO₂ air; water comes
from ice in the ground).

## Real Mars notes (what is real, what is squeezed)

- **Ares VI briefing** (speaker: Director Hale; phase titles top left): the seven lines from the storyboard. One change for accuracy: "turns regolith into oxygen and water" became "pulls water from icy soil and oxygen from the CO₂ air" (MOXIE on Perseverance makes oxygen from Mars's CO₂ air; water comes from ice in the ground).
- **Briefing:** Your mission: fly to Mars and build an outpost · Earth and Mars both circle the Sun; Mars is farther out and slower · Launch when Mars is about 44 degrees ahead of Earth · The ship coasts on a curved path around the Sun… and meets Mars about 259 days (8.5 months) later · Earth and Mars line up for launches only every 26 months · Build a working outpost before the next ships arrive
- **Launch:** event times follow Artemis I. The climb is squeezed about 19× after the tower, and the path is a simple gravity turn, not the real trajectory.
- **Cruise:** the minimum-energy transfer takes about 259 days (8.5 months); faster paths take 6–7 months. The ship is the game's space-pack station (scaled to ~48 m), with a crew capsule scaled to Orion's 5 m and a solar-electric (ion) propulsion module. Mars and Earth are placed for the picture, not to scale.
- **Approach:** Mars at last; the ship is still moving at thousands of km/h · Engine burn against the direction of travel: slowing into orbit · The landing pod undocks and drops toward the planet · Choose where to land
- **EDL:** crew-size landers (20 t or more) are too heavy for parachutes in Mars's thin air, so NASA studies use supersonic retropropulsion, as shown here. `src/edl.js` shows the parachute and sky crane that Curiosity and Perseverance (~1 t) really used. The heat shield's size and the timing are illustrative; real EDL takes about 7 minutes.
- **Outpost:** 26 months is the real gap between Earth–Mars launch windows, so the next ships can set out after it. (A crew that lands after a minimum-energy transfer gets its first return window about 15–16 months after landing, so the clip no longer says "time to go home" at month 26.) Fission units like NASA's Kilopower / Fission Surface Power give steady power through storms; real ones would sit about 1 km from the habitat (150 m here, so they stay in shot). The propellant plant is MOXIE's idea scaled up. Bagged-soil walls cut some of the radiation, not all of it.
- **Storm:** kept to the game's "Real Mars" card: thin air, so wind can't knock things over; the danger is the dimmer Sun. Blowing dust moves at about 25 m/s. Real storm fronts are usually more gradual than this haze bank.
- **Failure:** game-authored scenario. The bolt falls under Mars gravity, 3.71 m/s².
- **Rover stuck:** soft sand under a dust crust · Stuck! The wheels spin and dig in · Spirit got stuck like this in 2009 and never got out · Dig out the wheels and lay traction boards · Back out slowly · Free! Opportunity escaped a dune like this in 2005 after five weeks
- **Air leak:** A seal fails where the walkway meets the habitat · Mars air is so thin that cabin air rushes out, and its moisture freezes · Find the leak and seal it · Patch pressed on: the leak stops · The crew tops the air back up from the tanks
- **Ascent:** modelled on the Apollo 17 liftoff film (NASA, 14 December 1972): the descent stage is the launch pad and foil insulation bursts out. Mars needs about 4.1 km/s to orbit, against the Moon's ~1.9 km/s, and has 2.2× the Moon's gravity. So the ascent stage carries four large methane/oxygen tanks, made on Mars by the outpost's plant. Its climb is illustrative.

## Models used

All from this repo: `assets/sls.glb`, `assets/mobile-launcher.glb` (NASA), `assets/sev.glb` (NASA Space
Exploration Vehicle), `assets/astronaut.glb`, `assets/greenhouse-walkway.glb`,
`assets/nasa/shelter/orbital-replacement-unit.glb` (NASA 3D Resources), and the space pack's lander, hab, orbital
station and Artemis-style rocket (`assets/space-pack/`). Planet maps: `assets/mars-map.jpg` and `assets/earth-map.jpg`.
**Mars ground** (`mars_ground()` in `scripts/mars_kit.py`) is built from the game's own terrain data: the real MOLA
heights of Gusev Crater (`assets/terrain/gusev-mola-128.*`, mapped exactly as the game maps them: 960 m square, heights
×0.015, flat base), the real ground brightness from Viking/TES (`assets/terrain/gusev-albedo-256.*`, darker where dust
has blown off basalt sand), small impact craters and bumps, a tiled soil texture generated by the script, and about
150 of the game's textured boulders (`assets/mars-rocks.glb`) at 0.25–3 m. The mesh is dense near the action and
sparse far away. The landing film uses the same data stretched over 9 km.
Heat shield, backshell, solar trackers, fission units, propellant plant, dish, soil walls, flames and dust are
simple shapes made by the scripts. Large NASA meshes are decimated (SLS to 35%, SEV to 5% with 512 px textures)
to keep the GLBs small. All eleven GLBs together are about 11 MB.

## Crew in the Ares VI briefing

Blender's glTF round trip breaks the game's Mixamo crew rigs (even importing `assets/crew/ch22.glb` and exporting it
again, unchanged, flips the limbs in three.js). So the briefing GLB does not contain the people: it carries one
**crew slot** per person - an empty named `crewslot_<name>` with extras `crew_char`, `crew_clip`, `crew_offset`,
`crew_speed`, `crew_height` and an optional clothing tint - plus Director Hale's movement. `src/cinematic.js` loads
the real character at each slot and retargets the clip exactly like `src/hab-crew.js` does in the hab.
Limitation: Hale's pointing and talking gestures and the crew's nods and glances are in the preview video (Blender)
but not yet in the game version, which plays the base idle/sit clips.

The Z-2 astronauts are rigged in Blender itself and export correctly (checked in three.js r0.160).

## Used in gameplay too

- **Player suit:** `src/suit.js` now dresses the player (and co-op crewmates and the suit on the rack) in the same
  NASA Z-2 suit, rigged at runtime with capsule skin weights. Its arm bones are bound already turned from "arm out" to
  the Z-2's forward-hanging arms, so every pose written for the classic suit (walk, run, jump, crouch, pickaxe) drives
  it unchanged. If the Z-2 cannot load, the classic `nasa-astronaut.glb` suit is used.
- **Pickaxe:** a geologist's rock pick modelled in Blender (`scripts/make_rock_pick.py` -> `assets/tools/rock-pick.glb`,
  59 KB): forged steel head with hammer face and pick, fibreglass handle, ridged rubber grip and a tether loop. It
  replaces NASA's Hammer model.
- **Mining:** one swing curve (`swingCurve()` in `src/suit.js`) drives the body and the first-person view: wind-up,
  overhead lift with a lean back, a fast strike that bends the knees, a 70 ms hit-stop as the pick bites, a recoil
  bounce, then recovery. Each strike throws rock chips in the ore's colour (falling in Mars gravity, 3.71 m/s2) and a
  soft puff of dust. Checked by `scripts/test-mining-suit-browser.py`.

## Timing

The rover repair film is timed at natural speed (`set_stretch(1.0)`): every action takes real time and the explanation
beats are held by the script's own frames. The other films still play 4/3 slower than their script frame numbers.

## Rebuild

```
cd game/animation/scripts
python build_all.py              # all twelve: .blend + GLB + preview MP4 (about 12 minutes on an RTX laptop)
python build_all.py storm        # just one
python build_all.py --no-video   # .blend + GLB only
```

For quick checks, run one script with stills, or build it in an open Blender through the Blender MCP
(set `ANIM_LIVE=1` so `reset()` empties the file instead of a factory reset, which would unload the MCP add-on):
`blender -b --factory-startup -P seq_storm.py -- --stills 60,200,320 --scale 40` (PNGs go to `stills/`, which is
not committed).
