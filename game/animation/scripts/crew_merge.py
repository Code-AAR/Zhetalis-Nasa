"""Merge the game's crew animations (assets/crew/crew-anims.glb) into each crew character's GLB, retargeted the way
src/hab-crew.js does it at runtime: tracks are matched by plain bone name (Mixamo prefixes like mixamorig2 /
mixamorig7 removed) and every copy of a bone is driven, except copies nested directly inside a same-named bone.
Pure glTF data work (no rendering), so Blender's importer then builds proper armature actions.
Usage: python crew_merge.py OUT_DIR    -> OUT_DIR/ch22_anim.glb, ch23_anim.glb, ch48_anim.glb"""
import json, os, re, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CREW = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'crew')
norm = lambda n: re.sub(r'_\d+$', '', re.sub(r'^mixamorig\d*:?', '', n or ''))


def read_glb(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    off, j, binc = 12, None, b''
    while off < len(b):
        ln, typ = struct.unpack('<II', b[off:off + 8])
        chunk = b[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A: j = json.loads(chunk)
        elif typ == 0x004E4942: binc = chunk
        off += 8 + ln
    return j, bytearray(binc)


def write_glb(path, j, binc):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    binc = bytes(binc) + b'\0' * (-len(binc) % 4)
    total = 12 + 8 + len(js) + 8 + len(binc)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binc), 0x004E4942)); f.write(binc)


def merge(char_file, out_path):
    cj, cbin = read_glb(os.path.join(CREW, char_file))
    aj, abin = read_glb(os.path.join(CREW, 'crew-anims.glb'))
    # append the animation file's binary chunk; buffer 0 of each file is its GLB chunk
    base = len(cbin) + (-len(cbin) % 16)
    cbin += b'\0' * (base - len(cbin)) + abin
    buf_map = {}
    for i, bf in enumerate(aj.get('buffers', [])):
        if i == 0 and 'uri' not in bf and len(abin):
            buf_map[i] = 0
        else:                                   # meshopt fallback buffers (no data) and any others
            cj['buffers'].append(dict(bf)); buf_map[i] = len(cj['buffers']) - 1
    cj['buffers'][0]['byteLength'] = len(cbin)
    bv_map = {}
    for i, bv in enumerate(aj['bufferViews']):
        nb = json.loads(json.dumps(bv))
        nb['buffer'] = buf_map[bv['buffer']]
        if nb['buffer'] == 0: nb['byteOffset'] = nb.get('byteOffset', 0) + base
        ext = nb.get('extensions', {}).get('EXT_meshopt_compression')
        if ext:
            ext['buffer'] = buf_map[ext['buffer']]
            if ext['buffer'] == 0: ext['byteOffset'] = ext.get('byteOffset', 0) + base
        cj['bufferViews'].append(nb); bv_map[i] = len(cj['bufferViews']) - 1
    acc_map = {}
    for i, ac in enumerate(aj['accessors']):
        na = dict(ac)
        if 'bufferView' in na: na['bufferView'] = bv_map[na['bufferView']]
        cj['accessors'].append(na); acc_map[i] = len(cj['accessors']) - 1
    for e in aj.get('extensionsUsed', []):
        if e not in cj.setdefault('extensionsUsed', []): cj['extensionsUsed'].append(e)
    for e in aj.get('extensionsRequired', []):
        if e not in cj.setdefault('extensionsRequired', []): cj['extensionsRequired'].append(e)
    # which character nodes each plain bone name drives
    parent = {}
    for i, n in enumerate(cj['nodes']):
        for c in n.get('children', []): parent[c] = i
    targets = {}
    for i, n in enumerate(cj['nodes']):
        nm = n.get('name', '')
        if not nm.startswith('mixamorig'): continue
        p = parent.get(i)
        if p is not None and norm(cj['nodes'][p].get('name')) == norm(nm): continue
        targets.setdefault(norm(nm), []).append(i)
    anims = []
    for a in aj.get('animations', []):
        samplers, channels = [], []
        for ch in a['channels']:
            src = aj['nodes'][ch['target']['node']].get('name', '')
            for t in targets.get(norm(src), []):
                s = dict(a['samplers'][ch['sampler']])
                s['input'] = acc_map[s['input']]; s['output'] = acc_map[s['output']]
                samplers.append(s)
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': t, 'path': ch['target']['path']}})
        if channels:
            anims.append({'name': a['name'], 'samplers': samplers, 'channels': channels})
    cj['animations'] = anims
    write_glb(out_path, cj, cbin)
    return [a['name'] for a in anims]


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for f in ('ch22.glb', 'ch23.glb', 'ch48.glb'):
        print(f, merge(f, os.path.join(out, f.replace('.glb', '_anim.glb'))))
