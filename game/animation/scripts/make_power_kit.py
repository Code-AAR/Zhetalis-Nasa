"""The power kit the player assembles in the tutorial, modelled after real hardware so the parts teach what they are:
- battery-cabinet: the field battery - an insulated, heated Li-ion cabinet on skids with a radiator on top
  (Mars nights reach -80 C; lithium cells must stay warm), status lights and a front terminal shelf;
- battery-module: a Li-ion module - rows of cylindrical cells, nickel busbars, a BMS board, red + / black - posts;
- charge-controller: an MPPT solar charge controller - finned heatsink, display, PV+/PV-/BAT+/BAT- terminal block;
- solar-module: a PV panel - 6x5 cells with silver busbars in an aluminium frame, junction box and MC4 leads;
- support-frame: an aluminium extrusion frame with corner gussets and a cross brace;
- output-connector: an MC4 connector pair (red +, black -) with leads;
- protected-output: a DC fuse/breaker block - a fuse between the battery and the load, red/black output lugs;
- charging-post, rover-connector: the rover charger pedestal and its plug.
Every part shows its polarity: red and "+" is positive, black and "-" is negative.
Origins at the bottom centre; real sizes in metres (the game scales the bench parts to fit their slots).
Usage: blender -b --factory-startup -P make_power_kit.py -- [--render out_dir]"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'power')
os.makedirs(OUT, exist_ok=True)
MATS = {}


def mat(name, color, rough=.5, metal=0., emit=None, strength=1.):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m; return m


WHITE = lambda: mat('enclosure_white', (.86, .87, .85), .55)
ALU = lambda: mat('aluminium', (.75, .77, .8), .35, .9)
DARK = lambda: mat('housing_dark', (.09, .1, .11), .55)
STEEL = lambda: mat('steel', (.6, .62, .65), .3, .9)
COPPER = lambda: mat('copper', (.85, .5, .3), .3, 1.)
NICKEL = lambda: mat('nickel', (.78, .78, .74), .3, .9)
RED = lambda: mat('positive_red', (.78, .06, .05), .45)
BLACK = lambda: mat('negative_black', (.025, .025, .028), .5)
YELLOW = lambda: mat('warning_yellow', (.95, .75, .05), .5)
GREEN_PCB = lambda: mat('pcb_green', (.05, .3, .12), .5)
LCD = lambda: mat('lcd', (.05, .2, .22), .2, emit=(.25, .9, .8), strength=1.6)
LED_G = lambda: mat('led_green', (.1, .8, .3), .3, emit=(.2, 1, .4), strength=3)
LED_A = lambda: mat('led_amber', (.9, .5, .05), .3, emit=(1, .55, .1), strength=3)
CELL = lambda: mat('pv_cell', (.02, .05, .16), .18, .3)
BACKSHEET = lambda: mat('pv_backsheet', (.92, .93, .94), .6)
WRAP = lambda: mat('cell_wrap_blue', (.1, .25, .6), .45)


def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes): bpy.data.meshes.remove(me)
    for c in list(bpy.data.curves): bpy.data.curves.remove(c)


def box(name, size, loc, m, bevel=.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m)
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2; mod.limit_method = 'ANGLE'
    return o


def cyl(name, r, h, loc, m, axis='Z', verts=20, bevel=0.):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.active_object; o.name = name
    if axis == 'X': o.rotation_euler = (0, math.pi / 2, 0)
    if axis == 'Y': o.rotation_euler = (math.pi / 2, 0, 0)
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2; mod.limit_method = 'ANGLE'
    return o


def text(name, body, loc, size, m, rot=(math.pi / 2, 0, 0), extrude=.0015):
    """Raised lettering (converted to mesh). rot default faces -Y (the front)."""
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot; o.data.materials.append(m)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); return o


def post(name, loc, positive, r=.012, h=.025, up='Z'):
    """A terminal post: brass stud with a coloured insulating cap and a raised +/- sign."""
    x, y, z = loc
    c = cyl(name + '_cap', r * 1.5, h, (x, y, z + h / 2), RED() if positive else BLACK(), verts=24, bevel=.002)
    cyl(name + '_stud', r * .55, h * .6, (x, y, z + h + h * .3), mat('brass', (.85, .65, .25), .3, 1.), verts=12)
    return c


def sign(name, positive, loc, size, rot=(math.pi / 2, 0, 0)):
    """'+' or a bar for '-', in the terminal's colour, on the face it sits on."""
    if positive: return text(name, '+', loc, size, RED(), rot)
    return text(name, '–', loc, size, mat('minus_white', (.92, .92, .92), .5), rot)   # en dash reads as a clear minus


