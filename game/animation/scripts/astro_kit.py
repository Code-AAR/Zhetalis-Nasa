"""Articulated astronaut for the films: NASA's "Astronaut" model (assets/nasa-astronaut.glb), rigged exactly like the
player's suit in src/suit.js (same joint heights and smooth skin weights: pelvis, spine, thighs, shins, upper arms,
forearms), plus actions: stand, walk (feet planted: the stride is driven by the distance actually covered), kneel,
dig, carry and repair, and hand-held tools (shovel, wrench, spare unit) fixed to the hands.
All bone keys go through common.A, so they stretch with the timeline and split into clips like everything else."""
import math
from common import *
from mathutils import Vector, Matrix

H = 1.85                                         # suit height (m), as in suit.js
HIP, KNEE, WAIST, SHOULDER, ARM_X, ELBOW_X, HAND_X = 0.385, 0.205, 0.52, 0.715, 0.19, 0.325, 0.37
BONES = ['pelvis', 'spine', 'thigh_n', 'thigh_p', 'shin_n', 'shin_p', 'arm_n', 'arm_p', 'fore_n', 'fore_p']
STRIDE = 1.2                                     # metres per step (a Mars lope)


def _smooth(a, b, v):
    lo, hi = min(a, b), max(a, b)
    t = min(1.0, max(0.0, (v - lo) / (hi - lo))); t = t * t * (3 - 2 * t)
    return t if a < b else 1 - t


def _weights(x, y, z):
    """suit.js weights(): x sideways, y up, z forward (three.js axes). Returns [(bone index, weight)]."""
    ax = abs(x); R = 1 if x > 0 else 0
    hipY, kneeY, sh, armIn, el = HIP * H, KNEE * H, SHOULDER * H, ARM_X * H, ELBOW_X * H
    isArm = _smooth(0.47 * H, 0.53 * H, y) * _smooth(armIn - 0.05, armIn + 0.07, ax)
    if isArm > 0:
        fore = _smooth(el - 0.06, el + 0.06, ax)
        return [(1, 1 - isArm), (6 + R, isArm * (1 - fore)), (8 + R, isArm * fore)]
    if y < hipY + 0.09 and z > -0.16:
        leg = 1 - _smooth(hipY - 0.07, hipY + 0.09, y)
        shin = 1 - _smooth(kneeY - 0.06, kneeY + 0.06, y)
        left = 1 - _smooth(-0.035, 0.035, x)
        out = [(0, 1 - leg)]
        for side, w in ((0, left), (1, 1 - left)):
            if w > 0: out += [(2 + side, leg * w * (1 - shin)), (4 + side, leg * w * shin)]
        return [o for o in out if o[1] > 0.001]
    spine = _smooth(WAIST * H - 0.08, WAIST * H + 0.08, y)
    return [(0, 1 - spine), (1, spine)]


# NASA's Z-2 suit (assets/models/nasa-spacesuits/z2-suit-web.glb, a web copy of NASA 3D Resources' "Z2 Spacesuit",
# NASA/LaRC/Advanced Concepts Lab). Joints measured from front/side views; its arms hang forward in the rest pose.
Z2 = dict(file='models/nasa-spacesuits/z2-suit-web.glb', hip=0.86, knee=0.494, waist=1.05, shoulder=(0.27, -0.04, 1.45),
          elbow=(0.30, -0.26, 1.24), wrist=(0.27, -0.47, 1.13), leg_x=0.106, arm_rest=46, fore_rest=16, kneel_drop=0.44)


