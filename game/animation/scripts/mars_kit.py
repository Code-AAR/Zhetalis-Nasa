"""Mars outpost pieces shared by the Mars sequences. Game models where the game has them
(space-pack lander = the game's landing pod, hab, NASA SEV rover, astronaut, greenhouse walkway, NASA orbital
replacement unit); simple game-authored shapes for what it has no model of (solar trackers, fission power unit,
oxygen/methane plant, dish). Sizes in metres."""
import math
from common import *
from mathutils import Vector

RUST = (0.52, 0.29, 0.17)


def mars_world(sun_strength=2.6):
    s = sun(sun_strength, color=(1.0, 0.9, 0.78), rot=(52, 0, 40), angle=0.35)
    sky = world_sky((0.86, 0.66, 0.5), (0.5, 0.38, 0.3), (0.42, 0.26, 0.16), strength=0.9)
    return s, sky


def mars_ground(size=1400, res=90, amp=7, flat_r=110, seed=4, rocks_n=60):
    g = terrain('mars_ground', size, res, amp, RUST, seed=seed, flat_r=flat_r, flat_soft=120)
    r = rocks('rocks', rocks_n, 25, size * 0.3, (0.2, 1.1), (0.33, 0.2, 0.14), seed=seed + 1, avoid=[(0, 0, 70)])
    return g, r


def lander(name, loc=(0, 0, 0), rot_z=0):
    """The game's landing pod (space-pack lander, 11 m tall, every part its own object)."""
    root, P = import_glb('space-pack/lander.glb', name)
    root.location = loc
    root.rotation_euler.z = math.radians(rot_z)
    # rename parts so two landers don't collide on export
    parts = {}
    for k, o in P.items():
        base = k.split('.')[0]
        o.name = f'{name}_{base}'
        parts[base] = o
    return root, parts


def hab(name, loc=(0, 0, 0), rot_z=0):
    root, P = import_glb('space-pack/hab.glb', name)
    for k, o in P.items():
        o.name = f'{name}_{k.split(".")[0]}'
    root.location = loc
    root.rotation_euler.z = math.radians(rot_z)
    return root


def rover(name='sev', loc=(0, 0, 0), rot_z=0):
    """NASA Space Exploration Vehicle (pressurised rover), decimated for the web."""
    root, P = import_glb('sev.glb', name, decimate=0.05, tex=512)
    mn, mx = bounds(root.children_recursive)
    holder = empty(name + '_body', parent=root)
    for o in list(root.children):
        if o is not holder:
            o.parent = holder
    holder.location.z = -mn.z
    root.location = loc
    root.rotation_euler.z = math.radians(rot_z)
    return root


def astronaut(name, loc=(0, 0, 0), rot_z=0):
    root, P = import_glb('astronaut.glb', name)
    for k, o in P.items():
        o.name = f'{name}_{k.split(".")[0]}'
    root.location = loc
    root.rotation_euler.z = math.radians(rot_z)
    return root


def solar_tracker(name, loc, w=8.0, h=3.2, post=1.8):
    """Single-axis tracker: a post and a panel that turns about a north-south axis (local X)."""
    root = empty(name, loc=loc)
    cyl(name + '_post', 0.12, post, loc=(0, 0, 0), m=mat('steel', (0.62, 0.62, 0.6), rough=0.5, metal=0.6), parent=root, verts=10, base=True)
    pivot = empty(name + '_pivot', loc=(0, 0, post), parent=root)
    cube(name + '_panel', (w, h, 0.08), loc=(0, 0, 0.1), m=mat('cells', (0.04, 0.07, 0.18), rough=0.25, metal=0.3), parent=pivot)
    cube(name + '_frame', (w + 0.1, 0.12, 0.12), loc=(0, 0, 0.0), m=mat('steel', (0.62, 0.62, 0.6)), parent=pivot)
    return root, pivot


