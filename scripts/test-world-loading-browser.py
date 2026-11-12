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
 result=page.evaluate("""() => {
 const room=game.ghRoom, beds=Array.from({length:4},()=>({crop:'lettuce',grown:.5,ready:false,tank:10}));
 room.draw(beds,20,true);
 const plant=room.beds[0].plants.children[0].geometry;
 const tag=room.beds[0].sign.material.map;
 beds[0].tank=9;room.draw(beds,20,true);
 const waterStable=plant===room.beds[0].plants.children[0].geometry && tag===room.beds[0].sign.material.map;
 room.draw(beds,20,false);
 const powerStable=plant===room.beds[0].plants.children[0].geometry;
 beds[0].grown=.6;room.draw(beds,20,false);
 return {waterStable,powerStable,growthRebuilt:plant!==room.beds[0].plants.children[0].geometry};
 }""")
 print('GREENHOUSE',result)
 assert all(result.values()),result
 solar=page.evaluate("""() => {
 const w=game.world;
 w.setPanels(3);
 const panel=w.solar.panels[0], feet=panel.userData.feet;
 const point=panel.getWorldPosition(new (game.world.player.position.constructor)());
 const top=w.panelHeight(point.x,point.z,1000);
 return {feetAttached:feet.every(f=>f.parent===panel),surfaceFinite:Number.isFinite(top),top,feet:feet.length};
 }""")
 print('SOLAR',solar); assert solar['feetAttached'] and solar['surfaceFinite'],solar
 page.evaluate('game.renderer.render(game.world.scene,game.world.camera)')
 page.evaluate("game.world.settlement.layout.setSite('plains')")
 page.wait_for_timeout(3000)
 meteorite=page.evaluate("({fallback:game.world.settlement.layout.plainMeteorite.visible,label:game.world.settlement.layout.names.meteorite})")
 print('OPTIONAL_FAILURE',meteorite)
 assert meteorite['fallback'] and meteorite['label']=='Meteorite field',meteorite
 print('ERRORS',errors)
 assert not errors,errors

 b.close()
