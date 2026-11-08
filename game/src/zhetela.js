// Original Zhetela artwork, shared by Mars and Moon. No microphone or AI service required.
let card, timer, animation;
const sheet = new Image(); sheet.src = new URL('../assets/zhetela-sprites.png', import.meta.url).href;
export function zhetela(message, success = false) {
  if (!card) {
    card = document.createElement('aside'); card.id = 'zhetela-message'; card.hidden = true;
    card.innerHTML = '<canvas width="160" height="160" aria-hidden="true"></canvas><div><b>Zhetela · Mission guide</b><p role="status" aria-live="polite"></p></div><button type="button" aria-label="Dismiss Zhetela message">×</button>';
    document.body.append(card);
    card.querySelector('button').onclick = dismiss;
  }
  clearTimeout(timer); clearInterval(animation);
  card.querySelector('p').textContent = message; card.hidden = false;
  let frame = success ? 3 : 2; const since=performance.now();
  const paint = () => {
    if (!sheet.complete || !sheet.naturalWidth) return;
    const c=card.querySelector('canvas'),g=c.getContext('2d'),w=sheet.naturalWidth/3,h=sheet.naturalHeight/2;
    g.clearRect(0,0,160,160);g.drawImage(sheet,(frame%3)*w,Math.floor(frame/3)*h,w,h,0,0,160,160);
  };
  sheet.onload=paint;paint();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animation=setInterval(()=>{if(success&&performance.now()-since<1500)return;frame=frame===2?0:2;paint();},650);
  timer=setTimeout(dismiss,Math.min(14000,Math.max(6500,message.length*65)));
}
function dismiss(){if(card)card.hidden=true;clearTimeout(timer);clearInterval(animation);}
export function zhetelaPortraitHTML(){return '<div class="zhetela-speaker"><span aria-hidden="true"><i></i></span><b>Zhetela · Mission guide</b></div>';}
