// Touch screens: keep alerts just under whatever is at the top of the screen (the meters on the left, the
// Sol panel on the right), whatever the device and however many rows the meters wrap into.
// Sets the CSS variable --top-clear on <body>; phone.css uses it.
const hud = document.getElementById('hud');
function measure() {
  if (!hud || hud.classList.contains('hidden')) return;
  const meters = hud.querySelector('.meters'), status = hud.querySelector('.status');
  let bottom = 0;
  if (meters) bottom = Math.max(bottom, meters.getBoundingClientRect().bottom);
  if (status && !hud.classList.contains('menu-open')) bottom = Math.max(bottom, status.getBoundingClientRect().bottom);
  if (bottom > 0) document.body.style.setProperty('--top-clear', Math.round(bottom + 8) + 'px');
}
setInterval(measure, 400);
addEventListener('resize', measure);
