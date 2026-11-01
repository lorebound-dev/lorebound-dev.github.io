/* Ruins Reclaimed: a test-site-only prototype of a small forest-clearing minigame, shown by the Haven tab.
 * Everything here is original code. The 2:1 isometric math is the standard textbook projection, worker paths use a plain
 * breadth-first search and the easing is two standard curves. Nothing is copied from mykonos-island-voxels, EasyStar.js,
 * Tween.js or clicker-engine (see docs/RUINS-RECLAIMED-PROTOTYPE.md for why, and for the data flow).
 * It never reads or writes the LOREBOUND save. Its demo Wood, tools and workers live only in memory and in its own
 * localStorage key, lorebound-ruins-prototype-v01, and only on the test site or a local copy.
 * All numbers in CONFIG are placeholder demo tuning, not approved economy. */
(function(root){'use strict';

const KEY='lorebound-ruins-prototype-v01';
const CONFIG=Object.freeze({
  version:1,
  size:8,                 // 8×8 clearing
  woodPerTree:1,          // manual Wood per tree at Better Tools level 0
  toolsStep:1,            // +1 manual Wood per tree per Better Tools level
  toolsBase:10,toolsGrowth:1.6,toolsMax:10,
  workerYield:1,          // Wood per tree a worker clears
  workerBase:25,workerGrowth:1.8,workerMax:5,
  workerTickMs:5000,      // a worker clears at most one tree every 5 seconds while Ruins is open
  stepMs:380,             // a worker walks one tile in 0.38 s
  chopMs:1200,            // and chops for 1.2 s before the tree comes down
  retryMs:1000,           // a worker with nothing it can reach looks again after 1 s, not every frame
  treeCounts:[14,16,18],  // trees per patch, cycling
});

// Four pre-defined ruins. Each sits on the same 2×2 footprint in the middle and has its own buried stone path.
const RUINS=[
  {id:'gate',name:'Old Gate',path:[[0,4],[1,4],[2,4],[5,4],[6,4],[7,4]]},
  {id:'well',name:'Stone Well',path:[[3,0],[3,1],[3,2],[4,5],[4,6],[4,7]]},
  {id:'shelter',name:'Ranger Shelter',path:[[0,0],[1,1],[2,2],[5,5],[6,6],[7,7]]},
  {id:'tower',name:'Watch Tower',path:[[7,3],[6,3],[5,3],[0,4],[1,4],[2,4]]},
];
const FOOT=[[3,3],[4,3],[3,4],[4,4]];
const ROMAN=['','',' II',' III',' IV',' V',' VI',' VII',' VIII',' IX',' X'];
const N=CONFIG.size,at=(c,r)=>r*N+c,inside=(c,r)=>c>=0&&r>=0&&c<N&&r<N;

// Small deterministic generator so every player sees the same patches.
function seeded(seed){let s=(seed*2654435761+97)>>>0;return()=>{s=(Math.imul(s^(s>>>15),2246822519)+3266489917)>>>0;return((s^(s>>>13))>>>0)/4294967296;};}
const patches=new Map();
function patch(index){
  if(patches.has(index))return patches.get(index);
  const ruin=RUINS[index%RUINS.length],n=N*N,rand=seeded(index+1),foot=new Set(FOOT.map(([c,r])=>at(c,r)));
  const path=new Set(ruin.path.map(([c,r])=>at(c,r))),want=CONFIG.treeCounts[index%CONFIG.treeCounts.length];
  const free=[];for(let i=0;i<n;i++)if(!foot.has(i)&&!path.has(i))free.push(i);
  for(let i=free.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[free[i],free[j]]=[free[j],free[i]];}
  const trees=[...path,...free.slice(0,want-path.size)].sort((a,b)=>a-b),rocks=free.slice(want-path.size,want-path.size+3);
  const kind={};for(const t of trees){const v=rand();kind[t]=v<.42?'pine':v<.84?'oak':'bush';}
  const round=Math.floor(index/RUINS.length)+1;
  const p=Object.freeze({index,ruin,name:ruin.name+(ROMAN[round]??' '+round),trees,treeSet:new Set(trees),rocks:new Set(rocks),path,foot,kind,shade:Array.from({length:n},()=>rand())});
  patches.set(index,p);return p;
}

function fresh(){return{v:CONFIG.version,wood:0,tools:0,workers:0,patch:0,cleared:[]};}
const int=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
// Strict check of stored demo data; anything unexpected starts a fresh demo instead of guessing.
function validate(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return null;
  const keys=Object.keys(o).sort().join();if(keys!=='cleared,patch,tools,v,wood,workers')return null;
  if(o.v!==CONFIG.version||!int(o.wood,0,1e9)||!int(o.tools,0,CONFIG.toolsMax)||!int(o.workers,0,CONFIG.workerMax)||!int(o.patch,0,9999)||!Array.isArray(o.cleared))return null;
  const p=patch(o.patch),seen=new Set();
  for(const t of o.cleared){if(!p.treeSet.has(t)||seen.has(t))return null;seen.add(t);}
  return{v:o.v,wood:o.wood,tools:o.tools,workers:o.workers,patch:o.patch,cleared:[...o.cleared]};
}
const cost=(s,kind)=>kind==='tools'?(s.tools>=CONFIG.toolsMax?null:Math.round(CONFIG.toolsBase*CONFIG.toolsGrowth**s.tools)):kind==='worker'?(s.workers>=CONFIG.workerMax?null:Math.round(CONFIG.workerBase*CONFIG.workerGrowth**s.workers)):null;
const manualYield=s=>CONFIG.woodPerTree+s.tools*CONFIG.toolsStep;
const remaining=s=>{const done=new Set(s.cleared);return patch(s.patch).trees.filter(t=>!done.has(t));};
const complete=s=>s.cleared.length===patch(s.patch).trees.length;
// 0 overgrown · 1 path restored (a third cleared) · 2 foundation rebuilt (two thirds) · 3 ruin reclaimed (all cleared)
const stage=s=>{const d=s.cleared.length,t=patch(s.patch).trees.length;return d>=t?3:d*3>=t*2?2:d*3>=t?1:0;};
// Each tree pays out once. A tile that is not a tree, or already cleared, gives nothing.
function clear(s,tile,source){if(!patch(s.patch).treeSet.has(tile)||s.cleared.includes(tile))return 0;const gain=source==='worker'?CONFIG.workerYield:manualYield(s);s.cleared.push(tile);s.wood+=gain;return gain;}
function buy(s,kind){const c=cost(s,kind);if(c===null)return{ok:false,reason:'max'};if(s.wood<c)return{ok:false,reason:'wood',need:c-s.wood};s.wood-=c;if(kind==='tools')s.tools++;else s.workers++;return{ok:true,cost:c};}
function advance(s){if(!complete(s))return false;s.patch++;s.cleared=[];return true;}

/* ---------- Workers ----------
 * Workers walk in from the forest edge: a one-tile ring just outside the clearing is always walkable. Inside, they walk
 * only on open ground (not on standing trees, rocks or the ruin) and only in the four straight directions. They chop
 * from any of the eight tiles around a tree. Their positions are not saved; they walk in again after a reload. */
function blocked(s){const p=patch(s.patch),done=new Set(s.cleared),b=new Set([...p.rocks,...p.foot]);for(const t of p.trees)if(!done.has(t))b.add(t);return b;}
function walkable(s,c,r,b=blocked(s)){if(c<-1||r<-1||c>N||r>N)return false;return !inside(c,r)||!b.has(at(c,r));}
// Nearest unclaimed tree a worker at (c,r) can reach. Plain breadth-first search over at most 100 tiles, run only when a
// worker needs a new tree, never every frame. Returns the steps to walk (excluding the start) and the tree.
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]],AROUND=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
function route(s,c,r,claimed=new Set()){
  const b=blocked(s),left=new Set(remaining(s).filter(t=>!claimed.has(t))),W=N+2,id=(c,r)=>(r+1)*W+(c+1),from=new Map([[id(c,r),null]]),queue=[[c,r]];
  if(!left.size)return null;
  for(let q=0;q<queue.length;q++){const [x,y]=queue[q];
    for(const [dx,dy] of AROUND){const tc=x+dx,tr=y+dy;if(inside(tc,tr)&&left.has(at(tc,tr))){const steps=[];for(let k=id(x,y),cell=[x,y];from.get(k)!==null;){steps.unshift(cell);cell=from.get(k);k=id(cell[0],cell[1]);}return{tree:at(tc,tr),steps};}}
    for(const [dx,dy] of DIRS){const nc=x+dx,nr=y+dy,k=id(nc,nr);if(!from.has(k)&&walkable(s,nc,nr,b)){from.set(k,[x,y]);queue.push([nc,nr]);}}}
  return null;
}
const SPAWN=[[N,5],[5,N],[N,2],[2,N],[N,7]];   // ring tiles along the two front edges
function crewMember(k){const [c,r]=SPAWN[k%SPAWN.length];return{k,c,r,steps:[],tree:null,phase:'idle',t:0,since:CONFIG.workerTickMs,wait:0,face:1,stuck:false};}
function syncCrew(s,crew){while(crew.length<s.workers)crew.push(crewMember(crew.length));crew.length=Math.min(crew.length,s.workers);return crew;}
/* Moves every worker on by dt milliseconds. The caller keeps dt small (at most 100 ms per frame), so time spent away
 * is never made up. Returns what happened, for the display. A tree is only ever paid for by clear(), which pays once. */
