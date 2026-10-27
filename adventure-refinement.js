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
function refresh(){
 if(!root.__ADVENTURE_DOCK_READY__||!state)return;
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
 const actors=[$('boundSprite'),...document.querySelectorAll('.battle-follower')],n=actors.length;
 actors.forEach((actor,i)=>{const p=n===1?0:(i/(n-1)*2-1);actor.style.left=(50+p*33)+'%';actor.style.setProperty('--court-depth',(Math.abs(p)*17)+'px');});
}
setInterval(refresh,100);refresh();
})(globalThis);
