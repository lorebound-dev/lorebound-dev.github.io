/* Ruins Reclaimed: a test-site-only settlement prototype, shown by the Haven tab.
 * Gather Wood, Stone and Ore from trees and deposits that take several hits, place four kinds of building on the
 * same map, and expand that one map outwards (8×8 → 12×12 → 16×16).
 * Everything here is original code. The 2:1 isometric math is the standard textbook projection, worker paths use a plain
 * breadth-first search and the easing is two standard curves. Nothing is copied from mykonos-island-voxels, EasyStar.js,
 * Tween.js or clicker-engine (see docs/RUINS-RECLAIMED-PROTOTYPE.md).
 * It never reads or writes the LOREBOUND save. Its own data lives in localStorage key lorebound-haven-settlement-v2,
 * and only on the test site or a local copy. The first prototype's key, lorebound-ruins-prototype-v01, is only read
 * (to move its progress over once) and is never changed or deleted.
 * All numbers in CONFIG and BLUEPRINTS are trial values for play-testing, not approved balance. */
(function(root){'use strict';

const KEY='lorebound-haven-settlement-v2',V1_KEY='lorebound-ruins-prototype-v01',BAD_KEY=KEY+'-unreadable';
// Work is counted in quarters: one hit at the starting hit power of 1 does 4 work.
const CONFIG=Object.freeze({
  version:2,
  world:16,
  lands:[[4,12],[2,14],[0,16]],      // territory 1 is the old 8×8 in the middle; each expansion adds two tiles all round
  kinds:{
    bush:{hp:8,give:{wood:1},name:'Bush'},      // 2 hits at hit power 1
    pine:{hp:16,give:{wood:2},name:'Pine'},     // 4 hits
    oak:{hp:20,give:{wood:3},name:'Oak'},       // 5 hits
    stone:{hp:28,give:{stone:2},name:'Stone'},  // 7 hits
    ore:{hp:48,give:{ore:2},name:'Ore vein'},   // 12 hits
  },
  manualPower:4,          // your hit: 4 work (hit power 1)
  toolsStep:1,            // +1 work (+¼ hit power) per Better Tools level
  toolsMax:10,toolsWood:10,toolsStone:3,toolsGrowth:1.6,
  workshopManual:2,workshopWorker:1,
  workerPower:2,          // a worker's swing: 2 work (half a hit)
  workerBase:25,workerGrowth:1.8,workerMax:5,
  workerHitMs:1400,       // a worker swings once every 1.4 s while working, only while Haven is open
  stepMs:380,             // and walks one tile in 0.38 s
  retryMs:1000,           // a worker with nothing it can reach looks again after 1 s, not every frame
  extraCoreStones:5,      // stone deposits added to the old 8×8 on open ground (the old prototype had 3 unmineable rocks)
  ringNodes:[null,{tree:18,stone:7,ore:4},{tree:24,stone:8,ore:7}],
  regrowEvery:6,          // every 6th node you finish lets the oldest felled tree or mined deposit grow back
  expand:[{wood:24,stone:16},{wood:40,stone:24,ore:8}],
  v1:{size:8,treeCounts:[14,16,18]},
});
const BLUEPRINTS=Object.freeze([
  {id:'workshop',name:'Workshop',cost:{wood:10,stone:6},effect:'+½ hit power for you, +¼ for workers'},
  {id:'lumber',name:'Lumber Camp',cost:{wood:18,stone:8},effect:'Workers do double work on trees and bushes'},
  {id:'stoneyard',name:'Stone Yard',cost:{wood:14,stone:12},effect:'Workers do double work on stone and ore; +1 Stone per deposit'},
  {id:'survey',name:'Survey Post',cost:{wood:16,stone:10},effect:'Lets you expand into the mist around Haven'},
]);
const BP=Object.fromEntries(BLUEPRINTS.map(b=>[b.id,b]));
const RES=['wood','stone','ore'],RES_NAME={wood:'Wood',stone:'Stone',ore:'Ore'};
const W=CONFIG.world,wid=(c,r)=>r*W+c;
const isWood=k=>k==='bush'||k==='pine'||k==='oak';

// Small deterministic generator so every player sees the same land.
function seeded(seed){let s=(seed*2654435761+97)>>>0;return()=>{s=(Math.imul(s^(s>>>15),2246822519)+3266489917)>>>0;return((s^(s>>>13))>>>0)/4294967296;};}
function shuffle(list,rand){for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}

/* ---------- The first prototype's patches (read only, for moving old progress over) ----------
 * Same generator as the first build, so an old patch's trees land on exactly the same tiles. */
const V1_RUINS=[[[0,4],[1,4],[2,4],[5,4],[6,4],[7,4]],[[3,0],[3,1],[3,2],[4,5],[4,6],[4,7]],[[0,0],[1,1],[2,2],[5,5],[6,6],[7,7]],[[7,3],[6,3],[5,3],[0,4],[1,4],[2,4]]];
const V1_FOOT=[[3,3],[4,3],[3,4],[4,4]];
const v1Patches=new Map();
function v1Patch(index){
  if(v1Patches.has(index))return v1Patches.get(index);
  const N=CONFIG.v1.size,at=(c,r)=>r*N+c,n=N*N,rand=seeded(index+1),foot=new Set(V1_FOOT.map(([c,r])=>at(c,r)));
  const path=new Set(V1_RUINS[index%4].map(([c,r])=>at(c,r))),want=CONFIG.v1.treeCounts[index%3];
  const free=[];for(let i=0;i<n;i++)if(!foot.has(i)&&!path.has(i))free.push(i);
  shuffle(free,rand);
  const trees=[...path,...free.slice(0,want-path.size)].sort((a,b)=>a-b),rocks=free.slice(want-path.size,want-path.size+3);
  const kind={};for(const t of trees){const v=rand();kind[t]=v<.42?'pine':v<.84?'oak':'bush';}
  const p=Object.freeze({index,trees,treeSet:new Set(trees),rocks,foot:[...foot],kind});v1Patches.set(index,p);return p;
}
function validateV1(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return null;
  if(Object.keys(o).sort().join()!=='cleared,patch,tools,v,wood,workers')return null;
  if(o.v!==1||!int(o.wood,0,1e9)||!int(o.tools,0,10)||!int(o.workers,0,5)||!int(o.patch,0,9999)||!Array.isArray(o.cleared))return null;
  const p=v1Patch(o.patch),seen=new Set();for(const t of o.cleared){if(!p.treeSet.has(t)||seen.has(t))return null;seen.add(t);}
  return{v:1,wood:o.wood,tools:o.tools,workers:o.workers,patch:o.patch,cleared:[...o.cleared]};
}

/* ---------- The world ----------
 * One 16×16 grid with fixed tile numbers. The middle 8×8 is the patch the player was on in the first prototype
 * (patch 1 for a new player): its trees, its 3 rocks (now mineable stone) and its broken ruin (rubble you can't build
 * on or walk through), plus a few stone deposits. Each expansion ring has its own fixed trees, stone and ore. */
const worlds=new Map();
function world(origin){
  if(worlds.has(origin))return worlds.get(origin);
  const nodes=new Map(),rubble=new Set(),old=v1Patch(origin),off=CONFIG.lands[0][0];
  const put=(c,r,kind,land)=>nodes.set(wid(c,r),Object.freeze({id:wid(c,r),c,r,kind,land}));
  for(const t of old.trees)put(t%8+off,Math.floor(t/8)+off,old.kind[t],0);
  for(const t of old.rocks)put(t%8+off,Math.floor(t/8)+off,'stone',0);
  for(const t of old.foot)rubble.add(wid(t%8+off,Math.floor(t/8)+off));
  const free=[];for(let i=0;i<64;i++){const id=wid(i%8+off,Math.floor(i/8)+off);if(!nodes.has(id)&&!rubble.has(id))free.push(id);}
  for(const id of shuffle(free,seeded(origin+5000)).slice(0,CONFIG.extraCoreStones))put(id%W,Math.floor(id/W),'stone',0);
  for(let k=1;k<CONFIG.lands.length;k++){
    const [lo,hi]=CONFIG.lands[k],[plo,phi]=CONFIG.lands[k-1],cells=[],rand=seeded(9000+k),want=CONFIG.ringNodes[k];
    for(let r=lo;r<hi;r++)for(let c=lo;c<hi;c++)if(c<plo||r<plo||c>=phi||r>=phi)cells.push(wid(c,r));
    shuffle(cells,rand);let i=0;
    for(let n=0;n<want.tree;n++){const v=rand(),id=cells[i++];put(id%W,Math.floor(id/W),v<.4?'pine':v<.8?'oak':'bush',k);}
    for(let n=0;n<want.stone;n++){const id=cells[i++];put(id%W,Math.floor(id/W),'stone',k);}
    for(let n=0;n<want.ore;n++){const id=cells[i++];put(id%W,Math.floor(id/W),'ore',k);}
  }
  const shadeRand=seeded(77),shade=Array.from({length:(W+2)*(W+2)},()=>shadeRand());
  const w=Object.freeze({origin,nodes,rubble,shade:id=>shade[(Math.floor(id/W)+1)*(W+2)+id%W+1]??.5});worlds.set(origin,w);return w;
}
const land=s=>CONFIG.lands[s.land];
const inLand=(s,c,r)=>{const [lo,hi]=land(s);return c>=lo&&r>=lo&&c<hi&&r<hi;};
const goneSet=s=>new Set(s.gone);
function standingIds(s){const g=goneSet(s),out=[];for(const n of world(s.origin).nodes.values())if(n.land<=s.land&&!g.has(n.id))out.push(n.id);return out;}
function standing(s,id){const n=world(s.origin).nodes.get(id);return !!n&&n.land<=s.land&&!s.gone.includes(id);}
const buildingAt=(s,id)=>s.built.find(b=>wid(b.c,b.r)===id)||null;
const has=(s,type)=>s.built.some(b=>b.t===type);

function fresh(origin=0){return{v:CONFIG.version,wood:0,stone:0,ore:0,tools:0,workers:0,origin,land:0,tally:0,gone:[],hp:{},built:[]};}
const int=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
// Strict check of stored data. Returns a clean copy, or null for anything unexpected.
function validate(o){
  if(!plain(o))return null;
  if(Object.keys(o).sort().join()!=='built,gone,hp,land,ore,origin,stone,tally,tools,v,wood,workers')return null;
  if(o.v!==CONFIG.version||!int(o.wood,0,1e9)||!int(o.stone,0,1e9)||!int(o.ore,0,1e9)||!int(o.tools,0,CONFIG.toolsMax)||!int(o.workers,0,CONFIG.workerMax)
    ||!int(o.origin,0,9999)||!int(o.land,0,CONFIG.lands.length-1)||!int(o.tally,0,1e9)||!Array.isArray(o.gone)||!plain(o.hp)||!Array.isArray(o.built))return null;
  const wd=world(o.origin),seen=new Set();
  for(const id of o.gone){const n=wd.nodes.get(id);if(!int(id,0,W*W-1)||!n||n.land>o.land||seen.has(id))return null;seen.add(id);}
  const hp={};
  for(const [k,v] of Object.entries(o.hp)){if(!/^\d{1,3}$/.test(k))return null;const id=Number(k),n=wd.nodes.get(id);
    if(!n||n.land>o.land||seen.has(id)||!int(v,1,CONFIG.kinds[n.kind].hp-1))return null;hp[id]=v;}
  if(o.built.length>BLUEPRINTS.length)return null;
  const [lo,hi]=CONFIG.lands[o.land],types=new Set(),tiles=new Set(),built=[];
  for(const b of o.built){
    if(!plain(b)||Object.keys(b).sort().join()!=='c,lv,r,t'||!BP[b.t]||types.has(b.t)||b.lv!==1||!int(b.c,lo,hi-1)||!int(b.r,lo,hi-1))return null;
    const id=wid(b.c,b.r);if(tiles.has(id)||wd.rubble.has(id)||(wd.nodes.has(id)&&!seen.has(id)))return null;
    types.add(b.t);tiles.add(id);built.push({t:b.t,c:b.c,r:b.r,lv:1});}
  return{v:o.v,wood:o.wood,stone:o.stone,ore:o.ore,tools:o.tools,workers:o.workers,origin:o.origin,land:o.land,tally:o.tally,gone:[...o.gone],hp,built};
}
/* Moving the first prototype over: its Wood, Better Tools and workers carry over as they are, and the patch it was on
 * becomes the middle of the settlement with the same trees already cleared (so they are not paid again). Patches
 * finished before that can't become land (their Wood was already paid), and no building is invented for them. */
function migrate(o1){
  const s=fresh(o1.patch);s.wood=o1.wood;s.tools=Math.min(o1.tools,CONFIG.toolsMax);s.workers=Math.min(o1.workers,CONFIG.workerMax);
  const off=CONFIG.lands[0][0];s.gone=o1.cleared.map(t=>wid(t%8+off,Math.floor(t/8)+off));return s;
}
/* Picks the state to play from a store with get(key)/set(key,value). Never deletes anything: an unreadable v2 save is
 * copied to its own key before a fresh or moved-over one replaces it, and the first prototype's key is only read. */
function loadFrom(store){
  const raw2=store.get(KEY);let note='';
  if(raw2!==null&&raw2!==undefined){let s=null;try{s=validate(JSON.parse(raw2));}catch{}if(s)return{state:s,note:''};store.set(BAD_KEY,raw2);note='unreadable';}
  const raw1=store.get(V1_KEY);
  if(raw1!==null&&raw1!==undefined){let o=null;try{o=validateV1(JSON.parse(raw1));}catch{}if(o)return{state:migrate(o),note:note||'moved',old:o};}
  return{state:fresh(),note};
}

/* ---------- Rules ---------- */
const sum=c=>RES.reduce((a,k)=>a+(c[k]||0),0);
const afford=(s,c)=>RES.every(k=>s[k]>=(c[k]||0));
const shortOf=(s,c)=>{const o={};for(const k of RES)if((c[k]||0)>s[k])o[k]=c[k]-s[k];return o;};
function pay(s,c){for(const k of RES)s[k]-=c[k]||0;}
function cost(s,kind){
  if(kind==='tools')return s.tools>=CONFIG.toolsMax?null:{wood:Math.round(CONFIG.toolsWood*CONFIG.toolsGrowth**s.tools),stone:s.tools?Math.round(CONFIG.toolsStone*CONFIG.toolsGrowth**(s.tools-1)):0};
  if(kind==='worker')return s.workers>=CONFIG.workerMax?null:{wood:Math.round(CONFIG.workerBase*CONFIG.workerGrowth**s.workers)};
  return null;
}
const manualPower=(s,tools=s.tools)=>CONFIG.manualPower+tools*CONFIG.toolsStep+(has(s,'workshop')?CONFIG.workshopManual:0);
function workerPower(s,kind,tools=s.tools){
  const base=CONFIG.workerPower+Math.floor(tools/2)+(has(s,'workshop')?CONFIG.workshopWorker:0);
  return base*((isWood(kind)&&has(s,'lumber'))||(!isWood(kind)&&has(s,'stoneyard'))?2:1);
}
const hitsFor=(kind,power)=>Math.ceil(CONFIG.kinds[kind].hp/power);
function buy(s,kind){const c=cost(s,kind);if(c===null)return{ok:false,reason:'max'};if(!afford(s,c))return{ok:false,reason:'short',need:shortOf(s,c)};pay(s,c);if(kind==='tools')s.tools++;else s.workers++;return{ok:true,cost:c};}

/* One hit on a standing node. Work is stored on the node, and its resources are paid exactly once, by the hit that
 * finishes it. A hit on anything else (a felled tree, empty ground, a node in the mist) does nothing. */
function hitNode(s,id,power){
  if(!standing(s,id)||!int(power,1,1000))return null;
  const n=world(s.origin).nodes.get(id),max=CONFIG.kinds[n.kind].hp,left=(s.hp[id]??max)-power;
  if(left>0){s.hp[id]=left;return{done:false,left,max,kind:n.kind};}
  delete s.hp[id];s.gone.push(id);
  const gain={...CONFIG.kinds[n.kind].give};if(n.kind==='stone'&&has(s,'stoneyard'))gain.stone=(gain.stone||0)+1;
  for(const k of RES)if(gain[k])s[k]+=gain[k];
  s.tally++;const regrown=regrow(s);
  return{done:true,left:0,max,kind:n.kind,gain,regrown};
}
/* Regrowth, so the settlement can't run dry: every 6th node finished (or straight away when nothing is left standing),
 * the oldest felled tree or mined deposit grows back at full strength, on a tile with no building on it and only where
 * it wouldn't wall off open ground. It always needs the full work again, so it can't be farmed for instant resources. */
function regrow(s){
  if(s.tally%CONFIG.regrowEvery!==0&&standingIds(s).length>0)return null;
  const b=blocked(s),before=reach(s,b);
  for(let i=0;i<s.gone.length;i++){const id=s.gone[i];if(buildingAt(s,id))continue;
    b.add(id);const after=reach(s,b);b.delete(id);if(after.size<before.size-(before.has(id)?1:0))continue;
    s.gone.splice(i,1);return id;}
  return null;
}

/* Walking: inside the territory only on open ground (not standing nodes, buildings or rubble), plus a one-tile ring
 * of forest edge just outside it, which is always open. Four straight directions only. */
function blocked(s){const wd=world(s.origin),b=new Set(wd.rubble);for(const id of standingIds(s))b.add(id);for(const x of s.built)b.add(wid(x.c,x.r));return b;}
function walkable(s,c,r,b=blocked(s)){const [lo,hi]=land(s);if(c<lo-1||r<lo-1||c>hi||r>hi)return false;if(c<lo||r<lo||c>=hi||r>=hi)return true;return !b.has(wid(c,r));}
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]],AROUND=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
// The open tiles inside the territory that can be walked to from the forest edge.
function reach(s,b=blocked(s)){
  const [lo]=land(s),seen=new Set([`${lo-1},${lo-1}`]),queue=[[lo-1,lo-1]],inside=new Set();
  for(let q=0;q<queue.length;q++){const [x,y]=queue[q];for(const [dx,dy] of DIRS){const nc=x+dx,nr=y+dy,k=`${nc},${nr}`;if(seen.has(k)||!walkable(s,nc,nr,b))continue;seen.add(k);queue.push([nc,nr]);if(inLand(s,nc,nr))inside.add(wid(nc,nr));}}
  return inside;
}
// Nearest standing, unclaimed node a worker at (c,r) can reach: breadth-first search over at most 324 tiles, run only
// when a worker needs a new target. Returns the steps to walk (excluding the start) and the node.
function route(s,c,r,claimed=new Set()){
  const b=blocked(s),left=new Set(standingIds(s).filter(t=>!claimed.has(t))),key=(x,y)=>`${x},${y}`,from=new Map([[key(c,r),null]]),queue=[[c,r]];
  if(!left.size)return null;
  for(let q=0;q<queue.length;q++){const [x,y]=queue[q];
    for(const [dx,dy] of AROUND){const tc=x+dx,tr=y+dy;if(inLand(s,tc,tr)&&left.has(wid(tc,tr))){const steps=[];for(let cell=[x,y];from.get(key(...cell))!==null;cell=from.get(key(...cell)))steps.unshift(cell);return{node:wid(tc,tr),steps};}}
    for(const [dx,dy] of DIRS){const nc=x+dx,nr=y+dy,k=key(nc,nr);if(!from.has(k)&&walkable(s,nc,nr,b)){from.set(k,[x,y]);queue.push([nc,nr]);}}}
  return null;
}