function simulate(s,crew,dt){
  const events=[];syncCrew(s,crew);
  for(const w of crew){let left=dt;
    while(left>0){
      // w.since is the time since this worker last brought a tree down. A tree only comes down once it is at least
      // workerTickMs, so a worker clears at most one tree every 5 s however close the next tree is.
      if(w.phase==='idle'){
        if(w.wait>0){const d=Math.min(w.wait,left);w.wait-=d;w.since+=d;left-=d;continue;}
        if(complete(s)){w.wait=CONFIG.retryMs;continue;}
        const claimed=new Set(crew.filter(o=>o!==w&&o.tree!==null).map(o=>o.tree)),plan=route(s,w.c,w.r,claimed);
        if(!plan){w.wait=CONFIG.retryMs;if(!w.stuck)events.push({type:'stuck',worker:w.k});w.stuck=true;continue;}
        w.stuck=false;w.tree=plan.tree;w.steps=plan.steps;w.phase=plan.steps.length?'walk':'chop';w.t=0;events.push({type:'target',worker:w.k,tree:w.tree});continue;}
      const gone=w.tree===null||s.cleared.includes(w.tree);
      if(w.phase==='walk'){
        // Only change course on a tile, never halfway between two.
        if(gone&&w.t===0){w.phase='idle';w.tree=null;w.steps=[];continue;}
        const d=Math.min(left,CONFIG.stepMs-w.t);w.t+=d;w.since+=d;left-=d;
        if(w.t>=CONFIG.stepMs){const [nc,nr]=w.steps.shift();w.c=nc;w.r=nr;w.t=0;if(!w.steps.length)w.phase=gone?'idle':'chop';if(w.phase==='idle')w.tree=null;}
        continue;}
      if(w.phase==='chop'){
        if(gone){w.phase='idle';w.tree=null;w.t=0;continue;}
        const d=Math.min(left,Math.max(CONFIG.chopMs-w.t,CONFIG.workerTickMs-w.since));w.t+=d;w.since+=d;left-=d;
        if(w.t>=CONFIG.chopMs&&w.since>=CONFIG.workerTickMs){const tree=w.tree,gain=clear(s,tree,'worker');w.tree=null;w.t=0;w.since=0;w.phase='idle';if(gain)events.push({type:'clear',worker:w.k,tree,gain});}
        continue;}
      left=0;}}
  return events;
}
function resetCrew(crew){crew.length=0;}
// Where a worker is drawn, in tile units, and how far through its step it is.
function crewPosition(w,smooth){if(w.phase!=='walk'||!w.steps.length)return[w.c,w.r];const k=w.t/CONFIG.stepMs,e=smooth?easeInOut(k):k<.5?0:1,[nc,nr]=w.steps[0];return[w.c+(nc-w.c)*e,w.r+(nr-w.r)*e];}
const easeInOut=k=>.5-Math.cos(Math.PI*k)/2,easeOut=k=>1-(1-k)**3;

