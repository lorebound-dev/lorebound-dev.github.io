/* Hall of Triumphs: the one-room Treasure Hall. Presentation only; trophy state comes from LoreTrophies and nothing here writes to a save. */
(function(root){'use strict';
const Y=()=>root.LoreTrophies,DIR='assets/treasure-hall/premium/';
// Phone-sized WebP copies of Joshua's approved masters (tools/build-treasure-hall-webp.cjs). masterSha256 ties each to
// handoff/treasure-hall-premium-revamp/APPROVED_ASSET_MANIFEST_v01.json; assets/treasure-hall/premium/manifest.json records the copies.
// Trophy x/y are CSS px nudges at the 390×844 reference; they stay 0 unless a screenshot shows a trophy sitting off the shared base line.
const art=(file,masterSha256,extra={})=>Object.freeze({src:DIR+file,masterSha256,...extra});
const ART=Object.freeze({
 background:art('treasure-hall-background-v01-1024.webp','93d4d5c538a2c1fe3ba66f261dfa8ad9caac219f85d75cee6f9c69f7cc2f5f35'),
 foreground:art('treasure-hall-foreground-rim-v01-1509.webp','73d76981ed4f838657c8e812a9034712ecc9d212cee5c3f55a21f116bc7d3d74'),
 plaque:art('treasure-hall-plaque-empty-v01-1320.webp','e9def02849c73c9e321a593ee49c65160c201c817181fb59527afb2d207b3746'),
 town:Object.freeze({ruined:art('treasure-hall-town-ruined-v01-690.webp','28e086d183e741ae3b832811f207734bea27530403cd2a19baab2c9df978f93a'),restored:art('treasure-hall-town-restored-v01-690.webp','dc262943a5d55a573ea101d5b3e71893f4009c7575d3acccf99fc156dceeba38')}),
 trophies:Object.freeze({
  'realm-conqueror':art('treasure-hall-trophy-conqueror-v02-1200.webp','b3eb74c9bbf44474d3bddf7f08990669516aa1cb04a23e77fa25d6ed64bcfc51',{x:0,y:0}),
  'whole-chronicle':art('treasure-hall-trophy-chronicle-v02-1200.webp','18b1c04b0685dd2cde6bb1b1739127a95276b698ce95d9d1da5f174d0c6cbb86',{x:0,y:0}),
  'sixfold-covenant':art('treasure-hall-trophy-sixfold-v02-1200.webp','0383e6beeffa9870f712d9d2e8365757142f377f00dd2ba28976fc6ac46c81f1',{x:0,y:0}),
  'guardian-memorial':art('treasure-hall-trophy-guardian-v02-1200.webp','2e1e274c59a5b5846962abef93b87cc8d4d3566aeb74570fe13fe6edc907b171',{x:0,y:0}),
  'last-vigil':art('treasure-hall-trophy-last-vigil-v02-1200.webp','5b854530a8f4c80cd584ddccbb6f9f07aaa606858acf1e5dacfd8dfdfec9e500',{x:0,y:0})})});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chevron=d=>`<svg viewBox="0 0 28 36" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
let scene,current,index=-1,last='',baseline=null,swipe=null,hooks={};const glowed=new Set();
const motion=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
// Chronicle, Guardian Memorial and Last Vigil glow only when earned during this visit; Crown and Sixfold use their device note, so neither replays after a reload.
function prime(s){try{baseline=new Set(Y().list(s).filter(t=>t.earned).map(t=>t.id));}catch{baseline=null;}}
function fresh(t,s){if(!t.earned)return false;if(Y().LOCAL.includes(t.id))return Y().unseen(s).includes(t.id);return !!baseline&&!baseline.has(t.id)&&!glowed.has(t.id);}
function mount(box){scene=document.createElement('section');scene.className='hall-scene';scene.hidden=true;scene.setAttribute('aria-roledescription','carousel');scene.setAttribute('aria-label','Hall of Triumphs');
 const ids=Y().order.map(t=>t.id);
 scene.innerHTML=`<img class="hall-bg" src="${ART.background.src}" alt="" decoding="async" draggable="false"><i class="hall-vignette" aria-hidden="true"></i><div class="hall-stage" role="img">${ids.map(id=>`<div class="hall-trophy" data-trophy="${id}" style="--x:${ART.trophies[id].x}px;--y:${ART.trophies[id].y}px;--mask:url('${ART.trophies[id].src}')" hidden><img alt="" decoding="async" draggable="false"></div>`).join('')}</div><img class="hall-fore" src="${ART.foreground.src}" alt="" decoding="async" draggable="false"><header class="hall-head"><h2 id="hallTitle">Treasure Hall</h2></header><button type="button" class="hall-close" aria-label="Close Treasure Hall"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span></button><p class="hall-count"></p><button type="button" class="hall-records">Records</button><button type="button" class="hall-arrow hall-prev" aria-label="Previous trophy"><span>${chevron('M18 7L9 18l9 11')}</span></button><button type="button" class="hall-arrow hall-next" aria-label="Next trophy"><span>${chevron('M10 7l9 11-9 11')}</span></button><div class="hall-plaque"><img src="${ART.plaque.src}" alt="" decoding="async" draggable="false"><div class="hall-plaque-text" aria-live="polite"><h3></h3><p class="hall-requirement"></p><p class="hall-status"></p></div></div>`;
 box.append(scene);
 scene.querySelector('.hall-close').onclick=()=>hooks.close?.();scene.querySelector('.hall-records').onclick=()=>hooks.records?.();
 scene.querySelector('.hall-prev').onclick=()=>step(-1);scene.querySelector('.hall-next').onclick=()=>step(1);
 scene.querySelectorAll('img').forEach(img=>{img.onerror=()=>{img.hidden=true;};});
 scene.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});
 // A sideways swipe is a shortcut; the arrows always work.
 scene.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.target.closest('button'))return;swipe={id:e.pointerId,x:e.clientX,y:e.clientY};});
 scene.addEventListener('pointerup',e=>{if(!swipe||e.pointerId!==swipe.id)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);});
 scene.addEventListener('pointercancel',()=>{swipe=null;});}
const wrap=i=>{const n=Y().order.length;return (i%n+n)%n;};
function load(i){const el=scene.querySelectorAll('.hall-trophy')[i],img=el.querySelector('img');if(!img.getAttribute('src'))img.src=ART.trophies[el.dataset.trophy].src;}
function celebrate(el,t){if(Y().LOCAL.includes(t.id))Y().markSeen([t.id]);else glowed.add(t.id);if(motion())return;el.classList.remove('newly');void el.offsetWidth;el.classList.add('newly');setTimeout(()=>el.classList.remove('newly'),2400);}
function update(){if(!scene||!current)return;const list=Y().list(current),t=list[index],key=JSON.stringify([index,list.map(x=>x.status)]);if(key===last)return;last=key;
 const els=scene.querySelectorAll('.hall-trophy');els.forEach((el,i)=>{el.hidden=i!==index;el.classList.toggle('locked',!list[i].earned);});
 load(index);load(wrap(index+1));load(wrap(index-1));
 scene.querySelector('.hall-count').textContent=`${list.filter(x=>x.earned).length} / ${list.length} earned`;
 scene.querySelector('.hall-stage').setAttribute('aria-label',`Trophy ${index+1} of ${list.length}: ${t.name}, ${t.earned?'earned':'not yet earned'}`);
 const text=scene.querySelector('.hall-plaque-text');text.querySelector('h3').textContent=t.name;text.querySelector('.hall-requirement').textContent=t.requirement;const status=text.querySelector('.hall-status');status.textContent=t.status;status.classList.toggle('earned',t.earned);
 if(fresh(t,current))celebrate(els[index],t);}
function step(d){index=wrap(index+d);last='';update();}
// On opening, show the first trophy that has never glowed, else the one shown last.
function enter(box,s,on){if(!scene)mount(box);scene.querySelectorAll('.newly').forEach(el=>el.classList.remove('newly'));hooks=on;current=s;const list=Y().list(s),first=list.findIndex(t=>fresh(t,s));if(first>=0)index=first;else if(index<0)index=0;last='';scene.hidden=false;update();}
function render(box,s,on){if(!scene)return enter(box,s,on);hooks=on;current=s;scene.hidden=false;update();}
function hide(){if(scene)scene.hidden=true;last='';}
const focus=()=>scene?.querySelector('.hall-close').focus();
root.LoreTreasureScene={ART,prime,fresh,enter,render,hide,focus,step};if(typeof module!=='undefined')module.exports=root.LoreTreasureScene;
})(globalThis);
