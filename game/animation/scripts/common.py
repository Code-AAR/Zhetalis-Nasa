"""Shared helpers for the Blender animation scripts in this folder.

Each seq_*.py script builds one sequence from the game's own 3D models, then (by command-line flag):
  --stills 0,120,300   render a few PNG frames into animation/stills/ (quick look)
  --export             save the .blend (animation/blend/) and the web GLB (animation/glb/)
  --video              render the preview MP4 (animation/previews/)

Run one:   blender -b --factory-startup -P seq_launch.py -- --export --video
Run all:   python build_all.py            (see README.md)

Blender 5.x, metres, Z up (the glTF exporter turns it into three.js's Y up).
Objects tagged preview_only (lights, captions, the preview sky) are left out of the GLB.
"""
import bpy, math, os, random, sys
from mathutils import Vector, Euler, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.dirname(HERE)                  # game/animation
GAME = os.path.dirname(ANIM)                  # game
ASSETS = os.path.join(GAME, 'assets')
FPS = 24


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {'stills': None, 'export': '--export' in a, 'video': '--video' in a, 'scale': 50}
    if '--stills' in a:
        out['stills'] = [int(x) for x in a[a.index('--stills') + 1].split(',')]
    if '--scale' in a:
        out['scale'] = int(a[a.index('--scale') + 1])
    return out


# ---------------------------------------------------------------- scene
def reset(name, seconds):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = name
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, int(round(seconds * FPS)) - 1
    sc.unit_settings.system = 'METRIC'
    return sc


def link(obj, parent=None):
    if obj.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    return link(e, parent)


def preview_only(obj):
    obj['preview_only'] = True
    for c in obj.children_recursive:
        c['preview_only'] = True
    return obj


def import_glb(rel, name, parent=None, decimate=None, tex=None, keep_parts=False, smooth=None):
    """Import a game GLB under one empty called `name`. Returns (root, {part name: object}).
    decimate: keep this fraction of triangles on big meshes. tex: shrink textures to this size.
    smooth: angle in degrees - smooth-shade the faceted space-pack models, keeping edges sharper than this."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, rel))
    new = [o for o in bpy.data.objects if o not in before]
    root = empty(name, parent=parent)
    parts = {}
    for o in new:
        parts[o.name] = o
        if o.parent is None:
            o.parent = root
        if decimate and o.type == 'MESH' and len(o.data.polygons) > 3000:
            m = o.modifiers.new('dec', 'DECIMATE')
            m.ratio = decimate
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='dec')
    if smooth:
        for o in new:
            if o.type == 'MESH':
                for p in o.data.polygons: p.use_smooth = True
                try: o.data.set_sharp_from_angle(angle=math.radians(smooth))
                except Exception: pass
    if tex:
        for img in bpy.data.images:
            if img.size[0] > tex:
                img.scale(tex, max(1, int(img.size[1] * tex / img.size[0])))
    return root, parts


def reparent(o, parent):
    """Change parent but keep the object where it is in the world."""
    bpy.context.view_layer.update()
    w = o.matrix_world.copy()
    o.parent = parent
    o.matrix_parent_inverse.identity()
    bpy.context.view_layer.update()
    o.matrix_world = w
    return o


def bounds(objs):
    objs = [o for o in objs if o.type == 'MESH']
    bpy.context.view_layer.update()
    mn = Vector((1e9,) * 3); mx = -mn
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx


# ---------------------------------------------------------------- materials
_mats = {}


def mat(name, color, rough=0.8, metal=0.0, emit=None, strength=1.0, alpha=1.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if rough >= 1.0:
        b.inputs['Specular IOR Level'].default_value = 0.0   # dust and soil: no shine
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
        m.use_backface_culling = False
    _mats[name] = m
    return m


def soften(m, power=1.5):
    """Preview look for dust and haze: alpha fades toward the silhouette (no hard bubble edges).
    export() swaps it back to a plain alpha value, since glTF has no node graph."""
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    base = b.inputs['Alpha'].default_value
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs['Facing'], inv.inputs[1])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = power
    nt.links.new(inv.outputs[0], pw.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = base * 1.6
    nt.links.new(pw.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], b.inputs['Alpha'])
    m['export_alpha'] = base
    return m


def setmat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


def recolor(root, fn):
    """fn(material) -> None; used to lift NASA's black 'fully metallic' materials to painted steel."""
    seen = set()
    for o in [root] + list(root.children_recursive):
        if o.type == 'MESH':
            for s in o.material_slots:
                if s.material and s.material.name not in seen:
                    seen.add(s.material.name)
                    fn(s.material)


