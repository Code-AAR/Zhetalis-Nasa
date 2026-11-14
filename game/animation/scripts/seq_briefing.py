"""0. Mission briefing (plays when a new game starts): how you get to Mars.
Sun, Earth and Mars on their real orbits (distances to scale, planets enlarged). Earth and Mars move at their real
rates (365.25 and 687 days per lap). The ship leaves Earth when Mars is about 44 degrees ahead and follows half of a
transfer ellipse (Hohmann orbit: 1.00 to 1.52 AU), solved with Kepler's equation, so it meets Mars after ~259 days.
Then the camera flies to Mars and the outpost goal is set: build before the next ships, 26 months later."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mathutils import Vector

NAME = 'briefing_mission'
opts = args()
sc = reset(NAME, 26)
END = sc.frame_end
AU = 40.0                        # scene units per astronomical unit
RE, RM = 1.0 * AU, 1.524 * AU
TE, TM = 365.25, 687.0
A_T = (RE + RM) / 2; E_T = (RM - RE) / (RM + RE); T_T = 365.25 * (A_T / AU) ** 1.5   # transfer orbit, days per full lap
TRANSFER = T_T / 2               # ~259 days
F_LAUNCH, F_ARRIVE, F_ZOOM = 120, 420, 470
LEAD = 180 - 360 * TRANSFER / TM  # Mars's lead angle at launch (~44 deg)

def day(f):                      # mission day for a frame
    if f <= F_LAUNCH: return (f - F_LAUNCH) * 0.5
    if f <= F_ARRIVE: return (f - F_LAUNCH) / (F_ARRIVE - F_LAUNCH) * TRANSFER
    return TRANSFER + (f - F_ARRIVE) * 0.5

def earth_pos(d):
    a = math.radians(360 * d / TE)
    return Vector((math.cos(a) * RE, math.sin(a) * RE, 0))

def mars_pos(d):
    a = math.radians(LEAD + 360 * d / TM)
    return Vector((math.cos(a) * RM, math.sin(a) * RM, 0))

def ship_pos(d):                 # Kepler: mean anomaly -> eccentric anomaly -> true anomaly
    M = math.tau * d / T_T
    Ea = M
    for _ in range(12):
        Ea -= (Ea - E_T * math.sin(Ea) - M) / (1 - E_T * math.cos(Ea))
    nu = 2 * math.atan2(math.sqrt(1 + E_T) * math.sin(Ea / 2), math.sqrt(1 - E_T) * math.cos(Ea / 2))
    r = A_T * (1 - E_T * math.cos(Ea))
    return Vector((math.cos(nu) * r, math.sin(nu) * r, 0))

# ---------- bodies (enlarged so you can see them)
sun_b = uvsphere('sun_body', 4.0, m=mat('sun_glow', (1, 0.8, 0.4), emit=(1, 0.75, 0.3), strength=6))
earth = uvsphere('earth', 1.6, m=textured('earth_map', 'earth-map.jpg'))
mars = uvsphere('mars', 1.1, m=textured('mars_map', 'mars-map.jpg'))
def ring(name, r, color, w=0.12):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=w, major_segments=180, minor_segments=6)
    o = bpy.context.active_object; o.name = o.data.name = name
    return setmat(o, mat(name, color, emit=color, strength=1.5))
for o in (ring('earth_orbit', RE, (0.3, 0.55, 1.0)), ring('mars_orbit', RM, (1.0, 0.45, 0.25))):
    A.key(o, F_ARRIVE + 30, loc=(0, 0, 0), interp='CONSTANT'); A.key(o, F_ARRIVE + 31, loc=(0, 0, -900), interp='CONSTANT')   # out of the close-up

# transfer path: a dotted half-ellipse that appears behind the ship
dots = []
dot_mesh = sphere('dot_mesh', 0.22, m=mat('path', (1, 0.95, 0.6), emit=(1, 0.9, 0.5), strength=3), sub=1).data
bpy.data.objects.remove(bpy.data.objects['dot_mesh'])
N = 60
for i in range(N + 1):
    d = TRANSFER * i / N
    o = bpy.data.objects.new(f'path_dot_{i}', dot_mesh); link(o)
    o.location = ship_pos(d)
    f_on = F_LAUNCH + (F_ARRIVE - F_LAUNCH) * i / N
    A.key(o, f_on - 1, scale=(0.001,) * 3, interp='CONSTANT'); A.key(o, f_on, scale=(1, 1, 1), interp='CONSTANT')

ship = cyl('ship_marker', 0.5, 1.6, m=mat('ship_white', (1, 1, 1), emit=(1, 1, 1), strength=2), r2=0.0, verts=12)
for v in ship.data.vertices:     # cone points along +X
    v.co = Vector((v.co.z, v.co.x, v.co.y))
ship.scale = (0.001,) * 3

for f in range(0, END + 1, 3):
    d = day(f)
    A.key(earth, f, loc=tuple(earth_pos(d)), rot=(0, 0, d * 3), interp='LINEAR')
    A.key(mars, f, loc=tuple(mars_pos(d)), rot=(0, 0, d * 3), interp='LINEAR')
    if F_LAUNCH <= f <= F_ARRIVE + 3:
        dd = min(TRANSFER, d)
        p = ship_pos(dd); q = ship_pos(min(TRANSFER, dd + 2)) - ship_pos(max(0, dd - 2))
        A.key(ship, f, loc=tuple(p + Vector((0, 0, 1.2))), rot=(0, 0, math.degrees(math.atan2(q.y, q.x))), scale=(1, 1, 1), interp='LINEAR')
A.key(ship, F_LAUNCH - 1, scale=(0.001,) * 3, interp='CONSTANT')
A.key(ship, F_ARRIVE + 6, scale=(0.001,) * 3, interp='LINEAR')

# ---------- camera: start on Earth, pull out to the whole orbit, follow, then dive to Mars
cam = camera(lens=35)
e0 = earth_pos(day(0))
look(cam, 0, tuple(e0 - e0.normalized() * 8 + Vector((0, -3, 3))), tuple(e0))
look(cam, 60, tuple(e0 * 0.6 + Vector((10, -70, 70))), (0, 0, 0))
look(cam, F_LAUNCH, (10, -105, 105), (0, 10, 0))
look(cam, F_ARRIVE - 40, (-30, -95, 95), (-5, 10, 0))
ma = mars_pos(day(F_ARRIVE))
look(cam, F_ARRIVE, tuple(ma + Vector((0, -50, 50))), tuple(ma))
for f in range(F_ARRIVE + 3, END + 1, 3):
    m = mars_pos(day(f)); k = ease((f - F_ARRIVE) / (F_ZOOM - F_ARRIVE + 40))
    near = m - m.normalized() * 6 + Vector((0, 0, 2.5))
    look(cam, f, tuple((m + Vector((0, -50, 50))).lerp(near, k)), tuple(m), interp='LINEAR')

ld = bpy.data.lights.new('sunlight', 'POINT'); ld.energy = 7e5; ld.shadow_soft_size = 4; ld.use_shadow = False
lo = bpy.data.objects.new('sunlight', ld); link(lo); lo['preview_only'] = True
world_sky((0, 0, 0), (0, 0, 0), (0, 0, 0), strength=1.0, stars=0.9)

caption(cam, 'Your mission: fly to Mars and build an outpost', 0, 60)
caption(cam, 'Earth and Mars both circle the Sun. Mars is farther out and slower', 60, F_LAUNCH)
caption(cam, 'Launch when Mars is about 44 degrees ahead of Earth', F_LAUNCH, F_LAUNCH + 90)
caption(cam, 'The ship coasts on a curved path around the Sun...', F_LAUNCH + 90, F_ARRIVE - 80)
caption(cam, '...and meets Mars about 259 days (8.5 months) later', F_ARRIVE - 80, F_ARRIVE + 20)
caption(cam, 'Earth and Mars line up for launches only every 26 months', F_ARRIVE + 20, F_ZOOM + 70)
caption(cam, 'Build a working outpost before the next ships arrive', F_ZOOM + 70, END + 1)

run([('briefing_mission', 0, END)], opts, NAME)