const logic={KEY,CONFIG,RUINS,patch,fresh,validate,cost,manualYield,remaining,complete,stage,clear,buy,advance,blocked,walkable,route,simulate,syncCrew,crewPosition};

/* ---------- Everything below needs a browser. ---------- */
let state=null,view=null,raf=0,lastFrame=0,anims=[],resetArmed=0,lastStage=-1;const crew=[];
const host=root.location?.hostname||'';
const TEST=host==='lorebound-dev.github.io'||host==='localhost'||host==='127.0.0.1';
root.LoreRuinsReclaimed={...logic,TEST,mount,unmount,crew,get mounted(){return !!view;},get running(){return !!raf;}};
if(typeof document==='undefined')return;

const motionQuery=root.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced=()=>!!motionQuery?.matches;
function load(){if(state)return state;let s=null;try{s=validate(JSON.parse(root.localStorage.getItem(KEY)||'null'));}catch{}return state=s||fresh();}
function store(){try{root.localStorage.setItem(KEY,JSON.stringify(state));}catch{}}

const SKETCH=`<section class="ruins-proto" aria-labelledby="ruinsTitle">
<header class="ruins-head"><div><small>Test prototype</small><h3 id="ruinsTitle">Ruins Reclaimed</h3></div><span class="ruins-head-actions"><button type="button" class="ruins-help-toggle" aria-expanded="false" aria-controls="ruinsHelp" aria-label="How Ruins Reclaimed works">?</button></span></header>
<div class="ruins-help" id="ruinsHelp" hidden><p>Tap a tree to clear it for Wood. Clearing a patch rebuilds the old ruin in its middle, then you can move on to the next patch.</p><p>Better Tools gives more Wood per tree you clear. A worker walks to a tree, chops it down and brings 1 Wood, at most one tree every ${CONFIG.workerTickMs/1000} seconds, and only while this screen is open.</p><p>This is a test. Wood stays here and never touches your Gold, Shards, Essence or save. Numbers are placeholders.</p><button type="button" data-ruins="reset">Reset demo</button></div>
<dl class="ruins-stats"><div><dt>Wood</dt><dd id="ruinsWood">0</dd></div><div><dt id="ruinsPatch">Patch</dt><dd id="ruinsCleared">Cleared 0 / 0</dd></div></dl>
<div class="ruins-scene"><canvas id="ruinsCanvas" tabindex="0" role="img"></canvas><p class="ruins-work" id="ruinsWorkText" hidden></p></div>
<p class="ruins-stage" id="ruinsStage" role="status" aria-live="polite"></p>
<button type="button" class="ruins-continue" data-ruins="continue" hidden>Continue to next patch</button>
<div class="ruins-upgrades">
<button type="button" class="ruins-upgrade" data-ruins="tools"><span><strong></strong><small></small></span><b></b></button>
<button type="button" class="ruins-upgrade" data-ruins="worker"><span><strong></strong><small></small></span><b></b></button>
</div>
</section>`;

