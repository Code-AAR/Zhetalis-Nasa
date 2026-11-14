"""The game's rigged crew (assets/crew/ch22, ch23, ch48 + crew-anims.glb, Mixamo characters) in Blender.
crew_merge.py first copies the animation clips into each character's glTF, retargeted by plain bone name the way
src/hab-crew.js does at runtime, so Blender's importer builds correct armature actions. person() then imports a
character at its real height and bakes a looping clip (idle, sit, work...) across the film timeline."""
import math, os, re
import numpy as np
from common import *
from mathutils import Vector

BUILD = os.path.join(ANIM, 'build')            # merged character files (not committed; rebuilt on demand)
HEIGHT = {'ch48': 1.72, 'ch22': 1.62, 'ch23': 1.79}


def _merged(char):
    path = os.path.join(BUILD, f'{char}_anim.glb')
    if not os.path.exists(path):
        import crew_merge
        os.makedirs(BUILD, exist_ok=True)
        crew_merge.merge(char + '.glb', path)
    return path


def _channelbag(act, slot=None):
    from bpy_extras import anim_utils
    slot = slot or act.slots[0]
    return anim_utils.action_get_channelbag_for_slot(act, slot)


def person(name, char, loc, rot_z=0, clip='idle', end=240, offset=0.0, speed=1.0, tint=None, tex=1024):
    """Import crew character `char` (ch22 / ch23 / ch48) standing at loc, facing rot_z degrees (0 = facing -Y),
    playing `clip` in a loop from film frame 0 to `end` (keys every 2 frames). tint: (regex on mesh name, rgb)."""
    before = set(bpy.data.objects); acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=_merged(char))
    new = [o for o in bpy.data.objects if o not in before]
    root = empty(name)
    for o in new:
        if o.parent is None: o.parent = root
        o.name = f'{name}_{o.name.split(".")[0]}'
    arm = next(o for o in new if o.type == 'ARMATURE')
    meshes = [o for o in new if o.type == 'MESH']
    for o in [o for o in meshes if 'Icosphere' in o.name]:   # a stray helper sphere in one Mixamo export
        bpy.data.objects.remove(o)
    meshes = [o for o in meshes if o.name in {x.name for x in bpy.data.objects if x.type == 'MESH'}] if False else         [o for o in bpy.data.objects if o.type == 'MESH' and o.parent and (o.parent == arm or o.parent.parent == root or o.parent == root) and o.name.startswith(name + '_')]
    for o in meshes:
        for p in o.data.polygons: p.use_smooth = True
    for img in {s.material.node_tree.nodes[n].image for o in meshes for s in o.material_slots if s.material and s.material.node_tree
                for n in [x.name for x in s.material.node_tree.nodes if x.type == 'TEX_IMAGE'] if s.material.node_tree.nodes[n].image}:
        if img.size[0] > tex: img.scale(tex, tex)
    bpy.context.view_layer.update()
    mn, mx = bounds(meshes)
    k = HEIGHT[char] / max(0.1, mx.z - mn.z)
    root.scale = (k, k, k); root.location = loc; root.rotation_euler.z = math.radians(rot_z)
    if tint:
        for o in meshes:
            if re.search(tint[0], o.name):
                for s in o.material_slots:
                    m = s.material.copy(); s.material = m; nt = m.node_tree
                    b = nt.nodes.get('Principled BSDF')
                    if not b: continue
                    if b.inputs['Base Color'].links:
                        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
                        mix.inputs['Factor'].default_value = 1.0
                        nt.links.new(b.inputs['Base Color'].links[0].from_socket, mix.inputs[6]); mix.inputs[7].default_value = (*tint[1], 1)
                        nt.links.new(mix.outputs[2], b.inputs['Base Color'])
                    else:
                        b.inputs['Base Color'].default_value = (*tint[1], 1)
    # bake the clip onto the film timeline (rotations, plus the hips' position)
    src = next(a for a in bpy.data.actions if a not in acts_before and a.name.split('.')[0] == clip)
    cb = _channelbag(src)
    lo, hi = src.frame_range
    length = max(1.0, hi - lo)
    out = bpy.data.actions.new(f'{name}_{clip}')
    slot = out.slots.new(id_type='OBJECT', name=arm.name)
    ocb = out.layers.new('L').strips.new(type='KEYFRAME').channelbag(slot, ensure=True)
    frames = np.arange(0, end + 1, 2, dtype=np.float32)
    src_t = lo + np.mod(frames * speed + offset * length, length)
    for fc in cb.fcurves:
        dp = fc.data_path
        if dp.endswith('scale') or (dp.endswith('location') and 'Hips' not in dp):
            continue
        vals = np.array([fc.evaluate(float(t)) for t in src_t], dtype=np.float32)
        nf = ocb.fcurves.new(dp, index=fc.array_index)
        nf.keyframe_points.add(len(frames))
        nf.keyframe_points.foreach_set('co', np.stack([frames, vals], 1).ravel())
        nf.keyframe_points.foreach_set('interpolation', np.full(len(frames), 1, dtype=np.int32))   # LINEAR
        nf.update()
    arm.animation_data_create(); arm.animation_data.action = out; arm.animation_data.action_slot = slot
    for a in [a for a in bpy.data.actions if a not in acts_before and a is not out]:
        bpy.data.actions.remove(a)
    A.own.append(arm)
    return root, arm
