# Junior Astronaut: Mars Outpost - team guide

**Live game:** https://code-aar.github.io/Zhetalis-Nasa/game/
**Challenge:** NASA Space Apps 2026 - *Build a Junior Astronaut Mission Trainer*
(kids 7-12 run a Moon/Mars outpost and learn real trade-offs: life support, radiation shielding, power, food, communication delay).

## Run it on your own computer

You need Python (or Node). From the repo folder:

```
python -m http.server 8123
```

Then open http://localhost:8123/game/ . (Opening `index.html` directly does not work - browsers block loading the data files that way.)

## What is in v1

- Title screen with difficulty (Cadet / Explorer / Commander), Mars chosen, Moon "coming soon", and a "How do we get to Mars?" explainer.
- **SLS launch** from Earth (orange core stage, two boosters, Orion + abort tower) with countdown captions.
- **Mission-path explainer** after lift-off: SLS → Orion → lunar orbit (NRHO) → HLS lander → Moon → home, then NASA's Moon-to-Mars plan (transit habitat, Mars lander, ascent vehicle) - each step with a sourced NASA fact.
- 3D Mars surface (Three.js): walk around in real Mars gravity (3.73 m/s²), **V switches first/third person**, collect ice and metal parts, salvage NASA's real Perseverance rover model, open supply pods from Earth.
- **Walk inside the outpost** (first person): power console (the power split), workbench (build upgrades), greenhouse, storm-shelter bunks, window, airlock. Time keeps running inside and you are shielded.
- **No money/credits.** Upgrades are **built from parts** you salvage, and their **designs arrive from Earth** once Earth has received enough of your science - so the radio and science still matter.
- Events: solar storms based on **real flares** (NOAA GOES live data, NASA DONKI when it is online), dust storms (Opportunity 2018 fact), solar conjunction radio blackout.
- In-game "Real NASA data used" panel with every source.

## Day/night + power update (storyboard "core")

- **Time:** 1 real second = 1 Mars hour, so a sol (24.66 h) takes about 25 s. Missions: Cadet 40 sols, Explorer 80, Commander 150.
- **Day/night:** the Sun rises and sets, the sky gets dark, stars come out and a **blue Mars sunset** glows (NASA Curiosity, 2015). A headlamp comes on at night. The HUD shows Day/Night, Mars time, battery % and base tier.
- **Batteries + heater:** solar only works in the day. At night the heater runs from the batteries; when they run out, the crew gets cold and suits use air faster. Build more batteries at the workbench.
- **Dusty panels:** dust slowly covers the panels (real problem for Spirit/Opportunity). Walk up to them and press **E** to clean them. Sometimes wind cleans them for you.
- **Relay orbiter failure:** sometimes a relay orbiter fails (like MAVEN in 2025), so talking to Earth costs 2.5× the power until it is fixed.
- **Regolith burial:** pile Mars soil over the outpost for strong radiation shielding.
- **Tiers:** Landing camp → Sealed base → Industrial outpost → Self-sustaining settlement. Each tier unlocks when Earth has received enough of your science (40 / 120 / 260) and brings new designs: panels and greenhouse, then MOXIE and water walls, then a **fission reactor** (NASA Fission Surface Power, 40 kW) that works at night and in dust storms.
- **Win:** reach the settlement tier with a reactor, more oxygen and food made than used, and at least half the mission done. Otherwise survive to the last sol.

## Learning-journey update (real NASA pictures + course topics)

- **Real NASA pictures, loaded live** (like the Space Apps "Earth Change Slideshow" guide, but for Mars):
  - Outpost **window** = slideshow of the newest colour photos from **Perseverance** (Mastcam-Z), with sol and date.
  - **Power console** = today's photo of the whole **Earth** from NASA's **EPIC** camera (the people you are radioing).
  - **Arrival globe** = NASA **Mars Trek** map (Viking orbiters colour mosaic) with Jezero Crater marked.
  - If NASA is down, a saved list is used and labelled ARCHIVED. Refresh it with `node scripts/snapshot-nasa-images.mjs` (uses the NASA key from `.env` for EPIC; the saved file has no key in it).
  - The Mars Rover Photos API that many tutorials use is **dead** (404 "No such app") - don't use it.
