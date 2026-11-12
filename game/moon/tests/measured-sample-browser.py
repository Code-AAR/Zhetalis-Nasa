from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,json,threading,http.server,functools,tempfile
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[3]);parser.add_argument('--out',type=Path,default=Path(tempfile.mkdtemp(prefix='lunar-browser-')));args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/game/moon/'
# Existing moon index uses a base href to /game/.
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':720});errors=[];requests=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('request',lambda r: requests.append(r.url))
 page.goto(url+'?graphics=high',wait_until='networkidle',timeout=90000)
 page.wait_for_function('window.MoonMission',timeout=90000)
 assert not any('apollo-10017-15.glb' in u for u in requests),'Sample loaded in menu'
 page.evaluate("""async () => {const sim=await import('/game/moon/src/sim.js');const save=await import('/game/moon/src/save.js');save.writeSave(save.packSave({state:sim.newState(),player:{x:-22,y:0,z:21,yaw:0,place:'outside'},rover:{x:-12,y:0,z:-14,yaw:0}}));MoonMission.start('surface');}""")
 page.wait_for_function("MoonMission.three().world.apolloSample.group.userData.status==='ready'",timeout=90000)
 page.wait_for_function("MoonMission.debug().place==='outside'",timeout=90000)
 page.evaluate('MoonMission.teleport(-22,21)')
 page.wait_for_timeout(700)
 page.keyboard.press('KeyE');page.wait_for_timeout(300)
 text=page.locator('#modal').inner_text()
 assert '10017,15' in text and '20 times' in text and 'Mare Tranquillitatis' in text,text
 print('PANEL',text[:300])
 page.screenshot(path=str(args.out/'apollo-panel.png'))
 page.locator('#modal .choices button').first.click();page.wait_for_timeout(300)
 page.evaluate('MoonMission.teleport(-22,19.05)')
 state=page.evaluate("MoonMission.simulate(.5,[],60)")
 assert ((state['player']['x']+22)**2+(state['player']['z']-18)**2)**.5>=1.1,state
 stats=page.evaluate("""() => {const {world}=MoonMission.three();let triangles=0;world.apolloSample.group.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count>100000)triangles+=o.geometry.index.count/3;});return {triangles,status:world.apolloSample.group.userData.status,quality:MoonMission.debug().quality};}""")
 assert stats['triangles']==200000,stats
 assert sum('apollo-10017-15.glb' in u for u in requests)==1
 page.screenshot(path=str(args.out/'apollo-world.png'))
 print('PASS browser menu deferral, full high-detail mesh, E panel, collider, deduplicated load',json.dumps(stats))
 # Isolate failure handling without replaying startup or waiting on unrelated models.
 page.route('**/apollo-10017-15.glb',lambda route:route.fulfill(status=404,body='missing'))
 failure=page.evaluate("""async () => {const {createApolloSample}=await import('/game/moon/src/apollo-sample.js');const {THREE}=MoonMission.three();const scene=new THREE.Scene();const exhibit=createApolloSample(scene);const first=exhibit.load(),second=exhibit.load();const same=first===second;const result=await first;const state=exhibit.group.userData.status;exhibit.dispose();return {same,result,state,remaining:scene.children.length};}""")
 assert failure=={'same':True,'result':False,'state':'failed','remaining':0},failure
 print('PASS optional asset failure and cleanup',failure)
 print('PAGE_ERRORS',errors);assert not errors
 b.close()
server.shutdown()
