// A slow download is still allowed to finish. Only actual failures stop arrival.
export async function waitForBase(ready, { slowAfter = 60000 } = {}) {
  const panel = document.createElement('section'); panel.id = 'base-loading';
  panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
  Object.assign(panel.style, { position:'fixed', inset:'0', zIndex:'110', background:'#0b1119', color:'#f4f1e8', display:'grid', placeContent:'center', gap:'16px', padding:'24px', textAlign:'center', fontFamily:'system-ui' });
  panel.innerHTML = '<h2>Preparing your Mars base</h2><p>Downloading the full-quality habitat and walkway models…</p><button type="button">Back to menu</button>';
  const button = panel.querySelector('button');
  button.onclick = () => location.reload(); document.body.append(panel);
  const timer = setTimeout(() => {
    panel.querySelector('h2').textContent = 'Your base is still downloading';
    panel.querySelector('p').textContent = 'This connection is taking longer. We will continue automatically when the models are ready. You can also retry the download.';
    button.textContent = 'Retry download';
  }, slowAfter);
  try {
    await ready;
    panel.remove(); return true;
  } catch (error) {
    console.error('Mars base loading failed', error);
    panel.querySelector('h2').textContent = 'The base could not finish loading';
    panel.querySelector('p').textContent = error?.name === 'AssetLoadError'
      ? `Could not download ${error.asset} after several attempts. Check your connection and retry.`
      : 'The base could not finish setting up. Retry to restart it.';
    button.textContent = 'Retry'; return false;
  } finally { clearTimeout(timer); }
}
