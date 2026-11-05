# Art slots - illustrations for the game

Drop a picture in this folder with one of the names below, add the file name to `"files"` in `art.json`,
refresh the game, and it appears. **No code needed.** Empty slots just show nothing.

Check your files with: `node scripts/check-art.mjs` (sizes, names, missing files).

## Rules (please read - these protect our Space Apps entry)

1. **No NASA logos or NASA lettering** (the round "meatball" or the red "worm"). Space Apps strictly limits their use.
   Image generators love adding them - check every picture. Use our Zhetalis logo instead.
2. **No text inside pictures** - AI text comes out garbled, and the game writes its own captions.
3. **No real people's faces** (no real astronauts, no celebrities).
4. **Illustrations are never "real photos".** The game labels every picture from this folder "Illustration" automatically.
   Real NASA photos in the game are labelled REAL / LIVE. Don't put AI images anywhere else in the game.
5. **Mars must be accurate:**
   - Daytime sky is **butterscotch / pale tan-orange**, never blue. **Sunsets are blue** around the Sun.
   - Ground: rusty orange-brown dust, flat dark rock slabs, small pebbles (like Perseverance's photos of Jezero Crater).
   - No plants, water, clouds of rain or breathable air outside. Plants only inside the greenhouse.
   - Astronauts outside always wear full suits and helmets.
   - Two tiny moons (Phobos and Deimos) if a night sky is shown - not a big Moon.
6. **Keep files small** (school laptops!) - limits are in the table. Save as `.webp` (or `.png` when it needs transparency).
7. Add a credit line in `art.json` -> `"credit"`, e.g. `"Illustrations made by team Zhetalis with ChatGPT image generation (AI)."`

## Style guide (paste this at the start of every prompt)

> Stylised low-poly 3D illustration, flat-shaded facets, soft warm lighting, friendly and hopeful mood for children aged 7-12,
> clean shapes, no text, no logos. Colour palette: rusty Mars orange #b8643a, dusty tan #d99467, pale sand #e2ab7f,
> dark basalt #5e3626, accent orange #ff7a3d, soft blue #8fd4ff, gold #ffd27a. Astronaut: white spacesuit with one orange
> band around the chest, dark tinted visor, small backpack. Outpost: white dome habitat with an orange stripe and teal round
> windows, solar panel field, a small comms dish, a greenhouse dome.

## The slots

| File name | Where it shows | Size (px) | Max size | Prompt idea (after the style guide) |
|---|---|---|---|---|
| `title.webp` | Title screen background | 1920×1080 | 350 KB | A junior astronaut standing on a ridge looking down at the small outpost in Jezero Crater, butterscotch sky, wide view, lots of calm empty space in the middle for text |
| `logo.png` | Title card + browser icon | 512×512, transparent | 150 KB | A simple badge-style logo for a team called Zhetalis: a stylised astronaut helmet with Mars reflected in the visor (no letters - we add the name ourselves) |
| `icon.png` | Browser tab icon (optional) | 256×256, transparent | 60 KB | The helmet from the logo only, very simple |
| `badge-gold.png`, `badge-silver.png`, `badge-bronze.png` | End-of-mission quiz badge | 512×512, transparent | 120 KB each | A round mission patch: a junior astronaut, Mars and a rocket; gold / silver / bronze rim (same design, three metals) |
| `crew-commander.webp` | Welcome message speaker | 512×512 | 80 KB | Friendly portrait of the outpost commander in a white suit with the helmet off, inside the habitat, head and shoulders |
| `mission-control.webp` | Speaker on every event pop-up | 512×512 | 80 KB | Friendly portrait of a Mission Control operator with a headset in front of screens showing Mars, head and shoulders |
| `event-solar-storm.webp` | Solar storm warning | 1280×720 | 200 KB | The Sun releasing a bright flare, streams of particles flying toward small Mars, outpost glowing alarm lights |
| `event-dust-storm.webp` | Dust storm | 1280×720 | 200 KB | A huge orange dust storm rolling over the outpost, solar panels half covered in dust, sky dim |
| `event-conjunction.webp` | Sun blocks the radio | 1280×720 | 200 KB | Space diagram-style scene: Earth and Mars on opposite sides of the Sun, radio waves blocked by the Sun's glare |
| `event-relay-lost.webp` | Relay orbiter fails | 1280×720 | 200 KB | A satellite orbiting Mars with a dead antenna, small "no signal" feel, outpost below |
| `event-tier-up.webp` | Base grows to a new tier | 1280×720 | 200 KB | The outpost bigger than before: more domes, a greenhouse, buried habitat mound, happy astronauts |
| `fact-<id>.webp` | Picture on a fact card + logbook (e.g. `fact-edl.webp`) | 512×512 | 80 KB | See "fact pictures" below |
| `mars-ground.webp` | Ground texture across the whole map | 1024×1024, **seamless/tileable** | 250 KB | Top-down seamless tileable texture of Mars ground: fine dust and small pebbles, **light and fairly neutral tan** (the game tints it), no shadows from one direction, no big rocks |
| `story-1.webp` … `story-6.webp` | "📖 The story" comic on the title screen | 1280×720 | 200 KB each | Wait for the Storyboard team's decision ("Earth is gone?" vs "Earth sends supplies"), then one panel per story beat |

### Fact pictures (best ones first) - name them `fact-<id>.webp`

| id | Picture idea |
|---|---|
| `edl` | A capsule with a glowing heat shield entering Mars's air, then a big parachute (two-step comic) |
| `regolith` | Astronauts shovelling orange soil over a habitat dome to make a radiation shield |
| `dustPanels` | An astronaut wiping dust off a solar panel with a soft brush |
| `launchWindow` | Top-down diagram: Sun in the middle, Earth and Mars orbits, a curved path from Earth to where Mars will be |
| `hls` | A lander waiting near the Moon, a capsule docking with it |
| `oxygen` | An astronaut breathing, with a little bubble showing "0.82 kg a day" as a stack of oxygen tanks (no text!) |
| `conjunction` | Earth - Sun - Mars in a straight line, radio waves stopped by the Sun |
| `fission` | A small compact reactor with radiator fins on the Mars surface powering lights at night |

### Story panels (`art.json`)

```json
"story": [
  { "file": "story-1.webp", "caption": "The year is 2126..." },
  { "file": "story-2.webp", "caption": "..." }
]
```

## How to add a picture

1. Generate it, check the rules above (logos! text! blue sky!).
2. Resize to the size in the table and save as `.webp` (e.g. with https://squoosh.app), under the size limit.
3. Put it here with the exact name, and add the name to `"files"` in `art.json`:
   ```json
   { "credit": "Illustrations made by team Zhetalis with ChatGPT image generation (AI).",
     "files": ["title.webp", "logo.png"], "story": [] }
   ```
4. Run `node scripts/check-art.mjs`, refresh the game, look at it, then commit.
