/* Presentation only. Frames are selected from owner-normalized strips; never writes progression. */
(function(root){'use strict';const A=root.LoreTreasureAssets,T=root.LoreTreasure;let box=null,raf=0,start=0,lastRanks=null,burst=null,observer;const motion=matchMedia('(prefers-reduced-motion: reduce)');
function ranks(s){return new Map(T.groups(s).filter(g=>['artifacts','relics'].includes(g.id)).flatMap(g=>g.entries.map(e=>[e.key,{rank:e.rank,max:e.maxRank,name:e.name}])));}
function stop(){cancelAnimationFrame(raf);raf=0;}
function paint(el,meta,frame){if(el.dataset.frame===String(frame))return;el.style.backgroundImage=`url("${meta.src}")`;el.style.backgroundSize=`${meta.frames*100}% 100%`;el.style.backgroundPosition=`${meta.frames===1?0:frame/(meta.frames-1)*100}% 50%`;el.dataset.frame=String(frame);el.dataset.anchor=meta.anchor;}
function tick(t){raf=0;if(!box?.open||document.hidden||motion.matches)return;const age=t-start;for(const el of box.querySelectorAll('[data-hall-effect]')){const meta=A.effects[el.dataset.hallEffect];if(!meta||el.dataset.visible!=='true')continue;const f=Math.floor(age/meta.frame_duration_ms)%meta.frames;paint(el,meta,f);}
 if(burst){const meta=A.effects.burst,frame=Math.floor((t-burst.started)/meta.frame_duration_ms);if(frame>=meta.frames){burst.el.remove();burst=null;}else paint(burst.el,meta,Math.max(0,frame));}raf=requestAnimationFrame(tick);}
function attach(node){box=node;observer?.disconnect();observer=new IntersectionObserver(es=>{for(const e of es)e.target.dataset.visible=String(e.isIntersecting);},{root:box});for(const el of box.querySelectorAll('[data-hall-effect]')){el.hidden=motion.matches;observer.observe(el);}if(!raf&&!motion.matches&&!document.hidden){start=performance.now();raf=requestAnimationFrame(tick);}}
function detach(){stop();observer?.disconnect();burst?.el.remove();burst=null;box=null;}
function prime(s){lastRanks=s&&T.enabled(s)?ranks(s):null;}
function committed(s){if(!s||!T.enabled(s))return;const next=ranks(s),earned=[];if(lastRanks)for(const [id,e] of next){const old=lastRanks.get(id);if(old&&old.rank<e.max&&e.rank===e.max)earned.push({...e,id});}lastRanks=next;if(!earned.length||!box?.open)return;const status=box.querySelector('#treasureStatus');status.textContent=earned.map(e=>e.name+' · Mastery VI earned').join(' / ');if(motion.matches||document.hidden)return;
 burst?.el.remove();const el=document.createElement('div');el.className='treasure-earned-burst';el.setAttribute('aria-hidden','true');box.append(el);burst={el,started:performance.now()};if(!raf){start=performance.now();raf=requestAnimationFrame(tick);}}
motion.addEventListener('change',()=>{stop();burst?.el.remove();burst=null;if(box?.open)attach(box);});document.addEventListener('visibilitychange',()=>{stop();burst?.el.remove();burst=null;if(box?.open&&!document.hidden)attach(box);});
root.LoreTreasureFX={attach,detach,prime,committed};
})(globalThis);
