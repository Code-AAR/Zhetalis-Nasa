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


def _merge_duplicate_bones(arm, meshes):
    """The Mixamo files give some body parts their own copy of a bone chain (mixamorig2Hips, mixamorig2Hips.001...).
    Blender shows them fine, but the copies do not survive glTF export (legs flip up in three.js). Merge every copy
    into the main bone of that name - its skin weights move across - and delete the copies: one clean skeleton."""
    import re as _re
    plain = lambda n: _re.sub(r'(\.\d+|_\d+)$', '', _re.sub(r'^mixamorig\d*:?', '', n))
    main = {}
    for b in sorted(arm.data.bones, key=lambda b: (len(b.parent_recursive), b.name)):
        main.setdefault(plain(b.name), b.name)
    dup = {b.name: main[plain(b.name)] for b in arm.data.bones if main[plain(b.name)] != b.name}
    for o in meshes:
        groups = {g.name: g for g in o.vertex_groups}
        for d, m in dup.items():
            if d not in groups: continue
            gm = groups.get(m) or o.vertex_groups.new(name=m); groups[m] = gm
            gi = groups[d].index
            for v in o.data.vertices:
                for e in v.groups:
                    if e.group == gi and e.weight > 0:
                        gm.add([v.index], e.weight, 'ADD')
            o.vertex_groups.remove(groups[d])
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for d in dup:
        eb = arm.data.edit_bones.get(d)
        if eb: arm.data.edit_bones.remove(eb)
    bpy.ops.object.mode_set(mode='OBJECT')
    return len(dup)


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
    # (_merge_duplicate_bones is kept for reference; the crew are no longer exported, so it is not needed)
    bpy.context.view_layer.update()
    mn, mx = bounds(meshes)
    k = HEIGHT[char] / max(0.1, mx.z - mn.z)
    # Blender's glTF round trip breaks these Mixamo rigs (limbs flip even with no animation), so the GLB gets a slot
    # instead: an empty that says who stands here and what they do; src/cinematic.js loads the real character there.
    cslot = empty('crewslot_' + name, loc=loc); cslot.rotation_euler.z = math.radians(rot_z)
    cslot['crew_char'] = char; cslot['crew_clip'] = clip; cslot['crew_offset'] = float(offset); cslot['crew_speed'] = float(speed)
    cslot['crew_height'] = HEIGHT[char]
    if tint: cslot['crew_tint'] = [round(c, 3) for c in tint[1]]; cslot['crew_tint_match'] = tint[0]
    root.parent = cslot; root.scale = (k, k, k)
    for o in [root] + list(root.children_recursive):
        o['preview_only'] = True
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
    frames = np.arange(0, (end + 1) * STRETCH + 1, 2, dtype=np.float32)   # film frames after STRETCH, clip at natural speed
    src_t = lo + np.mod(frames * speed + offset * length, length)
    alive = {b.name for b in arm.data.bones}
    for fc in cb.fcurves:
        dp = fc.data_path
        if dp.startswith('pose.bones["') and dp.split('"')[1] not in alive:
            continue
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
    return cslot, arm


def gesture(arm, bone, windows, end=None):
    """Add motion on top of the baked clip: windows = [(f0, f1, (x, y, z) degrees), ...] in script frames (before
    STRETCH); the bone eases into the extra rotation and back out. bone = plain Mixamo name, e.g. 'RightArm'."""
    from mathutils import Euler, Quaternion
    act = arm.animation_data.action
    cb = _channelbag(act, arm.animation_data.action_slot)
    names = [b.name for b in arm.pose.bones if b.name.startswith('mixamorig') and re.sub(r'^mixamorig\d*:?', '', b.name.split('.')[0]) == bone]
    for bn in names:
        fcs = [cb.fcurves.find(f'pose.bones["{bn}"].rotation_quaternion', index=i) for i in range(4)]
        if not all(fcs):
            continue
        n = len(fcs[0].keyframe_points)
        co = [np.zeros(n * 2, np.float32) for _ in range(4)]
        for i in range(4): fcs[i].keyframe_points.foreach_get('co', co[i])
        frames = co[0][0::2]
        for f0, f1, rot in windows:
            F0, F1 = f0 * STRETCH, f1 * STRETCH
            ramp = min(12 * STRETCH, (F1 - F0) / 3)
            for k, f in enumerate(frames):
                if f < F0 or f > F1: continue
                w = min(1.0, (f - F0) / ramp, (F1 - f) / ramp); w = w * w * (3 - 2 * w)
                q = Quaternion([co[i][2 * k + 1] for i in range(4)])
                q = q @ Euler([math.radians(a * w) for a in rot]).to_quaternion()
                for i in range(4): co[i][2 * k + 1] = q[i]
        for i in range(4):
            fcs[i].keyframe_points.foreach_set('co', co[i]); fcs[i].update()
