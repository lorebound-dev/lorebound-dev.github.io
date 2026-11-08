/* Reduced effects (QoL audit, area 5): a device setting, separate from the phone's reduced-motion setting, that shows fewer
 * particles and damage numbers. Every hit still flashes the enemy and shakes it, critical hits always show their number,
 * and fights, damage, attack timing and rewards are exactly the same. Like the title screen's motion switch it is stored on
 * this device (localStorage), not in the save, so no save changes and no update popup.
 */
(function(root){'use strict';
const KEY='lorebound-effects',MAX_HITS=2;
let reduced=false;try{reduced=root.localStorage?.getItem(KEY)==='reduced';}catch{}
const $=id=>root.document?.getElementById(id);
function apply(){root.document?.documentElement?.classList.toggle('effects-reduced',reduced);const box=$('effectsReduced');if(box)box.checked=reduced;}
function set(on){reduced=!!on;try{root.localStorage?.setItem(KEY,reduced?'reduced':'full');}catch{}apply();return reduced;}
// With reduced effects, at most two damage numbers show at once. A new ordinary number waits its turn (it's dropped), and a
// critical one replaces the oldest ordinary number, so crits are never lost. The enemy's hit flash is untouched.
function thin(node){
 if(!reduced||!node.classList?.contains('individual-hit'))return;
 const live=[...node.parentNode.querySelectorAll('.individual-hit')].filter(x=>x!==node);if(live.length<MAX_HITS)return;
 if(!node.classList.contains('critical-hit')){node.remove();return;}
 const plain=live.find(x=>!x.classList.contains('critical-hit'));if(plain)plain.remove();else node.remove();
}
let watching=false;
function mount(){
 apply();
 const field=$('battlefield');if(!watching&&field&&typeof root.MutationObserver==='function'){watching=true;new root.MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(thin))).observe(field,{childList:true});}
 // The switch lives with Game sound and Haptics in the Auto setup sheet. It saves as soon as it's changed.
 const haptics=$('summonHaptics')?.closest?.('label');
 if(haptics&&!$('effectsReduced')){const label=root.document.createElement('label');label.className='summon-check';label.innerHTML='<input id="effectsReduced" type="checkbox">Reduced effects <small>Fewer particles and damage numbers</small>';haptics.after(label);$('effectsReduced').checked=reduced;$('effectsReduced').onchange=e=>set(e.target.checked);}
 return watching&&!!$('effectsReduced');
}
root.LoreEffects={get reduced(){return reduced;},set,mount};
if(root.document){apply();let tries=0;const timer=setInterval(()=>{if(mount()||++tries>240)clearInterval(timer);},250);}
})(globalThis);
