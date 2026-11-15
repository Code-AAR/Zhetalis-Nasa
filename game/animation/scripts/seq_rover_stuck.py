"""6b. Rover breakdown and repair: the SEV drives onto soft sand hidden under a dust crust and digs itself in -
its wheels spin in place, throw sand back and sink, and a warning light flashes. This really happened: Spirit at
Troy in 2009 (never freed) and Opportunity at Purgatory dune in 2005 (freed after five weeks of careful backing out).
Repair: two astronauts climb out of the rear suitports with shovels, kneel and dig the sand out from around the
wheels, carry traction boards and lay them behind the wheels, step clear, and the rover reverses out over them.
Timed at natural speed: actions take real time; the explanation beats are held by their own frames.
Two clips: 'rover_stuck' (0-12.5 s) and 'rover_freed' (12.5-33.3 s)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
from common import *
from mars_kit import mars_ground, mars_world, rover, rover_path, rover_motion
import astro_kit as ak
from mathutils import Vector

common.set_stretch(1.0)
NAME = 'failure_rover_stuck'
opts = args()
sc = reset(NAME, 800 / FPS)
END = sc.frame_end
F_SINK, F_STOP, F_WIDE, F_SPLIT = 60, 100, 200, 300
F_OUT, F_DIG0, F_DIG1, F_BOARD0, F_LAY, F_CLEAR, F_BACK, F_FREE = 300, 370, 520, 556, 616, 660, 690, 760
STOP = (27.5, 0)

g, rk, height = mars_ground(size=1400, center=(18, -6), flat_r=110, seed=9, clear=[(0, 0, 9), (14, 0, 9), (30, 0, 15)])
sand = cyl('soft_sand', 9, 0.03, loc=(30, 0, 0.0), m=mat('soft_sand', (0.6, 0.41, 0.29), rough=1.0, alpha=0.75), verts=40, base=True)
sand.scale = (1.4, 0.8, 1)

# ---------- the rover: drives in, slows in the sand, digs in; later backs out the way it came
sev = rover('sev', (-14, 0, 0))
body = bpy.data.objects[sev['body']]
rover_path(sev, [(0, (-14, 0)), (F_SINK, (22, 0)), (F_STOP, STOP), (F_BACK, STOP), (F_FREE, (16, 0)), (END, (15, 0))], reverse=(F_BACK, F_FREE, END))
z0 = body.location.z
A.key(body, F_SINK, loc=(0, 0, z0), rot=(0, 0, 0))
A.key(body, F_STOP + 40, loc=(0, 0, z0 - 0.45), rot=(-6, 2, 0))       # nose down, leaning, sunk 45 cm
A.key(body, F_BACK, loc=(0, 0, z0 - 0.45), rot=(-6, 2, 0))
A.key(body, F_FREE, loc=(0, 0, z0), rot=(0, 0, 0))
for w in [bpy.data.objects[n] for n in sev['wheels']]:                  # the wheels sink with it
    w0 = w.location.z
    A.key(w, F_SINK, loc=(None, None, w0)); A.key(w, F_STOP + 40, loc=(None, None, w0 - 0.4))
    A.key(w, F_BACK, loc=(None, None, w0 - 0.4)); A.key(w, F_FREE, loc=(None, None, w0))
rover_motion(sev, slip=[(F_SINK + 10, F_WIDE + 60, 1.1), (F_BACK, F_BACK + 30, 0.35)], bump=0.0)

spray = Puffs('wheel_spray', 60, (0.62, 0.42, 0.28), alpha=0.5)
rnd = random.Random(8)
for f in range(F_SINK + 10, F_WIDE + 60, 2):                           # sand flung back from the spinning wheels
    for wy in (-1.6, 1.6):
        spray.emit(f, (25.6, wy, 0.35), (rnd.uniform(-0.22, -0.1), rnd.uniform(-0.03, 0.03), rnd.uniform(0.02, 0.07)), 28, 0.25, rnd.uniform(0.7, 1.4))
beacon_r = sphere('rover_beacon_red', 0.16, loc=(0, 0, 1.5), m=mat('beacon_red', (1, 0.1, 0.05), emit=(1, 0.1, 0.05), strength=6), parent=body)
beacon_g = sphere('rover_beacon_green', 0.16, loc=(0, 0, 1.5), m=mat('beacon_green', (0.1, 1, 0.3), emit=(0.1, 1, 0.3), strength=5), parent=body)
A.key(beacon_r, 0, scale=(0.0001,) * 3, interp='CONSTANT'); A.key(beacon_g, 0, scale=(0.0001,) * 3, interp='CONSTANT')
for f in range(F_STOP - 10, F_FREE, 16):
    A.key(beacon_r, f, scale=(1, 1, 1), interp='CONSTANT'); A.key(beacon_r, f + 8, scale=(0.0001,) * 3, interp='CONSTANT')
A.key(beacon_g, F_FREE, scale=(1, 1, 1), interp='CONSTANT')

# ---------- the repair crew (rigged NASA suits): out of the rear suitports with shovels
dirt = Puffs('dig_dirt', 40, (0.58, 0.4, 0.27), alpha=0.55)
board_m = mat('board', (0.15, 0.15, 0.17), rough=0.7)
for i, wy in enumerate((-1, 1)):
    hatch, side, rear, behind, clear = (23.4, wy * 0.8), (24.6, wy * 2.55), (22.6, wy * 0.9), (22.4, wy * 1.75), (19.5, wy * 4.6)
    h, arm = ak.astronaut(f'astronaut_{i}', (*hatch, 0), rot_z=90)
    fw = ak.face(0, -wy)                                               # facing the rear wheel from the side
    A.key(h, F_OUT - 1, loc=(*hatch, 0), rot=(0, 0, 90), scale=(0.0001,) * 3, interp='CONSTANT')
    A.key(h, F_OUT + i * 8, loc=(*hatch, 0), rot=(0, 0, ak.face(side[0] - hatch[0], side[1] - hatch[1])), scale=(1, 1, 1))
    A.key(h, F_OUT + 44 + i * 8, loc=(*side, 0), rot=(0, 0, fw))
    A.key(h, F_DIG1, loc=(*side, 0), rot=(0, 0, fw))
    A.key(h, F_DIG1 + 8, loc=(*side, 0), rot=(0, 0, ak.face(rear[0] - side[0], rear[1] - side[1])))
    A.key(h, F_BOARD0, loc=(*rear, 0), rot=(0, 0, ak.face(rear[0] - side[0], rear[1] - side[1])))
    A.key(h, F_BOARD0 + 14, loc=(*rear, 0), rot=(0, 0, ak.face(0, wy)))   # board picked up, turn outward
    A.key(h, F_LAY - 16, loc=(*behind, 0), rot=(0, 0, ak.face(1, 0)))     # face the rover to lay the board
    A.key(h, F_LAY + 22, loc=(*behind, 0), rot=(0, 0, ak.face(1, 0)))
    A.key(h, F_LAY + 30, loc=(*behind, 0), rot=(0, 0, ak.face(clear[0] - behind[0], clear[1] - behind[1])))
    A.key(h, F_CLEAR, loc=(*clear, 0), rot=(0, 0, ak.face(clear[0] - behind[0], clear[1] - behind[1])))
    A.key(h, F_CLEAR + 16, loc=(*clear, 0), rot=(0, 0, ak.face(1, 0)))    # turn to watch the rover
    A.key(h, END, loc=(*clear, 0), rot=(0, 0, ak.face(1, 0)))
    ak.stand(arm, F_OUT)
    ak.walk(arm, h, F_OUT + 2, F_DIG0 - 16, hold=ak.arms(20, 15, bend_p=35, bend_n=20))       # carrying the shovel
    ak.kneel(arm, h, F_DIG0 - 14, F_DIG1, hands=ak.arms(60, 50, bend_p=40, bend_n=40))
    ak.dig(arm, F_DIG0, F_DIG1 - 14, rate=26)
    ak.pose(arm, F_DIG1 - 14, **ak.KNEEL, **ak.arms(60, 50, bend_p=40, bend_n=40))
    ak.walk(arm, h, F_DIG1 + 2, F_BOARD0)
    held = ak.arms(42, 42, bend_p=48, bend_n=48)
    ak.walk(arm, h, F_BOARD0 + 14, F_LAY - 16, hold=held)
    ak.kneel(arm, h, F_LAY - 14, F_LAY + 22, hands=ak.arms(70, 70, bend_p=20, bend_n=20))
    ak.walk(arm, h, F_LAY + 24, F_CLEAR + 2)
    ak.stand(arm, F_CLEAR + 6)
    # tools fixed to the right hand: a shovel while digging, then a traction board held out in front
    sh = ak.shovel(f'shovel_{i}')
    ak.hold_tool(arm, sh, 'p')
    sh.rotation_euler = (math.radians(90), 0, 0)
    A.key(sh, 0, scale=(1, 1, 1), interp='CONSTANT'); A.key(sh, F_DIG1, scale=(0.0001,) * 3, interp='CONSTANT')
    carried = cube(f'board_carried_{i}', (0.7, 1.4, 0.05), m=board_m)
    ak.hold_tool(arm, carried, 'p', offset=(0.0, 0.2, 0.0))
    A.key(carried, 0, scale=(0.0001,) * 3, interp='CONSTANT'); A.key(carried, F_BOARD0 + 14, scale=(1, 1, 1), interp='CONSTANT')
    A.key(carried, F_LAY + 2, scale=(0.0001,) * 3, interp='CONSTANT')
    laid = cube(f'board_laid_{i}', (3.0, 0.7, 0.05), m=board_m)
    laid.location = (23.1, wy * 1.6, 0.03)
    A.key(laid, 0, scale=(0.0001,) * 3, interp='CONSTANT'); A.key(laid, F_LAY + 2, scale=(1, 1, 1), interp='CONSTANT')
    for f in range(F_DIG0 + 12, F_DIG1 - 14, 26):                     # a spray of sand off each shovel stroke
        for _ in range(3):
            dirt.emit(f + i * 5, (25.0, wy * 2.0, 0.25), (rnd.uniform(-0.04, 0.03), wy * rnd.uniform(0.03, 0.08), rnd.uniform(0.05, 0.1)),
                      22, 0.1, rnd.uniform(0.3, 0.55))
    pile = sphere(f'dug_pile_{i}', 1.0, m=mat('soft_sand', (0.6, 0.41, 0.29)), sub=2)
    pile.location = (25.0, wy * 3.4, 0)
    A.key(pile, F_DIG0, scale=(0.0001,) * 3); A.key(pile, F_DIG1, scale=(0.8, 0.6, 0.3))

# ---------- camera: wide, then close on the wheel, the shovel and the board
cam = camera(lens=35)
look(cam, 0, (-8, -16, 3.5), (-6, 0, 1))
look(cam, F_SINK, (12, -18, 3.5), (24, 0, 1.2))
look(cam, F_STOP + 29, (16, -14, 3), (26, 0, 1.0), interp='CONSTANT')
look(cam, F_STOP + 30, (24.6, -4.6, 0.55), (25.7, -1.6, 0.35))            # close-up: the rear wheel spinning in place
look(cam, F_WIDE - 1, (24.0, -4.8, 0.6), (25.7, -1.6, 0.35), interp='CONSTANT')
look(cam, F_WIDE, (10, -15, 5.5), (25, 0, 0.8))
look(cam, F_SPLIT - 1, (11, -14, 5), (25, 0, 0.8), interp='CONSTANT')
look(cam, F_SPLIT, (16, -9, 2.8), (23.5, 0, 1.0))                         # the crew climbs out
look(cam, F_DIG0 - 1, (17, -9, 2.6), (24.5, -1.5, 0.8), interp='CONSTANT')
look(cam, F_DIG0, (27.2, -3.9, 1.05), (24.8, -2.2, 0.45))                  # close-up from the side: shovel, hands, wheel
look(cam, F_DIG1 - 1, (27.0, -4.2, 1.0), (24.8, -2.2, 0.45), interp='CONSTANT')
look(cam, F_DIG1, (16, -9, 3), (23.5, -0.5, 0.8))
look(cam, F_LAY - 25, (16.5, -8.5, 3), (23, -0.5, 0.7), interp='CONSTANT')
look(cam, F_LAY - 24, (20.4, -4.4, 0.9), (22.9, -1.7, 0.2))               # close-up: the board goes down
look(cam, F_CLEAR - 1, (20.2, -4.6, 0.9), (22.9, -1.7, 0.2), interp='CONSTANT')
look(cam, F_CLEAR, (6, -18, 4), (21, 0, 1))
look(cam, END, (5, -18, 4), (18, 0, 1))

mars_world()
caption(cam, 'The rover drives onto soft sand under a dust crust', 0, F_STOP)
caption(cam, 'Stuck! The wheels spin and dig in', F_STOP, F_WIDE)
caption(cam, 'Spirit got stuck like this in 2009 - for good', F_WIDE, F_SPLIT)
caption(cam, 'Two astronauts go out to help', F_SPLIT, F_DIG0)
caption(cam, 'Dig the sand away from the wheels', F_DIG0, F_DIG1)
caption(cam, 'Lay traction boards behind the wheels', F_DIG1, F_CLEAR)
caption(cam, 'Back out slowly, the way it came in', F_CLEAR, F_FREE)
caption(cam, 'Free! Opportunity escaped a dune like this in 2005', F_FREE, END + 1)

run([('rover_stuck', 0, F_SPLIT), ('rover_freed', F_SPLIT, END)], opts, NAME)