/* Building: one of each blueprint, on one free tile inside the territory: not on a standing tree or deposit, another
 * building or rubble, and never where it would wall off open ground from the workers. Nothing is paid unless it's built. */
function canPlace(s,type,c,r,b=blocked(s),before=null){
  if(!BP[type])return{ok:false,reason:'type'};if(has(s,type))return{ok:false,reason:'built'};
  if(!int(c,0,W-1)||!int(r,0,W-1)||!inLand(s,c,r))return{ok:false,reason:'outside'};
  const id=wid(c,r);if(buildingAt(s,id))return{ok:false,reason:'building'};if(world(s.origin).rubble.has(id))return{ok:false,reason:'rubble'};if(standing(s,id))return{ok:false,reason:'node'};
  before=before||reach(s,b);b.add(id);const after=reach(s,b);b.delete(id);
  if(after.size<before.size-(before.has(id)?1:0))return{ok:false,reason:'path'};
  return{ok:true};
}
function validSites(s,type){if(!BP[type]||has(s,type))return[];const [lo,hi]=land(s),b=blocked(s),before=reach(s,b),out=[];
  for(let r=lo;r<hi;r++)for(let c=lo;c<hi;c++)if(canPlace(s,type,c,r,b,before).ok)out.push(wid(c,r));return out;}
