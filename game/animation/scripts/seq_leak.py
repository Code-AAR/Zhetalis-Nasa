"""6c. Air leak: a seal fails where the walkway joins habitat 1. Cabin air rushes out into Mars's near-vacuum
(about 0.6% of Earth's pressure) and the moisture in it freezes into a white plume. A red warning light flashes and
cabin pressure starts to fall. Repair: an astronaut finds the leak, presses a patch over the seal, and the crew
tops the air back up from the oxygen and nitrogen tanks. The ISS has had small leaks found and patched like this.
The empty 'cabin_pressure' holds pressure as a fraction of normal in scale.x (1.0 -> 0.9 -> 1.0).
Two clips: 'air_leak' (0-7.5 s) and 'leak_patched' (7.5-15 s)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'failure_air_leak'
opts = args()
sc = reset(NAME, 15)
END = sc.frame_end
F_CRACK, F_SPLIT, F_ARRIVE, F_PATCH, F_SEALED = 40, 180, 262, 280, 305

g, rk, _ = mars_ground(size=1400, center=(-2, 8), flat_r=110, seed=4, clear=[(0, 10, 40), (-82, -40, 20), (62, -40, 12), (46, 30, 8)])
base = finished_outpost()

# the leak: on walkway 1, just before it meets habitat 1
a, b = Vector((*HAB1, 0)), Vector((*HAB2, 0))   # the walkway from habitat 1 to habitat 2
along = (b - a).normalized()
out = Vector((along.y, -along.x, 0))            # sideways, toward the camera
SEAM = a + along * (hab_wall_radius() + 1.3) + out * 1.75 + Vector((0, 0, 1.9))   # just outside habitat 1's collar
frost = Puffs('leak_frost', 50, (0.95, 0.96, 1.0), alpha=0.55)
rnd = random.Random(12)
f = F_CRACK
while f < F_SEALED:
    k = 1.0 if f < F_PATCH else max(0.0, 1 - (f - F_PATCH) / (F_SEALED - F_PATCH))
    if k > 0.05:
        v = out * rnd.uniform(0.35, 0.6) * k + along * rnd.uniform(-0.05, 0.05) + Vector((0, 0, rnd.uniform(0.0, 0.06)))
        frost.emit(f, tuple(SEAM), tuple(v), 34, 0.15, rnd.uniform(1.2, 2.2) * (0.4 + 0.6 * k))
    f += 2

beacon = empty('leak_beacon', loc=tuple(SEAM - out * 1.6 + Vector((0, 0, 1.6))))
red = sphere('beacon_red', 0.3, m=mat('beacon_red', (1, 0.1, 0.05), emit=(1, 0.1, 0.05), strength=6), parent=beacon)
grn = sphere('beacon_green', 0.3, m=mat('beacon_green', (0.1, 1, 0.3), emit=(0.1, 1, 0.3), strength=5), parent=beacon)
A.key(red, 0, scale=(0.001,) * 3, interp='CONSTANT'); A.key(grn, 0, scale=(0.001,) * 3, interp='CONSTANT')
for f in range(F_CRACK + 4, F_SEALED, 16):
    A.key(red, f, scale=(1, 1, 1), interp='CONSTANT'); A.key(red, f + 8, scale=(0.001,) * 3, interp='CONSTANT')
A.key(grn, F_SEALED, scale=(1, 1, 1), interp='CONSTANT')

# the patch
patch = cube('seal_patch', (0.9, 0.08, 0.9), m=mat('patch', (0.85, 0.6, 0.1), rough=0.6))
patch.location = tuple(SEAM - out * 0.05)
patch.rotation_euler.z = math.atan2(along.y, along.x)
A.key(patch, F_PATCH - 1, scale=(0.001,) * 3, interp='CONSTANT'); A.key(patch, F_PATCH, scale=(0.3, 1, 0.3)); A.key(patch, F_PATCH + 10, scale=(1, 1, 1))

# astronaut out of the crew pod's airlock, to the leak
astro = astronaut('astronaut_0', (2, -2, 0))
stand = SEAM - Vector((0, 0, 1.9)) + out * 1.1
A.key(astro, F_SPLIT + 4, loc=(2.5, -2.5, 0), scale=(0.001,) * 3, interp='CONSTANT')
A.key(astro, F_SPLIT + 5, loc=(2.5, -2.5, 0), rot=(0, 0, 30), scale=(1, 1, 1))
A.key(astro, F_ARRIVE, loc=tuple(stand), rot=(0, 0, math.degrees(math.atan2(-out.y, -out.x)) + 90))
A.key(astro, F_PATCH, rot=(15, 0, math.degrees(math.atan2(-out.y, -out.x)) + 90))
A.key(astro, F_SEALED + 10, rot=(0, 0, math.degrees(math.atan2(-out.y, -out.x)) + 90))

press = empty('cabin_pressure')
A.key(press, 0, scale=(1, 1, 1)); A.key(press, F_CRACK, scale=(1, 1, 1))
A.key(press, F_PATCH, scale=(0.9, 1, 1), interp='LINEAR'); A.key(press, F_SEALED, scale=(0.9, 1, 1)); A.key(press, END, scale=(1, 1, 1))

for _o in [o for o in bpy.data.objects if o.name.startswith('astronaut_') and o.parent is None]:
    walk_bob(_o)

cam = camera(lens=35)
view = SEAM + out * 16 + Vector((0, 0, 3)) - along * 6
look(cam, 0, tuple(view + out * 18 + Vector((0, 0, 8))), tuple(SEAM))
look(cam, F_CRACK + 30, tuple(view), tuple(SEAM))
look(cam, F_SPLIT - 1, tuple(view + Vector((0, 0, -1))), tuple(SEAM), interp='CONSTANT')
look(cam, F_SPLIT, tuple(SEAM + out * 22 + Vector((0, 0, 9)) - along * 14), tuple(SEAM - along * 6), interp='CONSTANT')
look(cam, F_ARRIVE - 10, tuple(view), tuple(SEAM - Vector((0, 0, 0.8))))
look(cam, END, tuple(view + out * 3), tuple(SEAM - Vector((0, 0, 0.8))))

mars_world()
caption(cam, 'All quiet at the outpost...', 0, F_CRACK)
caption(cam, 'Leak! A seal fails where the walkway meets the habitat', F_CRACK, 110)
caption(cam, 'Mars air is so thin that cabin air rushes out, and its moisture freezes', 110, F_SPLIT)
caption(cam, 'Repair: find the leak and seal it', F_SPLIT, F_PATCH)
caption(cam, 'Patch pressed on: the leak stops', F_PATCH, F_SEALED + 20)
caption(cam, 'The crew tops the air back up from the tanks. Green light', F_SEALED + 20, END + 1)

run([('air_leak', 0, F_SPLIT), ('leak_patched', F_SPLIT, END)], opts, NAME)