def astronaut(name, loc=(0, 0, 0), rot_z=0, model='z2'):
    """A rigged NASA suit standing at loc, facing rot_z degrees (0 = facing -Y). Returns (root, armature).
    model 'z2' = NASA's Z-2 suit (default); 'emu' = the game's player suit (nasa-astronaut.glb, rigged like suit.js)."""
    if model == 'z2':
        return _z2(name, loc, rot_z)
    root, P = import_glb('nasa-astronaut.glb', name + '_suit')
    meshes = [o for o in P.values() if o.type == 'MESH']
    bpy.context.view_layer.update()
    mn, mx = bounds(meshes)
    s = H / (mx.z - mn.z); mid = (mn + mx) / 2
    # bake the suit into metres with its feet at the origin
    for o in meshes:
        o.parent = None
        mw = o.matrix_world.copy()
        o.data.transform(Matrix.Translation((-mid.x * s, -mid.y * s, -mn.z * s)) @ Matrix.Scale(s, 4) @ mw)
        o.matrix_world = Matrix.Identity(4)
    for o in [root] + [c for c in root.children_recursive if c.type == 'EMPTY']:
        bpy.data.objects.remove(o)
    holder = empty(name, loc=loc); holder.rotation_euler.z = math.radians(rot_z)
    ad = bpy.data.armatures.new(name + '_rig')
    arm = bpy.data.objects.new(name + '_rig', ad); link(arm, holder)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    hipY, kneeY, waistY, sh, armIn, el, hand = HIP * H, KNEE * H, WAIST * H, SHOULDER * H, ARM_X * H, ELBOW_X * H, HAND_X * H
    def eb(n, head, tail, parent=None):
        b = ad.edit_bones.new(n); b.head = head; b.tail = tail; b.roll = 0
        if parent: b.parent = ad.edit_bones[parent]
        return b
    eb('pelvis', (0, 0, hipY), (0, 0, waistY))
    eb('spine', (0, 0, waistY), (0, 0, sh), 'pelvis')
    for sx, sfx in ((-1, 'n'), (1, 'p')):
        eb('thigh_' + sfx, (sx * 0.1, 0, hipY), (sx * 0.1, 0.02, kneeY), 'pelvis')
        eb('shin_' + sfx, (sx * 0.1, 0.02, kneeY), (sx * 0.1, 0.02, 0.06), 'thigh_' + sfx)
        eb('arm_' + sfx, (sx * armIn, 0, sh), (sx * el, 0, sh - 0.03), 'spine')
        eb('fore_' + sfx, (sx * el, 0, sh - 0.03), (sx * hand, 0, sh - 0.03), 'arm_' + sfx)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in meshes:
        o.parent = arm
        o.name = f'{name}_{o.name.split(".")[0]}'
        vg = [o.vertex_groups.new(name=b) for b in BONES]
        for v in o.data.vertices:
            x, y, z = v.co.x, v.co.z, -v.co.y          # Blender (x, y, z) -> three.js (x, z, -y)
            w = _weights(x, y, z); tot = sum(a for _, a in w) or 1
            for bi, a in w:
                vg[bi].add([v.index], a / tot, 'REPLACE')
        mod = o.modifiers.new('rig', 'ARMATURE'); mod.object = arm
        for p in o.data.polygons: p.use_smooth = True
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    arm['astro'] = True; arm['model'] = 'emu'; arm['kneel_drop'] = 0.33
    return holder, arm


# capsule radius of each bone (m): the suit is thick at the torso and thin at the limbs
RADII = dict(pelvis=0.20, spine=0.23, thigh_n=0.10, thigh_p=0.10, shin_n=0.08, shin_p=0.08, arm_n=0.075, arm_p=0.075, fore_n=0.065, fore_p=0.065)


def _capsule_weights(mesh, arm, soft=0.03, reach=0.07):
    """Skin weights from distance to each bone's capsule: every point follows its nearest bone, blending softly at
    joints (used where Blender's bone-heat weighting fails on a suit mesh with open seams)."""
    import numpy as np
    n = len(mesh.data.vertices)
    co = np.zeros(n * 3, np.float32); mesh.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    names, D = [], []
    for b in arm.data.bones:
        h, t = np.array(b.head_local), np.array(b.tail_local)
        if b.name == 'spine': t = t + np.array([0, 0, 0.45])          # the helmet and the top of the backpack ride the chest
        ab = t - h; u = np.clip(((co - h) @ ab) / max(1e-9, ab @ ab), 0, 1)
        d = np.linalg.norm(co - (h + u[:, None] * ab), axis=1) - RADII[b.name]
        names.append(b.name); D.append(d)
    D = np.stack(D, 1); dmin = D.min(1, keepdims=True)
    W = np.exp(-(D - dmin) / soft) * (D - dmin < reach)
    W /= W.sum(1, keepdims=True)
    groups = [mesh.vertex_groups.new(name=nm) for nm in names]
    for j, g in enumerate(groups):
        idx = np.nonzero(W[:, j] > 0.01)[0]
        for i in idx:
            g.add([int(i)], float(W[i, j]), 'REPLACE')
    mod = mesh.modifiers.new('rig', 'ARMATURE'); mod.object = arm


