import {speakZhetela,stopZhetelaVoice,voiceEnabled,voiceStatus,setZhetelaVoice} from './zhetela-voice.js';
// Original Zhetela artwork, shared by Mars and Moon. No microphone or AI service required.
let card, timer, animation;
const sheet = new Image(); sheet.src = new URL('../assets/zhetela-sprites.png', import.meta.url).href;
export function zhetela(message, success = false) {
  if (!card) {
    card = document.createElement('aside'); card.id = 'zhetela-message'; card.hidden = true;
    card.innerHTML = '<canvas width="160" height="160" aria-hidden="true"></canvas><div><b>Zhetela · Mission guide</b><p role="status" aria-live="polite"></p><button type="button" data-read-voice aria-label="Read this message aloud" title="Read aloud"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8q5 4 0 8M19 5q8 7 0 14" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>Listen</span></button></div><button type="button" aria-label="Dismiss Zhetela message">×</button>';
    document.body.append(card);
    card.querySelector('[aria-label="Dismiss Zhetela message"]').onclick = dismiss;
    card.querySelector('[data-read-voice]').onclick=()=>{if(['Speaking','Preparing Kokoro voice…','Downloading Kokoro voice…'].includes(voiceStatus())){stopZhetelaVoice();return;}if(!voiceEnabled())setZhetelaVoice(true);speakZhetela(card.querySelector('p').textContent);};
  }
  clearTimeout(timer); clearInterval(animation);
  card.querySelector('p').textContent = message; card.hidden = false;stopZhetelaVoice();
  let frame = success ? 3 : 2; const since=performance.now();
  const paint = () => {
    if (!sheet.complete || !sheet.naturalWidth) return;
    const c=card.querySelector('canvas'),g=c.getContext('2d'),w=sheet.naturalWidth/3,h=sheet.naturalHeight/2;
    g.clearRect(0,0,160,160);g.drawImage(sheet,(frame%3)*w,Math.floor(frame/3)*h,w,h,0,0,160,160);
  };
  sheet.onload=paint;paint();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animation=setInterval(()=>{if(success&&performance.now()-since<1500)return;frame=frame===2?0:2;paint();},650);
  timer=setTimeout(()=>{if(!voiceEnabled()||!['Speaking','Preparing Kokoro voice…','Downloading Kokoro voice…'].includes(voiceStatus())){if(card)card.hidden=true;clearInterval(animation);}},Math.min(14000,Math.max(6500,message.length*65)));
}
function dismiss(){stopZhetelaVoice();if(card)card.hidden=true;clearTimeout(timer);clearInterval(animation);}
export function zhetelaPortraitHTML(){return '<div class="zhetela-speaker"><span aria-hidden="true"><i></i></span><b>Zhetela · Mission guide</b></div>';}

addEventListener('zhetela-dismiss',dismiss);

addEventListener('zhetela-voice-status',e=>{if(card&&!card.hidden&&e.detail==='Voice ready'){clearTimeout(timer);timer=setTimeout(()=>{card.hidden=true;clearInterval(animation);},5000);}});

addEventListener('zhetela-voice-status',e=>{const b=card?.querySelector('[data-read-voice]');if(!b)return;const busy=['Speaking','Preparing Kokoro voice…','Downloading Kokoro voice…'].includes(e.detail);b.querySelector('span').textContent=busy?(e.detail==='Speaking'?'Stop':'Loading… · Stop'):'Listen';b.setAttribute('aria-label',busy?'Stop speaking':'Read this message aloud');b.title=e.detail;});
