// Keep speech inference off the rendering thread. Only one fixed voice is used.
let modelPromise,latest=0,pending=null,running=false;
async function model(){
 if(!modelPromise)modelPromise=(async()=>{
  const {KokoroTTS}=await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js');
  return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')postMessage({type:'status',text:'Downloading Kokoro voice…'});}});
 })().catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
onmessage=({data})=>{latest=data.id;pending=data.type==='speak'?data:null;if(!running&&pending)run();};
async function run(){
 running=true;
 while(pending){const job=pending;pending=null;
  try{postMessage({type:'status',text:'Preparing Kokoro voice…'});const tts=await model();if(job.id!==latest)continue;
   const audio=await tts.generate(job.text,{voice:'af_heart',speed:.95});
   if(job.id===latest)postMessage({type:'audio',id:job.id,samples:audio.audio,rate:audio.sampling_rate},[audio.audio.buffer]);
  }catch(e){if(job.id===latest)postMessage({type:'error',id:job.id,text:'Voice unavailable. Check your connection and try turning voice on again.'});}
 }
 running=false;
}