def _z2(name, loc, rot_z):
    root, P = import_glb(Z2['file'], name + '_suit')
    mesh = next(o for o in P.values() if o.type == 'MESH')
    holder = empty(name)                                               # rigged at the origin, placed at the end
    ad = bpy.data.armatures.new(name + '_rig')
    arm = bpy.data.objects.new(name + '_rig', ad); link(arm, holder)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    def eb(n, head, tail, parent=None):
        b = ad.edit_bones.new(n); b.head = head; b.tail = tail
        if parent: b.parent = ad.edit_bones[parent]
        b.align_roll((0, 1, 0) if n[:3] in ('arm', 'for', 'thi', 'shi') else (0, -1, 0))   # bone Z set so every hinge (local X) is world +X
        return b
    hip, knee, waist = Z2['hip'], Z2['knee'], Z2['waist']
    eb('pelvis', (0, 0, hip), (0, 0, waist))
    eb('spine', (0, 0, waist), (0, 0, Z2['shoulder'][2]), 'pelvis')
    for sx, sfx in ((-1, 'n'), (1, 'p')):
        lx = sx * Z2['leg_x']
        eb('thigh_' + sfx, (lx, 0, hip), (lx, 0.0, knee), 'pelvis')
        eb('shin_' + sfx, (lx, 0.0, knee), (lx, 0.02, 0.07), 'thigh_' + sfx)
        sh, el, wr = [(sx * v[0], v[1], v[2]) for v in (Z2['shoulder'], Z2['elbow'], Z2['wrist'])]
        eb('arm_' + sfx, sh, el, 'spine')
        eb('fore_' + sfx, el, wr, 'arm_' + sfx)
    bpy.ops.object.mode_set(mode='OBJECT')
    reparent(mesh, holder); mesh.matrix_parent_inverse.identity(); mesh.location = (0, 0, 0)
    mesh.parent = arm
    mesh.name = f'{name}_z2'
    _capsule_weights(mesh, arm)
    for o in [root] + list(root.children_recursive):
        if o.name in bpy.data.objects and o is not mesh: bpy.data.objects.remove(o)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    arm['astro'] = True; arm['model'] = 'z2'; arm['kneel_drop'] = Z2['kneel_drop']
    holder.location = loc; holder.rotation_euler.z = math.radians(rot_z)
    return holder, arm


def _to_z2(rot):
    """The poses are written for the player suit (arms out at rest: X lowers, Y swings, Z bends the elbow).
    The Z-2's arms already hang forward, with every hinge on world X: convert swing and elbow bend to that."""
    out = dict(rot)
    for sfx, sgn in (('p', -1), ('n', 1)):
        if 'arm_' + sfx in rot:
            low, y, _ = rot['arm_' + sfx]
            swing = sgn * y                                   # forward swing in degrees
            out['arm_' + sfx] = (Z2['arm_rest'] - swing - (low + 72) * 0.3, 0, 0)
        if 'fore_' + sfx in rot:
            bend = -rot['fore_' + sfx][2] if sfx == 'p' else rot['fore_' + sfx][2]
            out['fore_' + sfx] = (Z2['fore_rest'] - bend, 0, 0)
    return out


def pose(arm, f, interp='BEZIER', **rot):
    """Key bone rotations (degrees, XYZ) at script frame f, e.g. pose(arm, 30, thigh_n=(20, 0, 0))."""
    if arm.get('model') == 'z2':
        rot = _to_z2(rot)
    for b, r in rot.items():
        A.key_path(arm, f, f'pose.bones["{b}"].rotation_euler', [math.radians(a) for a in r], interp)


# ---------------------------------------------------------------- poses (degrees)
# Bone axes (measured; the suit faces -Y): upper arm X- lowers it from the arms-out rest pose, then Y swings the
# lowered arm (arm_p: Y- forward, arm_n: Y+ forward); elbow bends on Z (fore_p: Z- forward, fore_n: Z+ forward);
# thigh X- swings the leg forward; shin X+ bends the knee; spine X+ leans forward.
STAND = dict(pelvis=(0, 0, 0), spine=(0, 0, 0), thigh_n=(0, 0, 0), thigh_p=(0, 0, 0), shin_n=(2, 0, 0), shin_p=(2, 0, 0),
             arm_n=(-72, 4, 0), arm_p=(-72, -4, 0), fore_n=(0, 0, 18), fore_p=(0, 0, -18))


def arms(swing_p=0, swing_n=0, low=-72, bend_p=18, bend_n=18):
    """Arm pose helper: swing forward in degrees (+ = forward for both arms), elbow bends in degrees."""
    return dict(arm_p=(low, -swing_p, 0), arm_n=(low, swing_n, 0), fore_p=(0, 0, -bend_p), fore_n=(0, 0, bend_n))


def stand(arm, f, interp='BEZIER'):
    pose(arm, f, interp, **STAND)


