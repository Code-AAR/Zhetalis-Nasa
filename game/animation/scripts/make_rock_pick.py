"""The player's rock pick (replaces NASA's Hammer model as the in-game pickaxe): a geologist's pick like those used in
field geology - forged steel head with a square hammer face on one side and a long tapered pick on the other,
fibreglass handle, ridged orange rubber grip, and a tether loop at the butt (tools on spacewalks are always tethered).
Origin at the bottom of the grip, handle along +Y, pick pointing +X. Real size ~0.5 m (the game scales it).
Usage: blender -b --factory-startup -P make_rock_pick.py -- [--render]"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'tools', 'rock-pick.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m


steel = mat('head_steel', (0.62, 0.64, 0.68), 0.32, 0.9)
edge = mat('head_edge', (0.82, 0.83, 0.86), 0.22, 1.0)          # ground bright where it was sharpened
shaft = mat('handle_fibreglass', (0.12, 0.13, 0.15), 0.45, 0.0)
grip = mat('grip_rubber', (0.89, 0.38, 0.15), 0.75, 0.0)
tether = mat('tether_webbing', (0.95, 0.85, 0.2), 0.8, 0.0)


def obj_from_bm(name, bm, m, smooth=True, bevel=0.0):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(m)
    for p in me.polygons: p.use_smooth = smooth
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2; mod.limit_method = 'ANGLE'
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    return o


def loft(sections, cap=True):
    """Solid from rectangular cross-sections [(x, half_y, half_z, z_offset)] along +X."""
    bm = bmesh.new(); rings = []
    for x, hy, hz, zo in sections:
        rings.append([bm.verts.new((x, sy * hy, zo + sz * hz)) for sy, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4; bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


H = 0.48                                                          # head height on the handle (m)
# head: eye block round the handle, square hammer face to -X, long tapered pick to +X (curving slightly down)
eye = loft([(-0.028, 0.016, 0.03, 0), (0.028, 0.016, 0.03, 0)])
hammer = loft([(-0.028, 0.014, 0.022, 0), (-0.06, 0.0125, 0.0125, 0), (-0.072, 0.0135, 0.0135, 0)])
pick = loft([(0.028, 0.013, 0.02, 0), (0.07, 0.009, 0.013, -0.002), (0.12, 0.006, 0.008, -0.009), (0.16, 0.003, 0.004, -0.02), (0.178, 0.0008, 0.0012, -0.028)])
parts = [obj_from_bm('head_eye', eye, steel, bevel=0.003), obj_from_bm('head_hammer', hammer, steel, bevel=0.003), obj_from_bm('head_pick', pick, steel, bevel=0.002)]
face = loft([(-0.072, 0.0135, 0.0135, 0), (-0.075, 0.0128, 0.0128, 0)])
parts.append(obj_from_bm('head_face', face, edge, bevel=0.001))
for p in parts: p.location.z = H

# handle: a slightly oval fibreglass shaft
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0135, depth=H + 0.02, location=(0, 0, (H + 0.02) / 2))
hnd = bpy.context.active_object; hnd.name = 'handle'; hnd.scale = (1, 0.8, 1); hnd.data.materials.append(shaft)
for p in hnd.data.polygons: p.use_smooth = True
# grip: ridged rubber sleeve over the bottom third (rings of slightly bigger radius)
bm = bmesh.new()
prof = []
for i in range(25):
    z = 0.015 + i * 0.0068
    prof.append((z, 0.0185 + (0.0018 if i % 2 else 0.0)))
rings = [[bm.verts.new((math.cos(a) * r, math.sin(a) * r * 0.82, z)) for a in [k * math.tau / 20 for k in range(20)]] for z, r in prof]
for a, b in zip(rings, rings[1:]):
    for k in range(20):
        bm.faces.new((a[k], a[(k + 1) % 20], b[(k + 1) % 20], b[k]))
bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj_from_bm('grip', bm, grip)
# butt cap and the tether loop
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.021, depth=0.016, location=(0, 0, 0.008))
cap = bpy.context.active_object; cap.name = 'grip_butt'; cap.data.materials.append(grip)
bpy.ops.mesh.primitive_torus_add(major_radius=0.022, minor_radius=0.004, major_segments=24, minor_segments=6, location=(0, 0, -0.016), rotation=(math.pi / 2, 0, 0))
loop = bpy.context.active_object; loop.name = 'tether_loop'; loop.data.materials.append(tether)

for o in bpy.context.scene.objects:
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True)
print('EXPORTED', OUT, os.path.getsize(OUT), 'tris', sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH'))

if '--render' in sys.argv:
    cd = bpy.data.cameras.new('c'); cd.lens = 70; c = bpy.data.objects.new('c', cd); bpy.context.scene.collection.objects.link(c)
    c.location = (0.55, -0.75, 0.55); d = Vector((0.03, 0, 0.3)) - c.location; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = c
    ld = bpy.data.lights.new('k', 'AREA'); ld.energy = 60; ld.size = 1; l = bpy.data.objects.new('k', ld); l.location = (0.6, -0.4, 1.0); bpy.context.scene.collection.objects.link(l)
    l.rotation_euler = (Vector((0, 0, 0.3)) - l.location).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True
    next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND').inputs['Color'].default_value = (0.35, 0.37, 0.42, 1)
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 900; sc.render.resolution_y = 700
    sc.view_settings.view_transform = 'AgX'
    sc.render.filepath = sys.argv[sys.argv.index('--render') + 1]
    bpy.ops.render.render(write_still=True)
