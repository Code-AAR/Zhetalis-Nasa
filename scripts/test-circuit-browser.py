"""Browser check for the realistic power kit and polarity wiring, plus the Hohmann transfer diagram.
- Wiring: red + must go first, + to - is refused with the reverse-polarity lesson, one lead alone leaves the circuit open,
  and only both leads advance the mission (Solar array OUT -> Battery controller IN).
- Models: the field battery cabinet and the workbench parts load from assets/power.
- Orbit: the mission briefing's Timing step draws the to-scale Hohmann transfer.
Usage: python scripts/test-circuit-browser.py [screenshot folder]"""
from playwright.sync_api import sync_playwright
import base64, functools, http.server, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = b.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/game/#debug', wait_until='networkidle', timeout=90000)
    page.route('**/block-island.stl', lambda r: r.abort())
    page.click('#start')
    for _ in range(2):                                    # skip the Ares VI briefing and the orbit plan
        page.wait_for_selector('.cinematic canvas', timeout=90000); page.wait_for_timeout(600); page.keyboard.press('Escape'); page.wait_for_timeout(900)
    page.wait_for_function('window.game?.construction && window.game.world?.settlement', timeout=180000)
    info = page.evaluate("""async () => {
      const THREE = await import('three');
      const c = game.construction, o = game.outpost, w = game.world, msgs = [];
      c.guide = m => msgs.push(m);
      o.powerStep = 5; c.blocked = false;
      const pack = w.settlement.pack.position;
      w.player.position.set(pack.x, w.player.position.y, pack.z + 3);
      c.update(false, null, false); c.blocked = false;
      const sock = id => c.sockets.find(s => s.userData.id === id);
      const use = (id, pole) => { const post = sock(id).userData.posts[pole]; c.hit = { object: post, point: post.getWorldPosition(new THREE.Vector3()) }; c.blocked = false; return c.use(); };
      const log = [];
      use('solar-out', '-'); log.push(['minus first', msgs.at(-1)]);
      use('solar-out', '+'); log.push(['held', c.wire, c.pole]);
      use('battery-in', '-'); log.push(['reverse', msgs.at(-1), c.wire]);
      use('battery-in', '+'); log.push(['open circuit', msgs.at(-1), o.powerStep]);
      use('solar-out', '-'); use('battery-in', '-'); log.push(['closed', msgs.at(-1), o.powerStep]);
      await new Promise(r => setTimeout(r, 3000));                        // battery cabinet model
      c.update(false, null, false);
      const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540;
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      const cam = new THREE.PerspectiveCamera(45, 16 / 9, .05, 500), shots = [];
      w.settlement.pack.visible = true;
      cam.position.set(pack.x - 1.6, pack.y + 1.3, pack.z + 3.2); cam.lookAt(pack.x - .2, pack.y + .1, pack.z + .3); r.render(w.scene, cam); shots.push(cv.toDataURL('image/jpeg', .85));
      const cabinet = w.settlement.pack.children.length > 0;
      const cables = [...c.cables.keys()];
      // workbench with the real parts
      c.begin('battery'); c.bench.visible = true; await new Promise(r => setTimeout(r, 3000));
      const benchModels = c.slots.filter(m => m.userData.kind === 'part' && m.children.some(ch => ch.userData.sharedAsset)).length;
      const iscene = game.interior.scene; iscene.updateMatrixWorld(true);
      const bp = c.bench.getWorldPosition(new THREE.Vector3());
      cam.position.set(bp.x, bp.y + .75, bp.z + 1.05); cam.lookAt(bp.x, bp.y + .05, bp.z + .1); r.render(iscene, cam); shots.push(cv.toDataURL('image/jpeg', .85));
      // orbit diagram
      const { JourneyVisual } = await import('./src/journey-visual.js');
      const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:540px;z-index:99999;background:#05070c';
      const canvas = document.createElement('canvas'); canvas.id = 'orbit-test'; canvas.style.cssText = 'width:100%;height:100%'; holder.append(canvas); document.body.append(holder);
      const jv = new JourneyVisual(canvas); jv.setMode('transfer'); window._jv = jv;
      return { log, cabinet, cables, benchModels, shots, routeLines: jv.route.children.length };
    }""")
    page.wait_for_timeout(2500)
    orbit = page.locator('#orbit-test').screenshot()
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        for i, s in enumerate(info['shots']):
            (SHOTS / f'circuit_{i}.jpg').write_bytes(base64.b64decode(s.split(',')[1]))
        (SHOTS / 'orbit.png').write_bytes(orbit)
    for row in info['log']: print(*row)
    print('cabinet', info['cabinet'], 'cables', info['cables'], 'bench models', info['benchModels'], 'orbit lines', info['routeLines'])
    log = {row[0]: row for row in info['log']}
    assert 'red + lead first' in log['minus first'][1]
    assert log['held'][1:] == ['solar-out', '+']
    assert 'that is + to' in log['reverse'][1] and log['reverse'][2] == 'solar-out'
    assert 'circuit is open' in log['open circuit'][1] and log['open circuit'][2] == 5
    assert 'Loop closed' in log['closed'][1] and log['closed'][2] == 6
    assert info['cabinet'] and set(info['cables']) >= {'0+', '0-'}
    assert info['benchModels'] == 3, info['benchModels']
    assert info['routeLines'] >= 6
    assert not errors, errors
    print('Polarity wiring, power-kit models and Hohmann diagram work.')
    b.close()
server.shutdown()
