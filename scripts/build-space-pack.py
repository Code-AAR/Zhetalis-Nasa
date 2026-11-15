"""Converts the team's Zhetalis Space Pack (OBJ + shared MTL palette, made for the Unity project) into web GLB
files the game can load with three.js, and copies the editable originals into source-assets/.

    python scripts/build-space-pack.py [path/to/ZhetalisSpacePack]

Default source: ../Zhetalis-Nasa-Unity/Assets/ZhetalisSpacePack (next to this repository).
Writes:
  game/assets/space-pack/<name>.glb      - one GLB per model: metres, Y up, +Z forward (same as the OBJ)
  game/assets/space-pack/manifest.json   - name, file, triangles, part names, bounds, size in bytes
  source-assets/space-pack/              - the original OBJ files, SpacePalette.mtl, README, manifest, palette

Each GLB keeps the OBJ's named parts as separate nodes (so code can find "Core_stage" or a wheel) and turns the
MTL's diffuse colours into glTF PBR materials (shiny palette entries become slightly metallic). Faces stay flat
shaded, as in the source. No textures, so files stay small.
"""
import json, os, shutil, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, '..', 'Zhetalis-Nasa-Unity', 'Assets', 'ZhetalisSpacePack'))
MODELS = os.path.join(SRC, 'Models')
OUT = os.path.join(REPO, 'game', 'assets', 'space-pack')
KEEP = os.path.join(REPO, 'source-assets', 'space-pack')


def read_mtl(path):
    mats, cur = {}, None
    for line in open(path, encoding='utf-8'):
        p = line.split()
        if not p: continue
        if p[0] == 'newmtl': cur = p[1]; mats[cur] = {'Kd': [0.8, 0.8, 0.8], 'Ks': 0.0, 'Ns': 10.0}
        elif cur and p[0] == 'Kd': mats[cur]['Kd'] = [float(v) for v in p[1:4]]
        elif cur and p[0] == 'Ks': mats[cur]['Ks'] = float(p[1])
        elif cur and p[0] == 'Ns': mats[cur]['Ns'] = float(p[1])
        elif cur and p[0] == 'd': mats[cur]['d'] = float(p[1])
    return mats


def read_obj(path):
    """Returns parts: [(name, material, [(pos, normal) x 3 per triangle])], in file order."""
    V, N, parts = [], [], []
    name, mat = 'part', None
    def part():
        if not parts or parts[-1][0] != name or parts[-1][1] != mat: parts.append((name, mat, []))
        return parts[-1][2]
    for line in open(path, encoding='utf-8'):
        p = line.split()
        if not p: continue
        if p[0] == 'v': V.append(tuple(float(x) for x in p[1:4]))
        elif p[0] == 'vn': N.append(tuple(float(x) for x in p[1:4]))
        elif p[0] in ('o', 'g'): name = ' '.join(p[1:]) or 'part'
        elif p[0] == 'usemtl': mat = p[1]
        elif p[0] == 'f':
            corners = []
            for c in p[1:]:
                bits = c.split('/')
                vi = int(bits[0]); ni = int(bits[2]) if len(bits) > 2 and bits[2] else 0
                corners.append((V[vi - 1 if vi > 0 else vi], N[ni - 1 if ni > 0 else ni] if ni else None))
            for k in range(1, len(corners) - 1):   # fan-triangulate quads / polygons
                tri = [corners[0], corners[k], corners[k + 1]]
                if any(n is None for _, n in tri):   # no normal given: use the face normal
                    a, b, c = (t[0] for t in tri)
                    u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
                    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
                    l = sum(x * x for x in n) ** .5 or 1; n = tuple(x / l for x in n)
                    tri = [(pt, nn or n) for pt, nn in tri]
                part().extend(tri)
    return parts


def gltf_material(name, m):
    shiny = max(0.0, min(1.0, m['Ks']))
    mat = {'name': name, 'pbrMetallicRoughness': {
        'baseColorFactor': [*[max(0.0, min(1.0, c)) for c in m['Kd']], m.get('d', 1.0)],
        'metallicFactor': round(0.55 * shiny if shiny > 0.6 else 0.1 * shiny, 3),
        'roughnessFactor': round(max(0.18, 1 - min(m['Ns'], 100) / 110), 3)}}
    if m.get('d', 1.0) < 1.0: mat['alphaMode'] = 'BLEND'
    if 'Visor' in name or 'Glass' in name or 'Window' in name: mat['pbrMetallicRoughness']['roughnessFactor'] = 0.12
    if name.lower() in ('sun', 'sunglow', 'engineglow', 'glow') or 'Glow' in name or name == 'Sun':
        mat['emissiveFactor'] = [max(0.0, min(1.0, c)) for c in m['Kd']]
    return mat