function mount(slot){
  if(view&&view.root.parentNode===slot)return;
  unmount();load();
  const wrap=document.createElement('div');wrap.innerHTML=SKETCH;const el=wrap.firstElementChild;slot.replaceChildren(el);
  const q=s=>el.querySelector(s);
  view={root:el,canvas:q('#ruinsCanvas'),wood:q('#ruinsWood'),patch:q('#ruinsPatch'),cleared:q('#ruinsCleared'),stage:q('#ruinsStage'),cont:q('.ruins-continue'),tools:q('[data-ruins=tools]'),worker:q('[data-ruins=worker]'),workText:q('#ruinsWorkText'),help:q('#ruinsHelp'),helpToggle:q('.ruins-help-toggle'),reset:q('[data-ruins=reset]'),geo:null,down:null};
  el.addEventListener('click',onClick);
  view.canvas.addEventListener('pointerdown',onDown);view.canvas.addEventListener('pointerup',onUp);view.canvas.addEventListener('pointercancel',()=>{if(view)view.down=null;});
  view.canvas.addEventListener('keydown',onKey);
  root.addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVisible);
  lastStage=stage(state);syncCrew(state,crew);
  layout();update();wake();
}
function unmount(){
  if(!view)return;sleep();anims=[];
  root.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible);
  view.root.remove();view=null;
}

/* One clock: a single requestAnimationFrame loop, only while Ruins is open and the page is visible, and only while
 * workers have something to do or an effect is playing. Each frame moves time on by at most 100 ms: no catch-up. */
const busy=()=>(state.workers>0&&!complete(state))||anims.length>0;
function wake(){if(!view||raf||document.hidden||!busy())return;lastFrame=0;raf=root.requestAnimationFrame(frame);}
function sleep(){if(raf)root.cancelAnimationFrame(raf);raf=0;lastFrame=0;}
function frame(now){
  raf=0;if(!view||document.hidden)return;
  const dt=lastFrame?Math.min(100,Math.max(0,now-lastFrame)):0;lastFrame=now;
  if(state.workers>0&&!complete(state)&&dt>0){
    const events=simulate(state,crew,dt);let paid=false;
    for(const e of events)if(e.type==='clear'){paid=true;fell(e.tree,e.gain,true);}
    if(paid){store();update();}else workLine();
  }
  draw(now);
  if(busy()){raf=root.requestAnimationFrame(frame);}else lastFrame=0;
}
function onVisible(){if(!view)return;if(document.hidden){sleep();store();}else{wake();}}

/* Input: a short press without much movement is a tap. Vertical swipes scroll the page (touch-action: pan-y). */
function onDown(e){if(e.button>0)return;view.down={x:e.clientX,y:e.clientY,t:Date.now(),id:e.pointerId};}
function onUp(e){const d=view?.down;if(!d||d.id!==e.pointerId)return;view.down=null;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>12||Date.now()-d.t>700)return;
  const box=view.canvas.getBoundingClientRect(),tile=hit(e.clientX-box.left,e.clientY-box.top);if(tile!==null)chop(tile);}
function onKey(e){if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();const left=remaining(state);if(left.length)chop(left[left.length-1]);}
// A worker heading for a tree the player clears first simply picks another one; nobody is paid twice.
function chop(tile){const g=clear(state,tile,'manual');if(!g)return;store();fell(tile,g,false);update();wake();}
function onClick(e){
  const b=e.target.closest?.('button');if(!b||!view)return;
  if(b===view.helpToggle){const open=view.help.hidden;view.help.hidden=!open;b.setAttribute('aria-expanded',String(open));return;}
  const what=b.dataset.ruins;
  if(what==='tools'||what==='worker'){const r=buy(state,what);if(r.ok){store();if(what==='worker')syncCrew(state,crew);say(what==='tools'?`Better Tools level ${state.tools}. Each tree you clear now gives ${manualYield(state)} Wood.`:`Worker hired. ${state.workers} worker${state.workers>1?'s are':' is'} on the way.`);update();wake();}return;}
  if(what==='continue'){if(advance(state)){store();resetCrew(crew);syncCrew(state,crew);anims=anims.filter(a=>a.type==='pop');lastStage=0;say(`On to ${patch(state.patch).name}. ${state.patch} ruin${state.patch>1?'s':''} reclaimed so far.`);update();wake();view.canvas.focus({preventScroll:true});}return;}
  if(what==='reset'){if(Date.now()-resetArmed>3000){resetArmed=Date.now();b.textContent='Tap again to reset the demo';return;}
    resetArmed=0;b.textContent='Reset demo';state=fresh();resetCrew(crew);anims=[];try{root.localStorage.removeItem(KEY);}catch{}lastStage=0;say('Demo reset. Only Ruins Reclaimed was cleared.');update();}
}
function say(text){if(view)view.stage.textContent=text;}