# ---------------------------------------------------------------- primitives
def _new(op, name, m=None, parent=None, **kw):
    op(**kw)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    if m:
        setmat(o, m)
    if parent:
        o.parent = parent
    return o


def cube(name, size, loc=(0, 0, 0), m=None, parent=None):
    o = _new(bpy.ops.mesh.primitive_cube_add, name, m, parent, size=1, location=loc)
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def cyl(name, r, h, loc=(0, 0, 0), m=None, parent=None, verts=24, r2=None, base=False):
    """Cylinder (or cone when r2 given). base=True puts the bottom at loc instead of the centre."""
    if r2 is None:
        o = _new(bpy.ops.mesh.primitive_cylinder_add, name, m, parent, vertices=verts, radius=r, depth=h, location=loc)
    else:
        o = _new(bpy.ops.mesh.primitive_cone_add, name, m, parent, vertices=verts, radius1=r, radius2=r2, depth=h, location=loc)
    if base:
        for v in o.data.vertices:
            v.co.z += h / 2
    return o


def sphere(name, r, loc=(0, 0, 0), m=None, parent=None, sub=2, smooth=True):
    o = _new(bpy.ops.mesh.primitive_ico_sphere_add, name, m, parent, subdivisions=sub, radius=r, location=loc)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def uvsphere(name, r, loc=(0, 0, 0), m=None, parent=None, seg=48, rings=24):
    o = _new(bpy.ops.mesh.primitive_uv_sphere_add, name, m, parent, segments=seg, ring_count=rings, radius=r, location=loc)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def textured(name, image_rel, size=1024):
    """Material with one image texture (planet maps); the image is shrunk for the web."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    img = bpy.data.images.load(os.path.join(ASSETS, image_rel))
    if img.size[0] > size:
        img.scale(size, size // 2)
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.9
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    return m


def lathe(name, profile, m=None, verts=20, caps=True):
    """Solid of revolution around Z from [(z, radius), ...] (top to bottom)."""
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    rings = []
    for z, r in profile:
        rings.append([bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)) for a in [i * math.tau / verts for i in range(verts)]])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(verts):
            j = (i + 1) % verts
            bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    if caps:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bm.normal_update(); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); link(o)
    if m: setmat(o, m)
    return o


def flame(name, r, length, parent, loc, color=(1.0, 0.55, 0.15), strength=4, alpha=0.75, verts=18):
    """A glowing exhaust plume pointing down -Z from loc (nozzle). Origin at the nozzle, so scaling Z stretches it."""
    m = mat('flame_' + name, color, emit=color, strength=strength, alpha=alpha)
    L = length
    o = lathe(name, [(0, r), (-0.12 * L, r * 1.35), (-0.4 * L, r * 1.2), (-0.75 * L, r * 0.7), (-L, r * 0.12)], m, verts)
    o.parent = parent
    o.location = loc
    o.visible_shadow = False
    # white-hot core inside the plume (rides along with every flicker of the outer flame)
    cc = tuple(0.55 + 0.45 * c for c in color)
    cm = mat('flame_core_' + name, cc, emit=cc, strength=strength * 1.8, alpha=min(1, alpha + 0.15))
    core = lathe(name + '_core', [(0, r * 0.75), (-0.08 * L, r * 0.8), (-0.3 * L, r * 0.45), (-0.45 * L, r * 0.05)], cm, verts)
    core.parent = o; core.visible_shadow = False
    o.scale = (1, 1, 0.001)           # off until lit
    return o


def column(name, r, length, color, parent, loc, alpha=0.55):
    """Smoke column behind a rocket: narrow at the nozzle, wide far behind."""
    m = mat(name, color, rough=1.0, alpha=alpha)
    o = lathe(name, [(0, r * 0.4), (-0.1 * length, r), (-length, r * 4)], m, 14)
    o.parent = parent; o.location = loc; o.scale = (1, 1, 0.001); o.visible_shadow = False
    return o


def terrain(name, size, res, amp, color, seed=3, flat_r=0.0, flat_soft=40.0, m=None, freq=1.0):
    """Gently rolling ground: a grid displaced with noise, flattened to 0 inside flat_r of the centre."""
    o = _new(bpy.ops.mesh.primitive_grid_add, name, m or mat(name, color, rough=1.0), None,
             x_subdivisions=res, y_subdivisions=res, size=size)
    off = Vector((seed * 17.3, seed * 5.1, 0))
    for v in o.data.vertices:
        p = v.co.copy()
        h = noise.fractal(p * (freq * 3.0 / size) + off, 0.6, 2.0, 4) * amp
        h += noise.noise(p * (freq * 18.0 / size) + off) * amp * 0.2
        r = p.length
        k = min(1.0, max(0.0, (r - flat_r) / flat_soft)) if flat_r else 1.0
        k = k * k * (3 - 2 * k)
        v.co.z = h * k
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def rocks(name, n, rmin, rmax, size_range, color, seed=5, avoid=()):
    rnd = random.Random(seed)
    base = sphere(name + '_mesh', 1.0, m=mat(name, color, rough=1.0), sub=1, smooth=False)
    root = empty(name)
    out = []
    for i in range(n):
        while True:
            a = rnd.uniform(0, math.tau); r = rnd.uniform(rmin, rmax)
            x, y = math.cos(a) * r, math.sin(a) * r
            if all((x - ax) ** 2 + (y - ay) ** 2 > ar * ar for ax, ay, ar in avoid):
                break
        o = bpy.data.objects.new(f'{name}_{i}', base.data)
        s = rnd.uniform(*size_range)
        o.scale = (s * rnd.uniform(0.8, 1.4), s * rnd.uniform(0.8, 1.3), s * rnd.uniform(0.4, 0.7))
        o.rotation_euler = (rnd.random(), rnd.random(), rnd.random() * 6)
        o.location = (x, y, s * 0.15)
        link(o, root); out.append(o)
    bpy.data.objects.remove(base)
    return root


CAPTIONS = []


def caption(cam, text, f_in, f_out, who=None, phase=None):
    """Subtitle from frame f_in to f_out, optionally with a speaker and a phase title (top left).
    Burnt into the preview video by the Video Sequencer and written to <name>.captions.json for the game."""
    CAPTIONS.append((text, int(f_in), int(f_out), who, phase))


# ---------------------------------------------------------------- animation
class Anim:
    """Records keyframes, then writes them as Blender actions.
    The whole timeline becomes each object's active action (used for the preview render);
    each named clip becomes its own action on an NLA track of that name (used for the GLB export)."""

    def __init__(self):
        self.k = {}
        self.own = []          # objects keyed directly with Blender (armatures): their action becomes the first clip

    def key(self, obj, f, loc=None, rot=None, scale=None, interp='BEZIER'):
        d = self.k.setdefault(obj.name, {})
        for path, val in (('location', loc), ('rotation_euler', rot), ('scale', scale)):
            if val is None:
                continue
            if path == 'rotation_euler':
                val = [math.radians(v) for v in val]
            for i, v in enumerate(val):
                if v is None:
                    continue
                d.setdefault((path, i), {})[float(f)] = (float(v), interp)

    def hold(self, obj, f, interp='BEZIER'):
        """Key the object's current transform (so a later key moves from here)."""
        self.key(obj, f, loc=tuple(obj.location), rot=[math.degrees(a) for a in obj.rotation_euler],
                 scale=tuple(obj.scale), interp=interp)

    def keys_of(self, obj, path, i):
        return self.k.get(obj.name, {}).get((path, i), {})

    def _write(self, obj, name, chans, f0=None, f1=None, full=None):
        a = bpy.data.actions.new(name)
        slot = a.slots.new(id_type='OBJECT', name=obj.name)
        cb = a.layers.new('L').strips.new(type='KEYFRAME').channelbag(slot, ensure=True)
        for (path, i), keys in chans.items():
            fc = cb.fcurves.new(path, index=i)
            frames = sorted(keys)
            if f0 is not None:
                inner = [f for f in frames if f0 <= f <= f1]
                pts = [(f - f0, keys[f][0], keys[f][1]) for f in inner]
                src = full[(path, i)]
                if not inner or inner[0] > f0:
                    pts.insert(0, (0.0, src.evaluate(f0), 'BEZIER'))
                if not inner or inner[-1] < f1:
                    pts.append((f1 - f0, src.evaluate(f1), 'BEZIER'))
            else:
                pts = [(f, keys[f][0], keys[f][1]) for f in frames]
            for f, v, it in pts:
                kp = fc.keyframe_points.insert(f, v, options={'FAST'})
                kp.interpolation = it
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            fc.update()
        return a, slot, cb

    def build(self, clips):
        """clips: [(name, first frame, last frame)]."""
        self.clips = clips
        self.full = {}
        for oname, chans in self.k.items():
            obj = bpy.data.objects[oname]
            a, slot, cb = self._write(obj, oname + '_full', chans)
            obj.animation_data_create()
            obj.animation_data.action = a
            obj.animation_data.action_slot = slot
            self.full[oname] = {(fc.data_path, fc.array_index): fc for fc in cb.fcurves}

    def to_nla(self):
        for oname, chans in self.k.items():
            obj = bpy.data.objects[oname]
            if obj.get('preview_only'):
                continue
            ad = obj.animation_data
            for cname, f0, f1 in self.clips:
                a, slot, _ = self._write(obj, f'{cname}_{oname}', chans, f0, f1, self.full[oname])
                tr = ad.nla_tracks.new()
                tr.name = cname
                st = tr.strips.new(cname, 0, a)
                try:
                    st.action_slot = slot
                except Exception:
                    pass
            ad.action = None
        for obj in self.own:
            ad = obj.animation_data
            if not ad or not ad.action:
                continue
            act, slot = ad.action, ad.action_slot
            tr = ad.nla_tracks.new(); tr.name = self.clips[0][0]
            st = tr.strips.new(self.clips[0][0], 0, act)
            try: st.action_slot = slot
            except Exception: pass
            ad.action = None


