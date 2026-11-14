# Mission sequences (Blender → GLB)

Eleven animated sequences for the game's flow, built in Blender 5.3 from the game's own 3D models. Each one is
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
| `briefing_mission.glb` (0.5 MB) | `briefing_mission` | 25.9 s | 1. New game: the mission plan. Sun, Earth and Mars on real orbits (distances to scale), the launch window (Mars 44° ahead), the 259-day transfer ellipse solved with Kepler's equation, and the 26-month goal. |
| `launch_earth.glb` (1.7 MB) | `launch_earth` | 22.9 s | 1. The ship launches after landing-site choice: SLS on Mobile Launcher 1 at Pad 39B. RS-25 start at 1.7 s, liftoff at 4.0 s, real time until it clears the tower, then about 19× faster: boosters drop at 17.6 s, abort tower off at 20.7 s. |
| `cruise_loop.glb` (0.4 MB) | `cruise_loop` | 12.0 s, seamless loop | 2. The seven-month trip as the loading screen (load saves here). The camera circles the transit ship once per loop; the ion-thruster glow and lights repeat exactly. Set `action.setLoop(THREE.LoopRepeat)`. |
| `mars_approach.glb` (0.4 MB) | `mars_approach` | 13.9 s | 2→3. Arrival: the docked capsule's engine brakes the ship into orbit, then the landing pod undocks. Plays right before you choose where to land. |
| `edl_mars.glb` (0.5 MB) | `entry` | 8.3 s | 3. Entry: heat shield glow at hypersonic speed. |
| | `descent_landing` | 17.6 s | Shell opens, engine fires while supersonic, powered descent, legs out at 9.6 s, touchdown at 15.0 s, dust. |
| `outpost_26_months.glb` (1.0 MB) | `outpost_26_months` | 31.9 s | 3. From the two landing pods to a full outpost, 1.125 s per month (month *m* starts at 1 + 1.125·*m* s). The empty `month_counter` holds the month number in `scale.x`. |
| `dust_storm.glb` (1.1 MB) | `dust_storm` | 17.9 s | 4. Random event: a regional dust storm. The front reaches the base at 7.9 s. The empty `sun_factor` holds the sunlight fraction in `scale.x` (1.0 → 0.35, matching the game's "about a third" power). |
| `failure_solar_panel.glb` (0.7 MB) | `panel_failure` | 8.0 s | 4. Random failure: a tracker motor stalls (2.9 s), the bracket gives and the panel sags (5.0 s), red beacon flashing. The empty `row_power` holds the row's output in `scale.x` (1.0 → 0.8). |
| | `panel_repair` | 7.9 s | The fix: rover brings a spare unit (NASA's Orbital Replacement Unit model), astronaut swaps it, panel back up, green light at 6.4 s into the clip. |
| `failure_rover_stuck.glb` | `rover_stuck` | 8.0 s | 4. Random failure: the rover digs into soft sand (Spirit, Troy, 2009). |
| | `rover_freed` | 9.0 s | The fix: dig out, traction boards, back out slowly (Opportunity, Purgatory dune, 2005). |
| `failure_air_leak.glb` | `air_leak` | 7.5 s | 4. Random failure: a walkway seal fails and cabin air vents as a frozen plume. The empty `cabin_pressure` holds pressure in `scale.x`. |
| | `leak_patched` | 7.5 s | The fix: patch the seal, top up the air, green light. |
| `ascent_mars.glb` (1.1 MB) | `ascent_mars` | 19.9 s | 3. Leaving Mars after 26 months: fixed camera like the Apollo 17 liftoff film, then a chase shot. Ignition at 3.0 s. |

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
| Start a new game | `briefing_mission`, then the live launch countdown (`src/launch.js`, unchanged) |
| After launch, and when you continue a saved game | the loading screen plays `cruise_loop` behind it (at least 9 s after launch, 4 s for a save) |
| Reaching Mars | `mars_approach`, then the landing-site picker |
| Landing | `edl_mars` (`entry` then `descent_landing`), replacing the old sky-crane film for the crew lander |
| Right after landing (new game) | `outpost_26_months`: the goal |
| First dust storm | `dust_storm` film; later storms use the in-world storm in your own base |
| Random failures (new) | `panel_failure`, `rover_stuck` or `air_leak`, then a pop-up. The fixes play `panel_repair` (press E at the solar panels, 1 part), `rover_freed` (press E at the rover) and `leak_patched` (patch from the pop-up or at an airlock door, 1 part). Unfixed panels and leaks get fixed by the rest of the crew after 8 and 5 sols. |
| Winning the mission | `ascent_mars`, then the mission-complete screen |
| Cutscenes menu | every film, to watch again |

## Captions for the game

These run in the previews only. The game can show the same lines at the same times.

- **Briefing:** Your mission: fly to Mars and build an outpost · Earth and Mars both circle the Sun; Mars is farther out and slower · Launch when Mars is about 44 degrees ahead of Earth · The ship coasts on a curved path around the Sun… and meets Mars about 259 days (8.5 months) later · Earth and Mars line up for launches only every 26 months · Build a working outpost before the next ships arrive
- **Launch:** Kennedy Space Center, Pad 39B: SLS rocket, 98 m tall · T−6 s: the four RS-25 engines start · T−0: both solid rocket boosters light, liftoff! · Clearing the 116 m launch tower · Faster than sound after about a minute (shown 19× faster) · T+2 min 12 s: boosters drop away, about 47 km up · T+3 min 11 s: the launch abort tower is jettisoned
- **Cruise:** Seven months to Mars: the ship coasts most of the way · Blue glow: ion engines pushing gently, day after day
- **Approach:** Mars at last; the ship is still moving at thousands of km/h · Engine burn against the direction of travel: slowing into orbit · The landing pod undocks and drops toward the planet · Choose where to land
- **EDL:** Entry at about 20,000 km/h: the heat shield glows at over 1,300 °C · Mars air is thin, but it still takes away most of the speed · Too heavy for a parachute: the shell opens and the engine fires while still supersonic · Rocket-powered descent: about 7 minutes from the top of the air to the ground · Landing legs out · Touchdown! The engine blast throws up dust
- **Outpost:** one line per milestone (pods, rover, solar trackers, fission reactors, first habitat, oxygen/methane plant, walkway, second habitat, soil shielding, dish, more solar, tanks filling, the launch window home). Full text is in `seq_outpost.py`.
- **Storm:** Its winds reach 17–30 m/s… but Mars air is so thin they push no harder than a breeze · The real danger is darkness: dust blocks the sunlight · Solar power drops to about a third; the fission reactors keep the lights on · A storm can last for weeks; the crew waits inside
- **Failure:** Every panel turns to follow the Sun… · Fault! One tracker's motor stalls · Its bracket gives way: the panel sags out of the sunlight · Repair: the rover brings a spare drive unit · Swap the unit, lift the panel, check the light · Green light: full power again
- **Rover stuck:** soft sand under a dust crust · Stuck! The wheels spin and dig in · Spirit got stuck like this in 2009 and never got out · Dig out the wheels and lay traction boards · Back out slowly · Free! Opportunity escaped a dune like this in 2005 after five weeks
- **Air leak:** A seal fails where the walkway meets the habitat · Mars air is so thin that cabin air rushes out, and its moisture freezes · Find the leak and seal it · Patch pressed on: the leak stops · The crew tops the air back up from the tanks
- **Ascent:** Month 26: tanks full of oxygen and methane made on Mars · Ignition! The landing stage stays behind as the launch pad · Mars needs about 4.1 km/s to reach orbit, more than twice the Moon's 1.9 km/s · That is why this ascent stage carries so much more fuel than Apollo's · Next stop: the transit ship in orbit, then seven months home

## Real Mars notes (what is real, what is squeezed)

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
Heat shield, backshell, solar trackers, fission units, propellant plant, dish, soil walls, flames and dust are
simple shapes made by the scripts. Large NASA meshes are decimated (SLS to 35%, SEV to 5% with 512 px textures)
to keep the GLBs small. All eleven GLBs together are about 9 MB.

## Rebuild

```
cd game/animation/scripts
python build_all.py              # all eleven: .blend + GLB + preview MP4 (about 12 minutes on an RTX laptop)
python build_all.py storm        # just one
python build_all.py --no-video   # .blend + GLB only
```

For quick checks, run one script with stills:
`blender -b --factory-startup -P seq_storm.py -- --stills 60,200,320 --scale 40` (PNGs go to `stills/`, which is
not committed).
