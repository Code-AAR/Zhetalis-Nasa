"""Fetch a native 512-square Gusev crop from NASA PDS MOLA MEGDR.
Standard library only. Source samples are signed big-endian metres above areoid.
No smoothing or invented elevations are baked into the delivered crop.
"""
from pathlib import Path
import urllib.request, struct, hashlib, json, datetime
ROOT=Path(__file__).resolve().parents[1]
BASE='https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/'
PRODUCT='megt00n090hb'
N=512; WIDTH=11520; LAT=-14.5692; LON=175.4729; PPD=128
ROW=int(-LAT*PPD)-N//2; COL=int((LON-90)*PPD)-N//2
start=ROW*WIDTH*2; end=(ROW+N)*WIDTH*2-1
label=urllib.request.urlopen(BASE+PRODUCT+'.lbl',timeout=45).read()
for expected in [b'MSB_INTEGER',b'11520',b'5632',b'METER']:
    assert expected in label, 'Unexpected PDS source format'
request=urllib.request.Request(BASE+PRODUCT+'.img',headers={'Range':f'bytes={start}-{end}'})
with urllib.request.urlopen(request,timeout=60) as response:
    status=response.status; content_range=response.headers.get('Content-Range',''); block=response.read()
if status==200:
    assert len(block)==5632*WIDTH*2
    block=block[start:end+1]
else:
    assert status==206 and content_range.startswith(f'bytes {start}-{end}/'),content_range
assert len(block)==N*WIDTH*2
values=[]
for row in range(N):
    offset=(row*WIDTH+COL)*2
    values.extend(struct.unpack('>'+str(N)+'h',block[offset:offset+N*2]))
assert min(values)>-10000 and max(values)<22000
raw=struct.pack('<'+str(N*N)+'h',*values)
out=ROOT/'game/assets/terrain';out.mkdir(parents=True,exist_ok=True)
(out/'gusev-mola-128.bin').write_bytes(raw)
(out/(PRODUCT+'.lbl')).write_bytes(label)
meta={'id':'MGS-M-MOLA-5-MEGDR-L3-V1.0','product':PRODUCT.upper()+'.IMG','source':BASE+PRODUCT+'.img','label':BASE+PRODUCT+'.lbl','sourcePage':'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html','retrieved':datetime.datetime.now(datetime.timezone.utc).isoformat(),'instrument':'Mars Global Surveyor MOLA','productDate':'2003-03-21','observations':'1997-09-15 to 2001-06-30 (source label coverage)','pixelsPerDegree':PPD,'sampleSpacingMetres':463,'n':N,'encoding':'signed-int16-little-endian','units':'metres above MOLA areoid','row':ROW,'column':COL,'north':-ROW/PPD,'south':-(ROW+N)/PPD,'west':90+COL/PPD,'east':90+(COL+N)/PPD,'minMetres':min(values),'maxMetres':max(values),'sha256':hashlib.sha256(raw).hexdigest(),'sourceStripSha256':hashlib.sha256(block).hexdigest(),'worldSpan':640,'verticalScale':.015,'flatBaseRadius':70,'flatBaseBlendEnd':115,'notes':'Native gridded altimetry, including interpolated bins in the NASA source. Map orientation: north is negative game Z, east positive X. 4 degrees of latitude/longitude compressed into a 640 m game square; height differences multiplied by 0.015. The central base is flattened with a smooth transition. Rocks, sand and buildings are illustrative.'}
(out/'gusev-mola-128.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps({'samples':len(values),'min':min(values),'max':max(values),'bytes':len(raw),'sha256':meta['sha256']}))
