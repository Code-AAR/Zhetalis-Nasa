# Hab interior fit-out (hab-dressing.js)

The six linked pods are now dressed as a place people live, not just a set of stations.
Everything is procedural (no new downloads) and lives in `src/hab-dressing.js`, called once from `crew-interior.js`.
Preview without playing: open `hab-preview.html` (buttons jump between pods; sliders for time of sol, crew size and sol).

## What real habitats taught us, and where it shows up

| Lesson | Source | In the game |
|---|---|---|
| Lay the hab out as a "gradient of privacy": work areas at one end, private crew quarters at the other, shared living in between | NASA CHAPEA, Mars Dune Alpha (BIG / ICON) | Pods run Airlock & power → Stowage & workshop → Life support → **Crew quarters** → **Wardroom & galley** → Science & fitness |
| Every crew member gets a private room; sound-dampened | CHAPEA (4 private quarters); ISS crew quarters; NASA sleep-environment review | Four 1.9 × 2.2 m cabins built off the Crew quarters pod, padded on the bunk side, with vent, reading light, fold-down desk |
| Vary ceiling heights so a year indoors isn't one same room | CHAPEA | Dropped 3.3 m ceilings in working pods; the Wardroom keeps its full height with a light ring and fabric baffles |
| All-white interiors with flat LED light got boring | HI-SEAS IV crew architect | Warm panelled walls, a colour band per pod, plywood in the Wardroom and cabins, rubber floor tiles |
| Don't route traffic past the dining table | NASA habitability lessons (ISS) | Wardroom table sits off the walkway between the hatches |
| Eat together | ISS crews at the Unity node galley table | Table for four, named mugs, salt & pepper bottles, a board game, the "Gusev Café" galley |
| Circadian lighting: bright blue-enriched mornings, neutral days, warm dim evenings | ISS Solid State Lighting Assemblies (4500 K work / 6500 K wake / 2700 K pre-sleep) | Ceiling panels, lamps and ambient light follow the sol clock |
| Crews decorate: mission patches by the hatches, photos and keepsakes in quarters | ISS archaeology project; crew patch decals in Unity | Patch decals round the Wardroom hatches; photo walls, kids' drawings, postcards, plush toy, guitar, orchid |
| Stowage everywhere; cargo transfer bags | ISS habitability lessons | Labelled cargo bags on racks in Stowage, spare cabins become stowage |
| Bathrooms near quarters and near the work end | CHAPEA | Hygiene stall in Crew quarters with towels in crew colours |
| Daily exercise | ISS treadmill & bike; CHAPEA fitness area | Treadmill with bungee harness and an exercise bike in Science & fitness, with an exercise log |
| Water is good radiation shielding | storm shelter design practice | Water bags around the storm-shelter bunks |

## The crew (fictional)
- **You** — junior astronaut. Your cabin still has your personal kit box half-unpacked.
- **Freya Lindqvist** — commander, from Gothenburg. Photo of her three kids (Elsa, Nils, Ebba), their "MAMMA ON MARS" drawings, running shoes, a chess game. Played by the Mixamo flight-suit character (Ch48).
- **Mei Lin Tan** — geologist, from Singapore (Mixamo Ch22). Hometown skyline photo, an orchid from the greenhouse, sketch of Home Plate strata, rock samples.
- **Mateo Rivera** — engineer, from Valparaíso (Mixamo Ch23). Guitar, photo of his dog Bruno, sticky-note reminders.

Lived-in cabins follow the difficulty's crew size (2 / 3 / 4); the rest are labelled SPARE · STOWAGE.
The calendar crosses off sols, and the whiteboard rotates chores and dinner each sol.

