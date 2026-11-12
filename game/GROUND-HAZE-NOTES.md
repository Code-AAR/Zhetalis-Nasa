# Ground contact and Mars dust haze — 13 November 2026

The Mars haze follows NASA's description of suspended dust giving the sky a hazy reddish appearance:
- https://science.nasa.gov/mars/facts/
- https://science.nasa.gov/solar-system/planets/mars/10-things-dust-in-the-wind-on-mars-and-well-beyond/

The colour, distance fade (2–280 m by day; smoothstep fade, approximately 1% at 20 m and 8% at 50 m) and storm fade (2–120 m) are visual training-game choices, not measured optical depth or live weather. The existing blue sunset remains. Dust particles fade to zero at night. This changes the existing fog/sky uniforms; it adds no volumetric pass or particle count.

Ground-contact fixes:
- Building footing dust decals use terrain-conforming grids instead of flat quads.
- Rover tyre contact uses rendered steering and body tilt, rather than unrotated wheel sampling.
- Lunar rock support uses the visible rock surface, rather than the collider's approximate dome.
- Suspension travel remains bounded: a tyre can legitimately lift on an obstacle beyond available travel. These are kinematic suspension rules, not a full tyre/soil physics solver.

Model audit: all eight requested assets are integrated. Mars rocks are scattered boulders; Perseverance is the salvage rover; Block Island is a conditional meteorite exhibit (excluded from Gusev/Jezero); SVS 14959 supplies the lunar flyby globe. Apollo sample 10017,15 is a lunar surface exhibit. Saturn V, Apollo Lunar Module and LRO are optional models in Moon → Lunar survey & history. Historical spacecraft do not replace modern mission vehicles.

Ore jump follow-up: mineable deposits now use their visible stone triangles for side collision and landing support, instead of height-unbounded circular blockers. Nearby queries refresh the stone transform after mining; removing or renewing a deposit removes or restores the same collider. Browser regression checks all 37 initial deposits for solid sides, clear passage above their tops, and no upward snap from underneath.
