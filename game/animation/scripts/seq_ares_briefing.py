"""0a. Ares VI: Final Stage Briefing (from the team's three.js storyboard, "Ares VI_ Final Stage Briefing.html").
Same seven shots, camera moves and lines, with the placeholders replaced by the game's own models: the rigged crew
(assets/crew, Mixamo, animations retargeted like src/hab-crew.js), the Ares VI lander (descent stage + ascent
vehicle), habitat, fission unit, solar tracker and ISRU plant as holograms over the table, and a briefing room.
Plays at the start of a new game, before the orbit briefing (briefing_mission)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import lander, hab, fission_unit, solar_tracker, isru_plant, ascent_vehicle
from crew_kit import person, gesture
from mathutils import Vector

NAME = 'ares_vi_briefing'
opts = args()
V3 = lambda x, y, z: Vector((x, -z, y))          # the storyboard's three.js coordinates -> Blender
SHOTS = [  # seconds, camera from->to, look from->to, phase, line, highlighted site
    (6, (V3(0, 3.4, 6.8), V3(0, 2.3, 5.2)), (V3(0, 1.2, 0), V3(0, 1.3, 0)), 'ARES VI · FINAL STAGE',
     'Crew, take your seats. This is the last briefing before Ares VI. After this, we build humanity’s first outpost on Mars.', None),
    (6, (V3(1.6, 1.8, -0.4), V3(.9, 1.7, .3)), (V3(0, 1.55, -2.3), V3(0, 1.55, -2.3)), 'MISSION OVERVIEW',
     'Four of you, one cargo-rich site in Jezero Crater. Ares V already parked supplies 400 metres from your landing zone.', None),
    (6, (V3(1.5, 1.85, 1.9), V3(1.7, 1.75, 1.3)), (V3(-0.35, 1.45, -0.8), V3(-0.4, 1.45, -0.9)), 'PHASE 1 · LANDING & HABITAT',
     'Phase one. Touchdown, then habitat deployment. You have four hours, and the habitat must hold pressure before the first night.', 0),
    (6, (V3(-3.6, 1.6, .2), V3(-3.2, 1.7, 1)), (V3(0, 1.4, 0), V3(0, 1.4, 0)), 'PHASE 2 · POWER',
     'Phase two. Fission unit plus solar array. Dust storms can last weeks, so the reactor goes up first. No power, no outpost.', 1),
    (6, (V3(2.4, 1.7, 3.2), V3(2.1, 1.65, 2.5)), (V3(-0.5, 1.4, -1.3), V3(-0.5, 1.4, -1.5)), 'PHASE 3 · ISRU',
     'Phase three. The ISRU plant pulls water from icy soil and oxygen from the CO₂ air. It also makes the propellant for your ride home.', 2),
    (7, (V3(0, 1.6, .9), V3(0, 1.5, 1.4)), (V3(0, 1.25, 2.6), V3(0, 1.25, 2.6)), 'CREW ROLES',
     'Commander, you lead the EVA. Engineer owns power, Geologist owns the ISRU site, Medic owns the habitat and every one of you. Questions?', None),
    (7, (V3(0, 1.7, 5), V3(0, 2.6, 7.4)), (V3(0, 1.3, 0), V3(0, 1.4, 0)), 'T-MINUS 72 HOURS',
     'Launch window opens in seventy-two hours. Get some sleep. Then go build the first home we’ve ever had on another world.', None),
]
starts = [0]
for s in SHOTS: starts.append(starts[-1] + s[0] * FPS)
sc = reset(NAME, starts[-1] / FPS)
END = sc.frame_end

# ---------- the room
dark = mat('room_panel', (0.045, 0.06, 0.09), rough=0.5, metal=0.4)
floor = cyl('floor', 8, 0.1, loc=(0, 0, -0.1), m=mat('room_floor', (0.06, 0.07, 0.09), rough=0.35, metal=0.6), verts=64, base=True)
for r, c in ((2.2, (1, 0.48, 0.24)), (3.6, (0.3, 0.6, 1.0)), (6.5, (0.3, 0.6, 1.0))):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.012, major_segments=128, minor_segments=4, location=(0, 0, 0.005))
    o = bpy.context.active_object; o.name = f'floor_ring_{r}'; setmat(o, mat(f'ring_{r}', c, emit=c, strength=2.5))
wall = cyl('wall', 8, 4.2, m=dark, verts=64, base=True)
wall.data.flip_normals() if False else None
for i in range(32):                                  # wall ribs
    a = math.tau * i / 32
    rib = cube(f'rib_{i}', (0.16, 0.12, 4.2), loc=(math.cos(a) * 7.9, math.sin(a) * 7.9, 2.1), m=mat('rib', (0.09, 0.11, 0.15), rough=0.4, metal=0.6))
    rib.rotation_euler.z = a
for z, c in ((0.25, (0.3, 0.6, 1.0)), (3.7, (0.3, 0.6, 1.0))):
    bpy.ops.mesh.primitive_torus_add(major_radius=7.85, minor_radius=0.025, major_segments=128, minor_segments=4, location=(0, 0, z))
    o = bpy.context.active_object; o.name = f'wall_strip_{z}'; setmat(o, mat('strip', c, emit=c, strength=3))
ceil = cyl('ceiling', 8, 0.1, loc=(0, 0, 4.2), m=mat('ceiling', (0.03, 0.035, 0.05), rough=0.6), verts=64, base=True)
bpy.ops.mesh.primitive_torus_add(major_radius=2.8, minor_radius=0.05, major_segments=96, minor_segments=6, location=(0, 0, 4.15))
o = bpy.context.active_object; o.name = 'ceiling_light'; setmat(o, mat('ceiling_light', (1, 0.95, 0.9), emit=(1, 0.95, 0.9), strength=6))

def screen_mat(name, image):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    img = bpy.data.images.load(os.path.join(ASSETS, image))
    if img.size[0] > 1024: img.scale(1024, max(1, int(img.size[1] * 1024 / img.size[0])))
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    b = nt.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 1.4
    return m
for i, img in enumerate(('mars-map.jpg', 'perched-above-gusev-crater.jpg', 'zhetalis-badge.png', 'sunset-at-mars-gusev-crater-spirit.jpg', 'mount-sharp-on-the-horizon.jpg')):
    a = (i - 2) * 0.42
    p = Vector((math.sin(a) * 7.7, math.cos(a) * 7.7, 2.2))
    w, h = (2.0, 2.0) if i == 2 else (2.6, 1.46)
    fr = cube(f'screen_frame_{i}', (w + 0.12, 0.06, h + 0.12), loc=tuple(p + Vector((math.sin(a), math.cos(a), 0)) * 0.03), m=mat('frame', (0.12, 0.13, 0.16), rough=0.3, metal=0.8))
    fr.rotation_euler.z = -a
    bpy.ops.mesh.primitive_plane_add(size=1, location=tuple(p))
    sc_ = bpy.context.active_object; sc_.name = f'screen_{i}'; sc_.scale = (w, h, 1)
    sc_.rotation_euler = (math.pi / 2, 0, -a)
    setmat(sc_, screen_mat(f'screen_{i}', img))

# ---------- holo table, Mars hologram, site markers, orbiting ship
table = cyl('holo_table', 1.1, 0.8, m=mat('table', (0.07, 0.09, 0.12), rough=0.3, metal=0.7), verts=48, r2=None, base=True)
cyl('table_top', 1.12, 0.04, loc=(0, 0, 0.8), m=mat('table_glass', (0.05, 0.08, 0.12), rough=0.1, metal=0.2, emit=(1, 0.5, 0.25), strength=0.25), verts=48, base=True)
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.018, major_segments=96, minor_segments=6, location=(0, 0, 0.845))
o = bpy.context.active_object; o.name = 'table_ring'; setmat(o, mat('table_ring', (1, 0.48, 0.24), emit=(1, 0.48, 0.24), strength=6))
beam = lathe('projector_beam', [(1.45, 0.75), (0.85, 0.32)], mat('beam', (1, 0.6, 0.35), emit=(1, 0.55, 0.3), strength=1.0, alpha=0.08), 48, caps=False)
beam.visible_shadow = False
globe = empty('mars_hologram', loc=(0, 0, 1.5))
gm = textured('holo_mars', 'mars-map.jpg')
b = gm.node_tree.nodes['Principled BSDF']
t = next(n for n in gm.node_tree.nodes if n.type == 'TEX_IMAGE')
gm.node_tree.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 0.9
mars = uvsphere('holo_mars_globe', 0.7, m=gm, parent=globe, seg=64, rings=32)
atmo = uvsphere('holo_atmosphere', 0.74, m=mat('holo_atmo', (1, 0.55, 0.3), emit=(1, 0.5, 0.25), strength=0.6, alpha=0.12), parent=globe, seg=48, rings=24)
atmo.visible_shadow = False
A.key(globe, 0, rot=(0, 0, 0), interp='LINEAR'); A.key(globe, END, rot=(0, 0, math.degrees(0.15 * END / FPS)), interp='LINEAR')
A.key(globe, starts[2] - 1, scale=(1, 1, 1)); A.key(globe, starts[2] + 30, scale=(1.15, 1.15, 1.15))
A.key(globe, starts[5] - 30, scale=(1.15, 1.15, 1.15)); A.key(globe, starts[5], scale=(1, 1, 1))
SITES = [((0.4, 0.3), (0.4, 0.8, 1.0)), ((0.1, 1.2), (1, 1, 1)), ((-0.2, 0.6), (0.4, 1.0, 0.6)), ((0.25, 0.9), (1.0, 0.82, 0.3))]   # lander, power, isru, hab
markers = []
for i, ((la, lo), c) in enumerate(SITES):
    p = Vector((math.cos(la) * math.sin(lo), math.cos(la) * math.cos(lo), math.sin(la))) * 0.72
    m_ = sphere(f'site_marker_{i}', 0.035, loc=tuple(p), m=mat(f'marker_{i}', c, emit=c, strength=5), parent=mars, sub=2)
    markers.append(m_)
# phase 1: the landing path draws down from orbit onto the lander's site, then a touchdown ring flashes
la, lo = SITES[0][0]
site = Vector((math.cos(la) * math.sin(lo), math.cos(la) * math.cos(lo), math.sin(la)))
side = site.cross(Vector((0, 0, 1))).normalized()
dot_m = mat('path_dot', (0.4, 0.8, 1.0), emit=(0.4, 0.8, 1.0), strength=6)
for j in range(18):
    t = j / 17
    p = (site * (0.72 + 0.6 * (1 - t) ** 1.5) + side * 0.5 * (1 - t) ** 2)
    d = sphere(f'landing_path_{j}', 0.012, loc=tuple(p), m=dot_m, parent=mars, sub=1)
    fon = starts[2] + 20 + j * 4
    A.key(d, 0, scale=(0.0001,) * 3, interp='CONSTANT'); A.key(d, fon, scale=(1, 1, 1), interp='CONSTANT'); A.key(d, starts[3], scale=(0.0001,) * 3, interp='CONSTANT')
bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.006, major_segments=32, minor_segments=4)
ring_ = bpy.context.active_object; ring_.name = 'touchdown_ring'; setmat(ring_, dot_m); ring_.parent = mars
ring_.location = tuple(site * 0.725); ring_.rotation_euler = site.to_track_quat('Z', 'Y').to_euler()
f_td = starts[2] + 20 + 18 * 4
A.key(ring_, 0, scale=(0.0001,) * 3, interp='CONSTANT')
for k in range(3):
    A.key(ring_, f_td + k * 20, scale=(0.3, 0.3, 0.3), interp='LINEAR'); A.key(ring_, f_td + k * 20 + 18, scale=(2.5, 2.5, 2.5), interp='CONSTANT')
A.key(ring_, f_td + 60, scale=(0.0001,) * 3, interp='CONSTANT')
ship = empty('holo_ship', loc=(1.05, 0, 1.5))
cone = cyl('holo_ship_body', 0.05, 0.18, m=mat('holo_white', (0.9, 0.92, 0.95), emit=(0.8, 0.85, 1.0), strength=1.5), r2=0.0, verts=12, parent=ship)
cyl('holo_ship_service', 0.05, 0.12, loc=(0, 0, -0.14), m=mat('holo_grey', (0.7, 0.72, 0.76), rough=0.4), verts=12, parent=ship)
for f in range(0, END + 1, 4):
    T = f / FPS
    A.key(ship, f, loc=(math.cos(T * 0.6) * 1.05, math.sin(T * 0.6) * 1.05, 1.5 + math.sin(T * 0.6) * 0.3),
          rot=(90, 0, math.degrees(T * 0.6) + 180), interp='LINEAR')

# ---------- the phase holograms: real game models, shown in hologram light
holo_m = mat('hologram', (0.1, 0.55, 1.0), emit=(0.1, 0.6, 1.0), strength=0.9, alpha=0.6)
def hologram(root, size, pos):
    objs = [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']
    bpy.context.view_layer.update()
    mn, mx = bounds(objs)
    k = size / max(mx - mn)
    holder = empty(root.name + '_holo', loc=pos)
    root.parent = holder; root.location = (-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)
    holder.scale = (k, k, k)
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(holo_m); o.visible_shadow = False
    return holder, k
def show(h, k, f0, f1):
    A.key(h, f0 - 1, scale=(0.0001,) * 3, interp='CONSTANT')
    A.key(h, f0 + 10, scale=(k, k, k)); A.key(h, f1 - 10, scale=(k, k, k)); A.key(h, f1, scale=(0.0001,) * 3)
    A.key(h, f0, rot=(0, 0, 0), interp='LINEAR'); A.key(h, f1, rot=(0, 0, 70), interp='LINEAR')
P1 = (0.85, -0.55, 0.88); P2 = (-0.85, -0.55, 0.88)
lv, _, _, _ = ascent_vehicle('ares_vi_lander', (0, 0, 0))
h, k = hologram(lv, 0.42, P1); show(h, k, starts[2], starts[3])
hb = hab('holo_habitat', (0, 0, 0))
h, k = hologram(hb, 0.4, P2); show(h, k, starts[2], starts[3])
fu = fission_unit('holo_fission', (0, 0, 0))
h, k = hologram(fu, 0.38, P1); show(h, k, starts[3], starts[4])
tr, _ = solar_tracker('holo_solar', (0, 0, 0))
h, k = hologram(tr, 0.45, P2); show(h, k, starts[3], starts[4])
isru, _, _ = isru_plant('holo_isru', (0, 0, 0))
h, k = hologram(isru, 0.5, (0, -0.8, 0.88)); show(h, k, starts[4], starts[5])
for i, (_, _, _, _, _, hi) in enumerate(SHOTS):        # the site being talked about pulses on the globe
    if hi is None: continue
    for j, m_ in enumerate(markers):
        if j == hi or (hi == 0 and j == 3):
            for f in range(starts[i], starts[i + 1], 6):
                s = 2.2 + 0.8 * math.sin(f * 0.25)
                A.key(m_, f, scale=(s, s, s), interp='LINEAR')
            A.key(m_, starts[i] - 1, scale=(1, 1, 1)); A.key(m_, starts[i + 1], scale=(1, 1, 1))

# ---------- people: Director Hale and the crew of four (the game's rigged characters)
def tag(text, color, loc, rot_z, size=0.11):
    cu = bpy.data.curves.new('tag', 'FONT'); cu.body = text; cu.align_x = 'CENTER'; cu.size = size
    t = bpy.data.objects.new('tag_' + text, cu); link(t); t.location = loc; t.rotation_euler = (math.pi / 2, 0, math.radians(rot_z))
    bpy.context.view_layer.objects.active = t; t.select_set(True)
    bpy.ops.object.convert(target='MESH'); t.select_set(False)
    setmat(t, mat('tag_' + text, color, emit=color, strength=3))
    return t
hale, hale_arm = person('director_hale', 'ch23', (0, 2.3, 0), rot_z=0, clip='idle', end=END, offset=0.1)
for f in range(0, END + 1, 12):                      # turns a little toward whoever he is addressing
    A.key(hale, f, loc=(0, 2.3, 0), rot=(0, 0, 8 * math.sin(f / FPS * 0.6)))
tag('DIRECTOR HALE', (1, 0.48, 0.24), (0, 2.3, 2.12), 0)
chair_m = mat('chair', (0.12, 0.13, 0.17), rough=0.4, metal=0.6)
CREW = [('MEI LIN', (0.3, 0.64, 1.0), 'ch22', None), ('YOU · ENGINEER 2', (1, 0.48, 0.24), 'ch48', None),
        ('ENGINEER 3', (0.4, 1.0, 0.6), 'ch23', ('Shirt|Jacket|Body', (0.55, 0.75, 0.6))), ('MEDIC', (1.0, 0.82, 0.3), 'ch22', ('Shirt', (0.55, 0.85, 0.85)))]
for i, (nm, col, char, tint) in enumerate(CREW):
    x = -2.4 + i * 1.6; y = -2.6
    seat = empty(f'chair_{i}', loc=(x, y, 0))
    cyl(f'chair_{i}_post', 0.05, 0.42, m=chair_m, parent=seat, verts=10, base=True)
    cube(f'chair_{i}_seat', (0.5, 0.5, 0.07), loc=(0, 0, 0.45), m=chair_m, parent=seat)
    cube(f'chair_{i}_back', (0.5, 0.06, 0.6), loc=(0, -0.24, 0.8), m=chair_m, parent=seat)
    cyl(f'chair_{i}_foot', 0.3, 0.03, m=chair_m, parent=seat, verts=20, base=True)
    p, carm = person(f'crew_{i}', char, (x, y + 0.05, 0.02), rot_z=180, clip='sit', end=END, offset=0.23 * i, speed=0.8, tint=tint, tex=512)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.012, major_segments=48, minor_segments=4, location=(x, y, 0.01))
    o = bpy.context.active_object; o.name = f'crew_ring_{i}'; setmat(o, mat(f'crew_ring_{i}', col, emit=col, strength=3))
    t = tag(nm, col, (x, y - 0.05, 1.6), 180, size=0.065)
    A.key(t, 0, scale=(0.0001,) * 3, interp='CONSTANT')          # names show for the crew-roles shot
    A.key(t, starts[5], scale=(1, 1, 1), interp='CONSTANT'); A.key(t, starts[6], scale=(0.0001,) * 3, interp='CONSTANT')
    # the crew watch the globe in the phase shots, glance at each other, and nod at their roles
    toward = -18 if x > 0 else 18
    gesture(carm, 'Head', [(starts[2] + 10, starts[5] - 10, (12, toward * 0.6, 0)),
                           (starts[5] + 20 + i * 30, starts[5] + 60 + i * 30, (14, 0, 0)),
                           (starts[1] + 30 + 17 * i, starts[1] + 80 + 17 * i, (0, -toward, 0))])
    if i == 1:   # you: a firm nod when the engineer's job is named
        gesture(carm, 'Head', [(starts[5] + 40, starts[5] + 58, (16, 0, 0)), (starts[5] + 62, starts[5] + 80, (16, 0, 0))])
    gesture(carm, 'Spine1', [(starts[2] + 10, starts[5] - 10, (8, 0, 0))])   # lean in toward the table

# ---------- Director Hale: welcome, talking hands, pointing at the globe, sweeping across the crew
f = starts
gesture(hale_arm, 'RightArm', [(f[0] + 18, f[0] + 120, (-35, 0, 20)), (f[2] + 8, f[3] - 6, (-40, 0, 70)), (f[3] + 8, f[4] - 6, (-40, 0, 68)),
                               (f[4] + 8, f[5] - 6, (-35, 0, 72)), (f[5] + 10, f[5] + 70, (-20, 0, 45)), (f[5] + 70, f[6] - 10, (-45, 0, 25)),
                               (f[6] + 30, f[6] + 140, (-30, 0, 15))])
gesture(hale_arm, 'LeftArm', [(f[0] + 18, f[0] + 120, (-35, 0, -20)), (f[1] + 20, f[1] + 120, (-15, 0, -35)), (f[6] + 30, f[6] + 140, (-30, 0, -15))])
gesture(hale_arm, 'RightForeArm', [(f[1] + 10 + 34 * k, f[1] + 30 + 34 * k, (0, 0, 25)) for k in range(4)] +
                                  [(f[2] + 8, f[5] - 6, (0, 0, -20))])
gesture(hale_arm, 'Head', [(f[2] + 8, f[5] - 6, (14, 15, 0))] + [(f[k] + 20 + 50 * j, f[k] + 40 + 50 * j, (7, 0, 0)) for k in (0, 1, 6) for j in range(2)] +
                          [(f[5] + 10, f[5] + 60, (5, 22, 0)), (f[5] + 70, f[5] + 120, (5, -22, 0))])
gesture(hale_arm, 'Spine', [(f[5] + 10, f[5] + 60, (0, 12, 0)), (f[5] + 70, f[5] + 120, (0, -12, 0))])

# ---------- camera: the storyboard's shots, each an eased move, hard cuts between them
cam = camera(lens=30)   # 50 degree vertical view like the storyboard's PerspectiveCamera(50)
cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24; cam.data.lens = 24 / (2 * math.tan(math.radians(25)))
for i, (d, (p0, p1), (l0, l1), ph, line, hi) in enumerate(SHOTS):
    f0, f1 = starts[i], starts[i + 1] - 1
    for j in range(0, 7):
        k = ease(j / 6); f = f0 + (f1 - f0) * j / 6
        look(cam, f, tuple(p0.lerp(p1, k)), tuple(l0.lerp(l1, k)), interp='LINEAR' if 0 < j < 6 else ('CONSTANT' if j == 6 else 'LINEAR'))
    caption(cam, line, f0, f1 + 1, who='DIRECTOR HALE', phase=ph)

# ---------- preview lighting (the game's player adds its own)
ld = bpy.data.lights.new('key', 'SPOT'); ld.energy = 2600; ld.spot_size = math.radians(80); ld.spot_blend = 0.5
k_ = bpy.data.objects.new('key', ld); k_.location = (0, -3, 6); k_.rotation_euler = (math.radians(25), 0, 0); link(k_); k_['preview_only'] = True
ld = bpy.data.lights.new('glow', 'POINT'); ld.energy = 120; ld.color = (1, 0.55, 0.3)
g_ = bpy.data.objects.new('glow', ld); g_.location = (0, 0, 1.6); link(g_); g_['preview_only'] = True
for i, a in enumerate((0.6, 2.5, 4.4)):
    ld = bpy.data.lights.new(f'rim{i}', 'POINT'); ld.energy = 220; ld.color = (0.4, 0.6, 1.0)
    r_ = bpy.data.objects.new(f'rim{i}', ld); r_.location = (math.cos(a) * 5, math.sin(a) * 5, 3.2); link(r_); r_['preview_only'] = True
for nm_, loc_, rot_ in (('hale_light', (0, -0.5, 3.6), (math.radians(40), 0, 0)), ('crew_light', (0, 0.5, 3.6), (math.radians(-40), 0, 0))):
    ld = bpy.data.lights.new(nm_, 'SPOT'); ld.energy = 1400; ld.spot_size = math.radians(75); ld.spot_blend = 0.6; ld.color = (1, 0.95, 0.9)
    o_ = bpy.data.objects.new(nm_, ld); o_.location = loc_; o_.rotation_euler = rot_; link(o_); o_['preview_only'] = True
world_sky((0.06, 0.08, 0.13), (0.04, 0.05, 0.08), (0.03, 0.03, 0.04), strength=1.5)

run([('ares_vi_briefing', 0, END)], opts, NAME)