def write_glb(path, model_name, parts, mtl):
    buf = bytearray(); views, accessors, meshes, nodes, mats, mat_index = [], [], [], [], [], {}
    def add_view(data):
        while len(buf) % 4: buf.append(0)
        views.append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(data), 'target': 34962}); buf.extend(data)
        return len(views) - 1
    tris_total, mins, maxs = 0, [1e9] * 3, [-1e9] * 3
    for pname, mname, verts in parts:
        if not verts: continue
        if mname not in mat_index:
            mat_index[mname] = len(mats); mats.append(gltf_material(mname or 'Default', mtl.get(mname, {'Kd': [.8, .8, .8], 'Ks': 0, 'Ns': 10})))
        pos = bytearray(); nor = bytearray(); lo, hi = [1e9] * 3, [-1e9] * 3
        for p, n in verts:
            pos += struct.pack('<3f', *p); nor += struct.pack('<3f', *n)
            for i in range(3): lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
        for i in range(3): mins[i] = min(mins[i], lo[i]); maxs[i] = max(maxs[i], hi[i])
        accessors.append({'bufferView': add_view(pos), 'componentType': 5126, 'count': len(verts), 'type': 'VEC3', 'min': lo, 'max': hi})
        accessors.append({'bufferView': add_view(nor), 'componentType': 5126, 'count': len(verts), 'type': 'VEC3'})
        meshes.append({'name': pname, 'primitives': [{'attributes': {'POSITION': len(accessors) - 2, 'NORMAL': len(accessors) - 1}, 'material': mat_index[mname]}]})
        nodes.append({'name': pname, 'mesh': len(meshes) - 1})
        tris_total += len(verts) // 3
    nodes.append({'name': model_name, 'children': list(range(len(nodes)))})
    gltf = {'asset': {'version': '2.0', 'generator': 'Zhetalis build-space-pack.py', 'copyright': 'Zhetalis team - original artwork, free to reuse'},
            'scene': 0, 'scenes': [{'name': model_name, 'nodes': [len(nodes) - 1]}], 'nodes': nodes, 'meshes': meshes,
            'materials': mats, 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    while len(buf) % 4: buf.append(0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(buf), 0x004E4942)); f.write(buf)
    return tris_total, [round(v, 3) for v in mins], [round(v, 3) for v in maxs]


def main():
    if not os.path.isdir(MODELS): sys.exit(f'Space pack not found at {SRC}')
    os.makedirs(OUT, exist_ok=True); os.makedirs(KEEP, exist_ok=True)
    mtl = read_mtl(os.path.join(MODELS, 'SpacePalette.mtl'))
    manifest = []
    for fn in sorted(os.listdir(MODELS)):
        if not fn.endswith('.obj'): continue
        name = fn[:-4]; parts = read_obj(os.path.join(MODELS, fn))
        glb = os.path.join(OUT, name + '.glb')
        tris, lo, hi = write_glb(glb, name, parts, mtl)
        manifest.append({'name': name, 'file': f'assets/space-pack/{name}.glb', 'triangles': tris, 'parts': len(parts),
                         'partNames': sorted({p[0] for p in parts}), 'boundsMin': lo, 'boundsMax': hi, 'bytes': os.path.getsize(glb)})
        shutil.copy2(os.path.join(MODELS, fn), os.path.join(KEEP, fn))
        print(f'{name:28s} {tris:6d} triangles  {os.path.getsize(glb) / 1024:7.1f} KB')
    shutil.copy2(os.path.join(MODELS, 'SpacePalette.mtl'), os.path.join(KEEP, 'SpacePalette.mtl'))
    for extra in ('README.md', 'model-manifest.json', 'palette.json', 'unity-palette.json'):
        if os.path.exists(os.path.join(SRC, extra)): shutil.copy2(os.path.join(SRC, extra), os.path.join(KEEP, extra))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'source': 'Zhetalis Space Pack (team original artwork; README allows reuse and redistribution)',
                   'units': 'metres', 'up': 'Y', 'forward': '+Z', 'models': manifest}, f, indent=1)
    print(f'{len(manifest)} models -> {OUT}')


if __name__ == '__main__':
    main()
