/* Presentation only: the engine owns kills, readiness, timers, and every transaction. */
(function(root){
'use strict';
if(root.__LORE_REVIEW_ISOLATED__)return;
const $=id=>document.getElementById(id);let mounted=false,last='';
// Show each damage label over the enemy's body, below its nameplate, leaning toward the side the companion that hit
// stands on, so labels from the same moment don't stack. The engine's left/top stay as the fallback when the enemy has no box.
function placeHit(node){
 const slot=Math.round((parseFloat(node.style.left)-40)/5),actor=$(slot?'battleFollower'+slot:'boundSprite'),side=Math.max(-1,Math.min(1,(parseFloat(actor?.style.left)-50)/33||0));
 const host=node.offsetParent||$('battlefield'),field=host.getBoundingClientRect(),foe=$('enemySprite').getBoundingClientRect(),plate=document.querySelector('.enemy-info')?.getBoundingClientRect();
 if(!foe.width)return;
 node.style.left=(foe.left+foe.width/2+side*Math.max(foe.width*.4,48)-field.left-host.clientLeft)+'px';
 node.style.top=(Math.max(foe.top+foe.height*.45,(plate?.bottom||0)+26)+(slot%2)*14-field.top-host.clientTop)+'px';
}
// The ordinary enemy's name and health sit just above the creature as it's drawn, not over its head (request
// 2026-11-08-combat-visibility). The enemy itself doesn't move or change size; only the plate follows it. Measured from
// the sprite's layout box and its resting offset, so the idle sway and hit shake don't make the plate jitter. A plate
// that would leave the top of the battlefield stays at the top. Boss rooms keep their own plate at the top of the screen.
function placePlate(){
 const plate=document.querySelector('.enemy-info'),sprite=$('enemySprite'),field=$('battlefield');if(!plate||!sprite||!field)return;
 if($('game').classList.contains('boss-room')||!sprite.offsetHeight||!field.clientHeight){if(plate.style.bottom)plate.style.removeProperty('bottom');return;}
 const shift=parseFloat((getComputedStyle(sprite).translate||'').split(' ')[1])||0,img=sprite.querySelector('img');
 const ink=img?img.offsetTop+(parseFloat(img.dataset.inkTop)||0)*img.offsetHeight:0;
 const top=sprite.offsetTop+shift+ink-4,bottom=Math.round(Math.min(field.clientHeight-top,field.clientHeight-plate.offsetHeight));
 if(plate.style.bottom!==bottom+'px')plate.style.bottom=bottom+'px';
}
function refresh(){
 if(!root.__ADVENTURE_DOCK_READY__||!state)return;
 if(mounted)placePlate();
 if(!mounted){mounted=true;document.documentElement.classList.add('adventure-refined');
 const timeline=document.createElement('div');timeline.id='floorTimeline';timeline.setAttribute('role','img');$('combatLayout').querySelector('.battle-panel').append(timeline);
 $('battlefield').append(document.querySelector('.enemy-info'));
 new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(node=>{if(node.classList?.contains('individual-hit'))placeHit(node);}))).observe($('battlefield'),{childList:true});
 }
 const s=state,R=root.LoreRealm,key=[s.floor,s.kills,s.mode,R.ready(s),s.party.slots.join(',')].join(':');
 if(key===last)return;last=key;
 $('game').classList.toggle('encounter-boss',s.mode==='boss');$('game').classList.toggle('floor-ready',R.ready(s));
 const count=9,done=s.realmComplete?9:(s.floor-1)%10,timeline=$('floorTimeline');
 timeline.setAttribute('aria-label',`${done} of ${count} ordinary story floors cleared in this chapter. ${s.realmComplete?'Realm conquered':R.ready(s)?'Boss ready to challenge':'Next boss on Floor '+(Math.floor(s.floor/10)*10+10)}.`);
 timeline.innerHTML=Array.from({length:count},(_,i)=>`<i class="${i<done?'complete':''}"></i>`).join('')+'<b aria-hidden="true"><svg viewBox="0 0 64 64"><use href="assets/navigation-emblems.svg#arena"/></svg></b>';
 // Fighters keep their party place's anchor (party-formation.js); a new floor or encounter only re-checks the scene.
 root.LoreFormation?.place();
}
setInterval(refresh,100);refresh();
})(globalThis);
