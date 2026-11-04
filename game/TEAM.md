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

- Title screen with difficulty (Cadet / Explorer / Commander), Mars chosen, Moon "coming soon".
- Launch from Earth with countdown and lift-off, then the 7-month cruise (real radiation fact).
- 3D Mars surface (Three.js): walk around in real Mars gravity (3.73 m/s² - you jump higher), collect ice and metal, salvage NASA's real Perseverance rover model, collect supply pods from Earth.
- The outpost: split power between **life support, talking to Earth, science and shielding**. Every choice has a cost. Upgrades cost credits (the currency), earned by sending science to Earth.
- Events: solar storms based on **real flares** (NOAA GOES live data, NASA DONKI when it is online), dust storms (Opportunity 2018 fact), solar conjunction radio blackout.
- In-game "Real NASA data used" panel with every source.

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
node scripts/fetch-nasa-data.mjs    # saves 2 years of NASA DONKI events (when DONKI is online)
```
