// Bound time-to-first-audio without breaking words; keep sentence boundaries where possible.
export function voiceChunks(text,limit=160){
 const result=[];
 for(const sentence of String(text).trim().match(/[^.!?]+[.!?]*/g)||[]){
  let part='';
  for(const word of sentence.trim().split(/\s+/)){
   if(part&&part.length+word.length+1>limit){result.push(part);part='';}
   part+=(part?' ':'')+word;
  }
  if(part)result.push(part);
 }
 return result;
}
