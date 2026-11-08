/* Profile > Settings: sound, vibration and reduced motion, using the preferences the game already has.
   Sound and vibration are the save's existing summoning.settings.sound / .haptics, which ui-feedback.js and summoning.js
   already read, so nothing new is added to the save. Reduced motion is the title screen's existing 'lorebound-motion'
   choice on this device ('off' means calmer); here it also applies inside the game. Load this before the other scripts:
   it answers the game's own prefers-reduced-motion checks, so every animation that already respects the phone's setting
   also respects this one. */
(function(root){'use strict';
const KEY='lorebound-motion',QUERY=/prefers-reduced-motion\s*:\s*reduce/i,real=typeof root.matchMedia==='function'?root.matchMedia.bind(root):null;
function stored(){try{return root.localStorage?.getItem(KEY)??null;}catch{return null;}}
function system(){try{return !!real?.('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
function reduced(){return stored()==='off'||system();}
function apply(){root.document?.documentElement?.classList.toggle('lore-reduced-motion',stored()==='off');}
if(real)root.matchMedia=function(query){const list=real(query);if(!QUERY.test(String(query)))return list;
 // A live view of the real list: it matches when the phone or the player asks for calmer motion.
 return {get matches(){return list.matches||stored()==='off';},media:list.media,get onchange(){return list.onchange;},set onchange(f){list.onchange=f;},addEventListener:(...a)=>list.addEventListener?.(...a),removeEventListener:(...a)=>list.removeEventListener?.(...a),addListener:f=>list.addListener?.(f),removeListener:f=>list.removeListener?.(f),dispatchEvent:e=>list.dispatchEvent?.(e)};};
apply();
let read=null,persist=null;const $=id=>root.document?.getElementById?.(id);
function render(){const s=read?.(),p=s?.summoning?.settings;if(!$('settingSound'))return;
 $('settingSound').checked=p?p.sound!==false:true;$('settingHaptics').checked=p?p.haptics!==false:true;
 const vibrates=typeof root.navigator?.vibrate==='function';$('settingHapticsNote').textContent=vibrates?'Light taps on supported phones':'This browser can’t vibrate';
 $('settingMotion').checked=reduced();$('settingMotion').disabled=system();$('settingMotionNote').textContent=system()?'Your phone asks for less motion':'Calmer animations and effects';}
function setPref(key,value){const s=read?.();if(!s?.summoning?.settings)return;const p=s.summoning.settings,before=p[key];p[key]=value;let ok=false;try{ok=persist()!==false;}catch{}if(!ok){p[key]=before;root.toast?.('Setting could not be saved');}render();}
function setMotion(calm){try{root.localStorage?.setItem(KEY,calm?'off':'on');}catch{root.toast?.('Setting could not be saved');}apply();render();}
function connect(get,save){read=get;persist=save;if(!$('settingSound'))return;
 $('settingSound').onchange=()=>setPref('sound',!!$('settingSound').checked);
 $('settingHaptics').onchange=()=>setPref('haptics',!!$('settingHaptics').checked);
 $('settingMotion').onchange=()=>setMotion(!!$('settingMotion').checked);render();}
root.LoreGameSettings={connect,render,reduced};
})(globalThis);