/* Display */
function update(){
  if(!view)return;const p=patch(state.patch),s=stage(state),done=complete(state);
  view.wood.textContent=state.wood.toLocaleString('en-US');view.patch.textContent=`Patch ${state.patch+1} · ${p.name}`;view.cleared.textContent=`Cleared ${state.cleared.length} / ${p.trees.length}`;
  if(s!==lastStage){const was=lastStage;lastStage=s;if(was>=0&&s>was){say(s===1?'The old stone path shows again.':s===2?`The ${p.ruin.name.toLowerCase()}'s foundation is rebuilt.`:`${p.name} is reclaimed. Continue when you're ready.`);if(!reduced())anims.push({type:'rise',from:was,to:s,t0:performance.now(),life:900});}}
  if(!view.stage.textContent)say(done?`${p.name} is reclaimed. Continue when you're ready.`:'Tap a tree to clear it.');
  view.cont.hidden=!done;
  upgrade(view.tools,'tools',`Better Tools · Lv ${state.tools}`,state.tools>=CONFIG.toolsMax?`${manualYield(state)} Wood per tree you clear`:`${manualYield(state)} → ${manualYield(state)+CONFIG.toolsStep} Wood per tree you clear`);
  upgrade(view.worker,'worker',`Hire Worker · ${state.workers} hired`,state.workers>=CONFIG.workerMax?'All worker places filled':`+1 worker who walks to trees and clears them`);
  view.canvas.setAttribute('aria-label',`${p.name} clearing. ${remaining(state).length} trees left. ${['Overgrown ruins.','Stone path restored.','Foundation rebuilt.','Ruin reclaimed.'][s]} Tap a tree, or press Enter, to clear one.`);
  workLine();draw();
}
let workText='';
function workLine(){
  if(!view)return;const n=state.workers;let t='';
  if(n){if(complete(state))t=`${n===1?'Your worker waits':'Your workers wait'} for the next patch`;
    else{const chopping=crew.filter(w=>w.phase==='chop').length,walking=crew.filter(w=>w.phase==='walk').length,stuck=crew.filter(w=>w.stuck).length;
      t=n===1?(chopping?'Your worker is chopping':walking?'Your worker is walking to a tree':'Your worker is resting'):`${n} workers · ${walking} walking · ${chopping} chopping`;
      if(stuck===n&&remaining(state).length)t='Workers can’t reach the trees left. Tap them yourself.';}}
  if(t!==workText){workText=t;view.workText.textContent=t;}view.workText.hidden=!t;
}
function upgrade(btn,kind,title,detail){const c=cost(state,kind),short=c!==null&&state.wood<c;btn.querySelector('strong').textContent=title;
  btn.querySelector('small').textContent=c===null?detail:short?`${detail} · need ${c-state.wood} more Wood`:detail;btn.querySelector('b').textContent=c===null?'Max':`${c} Wood`;
  btn.disabled=c===null||short;btn.setAttribute('aria-label',`${title}. ${btn.querySelector('small').textContent}. ${c===null?'Maximum level.':'Costs '+c+' Wood.'}`);}

/* Isometric canvas. Tile (c,r) has its top corner at ox+(c-r)·w/2, oy+(c+r)·h/2 with h = w/2. */
function onResize(){if(!view)return;layout();draw();}
function layout(){
  const cv=view.canvas,cssW=Math.max(240,Math.min(cv.parentNode.clientWidth||300,400));
  const w=Math.floor(cssW/(N+1.4)/2)*2,h=w/2,top=Math.round(w*1.5),cssH=Math.round(top+N*h+w*1.1+6),dpr=Math.min(root.devicePixelRatio||1,3);
  cv.style.width=cssW+'px';cv.style.height=cssH+'px';cv.width=Math.round(cssW*dpr);cv.height=Math.round(cssH*dpr);
  view.geo={w,h,ox:Math.round(cssW/2),oy:top,dpr,cssW,cssH};
}
const iso=(g,c,r)=>[g.ox+(c-r)*g.w/2,g.oy+(c+r)*g.h/2];
function hit(x,y){
  const g=view.geo;if(!g)return null;const left=remaining(state);
  // Front trees first; a tap on a canopy counts for that tree.
  for(const t of [...left].sort((a,b)=>(b%N+Math.floor(b/N))-(a%N+Math.floor(a/N)))){
    const [cx,cy]=iso(g,t%N+.5,Math.floor(t/N)+.5);if(Math.abs(x-cx)<=g.w*.38&&y<=cy+g.h*.45&&y>=cy-g.w*1.35)return t;}
  const u=(x-g.ox)/(g.w/2),v=(y-g.oy)/(g.h/2),c=Math.floor((u+v)/2),r=Math.floor((v-u)/2);
  if(!inside(c,r))return null;return at(c,r);
}
function poly(ctx,pts,fill){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function diamond(ctx,g,c,r,fill,edge){const a=iso(g,c,r),b=iso(g,c+1,r),d=iso(g,c+1,r+1),e=iso(g,c,r+1);poly(ctx,[a,b,d,e],fill);if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}}
// A box standing on the ground at (x,y), half-width hw (px along x), height ht. Top, left and right faces.
function box(ctx,x,y,hw,ht,top,left,right){const hh=hw/2;poly(ctx,[[x-hw,y],[x,y+hh],[x,y+hh-ht],[x-hw,y-ht]],left);poly(ctx,[[x+hw,y],[x,y+hh],[x,y+hh-ht],[x+hw,y-ht]],right);poly(ctx,[[x,y-hh-ht],[x+hw,y-ht],[x,y+hh-ht],[x-hw,y-ht]],top);}
const C={grass:['#2f5a3a','#36643f','#2b5236'],edge:'#1f3c29',dirtL:'#3b2d22',dirtR:'#2a2019',stone:'#7d7a6d',stoneHi:'#a7a08a',stoneLo:'#55544b',faint:'#4a5a48',moss:'#3d6b48',trunk:'#5a3d26',pine:['#163d2b','#1f5238','#2c6b48'],oak:['#1d4a2f','#2a6340','#3f8455'],bush:['#2a5c37','#3b7a4a'],brass:'#d6bd81',water:'#2f5f73',roof:'#6e3f2e',roofHi:'#8b5440',wood:'#7a5534',lantern:'#f3c46a'};

