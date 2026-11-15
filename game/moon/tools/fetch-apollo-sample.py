"""Download NASA ARES sample 10017,15 and losslessly repack its web mesh as GLB.
Python standard library only. No mesh simplification or texture resizing.
"""
import argparse, array, hashlib, json, math, struct, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE='https://ares-a3d.s3.us-gov-east-1.amazonaws.com/samples/10017-15/'
META=BASE+'10017-15_A3D_EXPLORER_metadata.json'

def convert(obj, jpg):
    if not obj.startswith(b'# [Unit:Meter]'): raise ValueError('Unexpected source units')
    pos=[]; uv=[]; normals=[]; vertices=[]; tex=[]; norms=[]; indices=[]; lookup={}
    for line in obj.decode().splitlines():
        s=line.split()
        if not s: continue
        if s[0]=='v': pos.append(tuple(map(float,s[1:4])))
        elif s[0]=='vt': uv.append(tuple(map(float,s[1:3])))
        elif s[0]=='vn': normals.append(tuple(map(float,s[1:4])))
        elif s[0]=='f':
            if len(s)!=4: raise ValueError('Expected triangles')
            for item in s[1:]:
                key=tuple(int(i)-1 for i in item.split('/'))
                if len(key) not in (2,3) or min(key)<0: raise ValueError('Expected positive position/UV indices')
                if key not in lookup:
                    lookup[key]=len(lookup); vertices.extend(pos[key[0]]); tex.extend((uv[key[1]][0],1-uv[key[1]][1]))
                    if len(key)==3: norms.extend(normals[key[2]])
                indices.append(lookup[key])
    if not normals:
        # Smooth normals accumulated on source positions, including across UV seams.
        sums=[[0.0,0.0,0.0] for _ in pos]; keys=list(lookup)
        for start in range(0,len(indices),3):
            ids=[keys[i][0] for i in indices[start:start+3]]; a,b,c=[pos[i] for i in ids]
            u=[b[i]-a[i] for i in range(3)]; v=[c[i]-a[i] for i in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            for i in ids:
                for k in range(3): sums[i][k]+=n[k]
        for key in keys:
            n=sums[key[0]]; length=math.sqrt(sum(v*v for v in n)) or 1
            norms.extend(v/length for v in n)
    blob=bytearray(); views=[]; accessors=[]
    def block(data, target=None):
        while len(blob)%4: blob.append(0)
        v={'buffer':0,'byteOffset':len(blob),'byteLength':len(data)}
        if target: v['target']=target
        views.append(v); blob.extend(data); return len(views)-1
    def attr(values, code, kind, size, target):
        a=array.array(code,values)
        if sys.byteorder!='little': a.byteswap()
        acc={'bufferView':block(a.tobytes(),target),'componentType':5126 if code=='f' else 5125,'count':len(values)//size,'type':kind}
        if kind=='VEC3':
            acc['min']=[min(values[i::size]) for i in range(size)]; acc['max']=[max(values[i::size]) for i in range(size)]
        accessors.append(acc); return len(accessors)-1
    pi=attr(vertices,'f','VEC3',3,34962); ni=attr(norms,'f','VEC3',3,34962); ti=attr(tex,'f','VEC2',2,34962); ii=attr(indices,'I','SCALAR',1,34963)
    image=block(jpg)
    gltf={'asset':{'version':'2.0','generator':'NASA ARES OBJ lossless float32/UV/normal repack; metres'},'scene':0,'scenes':[{'nodes':[0]}],
        'nodes':[{'mesh':0,'name':'Apollo 11 sample 10017,15'}],
        'meshes':[{'primitives':[{'attributes':{'POSITION':pi,'NORMAL':ni,'TEXCOORD_0':ti},'indices':ii,'material':0}]}],
        'materials':[{'name':'Original NASA photogrammetry texture','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':1}}],
        'textures':[{'source':0}], 'images':[{'bufferView':image,'mimeType':'image/jpeg'}],
        'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(blob)}]}
    j=json.dumps(gltf,separators=(',',':')).encode(); j+=b' '*((-len(j))%4); blob+=b'\0'*((-len(blob))%4)
    result=struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
    return result,dict(triangles=len(indices)//3,vertices=len(lookup),sourceVertices=len(pos),boundsMetres={'min':accessors[pi]['min'],'max':accessors[pi]['max']})

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--out',required=True,type=Path); ap.add_argument('--cache',type=Path); a=ap.parse_args()
    get=lambda url: urllib.request.urlopen(url,timeout=120).read()
    metadata=json.loads(get(META)); folder=BASE+metadata['mesh_foldername']+'/'
    objurl=folder+metadata['mesh_filename']; texurl=folder+metadata['texture_filename']
    obj=(a.cache/'apollo-10017-15.obj').read_bytes() if a.cache else get(objurl)
    jpg=(a.cache/'apollo-10017-15.jpg').read_bytes() if a.cache else get(texurl)
    glb,stats=convert(obj,jpg)
    provenance=dict(sample='10017,15',mission='Apollo 11',collected='LM Site, Mare Tranquillitatis',
        classification='High-Ti, High-K Ilmenite Basalt',credit='NASA / ARES / Astromaterials 3D',
        source='https://ares.jsc.nasa.gov/astromaterials3d/sample-details.htm?sample=10017-15',
        metadata=META,mesh=objurl,texture=texurl,retrieved=datetime.now(timezone.utc).isoformat(),
        objSha256=hashlib.sha256(obj).hexdigest(),textureSha256=hashlib.sha256(jpg).hexdigest(),glbSha256=hashlib.sha256(glb).hexdigest(),
        conversion='All source triangles and UV seams retained; OBJ bottom-origin V converted to glTF top-origin V; source has no normals, so area-weighted smooth normals generated across UV seams; original JPEG embedded unchanged; no decimation or texture resizing.',
        display='20x linear enlargement of the metre-unit source. Imported educational replica at the south-pole training base, not a locally discovered rock.',**stats)
    a.out.mkdir(parents=True,exist_ok=True); (a.out/'apollo-10017-15.glb').write_bytes(glb)
    (a.out/'apollo-10017-15.json').write_text(json.dumps(provenance,indent=2)+'\n'); print(json.dumps(stats))
if __name__=='__main__': main()