def fission_unit(name, loc):
    """Kilopower / Fission Surface Power style unit: shielded reactor below, radiator 'umbrella' above.
    NASA's concept is 10 kW per unit; the real ones would sit about 1 km from the habitat."""
    root = empty(name, loc=loc)
    cyl(name + '_shield', 0.9, 1.6, m=mat('fsp_body', (0.75, 0.74, 0.7), rough=0.6, metal=0.4), parent=root, base=True)
    cyl(name + '_mast', 0.25, 4.0, loc=(0, 0, 1.6), m=mat('steel', (0.62, 0.62, 0.6)), parent=root, verts=12, base=True)
    rad = lathe(name + '_radiator', [(5.8, 0.3), (5.6, 1.6), (3.0, 2.4), (2.6, 2.4)], mat('radiator', (0.9, 0.9, 0.88), rough=0.4), 24)
    rad.parent = root
    return root


def isru_plant(name, loc, tanks=4):
    """Oxygen and methane plant: makes ascent propellant from CO2 air and buried ice (like MOXIE, scaled up)."""
    root = empty(name, loc=loc)
    body = mat('isru_body', (0.82, 0.8, 0.74), rough=0.6)
    parts = [cube(name + '_unit', (6, 3.5, 3), loc=(0, 0, 1.5), m=body, parent=root),
             cube(name + '_intake', (1.4, 1.4, 1.2), loc=(-2, 0, 3.6), m=mat('dark', (0.12, 0.12, 0.13)), parent=root)]
    tank_objs = []
    for i in range(tanks):
        t = empty(f'{name}_tank{i}', loc=(-4.5 + i * 3.0, 4.2, 0), parent=root)
        cyl(f'{name}_tank{i}_shell', 1.15, 4.2, m=mat('tank', (0.92, 0.92, 0.9), rough=0.35, metal=0.2), parent=t, base=True)
        sphere(f'{name}_tank{i}_cap', 1.15, loc=(0, 0, 4.2), m=mat('tank', (0.92, 0.92, 0.9)), parent=t)
        tank_objs.append(t)
    gauge = empty(name + '_fill', loc=(3.3, -1.8, 0), parent=root)
    cube(name + '_fill_bar', (0.35, 0.35, 1.0), loc=(0, 0, 0.5), m=mat('fill', (0.25, 0.9, 1.0), emit=(0.25, 0.9, 1.0), strength=2), parent=gauge)
    gauge.scale = (1, 1, 0.001)
    return root, tank_objs, gauge


def dish(name, loc, r=3.0):
    root = empty(name, loc=loc)
    cyl(name + '_mast', 0.3, 3.0, m=mat('steel', (0.62, 0.62, 0.6)), parent=root, verts=10, base=True)
    head = empty(name + '_head', loc=(0, 0, 3.2), parent=root)
    prof = [(r * 0.45, r), (r * 0.25, r * 0.72), (r * 0.08, r * 0.38), (0.0, 0.25)]
    dm = mat('dish', (0.93, 0.93, 0.9), rough=0.4); dm.use_backface_culling = False
    d = lathe(name + '_dish', prof, dm, 28, caps=False)
    d.parent = head
    cyl(name + '_feed', 0.06, r * 0.8, loc=(0, 0, r * 0.4), m=mat('steel', (0.62, 0.62, 0.6)), parent=head, verts=6)
    return root, head


def berm(name, loc, r_in, r_out, h):
    """Bagged-regolith shielding wall around a habitat (blocks some radiation, built from local soil)."""
    o = lathe(name, [(h, r_in + 0.6), (h, r_out - 0.6), (0, r_out), (0, r_in)], mat('regolith_bags', (0.6, 0.38, 0.24), rough=1.0), 40)
    o.location = loc
    return o


def pad(name, loc, r=14):
    o = cyl(name, r, 0.25, loc=loc, m=mat('pad', (0.38, 0.3, 0.26), rough=0.95), verts=40, base=True)
    return o


