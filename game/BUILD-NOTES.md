# Build notes

This folder is a standalone copy of the existing game with the supplied UNITY
assets integrated. The repository and original model files were not rewritten.

The habitat exterior is an adapted model with approximate circular collisions.
E at the marked hatch transitions into a newly arranged six-module interior;
it is not a continuous exterior-to-interior physics simulation. Corridors are
walkable, and station interaction now favours the direction the astronaut faces.
Future work can refine mesh collisions, ladders, transition animation and every
hatch approach. The supplied model's static details remain part of its artwork.

The open-world design uses the existing 640 m terrain with several-hundred-metre
operations routes, rather than a new planet-scale engine. Height exaggeration is
reduced consistently for terrain and movement. Crops remain inside greenhouses;
the subsurface survey does not presume a confirmed near-equatorial ice deposit.

The retained habitat has approximately 144k triangles. Reduced textures and
distance-based meteorite detail help, but further mesh LODs should precede a
performance claim for low-end phones or school computers. Simulation time and
rover speed are compressed game choices, explained in the game's science panel.

Startup depends on external Three.js and decoder CDNs. Live science services may
be unavailable; existing archived fallbacks and dates are retained. The raw 83 MB
FBX and full terrain STL are not loaded into the playable scene. The meteorite
uses the supplied STL close up and a lighter distant silhouette.

No Git push was performed for this separate build. The earlier standalone
loading-screen commit was already pushed to both existing repositories.

Habitat enlargement: 34 m to 102 m overall footprint. Interior bays and corridors were enlarged accordingly, the apron flattened consistently with collision heights, and support vehicles moved clear of the expanded base.


Revision 3: integrates the repository walk-in greenhouse and four working hydroponic beds with persistent First Harvest quest (+12 science, once), piped water, power-gated growth and food harvest. Original repository code credited in Git to Zagyu. Reuses its distance-based gait and exponential movement easing, smooths the follow-camera target and throttles HUD DOM writes to 10 Hz. Static supplied astronaut mesh removed; playable NASA suit remains animated. No remote push.


Access revision 7: replaces decorative stairs with six 2.4 m-wide, 2.4 m-high stair approaches and 2.65 m-tall airlock doors. Movement now follows the stair surface, module colliders permit the marked entrance lanes, and every module has its own E interaction. Entry and exit preserve the selected module, including after save/resume. Pressure links are 4.4 m in diameter. The greenhouse is behind the habitat row so its larger tube leaves all front stairways clear. Browser checks climbed and descended all six stairs using the normal movement update, entered and exited using E, checked remaining wall collisions, and verified save/resume plus the greenhouse hatch route without runtime errors. No push.


Revision 8: greenhouse glass and all three lander windows now look into the actual outside scene, using an aligned world camera and a second interior render pass. The former painted panorama and cabin window textures were removed. Views follow player position, terrain, camp geometry, sky, weather and time of day; the player and the matching exterior building are hidden only during the outside render pass and restored afterwards. Cabin pressure-shell geometry and frames have real window apertures. Upper bulkheads fill the gaps above passage and airlock openings, leaving 8 m rooms and 3 m connector headroom unchanged. The greenhouse tunnel hatch now aligns with the habitat direction. Six journey chapters and five landing chapters use interactive 3D art, NASA surface maps and the existing SLS/lander assets, additional explanations, chapter navigation and science notes. No publishing or push. Validation exercised every chapter, phone layout, greenhouse/cabin parallax, all three window sightlines, day/night, farming, five connectors and greenhouse save/resume without runtime errors.


