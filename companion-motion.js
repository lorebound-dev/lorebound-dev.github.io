/* Companion details move like the starter on the tutorial's "A NEW BOND" screen (request 2026-11-06-companion-details-art-qa).
   Cosmetic only: it reads nothing from the save, writes nothing, and never starts a game action.
   - Opening a companion (Party, Team manager or Omnidex) plays the tutorial entrance (boundAppear), then the windup-and-lunge
     one second in and every 4 seconds after, like revealAttackCycle on the tutorial screen, over a quiet idle.
   - Tapping the companion's picture plays the lunge at once and restarts the 4-second count, so nothing queues or stacks.
   - The three starters keep their own tutorial idle and particles. Other companions reuse the starter idle that suits them
     (Wildgrowth sways, Spirits hover, everyone else breathes) and get a soft glow and three small motes in their category's
     colours, spread a little differently each time a companion opens (Joshua's answer 2 in #123). Every category has a strike flash.
   - Reduced motion (or the preview page's still mode) shows the picture without any of this. */
(function(root){'use strict';
const STAGES={boundSheet:['.bound-art','#boundCardSprite'],historicalCompanion:['.detail-art','.creature']};
const STARTERS={bramblebud:0,cinderclack:1,glimwick:2};
const IDLE={Wildgrowth:'sway',Spirits:'hover'};
const ENTRANCE=650,FIRST_REACTION=1000,REACTION=900,LOOP=4000;
const between=(a,b)=>a+Math.random()*(b-a);
const timers=new WeakMap();
function still(){return !!(root.document?.documentElement?.classList?.contains('cm-still')||root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);}
function companions(){return root.LoreRealm?.C?.companions||root.LoreConfig?.companions||[];}
// Which companion a dialog shows: the preview page says so directly; the game's sheets are matched by the name they show.
function identify(dialog){
 const d=dialog.dataset||{};if(d.cmCategory)return {id:d.cmSpecies||'',category:d.cmCategory};
 const name=(dialog.querySelector('h2')?.textContent||'').trim(),h=companions().find(x=>x.name===name);
 if(h)return {id:h.id,category:h.category};
 const label=dialog.querySelector('#boundTypeBadge b,.archive-kicker')?.textContent||'';
 return {id:'',category:(label.split('·').pop()||'').trim()};
}
function decorations(stage,who){
 stage.querySelectorAll(':scope>.cm-deco').forEach(x=>x.remove());
 const add=cls=>{const i=root.document.createElement('i');i.className=cls+' cm-deco';i.setAttribute('aria-hidden','true');stage.appendChild(i);return i;};
 add('idle-glow');
 // Starters keep the tutorial's fixed mote places. Everyone else gets a slightly different spread each time.
 for(const m of ['m1','m2','m3']){const i=add('idle-mote '+m);if(who.id in STARTERS||!i.style?.setProperty)continue;
  i.style.setProperty('--cm-x',between(18,78).toFixed(0)+'%');i.style.setProperty('--cm-y',between(12,52).toFixed(0)+'%');
  i.style.setProperty('--cm-wait',between(.8,3.4).toFixed(2)+'s');i.style.setProperty('--cm-speed',between(.85,1.2).toFixed(2));}
 add('reveal-strike');
}
function setup(dialog){
 const sel=STAGES[dialog.id];if(!sel)return null;const stage=dialog.querySelector(sel[0]),body=stage?.querySelector(sel[1]);if(!stage||!body)return null;
 const who=identify(dialog);
 stage.className=stage.className.replace(/\b(cm-[\w-]+|idle-[0-2])\b/g,'').trim();body.classList.add('cm-body');
 stage.classList.add('cm-stage','cm-'+(IDLE[who.category]||'breathe'));
 if(who.category)stage.classList.add('cm-cat-'+who.category.toLowerCase());
 if(who.id in STARTERS)stage.classList.add('idle-'+STARTERS[who.id]);else stage.classList.add('cm-acc');
 decorations(stage,who);
 return stage;
}
function restart(stage,cls){stage.classList.remove(cls);void stage.offsetWidth;stage.classList.add(cls);}
function clear(stage){const t=timers.get(stage);if(t)t.forEach(clearTimeout);timers.set(stage,[]);}
function later(stage,fn,ms){const list=timers.get(stage)||[];list.push(setTimeout(fn,ms));timers.set(stage,list);}
// Plays the lunge now and the next one 4 seconds later, while the page stays open. A tap restarts this rather than
// adding another, so lunges never stack.
function react(stage){
 if(!stage||still())return false;
 clear(stage);
 restart(stage,'cm-react');later(stage,()=>stage.classList.remove('cm-react'),REACTION+50);
 later(stage,()=>{if(stage.closest?.('dialog')?.open)react(stage);},LOOP);return true;
}
// Plays the entrance, then the lunge at the tutorial's one-second mark and every 4 seconds after.
function play(dialog){
 const stage=setup(dialog);if(!stage)return null;clear(stage);stage.classList.remove('cm-react');
 if(still())return stage;
 restart(stage,'cm-enter');later(stage,()=>stage.classList.remove('cm-enter'),ENTRANCE+50);
 later(stage,()=>{if(dialog.open)react(stage);},FIRST_REACTION);
 return stage;
}
function watch(){
 const doc=root.document;if(!doc||!root.MutationObserver)return;
 const names=new WeakMap(),watched=new WeakSet();
 const check=dialog=>{if(!dialog.open||!STAGES[dialog.id])return;names.set(dialog,dialog.querySelector('h2')?.textContent||'');play(dialog);};
 // A sheet that opens plays at once. Combat redraws the sheet's numbers often, so only its title is watched while it is open:
 // a new name there means another companion (the same name written again is ignored).
 const title=dialog=>{const h2=dialog.querySelector('h2');if(!h2||watched.has(h2))return;watched.add(h2);
  new root.MutationObserver(()=>{if(dialog.open&&names.get(dialog)!==h2.textContent)check(dialog);}).observe(h2,{childList:true,characterData:true,subtree:true});};
 new root.MutationObserver(list=>{for(const m of list)if(m.target.open&&STAGES[m.target.id]){check(m.target);title(m.target);}})
  .observe(doc.documentElement,{subtree:true,attributes:true,attributeFilter:['open']});
 // Only the picture responds to a tap; buttons, scrolling and closing are left alone.
 doc.addEventListener('click',e=>{const stage=e.target?.closest?.('.cm-stage');if(stage&&stage.closest('dialog')?.open)react(stage);});
}
root.LoreCompanionMotion=Object.freeze({play,react,identify,still,STARTERS,IDLE});
if(root.document)watch();
})(globalThis);
