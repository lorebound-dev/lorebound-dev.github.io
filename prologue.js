'use strict';
const $=id=>document.getElementById(id),preview=new URLSearchParams(window.location.search).get('preview')==='prologue',reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const LINES=['Many years ago, humans ruled the universe.','','Then the sky broke.','From the shattered heavens came terrible beasts.','Humanity was driven to the edge of extinction.','It is up to you to reclaim the realms.'];let scene=0,busy=true,leaving=false;
// The meteor slide has no words and moves on by itself after this hold; every slide fades over FADE.
const HOLD=reduced?100:1500,FADE=reduced?0:550;
function renderScene(){$('storyScene').className='story-scene phase-'+scene;$('narration').textContent=LINES[scene]||'';$('narration').classList.remove('enter');void $('narration').offsetWidth;$('narration').classList.add('enter');$('continueHint').textContent=scene===5?'Tap to begin':'Tap to continue';}
function enterEggs(){try{window.sessionStorage.setItem(preview?'lorebound-preview-player':'lorebound-player-draft',JSON.stringify({name:'Adventurer',look:0,shirt:0,skin:0}));if(!preview)window.sessionStorage.setItem('lorebound-entry-ticket','ready');window.location.assign(preview?'home.html?preview=intro':'home.html');}catch{leaving=false;$('narration').textContent='Please allow browser storage to begin your journey.';$('sceneFade').classList.remove('black');scene=5;busy=false;}}
function transitionTo(next){if(leaving)return;busy=true;$('sceneFade').classList.add('black');setTimeout(()=>{if(leaving)return;scene=next;if(scene===6){leaving=true;enterEggs();return;}renderScene();$('sceneFade').classList.remove('black');if(scene===1)setTimeout(()=>transitionTo(2),HOLD);else setTimeout(()=>{busy=false},500);},FADE);}
function advance(){if(busy||leaving||scene>=6)return;transitionTo(scene+1);}
// Skip works at any moment, even mid-fade, and goes straight to the eggs.
function skip(){if(leaving)return;leaving=true;busy=true;$('sceneFade').classList.add('black');setTimeout(enterEggs,FADE);}
$('storyAdvance').onclick=advance;$('storySkip').onclick=skip;
let returning=false;try{returning=!preview&&['lorebound-realm1-v4','lorebound-realm1-v3','lorebound-adventure-v2'].some(key=>localStorage.getItem(key)!==null)}catch{returning=!preview}if(returning){window.location.replace('home.html')}else{
 // Fetch the egg screen's art while the story plays, so the eggs are there when it ends.
 if(typeof Image==='function')['assets/eggs-themed-v2.png','assets/void.png'].forEach(src=>{new Image().src=src;});
 globalThis.LoreOpeningMusic?.start();renderScene();setTimeout(()=>{$('sceneFade').classList.remove('black');busy=false},reduced?0:450);}
