"""Turns NASA's official SLS Block 1 3D-printing model into a light, coloured web model for the game.

Source (free, no copyright): NASA 3D Resources - "3D Printing/Space Launch System (SLS) Block 1"
https://github.com/nasa/NASA-3D-Resources

    python scripts/build-sls-model.py path/to/"Space Launch System (SLS) Block 1.stl"

What it does:
  1. Splits the single printed mesh into the real parts, so the game can drop them off in flight:
     core stage, left/right solid rocket boosters, upper stage (ICPS), Orion, launch abort tower.
  2. Colours them like the real rocket (orange core-stage foam, white boosters, dark engines).
  3. Shrinks it for school laptops (vertex clustering: nearby corners are merged).
  4. Saves game/assets/sls.glb in metres, Y up (98 m tall, like the real SLS Block 1 crew rocket).
"""
import json, struct, sys
from pathlib import Path
import numpy as np

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / 'game' / 'assets' / 'sls.glb'
GRID = 0.16          # metres: corners closer than this are merged
REAL_HEIGHT = 98.0   # SLS Block 1 (crew) is 98 m tall - NASA SLS fact sheet

data = src.read_bytes()
n = struct.unpack('<I', data[80:84])[0]
rec = np.frombuffer(data, dtype=np.dtype([('n', '<3f4'), ('v', '<9f4'), ('a', '<u2')]), count=n, offset=84)
tri = rec['v'].reshape(n, 3, 3).astype(np.float64)          # model units, Z up
tri = tri[tri.mean(axis=1)[:, 2] >= 4.4]                      # drop the flat 3D-printing stand under the rocket
n = len(tri)
c = tri.mean(axis=1); cx, cy, cz = c[:, 0], c[:, 1], c[:, 2]
Z0 = tri[:, :, 2].min()                                       # the bottom of the engines sits at height 0
scale = REAL_HEIGHT / (tri[:, :, 2].max() - Z0)

# --- which part is each triangle? (measured from the model: boosters sit at x = +-13.9, radius ~3.9) ---
BOOST_X, BOOST_R = 13.93, 4.6
dL = np.hypot(cx + BOOST_X, cy); dR = np.hypot(cx - BOOST_X, cy)
part = np.full(n, 'core', dtype=object)
part[(cz < 116) & (np.abs(cx) > 9.9) & (dL < BOOST_R)] = 'boosterL'
part[(cz < 116) & (np.abs(cx) > 9.9) & (dR < BOOST_R)] = 'boosterR'
part[(part == 'core') & (cz >= 144)] = 'upper'
part[(part == 'upper') & (cz >= 158)] = 'orion'
part[(part == 'orion') & (cz >= 180)] = 'las'

# --- colour (material) of each triangle ---
mat = np.full(n, 'white', dtype=object)
mat[(part == 'core') & (cz >= 5) & (cz < 138)] = 'orange'            # core stage foam insulation
mat[(cz < 12)] = 'dark'                                                # RS-25 engines + booster nozzles
# (Orion stays white: on launch day it sits under the white fairing of the launch abort system - see NASA's Artemis II launch photos)
mat[(part == 'core') & (cz >= 138)] = 'white'                          # adapter cone above the core stage
mat[(part == 'las') & (cz >= 196)] = 'dark'
for side, d in (('boosterL', dL), ('boosterR', dR)):                   # dark rings at the booster joints
    for zj in (22, 45, 68, 90):
        mat[(part == side) & (np.abs(cz - zj) < 1.0)] = 'dark'

SRGB = {'orange': '#d0652a', 'white': '#efefeb', 'dark': '#2a2b2f', 'silver': '#b8bcc2'}   # colours from NASA's launch photos
lin = lambda h: [round((int(h[i:i + 2], 16) / 255) ** 2.2, 4) for i in (1, 3, 5)] + [1]       # glTF wants linear colour
MATERIALS = {k: lin(v) for k, v in SRGB.items()}
mat_names = list(MATERIALS)

# Z-up model units -> Y-up metres
def to_world(p):
    return np.stack([p[..., 0], p[..., 2] - Z0, -p[..., 1]], axis=-1) * scale

def simplify(tris):
    """Vertex clustering: snap corners to a grid, merge, drop squashed triangles."""
    pts = to_world(tris).reshape(-1, 3)
    keys = np.round(pts / GRID).astype(np.int64)
    uniq, inv = np.unique(keys, axis=0, return_inverse=True)
    sums = np.zeros((len(uniq), 3)); np.add.at(sums, inv, pts)
    verts = sums / np.bincount(inv)[:, None]
    idx = inv.reshape(-1, 3)
    keep = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    idx = idx[keep]
    used, idx2 = np.unique(idx, return_inverse=True)
    return verts[used].astype(np.float32), idx2.reshape(-1, 3).astype(np.uint32)

# --- write a small glTF binary ---
bin_chunks, views, accessors, meshes, nodes = [], [], [], [], []
offset = 0
def add_view(arr, target):
    global offset
    b = arr.tobytes(); pad = (-len(b)) % 4
    bin_chunks.append(b + b'\0' * pad)
    views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(b), 'target': target})
    offset += len(b) + pad
    return len(views) - 1

total = 0
for name in ['core', 'boosterL', 'boosterR', 'upper', 'orion', 'las']:
    prims = []
    for m in mat_names:
        sel = (part == name) & (mat == m)
        if not sel.any(): continue
        v, i = simplify(tri[sel])
        if not len(i): continue
        total += len(i)
        accessors.append({'bufferView': add_view(v, 34962), 'componentType': 5126, 'count': len(v), 'type': 'VEC3',
                          'min': v.min(axis=0).tolist(), 'max': v.max(axis=0).tolist()})
        pa = len(accessors) - 1
        accessors.append({'bufferView': add_view(i.reshape(-1), 34963), 'componentType': 5125, 'count': i.size, 'type': 'SCALAR'})
        prims.append({'attributes': {'POSITION': pa}, 'indices': len(accessors) - 1, 'material': mat_names.index(m)})
    meshes.append({'name': name, 'primitives': prims})
    nodes.append({'name': name, 'mesh': len(meshes) - 1})

gltf = {
    'asset': {'version': '2.0', 'generator': 'Zhetalis build-sls-model.py', 'copyright': 'NASA 3D Resources (no copyright)'},
    'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
    'materials': [{'name': k, 'pbrMetallicRoughness': {'baseColorFactor': v, 'metallicFactor': 0.1 if k != 'silver' else 0.5, 'roughnessFactor': 0.7}} for k, v in MATERIALS.items()],
    'buffers': [{'byteLength': offset}], 'bufferViews': views, 'accessors': accessors,
}
js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
binary = b''.join(bin_chunks)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
out.write_bytes(glb)
print(f'{n} -> {total} triangles, {len(glb) / 1e6:.2f} MB -> {out}')
for name in ['core', 'boosterL', 'boosterR', 'upper', 'orion', 'las']: print(' ', name, int((part == name).sum()), 'source triangles')
