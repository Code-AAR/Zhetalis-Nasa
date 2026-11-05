// Screen layout: Auto picks phone / tablet / desktop from the window size, or the player can force one.
// The choice puts a class on <body> (layout-phone, layout-tablet, layout-desktop) that style.css uses.
const KEY = 'ja-screen';
export const SCREEN_MODES = ['auto', 'phone', 'tablet', 'desktop'];
const NAMES = { auto: 'Auto', phone: 'Phone', tablet: 'Tablet', desktop: 'Desktop' };
export const screenName = m => NAMES[m];

let mode = 'auto';
try { const saved = localStorage.getItem(KEY); if (SCREEN_MODES.includes(saved)) mode = saved; } catch { /* storage blocked */ }
const listeners = [];

function autoLayout() {
  const w = innerWidth, h = innerHeight, short = Math.min(w, h);
  if (short < 560) return 'phone';                                                         // phones, either way round
  if ((matchMedia?.('(pointer: coarse)').matches && short <= 1100) || w <= 834) return 'tablet';   // iPads are 768-834 wide upright
  return 'desktop';
}
export const layout = () => (mode === 'auto' ? autoLayout() : mode);
export const screenMode = () => mode;

function apply() {
  const b = document.body, l = layout();
  for (const m of SCREEN_MODES) b.classList.toggle('layout-' + m, m === l);
  b.classList.toggle('portrait', innerHeight > innerWidth);
  listeners.forEach(fn => fn(mode, l));
}
export function setScreenMode(m) {
  mode = m;
  try { localStorage.setItem(KEY, m); } catch { /* storage blocked */ }
  apply();
}
export const nextScreenMode = () => setScreenMode(SCREEN_MODES[(SCREEN_MODES.indexOf(mode) + 1) % SCREEN_MODES.length]);
export const onLayout = fn => { listeners.push(fn); fn(mode, layout()); };

addEventListener('resize', apply);
apply();
