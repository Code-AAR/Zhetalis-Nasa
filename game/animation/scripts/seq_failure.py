"""6. A random failure the crew must fix: a solar tracker's drive motor stalls, then its hinge bracket gives way and
the panel sags out of the sunlight (power drops and a red warning light flashes). In the repair clip the rover
brings a spare drive unit (NASA's Orbital Replacement Unit model), an astronaut swaps it in, the panel is lifted
back and rejoins the others, and the light turns green.
Two clips: 'panel_failure' (0-8 s) and 'panel_repair' (8-16 s)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'failure_solar_panel'
opts = args()
sc = reset(NAME, 16)
END = sc.frame_end
F_STALL, F_SNAP, F_SPLIT = 70, 120, 192
F_ROVER, F_WALK, F_SWAP, F_LIFT, F_OK = 200, 262, 300, 318, 345

g, rk, _ = mars_ground(size=1400, center=(-60, -32), flat_r=110, seed=4, clear=[(-10, 15, 42), (-82, -28, 7), (-71, -28, 7), (-60, -28, 7), (-49, -28, 7), (-38, -28, 7), (-20, -55, 12), (-52, -42, 8), (5, -64, 14)])
base = finished_outpost(skip=('solar',))

# one row of five trackers right in front of the camera
trackers = []
for col in range(5):
    tr, pv = solar_tracker(f'solar_{col}', (-82 + col * 11, -28, 0))
    trackers.append((tr, pv))
BAD = 2
bad_tr, bad_pv = trackers[BAD]

def track_angle(f):          # all healthy panels follow the Sun slowly across the sky
    return -30 + 45 * f / END
for i, (tr, pv) in enumerate(trackers):
    if i == BAD:
        continue
    for f in range(0, END + 1, 24):
        A.key(pv, f, rot=(track_angle(f), 0, 0), interp='LINEAR')

# the bad one: tracks, judders, stalls, then the bracket gives and it sags (rolls about its long axis and tips)
for f in range(0, F_STALL + 1, 24):
    A.key(bad_pv, f, rot=(track_angle(f), 0, 0), interp='LINEAR')
stall = track_angle(F_STALL)
for j, f in enumerate(range(F_STALL, F_STALL + 20, 3)):
    A.key(bad_pv, f, rot=(stall + (2.5 if j % 2 else -2.5), 0, 0), interp='LINEAR')
A.key(bad_pv, F_STALL + 21, rot=(stall, 0, 0))
A.key(bad_pv, F_SNAP, rot=(stall, 0, 0))
A.key(bad_pv, F_SNAP + 10, rot=(stall + 55, 0, -9))
A.key(bad_pv, F_SNAP + 15, rot=(stall + 47, 0, -7))
A.key(bad_pv, F_SNAP + 20, rot=(stall + 51, 0, -8))
A.key(bad_pv, F_LIFT, rot=(stall + 51, 0, -8))
A.key(bad_pv, F_OK, rot=(track_angle(F_OK), 0, 0))
for f in range(F_OK + 24, END + 1, 24):
    A.key(bad_pv, f, rot=(track_angle(f), 0, 0), interp='LINEAR')

# a broken bracket bolt drops to the ground (Mars gravity: 3.7 m/s^2, ~1 s for 1.8 m)
bolt = cyl('broken_bolt', 0.05, 0.25, loc=(-60 + 0.3, -28, 1.8), m=mat('steel', (0.62, 0.62, 0.6)), verts=8)
for k in range(0, 25, 4):
    t = k / FPS
    A.key(bolt, F_SNAP + k, loc=(-59.7 + 0.3 * t, -28.2, max(0.05, 1.8 - 0.5 * 3.71 * t * t)), rot=(0, 120 * t, 0), interp='LINEAR')

# warning beacon on the post: red flashing from the stall, green once fixed
red = sphere('beacon_red', 0.14, loc=(-60, -28 - 0.2, 1.2), m=mat('beacon_red', (1, 0.1, 0.05), emit=(1, 0.1, 0.05), strength=6))
grn = sphere('beacon_green', 0.14, loc=(-60, -28 - 0.2, 1.2), m=mat('beacon_green', (0.1, 1, 0.3), emit=(0.1, 1, 0.3), strength=5))
A.key(red, 0, scale=(0.001,) * 3, interp='CONSTANT')
for f in range(F_STALL + 6, F_OK, 16):
    A.key(red, f, scale=(1, 1, 1), interp='CONSTANT'); A.key(red, f + 8, scale=(0.001,) * 3, interp='CONSTANT')
A.key(red, F_OK, scale=(0.001,) * 3, interp='CONSTANT')
A.key(grn, 0, scale=(0.001,) * 3, interp='CONSTANT'); A.key(grn, F_OK, scale=(1, 1, 1), interp='CONSTANT')

# ---------- the repair: rover drives up with the spare, astronaut carries it to the post
sev = rover('sev', (40, -60, 0), rot_z=90)
rover_path(sev, [(F_ROVER, (40, -70)), (F_ROVER + 40, (-30, -46)), (F_WALK, (-52, -42))])
astro = astronaut('astronaut_0', (-52, -39, 0), rot_z=0)
A.key(astro, F_WALK - 1, loc=(-52, -38.5, 0), scale=(0.001,) * 3, interp='CONSTANT')
A.key(astro, F_WALK, loc=(-52, -38.5, 0), rot=(0, 0, -40), scale=(1, 1, 1))
A.key(astro, F_SWAP, loc=(-59.4, -29.4, 0), rot=(0, 0, -15))
A.key(astro, END, loc=(-59.4, -29.4, 0), rot=(0, 0, -15))
oru, _ = import_glb('nasa/shelter/orbital-replacement-unit.glb', 'spare_drive_unit')
omn, omx = bounds(oru.children_recursive)
k = 0.5 / max(omx - omn)
oru.scale = (k, k, k)
A.key(oru, F_WALK - 1, loc=(-52, -38.2, 1.1), scale=(0.001,) * 3, interp='CONSTANT')
A.key(oru, F_WALK, loc=(-52, -38.2, 1.1), scale=(k, k, k))
A.key(oru, F_SWAP, loc=(-59.4, -28.9, 1.1), scale=(k, k, k))
A.key(oru, F_SWAP + 12, loc=(-60, -28.15, 1.5), scale=(k, k, k))

# ---------- power meter for the game: scale.x = row output (1.0 healthy, 0.8 with one of five panels down)
pw = empty('row_power')
A.key(pw, 0, scale=(1, 1, 1)); A.key(pw, F_SNAP, scale=(1, 1, 1)); A.key(pw, F_SNAP + 10, scale=(0.8, 1, 1))
A.key(pw, F_OK - 1, scale=(0.8, 1, 1)); A.key(pw, F_OK + 10, scale=(1, 1, 1))

# ---------- camera
cam = camera(lens=35)
look(cam, 0, (-74, -44, 3.2), (-58, -27, 1.8))
look(cam, F_SPLIT - 1, (-70, -42, 3.0), (-60, -28, 1.6))
look(cam, F_SPLIT, (-20, -80, 9), (-40, -46, 1), interp='CONSTANT')
look(cam, F_WALK, (-60, -60, 6), (-52, -40, 1))
look(cam, F_SWAP, (-66, -40, 2.6), (-60, -29, 1.4))
look(cam, END, (-71, -42, 3.2), (-59, -28, 1.8))

mars_world()
caption(cam, 'Every panel turns to follow the Sun...', 0, F_STALL)
caption(cam, 'Fault! One tracker\'s motor stalls', F_STALL, F_SNAP)
caption(cam, 'Its bracket gives way: the panel sags out of the sunlight', F_SNAP, F_SPLIT)
caption(cam, 'Repair: the rover brings a spare drive unit', F_SPLIT, F_WALK)
caption(cam, 'Swap the unit, lift the panel, check the light', F_WALK, F_OK)
caption(cam, 'Green light: full power again', F_OK, END + 1)

run([('panel_failure', 0, F_SPLIT), ('panel_repair', F_SPLIT, END)], opts, NAME)
