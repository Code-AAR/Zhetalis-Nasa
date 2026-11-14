"""1. Launch from Earth: NASA's SLS on Mobile Launcher 1 at Pad 39B.
Event times follow Artemis I: RS-25 start T-6.4 s, liftoff T-0, boosters drop T+2:12 (~47 km), abort tower off T+3:11.
Slightly slowed until the rocket clears the tower, then about 14x faster (the captions give the real times)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mathutils import Vector

NAME = 'launch_earth'
opts = args()
sc = reset(NAME, 23)
END = sc.frame_end

F_RS25, F_LIFT, F_FAST, F_SRB, F_LAS = 40, 96, 264, 423, 497
def T_of(f):                                  # real mission time (s) for a frame
    if f < F_FAST: return (f - F_LIFT) / FPS
    return 7 + (f - F_FAST) * (208 / (END - F_FAST))

# ---------- ground and pad
terrain('ground', 6000, 70, 3.0, (0.23, 0.27, 0.15), seed=2, flat_r=300, flat_soft=300)
pad = cube('pad', (190, 190, 6), loc=(0, 0, -2.6), m=mat('concrete', (0.55, 0.54, 0.5), rough=0.9))
cube('flame_trench', (20, 150, 4), loc=(0, 0, 0.0), m=mat('trench', (0.08, 0.08, 0.08)))
sea = cube('ocean', (6000, 2500, 1), loc=(0, 3800, -2.0), m=mat('ocean', (0.06, 0.16, 0.22), rough=0.25))

# ---------- Mobile Launcher 1 (116 m tall) - same placement as src/launch.js
ml, _ = import_glb('mobile-launcher.glb', 'mobile_launcher')
mn, mx = bounds(ml.children_recursive)
s = 116 / mx.z
ml.scale = (s, s, s)
ml.rotation_euler.z = math.pi / 2
def paint(m):
    if not m.use_nodes: return
    b = m.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Metallic'].default_value = 0; b.inputs['Roughness'].default_value = 0.85
        c = b.inputs['Base Color'].default_value; b.inputs['Base Color'].default_value = (min(1, c[0] * 1.6), min(1, c[1] * 1.6), min(1, c[2] * 1.6), 1)
recolor(ml, paint)
DECK = 0.294 * s

# ---------- SLS Block 1 (98 m): parts core, boosterL, boosterR, upper, orion, las
rocket = empty('sls_flight', loc=(0, 0, DECK))
sls, P = import_glb('sls.glb', 'sls', parent=rocket, decimate=0.6)
core, bL, bR, las = P['core'], P['boosterL'], P['boosterR'], P['las']
cmn, cmx = bounds([core]); bmn, bmx = bounds([bL]); rmn, rmx = bounds([bR])
cc = (cmn + cmx) / 2; R = (cmx.x - cmn.x) / 2

core_flames = []
for i, (dx, dy) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
    fl = flame(f'rs25_{i}', 1.15, 20, rocket, (cc.x + dx * R * 0.34, cc.y + dy * R * 0.34, cmn.z - DECK + 0.3),
               color=(1.0, 0.62, 0.32), strength=3, alpha=0.55, diamonds=4)
    core_flames.append(fl)
bflames = []
for b, (mn_, mx_) in ((bL, (bmn, bmx)), (bR, (rmn, rmx))):
    c = (mn_ + mx_) / 2
    fl = flame('srb_' + b.name, 1.9, 50, b, (0, 0, 0), color=(1.0, 0.8, 0.45), strength=7, alpha=0.9)
    fl.parent = rocket; fl.location = (c.x, c.y, mn_.z - DECK + 0.5)
    bflames.append(fl)

# ---------- flight path: integrate a gentle gravity turn (pitch toward +Y)
path = {}
pos = Vector((0, 0, DECK)); v = 0.0
for f in range(0, END + 1):
    T = T_of(f)
    if f >= F_LIFT:
        dT = 1 / FPS if f < F_FAST else 208 / (END - F_FAST)
        sub = 8
        for _ in range(sub):
            t = T - dT + dT * (_ + 1) / sub
            a = 4.5 + 0.06 * max(0.0, t)
            v += a * dT / sub
            th = math.radians(68) * (1 - math.exp(-max(0.0, t - 10) / 120))
            pos += Vector((0, math.sin(th), math.cos(th))) * v * dT / sub
    th = math.radians(68) * (1 - math.exp(-max(0.0, T - 10) / 120)) if f >= F_LIFT else 0
    path[f] = (pos.copy(), th)
for f in range(F_LIFT - 1, END + 1, 2):
    p, th = path[f]
    A.key(rocket, f, loc=tuple(p), rot=(-math.degrees(th), 0, 0), interp='LINEAR')
A.key(rocket, END, loc=tuple(path[END][0]), rot=(-math.degrees(path[END][1]), 0, 0), interp='LINEAR')

# ---------- engines
for i, fl in enumerate(core_flames):
    flicker(fl, F_RS25, END, base=lambda f: (1 + 0.8 * min(1, max(0, (f - F_SRB) / 60)), 1 + 0.8 * min(1, max(0, (f - F_SRB) / 60)), 1 + 0.6 * min(1, max(0, (f - F_SRB) / 60))), seed=i, amt=0.1)
for i, fl in enumerate(bflames):
    flicker(fl, F_LIFT - 2, F_SRB, seed=10 + i, amt=0.14, grow=4)

# ---------- booster separation (in the rocket's frame: they fall behind and drift out)
for b, side in ((bL, -1), (bR, 1)):
    l0 = b.location.copy(); r0 = tuple(math.degrees(a) for a in b.rotation_euler)
    A.key(b, F_SRB, loc=tuple(l0), rot=r0)
    for j in range(1, 8):
        t = j / 7; fr = F_SRB + t * (END - F_SRB)
        A.key(b, fr, loc=(l0.x + side * 3 * t + side * 25 * t * t, l0.y - 8 * t, l0.z - 900 * t * t),
              rot=(r0[0] + 25 * t * t, r0[1] + side * 40 * t * t, r0[2]), interp='LINEAR' if j < 7 else 'BEZIER')

# ---------- the boosters' smoke column (the RS-25s burn hydrogen: their exhaust is nearly clear water vapour)
smoke = column('smoke_column', 6, 1, (0.86, 0.85, 0.82), rocket, (cc.x, cc.y, cmn.z - DECK - 30), alpha=0.2)
for f in range(F_LIFT + 30, F_SRB + 1, 4):
    L = max(0.001, (f - F_LIFT - 30) * (3 if f < F_FAST else 14)); A.key(smoke, f, scale=(1 + L / 500, 1 + L / 500, L), interp='LINEAR')
A.key(smoke, F_LIFT + 29, scale=(1, 1, 0.001), interp='CONSTANT')
A.key(smoke, F_SRB + 24, scale=(0.001, 0.001, 0.001), interp='LINEAR')

# ---------- abort tower jettison: its own motor pulls it ahead
l0 = las.location.copy()
A.key(las, F_LAS, loc=tuple(l0))
for j in range(1, 6):
    t = j / 5; fr = F_LAS + t * (END - F_LAS)
    A.key(las, fr, loc=(l0.x + 6 * t, l0.y + 4 * t, l0.z + 420 * t * t + 30 * t), rot=(25 * t * t, 0, 0), interp='LINEAR')
lmn, lmx = bounds([las])
jm = flame('las_jettison', 0.9, 10, las, (0, 0, 0), color=(1, 0.7, 0.3), strength=14)
jm.location = ((lmn.x + lmx.x) / 2 - las.location.x, (lmn.y + lmx.y) / 2 - las.location.y, (lmx.z - lmn.z) * 0.62)
jm.rotation_euler = (math.radians(35), 0, 0)
flicker(jm, F_LAS, F_LAS + 30, seed=40)

# ---------- steam, smoke and the trail
steam = Puffs('steam', 90, (0.92, 0.92, 0.9), alpha=0.7)
trail = Puffs('trail', 70, (0.85, 0.84, 0.8), alpha=0.6)
rnd = random.Random(7)
f = F_RS25 + 4
while f < 330:
    k = 0.4 if f < F_LIFT else 1.0
    for _ in range(2 if f >= F_LIFT else 1):
        side = rnd.choice((-1, 1))
        steam.emit(f, (rnd.uniform(-12, 12), side * 70, 4), (rnd.uniform(-0.5, 0.5), side * rnd.uniform(1.2, 2.4) * k, rnd.uniform(0.1, 0.35)),
                   int(rnd.uniform(90, 140)), 8 * k + 4, rnd.uniform(26, 44) * (0.6 + 0.4 * k))
    f += 3
f = F_LIFT + 6
while f < F_FAST:
    p, th = path[int(f)]
    big = 1 if f < F_FAST else 4
    o = trail.emit(f, (p.x + rnd.uniform(-3, 3), p.y - math.sin(th) * 30, p.z - math.cos(th) * 30 * big),
                   (rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), -0.3), 70, 6 * big, 22 * big)
    f += 4 if f < F_FAST else 2

# ---------- camera
cam = camera(lens=35)
look(cam, 0, (-120, -250, 6), (0, 0, 55))
look(cam, 199, (-150, -260, 6), (0, 0, 70), interp='CONSTANT')
for f in range(200, F_FAST + 1, 4):            # low and close, tilting up as it clears the tower
    p = path[f][0]
    look(cam, f, (75, -95, 8), (p.x, p.y, p.z + 55))
# chase shot: the camera flies alongside the rocket
def chase_look(f, off, tgt_up):
    p, th = path[f]
    t = Vector(p) + Vector((0, math.sin(th), math.cos(th))) * tgt_up
    look(cam, f, tuple(Vector(p) + Vector(off)), tuple(t), interp='LINEAR')
for f in range(F_FAST + 1, END + 1, 2):
    k = (f - F_FAST) / (END - F_FAST)
    chase_look(f, (-170 + 60 * k, -150 - 40 * k, -10 - 30 * k), 45)

# ---------- preview: light, sky, captions
sun(4.0, rot=(48, 0, -35))
strength, ramp = world_sky((0.72, 0.82, 0.95), (0.18, 0.38, 0.85), (0.3, 0.3, 0.25), strength=1.2, stars=0.6)
el = ramp.color_ramp.elements
for f, zen, hor, stv in ((F_FAST, (0.18, 0.38, 0.85), (0.72, 0.82, 0.95), 1.2), (F_SRB, (0.02, 0.05, 0.16), (0.35, 0.5, 0.75), 0.8), (END, (0.0, 0.0, 0.01), (0.2, 0.32, 0.6), 0.6)):
    el[1].color = (*zen, 1); el[1].keyframe_insert('color', frame=f * STRETCH)
    el[2].color = (*hor, 1); el[2].keyframe_insert('color', frame=f * STRETCH)
    key_value(strength, f, stv)
caption(cam, 'Kennedy Space Center, Pad 39B - SLS rocket, 98 m tall', 0, 40)
caption(cam, 'T-6 s: the four RS-25 engines start', 40, 96)
caption(cam, 'T-0: both solid rocket boosters light - liftoff!', 96, 200)
caption(cam, 'Clearing the 116 m launch tower', 200, F_FAST)
caption(cam, f'Faster than sound after about a minute (shown {round(208 / ((END - F_FAST) / FPS) / STRETCH)}x faster)', F_FAST, F_SRB)
caption(cam, 'T+2 min 12 s: boosters drop away, about 47 km up', F_SRB, F_LAS)
caption(cam, 'T+3 min 11 s: the launch abort tower is jettisoned', F_LAS, END + 1)

run([('launch_earth', 0, END)], opts, NAME)
