"""6b. Rover breakdown: the SEV drives into a patch of soft sand hidden under a dust crust and digs itself in (wheels
spin, it sinks and tilts, warning light). This really happened: Opportunity at Purgatory dune in 2005 (freed after
five weeks of careful backing out) and Spirit at Troy in 2009 (never freed).
Repair: two astronauts dig in front of the wheels and lay traction boards, then the rover backs out slowly.
Two clips: 'rover_stuck' (0-8 s) and 'rover_freed' (8-17 s)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'failure_rover_stuck'
opts = args()
sc = reset(NAME, 17)
END = sc.frame_end
F_SINK, F_STOP, F_SPLIT, F_OUT, F_BOARDS, F_BACK, F_FREE = 60, 120, 192, 215, 285, 320, 380

g, rk, _ = mars_ground(size=1400, center=(18, -6), flat_r=110, seed=9, clear=[(0, 0, 9), (14, 0, 9), (30, 0, 15)])
sand = cyl('soft_sand', 9, 0.03, loc=(30, 0, 0.0), m=mat('soft_sand', (0.6, 0.41, 0.29), rough=1.0, alpha=0.75), verts=40, base=True)
sand.scale = (1.4, 0.8, 1)

sev = rover('sev', (-30, 0, 0))
body = bpy.data.objects['sev_body']
H = 90                                         # driving +X: heading = 0 + 90
A.key(sev, 0, loc=(-6, 0, 0), rot=(0, 0, H))
A.key(sev, F_SINK, loc=(22, 0, 0), rot=(0, 0, H), interp='LINEAR')
A.key(sev, F_STOP, loc=(27.5, 0, 0), rot=(0, 0, H))
A.key(sev, F_BACK, loc=(27.5, 0, 0), rot=(0, 0, H))
A.key(sev, F_FREE, loc=(16, 0, 0), rot=(0, 0, H))     # backs out the way it came
A.key(sev, END, loc=(14, 0, 0), rot=(0, 0, H))
z0 = body.location.z
A.key(body, F_SINK, loc=(0, 0, z0), rot=(0, 0, 0))
A.key(body, F_STOP, loc=(0, 0, z0 - 0.45), rot=(-6, 2, 0))   # nose down, leaning
A.key(body, F_BACK, loc=(0, 0, z0 - 0.45), rot=(-6, 2, 0))
A.key(body, F_FREE, loc=(0, 0, z0), rot=(0, 0, 0))

# spinning wheels throw sand back
spray = Puffs('wheel_spray', 50, (0.62, 0.42, 0.28), alpha=0.5)
rnd = random.Random(8)
for f in range(F_SINK, F_STOP + 50, 2):
    for wy in (-1.6, 1.6):
        spray.emit(f, (25.0 - (f - F_SINK) * 0.04, wy, 0.3), (rnd.uniform(-0.25, -0.12), rnd.uniform(-0.03, 0.03), rnd.uniform(0.02, 0.08)), 30, 0.3, rnd.uniform(0.8, 1.6))
for f in range(F_BACK, F_FREE, 4):
    spray.emit(f, (27.0 - (f - F_BACK) * 0.19, rnd.choice((-1.6, 1.6)), 0.3), (0.06, 0, 0.04), 24, 0.3, 1.0)

beacon_r = sphere('rover_beacon_red', 0.16, loc=(0, 0, 1.5), m=mat('beacon_red', (1, 0.1, 0.05), emit=(1, 0.1, 0.05), strength=6), parent=body)
beacon_g = sphere('rover_beacon_green', 0.16, loc=(0, 0, 1.5), m=mat('beacon_green', (0.1, 1, 0.3), emit=(0.1, 1, 0.3), strength=5), parent=body)
A.key(beacon_r, 0, scale=(0.001,) * 3, interp='CONSTANT'); A.key(beacon_g, 0, scale=(0.001,) * 3, interp='CONSTANT')
for f in range(F_STOP - 10, F_FREE, 16):
    A.key(beacon_r, f, scale=(1, 1, 1), interp='CONSTANT'); A.key(beacon_r, f + 8, scale=(0.001,) * 3, interp='CONSTANT')
A.key(beacon_g, F_FREE, scale=(1, 1, 1), interp='CONSTANT')

# repair crew: out of the rear suitports, dig, lay boards behind the wheels (it backs out over them)
boards = []
for i, wy in enumerate((-1.6, 1.6)):
    a = astronaut(f'astronaut_{i}', (24, wy * 2.4, 0))
    A.key(a, F_OUT - 1, loc=(23.6, wy * 0.8, 0), scale=(0.001,) * 3, interp='CONSTANT')
    A.key(a, F_OUT + i * 10, loc=(23.6, wy * 0.8, 0), rot=(0, 0, 90), scale=(1, 1, 1))
    A.key(a, F_OUT + 40 + i * 10, loc=(24.5, wy * 2.5, 0), rot=(0, 0, 180))
    for k in range(4):                                     # digging: lean in and out
        A.key(a, F_OUT + 50 + k * 8 + i * 4, rot=(0 if k % 2 else 25, 0, 180))
    A.key(a, F_BOARDS + 20, loc=(24.5, wy * 2.5, 0), rot=(0, 0, 180))
    A.key(a, F_BACK, loc=(20, wy * 4.2, 0), rot=(0, 0, 90))
    b = cube(f'traction_board_{i}', (3.2, 0.7, 0.06), loc=(0, 0, 0), m=mat('board', (0.15, 0.15, 0.17), rough=0.7))
    A.key(b, F_BOARDS - 1, loc=(24.5, wy * 2.5, 0.8), scale=(0.001,) * 3, interp='CONSTANT')
    A.key(b, F_BOARDS, loc=(24.5, wy * 2.5, 0.8), rot=(0, 0, 0), scale=(1, 1, 1))
    A.key(b, F_BOARDS + 20, loc=(23.0, wy, 0.05), rot=(0, 0, 0))
    boards.append(b)

# dug sand piles
for i, wy in enumerate((-1.6, 1.6)):
    pile = sphere(f'dug_pile_{i}', 1.0, m=mat('soft_sand', (0.66, 0.44, 0.28)), sub=2)
    pile.location = (23.5, wy * 3.4, 0)
    A.key(pile, F_OUT + 50, scale=(0.001,) * 3); A.key(pile, F_BOARDS, scale=(0.9, 0.7, 0.35))

cam = camera(lens=35)
look(cam, 0, (-8, -22, 4), (0, 0, 1))
look(cam, F_SINK, (12, -20, 3.5), (24, 0, 1.2))
look(cam, F_SPLIT - 1, (18, -16, 2.8), (27, 0, 1.2))
look(cam, F_SPLIT, (10, -14, 6), (26, 0, 0.8), interp='CONSTANT')
look(cam, F_BOARDS, (14, -12, 5), (25, 0, 0.6))
look(cam, END, (4, -20, 4), (18, 0, 1.2))

mars_world()
caption(cam, 'The rover drives onto soft sand hidden under a dust crust...', 0, F_SINK)
caption(cam, 'Stuck! The wheels spin and dig in', F_SINK, 160)
caption(cam, 'Spirit got stuck like this in 2009 and never got out', 160, F_SPLIT)
caption(cam, 'Repair: dig out the wheels and lay traction boards', F_SPLIT, F_BACK)
caption(cam, 'Back out slowly, the way you came in', F_BACK, F_FREE)
caption(cam, 'Free! Opportunity escaped a dune like this in 2005 after five weeks', F_FREE, END + 1)

run([('rover_stuck', 0, F_SPLIT), ('rover_freed', F_SPLIT, END)], opts, NAME)