Phone revision 9: dynamic viewport sizing, safe-area-aware controls, at least 44 px touch targets, narrower joystick on small screens, multitouch movement and look, cancellation on rotation/focus loss, suspended controls while menus are open, scrollable panels with sticky dismiss buttons, and messages hidden behind menu/modal overlays. Tested at 320x568, 360x640, 390x844, 430x932, 640x360 and 844x390 with emulated native touch events. Touch stair climbing and Use entry, power-panel scrolling, map fit, simultaneous movement/look and rotation release passed without runtime errors. Room dimensions, planet diameter ratios and world scale are unchanged. Real-device Safari/Chrome browser chrome, safe areas and sustained frame rate still need hardware testing. For a local phone preview, run Start Phone Preview.cmd on the computer and open its displayed URL from a phone on the same private Wi-Fi; it does not change firewall rules and stops when Enter is pressed. The published GitHub Pages URL is directly usable from a phone. No additional Unity/engine splash was added, per the user’s follow-up.


Landing and water integration (8 November 2026): merges Claude's four landing scenarios, water-processing station, three regolith upgrades, younger-reader fact cards and searchable Mars-pedia into the personal release. Retains connected habitat, power commissioning, stored rations, grow-bed missions and mesh rock traversal. The water plant is in the life-support module, opposite the greenhouse passage. Existing saves default to the plains scenario and zero unprocessed ice.

Validation: browser checks covered a polar mission, resume, reachable water station, 10 kg ice to 9 L water, 5 L water to 4.45 kg oxygen, encyclopedia search and folded facts without runtime errors. scripts/test-landing-integration.mjs covers all four scenarios, shielding cap, power commissioning gate and serialized simulation state. The legacy balance-test.mjs assumes automatic food production and does not exercise this branch's ration/harvest gameplay; its food losses are not a full-mission balance validation. Physical-device testing and complete mission balancing remain outstanding. Scenario terrain is shared and explicitly labelled; additional soil layers alter shielding but do not change the mound mesh.


Cable crossing revision (8 November 2026): the imported service leads are separated from their batched solar-frame mesh and laid close to the ground. Boots and rover wheels share a bounded spatial-grid crossing surface; rover suspension eases the cable bumps. Solar frames, habitat walls and upright equipment retain collision. Hidden power-kit objects no longer block the rover. Browser regression checks crossed three service-wire sections in both directions at 30/60 FPS (12 astronaut and 12 rover runs), preserved equipment/wall blocking, and reported no runtime errors.


Mars approach revision (8 November 2026): removed region choices from the title menu. The arrival globe now has named region pins and accessible matching buttons; selection precedes an illustrative six-second orbital scan and a 24-second entry/retropropulsion/touchdown sequence using an original Starship-inspired procedural model. The final descent eases to zero vertical speed and switches engines off at touchdown. Scan and descent can be skipped, and Back to menu cancels without selecting a site. The choice updates the mission modifiers before surface simulation starts and is saved normally.

Animation handoff: showArrival's optional third argument accepts {scanVideo: 'assets/your-animation.webm'} (MP4 also supported by the browser). The video is muted/inline, replaces the scan viewport, is stopped on skip/exit, and falls back to the orbit/globe illustration on load failure. No user animation has been supplied yet. Region pins are representative; scans and flight timings are illustrative, not live observations or validated flight dynamics. Human-scale retropropulsion source: https://www.nasa.gov/directorates/stmd/propulsive-descent-technologies-pdt/ .


Follow-up: the automatic slide deck and timed cruise card were removed from the launch-to-Mars path. The mission explanation now sits beneath the interactive globe. Selecting a region focuses the globe and eases its zoom before explicit confirmation. The landing vehicle is an original procedural Starship-inspired concept (not a downloaded/validated SpaceX model); its Mars gear and flight path are illustrative. The optional title-screen journey explainer remains available. Browser verification confirmed the polar selection produces 5 kWh heater demand, reaches surface gameplay and persists as polar in the save, with no runtime errors. Phone layout and immediate scan/descent skipping were checked.

## Cutscenes and the command window

