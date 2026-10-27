/* Presentation identities only. No RNG, transactions, progression or save writes. */
(function(root){'use strict';
 const D=root.LoreRealmArtData;
 function resolve({sourceFloor,enemyIndex=0,guardianFloor=null}){
  if(guardianFloor!==null){const g=D.guardians.find(g=>g.floor===guardianFloor);return g?{kind:'guardian',id:g.id,name:g.name,sourceFloor:g.floor,image:g.image,background:g.arena,hold:g.hold}:null;}
  if(!Number.isInteger(sourceFloor)||sourceFloor<1||sourceFloor>99)return null;
  const pool=D.enemies.filter(e=>sourceFloor>=e.from&&sourceFloor<=e.to),land=D.landscapes.find(e=>sourceFloor>=e.from&&sourceFloor<=e.to);
  if(!pool.length||!land)return null;
  // Stable visual variety from existing encounter state. Does not draw or advance RNG.
  const index=((sourceFloor-pool[0].from+enemyIndex)%pool.length+pool.length)%pool.length,e=pool[index];
  return {kind:'regular',id:e.id,name:e.name,sourceFloor,image:e.image,background:land.image,hold:e.hold};
 }
 function forState(s){if(!s||root.LoreStory?.active(s)&&(s.progress||s).story.selectedRealm!==1)return null;
  const endless=root.LoreEndless?.active(s);if(s.realmComplete&&!endless)return null;
  return resolve({sourceFloor:root.LoreStory?.source(s)??s.floor,enemyIndex:s.enemyIndex,guardianFloor:endless?root.LoreEndless.current(s).sourceFloor:s.mode==='boss'?s.floor:null});
 }
 // Export selection for small deterministic contract tests without a browser.
 const API={resolve,forState};root.LoreSceneArt=API;if(typeof module!=='undefined')module.exports=API;
 if(typeof document==='undefined')return;
 const stats={requests:0,bytes:0,failures:0},spriteCache=new Map(),backdropCache=new Map();let key='',serial=0,spriteAbort=null,backdropAbort=null,backgroundKey='';
 async function load(src,cache,limit,signal){if(cache.has(src)){const url=cache.get(src);cache.delete(src);cache.set(src,url);return url;}const response=await fetch(src,{signal});if(!response.ok)throw Error('Artwork unavailable');const blob=await response.blob();if(signal.aborted)throw new DOMException('Aborted','AbortError');const url=URL.createObjectURL(blob);stats.requests++;stats.bytes+=blob.size;if(cache.size>=limit){const first=cache.keys().next().value;URL.revokeObjectURL(cache.get(first));cache.delete(first);}cache.set(src,url);return url;}
 API.refresh=function(s){const game=document.getElementById('game'),sprite=document.getElementById('enemySprite');if(!game||!sprite)return;const r=forState(s);
  if(r){document.getElementById('enemyName').textContent=r.name+(r.hold?' · art pending':'');sprite.setAttribute('aria-label',r.name+(r.hold?', placeholder artwork':''));if(s.mode==='boss')document.getElementById('bossRoomTitle').textContent=r.name;}
  const next=r?.id||'';if(next===key)return;key=next;const token=++serial;spriteAbort?.abort();spriteAbort=new AbortController();sprite.replaceChildren();sprite.classList.remove('realm-illustrated');sprite.dataset.artId=next;
  if(r?.image){const controller=spriteAbort;load(r.image.src,spriteCache,4,controller.signal).then(async url=>{const img=new Image();img.alt='';img.decoding='async';img.src=url;await img.decode();if(token!==serial)return;sprite.replaceChildren(img);sprite.classList.add('realm-illustrated');}).catch(e=>{if(e.name!=='AbortError')stats.failures++;});}
  const bg=r?.background?.src||'';if(bg!==backgroundKey){backgroundKey=bg;backdropAbort?.abort();backdropAbort=new AbortController();game.style.removeProperty('--realm-background');if(bg){const controller=backdropAbort;load(bg,backdropCache,2,controller.signal).then(async url=>{const img=new Image();img.src=url;await img.decode();if(backgroundKey===bg&&!controller.signal.aborted)game.style.setProperty('--realm-background',`url("${url}")`);}).catch(e=>{if(e.name!=='AbortError')stats.failures++;});}}
 };
 API.ghost=function(ghost){const sprite=document.getElementById('enemySprite');ghost.replaceChildren();ghost.classList.toggle('realm-illustrated',sprite.classList.contains('realm-illustrated'));if(sprite.firstElementChild)ghost.append(sprite.firstElementChild.cloneNode(true));};
 API.name=s=>forState(s)?.name;API.stats=stats;Object.defineProperty(API,'cacheSize',{get:()=>spriteCache.size+backdropCache.size});
 // Reserve a full button row below all five actors and give the fight the rest of the height (it used to stop
 // 535px above the bottom of the screen, which squeezed it upward); collapsing does not move them.
 function layout(){const game=document.getElementById('game'),combat=document.getElementById('combatLayout'),deck=document.getElementById('adventureDeck');if(!game||!combat||!deck||game.classList.contains('boss-room')||game.classList.contains('area-open'))return;
  let probe=document.getElementById('artPanelMeasure');if(!probe){probe=document.createElement('span');probe.id='artPanelMeasure';probe.setAttribute('aria-hidden','true');probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--dock-panel-height)';game.append(probe);}const panel=probe.getBoundingClientRect().height,collapsed=game.classList.contains('dock-is-collapsed');
  const expandedHeight=combat.clientHeight-(collapsed?panel+22-deck.clientHeight:0);
  const court=Math.max(90,expandedHeight-76);game.style.setProperty('--art-court-y',court+'px');game.classList.toggle('art-short-court',court<160);
 }
 const resize=new ResizeObserver(layout);const game=document.getElementById('game');if(game)resize.observe(game);const mount=new MutationObserver(()=>{const deck=document.getElementById('adventureDeck');if(deck){resize.observe(deck);resize.observe(document.getElementById('combatLayout'));mount.disconnect();layout();}});mount.observe(document.body,{childList:true,subtree:true});
})(globalThis);
