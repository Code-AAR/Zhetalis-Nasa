"""7. Leaving Mars. Modelled on the Apollo 17 lunar liftoff (filmed by the rover's TV camera, 14 Dec 1972):
a fixed camera; the descent stage stays behind as the launch pad; pyros fire, insulation and dust burst out, and the
ascent stage climbs straight up, then pitches over while the camera tilts up to follow.
Differences on Mars: a much bigger, fully fuelled ascent stage (methane and oxygen made at the outpost), because
Mars needs about 4.1 km/s to reach orbit against the Moon's 1.9 km/s and has 2.2x the Moon's gravity; and a
visible plume and dust cloud in the thin air."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'ascent_mars'
opts = args()
sc = reset(NAME, 20)
END = sc.frame_end
F_IGN, F_UP, F_PITCH, F_WIDE = 72, 80, 170, 300

g, rk, _ = mars_ground(size=3000, center=(20, -20), flat_r=110, seed=4, rocks_n=160)
base = finished_outpost()
mav, ascent, plume, z0 = base['ascent']
MAV = Vector((46, 30, 0))

# ---------- flight: a = (thrust/mass - g); about 0.6 g net at first, rising as the tanks empty
path = {}
pos = Vector((0, 0, 0)); v = Vector((0, 0, 0))
for f in range(0, END + 1):
    if f > F_UP:
        t = (f - F_UP) / FPS
        a = 5.5 + 1.4 * t
        th = math.radians(min(55, max(0.0, (f - F_PITCH) * 0.45)))     # pitch over toward +X (east)
        dirv = Vector((math.sin(th), 0, math.cos(th)))
        v += dirv * a / FPS
        pos += v / FPS
    th = math.radians(min(55, max(0.0, (f - F_PITCH) * 0.45)))
    path[f] = (pos.copy(), th)
for f in range(F_UP, END + 1, 2):
    p, th = path[f]
    A.key(ascent, f, loc=tuple(p), rot=(0, math.degrees(th), 0), interp='LINEAR')
A.key(ascent, F_UP - 1, loc=(0, 0, 0), rot=(0, 0, 0))

# engine: start-up flash at F_IGN, then a steady methane/oxygen plume (bluish, nearly clear)
flicker(plume, F_IGN, END, base=lambda f: (1.0 + 0.5 * ease((f - F_UP) / 120), 1.0 + 0.5 * ease((f - F_UP) / 120), 1.0 + 1.5 * ease((f - F_UP) / 160)), seed=5, grow=3)

# Apollo-style burst: pyros cut the ties and shreds of foil insulation fly out
foil_m = mat('foil', (0.95, 0.75, 0.25), rough=0.3, metal=0.9)
foil = []
rnd = random.Random(17)
for i in range(26):
    o = cube(f'foil_{i}', (rnd.uniform(0.2, 0.6), rnd.uniform(0.2, 0.5), 0.02), m=foil_m)
    a = rnd.uniform(0, math.tau); sp = rnd.uniform(3, 9); up = rnd.uniform(2, 8)
    p0 = MAV + Vector((math.cos(a) * 2, math.sin(a) * 2, z0 + rnd.uniform(-0.5, 0.5)))
    o.location = p0; o.scale = (0.001,) * 3
    A.key(o, F_IGN - 1, scale=(0.001,) * 3, interp='CONSTANT')
    for k in range(0, 49, 4):
        t = k / FPS
        z = p0.z + up * t - 0.5 * 3.71 * t * t
        A.key(o, F_IGN + k, loc=(p0.x + math.cos(a) * sp * t, p0.y + math.sin(a) * sp * t, max(0.03, z)),
              rot=(400 * t * rnd.uniform(0.5, 1), 300 * t, 200 * t), scale=(1, 1, 1), interp='LINEAR')
    foil.append(o)

# dust driven out across the pad, then the plume trail as it climbs
dust = Puffs('liftoff_dust', 70, (0.62, 0.42, 0.28), alpha=0.45)
f = F_IGN
while f < F_IGN + 70:
    for _ in range(3):
        a = rnd.uniform(0, math.tau); sp = rnd.uniform(0.5, 1.1)
        dust.emit(f, MAV + Vector((math.cos(a) * 4, math.sin(a) * 4, 0.6)), (math.cos(a) * sp, math.sin(a) * sp, rnd.uniform(0.04, 0.14)),
                  int(rnd.uniform(80, 120)), 1.2, rnd.uniform(3.5, 7))
    f += 2

# ---------- camera: fixed like the Apollo TV camera, tilting up to follow, then a wide shot over the outpost
cam = camera(lens=45)
CAMP = MAV + Vector((-38, -62, 2.2))
for f in range(0, F_WIDE, 2):                   # fixed at first, then trailing it at ~45 m so it stays big in frame
    p, th = path[f]
    tgt = MAV + p + Vector((0, 0, z0 + 3))
    d = tgt - CAMP
    pos = CAMP if d.length < 45 else tgt - d.normalized() * 45
    look(cam, f, tuple(pos), tuple(tgt), interp='LINEAR')
for f in range(F_WIDE, END + 1, 2):
    p, th = path[f]
    k = (f - F_WIDE) / (END - F_WIDE)
    look(cam, f, tuple(MAV + p + Vector((-22 - 10 * k, -38, -10))), tuple(MAV + p + Vector((0, 0, 4))), interp='LINEAR')

mars_world()
caption(cam, 'Tanks full of oxygen and methane made on Mars', 0, F_IGN)
caption(cam, 'Ignition! The landing stage stays behind as the launch pad', F_IGN, F_PITCH)
caption(cam, 'Mars needs about 4.1 km/s to reach orbit - more than twice the Moon\'s 1.9 km/s', F_PITCH, F_WIDE)
caption(cam, 'That is why this ascent stage carries so much more fuel than Apollo\'s', F_WIDE, 410)
caption(cam, 'Next stop: the transit ship in orbit, then months of coasting home', 410, END + 1)

run([('ascent_mars', 0, END)], opts, NAME)