- **Launch phases** (Artemis I timeline): lift-off → max-Q → boosters off (2:12) → escape tower off (~3 min) → core stage off (~8 min) → orbit. The parts really drop away.
- **Launch window** step in "How do we get there?": Hohmann transfer diagram, why Mars launches happen every ~26 months.
- **Landing at Mars**: heat shield → parachute → rockets → "seven minutes of terror" (radio is slower than the landing).
- **Logbook (L)**: every fact you meet becomes a card. **End-of-mission quiz** (3 questions from your cards) → Gold/Silver/Bronze Junior Astronaut badge.

## NASA's own 3D models (from NASA 3D Resources - free, no copyright)

| File | What | Where it appears |
|---|---|---|
| `assets/sls.glb` | SLS Block 1, made from NASA's 3D-printing model by `scripts/build-sls-model.py` (split into core / boosters / upper stage / Orion / escape tower so they drop off in flight) | Launch |
| `assets/mobile-launcher.glb` | Mobile Launcher (116 m) | Launch pad |
| `assets/mro.glb` | Mars Reconnaissance Orbiter, a relay orbiter | Circling the arrival globe |
| `assets/ingenuity.glb` | Ingenuity helicopter, real size | Near the old rover (press E) |

They use Draco compression, loaded by `src/nasamodels.js`. If one fails to load, the game keeps its simple shapes.
To rebuild SLS: download `3D Printing/Space Launch System (SLS) Block 1` from https://github.com/nasa/NASA-3D-Resources and run
`python scripts/build-sls-model.py "Space Launch System (SLS) Block 1.stl"` (needs numpy).
The launch pad layout (lightning towers, water tower, mound) follows NASA's Artemis II launch photos; step 1 of
"How do we get there?" shows a real Artemis II launch photo from the NASA Image and Video Library.

## Sound, animation and more real data (5 Nov)

- **Real sound of Mars:** the wind outside is NASA's recording from Perseverance's SuperCam microphone (sol 4, 22 Feb 2021),
  `assets/sound/mars-wind-perseverance.mp3`. The game adds suit breathing (faster when your air is low), a suit fan, soft
  footsteps, the outpost's life-support hum and the launch rumble. **M** or the 🔊 button mutes. Mars is quiet - NASA found
  sound fades after ~8 m there - so the mix is deliberately soft and muffled.
- **Smooth astronaut:** speeds up and slows down, turns smoothly, bouncy low-gravity lope, leans, swings arms and legs,
  breathes when standing still, squashes when landing; gentle head bob in first person and inside the outpost.
- **Modelling (Sidney, Charm):** `astronaut.glb` currently has no skeleton, so only the whole body moves. If you export a
  **rigged** astronaut with animations named **Idle**, **Walk** and **Run** (Mixamo works), the game plays and blends
  them by speed automatically - no code needed.
- **Real Mars weather** (Curiosity rover, daily report) in the outpost window, and **today's real Earth-Mars distance**
  (NASA JPL Horizons) on the console. Refresh before a demo: `node scripts/snapshot-mars-data.mjs`.

Voice lines the game can already play (add to the table above): `relay.mp3` (a relay orbiter fails) and `design.mp3`
(Earth sends new designs).

## 🎨 Art slots (illustrations - ChatGPT image generation or hand-drawn)

The game has slots for a title-screen picture, logo, quiz badges, Mission Control and commander portraits, event
pictures, fact-card pictures, a ground texture and a story comic. Drop a picture in `game/assets/art/` with the slot
name and list it in `game/assets/art/art.json` - it appears automatically, labelled "Illustration".
**Full brief with sizes, rules and prompts: [`game/assets/art/README.md`](assets/art/README.md).**
Most important: no NASA logos, no text in pictures, daytime Mars sky is butterscotch (not blue). Check with
`node scripts/check-art.mjs`.

Debug for testers: open the game with `#debug` at the end of the address, then in the browser console use `game.phase(0.75)` (sunset), `game.event('relay-lost')`, `game.outpost.parts = 30`, `game.goInside()`.

## Who does what

### Modelling - Sidney, Charm
Save models as **.glb** (glTF binary) into `game/assets/` with these exact names and they replace the placeholder automatically - no code needed:

| File | Replaces | Tips |
|---|---|---|
| `astronaut.glb` | the player | Stand on the ground at (0,0,0), face +Z, any size (it is scaled to 1.85 m) |
| `hab.glb` | the main outpost dome | Door should face +Z |
| `lander.glb` | the ship you arrive in | Upright, about 11 m tall |