def ascent_vehicle(name, loc=(0, 0, 0)):
    """Mars ascent vehicle on its descent stage, in the spirit of Apollo's lunar module but with far more fuel:
    the game's lander pod is the descent stage, and its crew cabin rides up on a methane/oxygen ascent stage
    with four big propellant tanks (Mars needs about 4.1 km/s to reach orbit; the Moon needed about 1.9)."""
    root, P = lander(name, loc)
    mn, mx = bounds([P['Habitat_module']])
    ascent = empty(name + '_ascent', loc=(0, 0, 0), parent=root)
    for k in ('Habitat_module', 'Upper_shell', 'Docking_neck', 'Docking_ring', 'Accent_7_3', 'Hatch', 'Hatch_window'):
        if k in P:
            reparent(P[k], ascent)
    z0 = mn.z - loc[2]
    tank_m = mat('mav_tank', (0.93, 0.92, 0.88), rough=0.35, metal=0.15)
    stripe = mat('mav_stripe', (0.85, 0.42, 0.12), rough=0.5)
    for i in range(4):
        a = math.radians(45 + 90 * i)
        x, y = math.cos(a) * 2.35, math.sin(a) * 2.35
        cyl(f'{name}_tank{i}', 0.95, 4.6, loc=(x, y, z0 + 0.2), m=tank_m, parent=ascent, base=True)
        sphere(f'{name}_tank{i}_top', 0.95, loc=(x, y, z0 + 4.8), m=tank_m, parent=ascent)
        cyl(f'{name}_tank{i}_band', 0.97, 0.35, loc=(x, y, z0 + 2.4), m=stripe, parent=ascent, base=True)
    cyl(name + '_ascent_engine', 0.45, 1.1, loc=(0, 0, z0 - 1.0), m=mat('nozzle', (0.25, 0.24, 0.24), rough=0.4, metal=0.7),
        parent=ascent, r2=0.18, base=True)
    plume = flame(name + '_plume', 0.5, 9, ascent, (0, 0, z0 - 1.0), color=(0.55, 0.65, 1.0), strength=5, alpha=0.6)
    return root, ascent, plume, z0


def finished_outpost(skip=()):
    """The outpost as it stands near the end of the 26 months (same layout as seq_outpost.py)."""
    out = {}
    out['pod'] = lander('crew_pod', (0, 0, 0))[0]
    if 'ascent' not in skip:
        out['ascent'] = ascent_vehicle('ascent_vehicle', (46, 30, 0))
    out['hab1'] = hab('hab_1', (-12, 22, 0), rot_z=200)
    out['hab2'] = hab('hab_2', (20, 40, 0), rot_z=150)
    for i, c in enumerate(((-12, 22), (20, 40))):
        berm(f'shield_berm_{i}', (*c, 0), 7.6, 9.6, 3.2)
    for name, a, b in (('walkway_1', (-1.5, 3.0), (-8.6, 15.0)), ('walkway_2', (-5.0, 27.0), (14.0, 35.5))):
        w, _ = import_glb('greenhouse-walkway.glb', name)
        for o in w.children_recursive:
            o.name = f'{name}_{o.name.split(".")[0]}'
        va, vb = Vector((*a, 0)), Vector((*b, 0))
        w.location = va
        w.rotation_euler.z = math.atan2((vb - va).y, (vb - va).x) + math.pi / 2
        w.scale = (1, (vb - va).length / 15.0, 1)
    if 'solar' not in skip:
        out['trackers'] = []
        for row in range(3):
            for col in range(5):
                tr, pv = solar_tracker(f'solar_{row}_{col}', (-82 + col * 11, -28 - row * 8, 0))
                pv.rotation_euler.x = math.radians(-25)
                out['trackers'].append((tr, pv))
    out['isru'] = isru_plant('propellant_plant', (62, -40, 0))
    out['isru'][2].scale = (1, 1, 4.5)
    out['dish'] = dish('earth_dish', (-48, 4, 0), r=3.4)
    out['dish'][1].rotation_euler = (math.radians(50), 0, math.radians(60))
    return out
