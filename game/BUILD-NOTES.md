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
