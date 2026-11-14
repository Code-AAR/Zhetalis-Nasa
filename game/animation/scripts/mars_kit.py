"""Mars outpost pieces shared by the Mars sequences. Game models where the game has them
(space-pack lander = the game's landing pod, hab, NASA SEV rover, astronaut, greenhouse walkway, NASA orbital
replacement unit); simple game-authored shapes for what it has no model of (solar trackers, fission power unit,
oxygen/methane plant, dish). Sizes in metres."""
import math, os, random
from common import *
from mathutils import Vector

RUST = (0.52, 0.29, 0.17)


def mars_world(sun_strength=2.6):
    s = sun(sun_strength, color=(1.0, 0.9, 0.78), rot=(52, 0, 40), angle=0.35)
    sky = world_sky((0.86, 0.66, 0.5), (0.5, 0.38, 0.3), (0.42, 0.26, 0.16), strength=0.9)
    return s, sky


def _terrain_data():
    """The game's own terrain: MOLA heights of Gusev Crater (512x512, assets/terrain/gusev-mola-128.*) and the real
    ground brightness (assets/terrain/gusev-albedo-256.*). North is +Y here (the game's -Z)."""
    import json, numpy as np
    t = os.path.join(ASSETS, 'terrain')
    meta = json.load(open(os.path.join(t, 'gusev-mola-128.json')))
    h = np.fromfile(os.path.join(t, 'gusev-mola-128.bin'), '<i2').reshape(meta['n'], meta['n']).astype(np.float32)
    am = json.load(open(os.path.join(t, 'gusev-albedo-256.json')))
    al = np.fromfile(os.path.join(t, 'gusev-albedo-256.bin'), np.uint8).reshape(am['n'], am['n']).astype(np.float32) / 255
    return h, meta, al


def _bilinear(g, u, v):
    import numpy as np
    n = g.shape[0]
    u = np.clip(u, 0, n - 1.001); v = np.clip(v, 0, n - 1.001)
    x0 = u.astype(int); y0 = v.astype(int); fx = u - x0; fy = v - y0
    return (g[y0, x0] * (1 - fx) + g[y0, x0 + 1] * fx) * (1 - fy) + (g[y0 + 1, x0] * (1 - fx) + g[y0 + 1, x0 + 1] * fx) * fy