A = Anim()


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def flicker(obj, f0, f1, base=(1, 1, 1), amt=0.12, step=2, seed=1, grow=6):
    """Exhaust flicker: fast random scale changes between f0 and f1, growing in over `grow` frames and cut at f1."""
    rnd = random.Random(seed)
    A.key(obj, f0 - 1, scale=(1, 1, 0.001), interp='LINEAR')
    f = f0
    while f < f1:
        k = min(1.0, (f - f0 + 1) / grow)
        b = base(f) if callable(base) else base
        A.key(obj, f, scale=(b[0] * (1 + rnd.uniform(-amt, amt) * 0.5), b[1] * (1 + rnd.uniform(-amt, amt) * 0.5),
                             max(0.001, b[2] * k * (1 + rnd.uniform(-amt, amt)))), interp='LINEAR')
        f += step
    A.key(obj, f1, scale=(1, 1, 0.001), interp='LINEAR')


class Puffs:
    """A pool of shared-mesh dust/smoke puffs, each with a few keys: born small at p, drifts with v, grows, shrinks away."""

    def __init__(self, name, n, color, alpha=0.55, r=1.0, emit=None):
        self.m = soften(mat(name, color, rough=1.0, alpha=alpha, emit=emit, strength=0.3 if emit else 1.0))
        self.mesh = sphere(name + '_mesh', r, m=self.m, sub=3).data
        bpy.data.objects.remove(bpy.data.objects[name + '_mesh'])
        self.root = empty(name)
        self.objs = []
        for i in range(n):
            o = bpy.data.objects.new(f'{name}_{i}', self.mesh)
            o.scale = (0.001,) * 3
            o.visible_shadow = False
            link(o, self.root)
            self.objs.append([o, -1e9])
        self.i = 0

    def emit(self, f, p, v, life, s0, s1, drag=0.6):
        """f start frame, p start position, v velocity (m/frame), life frames, size grows s0 -> s1."""
        best = min(self.objs, key=lambda e: e[1])
        if best[1] > f:
            return None
        o = best[0]
        best[1] = f + life + 2
        p = Vector(p); v = Vector(v)
        sc = lambda s: (s, s, s * 0.8)
        A.key(o, f - 1, loc=tuple(p), scale=(0.001,) * 3, interp='CONSTANT')
        n = 3
        for j in range(n + 1):
            t = j / n
            dist = (1 - math.exp(-drag * 3 * t)) / (drag * 3) if drag else t
            pos = p + v * life * dist
            s = s0 + (s1 - s0) * math.sqrt(t)
            if j == n:
                s = 0.001
            A.key(o, f + life * t, loc=tuple(pos), scale=sc(s), interp='BEZIER' if 0 < j < n else 'LINEAR')
        A.key(o, f + life + 1, scale=(0.001,) * 3, interp='CONSTANT')
        return o


