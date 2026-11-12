# Ground contact and Mars dust haze — 13 November 2026

The Mars haze follows NASA's description of suspended dust giving the sky a hazy reddish appearance:
- https://science.nasa.gov/mars/facts/
- https://science.nasa.gov/solar-system/planets/mars/10-things-dust-in-the-wind-on-mars-and-well-beyond/

The colour, distance fade (24–360 m by day) and storm fade (12–120 m) are visual training-game choices, not measured optical depth or live weather. The existing blue sunset remains. Dust particles fade to zero at night. This changes the existing fog/sky uniforms; it adds no volumetric pass or particle count.

Ground-contact fixes:
- Building footing dust decals use terrain-conforming grids instead of flat quads.
- Rover tyre contact uses rendered steering and body tilt, rather than unrotated wheel sampling.
- Lunar rock support uses the visible rock surface, rather than the collider's approximate dome.
- Suspension travel remains bounded: a tyre can legitimately lift on an obstacle beyond available travel. These are kinematic suspension rules, not a full tyre/soil physics solver.

Model audit: all eight requested assets are integrated. Mars rocks are scattered boulders; Perseverance is the salvage rover; Block Island is a conditional meteorite exhibit (excluded from Gusev/Jezero); SVS 14959 supplies the lunar flyby globe. Apollo sample 10017,15 is a lunar surface exhibit. Saturn V, Apollo Lunar Module and LRO are optional models in Moon → Lunar survey & history. Historical spacecraft do not replace modern mission vehicles.
