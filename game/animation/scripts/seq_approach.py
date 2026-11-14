"""2b. Arrival at Mars (plays before you choose where to land): the transit ship closes on Mars, the docked crew
capsule's engine fires against the direction of travel to slow the ship into orbit (orbit insertion), then the
landing pod undocks and drops away toward the planet. Sizes and distances are squeezed so it fits on screen."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from space_kit import transit_ship
from mathutils import Vector

NAME = 'mars_approach'
opts = args()
sc = reset(NAME, 14)
END = sc.frame_end
F_BURN0, F_BURN1, F_UNDOCK = 70, 170, 200

ship, info = transit_ship(288)
mn, mx = info['min'], info['max']
cmn, cmx = bounds([o for o in info['capsule'].children_recursive])
burn = flame('insertion_burn', 1.6, 26, ship, (0, cmn.y - 0.4, (cmn.z + cmx.z) / 2), color=(1.0, 0.75, 0.45), strength=4, alpha=0.65)
burn.rotation_euler = (math.radians(-90), 0, 0)          # plume points -Y: forward, braking
flicker(burn, F_BURN0, F_BURN1, seed=2, grow=10)

# the landing pod rides docked under the ship's middle until it undocks
pod_root = empty('landing_pod_flight', loc=(0, 0, mn.z - 6.5))
pod, P = import_glb('space-pack/lander.glb', 'landing_pod', parent=pod_root)
pod.location = (0, 0, -5.5)
shield = lathe('pod_heat_shield', [(0.0, 0.3), (-0.4, 2.6), (-0.9, 4.2), (-1.1, 4.2)][::-1], mat('pica', (0.32, 0.22, 0.16), rough=0.9), 32)
shield.parent = pod_root; shield.location = (0, 0, -5.8)
pod_root.parent = ship

# ship closes on Mars along -Y and slows during the burn
MARS_C = Vector((0, -2600, -1500)); MARS_R = 1300
mars = uvsphere('mars', MARS_R, loc=tuple(MARS_C), m=textured('mars_map', 'mars-map.jpg'), seg=64, rings=32)
mars.rotation_euler = (0.3, 0, 2.2)
def ship_y(f):
    if f < F_BURN0: return 900 - f * 6.0
    v0 = 6.0
    if f < F_BURN1:
        t = f - F_BURN0
        return 900 - F_BURN0 * v0 - (v0 * t - 0.5 * (v0 - 1.2) / (F_BURN1 - F_BURN0) * t * t)
    y1 = 900 - F_BURN0 * v0 - (v0 * (F_BURN1 - F_BURN0) - 0.5 * (v0 - 1.2) * (F_BURN1 - F_BURN0))
    return y1 - (f - F_BURN1) * 1.2
for f in range(0, END + 1, 4):
    A.key(ship, f, loc=(0, ship_y(f), 0), interp='LINEAR')

# undock: springs push the pod down; small thruster puffs; it turns heat-shield-first toward Mars and falls away
puffs = Puffs('rcs_puffs', 16, (0.95, 0.95, 0.95), alpha=0.5)
A.key(pod_root, F_UNDOCK, loc=(0, 0, mn.z - 6.5), rot=(0, 0, 0))
for j in range(1, 9):
    t = j / 8; f = F_UNDOCK + t * (END - F_UNDOCK)
    A.key(pod_root, f, loc=(0, -60 * t * t, mn.z - 6.5 - 8 * t - 160 * t * t), rot=(-25 * ease(t * 1.5), 0, 0), interp='LINEAR')
rnd = random.Random(4)
for k in range(10):
    f = F_UNDOCK + k * 6
    puffs.emit(f, (rnd.choice((-3, 3)), 0, mn.z - 4 - k * 0.6), (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0.2), 18, 0.4, 1.6)

# camera: behind and above the ship looking past it at Mars, then down with the pod
cam = camera(lens=30)
for f in range(0, F_UNDOCK, 4):
    y = ship_y(f)
    look(cam, f, (34, y + 70, 26), (0, y - 60, -10), interp='LINEAR')
for f in range(F_UNDOCK, END + 1, 4):
    y = ship_y(f); k = ease((f - F_UNDOCK) / 90)
    t = (f - F_UNDOCK) / (END - F_UNDOCK)
    podp = Vector((0, y - 60 * t * t, mn.z - 6.5 - 8 * t - 160 * t * t))
    look(cam, f, tuple(Vector((34, y + 70, 26)).lerp(Vector((40, y + 20, -10)), k)), tuple(Vector((0, y - 60, -10)).lerp(podp, k)), interp='LINEAR')

sun(4.5, color=(1, 0.97, 0.92), rot=(55, 0, 150), angle=0.53)
world_sky((0, 0, 0), (0, 0, 0), (0, 0, 0), strength=1.0, stars=0.9)
caption(cam, 'Mars at last. The ship is still moving at thousands of km/h', 0, F_BURN0)
caption(cam, 'Engine burn against the direction of travel: slowing into orbit', F_BURN0, F_BURN1 + 10)
caption(cam, 'The landing pod undocks and drops toward the planet', F_BURN1 + 10, 280)
caption(cam, 'Choose where to land', 280, END + 1)

run([('mars_approach', 0, END)], opts, NAME)