function build(s,type,c,r){const p=canPlace(s,type,c,r);if(!p.ok)return p;const bp=BP[type];if(!afford(s,bp.cost))return{ok:false,reason:'short',need:shortOf(s,bp.cost)};
  pay(s,bp.cost);s.built.push({t:type,c,r,lv:1});return{ok:true,cost:bp.cost};}

// Expanding grows the same map by two tiles on every side. Nothing already there moves.
const expandCost=s=>CONFIG.expand[s.land]||null;
function canExpand(s){const c=expandCost(s);if(!c)return{ok:false,reason:'max'};if(!has(s,'survey'))return{ok:false,reason:'survey',cost:c};if(!afford(s,c))return{ok:false,reason:'short',cost:c,need:shortOf(s,c)};return{ok:true,cost:c};}
function expand(s){const e=canExpand(s);if(!e.ok)return e;pay(s,e.cost);s.land++;return e;}

/* ---------- Workers ----------
 * A worker walks to the nearest node it can reach that no other worker has claimed, then swings at it every 1.4 s
 * until it's finished (by anyone). Positions are not saved; they walk in again after a reload. */
function crewMember(k,s){const [lo,hi]=land(s),n=hi-lo,o=[5,5,2,2,7][k%5]%n,[c,r]=k%2?[lo+o,hi]:[hi,lo+o];return{k,c,r,steps:[],node:null,phase:'idle',t:0,wait:0,face:1,stuck:false};}
function syncCrew(s,crew){while(crew.length<s.workers)crew.push(crewMember(crew.length,s));crew.length=Math.min(crew.length,s.workers);return crew;}
/* Moves every worker on by dt milliseconds. The caller keeps dt small (at most 100 ms per frame), so time spent away
 * is never made up. Returns what happened, for the display. Nodes are only ever paid by hitNode(), which pays once. */
function simulate(s,crew,dt){
  const events=[];syncCrew(s,crew);
  for(const w of crew){let left=dt,guard=0;
    while(left>0&&guard++<64){
      if(w.phase==='idle'){
        if(w.wait>0){const d=Math.min(w.wait,left);w.wait-=d;left-=d;continue;}
        const claimed=new Set(crew.filter(o=>o!==w&&o.node!==null).map(o=>o.node)),plan=route(s,w.c,w.r,claimed);
        if(!plan){w.wait=CONFIG.retryMs;if(!w.stuck&&standingIds(s).length)events.push({type:'stuck',worker:w.k});w.stuck=!!standingIds(s).length;continue;}
        w.stuck=false;w.node=plan.node;w.steps=plan.steps;w.phase=plan.steps.length?'walk':'work';w.t=0;events.push({type:'target',worker:w.k,node:w.node});continue;}
      const gone=w.node===null||!standing(s,w.node);
      if(w.phase==='walk'){
        // Only change course on a tile, never halfway between two. A newly placed building or a regrown tree in the
        // way sends the worker back to choose again.
        if(w.t===0&&(gone||!walkable(s,w.steps[0][0],w.steps[0][1]))){w.phase='idle';w.node=null;w.steps=[];continue;}
        const d=Math.min(left,CONFIG.stepMs-w.t);w.t+=d;left-=d;
        if(w.t>=CONFIG.stepMs){const [nc,nr]=w.steps.shift();w.c=nc;w.r=nr;w.t=0;if(!w.steps.length)w.phase='work';}
        continue;}
      if(w.phase==='work'){
        if(gone){w.phase='idle';w.node=null;w.t=0;continue;}
        const d=Math.min(left,CONFIG.workerHitMs-w.t);w.t+=d;left-=d;
        if(w.t>=CONFIG.workerHitMs){w.t=0;const n=world(s.origin).nodes.get(w.node),res=hitNode(s,w.node,workerPower(s,n.kind));
          if(res){events.push({type:'hit',worker:w.k,node:w.node,res});if(res.done){w.node=null;w.phase='idle';}}}
        continue;}
      left=0;}}
  return events;
}
function resetCrew(crew){crew.length=0;}
function crewPosition(w,smooth){if(w.phase!=='walk'||!w.steps.length)return[w.c,w.r];const k=w.t/CONFIG.stepMs,e=smooth?easeInOut(k):k<.5?0:1,[nc,nr]=w.steps[0];return[w.c+(nc-w.c)*e,w.r+(nr-w.r)*e];}
const easeInOut=k=>.5-Math.cos(Math.PI*k)/2,easeOut=k=>1-(1-k)**3;

const logic={KEY,V1_KEY,BAD_KEY,CONFIG,BLUEPRINTS,v1Patch,validateV1,world,land,inLand,standing,standingIds,buildingAt,has,fresh,validate,migrate,loadFrom,
  cost,afford,manualPower,workerPower,hitsFor,buy,hitNode,regrow,blocked,walkable,reach,route,canPlace,validSites,build,expandCost,canExpand,expand,simulate,syncCrew,crewPosition};

/* ---------- Everything below needs a browser. ---------- */
let state=null,view=null,raf=0,lastFrame=0,anims=[],resetArmed=0,importArmed=0,lastBig=0,loadNote='',loadOld=null;const crew=[];
const host=root.location?.hostname||'';
const TEST=host==='lorebound-dev.github.io'||host==='localhost'||host==='127.0.0.1';
root.LoreRuinsReclaimed={...logic,TEST,mount,unmount,crew,get state(){return state;},get mounted(){return !!view;},get running(){return !!raf;}};
if(typeof document==='undefined')return;

