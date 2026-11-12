from playwright.sync_api import sync_playwright
import json,threading,http.server,functools
from pathlib import Path
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(Path(__file__).resolve().parents[1])))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':720})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/game/#debug',wait_until='networkidle',timeout=90000)
 page.route('**/block-island.stl',lambda route:route.abort())
 page.click('#start')
 page.wait_for_function('window.game?.world?.settlement',timeout=120000)
 print('BASE_READY',page.evaluate('({render:game.renderer.info.render,memory:game.renderer.info.memory})'))
 result=page.evaluate("""()=>{
 const w=game.world,all=w.colliders,ores=all.filter(c=>c.oreContact),V=w.player.position.constructor;
 let tops=0,clear=0,blocked=0;const failures=[];
 try{for(const c of ores){
  w.colliders=[c];const top=w.oreHeight(c.x,c.z,1000);
  if(Number.isFinite(top))tops++;else failures.push('missing top');
  const above=new V(c.x,top+.15,c.z),previous=new V(c.x-3,top+.15,c.z);
  w.collide(above,previous,false);if(Math.abs(above.x-c.x)<1e-6)clear++;else failures.push('air blocked');
  const p=new V(c.x,top-.7,c.z),prev=new V(c.x-3,top-.7,c.z);
  w.collide(p,prev,false);if(p.x<c.x-.01)blocked++;
  if(w.oreHeight(c.x,c.z,top-.01)!==-Infinity)failures.push('snapped from under rock');
 }}finally{w.colliders=all;}
 return {ores:ores.length,tops,clear,blocked,failures};
 }""")
 print('ORE_CONTACT',result,flush=True)
 assert result['ores']>0 and result['tops']==result['ores'] and result['clear']==result['ores'] and not result['failures']
 assert result['blocked']>0
 print('ERRORS',errors,flush=True);assert not errors
 b.close()

