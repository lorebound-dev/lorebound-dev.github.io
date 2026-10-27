/* One audio element carries the opening into egg selection, then switches to Adventure. */
(function(root){'use strict';
const MUTED='lorebound-opening-muted',tracks={opening:{src:'assets/castle-march.mp3',position:'lorebound-march-position'},adventure:{src:'assets/castle-ballad.mp3',position:'lorebound-ballad-position'}};
let active=false,muted=false,enabled=true,track='opening';
function get(key){try{return root.sessionStorage?.getItem(key)}catch{return null}}
function set(key,value){try{root.sessionStorage?.setItem(key,String(value))}catch{}}
muted=get(MUTED)==='yes';
const audio=typeof root.Audio==='function'?new root.Audio(tracks.opening.src):null,button=document.getElementById('openingSound');
function update(){if(!button)return;const playing=!!audio&&!audio.paused&&!muted&&enabled;button.textContent=playing?'♫':'♪';button.setAttribute('aria-label',playing?'Mute music':'Play music');button.setAttribute('aria-pressed',String(playing));}
function remember(){if(audio&&Number.isFinite(audio.currentTime))set(tracks[track].position,audio.currentTime)}
function pause(){remember();audio?.pause();update()}
function play(){if(!active||!enabled||muted||document.hidden||!audio)return;try{const p=audio.play();p?.then(()=>{if(!active||!enabled||muted||document.hidden)audio.pause();update()}).catch(()=>update())}catch{update()}}
function restorePosition(){if(!audio)return;const position=Number(get(tracks[track].position));if(position>0&&Number.isFinite(audio.duration)&&audio.duration>0)try{audio.currentTime=position%audio.duration}catch{}}
if(audio){audio.loop=true;audio.volume=.35;audio.preload='metadata';audio.addEventListener('loadedmetadata',restorePosition);audio.addEventListener('play',()=>{if(!active||!enabled||muted||document.hidden)audio.pause();update()});audio.addEventListener('pause',update);}
function start(){active=true;play()}
function enterAdventure(soundEnabled=true){enabled=soundEnabled!==false;if(track!=='adventure'){pause();track='adventure';if(audio){audio.src=tracks.adventure.src;try{audio.currentTime=0}catch{}}set(tracks.opening.position,0);}active=true;play()}
function setEnabled(value){enabled=!!value;if(enabled){muted=false;set(MUTED,'no');play()}else pause();update()}
function stop(){active=false;audio?.pause();if(audio)try{audio.currentTime=0}catch{}set(tracks[track].position,0);update()}
if(button)button.onclick=()=>{if(!audio)return;if(audio.paused||muted||!enabled){muted=false;enabled=true;set(MUTED,'no');play()}else{muted=true;set(MUTED,'yes');pause()}update()};
function unlock(event){if(event?.target?.closest?.('#openingSound'))return;play()}
document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else play()});
root.addEventListener?.('pagehide',pause);root.addEventListener?.('pageshow',()=>{if(active)play()});
root.LoreOpeningMusic={start,stop,enterAdventure,setEnabled};update();
})(globalThis);
