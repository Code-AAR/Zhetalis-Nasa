# Exploration build integration — 8 November 2026

Source: the supplied Downloads/UNITY/game standalone Three.js build, merged into the NASA browser game. No Unity runtime is required.

## Added
- Higher-resolution 512-square Gusev-derived terrain height data, revised twilight, detailed solar panel cells and frames.
- Four survey towers with animated dishes, a skippable 3D orbiter scan and animated chart reveals.
- Relief, height and surface map layers; walking/driving trails, named flags, landmarks, eight survey finds and region-completion rewards.
- Three selectable-heading Ingenuity scouting flights, map discovery and desktop minimap. The full map remains accessible on phones.
- Personal rations, hold-to-eat keyboard/touch controls, fresh-food buffer, hunger effects and suit-air indicator. Prepared greenhouse portions feed this system.
- Collectible mission patches, patch book, sound effects and immediately dismissible awards.
- In-world Starship descent and dust-storm scenes with immediate Skip and reduced-motion support.
- Saved survey towers, flags, discoveries, completed regions, scout progress and personal rations; existing saves remain readable.

## Retained
The existing mesh-shaped rocks, smooth walk/rover slope traversal, fast accelerating rover, grounded pickups, solid solar equipment, five-minute sol, landing-site selection with yellow dots and slow globe rotation, commissioning tasks, greenhouse and water/food workflows, tinted glass and connected interiors, compact closable pop-ups and phone/tablet layouts.

The source's floating scenery rocks and disabled volumetric mist were not enabled. Its rock replacement would discard the current collision improvements. Existing safer launch scripts were retained. The source directory and unrelated internal Unity work were left untouched.

## Science and scope
This is a training landscape derived from the Spirit/Gusev model, with compressed distances and adjusted relief, shared by the selectable landing scenarios. Towers, survey beams, mission structures, Starship landing choreography, scout-flight limits and hunger rates are gameplay illustrations, not operational NASA predictions. Higher grid resolution does not add new measured terrain detail. Existing NASA/NOAA sources, live-data fallbacks and API-key separation are preserved; no secret is shipped to the browser.

## Validation
- All source JavaScript parses; existing rover terrain and four-site integration checks pass.
- Browser checks: six-step power commissioning; plant/harvest/prepare/eat flow; map layers and flags; save/resume; tower scan and immediate Skip; Ingenuity flight/reveal; award Close; dust scene Skip and camera/gameplay recovery; landing completion.
- Phone 390x844 and tablet 834x1112 viewport checks cover map sizing and reachable message close controls. These are browser emulation checks, not physical-device certification.
- Optional DONKI archive is absent and falls back to the existing weather sources. No new live NASA endpoint was added by this merge.
