// Touch screens: keep alerts just under whatever is at the top of the screen (the meters on the left, the
// Sol panel on the right), whatever the device and however many rows the meters wrap into.
// Sets the CSS variable --top-clear on <body>; phone.css uses it.
const hud = document.getElementById('hud');
function measure() {
  const modal=document.getElementById('modal');document.body.classList.toggle('ui-overlay-open',!!document.querySelector('#mission-path,#arrival')||!!hud?.classList.contains('menu-open')||!!modal&&!modal.classList.contains('hidden'));
  if (!hud || hud.classList.contains('hidden')) return;
  const meters = hud.querySelector('.meters'), status = hud.querySelector('.status');
  let bottom = 0;
  if (meters) bottom = Math.max(bottom, meters.getBoundingClientRect().bottom);
  if (status && !hud.classList.contains('menu-open')) bottom = Math.max(bottom, status.getBoundingClientRect().bottom);
  if (bottom > 0) document.body.style.setProperty('--top-clear', Math.round(bottom + 8) + 'px');
}
const hudObserver=new ResizeObserver(measure);for(const element of[hud?.querySelector('.meters'),hud?.querySelector('.status')])if(element)hudObserver.observe(element);
setInterval(measure, 400);
addEventListener('resize', measure);

const overlayObserver=new MutationObserver(measure);for(const element of[hud,document.getElementById('modal')])if(element)overlayObserver.observe(element,{attributes:true,attributeFilter:['class']});overlayObserver.observe(document.body,{childList:true});measure();