The landing after the region scan follows NASA's Curiosity and Perseverance
sequence: cruise stage separation, heat shield entry, parachute, rocket descent
stage and sky crane (`src/edl.js`, played by `src/cutscenes.js`). The dust storm
cutscene plays from the dust event. The Cutscenes button in the menu replays
both. Badge pop-ups and toasts wait until a cutscene ends.

Press the backtick key or F2 to open the command window (`src/devconsole.js`).
Type `help`. It can play the landing or storm, queue a dust storm, and push any
event by name.

The earlier Starship landing is kept in the git history (commit bfbc8da and
before). `src/starship-landing.js` is still the arrival screen's fallback visual.


Surface missions revision 52: new Mars missions start with zero deployed field panels. The landed kit is collected, assembled, placed and connected to a charge controller/battery, then separately connected to the habitat inlet. Old saves retain completed power commissioning. Imported decorative panel tables and supports are removed from the visible/collision layout. The rover charger is assembled at the workbench, placed in the cyan parking bay and connected to the battery bus. Charging requires parking and energy in a separate 2 kWh reserve; 15% of energy left after the heater allowance is reserved from base power for this training system. Charging rates and rover battery capacity are game values. No power is gained from simply parking near the base.

Mars objectives follow the real construction state, include a collapsible card, T quest log, violet minimap/ground target, and soil shielding stages (inspect supports, collect regolith, fill bags at the workbench, place supported bags). Regolith bags reduce the game's dose but do not eliminate radiation; no thin coating or solar sail is claimed to shield the habitat. Solar sails are spacecraft propulsion, not surface electricity generation (NASA ACS3 https://www.nasa.gov/mission/acs3/). Regolith shielding research: https://techport.nasa.gov/projects/90198 . Q / Empty hands or selecting an equipped belt slot stows the tool; selecting it again equips it. State persists in saves.

Moon: replaces the cabin's exterior-camera-only panel with a walkable fictional HLS-inspired cabin containing a usable mission console, oxygen controls, sample locker and elevator exit. This is not an official SpaceX interior. Rover boarding/exiting now accepts E/Use as well as R, phone forward input is corrected, new missions park facing away from the lander, and the pause menu can recover a stranded rover to the base without refilling its battery. Full graphics retain 2048 terrain maps and 96-segment terrain chunks; smoother 720-triangle rocks replace broken per-vertex deformation. Shared geometry is grouped in spatial batches for culling, not reduced in resolution. Terrain grain, horizon tessellation, seams, lander welds and readable ground-bounce lighting improved. Local Moon terrain remains procedural; the horizon is based on LOLA data. The brighter bounced light is a readability choice, not atmospheric scattering.

Validation: Moon core/quest and Mars landing/rover tests plus new test-mars-objectives.mjs passed. Browser checks exercised both Moon cabin stations and elevator directions, rover E boarding/driving/exit (10.77 m in 3 seconds, game speed), and native emulated phone touch forward (negative input z) with no runtime errors. Mars browser checks completed construction through charger/soil shelter, restored a save, verified dock charging consumes reserve and stops away from the bay, and toggled tools. Full physical-device performance and a complete long mission remain untested.

### Revision 53 — rover, camera, food and relay follow-up
- Physics advances in <=1/60 s substeps. Small rock contacts below 0.9 m clear the rover; larger walls retain swept collision checks. Lunar rocks now contribute to support and blocking, with lunar gravity and suspension. This remains a custom simplified vehicle solver, not an engineering simulator. Moon top speed is 8 m/s (game tuning).
- Third-person camera retracts along its viewing ray instead of being pushed sideways. Removed forced rover camera recentering, ignored pointer-lock warp spikes, and added a gap between interior handoff boundaries.
- Fine dust is reduced and fades with daylight; lunar ejecta remains ballistic. Onboard rover solar supplements batteries slowly; the powered bay adds faster charging from reserved energy. Rates are accelerated training values.
- Quest-log/greenhouse food lab: sealed spirulina starter, water consumption, powered timed growth, batch check, supplemental harvest. NASA crop and ESA MELiSSA references are embedded; vitamins/worms are not presented as a complete validated crew diet.
- Future Mars relay request, delayed acknowledgement, terminal installation, distant constellation markers and a smoothly tracking 3D dish. Select Earth or another Mars outpost and queue messages. Orbits, marker visibility and delivery delays are explicitly illustrative, not live NASA telemetry or an existing Mars Starlink service.