def lead(name, pts, r, m):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (*c, 1)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o); o.data.materials.append(m)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH')
    for p in o.data.polygons: p.use_smooth = True
    return o


def export(name):
    for o in bpy.context.scene.objects:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True)
    tris = sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
    print('EXPORTED', name, os.path.getsize(path), 'faces', tris)
    if '--render' in sys.argv: render(name)


def render(name):
    out = sys.argv[sys.argv.index('--render') + 1]
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    c = (lo + hi) / 2; s = (hi - lo).length
    cd = bpy.data.cameras.new('c'); cd.lens = 50; cam = bpy.data.objects.new('c', cd); bpy.context.scene.collection.objects.link(cam)
    cam.location = c + Vector((.7, -1.4, .9)) * s * 1.05; cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    ld = bpy.data.lights.new('k', 'SUN'); ld.energy = 4; l = bpy.data.objects.new('k', ld); l.rotation_euler = (.8, .2, .6); bpy.context.scene.collection.objects.link(l)
    w = bpy.data.worlds.get('w') or bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True
    next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND').inputs['Color'].default_value = (.35, .37, .42, 1)
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 640; sc.render.resolution_y = 480; sc.view_settings.view_transform = 'AgX'
    sc.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam); bpy.data.objects.remove(l)


bpy.ops.wm.read_factory_settings(use_empty=True)
FRONT = (math.pi / 2, 0, 0)          # lettering on the -Y face (glTF +Z, toward the player)

# ---------------------------------------------------------------- field battery cabinet (1.5 x 1.0 x 0.9 m)
clear()
W, D, H = 1.5, 1.0, .9
for x in (-.6, .6): box('skid', (.12, D + .1, .08), (x, 0, .04), STEEL(), .01)
box('cabinet', (W - .04, D - .04, H - .2), (0, 0, .08 + (H - .2) / 2), WHITE(), .03)
# insulation quilting lines on the sides and back
for i in range(5):
    box('seam_side', (W - .02, .006, .012), (0, D / 2 - .015, .2 + i * .13), mat('seam', (.7, .72, .7), .7))
# radiator on top: fins over a dark base (dumps heat in the day; a heater keeps the cells warm at night)
box('radiator_base', (W - .1, D - .12, .03), (0, 0, H - .1), DARK(), .005)
for i in range(18): box('fin', (.008, D - .16, .07), (-.68 + i * .08, 0, H - .05), ALU())
# front: terminal shelf, status panel, warning label, lifting eyes
fy = -D / 2 + .01
box('front_panel', (W * .62, .02, .34), (0, fy - .005, .5), DARK(), .006)
box('display', (.26, .01, .1), (.42, fy - .02, .58), LCD())
for i, m in enumerate((LED_G(), LED_G(), LED_A())): cyl('led', .012, .012, (.32 + i * .05, fy - .02, .48), m, 'Y', 12)
box('terminal_shelf', (1.3, .2, .03), (0, fy - .1, .6), DARK(), .004)   # the game mounts its live +/- terminals here
text('label_in', 'CHARGE IN', (-.45, fy - .02, .43), .04, mat('label_white', (.95, .95, .95), .5))
text('label_out', 'PROTECTED OUT', (.45, fy - .02, .43), .035, mat('label_white', (.95, .95, .95), .5))
box('warn', (.36, .006, .09), (-.42, fy - .02, .7), YELLOW())
text('warn_text', 'LI-ION  48 V DC', (-.42, fy - .025, .7), .03, BLACK())
for x in (-.65, .65): bpy.ops.mesh.primitive_torus_add(major_radius=.04, minor_radius=.01, location=(x, 0, H - .02), rotation=(math.pi / 2, 0, 0)); bpy.context.active_object.data.materials.append(STEEL())
export('battery-cabinet')