const motionQuery=root.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced=()=>!!motionQuery?.matches;
const storeApi={get:k=>{try{return root.localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{root.localStorage.setItem(k,v);}catch{}}};
function load(){if(state)return state;const r=loadFrom(storeApi);state=r.state;loadNote=r.note;loadOld=r.old||null;if(r.note)store();return state;}
function store(){storeApi.set(KEY,JSON.stringify(state));}
const fmt=c=>RES.filter(k=>c[k]).map(k=>`${c[k]} ${RES_NAME[k]}`).join(' · ')||'Free';
const power=q=>{const v=q/4;return Number.isInteger(v)?String(v):v.toFixed(2).replace(/0$/,'');};

const SKETCH=`<section class="ruins-proto" aria-labelledby="ruinsTitle">
<header class="ruins-head"><div><small>Test prototype · trial numbers</small><h3 id="ruinsTitle">Ruins Reclaimed</h3></div><span class="ruins-head-actions"><button type="button" class="ruins-help-toggle" aria-expanded="false" aria-controls="ruinsHelp" aria-label="How Ruins Reclaimed works">?</button></span></header>
<div class="ruins-help" id="ruinsHelp" hidden><p>Tap a tree, stone or ore vein again and again to work it. The bar shows the work left; it pays once, when it comes down. Better Tools and the Workshop make each hit stronger.</p><p>Build: pick a building, tap a lit tile, then confirm. Buildings stay where you put them. A Survey Post lets you Expand: the mist clears and the same map grows, with everything kept in place.</p><p>Every ${CONFIG.regrowEvery}th tree or deposit you finish, the oldest felled one grows back (straight away if nothing is left), so you can't run out. It always needs the full work again.</p><p>Workers walk to the nearest tree or deposit they can reach and swing at it every ${CONFIG.workerHitMs/1000} seconds, only while this screen is open.</p><p>This is a test. Its Wood, Stone and Ore never touch your Gold, Shards, Essence or save. Numbers are trial values.</p><div class="ruins-help-buttons"><button type="button" data-ruins="reset">Reset demo</button><button type="button" data-ruins="reimport" hidden>Restart from old demo</button></div></div>
<dl class="ruins-stats"><div><dt>Wood</dt><dd id="ruinsWood">0</dd></div><div><dt>Stone</dt><dd id="ruinsStone">0</dd></div><div><dt>Ore</dt><dd id="ruinsOre">0</dd></div><div><dt>Territory</dt><dd id="ruinsLand">1 / 3</dd></div></dl>
<div class="ruins-scene" id="ruinsScene"><canvas id="ruinsCanvas" tabindex="0" role="img"></canvas></div><p class="ruins-work" id="ruinsWorkText" hidden></p>
<p class="ruins-stage" id="ruinsStage" role="status" aria-live="polite"></p>
<div class="ruins-place" id="ruinsPlace" hidden><p id="ruinsPlaceText"></p><div><button type="button" class="ruins-confirm" data-ruins="confirm">Build here</button><button type="button" class="ruins-cancel" data-ruins="cancel">Cancel</button></div></div>
<div class="ruins-actions"><button type="button" class="ruins-build-toggle" data-ruins="build" aria-expanded="false" aria-controls="ruinsBuild">Build</button><button type="button" class="ruins-upgrade ruins-expand" data-ruins="expand"><span><strong></strong><small></small></span><b></b></button></div>
<div class="ruins-build" id="ruinsBuild" hidden>${BLUEPRINTS.map(b=>`<button type="button" class="ruins-upgrade" data-ruins="bp" data-type="${b.id}"><span><strong></strong><small></small></span><b></b></button>`).join('')}</div>
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
  view={root:el,canvas:q('#ruinsCanvas'),scene:q('#ruinsScene'),wood:q('#ruinsWood'),stone:q('#ruinsStone'),ore:q('#ruinsOre'),land:q('#ruinsLand'),stage:q('#ruinsStage'),
    place:q('#ruinsPlace'),placeText:q('#ruinsPlaceText'),confirm:q('[data-ruins=confirm]'),buildToggle:q('[data-ruins=build]'),buildPanel:q('#ruinsBuild'),expand:q('[data-ruins=expand]'),
    bps:Object.fromEntries(BLUEPRINTS.map(b=>[b.id,q(`[data-type=${b.id}]`)])),tools:q('[data-ruins=tools]'),worker:q('[data-ruins=worker]'),workText:q('#ruinsWorkText'),
    help:q('#ruinsHelp'),helpToggle:q('.ruins-help-toggle'),reset:q('[data-ruins=reset]'),reimport:q('[data-ruins=reimport]'),geo:null,down:null,placing:null,site:null,sites:[],selected:null};
  view.buildPanel.hidden=true;view.place.hidden=true;view.help.hidden=true;
  el.addEventListener('click',onClick);
  view.canvas.addEventListener('pointerdown',onDown);view.canvas.addEventListener('pointerup',onUp);view.canvas.addEventListener('pointercancel',()=>{if(view)view.down=null;});
  view.canvas.addEventListener('keydown',onKey);
  root.addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVisible);
  syncCrew(state,crew);
  layout(true);
  if(loadNote==='moved'&&loadOld){say(`Your earlier demo moved over: ${loadOld.wood} Wood, Better Tools Lv ${state.tools}, ${state.workers} worker${state.workers===1?'':'s'}, and ${state.gone.length} trees already cleared in the middle. Patches finished before that don't become land.`);}
  else if(loadNote==='unreadable')say('The saved settlement could not be read. A copy is kept, and a new one has started.');
  loadNote='';update();wake();
}
function unmount(){
  if(!view)return;sleep();anims=[];
  root.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible);
  view.root.remove();view=null;
}

/* One clock: a single requestAnimationFrame loop, only while Haven is open and the page is visible, and only while
 * workers have something to do or an effect is playing. Each frame moves time on by at most 100 ms: no catch-up. */
const busy=()=>(state.workers>0&&standingIds(state).length>0)||anims.length>0;
function wake(){if(!view||raf||document.hidden||!busy())return;lastFrame=0;raf=root.requestAnimationFrame(frame);}
function sleep(){if(raf)root.cancelAnimationFrame(raf);raf=0;lastFrame=0;}
function frame(now){
  raf=0;if(!view||document.hidden)return;
  const dt=lastFrame?Math.min(100,Math.max(0,now-lastFrame)):0;lastFrame=now;
  if(state.workers>0&&dt>0){
    const events=simulate(state,crew,dt);let changed=false;
    for(const e of events)if(e.type==='hit'){changed=true;struck(e.node,e.res,true);}
    if(changed){store();update();}else workLine();
  }
  draw(now);
  if(busy()){raf=root.requestAnimationFrame(frame);}else lastFrame=0;
}
function onVisible(){if(!view)return;if(document.hidden){sleep();store();}else{wake();}}

/* Input: a short press without much movement is a tap. Swipes scroll the scene sideways or the page up and down. */
function onDown(e){if(e.button>0)return;view.down={x:e.clientX,y:e.clientY,t:Date.now(),id:e.pointerId};}
function onUp(e){const d=view?.down;if(!d||d.id!==e.pointerId)return;view.down=null;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>12||Date.now()-d.t>700)return;
  const box=view.canvas.getBoundingClientRect();tapAt(e.clientX-box.left,e.clientY-box.top);}
function onKey(e){if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();if(view.placing){if(view.site!==null)confirmBuild();return;}
  const target=view.selected!==null&&standing(state,view.selected)?view.selected:standingIds(state).sort((a,b)=>depth(b)-depth(a))[0];if(target!==undefined)work(target);}
const depth=id=>id%W+Math.floor(id/W);
function tapAt(x,y){
  const t=hit(x,y);if(!t)return;
  if(view.placing){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W);
    if(view.sites.includes(t.tile)){view.site=t.tile;placeLine();draw();return;}
    const p=canPlace(state,view.placing,c,r);say(p.ok?'':({outside:'That land is still in the mist.',building:'There is a building there already.',rubble:'That rubble can’t be built on.',node:'Clear that tree or deposit first.',path:'That spot would wall off the paths. Pick another lit tile.'})[p.reason]||'Pick a lit tile.');return;}
  if(t.node!==undefined){work(t.node);return;}
  if(t.building){const bp=BP[t.building.t];say(`${bp.name}: ${bp.effect}.`);return;}
}
// One hit by the player. A worker heading for the same node simply carries on, or picks another once it's done.
function work(id){const n=world(state.origin).nodes.get(id),res=hitNode(state,id,manualPower(state));if(!res)return;view.selected=res.done?null:id;store();struck(id,res,false);
  if(!res.done)say(`${CONFIG.kinds[n.kind].name}: ${Math.ceil(res.left/manualPower(state))} more hit${Math.ceil(res.left/manualPower(state))===1?'':'s'}.`);update();wake();}