function draw(now){
  if(!view?.geo)return;const g=view.geo,ctx=view.canvas.getContext('2d');if(!ctx)return;now=now||performance.now();
  ctx.setTransform(g.dpr,0,0,g.dpr,0,0);ctx.clearRect(0,0,g.cssW,g.cssH);
  const p=patch(state.patch),done=new Set(state.cleared),s=stage(state),smooth=!reduced();
  anims=anims.filter(a=>now-a.t0<a.life);
  const rise=anims.find(a=>a.type==='rise');
  // Earth slab under the clearing
  const L=iso(g,0,N),B=iso(g,N,N),R=iso(g,N,0),depth=Math.round(g.w*.3);
  poly(ctx,[L,B,[B[0],B[1]+depth],[L[0],L[1]+depth]],C.dirtL);poly(ctx,[B,R,[R[0],R[1]+depth],[B[0],B[1]+depth]],C.dirtR);
  // Ground layer
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){const i=at(c,r);
    if(p.foot.has(i))diamond(ctx,g,c,r,s>=2?C.stoneHi:C.faint,C.stoneLo);
    else if(p.path.has(i)&&done.has(i))diamond(ctx,g,c,r,s>=1?C.stone:C.faint,s>=1?C.stoneLo:C.edge);
    else diamond(ctx,g,c,r,C.grass[Math.floor(p.shade[i]*3)],C.edge);}
  // Objects back to front
  const objs=[],falling=new Map(anims.filter(a=>a.type==='fall').map(a=>[a.tile,a]));
  for(let i=0;i<N*N;i++){const c=i%N,r=Math.floor(i/N);
    if(p.treeSet.has(i)){
      if(!done.has(i))objs.push([c+r,()=>tree(ctx,g,c,r,p.kind[i],p.shade[i])]);
      else{if(!p.path.has(i))objs.push([c+r-.1,()=>stump(ctx,g,c,r)]);const f=falling.get(i);if(f)objs.push([c+r,()=>fallingTree(ctx,g,c,r,p.kind[i],p.shade[i],(now-f.t0)/f.life,f.dir)]);}}
    else if(p.rocks.has(i))objs.push([c+r,()=>rock(ctx,g,c,r,p.shade[i])]);}
  objs.push([8,()=>{if(rise)riseRuin(ctx,g,p.ruin.id,rise,now);else ruin(ctx,g,p.ruin.id,s);}]);
  if(state.workers>0)for(const w of crew){const [wc,wr]=crewPosition(w,smooth);objs.push([wc+wr+.05,()=>worker(ctx,g,w,wc,wr,now,smooth)]);}
  objs.sort((a,b)=>a[0]-b[0]).forEach(o=>o[1]());
  // Leaves and floating Wood
  for(const a of anims){if(a.type!=='pop'||now<a.t0)continue;const k=Math.min(1,(now-a.t0)/a.life),[x,y]=iso(g,a.c+.5,a.r+.5);
    if(a.leaves){ctx.fillStyle=C.oak[2];const e=easeOut(k);for(let j=0;j<7;j++){const ang=j/7*Math.PI*2,d=4+e*g.w*.6;ctx.globalAlpha=1-k;ctx.fillRect(Math.round(x+Math.cos(ang)*d)-2,Math.round(y-g.w*.4+Math.sin(ang)*d*.6+k*10)-2,4,4);}}
    const lift=smooth?easeOut(k)*20:0;ctx.globalAlpha=Math.max(0,1-k*k);ctx.font='bold 13px Georgia,serif';ctx.textAlign='center';ctx.fillStyle='#000a';ctx.fillText(`+${a.gain}`,x+1,y-g.w*.9-lift+1);ctx.fillStyle=a.worker?'#9fd8c0':C.brass;ctx.fillText(`+${a.gain}`,x,y-g.w*.9-lift);ctx.globalAlpha=1;}
}
// A cleared tree tips over and fades, then its leaves burst and the Wood floats up. With reduced motion only the "+N" shows.
function fell(tile,gain,byWorker){const now=performance.now(),c=tile%N,r=Math.floor(tile/N),smooth=!reduced();
  if(smooth){const w=byWorker?crew.find(x=>x.c!==undefined&&Math.abs(x.c-c)<=1&&Math.abs(x.r-r)<=1):null;anims.push({type:'fall',tile,t0:now,life:420,dir:w&&w.c-w.r>c-r?-1:1});}
  anims.push({type:'pop',c,r,gain,worker:byWorker,leaves:smooth,t0:smooth?now+300:now,life:smooth?850:1100});}