# ---------------------------------------------------------------- camera, light, world
def camera(name='camera', lens=35):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start, cd.clip_end = 0.5, 60000
    c = bpy.data.objects.new(name, cd)
    link(c)
    bpy.context.scene.camera = c
    c.rotation_mode = 'XYZ'
    return c


def look(cam, f, pos, target, interp='BEZIER', roll=0.0):
    """Key the camera at pos looking at target."""
    d = Vector(target) - Vector(pos)
    q = d.to_track_quat('-Z', 'Y')
    e = q.to_euler('XYZ')
    if roll:
        e.y += math.radians(roll)
    if A.keys_of(cam, 'rotation_euler', 2):
        # keep the yaw continuous with the last key so the camera never spins the long way round
        last = A.keys_of(cam, 'rotation_euler', 2)
        prev = last[max(k for k in last if k <= f)][0] if any(k <= f for k in last) else None
        if prev is not None:
            while e.z - prev > math.pi: e.z -= math.tau
            while e.z - prev < -math.pi: e.z += math.tau
    A.key(cam, f, loc=tuple(pos), rot=[math.degrees(a) for a in e], interp=interp)


def sun(strength=3.0, color=(1, 0.96, 0.9), rot=(50, 0, 30), angle=0.5):
    ld = bpy.data.lights.new('sun', 'SUN')
    ld.energy = strength; ld.color = color; ld.angle = math.radians(angle)
    o = bpy.data.objects.new('sun', ld)
    o.rotation_euler = [math.radians(a) for a in rot]
    link(o)
    o['preview_only'] = True
    return o