function onClick(e){
  const b=e.target.closest?.('button');if(!b||!view)return;
  if(b===view.helpToggle){const open=view.help.hidden;view.help.hidden=!open;b.setAttribute('aria-expanded',String(open));return;}
  const what=b.dataset.ruins;
  if(what==='tools'||what==='worker'){const r=buy(state,what);if(r.ok){store();if(what==='worker')syncCrew(state,crew);
    say(what==='tools'?`Better Tools level ${state.tools}. Hit power is now ${power(manualPower(state))}.`:`Worker hired. ${state.workers} worker${state.workers>1?'s are':' is'} on the way.`);update();wake();}return;}
  if(what==='build'){const open=view.buildPanel.hidden;view.buildPanel.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)endPlacing();return;}
  if(what==='bp'){startPlacing(b.dataset.type);return;}
  if(what==='confirm'){confirmBuild();return;}
  if(what==='cancel'){endPlacing();say('');update();return;}
  if(what==='expand'){if(Date.now()-lastBig<700)return;const r=expand(state);
    if(!r.ok){say(r.reason==='survey'?'Build a Survey Post first.':r.reason==='short'?`You need ${fmt(r.need)} more to expand.`:'Haven has reached its full size for now.');return;}
    lastBig=Date.now();store();endPlacing();if(!reduced())anims.push({type:'land',t0:performance.now(),life:900});
    say(`Haven grows. Territory ${state.land+1} / ${CONFIG.lands.length}. New trees, stone${state.land>=1?' and ore':''} wait at the edges.`);layout(true);update();wake();return;}
  if(what==='reset'){if(Date.now()-resetArmed>3000){resetArmed=Date.now();b.textContent='Tap again to reset the demo';return;}
    resetArmed=0;b.textContent='Reset demo';state=fresh();resetCrew(crew);anims=[];endPlacing();store();say('Demo reset. Only Haven’s test settlement was cleared.');layout(true);update();return;}
  if(what==='reimport'){const r=loadFrom({get:k=>k===KEY?null:storeApi.get(k),set:()=>{}});if(!r.old)return;
    if(Date.now()-importArmed>3000){importArmed=Date.now();b.textContent='Tap again to replace this settlement';return;}
    importArmed=0;b.textContent='Restart from old demo';state=r.state;resetCrew(crew);anims=[];endPlacing();store();say(`Restarted from the old demo: ${state.wood} Wood, Better Tools Lv ${state.tools}, ${state.workers} worker${state.workers===1?'':'s'}.`);layout(true);update();return;}
}
function startPlacing(type){const bp=BP[type];if(!bp||has(state,type))return;
  if(!afford(state,bp.cost)){say(`You need ${fmt(shortOf(state,bp.cost))} more for the ${bp.name}.`);return;}
  const sites=validSites(state,type);if(!sites.length){say('No free tile to build on. Clear a tree or deposit first.');return;}
  view.placing=type;view.site=null;view.sites=sites;view.buildPanel.hidden=true;view.buildToggle.setAttribute('aria-expanded','false');placeLine();update();}
function endPlacing(){if(!view)return;view.placing=null;view.site=null;view.sites=[];view.place.hidden=true;}
function placeLine(){const bp=BP[view.placing];view.place.hidden=false;view.confirm.disabled=view.site===null;
  view.placeText.textContent=view.site===null?`Tap a lit tile for the ${bp.name}. It costs ${fmt(bp.cost)}.`:`Build the ${bp.name} here for ${fmt(bp.cost)}?`;}
// A second tap on Build here finds placing already ended, so a double tap can never build or charge twice.
function confirmBuild(){if(!view.placing||view.site===null)return;const type=view.placing,c=view.site%W,r=Math.floor(view.site/W),res=build(state,type,c,r);
  if(!res.ok){say(res.reason==='short'?`You need ${fmt(res.need)} more.`:'That spot is no longer free. Pick another lit tile.');if(res.reason!=='short'){view.sites=validSites(state,type);view.site=null;placeLine();draw();}return;}
  store();endPlacing();if(!reduced())anims.push({type:'raise',t:type,t0:performance.now(),life:700});
  say(`${BP[type].name} built. ${BP[type].effect}.`);update();wake();}
function say(text){if(view)view.stage.textContent=text;}

/* Display */
function update(){
  if(!view)return;
  view.wood.textContent=state.wood.toLocaleString('en-US');view.stone.textContent=state.stone.toLocaleString('en-US');view.ore.textContent=state.ore.toLocaleString('en-US');
  view.land.textContent=`${state.land+1} / ${CONFIG.lands.length}`;
  if(!view.stage.textContent&&!view.placing)say(state.built.length?'Gather, build, and grow Haven.':'Tap a tree or stone to start working it.');
  const tp=manualPower(state),np=state.tools<CONFIG.toolsMax?manualPower(state,state.tools+1):null;
  upgrade(view.tools,cost(state,'tools'),`Better Tools · Lv ${state.tools}`,np===null?`Hit power ${power(tp)} · tree ${hitsFor('pine',tp)}, stone ${hitsFor('stone',tp)}, ore ${hitsFor('ore',tp)} hits`:`Hit power ${power(tp)} → ${power(np)} · stone ${hitsFor('stone',tp)} → ${hitsFor('stone',np)} hits`);
  upgrade(view.worker,cost(state,'worker'),`Hire Worker · ${state.workers} hired`,state.workers>=CONFIG.workerMax?'All worker places filled':'+1 worker who walks to trees and deposits and works them');
  for(const bp of BLUEPRINTS){const btn=view.bps[bp.id],built=has(state,bp.id),short=!afford(state,bp.cost);
    btn.querySelector('strong').textContent=bp.name+(built?' · Built':'');btn.querySelector('small').textContent=bp.effect+(built||!short?'':` · need ${fmt(shortOf(state,bp.cost))} more`);
    btn.querySelector('b').textContent=built?'Built':fmt(bp.cost);btn.disabled=built||short;btn.setAttribute('aria-label',`${bp.name}. ${bp.effect}. ${built?'Already built.':'Costs '+fmt(bp.cost)+'.'}`);}
  const ex=canExpand(state),xc=expandCost(state);
  view.expand.querySelector('strong').textContent=xc?`Expand · Territory ${state.land+2}`:'Haven at full size';
  view.expand.querySelector('small').textContent=!xc?`All ${CONFIG.lands.length} territories open`:ex.reason==='survey'?'Needs a Survey Post':ex.reason==='short'?`Need ${fmt(ex.need)} more`:'The mist clears; the map grows';
  view.expand.querySelector('b').textContent=xc?fmt(xc):'Max';view.expand.disabled=!ex.ok;view.expand.setAttribute('aria-label',`${view.expand.querySelector('strong').textContent}. ${view.expand.querySelector('small').textContent}.`);
  view.buildToggle.textContent=view.buildPanel.hidden?'Build':'Close';
  if(view.placing)placeLine();
  view.reimport.hidden=storeApi.get(V1_KEY)===null;
  const st=standingIds(state),wd=world(state.origin),count=k=>st.filter(id=>{const n=wd.nodes.get(id).kind;return k==='wood'?isWood(n):n===k;}).length;
  view.canvas.setAttribute('aria-label',`Haven settlement, territory ${state.land+1} of ${CONFIG.lands.length}. ${count('wood')} trees, ${count('stone')} stone and ${count('ore')} ore left. ${state.built.length?'Buildings: '+state.built.map(b=>BP[b.t].name).join(', ')+'.':'No buildings yet.'} Tap a tree or deposit, or press Enter, to work it.`);
  workLine();draw();
}
let workText='';
function workLine(){
  if(!view)return;const n=state.workers;let t='';
  if(n){const working=crew.filter(w=>w.phase==='work').length,walking=crew.filter(w=>w.phase==='walk').length,stuck=crew.filter(w=>w.stuck).length;
    t=n===1?(working?'Your worker is working':walking?'Your worker is walking to a job':'Your worker is resting'):`${n} workers · ${walking} walking · ${working} working`;
    if(stuck===n)t='Workers can’t reach what’s left. Work it yourself.';}
  if(t!==workText){workText=t;view.workText.textContent=t;}view.workText.hidden=!t;
}
function upgrade(btn,c,title,detail){const short=c!==null&&!afford(state,c);btn.querySelector('strong').textContent=title;
  btn.querySelector('small').textContent=c===null?detail:short?`${detail} · need ${fmt(shortOf(state,c))} more`:detail;btn.querySelector('b').textContent=c===null?'Max':fmt(c);
  btn.disabled=c===null||short;btn.setAttribute('aria-label',`${title}. ${btn.querySelector('small').textContent}. ${c===null?'Maximum level.':'Costs '+fmt(c)+'.'}`);}

