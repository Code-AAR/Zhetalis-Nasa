"""Browser check for the gameplay suit and mining: the player wears NASA's Z-2 suit (skinned, posed by suit.js),
holds the new rock pick, and a swing runs wind-up -> strike -> recoil with rock chips and dust at the ore.
Renders third-person frames through a separate renderer so the running game is untouched.
Usage: python scripts/test-mining-suit-browser.py [screenshot folder]"""
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
    page.wait_for_function('window.game?.world?.settlement && window.game.world.suit', timeout=180000)
    info = page.evaluate("""async () => {
      const THREE = await import('three');
      const { makeTool } = await import('./src/colony.js');
      const w = game.world, dep = game.colony.deposits[0];
      w.holdTool(makeTool('pickaxe'), makeTool('pickaxe', true));
      await new Promise(r => setTimeout(r, 2500));                         // let the rock pick model load
      const p = w.player.position; p.set(dep.x - 1.3, p.y, dep.z); w.yaw = -Math.PI / 2;
      w.firstPerson = false;
      for (let i = 0; i < 20; i++) w.update(1 / 30, false);
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.toneMapping = THREE.ACESFilmicToneMapping;
      const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 500);
      const shots = [];
      const shoot = () => { const q = w.player.position; cam.position.set(q.x - 0.6, q.y + 1.4, q.z + 3.4); cam.lookAt(q.x + 0.5, q.y + 1.0, q.z); r.render(w.scene, cam); shots.push(canvas.toDataURL('image/png')); };
      shoot();
      let struck = false;
      w.swingTool(() => { struck = true; w.mineImpact(new THREE.Vector3(dep.x - 0.4, dep.group.position.y + 0.6, dep.z), '#8e98a8'); });
      const stops = [0.3, 0.52, 0.6, 0.75];
      for (const s of stops) { while (w.toolSwing >= 0 && w.toolSwing < s) { w.updateSwing(1 / 60); w.update(1 / 60, false); } shoot(); }
      return { model: w.suit.model || 'classic', struck, chips: (w.impacts || []).length, shots };
    }""")
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        for i, s in enumerate(info['shots']):
            (SHOTS / f'mining_{i}.png').write_bytes(base64.b64decode(s.split(',')[1]))
    print('SUIT', info['model'], 'STRUCK', info['struck'], 'IMPACT PARTICLES', info['chips'])
    assert info['model'] == 'z2', 'player should wear the Z-2 suit'
    assert info['struck'] and info['chips'] > 0, 'the swing should strike and throw chips'
    assert not errors, errors
    print('Z-2 suit, rock pick and mining swing work.')
    b.close()
server.shutdown()