Validation: Mars full power/charger/soil workflow and save/resume; culture water/growth/check/harvest and relay request/install/acquire via browser buttons; 120 stationary panel frames (zero drift/yaw change); interior orientation held for 120 frames; lunar 8 m/s drive and 390px layout without horizontal overflow. Node terrain/objective, lunar simulation/quest and device-profile tests pass. Physical-device frame rate and every interior transition remain unverified.

### Revision 54 — deliveries and longer missions
- Melting/filtering adds the exact 90% game yield to the base water tank, reports its new level and saves immediately. Oxygen production removes water from that same tank.
- Unopened cargo pods have persistent pulsing orange squares on the minimap (clamped to its edge when distant). A cargo button reports incoming orders, landed cargo distance and coordinates; markers disappear upon collection and survive saves. Seeds are received when opening the pod, not automatically on landing.
- Mars campaign lengths: 60/120/240 sols; early settlement victory waits until 75% of the campaign. Existing active saves adopt the longer limit.
- Moon retains its 300-second full lunar cycle, now labelled in the HUD. Four additional objectives require all masts, all four sample types, 64 water/25 oxygen production and at least 20 active minutes with 25% reserves. Actual lunar solar day remains 29.53 Earth days; polar light is not an equal day/night split.

### Revision 55 — reachable charger objective and two-minute suit air
- Indoor-work objective rings point to the stair foot, rather than beneath the elevated landing. Airlock interaction works from its landing without precisely targeting the small handle; height checks prevent entering from underneath.
- Workshop/locker interaction range accommodates their cabinet collision bounds. Browser check walked from outside up Airlock 02, entered with E, approached the workbench and assembled the charger.
- Baseline Mars suit oxygen lasts 120 real seconds, including sprinting and night. Suit upgrades add capacity. Cargo button raised above the minimap.

### Revision 57 — regolith finish without corridor obstruction
Removed the soil-bag sphere rows that crossed the greenhouse connection. Numeric shielding levels now reach the appearance code (previously reduced to a boolean), including on save restore. Habitat shell and dome materials gain progressively warmer soil tint, roughness and procedural fine dust at levels 1–3; glass stays transparent and interior/exterior finishes match. The finish is a visual cue for the existing shielding upgrade, not a claim that a thin dust film blocks radiation. Browser checked levels 0–3 and the clear corridor view; no shader errors after validation.

### Revision 58 — charger feedback and matching airlocks
Expanded docking detection to the painted bay rectangle with a parking tolerance. Connection is acknowledged even with an empty reserve; charging still requires stored energy, and never invents power at night. Persistent nearby status shows rover percentage, charger state and reserve while on foot or driving. Indoor greenhouse/locker goals no longer mark exterior stairs. Grow beds now have an indoor marker. Airlock collars and outer hatch surrounds share warm ochre tones and the soil-layer finish, while operational door hardware stays distinct.

## Revision 59
- First-meal objective keeps the next action visible: ice, water plant, seed request, delivery, collection, planting, watering, harvest and preparation. Existing crops retain progress.
- Free starter seed delivery takes three game sols; orange minimap pod markers persist until collection. Short landing toast and cargo notice can be dismissed.
- Moving relay dish collision covers its full bounds; greenhouse tank blocks the astronaut. Greenhouse glass has a subtle blue-green tint.

## Revision 60
Every mature crop harvest returns two planting units to the locker, allowing replanting and expansion. Seed returns are a simplified game reward; food preparation remains at the locker.
