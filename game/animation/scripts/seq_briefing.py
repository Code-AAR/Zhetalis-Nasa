"""0. Mission briefing (plays when a new game starts): how you get to Mars, with the real orbital sequence.
Sun, Earth and Mars on their real orbits (distances to scale, planets enlarged). Earth and Mars move at their real
rates (365.25 and 687 days per lap).
1. Parking orbit: the ship circles Earth once (close-up, not to scale).
2. Trans-Mars injection (TMI): an engine burn at the low point of the parking orbit. The ship leaves Earth on a
   hyperbolic escape path (solved with the hyperbolic Kepler equation) whose outgoing direction is along Earth's own
   motion round the Sun - so the ship ends up slightly faster than Earth, on the transfer orbit.
3. Hohmann transfer: half of an ellipse from 1.00 to 1.52 AU, solved with Kepler's equation, engine off. The ship
   leaves when Mars is ~44 degrees ahead and meets it after ~259 days.
4. Mars orbit insertion (MOI): the ship turns round and fires a braking burn so Mars's gravity captures it.
Then the camera closes on Mars and the outpost goal is set: build before the next ships, 26 months later."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mathutils import Vector

NAME = 'briefing_mission'
opts = args()
sc = reset(NAME, 30)
END = sc.frame_end
AU = 40.0                        # scene units per astronomical unit
RE, RM = 1.0 * AU, 1.524 * AU
TE, TM = 365.25, 687.0
A_T = (RE + RM) / 2; E_T = (RM - RE) / (RM + RE); T_T = 365.25 * (A_T / AU) ** 1.5   # transfer orbit, days per full lap
TRANSFER = T_T / 2               # ~259 days
F_TMI0, F_BURN, F_LAUNCH, F_ARRIVE, F_ZOOM = 120, 190, 240, 540, 590
LEAD = 180 - 360 * TRANSFER / TM  # Mars's lead angle at launch (~44 deg)

def day(f):                      # mission day for a frame (the clock stops during the close-up of the TMI burn)
    if f <= F_TMI0: return (f - F_TMI0) * 0.5
    if f <= F_LAUNCH: return 0.0
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

# ---------- near Earth: parking orbit and the hyperbolic escape after the TMI burn (Earth-centred, enlarged)
E0 = earth_pos(0)
RP = 2.6                         # parking orbit radius (scene units; Earth's radius here is 1.6)
HE = 1.3; HA = RP / (HE - 1)     # escape hyperbola: eccentricity, semi-major axis
H_END = math.acosh((20 / HA + 1) / HE)
M_END = HE * math.sinh(H_END) - H_END
def hyper_local(H):
    return Vector((HA * (HE - math.cosh(H)), HA * math.sqrt(HE * HE - 1) * math.sinh(H), 0))
_v = Vector((-HA * math.sinh(H_END), HA * math.sqrt(HE * HE - 1) * math.cosh(H_END), 0))
PHI = math.pi / 2 - math.atan2(_v.y, _v.x)       # turn it so the ship leaves along Earth's motion (+Y here)
def rot(v, a): return Vector((v.x * math.cos(a) - v.y * math.sin(a), v.x * math.sin(a) + v.y * math.cos(a), v.z))
def hyper(f):                    # Earth-relative position on the escape path (hyperbolic Kepler: M = e sinh H - H)
    M = M_END * (f - F_BURN) / (F_LAUNCH - F_BURN)
    H = math.asinh(M / HE) if M else 0.0
    for _ in range(20):
        H -= (HE * math.sinh(H) - H - M) / (HE * math.cosh(H) - 1)
    return rot(hyper_local(H), PHI)
LAP = F_BURN - F_TMI0 + 0.0
def parking(f):
    a = PHI - math.tau * (F_BURN - f) / LAP
    return Vector((math.cos(a) * RP, math.sin(a) * RP, 0))
ESCAPE_END = hyper(F_LAUNCH)
R_CAP, CAP_LAP = 2.2, 60.0       # capture orbit round Mars (enlarged), frames per lap

def ship_at(f):
    if f <= F_BURN: return E0 + parking(f)
    if f <= F_LAUNCH: return E0 + hyper(f)
    d = day(f)
    if f <= F_ARRIVE:
        k = ease(min(1.0, (f - F_LAUNCH) / 45))          # hand over from the close-up path to the Sun-scale orbit
        return ship_pos(d) + ESCAPE_END * (1 - k)
    k = ease(min(1.0, (f - F_ARRIVE) / 24)); a = math.pi + math.tau * (f - F_ARRIVE) / CAP_LAP
    return mars_pos(d) + Vector((math.cos(a), math.sin(a), 0)) * R_CAP * k

# ---------- bodies (enlarged so you can see them)
sun_b = uvsphere('sun_body', 4.0, m=mat('sun_glow', (1, 0.8, 0.4), emit=(1, 0.75, 0.3), strength=6))
earth = uvsphere('earth', 1.6, m=textured('earth_map', 'earth-map.jpg'))
mars = uvsphere('mars', 1.1, m=textured('mars_map', 'mars-map.jpg'))
def ring(name, r, color, w=0.12, loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=w, major_segments=180, minor_segments=6, location=loc)
    o = bpy.context.active_object; o.name = o.data.name = name
    return setmat(o, mat(name, color, emit=color, strength=1.5))
for o in (ring('earth_orbit', RE, (0.3, 0.55, 1.0)), ring('mars_orbit', RM, (1.0, 0.45, 0.25))):
    A.key(o, F_ARRIVE + 30, loc=(0, 0, 0), interp='CONSTANT'); A.key(o, F_ARRIVE + 31, loc=(0, 0, -900), interp='CONSTANT')   # out of the close-up
park = ring('parking_orbit', RP, (0.55, 0.85, 1.0), w=0.025, loc=tuple(E0))
A.key(park, F_TMI0 - 30, scale=(0.001,) * 3, interp='LINEAR'); A.key(park, F_TMI0 - 10, scale=(1, 1, 1), interp='CONSTANT')
A.key(park, F_LAUNCH + 40, scale=(1, 1, 1), interp='LINEAR'); A.key(park, F_LAUNCH + 60, scale=(0.001,) * 3, interp='CONSTANT')

# path dots: the escape path near Earth, then the transfer half-ellipse, appearing behind the ship
dot_mesh = sphere('dot_mesh', 0.22, m=mat('path', (1, 0.95, 0.6), emit=(1, 0.9, 0.5), strength=3), sub=1).data
bpy.data.objects.remove(bpy.data.objects['dot_mesh'])
def dot(name, loc, f_on, size=1.0, f_off=None):
    o = bpy.data.objects.new(name, dot_mesh); link(o); o.location = loc
    A.key(o, f_on - 1, scale=(0.001,) * 3, interp='CONSTANT'); A.key(o, f_on, scale=(size,) * 3, interp='CONSTANT')
    if f_off: A.key(o, f_off, scale=(size,) * 3, interp='LINEAR'); A.key(o, f_off + 15, scale=(0.001,) * 3, interp='CONSTANT')
for i in range(1, 31):
    f = F_BURN + (F_LAUNCH - F_BURN) * i / 30
    dot(f'escape_dot_{i}', E0 + hyper(f), round(f), 0.25, F_LAUNCH + 45)
N = 60
for i in range(N + 1):
    d = TRANSFER * i / N
    dot(f'path_dot_{i}', ship_pos(d), round(F_LAUNCH + (F_ARRIVE - F_LAUNCH) * i / N))

ship = cyl('ship_marker', 0.5, 1.6, m=mat('ship_white', (1, 1, 1), emit=(1, 1, 1), strength=2), r2=0.0, verts=12)
for v in ship.data.vertices:     # cone points along +X, tail at x = -0.8
    v.co = Vector((v.co.z, v.co.x, v.co.y))
burn = flame('burn', 0.32, 2.4, ship, (-0.8, 0, 0), color=(1.0, 0.6, 0.2), strength=6, diamonds=2)
burn.rotation_euler = (0, math.pi / 2, 0)                      # exhaust out of the tail (-X)
for f0, f1 in ((F_BURN - 3, F_BURN + 24), (F_ARRIVE - 4, F_ARRIVE + 16)):   # TMI burn, then the braking burn at Mars
    A.key(burn, f0 - 1, scale=(0.001,) * 3, interp='CONSTANT'); A.key(burn, f0 + 3, scale=(1, 1, 1), interp='LINEAR')
    A.key(burn, f1 - 3, scale=(1, 1, 1), interp='LINEAR'); A.key(burn, f1, scale=(0.001,) * 3, interp='CONSTANT')
A.key(burn, 0, scale=(0.001,) * 3, interp='CONSTANT')

def ship_scale(f):               # small in the close-ups, full size on the Sun-scale view
    if f <= F_LAUNCH: return 0.32
    if f <= F_LAUNCH + 50: return 0.32 + 0.68 * ease((f - F_LAUNCH) / 50)
    if f <= F_ARRIVE - 30: return 1.0
    return 1.0 - 0.72 * ease(min(1.0, (f - F_ARRIVE + 30) / 40))

for f in range(F_TMI0 - 30, END + 1):
    p = ship_at(f); q = ship_at(f + 1) - ship_at(f - 1)
    heading = math.degrees(math.atan2(q.y, q.x))
    if F_ARRIVE - 10 <= f <= F_ARRIVE + 18: heading += 180 * ease(min(1.0, (f - F_ARRIVE + 10) / 8))   # turn round to brake
    lift = 0.0 if f <= F_LAUNCH or f >= F_ARRIVE else 1.2 * ease(min(1.0, (f - F_LAUNCH) / 40)) * ease(min(1.0, (F_ARRIVE - f) / 30))
    A.key(ship, f, loc=tuple(p + Vector((0, 0, lift))), rot=(0, 0, heading), scale=(ship_scale(f),) * 3, interp='LINEAR')
A.key(ship, F_TMI0 - 31, scale=(0.001,) * 3, interp='CONSTANT')

for f in range(0, END + 1, 3):
    d = day(f)
    A.key(earth, f, loc=tuple(earth_pos(d)), rot=(0, 0, d * 3 + f * 0.4), interp='LINEAR')
    A.key(mars, f, loc=tuple(mars_pos(d)), rot=(0, 0, d * 3), interp='LINEAR')

# ---------- camera: Earth, the whole system, close on the TMI burn, follow the transfer, then dive to Mars
cam = camera(lens=35)
e0 = earth_pos(day(0))
look(cam, 0, tuple(e0 - e0.normalized() * 8 + Vector((0, -3, 3))), tuple(e0))
look(cam, 60, tuple(e0 * 0.6 + Vector((10, -70, 70))), (0, 0, 0))
look(cam, F_TMI0, tuple(E0 + Vector((-3, -11, 8))), tuple(E0 + Vector((0, 0.5, 0))))
look(cam, F_BURN, tuple(E0 + Vector((-5, -14, 10))), tuple(E0 + Vector((0, 2, 0))))
look(cam, F_LAUNCH, tuple(E0 + Vector((4, -34, 26))), tuple(E0 + Vector((0, 9, 0))))
look(cam, F_LAUNCH + 70, (10, -105, 105), (0, 10, 0))
look(cam, F_ARRIVE - 40, (-30, -95, 95), (-5, 10, 0))
ma = mars_pos(day(F_ARRIVE))
look(cam, F_ARRIVE, tuple(ma + Vector((0, -40, 40))), tuple(ma))
for f in range(F_ARRIVE + 3, END + 1, 3):
    m = mars_pos(day(f)); k = ease((f - F_ARRIVE) / (F_ZOOM - F_ARRIVE + 40))
    near = m - m.normalized() * 7 + Vector((0, -2, 4))
    look(cam, f, tuple((m + Vector((0, -40, 40))).lerp(near, k)), tuple(m), interp='LINEAR')

ld = bpy.data.lights.new('sunlight', 'POINT'); ld.energy = 7e5; ld.shadow_soft_size = 4; ld.use_shadow = False
lo = bpy.data.objects.new('sunlight', ld); link(lo); lo['preview_only'] = True
world_sky((0, 0, 0), (0, 0, 0), (0, 0, 0), strength=1.0, stars=0.9)

caption(cam, 'Your mission: fly to Mars and build an outpost', 0, 60)
caption(cam, 'Earth and Mars both circle the Sun; Mars is slower', 60, F_TMI0, phase='Orbits to scale')
caption(cam, 'First the ship circles Earth in a parking orbit', F_TMI0, F_BURN, phase='Parking orbit')
caption(cam, 'Trans-Mars injection: one big burn to escape Earth', F_BURN, F_LAUNCH, phase='TMI burn')
caption(cam, 'It leaves when Mars is about 44 degrees ahead', F_LAUNCH, F_LAUNCH + 90, phase='Hohmann transfer')
caption(cam, 'Engine off: half an orbit around the Sun...', F_LAUNCH + 90, F_ARRIVE - 80, phase='Hohmann transfer')
caption(cam, '...meeting Mars about 259 days (8.5 months) later', F_ARRIVE - 80, F_ARRIVE, phase='Hohmann transfer')
caption(cam, 'A braking burn lets Mars capture the ship in orbit', F_ARRIVE, F_ARRIVE + 60, phase='Orbit insertion')
caption(cam, 'Launch windows to Mars come every 26 months', F_ARRIVE + 60, F_ARRIVE + 115)
caption(cam, 'Build a working outpost before the next ships arrive', F_ARRIVE + 115, END + 1)

run([('briefing_mission', 0, END)], opts, NAME)