## Round 2: living, talking, sounding
- **Crew on a routine** (`src/hab-crew.js`): asleep in their cabins at night (doors shut with a "Zzz · sleeping" sign), breakfast and a treadmill run in the morning, work at the power rack / lab bench / life-support rack by day, dinner together in the Wardroom in the evening. Only crew of your difficulty's size appear. Press E to talk to them.
- **24 things to look at with E** (type `hab-note`): cabins, calendar, whiteboard (today's chores and dinner), galley, plush toy, patch wall, bookshelf, photo board, exercise log, Spirit's map, medical, seedlings, life-support racks, cargo bags, 3D printer, suit repair, dust zone, EVA checklist. Each adds one short real fact.
- **Sound per pod** (`sound.js`): equipment-fan whoosh in the working pods, a pulsing water pump in Life support, the galley fridge hum in the Wardroom, treadmill thumps when someone is running, and a quieter Crew quarters.
- **ISS-style hatches** with rounded frames, the hatch swung back into the tunnel, node labels and signs naming the next pod; tunnels have ribs, handrails and cable bundles.
- **Extra fill**: Wardroom photo board and herb shelf; suit-repair bench in the Airlock.
- **Performance**: each crewmate's fixed parts are merged and crew far from you are not drawn; about 70 draw calls in the Wardroom with three people at dinner.

## Sources
- NASA CHAPEA habitat: https://www.nasa.gov/chapea/habitat
- Mars Dune Alpha (BIG): https://big.dk/projects/mars-dune-alpha-4310
- HI-SEAS IV architect interview: https://www.archpaper.com/2017/10/university-hawaii-life-on-mars-nasa/
- NASA habitability mockup insights: https://ntrs.nasa.gov/api/citations/20220013673/downloads/Hab%20Insights%20from%20NASA%20Mockup%20Testing%20Campaigns.pdf
- NASA-STD-3001 architecture (dining traffic lesson): https://www.nasa.gov/reference/8-0-architecture-vol-2
- ISS dynamic lighting schedule: https://ntrs.nasa.gov/api/citations/20160006727/downloads/20160006727.pdf
- ISS crew patch decals: https://www.collectspace.com/news/news-110225a-25-years-continuous-humans-iss-crew-decals.html
- MDRS layout: https://en.wikipedia.org/wiki/Mars_Desert_Research_Station

## Round 3 (12 Nov): greenhouse rebuilt, hab fixes
**Greenhouse (`src/greenhouse.js`), all built in code now:**
- Four NFT hydroponic racks: aluminium frames, two white channels with net pots and rock-wool plugs, a catch tray, feed and return lines, a nutrient tote with pump under each rack, a five-bar LED light and an e-ink tag. Studied from NASA Veggie and the University of Arizona Lunar/Mars greenhouse.
- Better plants: red romaine rosettes, wheat tufts that grow ears and go gold, bushy potatoes with flowers and tubers. Each rack's plants are merged into a few meshes.
- Round the edge: germination shelf with seed trays and a humidity lid, potting bench (coir, perlite, pots, watering can, harvest log, Mei Lin's orchid, Mateo's chillies), harvest crates and a scale, tomatoes on strings, strawberry towers, two spinning fans, a climate panel, a nutrient mixing tank with pH/EC readout and hose reel, overhead water and nutrient pipes.
- Airlock is a real hatch now (frame, window, wheel, sign, hazard mat).
- Floor: epoxy with steel grating aisles and a drain.
- The tunnel to the hab replaces `greenhouse-walkway.glb`: ribs every 1.5 m, insulated walls with real rounded pressure windows, ceiling lights, cable tray, labelled water and nutrient pipes, handrails, hatch frames at both ends, a herb shelf.
- Six new things to look at with E (seed trays, potting bench, harvest crates, tomatoes, climate panel, fan).
- About 260 draw calls in the greenhouse.

**Hab fixes (`src/hab-dressing.js`):**
- Mission patches sat in the Wardroom doorways and floated; they are on the wall now.
- Tunnel cables ran through the hatch frames into the pods; now a short bundle in a tray inside the tunnel.
- Wardroom ceiling: the star of baffles is gone. Roof ribs and hub, a ring air duct, three felt acoustic clouds on wires, a proper ring pendant, fairy lights along the galley wall.
- Whiteboard and photo board stand off the curved wall, so their edges are no longer buried. Board text uses colons, not dashes. Photo board laid out so nothing overlaps.
- Cabin doors are modelled: raised panels, the owner's colour band, frosted strip, pull, louvred vent, status light, and something personal on each closed door.
- A matching hatch frame and sign at the back of Life support into the greenhouse tunnel.

**Lander (`src/world.js`):** ladder stand-offs and feet, grab bars by the hatch, hatch frame with hinges and handle, round port over the flat window, a grated step at the sill.

Preview: `hab-preview.html` (serve the game folder, then open it). Buttons jump to each room.
