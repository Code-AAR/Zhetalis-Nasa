"""2. Cruise to Mars: a seamless 12 s loop for the loading screen (the minimum-energy trip takes about 8.5 months).
The transit ship is the game's orbital station model (habitat modules, truss, solar arrays) with a crew capsule
docked on the front and a solar-electric propulsion module behind: the blue glow is xenon ion thrust, which pushes
gently for months. The camera circles the ship once per loop; Mars ahead and Earth behind are not to scale."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mathutils import Vector

NAME = 'cruise_loop'
opts = args()
sc = reset(NAME, 12)
LOOP = 288                       # frames; key 288 == key 0

from space_kit import transit_ship
ship, info = transit_ship(LOOP)
mn, mx = info['min'], info['max']

# planets: Mars ahead, Earth behind (sizes and distances are illustrative only)
mars = uvsphere('mars', 120, loc=(400, -2600, -260), m=textured('mars_map', 'mars-map.jpg'))
mars.rotation_euler.z = 0.6
earth = uvsphere('earth', 40, loc=(-900, 3000, 300), m=textured('earth_map', 'earth-map.jpg'))

# camera circles the ship once per loop, slightly above it
rig = empty('camera_orbit')
cam = camera(lens=32)
cam.parent = rig
d = (mx - mn).length * 0.95
cam.location = (0, -d, d * 0.22)
cam.rotation_euler = (math.radians(90 - 12), 0, 0)
A.key(rig, 0, rot=(0, 0, 0), interp='LINEAR')
A.key(rig, LOOP, rot=(0, 0, 360), interp='LINEAR')
# the ship itself drifts in a tiny periodic wobble (attitude control holding it steady)
for f in range(0, LOOP + 1, 24):
    A.key(ship, f, rot=(1.2 * math.sin(math.tau * f / LOOP), 0.8 * math.sin(math.tau * 2 * f / LOOP), 0))

sun(4.5, color=(1, 0.97, 0.92), rot=(60, 0, 120), angle=0.53)
world_sky((0, 0, 0), (0, 0, 0), (0, 0, 0), strength=1.0, stars=0.9)
caption(cam, 'About 8 months to Mars: the ship coasts most of the way', 0, 144)
caption(cam, 'Blue glow: ion engines pushing gently, day after day', 144, 288)

run([('cruise_loop', 0, LOOP)], opts, NAME)
