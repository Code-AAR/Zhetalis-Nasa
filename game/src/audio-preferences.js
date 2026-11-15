const defaults={master:.8,music:.32,ambience:.15,effects:.65,voice:.8};
let prefs={...defaults};try{Object.assign(prefs,JSON.parse(localStorage.getItem('mission-audio')||'{}'));}catch{}
for(const k of Object.keys(defaults))prefs[k]=Number.isFinite(Number(prefs[k]))?Math.max(0,Math.min(1,Number(prefs[k]))):defaults[k];
export const audioLevels=()=>({...prefs});
export function setAudioLevel(key,value){if(!(key in defaults))return;prefs[key]=Math.max(0,Math.min(1,Number(value)||0));try{localStorage.setItem('mission-audio',JSON.stringify(prefs));}catch{}dispatchEvent(new CustomEvent('audio-levels',{detail:audioLevels()}));}
let muted=false;try{muted=localStorage.getItem('ja-muted')==='1';}catch{}
export const audioMuted=()=>muted;
export const audioVolume=key=>prefs.master*(prefs[key]??1)*(muted?0:1);
export function setAudioMuted(value){muted=!!value;try{localStorage.setItem('ja-muted',muted?'1':'0');}catch{}dispatchEvent(new CustomEvent('mission-mute',{detail:{muted}}));}
