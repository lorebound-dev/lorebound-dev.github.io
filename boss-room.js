/* Dedicated encounter presentation. Combat, deadline, rewards and retry state stay in LoreRealm. */
(function(root){
'use strict';
if(root.__LORE_REVIEW_ISOLATED__)return;
const $=id=>document.getElementById(id);let active=false,hidden=[];let timerHome,timerNext;
const header=document.createElement('header');header.id='bossRoomHeader';header.hidden=true;
header.innerHTML='<div><small>MOSSBOUND RUINS</small><h2 id="bossRoomTitle">Boss encounter</h2></div><button id="bossFlee" type="button">Flee</button>';
$('game').append(header);
const note=document.createElement('p');note.id='bossRoomNote';note.hidden=true;note.textContent='Your companions fight beside you · Tap the boss to attack';$('game').append(note);
const A=()=>root.LoreBossAdvice;
// Advisory only: adventure.js still owns the button's state and its tap; this adds the recommended Party DPS under the label.
function readiness(s){
 const b=$('bossButton'),a=A()&&s&&s.mode!=='boss'&&!s.realmComplete&&root.Lore.ready(s)&&A().advice(s);
 if(!a){b.classList.remove('has-advice','advice-ready','advice-low');b.removeAttribute('aria-label');return;}
 const label=b.querySelector('.boss-button-label')?.textContent??b.textContent;b.textContent='';
 const top=document.createElement('span');top.className='boss-button-label';top.textContent=label;
 const line=document.createElement('small');line.className='boss-advice';line.textContent=A().buttonLine(a);
 b.append(top,line);b.classList.add('has-advice');b.classList.toggle('advice-ready',a.ready);b.classList.toggle('advice-low',!a.ready);
 b.setAttribute('aria-label',A().buttonLabel(a,s));
}
function refresh(s){
 const next=s?.mode==='boss';
 readiness(s);
 if(next!==active){active=next;$('game').classList.toggle('boss-room',active);header.hidden=note.hidden=!active;
  if(active){
   note.textContent=A()?A().roomNote(A().advice(s)):'Your companions fight beside you · Tap the boss to attack';
   root.LoreSummoning?.stop('Boss encounter');timerHome=$('timer').parentNode;timerNext=$('timer').nextSibling;$('combatLayout').append($('timer'));
   hidden=[...$('game').children,...document.querySelectorAll('.dock-scene-shortcuts')].filter(e=>e!==header&&e!==note&&e!==$('combatLayout')).map(e=>[e,e.inert]);
   for(const [e] of hidden)e.inert=true;
   $('bossFlee').focus({preventScroll:true});
  }else{timerHome.insertBefore($('timer'),timerNext);for(const [e,prior] of hidden)e.inert=prior;hidden=[];}
 }
 if(active){$('bossRoomTitle').textContent=`${s.floor===100?'Realm guardian':'Floor guardian'} · ${String(s.floor).padStart(3,'0')}`;}
}
function outcome(kind){
 refresh(state);
 if(kind==='victory')return;
 showModal('MOSSBOUND RUINS',kind==='flee'?'RETREATED':'TIME EXPIRED',kind==='flee'?'Your party returns safely to the courtyard.':'The guardian still stands. Your party returns to the courtyard.','');
 $('modal').classList.add('boss-outcome');
 // failBoss has already kept this boss unlocked and granted nothing; the wording only explains that.
 if(A())$('modalText').textContent=A().failureText(kind,A().advice(state),state);
 else $('modalText').textContent+=' The boss remains unlocked. No boss rewards were awarded.';
 $('modalClose').textContent='Return to Adventure';$('modalClose').focus({preventScroll:true});
}
$('bossFlee').onclick=()=>{
 if(!state||state.mode!=='boss'||savePaused||saveProtected)return;
 // The existing failure transaction grants no rewards and keeps this floor unlocked.
 Lore.failBoss(state);save();draw();outcome('flee');
};
$('modal').addEventListener('close',()=>{const wasOutcome=$('modal').classList.contains('boss-outcome')||$('modal').classList.contains('floor-victory');$('modal').classList.remove('boss-outcome');if(wasOutcome&&!active)($('bossButton').disabled?$('battlefield'):$('bossButton')).focus({preventScroll:true});});
root.LoreBossRoom={refresh,outcome};
})(globalThis);
