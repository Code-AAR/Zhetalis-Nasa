"""2. Cruise to Mars: a seamless 12 s loop for the loading screen (the real trip takes about 7 months).
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

ship = empty('transit_ship')
st, P = import_glb('space-pack/05_OrbitalResearchStation.glb', 'transit_habitat', parent=ship)
st.scale = (2.5, 2.5, 2.5)       # the pack's station is toy-sized (19 m); a crewed Mars transit ship is ~50 m
bpy.context.view_layer.update()
mn, mx = bounds(st.children_recursive)
c = (mn + mx) / 2
st.location = -c                 # centre the ship on the origin
bpy.context.view_layer.update()
mn, mx = bounds(st.children_recursive)

# docking port on -Y (front), rear lab on +Y
hmn, hmx = bounds([P['Docking_hatch']])
cmn_, cmx_ = bounds([P['Rear_cap']])

# crew capsule + service module from the game's Artemis-style rocket, scaled to Orion's 5 m and docked nose-in
rk, RP = import_glb('space-pack/01_ArtemisInspiredRocket.glb', 'crew_vehicle', parent=ship)
for k, o in list(RP.items()):
    if not (k.startswith('Service_module') or k.startswith('Crew_capsule') or k.startswith('Crew_window') or k == '01_ArtemisInspiredRocket'):
        bpy.data.objects.remove(o)
keep = [o for o in rk.children_recursive if o.type == 'MESH']
rk.scale = (2.6, 2.6, 2.6)
rk.rotation_euler = (math.radians(-90), 0, 0)      # its nose (+Z) now points +Y, at the ship
bpy.context.view_layer.update()
kmn, kmx = bounds(keep)
rk.location += Vector((-(kmn.x + kmx.x) / 2, hmn.y - kmx.y + 0.1, -(kmn.z + kmx.z) / 2))

# solar-electric propulsion module behind the rear lab: xenon tank + two ion thrusters firing +Y
prop = empty('propulsion', loc=(0, cmx_.y + 2.4, 0), parent=ship)
pm = mat('prop_body', (0.82, 0.82, 0.8), rough=0.45, metal=0.3)
body = cyl('prop_tank', 1.6, 4.4, m=pm, parent=prop, verts=24)
body.rotation_euler = (math.pi / 2, 0, 0)
plumes = []
for i, dx in enumerate((-0.85, 0.85)):
    t = cyl(f'thruster{i}', 0.5, 0.4, loc=(dx, 2.3, 0), m=mat('dark', (0.12, 0.12, 0.13)), parent=prop, verts=16)
    t.rotation_euler = (math.pi / 2, 0, 0)
    fl = flame(f'ion_plume{i}', 0.45, 8, prop, (dx, 2.5, 0), color=(0.35, 0.55, 1.0), strength=3, alpha=0.3)
    fl.rotation_euler = (math.pi / 2, 0, 0)
    plumes.append(fl)
    for f in range(0, LOOP + 1, 6):           # gentle periodic shimmer that repeats exactly each loop
        k = 1 + 0.06 * math.sin(math.tau * 4 * f / LOOP + i)
        A.key(fl, f, scale=(k, k, 1 + 0.12 * math.sin(math.tau * 8 * f / LOOP + i * 2)), interp='LINEAR')

bpy.context.view_layer.update()
mn, mx = bounds([o for o in ship.children_recursive])
fy, ry = mn.y, mx.y
# navigation lights: one blink a second (24 frames divides the loop, so it stays seamless)
for i, (pos, col) in enumerate((((mx.x, 0, 0), (1, 0.15, 0.1)), ((mn.x, 0, 0), (0.1, 1, 0.3)), ((0, ry * 0.5, mx.z + 0.4), (1, 1, 1)))):
    b = sphere(f'nav_light{i}', 0.18, loc=pos, m=mat(f'nav{i}', col, emit=col, strength=12), parent=ship)
    for f in range(0, LOOP + 1, 24):
        A.key(b, f + i * 8, scale=(1, 1, 1), interp='CONSTANT')
        A.key(b, f + i * 8 + 4, scale=(0.001,) * 3, interp='CONSTANT')

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
caption(cam, 'Seven months to Mars: the ship coasts most of the way', 0, 144)
caption(cam, 'Blue glow: ion engines pushing gently, day after day', 144, 288)

run([('cruise_loop', 0, LOOP)], opts, NAME)