/* Isometric canvas. The view shows the territory plus a one-tile ring of mist. Tile (c,r) has its top corner at
 * ox+(c−r)·w/2, oy+(c+r−2a)·h/2, where a is the first tile shown and h = w/2. Wider than the screen, the scene scrolls. */
function onResize(){if(!view)return;layout(false);draw();}
function layout(center){
  const cv=view.canvas,cw=view.scene.clientWidth||300,[lo,hi]=land(state),V=hi-lo+2;
  const w=Math.max(24,Math.min(40,Math.floor(cw/10.4/2)*2)),h=w/2,top=Math.round(w*1.5),cssW=Math.round(V*w+w*.6),cssH=Math.round(top+V*h+w*.6+6),dpr=Math.min(root.devicePixelRatio||1,3);
  cv.style.width=cssW+'px';cv.style.height=cssH+'px';cv.width=Math.round(cssW*dpr);cv.height=Math.round(cssH*dpr);
  view.geo={w,h,ox:Math.round(cssW/2),oy:top,a:lo-1,V,dpr,cssW,cssH};
  if(center)view.scene.scrollLeft=Math.max(0,(cssW-cw)/2);
}
const iso=(g,c,r)=>[g.ox+(c-r)*g.w/2,g.oy+(c+r-2*g.a)*g.h/2];
function hit(x,y){
  const g=view.geo;if(!g)return null;
  const u=(x-g.ox)/(g.w/2),v=(y-g.oy)/(g.h/2),c=Math.floor((u+v)/2)+g.a,r=Math.floor((v-u)/2)+g.a,tile=inLand(state,c,r)?wid(c,r):undefined;
  if(view.placing)return{tile};
  // Front objects first; a tap on a canopy, rock or roof counts for it.
  const objs=[...standingIds(state).map(id=>({node:id,id})),...state.built.map(b=>({building:b,id:wid(b.c,b.r)}))].sort((p,q)=>depth(q.id)-depth(p.id));
  for(const o of objs){const [cx,cy]=iso(g,o.id%W+.5,Math.floor(o.id/W)+.5);if(Math.abs(x-cx)<=g.w*.4&&y<=cy+g.h*.5&&y>=cy-g.w*1.3)return o;}
  return tile===undefined?null:{tile};
}
function poly(ctx,pts,fill){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function diamond(ctx,g,c,r,fill,edge){const a=iso(g,c,r),b=iso(g,c+1,r),d=iso(g,c+1,r+1),e=iso(g,c,r+1);poly(ctx,[a,b,d,e],fill);if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}}
// A box standing on the ground at (x,y), half-width hw (px along x), height ht. Top, left and right faces.
function box(ctx,x,y,hw,ht,top,left,right){const hh=hw/2;poly(ctx,[[x-hw,y],[x,y+hh],[x,y+hh-ht],[x-hw,y-ht]],left);poly(ctx,[[x+hw,y],[x,y+hh],[x,y+hh-ht],[x+hw,y-ht]],right);poly(ctx,[[x,y-hh-ht],[x+hw,y-ht],[x,y+hh-ht],[x-hw,y-ht]],top);}
const C={grass:['#2f5a3a','#36643f','#2b5236'],edge:'#1f3c29',dirtL:'#3b2d22',dirtR:'#2a2019',stone:'#7d7a6d',stoneHi:'#a7a08a',stoneLo:'#55544b',faint:'#4a5a48',moss:'#3d6b48',trunk:'#5a3d26',pine:['#163d2b','#1f5238','#2c6b48'],oak:['#1d4a2f','#2a6340','#3f8455'],bush:['#2a5c37','#3b7a4a'],brass:'#d6bd81',roof:'#6e3f2e',roofHi:'#8b5440',wood:'#7a5534',woodHi:'#9a7048',lantern:'#f3c46a',ore:['#3a3540','#4d4654','#2a2630'],vein:'#e09a46',veinHi:'#8fd6c9',mist:'#0d1d22',plot:'rgba(248,220,136,.22)',plotEdge:'#f8dc88'};

function draw(now){
  if(!view?.geo)return;const g=view.geo,ctx=view.canvas.getContext('2d');if(!ctx)return;now=now||performance.now();
  ctx.setTransform(g.dpr,0,0,g.dpr,0,0);ctx.clearRect(0,0,g.cssW,g.cssH);
  const wd=world(state.origin),gone=goneSet(state),[lo,hi]=land(state),smooth=!reduced();
  anims=anims.filter(a=>now-a.t0<a.life);
  const landAnim=anims.find(a=>a.type==='land'),grow=landAnim?(now-landAnim.t0)/landAnim.life:1,[plo,phi]=state.land?CONFIG.lands[state.land-1]:[lo,hi];
  // Earth slab under the territory
  const L=iso(g,lo,hi),B=iso(g,hi,hi),R=iso(g,hi,lo),dep=Math.round(g.w*.3);
  poly(ctx,[L,B,[B[0],B[1]+dep],[L[0],L[1]+dep]],C.dirtL);poly(ctx,[B,R,[R[0],R[1]+dep],[B[0],B[1]+dep]],C.dirtR);
  // Ground: territory, then the ring of mist around it
  for(let r=g.a;r<g.a+g.V;r++)for(let c=g.a;c<g.a+g.V;c++){const id=wid(c,r),sh=wd.shade(id);
    if(inLand(state,c,r)){
      if(wd.rubble.has(id))diamond(ctx,g,c,r,C.faint,C.stoneLo);
      else if(buildingAt(state,id))diamond(ctx,g,c,r,'#4a4334',C.stoneLo);
      else diamond(ctx,g,c,r,C.grass[Math.floor(sh*3)],C.edge);
      if(landAnim&&(c<plo||r<plo||c>=phi||r>=phi)){ctx.globalAlpha=Math.max(0,1-grow);diamond(ctx,g,c,r,C.mist);ctx.globalAlpha=1;}}
    else{ctx.globalAlpha=.85;diamond(ctx,g,c,r,C.mist,'#16302f');ctx.globalAlpha=1;}}
  // Lit tiles while placing
  if(view.placing)for(const id of view.sites){diamond(ctx,g,id%W,Math.floor(id/W),id===view.site?'rgba(248,220,136,.45)':C.plot,C.plotEdge);}
  // Objects back to front
  const objs=[],shaking=new Map(anims.filter(a=>a.type==='shake').map(a=>[a.id,a])),falling=anims.filter(a=>a.type==='fall');
  for(const n of wd.nodes.values()){if(n.land>state.land)continue;const id=n.id,sh=wd.shade(id);
    if(!gone.has(id)){const s=shaking.get(id),dx=s&&smooth?Math.round(Math.sin((now-s.t0)/s.life*Math.PI*4)*2):0;objs.push([n.c+n.r,()=>node(ctx,g,n,sh,dx)]);}
    else if(!buildingAt(state,id))objs.push([n.c+n.r-.1,()=>remains(ctx,g,n)]);}
  for(const f of falling){const n=wd.nodes.get(f.id);if(n)objs.push([n.c+n.r,()=>fallingTree(ctx,g,n.c,n.r,n.kind,wd.shade(n.id),(now-f.t0)/f.life,f.dir)]);}
  for(const id of wd.rubble){const c=id%W,r=Math.floor(id/W);objs.push([c+r,()=>rubble(ctx,g,c,r,wd.shade(id))]);}
  const raise=anims.find(a=>a.type==='raise');
  for(const b of state.built)objs.push([b.c+b.r+.02,()=>{if(raise&&raise.t===b.t)raising(ctx,g,b,(now-raise.t0)/raise.life);else building(ctx,g,b.t,b.c,b.r);}]);
  if(view.placing&&view.site!==null){const c=view.site%W,r=Math.floor(view.site/W);objs.push([c+r+.03,()=>{ctx.globalAlpha=.6;building(ctx,g,view.placing,c,r);ctx.globalAlpha=1;}]);}
  // Mist silhouettes of the forest beyond
  for(let r=g.a;r<g.a+g.V;r++)for(let c=g.a;c<g.a+g.V;c++){if(inLand(state,c,r))continue;const sh=wd.shade(wid(c,r));if(sh<.55)objs.push([c+r,()=>{ctx.globalAlpha=.32;tree(ctx,g,c,r,sh<.3?'pine':'oak',sh);ctx.globalAlpha=1;}]);}
  if(state.workers>0)for(const w of crew){const [wc,wr]=crewPosition(w,smooth);objs.push([wc+wr+.05,()=>worker(ctx,g,w,wc,wr,now,smooth)]);}
  objs.sort((a,b)=>a[0]-b[0]).forEach(o=>o[1]());
  // Work bars over nodes that have been started
  for(const [k,left] of Object.entries(state.hp)){const n=wd.nodes.get(Number(k));if(!n)continue;const max=CONFIG.kinds[n.kind].hp,[x,y]=iso(g,n.c+.5,n.r+.5),bw=Math.round(g.w*.6),bx=Math.round(x-bw/2),by=Math.round(y-g.w*(n.kind==='stone'||n.kind==='ore'||n.kind==='bush'?.62:1.35));
    ctx.fillStyle='#000c';ctx.fillRect(bx-1,by-1,bw+2,6);ctx.fillStyle='#3a2f20';ctx.fillRect(bx,by,bw,4);ctx.fillStyle=Number(k)===view.selected?'#ffe8af':C.brass;ctx.fillRect(bx,by,Math.max(1,Math.round(bw*left/max)),4);}
  // Chips and floating rewards
  for(const a of anims){if(now<a.t0)continue;const k=Math.min(1,(now-a.t0)/a.life),[x,y]=iso(g,a.c+.5,a.r+.5);
    if(a.type==='chips'){ctx.fillStyle=a.color;ctx.globalAlpha=1-k;for(let j=0;j<5;j++){const ang=-Math.PI*(.15+j*.17),d=3+k*g.w*.4;ctx.fillRect(Math.round(x+Math.cos(ang)*d)-1,Math.round(y-g.w*.35+Math.sin(ang)*d+k*k*8)-1,3,3);}ctx.globalAlpha=1;}
    if(a.type==='pop'){const lift=smooth?easeOut(k)*20:0;ctx.globalAlpha=Math.max(0,1-k*k);ctx.font='bold 13px Georgia,serif';ctx.textAlign='center';ctx.fillStyle='#000a';ctx.fillText(a.text,x+1,y-g.w*.9-lift+1);ctx.fillStyle=a.worker?'#9fd8c0':C.brass;ctx.fillText(a.text,x,y-g.w*.9-lift);ctx.globalAlpha=1;}}
}
// Feedback for one hit: a shake and chips; a finished node tips over or crumbles, and its reward floats up.
function struck(id,res,byWorker){const now=performance.now(),c=id%W,r=Math.floor(id/W),smooth=!reduced(),wood=isWood(res.kind);
  if(smooth){anims.push({type:'shake',id,t0:now,life:180});anims.push({type:'chips',c,r,color:wood?'#9a7a52':res.kind==='ore'?C.vein:C.stoneHi,t0:now,life:360});}
  if(!res.done)return;
  if(smooth&&wood){const w=byWorker?crew.find(x=>Math.abs(x.c-c)<=1&&Math.abs(x.r-r)<=1):null;anims.push({type:'fall',id,t0:now,life:420,dir:w&&w.c-w.r>c-r?-1:1});}
  anims.push({type:'pop',c,r,text:'+'+RES.filter(k=>res.gain[k]).map(k=>`${res.gain[k]} ${RES_NAME[k]}`).join(' +'),worker:byWorker,t0:smooth&&wood?now+300:now,life:smooth?850:1100});
  if(res.regrown!==null&&res.regrown!==undefined){const g2=res.regrown;anims.push({type:'pop',c:g2%W,r:Math.floor(g2/W),text:'Regrown',worker:true,t0:now+400,life:1100});}}