function tree(ctx,g,c,r,kind,v){const [x,y0]=iso(g,c+.5,r+.5),w=g.w,y=Math.round(y0),X=Math.round(x+(v-.5)*w*.12);
  if(kind==='bush'){const cl=C.bush;ctx.fillStyle='#0004';ctx.fillRect(X-w*.26,y-2,w*.52,4);ctx.fillStyle=cl[0];ctx.fillRect(X-w*.26,y-w*.3,w*.52,w*.3);ctx.fillRect(X-w*.18,y-w*.4,w*.36,w*.1);ctx.fillStyle=cl[1];ctx.fillRect(X-w*.14,y-w*.36,w*.16,w*.1);return;}
  ctx.fillStyle='#0005';ctx.fillRect(X-w*.22,y-2,w*.44,4);ctx.fillStyle=C.trunk;ctx.fillRect(X-Math.max(2,w*.05),y-w*.42,Math.max(4,w*.1),w*.42);
  if(kind==='pine'){const cl=C.pine,tall=w*(1.15+v*.2);for(let k=0;k<3;k++){const b=y-w*.3-k*tall*.26,half=w*(.36-k*.08);poly(ctx,[[X,b-tall*.36],[X+half,b],[X-half,b]],cl[k===2?2:k]);}ctx.fillStyle=cl[2];ctx.fillRect(X-w*.12,y-w*.5,w*.08,w*.08);return;}
  const cl=C.oak,cy=y-w*(.78+v*.12),rr=w*.33;ctx.fillStyle=cl[0];ctx.fillRect(X-rr,cy-rr*.6,rr*2,rr*1.4);ctx.fillRect(X-rr*.7,cy-rr,rr*1.4,rr*2);ctx.fillStyle=cl[1];ctx.fillRect(X-rr*.75,cy-rr*.8,rr*1.2,rr*1.1);ctx.fillStyle=cl[2];ctx.fillRect(X-rr*.5,cy-rr*.7,rr*.5,rr*.4);}
