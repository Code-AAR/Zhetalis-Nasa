from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,threading,http.server,functools,tempfile
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[3]);parser.add_argument('--out',type=Path,default=Path(tempfile.mkdtemp(prefix='apollo-mission-')));args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.root)));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1100,'height':850},reduced_motion='reduce');errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.goto(f'http://127.0.0.1:{server.server_port}/game/moon/tests/apollo-mission-harness.html',wait_until='networkidle')
 assert not any('.glb' in r for r in requests)
 page.get_by_role('button',name='Lunar survey & history',exact=True).click()
 page.get_by_role('button',name='Fly Apollo mission',exact=True).click()
 page.wait_for_selector('[data-stage][data-mission-phase="pad"]',timeout=60000)
 assert page.locator('[data-mission-pause]').inner_text()=='Play'
 assert 'not Artemis' in page.locator('[data-note]').inner_text()
 for file in ['saturn-v-history.glb','apollo-lunar-module.glb']:assert sum(file in r for r in requests)==1
 page.screenshot(path=str(args.out/'apollo-pad.png'))
 for phase in ['launch','coast','descent','landed']:
  page.get_by_role('button',name='Next stage',exact=True).click()
  page.wait_for_selector(f'[data-stage][data-mission-phase="{phase}"]')
  if phase=='descent':page.screenshot(path=str(args.out/'apollo-descent.png'))
 page.get_by_role('button',name='Replay',exact=True).click();assert page.locator('[data-stage]').get_attribute('data-mission-phase')=='pad'
 # Exercise the real animation loop all the way through, not only stage jumps.
 page.get_by_role('button',name='Play',exact=True).click()
 page.wait_for_selector('[data-stage][data-mission-phase="launch"]',timeout=15000)
 page.wait_for_selector('[data-stage][data-mission-phase="descent"]',timeout=30000)
 page.wait_for_selector('[data-stage][data-mission-phase="landed"]',timeout=25000)
 page.get_by_role('button',name='Play again',exact=True).wait_for(timeout=10000)
 page.get_by_role('button',name='Play again',exact=True).click();page.get_by_role('button',name='Pause',exact=True).click()
 page.get_by_role('button',name='Back to model viewer',exact=True).click()
 page.wait_for_selector('[data-tools]:not([hidden])',timeout=60000)
 assert page.locator('[data-title]').inner_text().startswith('Apollo ·')
 assert page.locator('[data-mission-tools]').is_hidden()
 page.locator('[data-exhibit="lro"]').click();page.wait_for_selector('[data-tools]:not([hidden])',timeout=60000)
 assert page.locator('[data-survey]').is_visible()
 page.get_by_role('button',name='Back to missions',exact=True).click();assert page.locator('dialog').count()==0
 # A forced model failure is recoverable, and close cancels an in-flight request.
 page.route('**/saturn-v-history.glb',lambda route:route.fulfill(status=404,body='missing'))
 page.get_by_role('button',name='Lunar survey & history',exact=True).click();page.get_by_role('button',name='Fly Apollo mission',exact=True).click()
 page.wait_for_selector('[data-stage][data-mission-phase="failed"]',timeout=60000)
 assert 'could not load' in page.locator('[data-status]').inner_text()
 page.locator('[data-exhibit="apollo"]').click();page.wait_for_selector('[data-tools]:not([hidden])',timeout=60000)
 page.get_by_role('button',name='Back to missions',exact=True).click()
 page.unroute('**/saturn-v-history.glb');pending=[]
 # Close while the second model loads, after the first model already allocated GPU resources.
 page.route('**/apollo-lunar-module.glb',lambda route:pending.append(route))
 page.get_by_role('button',name='Lunar survey & history',exact=True).click();page.get_by_role('button',name='Fly Apollo mission',exact=True).click()
 for _ in range(100):
  if pending:break
  page.wait_for_timeout(100)
 assert pending,'Did not reach pending Lunar Module request'
 page.get_by_role('button',name='Back to missions',exact=True).click()
 for route in pending:
  try:route.abort()
  except Exception:pass
 page.wait_for_timeout(200);assert page.locator('dialog').count()==0
 assert not errors,errors
 print('PASS actual Saturn V + Apollo LM, stage transitions, reduced motion, pause/replay, viewer restore, LRO preserved, failure recovery, cancellation; screenshots',args.out)
 b.close()
server.shutdown()