function node(ctx,g,n,v,dx){if(isWood(n.kind)){tree(ctx,g,n.c,n.r,n.kind,v,dx);return;}
  const [x0,y0]=iso(g,n.c+.5,n.r+.5),x=Math.round(x0+(v-.5)*4)+dx,y=Math.round(y0),w=g.w;ctx.fillStyle='#0005';ctx.fillRect(x-w*.3,y-2,w*.6,4);
  if(n.kind==='stone'){box(ctx,x-Math.round(w*.08),y,w*.2,w*.2,C.stoneHi,C.stone,C.stoneLo);box(ctx,x+Math.round(w*.14),y+2,w*.13,w*.13,C.stoneHi,C.stone,C.stoneLo);box(ctx,x-Math.round(w*.02),Math.round(y-w*.2),w*.1,w*.1,'#b8b19a',C.stone,C.stoneLo);return;}
  const o=C.ore;box(ctx,x,y,w*.24,w*.26,o[1],o[0],o[2]);box(ctx,x+Math.round(w*.16),y+2,w*.12,w*.14,o[1],o[0],o[2]);
  ctx.fillStyle=C.vein;ctx.fillRect(x-Math.round(w*.14),Math.round(y-w*.2),3,3);ctx.fillRect(x+Math.round(w*.06),Math.round(y-w*.12),3,3);ctx.fillRect(x-Math.round(w*.04),Math.round(y-w*.32),3,2);ctx.fillStyle=C.veinHi;ctx.fillRect(x+Math.round(w*.1),Math.round(y-w*.26),2,2);}
function remains(ctx,g,n){const [x,y]=iso(g,n.c+.5,n.r+.5),w=g.w;
  if(isWood(n.kind)){if(n.kind==='bush')return;ctx.fillStyle=C.trunk;ctx.fillRect(Math.round(x-w*.07),Math.round(y-w*.1),Math.round(w*.14),Math.round(w*.1));ctx.fillStyle='#9a7a52';ctx.fillRect(Math.round(x-w*.07),Math.round(y-w*.12),Math.round(w*.14),3);return;}
  ctx.fillStyle=n.kind==='ore'?C.ore[0]:C.stoneLo;ctx.fillRect(Math.round(x-w*.16),Math.round(y-2),4,3);ctx.fillRect(Math.round(x+w*.06),Math.round(y),4,3);ctx.fillRect(Math.round(x-w*.02),Math.round(y-w*.08),3,2);}
function rubble(ctx,g,c,r,v){const [x,y]=iso(g,c+.5,r+.5),w=g.w;box(ctx,Math.round(x+(v-.5)*w*.3),Math.round(y),w*.14,w*(.1+v*.12),'#6a6a5e','#575649','#43423a');if(v>.5){ctx.fillStyle=C.moss;ctx.fillRect(Math.round(x-w*.2),Math.round(y-w*.06),Math.round(w*.14),3);}}
function tree(ctx,g,c,r,kind,v,dx=0){const [x,y0]=iso(g,c+.5,r+.5),w=g.w,y=Math.round(y0),X=Math.round(x+(v-.5)*w*.12)+dx;
  if(kind==='bush'){const cl=C.bush;ctx.fillStyle='#0004';ctx.fillRect(X-w*.26,y-2,w*.52,4);ctx.fillStyle=cl[0];ctx.fillRect(X-w*.26,y-w*.3,w*.52,w*.3);ctx.fillRect(X-w*.18,y-w*.4,w*.36,w*.1);ctx.fillStyle=cl[1];ctx.fillRect(X-w*.14,y-w*.36,w*.16,w*.1);return;}
  ctx.fillStyle='#0005';ctx.fillRect(X-w*.22,y-2,w*.44,4);ctx.fillStyle=C.trunk;ctx.fillRect(X-Math.max(2,w*.05),y-w*.42,Math.max(4,w*.1),w*.42);
  if(kind==='pine'){const cl=C.pine,tall=w*(1.15+v*.2);for(let k=0;k<3;k++){const b=y-w*.3-k*tall*.26,half=w*(.36-k*.08);poly(ctx,[[X,b-tall*.36],[X+half,b],[X-half,b]],cl[k===2?2:k]);}ctx.fillStyle=cl[2];ctx.fillRect(X-w*.12,y-w*.5,w*.08,w*.08);return;}
  const cl=C.oak,cy=y-w*(.78+v*.12),rr=w*.33;ctx.fillStyle=cl[0];ctx.fillRect(X-rr,cy-rr*.6,rr*2,rr*1.4);ctx.fillRect(X-rr*.7,cy-rr,rr*1.4,rr*2);ctx.fillStyle=cl[1];ctx.fillRect(X-rr*.75,cy-rr*.8,rr*1.2,rr*1.1);ctx.fillStyle=cl[2];ctx.fillRect(X-rr*.5,cy-rr*.7,rr*.5,rr*.4);}