def regolith_texture(size=512, seed=3):
    """Tileable Mars soil: rust dust with grain, darker basalt pebbles and pale dust patches (generated, no source art)."""
    import numpy as np
    rng = np.random.default_rng(seed)

    def tile_noise(cells):
        g = rng.random((cells, cells)).astype(np.float32)
        x = np.linspace(0, cells, size, endpoint=False)
        x0 = x.astype(int); f = x - x0; f = f * f * (3 - 2 * f); x1 = (x0 + 1) % cells
        top = g[x0][:, x0] * (1 - f)[None, :] + g[x0][:, x1] * f[None, :]
        bot = g[x1][:, x0] * (1 - f)[None, :] + g[x1][:, x1] * f[None, :]
        return top * (1 - f)[:, None] + bot * f[:, None]

    n = sum(tile_noise(c) * w for c, w in ((4, .45), (8, .25), (16, .15), (64, .1), (128, .05)))
    grain = rng.random((size, size)).astype(np.float32)
    base = np.array([0.56, 0.37, 0.26], np.float32)
    col = base[None, None, :] * (0.78 + 0.4 * n[..., None]) * (0.93 + 0.14 * grain[..., None])
    yy, xx = np.ogrid[-6:7, -6:7]
    for _ in range(260):                                   # pebbles: small dark basalt bits, some pale
        cx, cy = rng.integers(0, size, 2); r = rng.uniform(1.0, 4.5)
        tone = np.array([0.24, 0.16, 0.13]) if rng.random() < 0.7 else np.array([0.75, 0.55, 0.40])
        m = np.clip(1.2 - np.sqrt(xx * xx + yy * yy) / r, 0, 1)[..., None]
        ys = (np.arange(cy - 6, cy + 7) % size)[:, None]; xs = (np.arange(cx - 6, cx + 7) % size)[None, :]
        col[ys, xs] = col[ys, xs] * (1 - m) + tone * m
    img = bpy.data.images.new('regolith', size, size)
    rgba = np.concatenate([np.clip(col, 0, 1), np.ones((size, size, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.pack()
    return img


def mars_ground(size=1400, center=(0, 0), span=960, vscale=0.015, flat_r=110, seed=4, rocks_n=140, craters=10, clear=None, **_old):
    """Detailed ground from the game's own data. A polar mesh around `center` (dense where the camera works, sparse
    far away) with real MOLA heights mapped like the game maps them (span metres for the 4-degree crop, heights
    x vscale, flat base), small bumps and impact craters, real albedo as vertex colour times a tiled soil texture,
    and the game's textured rocks (assets/mars-rocks.glb). Returns (ground, rocks root, height function)."""
    import numpy as np
    h, meta, al = _terrain_data()
    n = meta['n']
    cx, cy = center
    rnd = random.Random(seed)
    crater_list = []
    for _ in range(craters):                                 # small impact craters away from the base
        for _try in range(200):
            r = rnd.uniform(4, 22); a = rnd.uniform(0, math.tau); d = rnd.uniform(flat_r + 20, size * 0.4)
            x, y = math.cos(a) * d, math.sin(a) * d
            if all((x - X) ** 2 + (y - Y) ** 2 > (r + R + 10) ** 2 for X, Y, R in crater_list):
                crater_list.append((x, y, r)); break
    h0 = _bilinear(h, np.array([(n - 1) / 2]), np.array([(n - 1) / 2]))[0]

    def height(X, Y):
        X = np.asarray(X, float); Y = np.asarray(Y, float)
        u = (X / span + .5) * (n - 1); v = (.5 - Y / span) * (n - 1)
        z = (_bilinear(h, u, v) - h0) * vscale
        R = np.hypot(X, Y)
        k = np.clip((R - flat_r) / 60.0, 0, 1); k = k * k * (3 - 2 * k)
        ph = seed * 3.1
        bumps = 0.25 * np.sin(X * 0.37 + ph) * np.sin(Y * 0.29 - ph) + 0.12 * np.sin(X * 1.3 + Y * 0.9) * np.cos(Y * 1.1 - X * 0.4)
        z = z * k + bumps * (0.15 + 0.85 * k)
        for x, y, r in crater_list:                        # bowl, raised rim
            d = np.hypot(X - x, Y - y) / r
            z = z - np.where(d < 1, 0.22 * r * (1 - d * d), 0) + 0.05 * r * np.exp(-((d - 1) / 0.25) ** 2)
        return z

    # polar grid: 0.6 m rings near the centre, growing 7% per ring further out
    radii = [0.0]; r = 0.6
    while r < size * 0.72:
        radii.append(r); r = r + 0.6 if r < 8 else r * 1.07
    seg = 192
    ang = np.linspace(0, math.tau, seg, endpoint=False)
    RR = np.array(radii[1:])[:, None]
    X = np.concatenate([[cx], (cx + RR * np.cos(ang)[None, :]).ravel()])
    Y = np.concatenate([[cy], (cy + RR * np.sin(ang)[None, :]).ravel()])
    Z = height(X, Y)
    verts = np.stack([X, Y, Z], 1)
    faces = [(0, 1 + (i + 1) % seg, 1 + i)[::-1] for i in range(seg)]
    for ri in range(len(radii) - 2):
        a0 = 1 + ri * seg; a1 = a0 + seg
        faces += [(a0 + i, a0 + (i + 1) % seg, a1 + (i + 1) % seg, a1 + i) for i in range(seg)]
    me = bpy.data.meshes.new('mars_ground')
    me.from_pydata(verts.tolist(), [], faces)
    me.update()
    for p in me.polygons: p.use_smooth = True
    g = bpy.data.objects.new('mars_ground', me); link(g)
    if me.polygons[len(me.polygons) // 2].normal.z < 0:     # make sure the ground faces up
        me.flip_normals()
    # world-space UVs for the tiled soil (one tile per 7 m)
    uv = me.uv_layers.new(name='UVMap')
    loops = np.zeros(len(me.loops), int); me.loops.foreach_get('vertex_index', loops)
    uv.data.foreach_set('uv', np.stack([X[loops] / 11.0, Y[loops] / 11.0], 1).ravel())
    # real albedo -> vertex colour (darker = dust swept off dark basalt sand), plus darker crater floors
    na = al.shape[0]
    A_ = _bilinear(al, (X / span + .5) * (na - 1), (.5 - Y / span) * (na - 1))
    shade = 0.82 + 0.36 * A_ + 0.06 * np.sin(X * 0.05 + Y * 0.031) * np.cos(Y * 0.043)
    for k, (fx, fy, amp) in enumerate(((0.013, 0.017, 0.07), (0.041, 0.029, 0.05), (0.11, 0.087, 0.035), (0.29, 0.23, 0.02))):
        shade = shade + amp * np.sin(X * fx + seed * (k + 1)) * np.sin(Y * fy - seed * 0.7 * (k + 2))   # broad patches
    for x, y, rr in crater_list:
        shade = shade * np.where(np.hypot(X - x, Y - y) / rr < 1.1, 0.88, 1.0)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set('color', np.stack([shade, shade, shade, np.ones_like(shade)], 1).astype(np.float32).ravel())
    m = bpy.data.materials.new('mars_soil'); m.use_nodes = True; nt = m.node_tree
    b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 0.95; b.inputs['Specular IOR Level'].default_value = 0.1
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = regolith_texture(seed=seed)
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], mix.inputs[6]); nt.links.new(vc.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    setmat(g, m)

    # the game's textured rocks, scattered with realistic sizes (most small, a few boulders)
    lib, P = import_glb('mars-rocks.glb', 'rock_library', tex=512)
    shapes = []
    for o in P.values():
        if o.type == 'MESH':
            # bake the file's grid placement out: shape data is used directly with its own local bounds
            lmn = Vector(map(min, *[Vector(c) for c in o.bound_box])); lmx = Vector(map(max, *[Vector(c) for c in o.bound_box]))
            shapes.append((o.data, max(lmx - lmn), (lmn + lmx) / 2, lmn.z))
    for o in [lib] + list(lib.children_recursive):
        bpy.data.objects.remove(o)
    root = empty('rocks')
    # clear: circles (x, y, r) kept free of rocks for buildings and paths; default keeps the outpost area clear
    avoid = (clear if clear is not None else [(0, 0, flat_r * 0.6)]) + [(x, y, r * 1.2) for x, y, r in crater_list]
    placed = tries = 0
    while placed < rocks_n and tries < rocks_n * 30:
        tries += 1
        near = rnd.random() < 0.6
        d = rnd.uniform(6, 110) if near else rnd.uniform(60, size * 0.45)
        a = rnd.uniform(0, math.tau); x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        if any((x - X0) ** 2 + (y - Y0) ** 2 < R0 ** 2 for X0, Y0, R0 in avoid):
            continue
        data, ext, c, zmin = rnd.choice(shapes)
        target = rnd.choice((0.25, 0.35, 0.5, 0.7, 1.0)) if near else rnd.uniform(0.6, 2.8)
        if rnd.random() < 0.05: target *= 2.2                      # an occasional big boulder
        k = target / ext
        o = bpy.data.objects.new(f'rock_{placed}', data)
        o.scale = (k, k, k)
        rz = rnd.uniform(0, math.tau); o.rotation_euler = (0, 0, rz)
        ox = (c.x * math.cos(rz) - c.y * math.sin(rz)) * k; oy = (c.x * math.sin(rz) + c.y * math.cos(rz)) * k
        gz = float(height([x], [y])[0])
        o.location = (x - ox, y - oy, gz - zmin * k - target * 0.12)   # sunk in a little
        link(o, root); placed += 1
    return g, root, height


def lander(name, loc=(0, 0, 0), rot_z=0):
    """The game's landing pod (space-pack lander, 11 m tall, every part its own object)."""
    root, P = import_glb('space-pack/lander.glb', name, smooth=40)
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
    root, P = import_glb('space-pack/hab.glb', name, smooth=40)
    for k, o in P.items():
        o.name = f'{name}_{k.split(".")[0]}'
    root.location = loc
    root.rotation_euler.z = math.radians(rot_z)
    return root


def rover(name='sev', loc=(0, 0, 0), rot_z=0):
    """NASA Space Exploration Vehicle (pressurised rover), decimated for the web, with its six wheels cut out as
    their own objects (parented to the rover root, so the body can ride its suspension above them)."""
    import bmesh
    root, P = import_glb('sev.glb', name, decimate=0.14, tex=1024)
    mn, mx = bounds(root.children_recursive)
    holder = empty(name + '_body', parent=root)
    for o in list(root.children):
        if o is not holder:
            o.parent = holder
    holder.location.z = -mn.z
    bpy.context.view_layer.update()
    body = next(o for o in holder.children_recursive if o.type == 'MESH')
    # wheels: the low, outer part of the mesh, split into 3 per side by position along the rover
    mw = body.matrix_world; inv = root.matrix_world.inverted()      # rover-root frame: ground at z = 0
    me = body.data; bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    W = mx.x - mn.x
    cand = []
    for f in bm.faces:
        c = inv @ (mw @ f.calc_center_median())
        if c.z < 1.1 and abs(c.x) > W * 0.28:
            cand.append((f, c))
    ys = sorted(c.y for _, c in cand)
    wheels = []
    if len(ys) > 30:
        lo, hi = ys[0], ys[-1]
        groups = {}
        for f, c in cand:
            k = (0 if c.x < 0 else 1, min(2, int((c.y - lo) / ((hi - lo) / 3 + 1e-6))))
            groups.setdefault(k, []).append(f)
        for (side, idx), faces in sorted(groups.items()):
            wb = bmesh.new()
            vmap = {}
            for f in faces:
                vs = []
                for v in f.verts:
                    if v.index not in vmap: vmap[v.index] = wb.verts.new(v.co)
                    vs.append(vmap[v.index])
                try: wb.faces.new(vs)
                except ValueError: pass
            wme = bpy.data.meshes.new(f'{name}_wheel_{side}{idx}'); wb.to_mesh(wme); wb.free()
            for i, m_ in enumerate(me.materials): wme.materials.append(m_)
            wo = bpy.data.objects.new(f'{name}_wheel_{side}{idx}', wme); link(wo)
            wo.matrix_world = body.matrix_world.copy()
            for p in wme.polygons: p.use_smooth = True
            wheels.append(wo)
        bmesh.ops.delete(bm, geom=[f for f, _ in cand], context='FACES')
        bm.to_mesh(me)
    bm.free()
    for wo in wheels:                                 # pivot at each wheel's centre, hang it from the rover root
        bpy.context.view_layer.objects.active = wo
        bpy.ops.object.select_all(action='DESELECT'); wo.select_set(True)
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        reparent(wo, root)
        wo.rotation_mode = 'XYZ'
    root['wheels'] = [w.name for w in wheels]
    root['body'] = holder.name
    root.location = loc
    root.rotation_euler.z = math.radians(rot_z)
    return root


def rover_motion(sev, step=2, slip=(), tracks=True, bump=0.035):
    """Make the SEV look driven: wheels roll by the distance covered (backwards when reversing), spin in place
    in `slip` windows [(f0, f1, turns per second)], the body rides its suspension, and tread marks are left behind."""
    kx, ky = A.keys_of(sev, 'location', 0), A.keys_of(sev, 'location', 1)
    kh = A.keys_of(sev, 'rotation_euler', 2)
    fr = sorted(set(kx) & set(ky))
    if len(fr) < 2: return
    wheels = [bpy.data.objects[n] for n in sev.get('wheels', [])]
    body = bpy.data.objects.get(sev.get('body', ''))
    r = 0.55
    def at(f):
        prev = max([k for k in fr if k <= f], default=fr[0]); nxt = min([k for k in fr if k >= f], default=fr[-1])
        t = 0 if nxt == prev else (f - prev) / (nxt - prev); t = t * t * (3 - 2 * t)
        return Vector((kx[prev][0] + (kx[nxt][0] - kx[prev][0]) * t, ky[prev][0] + (ky[nxt][0] - ky[prev][0]) * t))
    def heading(f):
        if not kh: return sev.rotation_euler.z
        ks = sorted(kh); prev = max([k for k in ks if k <= f], default=ks[0]); nxt = min([k for k in ks if k >= f], default=ks[-1])
        t = 0 if nxt == prev else (f - prev) / (nxt - prev)
        return kh[prev][0] + (kh[nxt][0] - kh[prev][0]) * t
    ang, last, travelled, next_mark = 0.0, at(fr[0]), 0.0, 0.0
    mark_mesh = None
    marks = empty(sev.name + '_tracks') if tracks else None
    f = fr[0]; rnd = random.Random(3)
    while f <= max(fr[-1], max([s[1] for s in slip], default=0)):
        p = at(min(f, fr[-1])); d = p - last; last = p
        h = heading(f); fwd = Vector((math.sin(h), -math.cos(h)))     # the cab faces local -Y
        sgn = 1 if d.dot(fwd) >= 0 else -1
        ang += sgn * d.length / r
        for f0, f1, tps in slip:
            if f0 <= f <= f1: ang += math.tau * tps * step / FPS
        for w in wheels:
            A.key(w, f, rot=(math.degrees(ang), 0, 0), interp='LINEAR')
        if body is not None and d.length > 0.01:
            A.key(body, f, loc=(None, None, body.location.z + bump * (math.sin(f * 0.9) + 0.5 * math.sin(f * 2.3 + 1))), interp='LINEAR')
        travelled += d.length
        if tracks and travelled >= next_mark and d.length > 0.01:          # two tread strips under the wheel lines
            next_mark = travelled + 0.7
            if mark_mesh is None:
                mark_mesh = cube(sev.name + '_track_mesh', (0.45, 0.75, 0.012), m=mat('tread', (0.2, 0.11, 0.07), rough=1.0)).data
                bpy.data.objects.remove(bpy.data.objects[sev.name + '_track_mesh'])
            side = Vector((math.cos(h), math.sin(h)))
            for sx in (-1.55, 1.55):
                q = p + side * sx
                mo = bpy.data.objects.new(f'{sev.name}_track_{len(marks.children)}', mark_mesh); link(mo, marks)
                mo.location = (q.x, q.y, 0.012); mo.rotation_euler.z = h
                A.key(mo, f - 1, scale=(0.0001,) * 3, interp='CONSTANT'); A.key(mo, f, scale=(1, 1, 1), interp='CONSTANT')
        f += step


def astronaut(name, loc=(0, 0, 0), rot_z=0):
    """An articulated astronaut in NASA's Z-2 suit (astro_kit). Returns the holder; its rig is holder['rig']."""
    import astro_kit
    holder, arm = astro_kit.astronaut(name, loc, rot_z)
    holder['rig'] = arm.name
    astro_kit.stand(arm, 0)
    return holder


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
    plume = flame(name + '_plume', 0.5, 9, ascent, (0, 0, z0 - 1.0), color=(0.55, 0.65, 1.0), strength=5, alpha=0.6, diamonds=3)
    return root, ascent, plume, z0


def finished_outpost(skip=()):
    """The outpost as it stands near the end of the 26 months (same layout as seq_outpost.py)."""
    out = {}
    out['pod'] = lander('crew_pod', (*POD, 0))[0]
    if 'ascent' not in skip:
        out['ascent'] = ascent_vehicle('ascent_vehicle', (*MAV, 0))
    out['hab1'] = hab('hab_1', (*HAB1, 0), rot_z=200)
    out['hab2'] = hab('hab_2', (*HAB2, 0), rot_z=150)
    out['greenhouse'] = greenhouse('greenhouse', GH)
    build_links()
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


def rover_path(sev, pts, reverse=()):
    """Key the SEV through [(frame, (x, y)), ...], always facing where it drives. The SEV's cab faces local -Y,
    so heading = direction + 90 deg. Frames listed in `reverse` are driven backwards (cab facing away)."""
    last = None
    for i, (f, (x, y)) in enumerate(pts):
        if i + 1 < len(pts):
            nx, ny = pts[i + 1][1]; d = (nx - x, ny - y)
        else:
            px, py = pts[i - 1][1]; d = (x - px, y - py)
        if abs(d[0]) + abs(d[1]) < 1e-6 and last is not None:
            h = last
        else:
            h = math.degrees(math.atan2(d[1], d[0])) + 90 + (180 if f in reverse else 0)
            if last is not None:
                while h - last > 180: h -= 360
                while h - last < -180: h += 360
        A.key(sev, f, loc=(x, y, 0), rot=(0, 0, h))
        last = h


def walk_bob(obj, amp=0.06, step=7):
    """Walk the articulated astronaut wherever its keys move it: planted strides while moving, standing otherwise."""
    import astro_kit
    kx = A.keys_of(obj, 'location', 0)
    if not kx or 'rig' not in obj or obj.get('walked'): return
    fr = sorted(kx)
    astro_kit.walk(bpy.data.objects[obj['rig']], obj, fr[0], fr[-1])


# ---------------------------------------------------------------- outpost layout (shared by every Mars film)
# The landing pod stands on its own (crews walk across from it); the walkways join habitat 1 to habitat 2 and to the
# greenhouse. Every walkway runs wall to wall with a sealed airlock collar at each end.
POD, MAV, HAB1, HAB2, GH = (0, 0), (46, 30), (-12, 22), (20, 40), (-46, 22)
GH_LEN, GH_R = 22.0, 4.2
BERM_IN, BERM_OUT = 7.6, 9.6
_hab_r = None


def hab_wall_radius():
    """Outer radius of the habitat wall (measured once from the game's hab model)."""
    global _hab_r
    if _hab_r is None:
        root, P = import_glb('space-pack/hab.glb', '_measure')
        w = next(o for k, o in P.items() if k.startswith('Habitat_wall'))
        mn, mx = bounds([w]); _hab_r = (mx.x - mn.x) / 2
        for o in [root] + list(root.children_recursive): bpy.data.objects.remove(o)
    return _hab_r


def greenhouse(name, center=GH, rot_z=0.0):
    """Arched glass greenhouse (22 m x 8.4 m) with plant beds, like the game's (src/greenhouse.js) but simplified.
    Its long axis runs along local X; the walkway door is the +X end."""
    import bmesh
    root = empty(name, loc=(*center, 0)); root.rotation_euler.z = math.radians(rot_z)
    def arch(oname, r_out, r_in, x0, x1, m, seg=24):
        me = bpy.data.meshes.new(oname); bm = bmesh.new()
        prof = [(math.cos(a), math.sin(a)) for a in [math.pi * i / seg for i in range(seg + 1)]]
        rings = []
        for x in (x0, x1):
            outer = [bm.verts.new((x, c * r_out, s * r_out)) for c, s in prof]
            inner = [bm.verts.new((x, c * r_in, s * r_in)) for c, s in prof]
            rings.append((outer, inner))
        (o0, i0), (o1, i1) = rings
        for k in range(seg):
            bm.faces.new((o0[k], o0[k + 1], o1[k + 1], o1[k])); bm.faces.new((i0[k + 1], i0[k], i1[k], i1[k + 1]))
            bm.faces.new((o0[k + 1], o0[k], i0[k], i0[k + 1])); bm.faces.new((o1[k], o1[k + 1], i1[k + 1], i1[k]))
        bm.normal_update(); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        o = bpy.data.objects.new(oname, me); link(o, root); setmat(o, m); return o
    glass = mat('gh_glass', (0.75, 0.88, 0.95), rough=0.05, alpha=0.32)
    frame = mat('gh_frame', (0.85, 0.86, 0.88), rough=0.4, metal=0.6)
    L = GH_LEN
    shell = arch(name + '_glass', GH_R, GH_R - 0.08, -L / 2, L / 2, glass); shell.visible_shadow = False
    for i in range(9):
        x = -L / 2 + i * L / 8
        arch(f'{name}_rib{i}', GH_R + 0.08, GH_R - 0.12, x - 0.12, x + 0.12, frame)
    for side in (-1, 1):                                    # sealed end walls: solid half discs
        arch(f'{name}_end{side}', GH_R, 0.05, side * L / 2 - 0.06, side * L / 2 + 0.06, frame if side > 0 else glass)
    cube(name + '_floor', (L, 2 * GH_R, 0.25), loc=(0, 0, 0.12), m=mat('gh_floor', (0.5, 0.48, 0.45), rough=0.8), parent=root)
    leaf = mat('gh_leaf', (0.18, 0.55, 0.16), rough=0.7); soil = mat('gh_soil', (0.2, 0.13, 0.09), rough=1.0)
    rnd = random.Random(7)
    for row, y in enumerate((-2.2, 0, 2.2)):
        cube(f'{name}_bed{row}', (L - 3, 1.1, 0.6), loc=(0, y, 0.55), m=soil, parent=root)
        for j in range(14):
            pl = sphere(f'{name}_plant{row}_{j}', 0.35, loc=(-L / 2 + 2 + j * (L - 4) / 13, y + rnd.uniform(-0.2, 0.2), 1.0), m=leaf, parent=root, sub=1)
            s_ = rnd.uniform(0.7, 1.2); pl.scale = (s_, s_, s_ * 0.8)
    return root


def berm_gapped(name, center, gaps=(), r_in=BERM_IN, r_out=BERM_OUT, h=3.2, gap_w=5.0):
    """Bagged-soil shielding wall around a habitat, with openings where walkways pass (gaps: directions in radians)."""
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    seg = 96; prof = [(h, r_in + 0.6), (h, r_out - 0.6), (0, r_out), (0, r_in)]
    def open_at(a):
        for g in gaps:
            d = abs((a - g + math.pi) % math.tau - math.pi)
            if d * (r_in + r_out) / 2 < gap_w / 2: return True
        return False
    angs = [math.tau * i / seg for i in range(seg)]
    rings = [[bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)) for z, r in prof] for a in angs]
    for i in range(seg):
        j = (i + 1) % seg
        if open_at(angs[i]) or open_at(angs[j]): continue
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((rings[i][k], rings[j][k], rings[j][k2], rings[i][k2]))
        if open_at(angs[(i - 1) % seg]): bm.faces.new(list(reversed(rings[i])))   # close the wall ends at a gap
        if open_at(angs[(j + 1) % seg]): bm.faces.new(rings[j])
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); link(o); o.location = (*center, 0)
    setmat(o, mat('regolith_bags', (0.6, 0.38, 0.24), rough=1.0))
    return o


def walkway_between(name, a, ra, b, rb):
    """The game's pressurised walkway from the wall of building a (radius ra) to building b (radius rb), sealed with an
    airlock collar at both ends. Returns (root, start point, end point)."""
    va, vb = Vector((*a, 0)), Vector((*b, 0))
    d = (vb - va).normalized()
    p0, p1 = va + d * (ra - 0.4), vb - d * (rb - 0.4)        # ends tucked just inside each wall
    w, _ = import_glb('greenhouse-walkway.glb', name)
    for o in w.children_recursive:
        o.name = f'{name}_{o.name.split(".")[0]}'
    w.location = p0
    w.rotation_euler.z = math.atan2(d.y, d.x) + math.pi / 2  # the model runs along its -Y from its origin
    w.scale = (1, (p1 - p0).length / 15.0, 1)
    cm = mat('airlock_collar', (0.78, 0.79, 0.8), rough=0.45, metal=0.5)
    collars = []
    for k, p in enumerate((p0, p1)):
        c = cube(f'{name}_collar{k}', (4.1, 0.9, 3.75), loc=(0, 0, 0), m=cm)
        c.location = (p.x, p.y, 1.62); c.rotation_euler.z = math.atan2(d.y, d.x) + math.pi / 2
        ring = cube(f'{name}_seal{k}', (4.3, 0.25, 3.95), m=mat('collar_seal', (0.25, 0.26, 0.28), rough=0.6))
        q = p + d * (0.55 if k == 0 else -0.55)
        ring.location = (q.x, q.y, 1.62); ring.rotation_euler.z = c.rotation_euler.z
        collars += [c, ring]
    return w, p0, p1, collars


def outpost_obstacles():
    """Footprints movers must not pass through: buildings (circles) and walkways (segments, half width)."""
    r = hab_wall_radius()
    circles = [(POD, 4.0), (MAV, 5.5), (HAB1, BERM_OUT + 0.8), (HAB2, BERM_OUT + 0.8), ((62, -40), 7.5)]
    segs = [(HAB1, HAB2, 2.8), (HAB1, (GH[0] + GH_LEN / 2, GH[1]), 2.8), ((GH[0] - GH_LEN / 2, GH[1]), (GH[0] + GH_LEN / 2, GH[1]), GH_R + 0.8)]
    return circles, segs


def route_problems(points, extra_circles=()):
    """Legs of a route [(x, y), ...] that cross a building or walkway (to check film paths)."""
    circles, segs = outpost_obstacles()
    circles = circles + list(extra_circles)
    bad = []
    def seg_dist(p, q, a, b):
        import numpy as np
        p, q, a, b = map(lambda t: np.array(t, float), (p, q, a, b))
        best = 1e9
        for t in np.linspace(0, 1, 60):
            x = p + (q - p) * t
            ab = b - a; u = max(0, min(1, np.dot(x - a, ab) / max(1e-9, np.dot(ab, ab))))
            best = min(best, np.linalg.norm(x - (a + ab * u)))
        return best
    for p, q in zip(points, points[1:]):
        for c, r in circles:
            if seg_dist(p, q, c, c) < r: bad.append((p, q, 'building', c))
        for a, b, w in segs:
            if seg_dist(p, q, a, b) < w: bad.append((p, q, 'walkway', a, b))
    return bad


def gh_door():
    return (GH[0] + GH_LEN / 2, GH[1])


def build_links(names=('walkway_hab', 'walkway_greenhouse')):
    """Walkways habitat 1 -> habitat 2 and habitat 1 -> greenhouse, and the soil walls with gaps for them.
    Returns {name: walkway root} and the berm objects."""
    r = hab_wall_radius()
    w1 = walkway_between(names[0], HAB1, r, HAB2, r)[0]
    w2 = walkway_between(names[1], HAB1, r, gh_door(), 0.0)[0]
    ang = lambda a, b: math.atan2(b[1] - a[1], b[0] - a[0])
    b1 = berm_gapped('shield_berm_0', HAB1, gaps=(ang(HAB1, HAB2), ang(HAB1, gh_door())))
    b2 = berm_gapped('shield_berm_1', HAB2, gaps=(ang(HAB2, HAB1),))
    return {names[0]: w1, names[1]: w2}, (b1, b2)
