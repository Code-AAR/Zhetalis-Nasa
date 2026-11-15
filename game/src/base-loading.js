// A slow download is still allowed to finish. Only actual failures stop arrival.
// trip: the journey to Mars doubles as the loading screen: the cruise animation (animation/glb/cruise_loop.glb)
// plays behind the panel, and it stays up at least minMs so the trip is seen even when everything loads at once.
import { loopCinematic } from './cinematic.js';
export async function waitForBase(ready, { slowAfter = 60000, trip = false, minMs = 0, title } = {}) {
  const panel = document.createElement('section'); panel.id = 'base-loading';
  panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
  Object.assign(panel.style, { position:'fixed', inset:'0', zIndex:'110', background:'#0b1119', color:'#f4f1e8', display:'grid', placeContent:'center', gap:'16px', padding:'24px', textAlign:'center', fontFamily:'system-ui' });
  panel.innerHTML = '<h2>Preparing your Mars base</h2><p>Downloading the full-quality habitat and walkway models…</p><button type="button">Back to menu</button>';
  let loop = null;
  if (trip) {
    Object.assign(panel.style, { background: '#000', placeContent: 'start center', paddingTop: 'max(24px, 8vh)' });
    panel.querySelector('h2').textContent = title || 'On the way to Mars';
    panel.querySelector('p').textContent = 'The trip takes about 8 months. Loading your base…';
    loop = loopCinematic('cruise_loop', panel);
  }
  const shown = performance.now();
  const button = panel.querySelector('button');
  button.onclick = () => location.reload(); document.body.append(panel);
  const timer = setTimeout(() => {
    panel.querySelector('h2').textContent = 'Your base is still downloading';
    panel.querySelector('p').textContent = 'This connection is taking longer. We will continue automatically when the models are ready. You can also retry the download.';
    button.textContent = 'Retry download';
  }, slowAfter);
  try {
    await ready;
    const wait = minMs - (performance.now() - shown);
    if (wait > 0) { panel.querySelector('p').textContent = 'Base ready. Approaching Mars…'; await new Promise(r => setTimeout(r, wait)); }
    loop?.stop(); panel.remove(); return true;
  } catch (error) {
    console.error('Mars base loading failed', error);
    panel.querySelector('h2').textContent = 'The base could not finish loading';
    panel.querySelector('p').textContent = error?.name === 'AssetLoadError'
      ? `Could not download ${error.asset} after several attempts. Check your connection and retry.`
      : 'The base could not finish setting up. Retry to restart it.';
    button.textContent = 'Retry'; loop?.stop(); return false;
  } finally { clearTimeout(timer); }
}
