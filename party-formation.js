/* Where the party stands in the fight (request #97, Joshua's ten-companion layout §6–7). Party places bind to fixed
   anchors: place 1 = A … place 10 = J, three on each flank of the enemy and four across the front. Empty places stay
   empty, and nobody is re-centred. The fractions are Joshua's starting scaffold; solve() keeps them where they fit and
   only moves a flank down or shrinks every fighter when the Omnidex and Journal buttons, the enemy's nameplate or the
   enemy itself would be in the way. Presentation only: combat events and their timing don't change. */
(function(root){'use strict';
// x and y of each anchor's feet, as fractions of the scene rectangle (floor strip down to the goal and Challenge band).
const ANCHORS=[['A',.12,.35],['B',.88,.35],['C',.12,.53],['D',.88,.53],['E',.12,.71],['F',.88,.71],['G',.22,.92],['H',.41,.92],['I',.59,.92],['J',.78,.92]];
const GAP=6,CLEAR=12,VISIBLE=.85,MIN=30,MAX=64;
const overlapsX=(a,l,r)=>a.l<r&&a.r>l;
// g: {W,H} of the scene, keep: rectangles flank fighters stay below ({l,t,r,b}, scene px), enemy: the enemy's box.
// Returns the fighter size and every anchor's feet in scene px.
function solve(g){
 const W=Math.max(1,g.W),H=Math.max(1,g.H),keep=g.keep||[],enemy=g.enemy||null,x=ANCHORS.map(a=>a[1]*W);
 const front=Math.min(.92*H,H-CLEAR),low=Math.min(.71*H,front-GAP);
 // The highest a flank fighter's head may go: below anything it would cover in its own column.
 const ceiling=s=>Math.max(0,...[0,1].flatMap(side=>keep.filter(k=>overlapsX(k,x[side]-s/2,x[side]+s/2)).map(k=>k.b+4)));
 // The largest size every rule allows for fighters of size s. It only grows as s shrinks, so stepping down from the
 // largest size lands on the biggest size that keeps all of them.
 function allowed(s){
  // Up to about 18% of the scene's height (Joshua's 38–50px in a 300px scene, a little more on tall screens).
  let fit=Math.min(MAX,.18*H);
  // Three flank fighters share the column from A down to E, each clear of the next. A starts at its anchor, or lower
  // when a button above would be covered.
  const top=ceiling(s);
  fit=Math.min(fit,((low-.35*H)/2-GAP)/VISIBLE,(low-top-2*GAP)/(1+2*VISIBLE));
  // E and G are close sideways, so G's head stays below E's feet unless they're far enough apart.
  if(x[6]-x[4]<s+GAP)fit=Math.min(fit,(front-low-GAP)/VISIBLE);
  // Front fighters stand side by side, clear of each other.
  fit=Math.min(fit,(x[7]-x[6]-GAP)/VISIBLE);
  // Flank fighters stay outside the enemy's body (its art fills about the middle 70% of its box).
  if(enemy&&enemy.r>enemy.l){const inset=(enemy.r-enemy.l)*.15;fit=Math.min(fit,2*(enemy.l+inset-GAP-x[0]),2*(x[1]-GAP-enemy.r+inset));}
  return fit;
 }
 let s=MAX;for(let round=0;round<12;round++){const next=Math.max(MIN,Math.floor(allowed(s)));if(next>=s)break;s=next;}
 const high=Math.max(.35*H,ceiling(s)+s),mid=(high+low)/2,ys=[high,high,mid,mid,low,low,front,front,front,front];
 return {size:s,points:ANCHORS.map(([name],i)=>({slot:i,name,x:x[i],y:ys[i],side:i<6?(i%2?1:-1):0}))};
}
// A short lunge toward the near edge of the enemy for each anchor, then back (CSS keyframes use these).
function lunge(p,enemy,size){
 if(!enemy)return {x:p.side?-p.side*16:0,y:p.side?0:-14};
 const cx=(enemy.l+enemy.r)/2,cy=(enemy.t+enemy.b)/2;
 if(p.side)return {x:-p.side*16,y:Math.max(-8,Math.min(8,(cy-(p.y-size/2))*.12))};
 return {x:Math.max(-6,Math.min(6,(cx-p.x)*.08)),y:-14};
}
// Which party place each fighter on screen holds: the lead is #boundSprite, then #battleFollower1, 2… in party order.
function places(s){const out=[];(s?.party?.slots||[]).forEach((id,i)=>{if(id)out.push(i);});return out;}
let last='',ready=false;
function rect(e,box){const r=e.getBoundingClientRect();return {l:r.left-box.left,t:r.top-box.top,r:r.right-box.left,b:r.bottom-box.top,w:r.width,h:r.height};}
// Measures the scene and puts every fighter on its anchor. Cheap to call often: nothing changes unless the scene,
// the enemy, the buttons or the party did.
function place(force=false){
 // The game keeps its save in adventure.js's top-level `state`, which isn't a property of the global object.
 const doc=root.document,stage=doc?.getElementById?.('partyStage'),s=typeof state!=='undefined'?state:null;
 if(!stage?.getBoundingClientRect||!s)return null;
 const box=stage.getBoundingClientRect();if(!box.width||!box.height)return null;
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const keep=[...doc.querySelectorAll('.dock-scene-shortcuts>*,#battlefield .enemy-info')].filter(visible).map(e=>rect(e,box));
 const foe=doc.getElementById('enemySprite'),enemy=foe&&visible(foe)?rect(foe,box):null,slots=places(s);
 const actors=[doc.getElementById('boundSprite'),...slots.slice(1).map((_,i)=>doc.getElementById('battleFollower'+(i+1)))];
 const key=JSON.stringify([Math.round(box.width),Math.round(box.height),keep.map(k=>[k.l,k.t,k.r,k.b].map(Math.round)),enemy&&[enemy.l,enemy.t,enemy.r,enemy.b].map(Math.round),slots,actors.map(a=>a?.id)]);
 if(!force&&key===last)return null;last=key;
 const f=solve({W:box.width,H:box.height,keep,enemy});
 stage.style.setProperty('--fighter-size',f.size+'px');
 actors.forEach((actor,i)=>{const p=f.points[slots[i]];if(!actor||!p)return;const l=lunge(p,enemy,f.size);
  actor.dataset.anchor=p.name;actor.style.left=(p.x/box.width*100).toFixed(2)+'%';actor.style.top=(p.y/box.height*100).toFixed(2)+'%';
  actor.style.zIndex=String(10+Math.round(p.y));actor.style.setProperty('--lunge-x',l.x.toFixed(1)+'px');actor.style.setProperty('--lunge-y',l.y.toFixed(1)+'px');
  actor.style.setProperty('--idle-delay',(-.37*slots[i]).toFixed(2)+'s');actor.style.removeProperty('--court-depth');});
 // Fighters glide to new anchors only after they've been placed once, so nothing slides in on load.
 if(!ready){ready=true;root.requestAnimationFrame?.(()=>stage.classList.add('formation-ready'));}
 return f;
}
// adventure.js battleAttack(): the bolt leaves the fighter's body and flies to the enemy's middle, pointing the way it goes.
function aim(actor,bolt){
 const doc=root.document,stage=doc?.getElementById?.('partyStage'),foe=doc?.getElementById?.('enemySprite');
 if(!actor?.getBoundingClientRect||!bolt?.style||!stage?.getBoundingClientRect)return;
 const box=stage.getBoundingClientRect(),a=actor.getBoundingClientRect(),e=foe?.getBoundingClientRect?.();if(!box.width||!a.width)return;
 const x=a.left+a.width/2-box.left,y=a.top+a.height*.45-box.top,hit=e&&e.width>0;
 const dx=(hit?e.left+e.width/2-box.left:box.width/2)-x,dy=(hit?e.top+e.height*.55-box.top:y-75)-y;
 bolt.style.left=(x-8).toFixed(1)+'px';bolt.style.top=(y-12).toFixed(1)+'px';
 bolt.style.setProperty('--bolt-dx',dx.toFixed(1)+'px');bolt.style.setProperty('--bolt-dy',dy.toFixed(1)+'px');
 bolt.style.setProperty('--bolt-angle',(Math.atan2(dx,-dy)*180/Math.PI).toFixed(1)+'deg');
}
function watch(){const stage=root.document?.getElementById?.('partyStage');if(!stage||typeof root.ResizeObserver!=='function')return;new root.ResizeObserver(()=>place()).observe(stage);root.setInterval?.(()=>place(),500);}
const api={ANCHORS,solve,lunge,places,place,aim};
root.LoreFormation=api;if(typeof module!=='undefined')module.exports=api;
if(root.document?.readyState&&root.document.readyState!=='loading')watch();else root.document?.addEventListener?.('DOMContentLoaded',watch);
})(globalThis);
