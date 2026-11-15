// Keeps the frame rate smooth: if the game runs slowly the picture is drawn at a slightly lower
// resolution, and it climbs back to full sharpness when the computer has spare time.
// Only the pixel count changes. Nothing in the game itself moves or looks different.
export function createAdaptiveRes(renderer, target, { min = 0.6, slowMs = 24, fastMs = 17, enabled = () => true } = {}) {
  let avg = 16.7, last = performance.now(), scale = 1, holdUntil = 0, slowFor = 0, fastFor = 0;
  const apply = () => renderer.setPixelRatio(Math.max(0.5, target() * scale));
  return {
    reset() { scale = 1; slowFor = fastFor = 0; apply(); },
    get scale() { return scale; },
    tick() {
      const now = performance.now(), ms = Math.min(now - last, 250); last = now;
      if (!enabled() || document.hidden || ms > 200) { slowFor = fastFor = 0; return; }   // ignore pauses, tab switches and loading hitches
      avg += (ms - avg) * 0.08;
      if (now < holdUntil) return;
      if (avg > slowMs) { slowFor += ms; fastFor = 0; } else if (avg < fastMs) { fastFor += ms; slowFor = 0; } else slowFor = fastFor = 0;
      if (slowFor > 1200 && scale > min) { scale = Math.max(min, scale * 0.88); holdUntil = now + 1500; slowFor = 0; apply(); }
      else if (fastFor > 4000 && scale < 1) { scale = Math.min(1, scale * 1.07); holdUntil = now + 2500; fastFor = 0; apply(); }
    },
  };
}