Keep each file under ~5 MB (big files load slowly on school laptops). Low-poly / flat-shaded matches the current look (No Man's Sky style, Mars colours from Perseverance photos).
The Apollo capsule interior on Sketchfab is CC BY 4.0 (credit "James / Smithsonian") but marked **NoAI** - a person should download and use it, not an AI tool.

### Programming - James, Aaron, Theo, Yuxuan
One person per file avoids merge conflicts. Suggested next pieces:

- **Drivable rover + drill** (`src/rover.js`): get in a rover with E, drive faster, drill rocks for ice/metal. Driving should cost power (that is the trade-off).
- **Health** (`src/health.js`): your notes have a health level - e.g. falls when suit air runs out or radiation is high, slows you down.
- **Story / missions** (`src/story.js`): objectives like "repair the comms dish", "find the old rover", told by voice lines.
- **Touch controls + sound effects** (`src/input-touch.js`): so it works on tablets in classrooms.

`src/sim.js` holds all the rules and numbers; `scripts/balance-test.mjs` plays 480 missions in a second to check a change doesn't make the game too easy or impossible:

```
node scripts/balance-test.mjs
```

### Storyboarding - Sidney, Charm, Theo, James
Two things to decide:
1. **"Earth is gone"** in the notes vs. **"talk to Earth for supplies"** - these clash. v1 keeps Earth (the radio trade-off needs it). Maybe Earth is in trouble, not gone?
2. Leave real people (e.g. Elon Musk) out of the story - it is a kids' NASA game and judges may mark it down.

### Voice acting - James, Charm
Record short lines as **.mp3** into `game/audio/` with these names. Missing files are skipped, so add them whenever they are ready.

| File | When it plays | Example line |
|---|---|---|
| `countdown.mp3` | launch countdown | "T-minus 10... 9... 8..." |
| `welcome.mp3` | landing on Mars | "Welcome to Mars, junior astronaut. Let's get the outpost running." |
| `storm.mp3` | solar storm warning | "Solar storm incoming! Get inside or boost the shields!" |
| `dust.mp3` | dust storm | "Dust storm! Our solar panels are losing power." |
| `conjunction.mp3` | radio blackout | "The Sun is between us and Earth - we're on our own for two weeks." |
| `supply.mp3` | Earth sends a pod | "Earth heard us! A supply pod is on its way." |
| `rover.mp3` | finding Perseverance | "Whoa - that's Perseverance! It's been here over a hundred years." |
| `win.mp3` / `lose.mp3` | end of mission | "Mission complete!" / "We have to head home..." |

### Editor - Aaron
The demo video for judging (1-2 minutes): show one real trade-off, e.g. a solar storm based on a real flare, choosing shielding vs science, and the "Real NASA data used" panel.

## Data rules (from the challenge brief)
- Use real NASA data where possible. Put new facts in `game/data/mars-facts.json` **with a source link**.
- Numbers we invent for balance go in the `tuned` section and the game says so.
- Never show saved data as live: the game labels data **LIVE** or **ARCHIVED**.
- The NASA API key lives only in `.env` (git ignores it). Do not paste it into game code - anything in a website is public.

## Updating the real data
```
node scripts/snapshot-noaa.mjs      # saves this week's real space weather
node scripts/snapshot-nasa-images.mjs  # saves backup links to real Perseverance + EPIC photos
node scripts/snapshot-mars-data.mjs    # saves Curiosity's latest Mars weather + today's Earth-Mars distance (JPL Horizons)
node scripts/fetch-nasa-data.mjs    # saves 2 years of NASA DONKI events (when DONKI is online)
```

## Shared Settings and fact library (8 November 2026)

- `src/settings.js` exposes `initSettings({facts,destination,actions,controlsHtml})` and `openSettings({tab,topic})`. `actions.save` runs before graphics reload; optional `sources`, `fullscreen` and `view` wire destination-specific actions.
- The browser event `open-settings` with `{tab:'information',topic:'moon-gravity'}` opens an article directly. Both destinations share `data/information.json`, Mars facts and Moon facts. Custom discovered facts come from `ui.js`'s logbook.
- Keep gameplay facts short with `short`, then link the full sourced article. Equations have SI units and assumptions. Course images have separate provenance from NASA media.
- `audio-preferences.js` owns master/music/ambience/effects/voice and mute. `ambient-music.js` starts on a gesture and advances via `tickMusic`. Music is an original score, not a scientific recording.
- Default Mars detailed terrain covers the minimap's 240 m span. `test-chunk-plan.mjs` checks circle coverage and bounded residency. `test-audio-preferences.mjs` checks mute and unavailable storage.
- Never expose `.env` through a static site. NASA image library requests need no API key; keyed feeds must be fetched by local/server scripts and published as dated snapshots.


### Full quality, phone Lite and lunar quests (8 Nov)
Auto graphics selects full quality on computers/tablets and Lite on phones; this is independent of the screen-layout preview. A phone can choose Full quality. See src/device-profile.js and scripts/test-device-profile.mjs. Full NASA Moon geometry/texture is unchanged; phone Lite is a separate asset, never an automatic desktop downgrade. Moon quest logic is in moon/src/quests.js, with grouped log, active map target and auto-collapsing objective. Movement is walk2/sprint4 m/s, jump2.9 m/s launch with lunar gravity. Treat these speeds as game tuning.


### Spirit's stops and the bigger map (9 Nov, Ewan)
- The map is 1,216 m (19 chunks of 64 m). The NASA MOLA crop fills the middle 960 m; past about 420 m the ground fades to invented swells.
- Five stops from Spirit's trip: `src/site-data.js` (facts, sources, positions) and `src/stop-models.js` (the 3D scenes). `src/sites.js` places them, adds the flag and sign, and handles E.
- Look at any stop on its own in `stop-viewer.html` (open `http://localhost:8000/game/stop-viewer.html?stop=homeplate`).
- Home Plate's ragged outline and cliff are in `src/landmarks.js` (`plateRadius`, `plateProfile`). The layered rim is one mesh that follows the ground all the way round.
- The silica stop is Gertrude Weise (Tyrone was a sulfate soil nearby). Old saves that say `tyrone` load as `gertrude`.
- Each stop is merged into a few meshes. Past 230 m only the flag, sign and Home Plate's rim are drawn.
- `src/detail-cull.js` skips drawing any mesh smaller than about 3 px on screen. It switches render layers and never touches `.visible`. It cut draw calls by 35 to 47% away from the base.
- No emoji on screen: `keepScreenEmojiFree()` in `src/ui.js` strips them from all page text. Arrows like ↗ and ▶ stay.

### Mineral zones and three new map spots (9 Nov, Ewan)
- Each mineral now sits where Spirit found it: `src/resource-zones.js` (zones, starter cache near camp, soft soil). Rocks still renew daily.
  - Hematite: West Spur (foot of the hills). Sulfate salt (save key `gypsum`): Paso Robles, Arad, Tyrone. Silica: Silica Valley by Home Plate. Carbonate (rare, +10 science): Comanche. Meteorite iron: the meteorite field on the west plain.
- Two new minerals, `silica` and `carbonate`. The extra solar panel now costs 2 hematite, 2 silica and 4 parts (silica makes the cover glass).
- The water plant can bake 3 L of water out of 1 sulfate salt (game balance). The ice pickups are labelled game balance (Gusev is near the equator).
- Salty soil slows the rover by up to 55% (`softSoil` in `rover.js`). Arriving in a zone shows its name once.
- New map spots with fact cards (`src/mapstate.js`): Ma'adim Vallis (the channel through the south rim, from the NASA height data), the meteorite field, and the dust devil plain with dark tracks (`buildDustDevilTracks` in `stop-models.js`).
- Ore fact cards now describe Spirit's finds (`data/mars-facts.json`: gusevHematite, sulfateSalt, gusevMeteorite, silica, carbonate). The old Opportunity cards are still there.
- Old saves: mined-rock ids from before the move are dropped, and the new minerals start at 0.

### Real light and dark ground (9 Nov, Ewan)
- Inside the measured area, the ground colour follows NASA albedo maps (how much sunlight the ground reflects).
  - Sources: Viking Orbiter colour mosaic (925 m) for the pattern, scaled to Mars Global Surveyor TES albedo for the real values. Both from USGS Astrogeology.
  - Baked file: `assets/terrain/gusev-albedo-256.bin` (256 x 256 bytes, north row first) plus `.json` (sources, range, scale).
  - Rebake: `python3 -I scripts/bake-gusev-albedo.py <Viking ClrMosaic tif> <TES albedo tif>`. The tifs are too big for GitHub, so keep them local.
- `groundAlbedo(x, z)` in `src/world.js` gives dark, bright and a weight. It fades out past the measured area, same as the heights.
- The contrast is boosted about three times. Real Gusev only spans albedo 0.22 to 0.26, which you could not see on a screen.
- The darkest real ground is about 200 m north of camp. The dust devil plain and its tracks moved there to match.
- If the file fails to load, the old made-up colour patches come back. Nothing breaks.