# ---------------------------------------------------------------- Li-ion battery module (0.38 x 0.30 x 0.20)
clear()
box('tray', (.38, .3, .14), (0, 0, .07), mat('module_case', (.2, .22, .25), .5), .008)
box('window', (.34, .26, .002), (0, 0, .141), mat('clear_cover', (.75, .85, .9), .05), 0)
for i in range(8):
    for j in range(6):
        x, y = -.155 + i * .044, -.11 + j * .044
        cyl('cell', .019, .02, (x, y, .15), WRAP(), verts=16)
        cyl('cell_top', .012, .003, (x, y, .161), NICKEL(), verts=12)
for j in range(6): box('busbar', (.34, .012, .002), (0, -.11 + j * .044, .163), NICKEL())
box('bms', (.16, .07, .006), (0, .12, .166), GREEN_PCB())
for i in range(6): box('chip', (.012, .012, .004), (-.06 + i * .024, .12, .171), BLACK())
post('neg', (-.17, -.13, .14), False); post('pos', (.17, -.13, .14), True)
sign('pos_sign', True, (.17, -.152, .11), .04); sign('neg_sign', False, (-.17, -.152, .11), .04)
text('module_label', '14.4 V  20 Ah', (0, -.152, .07), .022, mat('label_white', (.95, .95, .95), .5))
export('battery-module')

# ---------------------------------------------------------------- MPPT charge controller (0.30 x 0.22 x 0.09)
clear()
box('body', (.3, .2, .06), (0, 0, .03), mat('controller_blue', (.1, .25, .55), .45), .006)
for i in range(11): box('heatsink_fin', (.006, .2, .03), (-.14 + i * .028, 0, .075), ALU())
box('face', (.3, .006, .06), (0, -.102, .03), DARK())
box('screen', (.08, .004, .03), (-.07, -.106, .038), LCD())
for i, m in enumerate((LED_G(), LED_A())): cyl('led', .005, .004, (.0 + i * .02, -.106, .045), m, 'Y', 10)
# terminal block on the front: PV+ PV- | BAT+ BAT-
box('terminal_block', (.16, .03, .02), (.06, -.115, .012), mat('block_grey', (.4, .42, .44), .5))
for k, (lab, pos) in enumerate((('PV+', True), ('PV–', False), ('BAT+', True), ('BAT–', False))):
    x = .0 + k * .04
    cyl('screw', .007, .006, (x, -.115, .025), RED() if pos else BLACK(), verts=12)
    text('t_' + lab, lab, (x, -.131, .007), .009, mat('label_white', (.95, .95, .95), .5))
text('mppt', 'MPPT 48V 40A', (-.07, -.106, .015), .012, mat('label_white', (.95, .95, .95), .5))
export('charge-controller')

# ---------------------------------------------------------------- PV module (0.40 x 0.32)
clear()
box('frame', (.4, .32, .02), (0, 0, .01), ALU(), .002)
box('backsheet', (.38, .3, .004), (0, 0, .021), BACKSHEET())
for i in range(6):
    for j in range(5):
        box('cell', (.058, .054, .002), (-.157 + i * .063, -.116 + j * .058, .0235), CELL())
for i in range(6): box('busbar', (.002, .29, .0005), (-.157 + i * .063, 0, .0247), NICKEL())
box('junction', (.07, .05, .02), (0, .1, -.008), BLACK(), .003)   # junction box underneath
lead('lead_pos', [(.02, .12, -.012), (.08, .17, -.015), (.12, .2, -.01)], .004, RED())
lead('lead_neg', [(-.02, .12, -.012), (-.08, .17, -.015), (-.12, .2, -.01)], .004, BLACK())
cyl('mc4_pos', .008, .04, (.13, .21, -.01), RED(), 'X', 12); cyl('mc4_neg', .008, .04, (-.13, .21, -.01), BLACK(), 'X', 12)
export('solar-module')

