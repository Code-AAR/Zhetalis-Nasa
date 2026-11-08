import {audioVolume,audioMuted} from './audio-preferences.js';
let enabled=false;try{enabled=localStorage.getItem('zhetela-kokoro')==='1';}catch{}
let worker,context,source,gain,serial=0,timer,status='Voice off',active=false;
export const voiceEnabled=()=>enabled;
export const voiceStatus=()=>status;
function report(text){status=text;dispatchEvent(new CustomEvent('zhetela-voice-status',{detail:text}));}
function unlock(){context??=new AudioContext();if(context.state==='suspended')context.resume().catch(()=>{});}
export function stopZhetelaVoice(){if(active&&!source){worker?.terminate();worker=null;}active=false;serial++;clearTimeout(timer);source?.stop();source=null;worker?.postMessage({type:'cancel',id:serial});report(enabled?'Voice ready':'Voice off');}
export function setZhetelaVoice(on){enabled=!!on;try{localStorage.setItem('zhetela-kokoro',enabled?'1':'0');}catch{}stopZhetelaVoice();if(enabled){unlock();}else{worker?.terminate();worker=null;}}
export function speakZhetela(text){
 if(!enabled||audioMuted()||audioVolume('voice')===0)return;
 stopZhetelaVoice();active=true;const id=serial;unlock();
 if(!worker){worker=new Worker(new URL('./kokoro-worker.js?v=surface-missions-68',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(data.type==='status'){if(enabled&&active)report(data.text);return;}
   if(data.id!==serial||!enabled)return;clearTimeout(timer);
   if(data.type==='error'){active=false;report(data.text);return;}
   if(audioMuted()||audioVolume('voice')===0)return;
   const buffer=context.createBuffer(1,data.samples.length,data.rate);buffer.copyToChannel(data.samples,0);
   source=context.createBufferSource();source.buffer=buffer;gain=context.createGain();gain.gain.value=audioVolume('voice');source.connect(gain).connect(context.destination);
   source.onended=()=>{if(id===serial){source=null;active=false;report('Voice ready');}};source.start();report('Speaking');
  };
  worker.onerror=()=>{clearTimeout(timer);worker?.terminate();worker=null;report('Voice failed to load. Turn voice off and on to retry.');};
 }
 report('Preparing Kokoro voice…');worker.postMessage({type:'speak',id,text:String(text).replace(/→/g,' to ').replace(/\bOUT\b/g,'output').replace(/\bIN\b/g,'input').slice(0,700)});
 timer=setTimeout(()=>{stopZhetelaVoice();worker?.terminate();worker=null;report('Voice took too long. Turn voice off and on to retry.');},180000);
}
addEventListener('mission-mute',()=>{if(audioMuted())stopZhetelaVoice();});
addEventListener('audio-levels',()=>{if(gain)gain.gain.value=audioVolume('voice');if(audioVolume('voice')===0)stopZhetelaVoice();});
addEventListener('pagehide',()=>{stopZhetelaVoice();worker?.terminate();worker=null;});
addEventListener('pointerdown',()=>{if(enabled)unlock();},{passive:true});