function fallingTree(ctx,g,c,r,kind,v,k,dir){if(k<0||k>=1)return;const [x,y]=iso(g,c+.5,r+.5),e=k*k;ctx.save();ctx.globalAlpha=1-Math.max(0,(k-.55)/.45);ctx.translate(Math.round(x),Math.round(y));ctx.rotate(dir*e*Math.PI*.45);ctx.translate(-Math.round(x),-Math.round(y));tree(ctx,g,c,r,kind,v);ctx.restore();}
function stump(ctx,g,c,r){const [x,y]=iso(g,c+.5,r+.5),w=g.w;ctx.fillStyle=C.trunk;ctx.fillRect(Math.round(x-w*.07),Math.round(y-w*.1),Math.round(w*.14),Math.round(w*.1));ctx.fillStyle='#9a7a52';ctx.fillRect(Math.round(x-w*.07),Math.round(y-w*.12),Math.round(w*.14),3);}
function rock(ctx,g,c,r,v){const [x,y]=iso(g,c+.5,r+.5);box(ctx,Math.round(x+(v-.5)*6),Math.round(y),g.w*.16,g.w*.12,C.stoneHi,C.stone,C.stoneLo);}
// A small worker with a lantern-yellow cap. It bobs while walking and swings its axe while chopping.
function worker(ctx,g,w,wc,wr,now,smooth){
  const [x0,y0]=iso(g,wc+.5,wr+.5),phase=w.phase;let face=w.face;
  if(phase==='walk'&&w.steps.length){const [nc,nr]=w.steps[0],dx=(nc-w.c)-(nr-w.r);if(dx)face=w.face=dx>0?1:-1;}
  else if(phase==='chop'&&w.tree!==null){const dx=(w.tree%N-w.c)-(Math.floor(w.tree/N)-w.r);if(dx)face=w.face=dx>0?1:-1;}
  const bob=smooth&&phase==='walk'?Math.round(Math.abs(Math.sin(w.t/CONFIG.stepMs*Math.PI))*-2):0,x=Math.round(x0),y=Math.round(y0)+bob;
  ctx.globalAlpha=inside(Math.round(wc),Math.round(wr))?1:.75;
  ctx.fillStyle='#0006';ctx.fillRect(x-5,Math.round(y0)-1,10,3);
  ctx.fillStyle='#2d5f6e';ctx.fillRect(x-3,y-11,6,9);ctx.fillStyle='#e0b98d';ctx.fillRect(x-2,y-15,5,4);ctx.fillStyle=C.lantern;ctx.fillRect(x-3,y-17,6,2);
  // Axe: resting on the shoulder while walking, swinging while chopping.
  const swing=phase==='chop'?(smooth?Math.sin(w.t/CONFIG.chopMs*Math.PI*6):((Math.floor(w.t/200)%2)?1:-1)):-.6;
  ctx.save();ctx.translate(x+face*3,y-10);ctx.rotate(face*(.9-swing*.9));ctx.fillStyle=C.wood;ctx.fillRect(-1,-9,2,9);ctx.fillStyle='#c9ced1';ctx.fillRect(face>0?0:-4,-10,4,4);ctx.restore();
  ctx.globalAlpha=1;
}
function ruin(ctx,g,id,s){
  const [x,y]=iso(g,4,4),w=g.w,stoneT=C.stoneHi,stoneL=C.stone,stoneR=C.stoneLo;
  if(s<2){// broken rubble, a little tidier once the path is back
    const bits=[[-.55,-.05,.16,.14],[.42,-.12,.14,.2],[-.1,.32,.12,.1],[.2,.18,.1,.08],[-.3,-.35,.12,.24]];
    for(const [dx,dy,hw,ht] of bits)box(ctx,Math.round(x+dx*w),Math.round(y+dy*w),w*hw,w*ht*(s===1?1.3:1),s?stoneT:'#6a6a5e',s?stoneL:'#575649',s?stoneR:'#43423a');
    ctx.fillStyle=C.moss;ctx.fillRect(Math.round(x-w*.6),Math.round(y-w*.24),Math.round(w*.18),3);return;}
  if(s===2){box(ctx,x,y,w*.82,w*.12,stoneT,stoneL,stoneR);box(ctx,Math.round(x-w*.45),Math.round(y-w*.02),w*.14,w*.32,stoneT,stoneL,stoneR);box(ctx,Math.round(x+w*.45),Math.round(y-w*.02),w*.14,w*.32,stoneT,stoneL,stoneR);return;}
  box(ctx,x,y,w*.85,w*.1,stoneT,stoneL,stoneR);const base=y-w*.1;
  if(id==='gate'){box(ctx,Math.round(x-w*.42),base,w*.17,w*.95,stoneT,stoneL,stoneR);box(ctx,Math.round(x+w*.42),base,w*.17,w*.95,stoneT,stoneL,stoneR);box(ctx,x,Math.round(base-w*.95),w*.62,w*.18,stoneT,stoneL,stoneR);ctx.fillStyle=C.lantern;ctx.fillRect(x-2,Math.round(base-w*1.18),4,4);}
  else if(id==='well'){box(ctx,x,base,w*.42,w*.28,stoneT,stoneL,stoneR);const hh=w*.28/2;poly(ctx,[[x,base-w*.28-hh*.6],[x+w*.3,base-w*.28],[x,base-w*.28+hh*.6],[x-w*.3,base-w*.28]],C.water);
    ctx.fillStyle=C.wood;ctx.fillRect(Math.round(x-w*.4),Math.round(base-w*.95),3,Math.round(w*.7));ctx.fillRect(Math.round(x+w*.37),Math.round(base-w*.95),3,Math.round(w*.7));poly(ctx,[[x,base-w*1.25],[x+w*.55,base-w*.9],[x-w*.55,base-w*.9]],C.roof);}
  else if(id==='shelter'){box(ctx,x,base,w*.6,w*.45,'#8a7a62',C.wood,'#5c4128');const t=base-w*.45;poly(ctx,[[x-w*.68,t],[x,t+w*.34],[x,t-w*.5]],C.roof);poly(ctx,[[x+w*.68,t],[x,t+w*.34],[x,t-w*.5]],C.roofHi);ctx.fillStyle='#1c140e';ctx.fillRect(Math.round(x+w*.18),Math.round(base-w*.06),Math.round(w*.16),Math.round(-w*.28));ctx.fillStyle=C.lantern;ctx.fillRect(Math.round(x+w*.24),Math.round(base-w*.26),3,3);}
  else{box(ctx,x,base,w*.36,w*1.25,stoneT,stoneL,stoneR);const t=base-w*1.25;for(const dx of [-.26,0,.26])box(ctx,Math.round(x+dx*w),Math.round(t+Math.abs(dx)*w*.25),w*.07,w*.12,stoneT,stoneL,stoneR);ctx.fillStyle=C.lantern;ctx.fillRect(Math.round(x+w*.12),Math.round(base-w*.8),3,6);ctx.fillStyle=C.brass;ctx.fillRect(x-1,Math.round(t-w*.42),3,Math.round(w*.3));ctx.fillRect(x+2,Math.round(t-w*.42),6,4);}
}
// A new ruin stage rises out of the ground: the old stage stays, the new one is uncovered from the bottom up, with dust.
function riseRuin(ctx,g,id,a,now){
  const k=Math.min(1,(now-a.t0)/a.life),e=easeOut(k),[x,y]=iso(g,4,4),w=g.w,top=y-w*1.9,bottom=y+w*.6;
  ruin(ctx,g,id,a.from);
  ctx.save();ctx.beginPath();ctx.rect(x-w*1.2,bottom-(bottom-top)*e,w*2.4,(bottom-top)*e+2);ctx.clip();ruin(ctx,g,id,a.to);ctx.restore();
  ctx.fillStyle='#b9ad8f';for(let j=0;j<6;j++){const dx=(j-2.5)*w*.3,dy=-k*w*.4-(j%2)*3;ctx.globalAlpha=(1-k)*.8;ctx.fillRect(Math.round(x+dx),Math.round(y+w*.2+dy),3,3);}ctx.globalAlpha=1;
}

/* Haven, the first tab, opens Ruins Reclaimed directly every time (navigation.js). There is no other view and no way
 * through to the retired Hall. page() draws it into the destination; leave() stops it, keeping its Wood. */
let shell=null;
function page(host){if(!host)return;if(!shell){shell=document.createElement('div');shell.className='ruins-shell';shell.innerHTML='<div class="ruins-slot"></div>';}
  if(shell.parentNode!==host)host.replaceChildren(shell);mount(shell.firstElementChild);}
function leave(){unmount();}
root.LoreRuinsReclaimed.page=page;root.LoreRuinsReclaimed.leave=leave;
})(globalThis);