function fallingTree(ctx,g,c,r,kind,v,k,dir){if(k<0||k>=1)return;const [x,y]=iso(g,c+.5,r+.5),e=k*k;ctx.save();ctx.globalAlpha=1-Math.max(0,(k-.55)/.45);ctx.translate(Math.round(x),Math.round(y));ctx.rotate(dir*e*Math.PI*.45);ctx.translate(-Math.round(x),-Math.round(y));tree(ctx,g,c,r,kind,v);ctx.restore();}
// A small worker with a lantern-yellow cap. It bobs while walking and swings its tool while working.
function worker(ctx,g,w,wc,wr,now,smooth){
  const [x0,y0]=iso(g,wc+.5,wr+.5),phase=w.phase;let face=w.face;
  if(phase==='walk'&&w.steps.length){const [nc,nr]=w.steps[0],dx=(nc-w.c)-(nr-w.r);if(dx)face=w.face=dx>0?1:-1;}
  else if(phase==='work'&&w.node!==null){const dx=(w.node%W-w.c)-(Math.floor(w.node/W)-w.r);if(dx)face=w.face=dx>0?1:-1;}
  const bob=smooth&&phase==='walk'?Math.round(Math.abs(Math.sin(w.t/CONFIG.stepMs*Math.PI))*-2):0,x=Math.round(x0),y=Math.round(y0)+bob;
  ctx.globalAlpha=inLand(state,Math.round(wc),Math.round(wr))?1:.75;
  ctx.fillStyle='#0006';ctx.fillRect(x-5,Math.round(y0)-1,10,3);
  ctx.fillStyle='#2d5f6e';ctx.fillRect(x-3,y-11,6,9);ctx.fillStyle='#e0b98d';ctx.fillRect(x-2,y-15,5,4);ctx.fillStyle=C.lantern;ctx.fillRect(x-3,y-17,6,2);
  const n=w.node!==null?world(state.origin).nodes.get(w.node):null,pick=n&&!isWood(n.kind);
  const swing=phase==='work'?(smooth?Math.sin(w.t/CONFIG.workerHitMs*Math.PI*2):((Math.floor(w.t/350)%2)?1:-1)):-.6;
  ctx.save();ctx.translate(x+face*3,y-10);ctx.rotate(face*(.9-swing*.9));ctx.fillStyle=C.wood;ctx.fillRect(-1,-9,2,9);ctx.fillStyle='#c9ced1';if(pick)ctx.fillRect(-4,-10,8,2);else ctx.fillRect(face>0?0:-4,-10,4,4);ctx.restore();
  ctx.globalAlpha=1;
}
/* Placeholder buildings, drawn in code (no final sprites yet). Each fills its tile and stands about a tile tall. */
function building(ctx,g,type,c,r){
  const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0),w=g.w;
  box(ctx,x,y,w*.44,w*.08,C.stoneHi,C.stone,C.stoneLo);const base=y-Math.round(w*.08);
  if(type==='workshop'){box(ctx,x,base,w*.36,w*.36,'#8a7a62',C.wood,'#5c4128');const t=base-w*.36;poly(ctx,[[x-w*.42,t],[x,t+w*.21],[x,t-w*.38]],C.roof);poly(ctx,[[x+w*.42,t],[x,t+w*.21],[x,t-w*.38]],C.roofHi);
    box(ctx,Math.round(x+w*.18),Math.round(t-w*.04),w*.06,w*.26,C.stoneHi,C.stone,C.stoneLo);ctx.fillStyle='#1c140e';ctx.fillRect(Math.round(x+w*.1),Math.round(base-w*.02),Math.round(w*.14),Math.round(-w*.22));ctx.fillStyle=C.lantern;ctx.fillRect(Math.round(x-w*.2),Math.round(base-w*.22),3,3);
    ctx.fillStyle='#3b3b40';ctx.fillRect(Math.round(x-w*.36),Math.round(y-w*.12),Math.round(w*.14),Math.round(w*.06));return;}
  if(type==='lumber'){const t=base-w*.4;poly(ctx,[[x-w*.34,base-w*.02],[x-w*.06,t],[x-w*.02,base+w*.05]],C.wood);poly(ctx,[[x+w*.2,base-w*.08],[x-w*.06,t],[x-w*.02,base+w*.05]],'#5c4128');
    for(let k=0;k<3;k++){const ly=Math.round(base+w*.06-k*w*.09),lx=Math.round(x+w*.08+(k===2?w*.05:0));ctx.fillStyle=C.trunk;ctx.fillRect(lx,ly-Math.round(w*.08),Math.round(w*.28-(k===2?w*.1:0)),Math.round(w*.08));ctx.fillStyle='#c09a68';ctx.fillRect(lx,ly-Math.round(w*.08),Math.round(w*.06),Math.round(w*.08));}
    ctx.fillStyle='#c9ced1';ctx.fillRect(Math.round(x-w*.3),Math.round(base-w*.14),4,3);ctx.fillStyle=C.wood;ctx.fillRect(Math.round(x-w*.29),Math.round(base-w*.11),2,Math.round(w*.12));return;}
  if(type==='stoneyard'){box(ctx,Math.round(x-w*.16),base,w*.14,w*.14,C.stoneHi,C.stone,C.stoneLo);box(ctx,Math.round(x+w*.02),base+3,w*.14,w*.14,C.stoneHi,C.stone,C.stoneLo);box(ctx,Math.round(x-w*.07),Math.round(base-w*.14),w*.12,w*.12,'#b8b19a',C.stone,C.stoneLo);
    ctx.fillStyle=C.wood;ctx.fillRect(Math.round(x+w*.24),Math.round(base-w*.9),3,Math.round(w*.92));ctx.fillRect(Math.round(x-w*.04),Math.round(base-w*.9),Math.round(w*.31),3);ctx.fillStyle='#c9b98a';ctx.fillRect(Math.round(x),Math.round(base-w*.88),1,Math.round(w*.5));
    box(ctx,Math.round(x),Math.round(base-w*.32),w*.06,w*.06,C.stoneHi,C.stone,C.stoneLo);return;}
  // survey post: a wooden lookout with a platform and a brass pennant
  const th=w*1.05,legs=[[-.22,0],[.22,0],[0,.11],[0,-.11]];ctx.fillStyle=C.wood;for(const [lx,ly] of legs)ctx.fillRect(Math.round(x+lx*w)-1,Math.round(base+ly*w-th),3,Math.round(th));
  ctx.fillStyle=C.woodHi;ctx.fillRect(Math.round(x-w*.22),Math.round(base-th*.45),Math.round(w*.44),2);
  box(ctx,x,Math.round(base-th),w*.3,w*.06,C.woodHi,C.wood,'#5c4128');ctx.fillStyle=C.wood;ctx.fillRect(x-1,Math.round(base-th-w*.5),2,Math.round(w*.45));ctx.fillStyle=C.brass;ctx.fillRect(x+1,Math.round(base-th-w*.5),Math.round(w*.2),Math.round(w*.1));ctx.fillStyle=C.lantern;ctx.fillRect(Math.round(x-w*.18),Math.round(base-th-w*.12),3,3);
}
function scaffold(ctx,g,c,r){const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0),w=g.w;box(ctx,x,y,w*.44,w*.06,C.stone,C.stoneLo,'#43423a');ctx.fillStyle=C.woodHi;
  for(const dx of [-.34,-.1,.12,.34])ctx.fillRect(Math.round(x+dx*w)-1,Math.round(y-w*.8),2,Math.round(w*.8));for(const h of [.3,.6])ctx.fillRect(Math.round(x-w*.36),Math.round(y-w*h),Math.round(w*.72),2);}
function raising(ctx,g,b,k){if(k<.4){scaffold(ctx,g,b.c,b.r);return;}const e=easeOut((k-.4)/.6),[x,y]=iso(g,b.c+.5,b.r+.5),w=g.w,top=y-w*1.7,bottom=y+w*.4;
  ctx.save();ctx.beginPath();ctx.rect(x-w,bottom-(bottom-top)*e,w*2,(bottom-top)*e+2);ctx.clip();building(ctx,g,b.t,b.c,b.r);ctx.restore();ctx.globalAlpha=1-e;scaffold(ctx,g,b.c,b.r);ctx.globalAlpha=1;
  ctx.fillStyle='#b9ad8f';for(let j=0;j<5;j++){ctx.globalAlpha=(1-e)*.8;ctx.fillRect(Math.round(x+(j-2)*w*.2),Math.round(y+w*.1-e*w*.3-(j%2)*3),3,3);}ctx.globalAlpha=1;}

/* Haven, the first tab, opens Ruins Reclaimed directly every time (navigation.js). There is no other view and no way
 * through to the retired Hall. page() draws it into the destination; leave() stops it, keeping its progress. */
let shell=null;
function page(host){if(!host)return;if(!shell){shell=document.createElement('div');shell.className='ruins-shell';shell.innerHTML='<div class="ruins-slot"></div>';}
  if(shell.parentNode!==host)host.replaceChildren(shell);mount(shell.firstElementChild);}
function leave(){unmount();}
root.LoreRuinsReclaimed.page=page;root.LoreRuinsReclaimed.leave=leave;
})(globalThis);
