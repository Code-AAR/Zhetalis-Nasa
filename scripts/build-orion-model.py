"""Turns NASA's official Orion Capsule 3D-printing model into a light, coloured web model for the game.

Source (free, no copyright): NASA 3D Resources - "3D Printing/Orion Capsule/Orion Capsule (no fbc).stl"
https://github.com/nasa/NASA-3D-Resources

    python scripts/build-orion-model.py path/to/"Orion Capsule (no fbc).stl"

What it does:
  1. Scales it to the real Orion crew module: 5.02 m across the heat shield (NASA Orion reference guide).
  2. Colours it like the real capsule: silver backshell, brown Avcoat heat shield underneath, dark docking ring on top.
  3. Shrinks it for school laptops (vertex clustering: nearby corners are merged).
  4. Saves game/assets/orion.glb in metres, Y up, with the bottom of the heat shield at height 0.
"""
import json, struct, sys
from pathlib import Path
import numpy as np

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / 'game' / 'assets' / 'orion.glb'
GRID = 0.035          # metres: corners closer than this are merged
REAL_DIAMETER = 5.02  # Orion crew module, widest point (heat shield)

data = src.read_bytes()
n = struct.unpack('<I', data[80:84])[0]
rec = np.frombuffer(data, dtype=np.dtype([('n', '<3f4'), ('v', '<9f4'), ('a', '<u2')]), count=n, offset=84)
tri = rec['v'].reshape(n, 3, 3).astype(np.float64)            # model units, already Y up
pts = tri.reshape(-1, 3)
scale = REAL_DIAMETER / (pts[:, 0].max() - pts[:, 0].min())
Y0, cx0, cz0 = pts[:, 1].min(), (pts[:, 0].max() + pts[:, 0].min()) / 2, (pts[:, 2].max() + pts[:, 2].min()) / 2
tri = np.stack([tri[..., 0] - cx0, tri[..., 1] - Y0, tri[..., 2] - cz0], axis=-1) * scale
H = tri[..., 1].max()

# --- colour (material) of each triangle, from its height and which way it faces ---
c = tri.mean(axis=1)
nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
mat = np.full(n, 'silver', dtype=object)
mat[(c[:, 1] < 0.9) & (nrm[:, 1] < -0.2)] = 'shield'          # the heat shield underneath
mat[c[:, 1] > H - 0.75] = 'dark'                               # docking ring and the parachute bay on top

SRGB = {'silver': '#c7cacf', 'shield': '#6b5544', 'dark': '#3a3c42'}   # colours from NASA's Artemis photos
lin = lambda h: [round((int(h[i:i + 2], 16) / 255) ** 2.2, 4) for i in (1, 3, 5)] + [1]   # glTF wants linear colour

def simplify(tris):
    """Vertex clustering: snap corners to a grid, merge, drop squashed triangles."""
    p = tris.reshape(-1, 3)
    keys = np.round(p / GRID).astype(np.int64)
    uniq, inv = np.unique(keys, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    sums = np.zeros((len(uniq), 3)); np.add.at(sums, inv, p)
    verts = sums / np.bincount(inv)[:, None]
    idx = inv.reshape(-1, 3)
    keep = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    idx = idx[keep]
    used, idx2 = np.unique(idx, return_inverse=True)
    return verts[used].astype(np.float32), idx2.reshape(-1, 3).astype(np.uint32)

bin_chunks, views, accessors, prims = [], [], [], []
offset = 0
def add_view(arr, target):
    global offset
    b = arr.tobytes(); pad = (-len(b)) % 4
    bin_chunks.append(b + b'\0' * pad)
    views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(b), 'target': target})
    offset += len(b) + pad
    return len(views) - 1

names = list(SRGB); total = 0
for m in names:
    sel = mat == m
    if not sel.any(): continue
    v, i = simplify(tri[sel])
    total += len(i)
    accessors.append({'bufferView': add_view(v, 34962), 'componentType': 5126, 'count': len(v), 'type': 'VEC3',
                      'min': v.min(axis=0).tolist(), 'max': v.max(axis=0).tolist()})
    pa = len(accessors) - 1
    accessors.append({'bufferView': add_view(i.reshape(-1), 34963), 'componentType': 5125, 'count': i.size, 'type': 'SCALAR'})
    prims.append({'attributes': {'POSITION': pa}, 'indices': len(accessors) - 1, 'material': names.index(m)})

gltf = {
    'asset': {'version': '2.0', 'generator': 'Zhetalis build-orion-model.py', 'copyright': 'NASA 3D Resources (no copyright)'},
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'orion', 'mesh': 0}],
    'meshes': [{'name': 'orion', 'primitives': prims}],
    'materials': [{'name': k, 'pbrMetallicRoughness': {'baseColorFactor': lin(v), 'metallicFactor': 0.35 if k == 'silver' else 0.05, 'roughnessFactor': 0.6}} for k, v in SRGB.items()],
    'buffers': [{'byteLength': offset}], 'bufferViews': views, 'accessors': accessors,
}
js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
binary = b''.join(bin_chunks)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
out.write_bytes(glb)
print(f'{n} -> {total} triangles, {len(glb) / 1e6:.2f} MB, {H:.2f} m tall -> {out}')
