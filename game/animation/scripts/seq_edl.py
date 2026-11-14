"""3. Entry, descent and landing for a crew-size lander.
Curiosity and Perseverance (~1 t) used a parachute and sky crane (that is what src/edl.js shows). A 20+ t crew lander
is too heavy for any parachute in Mars's thin air, so NASA's human-mission studies use this instead:
heat-shield entry -> the shell opens -> the engine fires while still faster than sound (supersonic retropropulsion)
-> rocket-powered descent -> legs out -> touchdown. Times are squeezed (the real thing is about 7 minutes)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'edl_mars'
opts = args()
sc = reset(NAME, 26)
END = sc.frame_end
F_SEP, F_SHIELD, F_IGN, F_LEGS, F_TOUCH = 200, 228, 238, 430, 560

g, rk, _ = mars_ground(size=9000, span=9000, vscale=0.12, flat_r=200, seed=6, rocks_n=160)

veh = empty('edl_vehicle')
lroot, P = lander('pod', (0, 0, 0))
lroot.parent = veh
lmn, lmx = bounds(lroot.children_recursive)
bell = P['Engine_bell']; bmn, bmx = bounds([bell])

# aeroshell: a 12 m heat shield under the pod and a backshell over it
shield = lathe('heat_shield', [(0.0, 0.3), (-0.4, 3.5), (-1.0, 6.0), (-1.25, 6.0)][::-1], mat('pica', (0.32, 0.22, 0.16), rough=0.9), 40)
shield.parent = veh; shield.location = (0, 0, lmn.z - 0.3)
back = lathe('backshell', [(13.0, 2.4), (12.0, 3.0), (0.0, 6.0), (-0.2, 6.0)], mat('backshell', (0.9, 0.9, 0.86), rough=0.55), 40)
back.parent = veh; back.location = (0, 0, lmn.z - 0.3)
plasma = lathe('plasma', [(0.6, 6.3), (-0.6, 6.6), (-1.6, 5.2), (-2.4, 0.4)], mat('plasma', (1.0, 0.4, 0.1), emit=(1.0, 0.38, 0.08), strength=14, alpha=0.75), 40)
plasma.parent = veh; plasma.location = (0, 0, lmn.z - 1.0); plasma.visible_shadow = False
wake = lathe('plasma_wake', [(0, 6.2), (6, 5.0), (22, 0.5)], mat('wake', (1.0, 0.45, 0.15), emit=(1.0, 0.4, 0.12), strength=2.5, alpha=0.14), 24)
wake.parent = veh; wake.location = (0, 0, lmn.z); wake.visible_shadow = False

plume = flame('descent_plume', 0.9, 30, lroot, (0, 0, bmn.z + 0.05), color=(0.6, 0.68, 1.0), strength=3, alpha=0.45)

# telescoping legs: tucked up 1.6 m until F_LEGS
legs = empty('legs', parent=lroot)
for k in list(P):
    if k.startswith(('Leg_', 'Brace_', 'Foot_')):
        reparent(P[k], legs)
A.key(legs, F_LEGS, loc=(0, 0, 1.6), scale=(0.8, 0.8, 1))
A.key(legs, F_LEGS + 30, loc=(0, 0, 0), scale=(1, 1, 1))

# ---------- trajectory
def entry_pos(t):          # t 0..1 over the entry: a long shallow fall
    p0, p1 = Vector((-14000, 0, 9500)), Vector((-1700, 0, 3300))
    return p0.lerp(p1, 1 - (1 - t) ** 1.6) + Vector((0, 0, 900 * math.sin(math.pi * t) * 0.4))
path = {}
for f in range(0, END + 1):
    if f <= F_SEP:
        path[f] = entry_pos(f / F_SEP)
    elif f <= F_IGN + 12:
        t = (f - F_SEP) / (F_IGN + 12 - F_SEP)
        path[f] = entry_pos(1).lerp(Vector((-1150, 0, 2700)), t)
    elif f <= F_TOUCH:
        t = (f - F_IGN - 12) / (F_TOUCH - F_IGN - 12)
        e = 1 - (1 - t) ** 2.4
        start = Vector((-1150, 0, 2700))
        path[f] = Vector((start.x * (1 - (1 - (1 - t) ** 3.2)), 0, start.z * (1 - e)))
    else:
        path[f] = Vector((0, 0, 0))
for f in range(0, END + 1, 2):
    p = path[f]
    if f < F_SEP:
        beta = -62 + 4 * math.sin(f * 0.07)            # heat shield first, nose a little up (angle of attack)
    elif f < F_IGN + 12:
        beta = -62 + 62 * ease((f - F_SEP) / (F_IGN + 12 - F_SEP))   # thrusters swing it upright
    else:
        vx = (path[min(END, f + 2)].x - path[max(0, f - 2)].x) / 4
        beta = -min(22, vx * 1.3)
    A.key(veh, f, loc=tuple(p), rot=(0, beta, 0), interp='LINEAR')

# entry glow: on, flickering, fading as it slows
for f in range(0, F_SEP + 1, 2):
    k = max(0.001, 1 - ease((f - 120) / 80)) * (1 + random.Random(f).uniform(-0.08, 0.08))
    A.key(plasma, f, scale=(1, 1, k), interp='LINEAR')
    A.key(wake, f, scale=(k, k, k * (1 + random.Random(f + 9).uniform(-0.1, 0.1))), interp='LINEAR')
A.key(plasma, F_SEP + 2, scale=(0.001,) * 3); A.key(wake, F_SEP + 2, scale=(0.001,) * 3)

# backshell lifts off, heat shield drops away (both in the vehicle's frame, then far away)
A.key(back, F_SEP, loc=(0, 0, lmn.z - 0.3), rot=(0, 0, 0))
A.key(back, F_SEP + 40, loc=(-60, 25, 260), rot=(40, 30, 0))
A.key(back, F_SEP + 41, scale=(1, 1, 1), interp='CONSTANT'); A.key(back, F_SEP + 42, scale=(0.001,) * 3, interp='CONSTANT')
A.key(shield, F_SHIELD, loc=(0, 0, lmn.z - 0.3), rot=(0, 0, 0))
A.key(shield, F_SHIELD + 60, loc=(40, -10, -700), rot=(70, 20, 0), interp='LINEAR')
A.key(shield, F_SHIELD + 61, scale=(1, 1, 1), interp='CONSTANT'); A.key(shield, F_SHIELD + 62, scale=(0.001,) * 3, interp='CONSTANT')

# engine: long hot plume at first, shorter as it throttles down near the ground
flicker(plume, F_IGN, F_TOUCH + 2, base=lambda f: (1.3 - 0.4 * ease((f - F_IGN) / 200), 1.3 - 0.4 * ease((f - F_IGN) / 200), 1.0 - 0.55 * ease((f - F_IGN) / 260)), seed=3)

# dust blown out by the engine near the ground
dust = Puffs('landing_dust', 60, (0.62, 0.4, 0.26), alpha=0.45)
rnd = random.Random(11)
f = F_TOUCH - 44
while f < F_TOUCH + 18:
    for _ in range(3):
        a = rnd.uniform(0, math.tau); sp = rnd.uniform(0.45, 0.9) * (1.0 if f < F_TOUCH else 0.5)
        dust.emit(f, (math.cos(a) * 3, math.sin(a) * 3, 0.8), (math.cos(a) * sp, math.sin(a) * sp, rnd.uniform(0.05, 0.2)),
                  int(rnd.uniform(70, 110)), 1.2, rnd.uniform(4, 8))
    f += 2

# ---------- camera
cam = camera(lens=35)
for f in range(0, F_SEP, 2):                    # chase alongside during entry
    p = path[f]; look(cam, f, tuple(p + Vector((70, -95, 30))), tuple(p + Vector((0, 0, 3))), interp='LINEAR')
for f in range(F_SEP, 330, 2):                  # below and beside: shell opens, engine lights
    p = path[f]; look(cam, f, tuple(p + Vector((-55, -80, -35))), tuple(p + Vector((0, 0, 4))), interp='LINEAR')
for f in range(330, 470, 2):                    # from the ground, looking up as it comes down
    p = path[f]; look(cam, f, (p.x + 70, p.y - 110, max(8.0, p.z - 55)), tuple(p + Vector((0, 0, -6))), interp='LINEAR')
for f in range(470, END + 1, 2):                # close for touchdown
    p = path[f]; k = (f - 470) / (END - 470)
    look(cam, f, (85 - 10 * k, -115 + 12 * k, 4), (p.x * 0.6, 0, max(5, p.z * 0.6 + 5)), interp='LINEAR')
# zoom in for the far ground shot (lens is not exported per-shot; the GLB camera keeps 35 mm)

mars_world()
strength, ramp = bpy.context.scene.world.node_tree.nodes['Background'].inputs['Strength'], None
for f, v in ((0, 0.45), (F_SEP, 0.7), (330, 0.9)):
    key_value(strength, f, v)
caption(cam, 'Entry at about 20,000 km/h: the heat shield glows at over 1,300 C', 0, 110)
caption(cam, 'Mars air is thin, but it still takes away most of the speed', 110, F_SEP)
caption(cam, 'Too heavy for a parachute: the shell opens and the engine fires while still supersonic', F_SEP, 330)
caption(cam, 'Rocket-powered descent: about 7 minutes from the top of the air to the ground', 330, F_LEGS)
caption(cam, 'Landing legs out', F_LEGS, F_TOUCH - 20)
caption(cam, 'Touchdown! The engine blast throws up dust', F_TOUCH - 20, END + 1)

run([('entry', 0, F_SEP), ('descent_landing', F_SEP, END)], opts, NAME)