def walk(arm, holder, f0, f1, step=2, hold=None):
    """Legs and arms follow the distance the holder really covers between f0 and f1, so the feet do not slide."""
    kx, ky = A.keys_of(holder, 'location', 0), A.keys_of(holder, 'location', 1)
    fr = sorted(set(kx) & set(ky))
    def at(f):                                    # linear position between the holder's keys
        prev = max([k for k in fr if k <= f], default=fr[0]); nxt = min([k for k in fr if k >= f], default=fr[-1])
        t = 0 if nxt == prev else (f - prev) / (nxt - prev)
        return Vector((kx[prev][0] + (kx[nxt][0] - kx[prev][0]) * t, ky[prev][0] + (ky[nxt][0] - ky[prev][0]) * t))
    dist, last = 0.0, at(f0)
    f = f0
    while f <= f1:
        p = at(f); d = (p - last).length; dist += d; last = p
        ph = dist / STRIDE * math.pi                # one leg cycle every two steps
        s, c = math.sin(ph), math.cos(ph)
        m = min(1.0, d / 0.04) if f > f0 else 0.0   # walking only while actually moving
        pose(arm, f, 'LINEAR',
             thigh_n=(-26 * s * m, 0, 0), thigh_p=(26 * s * m, 0, 0),
             shin_n=(40 * max(0, -c) ** 1.4 * m + 3, 0, 0), shin_p=(40 * max(0, c) ** 1.4 * m + 3, 0, 0),
             spine=(5 * m, 0, 4 * s * m), pelvis=(0, 0, -3 * s * m), **(hold or arms(18 * s * m, -18 * s * m, bend_p=24, bend_n=24)))
        A.key(holder, f, loc=(None, None, 0.05 * abs(c) * m), interp='LINEAR')   # highest over the standing foot
        f += step


KNEEL = dict(thigh_n=(-92, 0, 0), shin_n=(92, 0, 0), thigh_p=(8, 0, 0), shin_p=(98, 0, 0), spine=(18, 0, 0), pelvis=(0, 0, 0))


def kneel(arm, holder, f0, f1, ramp=14, hands=None):
    """Down on the right knee (stiff suit knees: slowly), held until f1, then back up. hands: arm pose while down."""
    down = dict(KNEEL, **(hands or arms(35, 35, bend_p=40, bend_n=40)))
    stand(arm, f0); pose(arm, f0 + ramp, **down); pose(arm, f1 - ramp, **down); stand(arm, f1)
    d = arm.get('kneel_drop', 0.33)
    for f, z in ((f0, 0), (f0 + ramp, -d), (f1 - ramp, -d), (f1, 0)):
        A.key(holder, f, loc=(None, None, z))


def dig(arm, f0, f1, rate=26):
    """Shovel strokes: lean, both arms drive the blade down, then lever it back up."""
    f = f0
    while f + rate <= f1:
        pose(arm, f, spine=(28, 0, 0), **arms(55, 40, bend_p=50, bend_n=40))
        pose(arm, f + rate * 0.45, spine=(48, 0, 0), **arms(80, 70, bend_p=15, bend_n=15))
        pose(arm, f + rate * 0.8, spine=(22, 0, 8), **arms(45, 30, bend_p=70, bend_n=60))
        f += rate
    stand(arm, f1)


CARRY = None


def carry(arm, f0, f1):
    """Both arms forward, elbows bent, holding something in front of the chest."""
    hold = arms(42, 42, bend_p=48, bend_n=48)
    pose(arm, f0, **hold); pose(arm, f1, **hold)


def repair(arm, f0, f1, rate=16):
    """Right hand works at a spot in front (turning a fitting), left hand braced on the hardware."""
    f = f0
    pose(arm, f0, spine=(20, 0, 0), **arms(75, 50, low=-62, bend_p=30, bend_n=55))
    while f + rate <= f1:
        pose(arm, f + rate / 2, spine=(20, 0, 0), arm_p=(-58, -78, 10), fore_p=(0, 0, -40))
        pose(arm, f + rate, spine=(20, 0, 0), arm_p=(-64, -72, -10), fore_p=(0, 0, -24))
        f += rate
    stand(arm, f1)


def hold_tool(arm, tool, side='p', offset=(0.0, 0.0, 0.0)):
    """Fix a tool to a hand (the end of the forearm bone), so it follows every gesture."""
    tool.parent = arm; tool.parent_type = 'BONE'; tool.parent_bone = 'fore_' + side
    tool.location = Vector((0, 0.0, 0)) + Vector(offset)   # bone-parented: origin sits at the bone's tail (the hand)
    return tool


def shovel(name):
    """A 1.2 m shovel whose grip sits at the object's origin (the hand); the blade is at the far end, along -Z."""
    root = empty(name)
    steel = mat('tool_steel', (0.72, 0.72, 0.74), rough=0.35, metal=0.9)
    cyl(name + '_shaft', 0.022, 1.15, loc=(0, 0, -0.5), m=mat('tool_grip', (0.85, 0.45, 0.1), rough=0.6), parent=root, verts=10)
    cyl(name + '_handle', 0.06, 0.06, loc=(0, 0, 0.08), m=mat('tool_grip', (0.85, 0.45, 0.1)), parent=root, verts=10)
    cube(name + '_blade', (0.26, 0.04, 0.32), loc=(0, 0, -1.2), m=steel, parent=root)
    return root


def face(dx, dy):
    """rot_z (degrees) that turns the suit (which faces -Y) toward the direction (dx, dy)."""
    return math.degrees(math.atan2(dx, -dy))
