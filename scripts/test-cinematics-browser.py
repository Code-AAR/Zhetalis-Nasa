"""Browser check for the Blender cutscenes (game/src/cinematic.js + game/animation/glb/).
Plays every film in the real game page, checks it draws, shows captions and skips cleanly, then checks that
Start plays the Ares VI briefing and the orbit plan before the launch countdown.
Usage: python scripts/test-cinematics-browser.py [screenshot folder]"""
from playwright.sync_api import sync_playwright
import functools, http.server, io, json, sys, threading
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None
FILMS = [('ares_vi_briefing', None), ('briefing_mission', None), ('launch_earth', None), ('cruise_loop', None), ('mars_approach', None),
         ('edl_mars', 'entry'), ('edl_mars', 'descent_landing'), ('outpost_26_months', None), ('dust_storm', None),
         ('failure_solar_panel', 'panel_failure'), ('failure_solar_panel', 'panel_repair'), ('failure_rover_stuck', 'rover_stuck'),
         ('failure_rover_stuck', 'rover_freed'), ('failure_air_leak', 'air_leak'), ('failure_air_leak', 'leak_patched'), ('ascent_mars', None)]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = b.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'warning' and ('Cutscene unavailable' in m.text or 'Crew could not load' in m.text) and errors.append(m.text))
    page.goto(f'http://127.0.0.1:{server.server_port}/game/#debug', wait_until='networkidle', timeout=90000)
    page.evaluate("async () => { window.__cine = await import('./src/cinematic.js'); }")
    for name, clip in FILMS:
        page.evaluate("([n, c]) => { window.__done = null; __cine.playCinematic(n, { clip: c }).then(r => window.__done = r); }", [name, clip])
        page.wait_for_selector('.cinematic canvas', timeout=60000)
        page.wait_for_timeout(3500)
        state = page.evaluate("() => ({ caption: document.querySelector('.cinematic .cine-cap').textContent, loading: !!document.querySelector('.cine-load') })")
        shot = page.screenshot()
        lum = Image.open(io.BytesIO(shot)).convert('L').resize((64, 36)).getextrema()
        state['contrast'] = lum[1] - lum[0]
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True); (SHOTS / f'{name}-{clip or "main"}.png').write_bytes(shot)
        page.keyboard.press('Escape')
        page.wait_for_function('window.__done !== null', timeout=10000)
        done = page.evaluate('window.__done')
        print('FILM', name, clip, json.dumps(state), 'skipped' if done else 'FAILED')
        assert done is True and not state['loading'] and state['contrast'] > 30, (name, clip, state)
        page.wait_for_timeout(500)
        assert not page.query_selector('.cinematic'), 'overlay left behind'
    # Start -> the briefing plays first, then the launch countdown
    page.goto(f'http://127.0.0.1:{server.server_port}/game/#debug', wait_until='networkidle', timeout=90000)
    page.click('#start')
    page.wait_for_selector('.cinematic canvas', timeout=60000)
    page.wait_for_timeout(2500)
    if SHOTS: page.screenshot(path=str(SHOTS / 'start-briefing.png'))
    assert page.is_hidden('#countdown'), 'countdown should wait for the briefing'
    page.keyboard.press('Escape')                       # Ares VI briefing -> the orbit plan
    page.wait_for_timeout(800)
    page.wait_for_selector('.cinematic canvas', timeout=60000)
    assert page.is_hidden('#countdown'), 'countdown should wait for the orbit plan too'
    page.keyboard.press('Escape')
    page.wait_for_selector('#countdown:not(.hidden)', timeout=20000)
    print('START: Ares VI briefing, orbit plan, then countdown')
    # phone: subtitles stay on screen, readable and short
    phone = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    phone.on('pageerror', lambda e: errors.append(str(e)))
    phone.goto(f'http://127.0.0.1:{server.server_port}/game/#debug', wait_until='networkidle', timeout=90000)
    phone.evaluate("async () => { const m = await import('./src/cinematic.js'); window.__p = m.playCinematic('failure_rover_stuck', { clip: 'rover_freed' }); }")
    phone.wait_for_selector('.cinematic canvas', timeout=60000)
    phone.wait_for_function("document.querySelector('.cinematic .cine-cap')?.textContent.length > 0", timeout=60000)
    cap = phone.evaluate("""() => { const c = document.querySelector('.cinematic .cine-cap'), r = c.getBoundingClientRect(), st = getComputedStyle(c);
      return { left: r.left, right: r.right, bottom: r.bottom, font: parseFloat(st.fontSize), lines: Math.round(r.height / (parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.3)) }; }""")
    if SHOTS: phone.screenshot(path=str(SHOTS / 'phone-caption.png'))
    print('PHONE caption', cap)
    assert cap['left'] >= 0 and cap['right'] <= 390 and cap['bottom'] <= 844 and cap['font'] >= 16 and cap['lines'] <= 4, cap
    phone.keyboard.press('Escape')
    assert not errors, errors
    print('All cutscenes load, draw, caption and skip; subtitles fit a phone.')
    b.close()
server.shutdown()
