"""4. The outpost grows over 26 months, starting from just the two landing pods.
26 months is the real gap between Earth-Mars launch windows (the planets line up again every ~26 months), so the
outpost must be ready - and the ascent vehicle fuelled - by the time the next ships can set out.
1.125 s per month (month m starts at frame 24 + 27m). The empty 'month_counter' carries the month number in its scale.x, so the game can read
the current month while the clip plays."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'outpost_26_months'
opts = args()
sc = reset(NAME, 32)
END = sc.frame_end
def mf(m): return int(round(24 + m * 27))          # month -> frame (month 26 = frame 726)

def grow(o, m0, m1, flat=False, over=1.06):
    """Appear between months m0 and m1: pop up from the ground (flat=True: rise out of it)."""
    f0, f1 = mf(m0), mf(m1)
    s0 = (0.7, 0.7, 0.001) if flat else (0.001, 0.001, 0.001)
    A.key(o, f0 - 1, scale=(0.001,) * 3, interp='CONSTANT')
    A.key(o, f0, scale=s0)
    A.key(o, f1 - max(2, (f1 - f0) // 5), scale=(over, over, over))
    A.key(o, f1, scale=(1, 1, 1))

g, rk, _ = mars_ground(size=1400, flat_r=110, seed=4, rocks_n=180)

# ---------- month 0: the two pods (crew pod; cargo pod = the ascent vehicle on its descent stage)
L1, P1 = lander('crew_pod', (0, 0, 0))
mav, ascent, plume, _ = ascent_vehicle('ascent_vehicle', (46, 30, 0))
plume.scale = (1, 1, 0.001)

# ---------- rover rolls off the cargo pod in month 1, then works around the site
sev = rover('sev', (40, 24, 0), rot_z=200)
grow(sev, 0.6, 1.0)
stops = [(1.0, (40, 22), 0), (1.6, (14, -10), 0), (2.6, (-45, -40), 0), (3.6, (34, 6), 0), (4.4, (100, 80), 0),
         (5.5, (12, 10), 0), (7.2, (50, -18), 0), (9.0, (8, -12), 0), (10.2, (64, 14), 0), (11.5, (40, 62), 0), (12.6, (64, 20), 0), (13.3, (10, -16), 0), (14.0, (-30, -6), 0),
         (16.0, (-40, -14), 0), (18.5, (-60, -60), 0), (21.0, (50, -50), 0), (23.5, (34, 16), 0), (26.0, (26, 8), 0)]
for bad in route_problems([p for _, p, _ in stops]):
    print('ROUTE WARNING (rover):', bad)
pts = []
for m, (x, y), h in stops:
    pts += [(mf(m), (x, y))] + ([(mf(m) + 5, (x, y))] if m < 26 else [])   # park a moment at each stop
rover_path(sev, pts)

# ---------- month 1-3: solar trackers, 3 rows of 5 (2 more rows in month 17-19)
trackers = []
for row in range(5):
    for col in range(5):
        tr, pv = solar_tracker(f'solar_{row}_{col}', (-82 + col * 11, -28 - row * 8, 0))
        pv.rotation_euler.x = math.radians(-25)
        m0 = 1.2 + (row * 5 + col) * 0.12 if row < 3 else 17 + ((row - 3) * 5 + col) * 0.14
        grow(tr, m0, m0 + 0.5)
        trackers.append(tr)

# ---------- month 3-4: two fission power units 150 m out (real ones ~1 km away), cable trench to the site
for i, (x, y) in enumerate(((160, -18), (172, -32))):
    fu = fission_unit(f'fission_{i}', (x, y, 0))
    grow(fu, 3.0 + i * 0.7, 3.6 + i * 0.7)
cable = cube('power_cable', (1, 0.5, 0.15), loc=(0.5, 0, 0.08), m=mat('cable', (0.18, 0.18, 0.2), rough=0.8))
cab = empty('power_cable_run', loc=(10, -6, 0)); cable.parent = cab
d = Vector((160 - 10, -18 + 6, 0)); cab.rotation_euler.z = math.atan2(d.y, d.x)
A.key(cab, mf(2.9), scale=(0.001, 1, 1)); A.key(cab, mf(3.6), scale=(d.length, 1, 1))

# ---------- month 4-6: first habitat
H1 = HAB1
h1 = hab('hab_1', (*H1, 0), rot_z=200)
grow(h1, 4.0, 5.8, flat=True, over=1.02)

# ---------- month 6-10: oxygen + methane plant, tanks one by one, fill gauge up to month 24
isru, tanks, gauge = isru_plant('propellant_plant', (62, -40, 0))
grow(isru, 6.0, 6.8)
for i, t in enumerate(tanks):
    grow(t, 7.0 + i * 0.8, 7.6 + i * 0.8)
A.key(gauge, mf(8), scale=(1, 1, 0.001)); A.key(gauge, mf(24), scale=(1, 1, 4.5))
hose = cube('propellant_hose', (1, 0.35, 0.35), loc=(0.5, 0, 0.2), m=mat('hose', (0.85, 0.55, 0.15), rough=0.6))
hr = empty('propellant_hose_run', loc=(58, -35, 0)); hose.parent = hr
d2 = Vector((46 - 58, 30 + 35 - 4, 0)); hr.rotation_euler.z = math.atan2(d2.y, d2.x)
A.key(hr, mf(8.0), scale=(0.001, 1, 1)); A.key(hr, mf(8.8), scale=(d2.length, 1, 1))

# ---------- month 8-9: greenhouse, joined to habitat 1 by a sealed walkway; month 11-13: habitat 2 and its walkway
gh = greenhouse('greenhouse', GH)
grow(gh, 7.6, 8.6, flat=True, over=1.0)
r_h = hab_wall_radius()
def link(name, a, ra, b, rb, m0, m1):
    w, p0, p1, collars = walkway_between(name, a, ra, b, rb)
    L = w.scale.y
    A.key(w, mf(m0) - 1, scale=(0.001,) * 3, interp='CONSTANT')
    A.key(w, mf(m0), scale=(1, 0.001, 1)); A.key(w, mf(m1), scale=(1, L, 1))
    for i, c in enumerate(collars):                     # the airlock collars go on first, then the tube between them
        A.key(c, mf(m0) - 1, scale=(0.001,) * 3, interp='CONSTANT'); A.key(c, mf(m0), scale=(1, 1, 1), interp='CONSTANT')
link('walkway_greenhouse', HAB1, r_h, gh_door(), 0.0, 9.0, 9.8)
H2 = HAB2
h2 = hab('hab_2', (*H2, 0), rot_z=150)
grow(h2, 11.0, 12.8, flat=True, over=1.02)
link('walkway_hab', HAB1, r_h, HAB2, r_h, 13.0, 13.8)

# ---------- month 13-18: bagged-soil shielding walls, with gaps for the walkways
ang = lambda a, b: math.atan2(b[1] - a[1], b[0] - a[0])
for i, (c, gaps, m0) in enumerate(((HAB1, (ang(HAB1, HAB2), ang(HAB1, gh_door())), 13.5), (HAB2, (ang(HAB2, HAB1),), 15.5))):
    b = berm_gapped(f'shield_berm_{i}', c, gaps=gaps)
    A.key(b, mf(m0) - 1, scale=(0.001, 0.001, 0.001), interp='CONSTANT'); A.key(b, mf(m0), scale=(1, 1, 0.02)); A.key(b, mf(m0 + 2.5), scale=(1, 1, 1))

# ---------- month 15-16: dish for talking to Earth, then it keeps tracking slowly
ds, head = dish('earth_dish', (-48, 4, 0), r=3.4)
grow(ds, 15.0, 15.8)
head.rotation_euler = (math.radians(50), 0, 0)
for m in range(16, 27):
    A.key(head, mf(m), rot=(50 + 8 * math.sin(m), 0, (m - 16) * 25))

# ---------- crew: two astronauts walking between places
places = [(4, -6), (-6, -4), (-60, -40), (44, -36), (16, -24), (-40, -2), (-32, -18), (-28, 6), (-20, 36), (8, 56)]
for i in range(2):
    a = astronaut(f'astronaut_{i}', (places[i][0], places[i][1], 0))
    rnd = random.Random(20 + i)
    last = places[i]
    for m in [x * 0.75 for x in range(0, 36)]:
        if mf(m) > END: break
        for _try in range(40):                           # only walk where the way is clear of buildings and walkways
            q = rnd.choice(places); q = (q[0] + rnd.uniform(-2, 2), q[1] + rnd.uniform(-2, 2))
            if not route_problems([last, q]): break
        else:
            q = last
        hdg = math.degrees(math.atan2(q[1] - last[1], q[0] - last[0])) + 90 if q != last else None
        A.key(a, mf(m), loc=(q[0], q[1], 0), rot=(0, 0, hdg) if hdg is not None else None)
        last = q

# ---------- month counter for the game (scale.x = month)
mc = empty('month_counter')
A.key(mc, 0, scale=(0.001, 1, 1), interp='LINEAR')
A.key(mc, mf(0), scale=(0.001, 1, 1), interp='LINEAR')
A.key(mc, mf(26), scale=(26, 1, 1), interp='LINEAR')
A.key(mc, END, scale=(26, 1, 1), interp='LINEAR')

# ---------- camera: one slow lap around the site
for _o in [o for o in bpy.data.objects if o.name.startswith('astronaut_') and o.parent is None]:
    walk_bob(_o)

cam = camera(lens=30)
for f in range(0, END + 1, 8):
    a = math.radians(-120 + 300 * f / END)
    r = 135 - 25 * math.sin(math.pi * f / END)
    look(cam, f, (math.cos(a) * r + 10, math.sin(a) * r + 15, 48 + 12 * math.sin(math.pi * f / END)), (12, 12, 2), interp='LINEAR')

mars_world()
caps = [(0, 'Sol 1: just the two landing pods'), (1, 'Month 1: the rover rolls off the cargo pod'),
        (2, 'Month 2: solar trackers go up'), (3, 'Month 3: reactors for power day, night and in storms'),
        (4.4, 'Month 5: the first big habitat'), (6.2, 'Month 7: making oxygen and fuel from air and ice'),
        (7.6, 'Month 8: a greenhouse, linked by a sealed walkway'), (11, 'Month 12: a second habitat, linked in month 13'),
        (13.5, 'Month 14: soil walls block some radiation'), (15, 'Month 16: a big dish to talk to Earth'),
        (17, 'Month 18: more solar power'), (20, 'Month 21: the ascent vehicle\'s tanks keep filling'),
        (24, 'Month 26: the next launch window opens on Earth')]
for i, (m, t) in enumerate(caps):
    caption(cam, t, mf(m), mf(caps[i + 1][0]) if i + 1 < len(caps) else END + 1)

run([('outpost_26_months', 0, END)], opts, NAME)