def world_sky(horizon, zenith, ground, strength=1.0, stars=0.0):
    """Preview-only sky: gradient by view height, optional star field. Returns the strength input for keying."""
    w = bpy.data.worlds.new('sky'); bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree; N = nt.nodes; L = nt.links
    N.clear()
    out = N.new('ShaderNodeOutputWorld')
    bg = N.new('ShaderNodeBackground')
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'], sep.inputs[0])
    nrm = N.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'
    L.new(tc.outputs['Generated'], nrm.inputs[0])
    sep2 = N.new('ShaderNodeSeparateXYZ'); L.new(nrm.outputs[0], sep2.inputs[0])
    ramp = N.new('ShaderNodeValToRGB')
    mp = N.new('ShaderNodeMapRange'); mp.inputs['From Min'].default_value = -1; mp.inputs['From Max'].default_value = 1
    L.new(sep2.outputs['Z'], mp.inputs['Value'])
    L.new(mp.outputs['Result'], ramp.inputs['Fac'])
    el = ramp.color_ramp.elements
    el[0].position = 0.47; el[0].color = (*ground, 1)
    el[1].position = 0.75; el[1].color = (*zenith, 1)
    e = el.new(0.5); e.color = (*horizon, 1)
    col = ramp.outputs['Color']
    if stars:
        vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE' if False else 'F1'
        vor.inputs['Scale'].default_value = 420
        L.new(nrm.outputs[0], vor.inputs['Vector'])
        st = N.new('ShaderNodeMapRange'); st.inputs['From Min'].default_value = 0.0; st.inputs['From Max'].default_value = 0.035
        st.inputs['To Min'].default_value = stars; st.inputs['To Max'].default_value = 0.0
        L.new(vor.outputs['Distance'], st.inputs['Value'])
        add = N.new('ShaderNodeMix'); add.data_type = 'RGBA'; add.blend_type = 'ADD'
        add.inputs['Factor'].default_value = 1.0
        L.new(col, add.inputs[6]); L.new(st.outputs['Result'], add.inputs[7])
        col = add.outputs[2]
    L.new(col, bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    L.new(bg.outputs[0], out.inputs[0])
    return bg.inputs['Strength'], ramp


def key_value(socket, f, v):
    socket.default_value = v
    socket.keyframe_insert('default_value', frame=f)


# ---------------------------------------------------------------- output
def render_setup(scale=50, samples=16):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    sc.render.resolution_percentage = scale
    for k, v in (('taa_render_samples', max(samples, 32)), ('use_raytracing', True), ('ray_tracing_method', 'SCREEN'),
                 ('use_shadows', True), ('shadow_ray_count', 2), ('shadow_step_count', 8), ('use_fast_gi', True)):
        try: setattr(sc.eevee, k, v)       # soft reflections, contact shadows and ambient light (EEVEE)
        except Exception: pass
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.film_transparent = False


def edit_scene(sc):
    """A second scene that shows the 3D scene through a scene strip with the captions on top."""
    ed = bpy.data.scenes.new('preview_edit')
    r, R = ed.render, sc.render
    r.fps = R.fps; r.resolution_x, r.resolution_y, r.resolution_percentage = R.resolution_x, R.resolution_y, R.resolution_percentage
    ed.frame_start, ed.frame_end = sc.frame_start, sc.frame_end
    ed.view_settings.view_transform = sc.view_settings.view_transform
    ed.view_settings.look = sc.view_settings.look
    font = None
    for fp in ('C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(fp):
            font = bpy.data.fonts.load(fp); break
    se = ed.sequence_editor_create()
    strips = se.strips
    st = strips.new_scene('shot', sc, 1, sc.frame_start)
    st.scene_input = 'CAMERA'
    for i, (text, f0, f1, who, phase) in enumerate(CAPTIONS):
        f0 = max(f0, sc.frame_start); f1 = min(f1, sc.frame_end + 1)
        if f1 <= f0:
            continue
        if phase:
            ph = strips.new_effect(f'phase{i}', 'TEXT', 4 + i % 2, f0, length=f1 - f0)
            ph.text = phase; ph.font_size = 46 * R.resolution_percentage / 100; ph.location = (0.03, 0.88)
            ph.alignment_x = 'LEFT'; ph.color = (1.0, 0.48, 0.24, 1); ph.use_shadow = True
            if font: ph.font = font
        t = strips.new_effect(f'cap{i}', 'TEXT', 2 + i % 2, f0, length=f1 - f0)
        t.text = (who + ':  ' if who else '') + text
        t.font_size = 64 * R.resolution_percentage / 100
        if font: t.font = font
        t.location = (0.5, 0.075)
        t.alignment_x = 'CENTER'
        t.use_shadow = True
        t.use_box = True
        t.box_color = (0, 0, 0, 0.45)
        t.box_margin = 0.012
    return ed


def run(clips, opts, name):
    """Write the actions, then do what the command line asked for."""
    A.build(clips)
    sc = bpy.context.scene
    render_setup(opts['scale'])
    if opts['stills'] or opts['video']:
        ed = edit_scene(sc)
    if opts['stills']:
        d = os.path.join(ANIM, 'stills'); os.makedirs(d, exist_ok=True)
        ed.render.image_settings.media_type = 'IMAGE'
        ed.render.image_settings.file_format = 'PNG'
        for f in opts['stills']:
            ed.frame_set(f)
            ed.render.filepath = os.path.join(d, f'{name}_{f:04d}.png')
            with bpy.context.temp_override(scene=ed):
                bpy.ops.render.render(write_still=True, scene=ed.name)
    if opts['video']:
        d = os.path.join(ANIM, 'previews'); os.makedirs(d, exist_ok=True)
        r = ed.render
        r.image_settings.media_type = 'VIDEO'
        r.image_settings.file_format = 'FFMPEG'
        r.ffmpeg.format = 'MPEG4'; r.ffmpeg.codec = 'H264'
        r.ffmpeg.constant_rate_factor = 'MEDIUM'; r.ffmpeg.ffmpeg_preset = 'GOOD'
        r.filepath = os.path.join(d, name + '.mp4')
        r.use_file_extension = False
        with bpy.context.temp_override(scene=ed):
            bpy.ops.render.render(animation=True, scene=ed.name)
    if opts['stills'] or opts['video']:
        bpy.data.scenes.remove(ed)
    if opts['export']:
        d = os.path.join(ANIM, 'blend'); os.makedirs(d, exist_ok=True)
        sc.frame_set(0)
        sc['captions'] = [f'{c[1]}-{c[2]}: {c[0]}' for c in CAPTIONS]
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(d, name + '.blend'), compress=True)
        export(name)


def export(name):
    A.to_nla()
    for m in bpy.data.materials:
        if 'export_alpha' in m:
            b = m.node_tree.nodes['Principled BSDF']
            for l in list(b.inputs['Alpha'].links):
                m.node_tree.links.remove(l)
            b.inputs['Alpha'].default_value = m['export_alpha']
    d = os.path.join(ANIM, 'glb'); os.makedirs(d, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if not o.get('preview_only') and o.type in ('MESH', 'EMPTY', 'CAMERA', 'ARMATURE'):
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(d, name + '.glb'), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_cameras=True, export_lights=False,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_frame_step=2, export_optimize_animation_size=True, export_anim_slide_to_zero=False,
        export_image_format='JPEG', export_image_quality=85, export_extras=True, export_materials='EXPORT',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
    import json
    fps = bpy.context.scene.render.fps
    with open(os.path.join(d, name + '.captions.json'), 'w', encoding='utf-8') as fh:
        json.dump({'clips': [{'name': c, 'start': round(f0 / fps, 3), 'end': round(f1 / fps, 3)} for c, f0, f1 in A.clips],
                   'captions': [dict({'t0': round(f0 / fps, 2), 't1': round(f1 / fps, 2), 'text': t}, **({'who': w} if w else {}), **({'phase': ph} if ph else {}))
                                for t, f0, f1, w, ph in CAPTIONS]},
                  fh, indent=1, ensure_ascii=False)
    print('EXPORTED', name, os.path.getsize(os.path.join(d, name + '.glb')))
