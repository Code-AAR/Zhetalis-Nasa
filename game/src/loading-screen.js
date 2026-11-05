// Standalone brand layer. The engine still owns #loading.hidden, so this does
// not pretend that a fixed timer represents asset progress or delay fast loads.
export function mountLoadingScreen(element, { preview = false } = {}) {
  if (!element || element.classList.contains('hidden')) return () => {};
  element.classList.add('zhetalis-loading');
  element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite');
  element.innerHTML = `<img class="brand-mark" src="assets/zhetalis-mark.png" alt="" width="150" height="150">
    <div class="brand-word"><img src="assets/zhetalis-word.png" alt="Zhetalis" width="170" height="40"></div>
    <div class="brand-line" aria-hidden="true"><i></i></div>
    <p class="brand-status">Preparing your mission…</p>`;
  if (preview) return () => { element.classList.add('hidden'); };
  let finished = false, slowTimer;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finish = () => {
    if (finished) return;
    finished = true; observer.disconnect(); clearTimeout(slowTimer);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onError);
    element.setAttribute('aria-hidden', 'true');
    if (reduced.matches) return;
    element.classList.remove('hidden'); element.classList.add('is-leaving');
    const hide = () => element.classList.add('hidden');
    element.addEventListener('animationend', hide, { once: true });
    setTimeout(hide, 300); // Also finish if animation events are unavailable.
  };
  const observer = new MutationObserver(() => { if (element.classList.contains('hidden')) finish(); });
  observer.observe(element, { attributes: true, attributeFilter: ['class'] });
  const onError = () => {
    if (!finished) element.querySelector('.brand-status').textContent = 'The mission couldn’t finish loading. Reload the page to retry.';
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onError);
  slowTimer = setTimeout(() => {
    if (!finished) element.querySelector('.brand-status').textContent = 'Still preparing the mission. A slow connection can take a little longer.';
  }, 15000);
  return finish;
}

const loading = document.querySelector('#loading');
if (!loading?.hasAttribute('data-brand-preview')) mountLoadingScreen(loading);