# ---------------------------------------------------------------- aluminium support frame (0.44 x 0.36)
clear()
for x in (-.21, .21): box('rail', (.025, .36, .025), (x, 0, .0125), ALU(), .002)
for y in (-.17, .17): box('rail', (.44, .025, .025), (0, y, .0125), ALU(), .002)
box('brace', (.025, .5, .02), (0, 0, .03), ALU(), .002).rotation_euler = (0, 0, math.atan2(.34, .42))
for x in (-.21, .21):
    for y in (-.17, .17):
        box('gusset', (.05, .05, .004), (x - math.copysign(.015, x), y - math.copysign(.015, y), .027), STEEL())
        cyl('bolt', .005, .008, (x, y, .03), STEEL(), verts=8)
export('support-frame')

# ---------------------------------------------------------------- MC4 output connector pair
clear()
for x, pos in ((-.04, True), (.04, False)):
    m = RED() if pos else BLACK()
    cyl('mc4_body', .013, .09, (x, 0, .015), m, 'Y', 16, .002)
    cyl('mc4_nut', .016, .02, (x, .05, .015), m, 'Y', 6)
    cyl('mc4_pin', .004, .02, (x, -.055, .015), mat('brass', (.85, .65, .25), .3, 1.), 'Y', 8)
    lead('lead', [(x, .06, .015), (x, .12, .01), (x * 2, .17, .01)], .006, m)
    sign('s', pos, (x, -.02, .033), .022, (0, 0, 0))
export('output-connector')

# ---------------------------------------------------------------- protected output: DC fuse block + lugs
clear()
box('base', (.3, .12, .03), (0, 0, .015), DARK(), .004)
box('fuse_holder', (.14, .06, .04), (0, 0, .05), mat('holder_clear', (.85, .85, .8), .2), .004)
box('fuse', (.1, .03, .025), (0, 0, .055), YELLOW(), .003)
text('amps', '60A', (0, -.031, .05), .015, BLACK())
for x, pos in ((-.11, True), (.11, False)):
    post('lug', (x, 0, .03), pos, r=.01, h=.02)
    sign('s', pos, (x, -.061, .03), .025)
export('protected-output')

# ---------------------------------------------------------------- rover charging post
clear()
box('pedestal_base', (.16, .16, .02), (0, 0, .01), STEEL(), .003)
box('pedestal', (.1, .08, .36), (0, 0, .2), WHITE(), .01)
box('head', (.12, .1, .08), (0, 0, .4), mat('controller_blue', (.1, .25, .55), .45), .01)
box('screen', (.06, .003, .03), (0, -.051, .41), LCD())
cyl('holster', .02, .04, (0, -.05, .3), BLACK(), 'Y', 16)
cyl('lamp', .015, .015, (0, 0, .447), LED_G(), verts=12)
export('charging-post')

# ---------------------------------------------------------------- rover connector (plug and coiled lead)
clear()
box('plug_body', (.06, .12, .05), (0, 0, .025), BLACK(), .01)
box('grip', (.05, .06, .03), (0, .07, .045), mat('grip_orange', (.9, .38, .12), .7), .008)
cyl('face', .024, .01, (0, -.062, .025), DARK(), 'Y', 20)
cyl('pin_pos', .004, .012, (.01, -.07, .025), RED(), 'Y', 8); cyl('pin_neg', .004, .012, (-.01, -.07, .025), BLACK(), 'Y', 8)
coil = [(math.cos(t) * .07, .12 + t * .006, .02 + math.sin(t) * .02 + .02) for t in [k * .5 for k in range(26)]]
lead('coil', [(0, .1, .045)] + coil, .006, BLACK())
export('rover-connector')
print('POWER KIT DONE')
