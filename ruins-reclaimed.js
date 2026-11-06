/* Ruins Reclaimed: a test-site-only settlement prototype, shown by the Haven tab.
 * Haven 2.0: gather Wood, Stone and Ore from trees and deposits that take several hits, place buildings on the same
 * map, and expand that one map outwards (8×8 → 12×12 → 16×16).
 * Haven 3.0 adds seven more buildings, three upgrade stages for every building (makeshift, timber, stone), roads,
 * worker jobs and a Settlement Level worked out from what has been built.
 * Everything here is original code. The 2:1 isometric math is the standard textbook projection, worker paths use a plain
 * breadth-first search and the easing is two standard curves. Nothing is copied from mykonos-island-voxels, EasyStar.js,
 * Tween.js or clicker-engine (see docs/RUINS-RECLAIMED-PROTOTYPE.md).
 * Haven 3.5 adds people: Food, a House and a Farm, seven jobs (woodcutter, stone miner, ore miner, farmer, builder,
 * guard, scout), raids by wolves and bandits that can be seen walking in, a palisade, and repairs.
 * It never reads or writes the LOREBOUND save. Its own data lives in localStorage key lorebound-haven-settlement-v5,
 * and only on the test site or a local copy. The earlier keys (lorebound-haven-settlement-v4 for Haven 3.0,
 * lorebound-haven-settlement-v2, which holds Haven 2.0's version 2 or retuned version 3 save, and
 * lorebound-ruins-prototype-v01) are only read, to move their progress over once, and are never changed or deleted.
 * Gathering follows PR #91's retune (f306e3c): nodes hold twice the work, hits by hand are paced at one per 0.48 s,
 * workers swing every 1.75 s for twice the work, and regrowth comes every 3rd node or 20 s of play.
 * Eating, raids and farming only move on while Haven is open and on screen: nothing happens while you're away.
 * All numbers in CONFIG, FX and BLUEPRINTS are trial values for play-testing, not approved balance. */
(function(root){'use strict';

const KEY='lorebound-haven-settlement-v5',V4_KEY='lorebound-haven-settlement-v4',V2_KEY='lorebound-haven-settlement-v2',V1_KEY='lorebound-ruins-prototype-v01',BAD_KEY=KEY+'-unreadable';
// Work: your hit at the starting hit power of 1 does 4 work. Since Haven 2.0's retune a node holds twice the work it
// did at first, so it takes twice your hits; a worker's swing was doubled with it, so workers take as many swings.
const CONFIG=Object.freeze({
  version:5,
  world:16,
  lands:[[4,12],[2,14],[0,16]],      // territory 1 is the old 8×8 in the middle; each expansion adds two tiles all round
  kinds:{
    bush:{hp:16,give:{wood:1,food:2},name:'Berry bush'},     // 4 hits by hand at hit power 1; its berries are the first Food
    pine:{hp:32,give:{wood:2},name:'Pine'},     // 8 hits
    oak:{hp:40,give:{wood:3},name:'Oak'},       // 10 hits
    stone:{hp:56,give:{stone:2},name:'Stone'},  // 14 hits
    ore:{hp:96,give:{ore:2},name:'Ore vein'},   // 24 hits
  },
  manualPower:4,          // your hit: 4 work (hit power 1)
  manualHitMs:480,        // at most one hit by hand every 0.48 s; taps in between do nothing
  toolsStep:1,            // +1 work (+¼ hit power) per Better Tools level
  toolsMax:10,toolsWood:10,toolsStone:3,toolsGrowth:1.6,
  toolsHigh:{wood:700,stone:130,ore:10,growth:1.15},   // Better Tools above Lv 10 (a Foundry allows it) also costs Ore
  workerPower:4,          // a worker's swing: 4 work (the same number of swings per node as at first)
  workerToolsStep:2,      // +2 work per two Better Tools levels
  workerBase:25,workerGrowth:1.8,workerMax:5,
  workerHitMs:1750,       // a worker swings once every 1.75 s while working, only while Haven is open
  stepMs:380,             // and walks one tile in 0.38 s
  roadStep:.6,            // a step onto a road takes 60% of the time
  retryMs:1000,           // a worker with nothing it can reach looks again after 1 s, not every frame
  extraCoreStones:5,      // stone deposits added to the old 8×8 on open ground (the old prototype had 3 unmineable rocks)
  ringNodes:[null,{tree:18,stone:7,ore:4},{tree:24,stone:8,ore:7}],
  regrowEvery:3,          // every 3rd node you finish lets the oldest felled tree or mined deposit grow back
  regrowMs:20000,         // and so does every 20 s of play with Haven open, if nothing has grown back in that time
  expand:[{wood:24,stone:16},{wood:40,stone:24,ore:8}],
  v1:{size:8,treeCounts:[14,16,18]},
  maxLevel:3,             // building stages: 1 makeshift, 2 timber, 3 stone
  upgradeScale:[0,1,2.5,5],
  specialist:1.5,         // a worker on its own job (wood, stone or ore) does 1½× work there
  roadCost:{stone:1},roadMax:80,roadsAt:2,
  // Settlement Level: worked out again from what stands in Haven every time, never stored, so nothing can be counted twice.
  points:{level:10,townHall:2,land:25,road:2,roadCount:20,tool:3,worker:4},
  townHallNeeds:[0,0,8,14],  // Settlement Level needed to raise the Town Hall to Lv 2 and Lv 3
  // Haven 3.5, people and Food (trial numbers).
  workerFlat:7,workerLate:1.15, // recruit costs grow 1.8× each up to the 8th person (as in 3.0), then 1.15× each
  recruitFood:3,recruitFoodStep:2, // and Food: 3, then 2 more for each person already in Haven
  startFood:10,migrateFood:10,migrateFoodEach:5, // a new Haven starts with 1 settler and 10 Food; a 3.0 town gets 10 + 5 a person
  eatMs:60000,            // each person eats 1 Food a minute of play with Haven open
  hungry:.5,              // with no Food, everyone but farmers works at half power, and no one can be recruited
  farmPower:4,cropHp:60,  // a farmer adds 4 to the crop per swing; 60 makes a harvest (15 swings, about 26 s)
  // Raids (trial numbers): only once Haven has a House, a Farm and its first expansion, and only during play.
  graceMs:300000,         // 5 minutes of play before the first raid
  peaceWonMs:240000,peaceLostMs:360000, // quiet time after a raid: 4 minutes after driving it off, 6 after losing
  warnMs:45000,warnScoutMs:15000,warnScouts:4, // the warning comes 45 s ahead, 15 s earlier for each scout (up to 4)
  raidWalkMs:8000,        // raiders take 8 s to walk from the edge of Haven to what they're after
  threat:{beast:4,bandit:6},threatMax:40, // + half the Settlement Level + 1 for every 4 raids so far (up to 5)
  guardPower:3,wallMax:8, // each guard adds 3 to Defense; a palisade round the whole edge adds 8
  lossMin:5,lossMax:15,lossCapBase:10,lossCapLevel:5,lossCapMax:150, // a lost raid takes 5–15% of one resource, capped
  repairShare:.3,repairWork:40,repairPower:8, // repairs cost 30% of the building's price a level, then 40 work by builders or you
  wallCost:{wood:2,stone:1},wallMaxTiles:120,
});
// Building effects by level (index 0 = not built).
const FX=Object.freeze({
  workshopManual:[0,2,3,4],workshopWorker:[0,2,4,6],
  lumber:[1,2,2.5,3],stoneyard:[1,2,2.5,3],stoneyardStone:[0,1,1,2],
  survey:[0,0,.1,.2],sawmill:[0,1,2,3],quarry:[1.5,2,2.5,3],foundryOre:[1.5,2,2.5,3],foundryTools:[0,2,4,6],
  yard:[0,.05,.1,.15],warehouse:[0,1,2,3],watch:[1,3,5,7],
  house:[0,2,4,6],farmYield:[0,2,3,4],farmers:[0,2,3,4],watchDefense:[0,2,4,6],
});
const STAGES=['Makeshift','Timber','Stone'];
const BLUEPRINTS=Object.freeze([
  {id:'workshop',name:'Workshop',group:'found',cost:{wood:10,stone:6},needs:{},
    effects:['+½ hit power for you and for workers','+¾ hit power for you, +1 for workers','+1 hit power for you, +1½ for workers']},
  {id:'lumber',name:'Lumber Camp',group:'found',cost:{wood:18,stone:8},needs:{},
    effects:['Workers do double work on trees and bushes','Workers do 2½× work on trees and bushes','Workers do 3× work on trees and bushes']},
  {id:'stoneyard',name:'Stone Yard',group:'found',cost:{wood:14,stone:12},needs:{},
    effects:['Workers do double work on stone and ore; +1 Stone per deposit','Workers do 2½× work on stone and ore; +1 Stone per deposit','Workers do 3× work on stone and ore; +2 Stone per deposit']},
  {id:'survey',name:'Survey Post',group:'found',cost:{wood:16,stone:10},needs:{},
    effects:['Lets you expand into the mist around Haven','Lets you expand; expanding costs 10% less','Lets you expand; expanding costs 20% less']},
  {id:'sawmill',name:'Sawmill',group:'town',cost:{wood:30,stone:12},needs:{built:['lumber']},
    effects:['+1 Wood from every tree or bush felled','+2 Wood from every tree or bush felled','+3 Wood from every tree or bush felled']},
  {id:'quarry',name:'Quarry',group:'town',cost:{wood:26,stone:22},needs:{built:['stoneyard']},
    effects:['Stone miners do 2× work on stone (1½× without it)','Stone miners do 2½× work on stone','Stone miners do 3× work on stone']},
  {id:'yard',name:'Builder’s Yard',group:'town',cost:{wood:34,stone:22},needs:{built:['workshop','survey']},
    effects:['New buildings and upgrades cost 5% less','New buildings and upgrades cost 10% less','New buildings and upgrades cost 15% less']},
  {id:'townhall',name:'Town Hall',group:'town',cost:{wood:60,stone:40},needs:{built:['workshop','lumber','stoneyard','survey']},
    effects:['The heart of Haven. Other buildings stay at Lv 1 until it grows','Other buildings can be upgraded to Lv 2 (timber)','Other buildings can be upgraded to Lv 3 (stone)']},
  {id:'watchtower',name:'Watchtower',group:'town',cost:{wood:30,stone:26},needs:{built:['survey']},
    effects:['Shows the next land through the mist; regrowth keeps 3 nodes standing; +2 Defense','Regrowth keeps 5 trees or deposits standing; +4 Defense','Regrowth keeps 7 trees or deposits standing; +6 Defense']},
  {id:'warehouse',name:'Warehouse',group:'town',cost:{wood:42,stone:30},needs:{land:1},
    effects:['+1 worker place','+2 worker places','+3 worker places']},
  {id:'foundry',name:'Foundry',group:'town',cost:{wood:36,stone:34,ore:6},needs:{land:1},
    effects:['Better Tools up to Lv 12; ore miners do 2× work on ore (1½× without it)','Better Tools up to Lv 14; ore miners do 2½× work on ore','Better Tools up to Lv 16; ore miners do 3× work on ore']},
  // Haven 3.5: homes and food. Both are open from the start, so Food never waits on anything else.
  {id:'house',name:'House',group:'home',cost:{wood:20,stone:8},needs:{},
    effects:['+2 places for people','+4 places for people','+6 places for people']},
  {id:'farm',name:'Farm',group:'home',cost:{wood:16,stone:4},needs:{},
    effects:['Farmers grow 2 Food a harvest; 2 farmers can work it','Farmers grow 3 Food a harvest; 3 farmers can work it','Farmers grow 4 Food a harvest; 4 farmers can work it']},
]);
const BP=Object.fromEntries(BLUEPRINTS.map(b=>[b.id,b]));
const V2_TYPES=new Set(['workshop','lumber','stoneyard','survey']);
const V4_TYPES=new Set(['workshop','lumber','stoneyard','survey','sawmill','quarry','yard','townhall','watchtower','warehouse','foundry']);
// What a lost raid can put out of action until it's repaired. Never the Town Hall, homes, stores or the Survey Post.
const DAMAGEABLE=['farm','workshop','lumber','stoneyard','sawmill','quarry','foundry','yard','watchtower'];
const RES=['wood','stone','ore','food'],RES_NAME={wood:'Wood',stone:'Stone',ore:'Ore',food:'Food'};
const JOBS=['wood','stone','ore','farm','build','guard','scout'];
const JOB_NAME={wood:'Woodcutters',stone:'Stone miners',ore:'Ore miners',farm:'Farmers',build:'Builders',guard:'Guards',scout:'Scouts'};
const JOB_ONE={wood:'woodcutter',stone:'stone miner',ore:'ore miner',farm:'farmer',build:'builder',guard:'guard',scout:'scout',auto:'settler on Auto'};
const JOB_KIND={wood:'pine',stone:'stone',ore:'ore'};
const GATHER=new Set(['auto','wood','stone','ore','farm','build']); // jobs that work trees and deposits (farmers forage berry bushes)
const RAID_NAME={beast:'Wolves',bandit:'Bandits'};
/* Haven Management: one drawer under the map with four sections, one open at a time. "jobs" is People. Defense shows
 * raids, guards, the palisade and repairs; Land holds expansion. */
const TABS=Object.freeze([{id:'build',name:'Build',pane:'ruinsBuild'},{id:'jobs',name:'People',pane:'ruinsJobs'},{id:'defense',name:'Defense',pane:'ruinsDefensePane'},{id:'land',name:'Land',pane:'ruinsLandPane'}]);
const MILESTONES=Object.freeze([
  {lv:2,text:'Roads unlocked'},
  {lv:8,text:'Town Hall can grow to Lv 2 (timber)'},
  {lv:14,text:'Town Hall can grow to Lv 3 (stone)'},
  {lv:16,text:'Haven becomes a Stronghold'},
  {lv:20,text:'A banner flies over the Town Hall'},
]);
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
const lvOf=(s,type)=>s.built.find(b=>b.t===type)?.lv||0;
const isRoad=(s,id)=>s.roads.includes(id);
const isWall=(s,id)=>!!s.walls&&s.walls.includes(id);
// A building a raid has damaged does nothing until it's repaired, but keeps its level, its tile and its place in
// Settlement Level. on() is the level that counts for what a building does; lvOf() is the level it has.
const isBroken=(s,type)=>!!s.broken&&Object.prototype.hasOwnProperty.call(s.broken,type);
const on=(s,type)=>isBroken(s,type)?0:lvOf(s,type);
const emptyJobs=()=>Object.fromEntries(JOBS.map(j=>[j,0]));

// A blank Haven 3.5 state. newGame() is what a player starting out gets: one settler and a little Food.
function fresh(origin=0){return{v:CONFIG.version,wood:0,stone:0,ore:0,food:0,tools:0,workers:0,origin,land:0,tally:0,gone:[],hp:{},built:[],roads:[],jobs:emptyJobs(),
  crop:0,eat:0,raids:0,calm:CONFIG.graceMs,raid:'',broken:{},walls:[],last:null};}
function newGame(origin=0){const s=fresh(origin);s.workers=1;s.food=CONFIG.startFood;return s;}
const int=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const toolsCap=s=>CONFIG.toolsMax+FX.foundryTools[lvOf(s,'foundry')];
// Places for people: 5 to start, plus the Warehouse and the House. A damaged building never takes places away.
const workerCap=s=>CONFIG.workerMax+FX.warehouse[lvOf(s,'warehouse')]+FX.house[lvOf(s,'house')];

/* Shared strict checks for felled nodes, work left and buildings. Returns clean copies, or null. */
function checkCore(o,types,maxLv){
  const wd=world(o.origin),seen=new Set();
  for(const id of o.gone){const n=wd.nodes.get(id);if(!int(id,0,W*W-1)||!n||n.land>o.land||seen.has(id))return null;seen.add(id);}
  const hp={};
  for(const [k,v] of Object.entries(o.hp)){if(!/^\d{1,3}$/.test(k))return null;const id=Number(k),n=wd.nodes.get(id);
    if(!n||n.land>o.land||seen.has(id)||!int(v,1,CONFIG.kinds[n.kind].hp-1))return null;hp[id]=v;}
  if(o.built.length>types.size)return null;
  const [lo,hi]=CONFIG.lands[o.land],done=new Set(),tiles=new Set(),built=[];
  for(const b of o.built){
    if(!plain(b)||Object.keys(b).sort().join()!=='c,lv,r,t'||!types.has(b.t)||done.has(b.t)||!int(b.lv,1,maxLv)||!int(b.c,lo,hi-1)||!int(b.r,lo,hi-1))return null;
    const id=wid(b.c,b.r);if(tiles.has(id)||wd.rubble.has(id)||(wd.nodes.has(id)&&!seen.has(id)))return null;
    done.add(b.t);tiles.add(id);built.push({t:b.t,c:b.c,r:b.r,lv:b.lv});}
  return{gone:[...o.gone],hp,built,tiles,seen,wd};
}
/* Strict check of stored Haven 3.0 (version 4) or 3.5 (version 5) data. Returns a clean copy, or null for anything
 * unexpected. Version 4 is checked exactly as Haven 3.0 checked it. */
const CALM_MAX=Math.max(CONFIG.graceMs,CONFIG.peaceWonMs,CONFIG.peaceLostMs);
const V4_FIELDS='built,gone,hp,jobs,land,ore,origin,roads,stone,tally,tools,v,wood,workers';
const V5_FIELDS='broken,built,calm,crop,eat,food,gone,hp,jobs,land,last,ore,origin,raid,raids,roads,stone,tally,tools,v,walls,wood,workers';
function checkTiles(list,o,core,max){if(!Array.isArray(list)||list.length>max)return null;const [lo,hi]=CONFIG.lands[o.land],out=new Set();
  for(const id of list){if(!int(id,0,W*W-1)||out.has(id))return null;const c=id%W,r=Math.floor(id/W);
    if(c<lo||r<lo||c>=hi||r>=hi||core.tiles.has(id)||core.wd.rubble.has(id)||(core.wd.nodes.has(id)&&!core.seen.has(id)))return null;out.add(id);}return out;}
function validateAt(o,ver){
  if(!plain(o))return null;
  if(Object.keys(o).sort().join()!==(ver===4?V4_FIELDS:V5_FIELDS))return null;
  const jobs=ver===4?['wood','stone','ore']:JOBS,cap=ver===4?3:9;
  if(o.v!==ver||!int(o.wood,0,1e9)||!int(o.stone,0,1e9)||!int(o.ore,0,1e9)||!int(o.tools,0,CONFIG.toolsMax+6)||!int(o.workers,0,CONFIG.workerMax+cap)
    ||!int(o.origin,0,9999)||!int(o.land,0,CONFIG.lands.length-1)||!int(o.tally,0,1e9)||!Array.isArray(o.gone)||!plain(o.hp)||!Array.isArray(o.built)||!Array.isArray(o.roads)||!plain(o.jobs))return null;
  const core=checkCore(o,ver===4?V4_TYPES:new Set(Object.keys(BP)),CONFIG.maxLevel);if(!core)return null;
  if(o.tools>toolsCap(core)||o.workers>workerCap(core))return null;
  const roads=checkTiles(o.roads,o,core,CONFIG.roadMax);if(!roads)return null;
  if(Object.keys(o.jobs).sort().join()!==[...jobs].sort().join()||!jobs.every(k=>int(o.jobs[k],0,o.workers))||jobs.reduce((a,k)=>a+o.jobs[k],0)>o.workers)return null;
  const out={v:o.v,wood:o.wood,stone:o.stone,ore:o.ore,tools:o.tools,workers:o.workers,origin:o.origin,land:o.land,tally:o.tally,gone:core.gone,hp:core.hp,built:core.built,
    roads:[...o.roads],jobs:Object.fromEntries(jobs.map(j=>[j,o.jobs[j]]))};
  if(ver===4)return out;
  // Haven 3.5's own fields.
  if(!int(o.food,0,1e9)||!int(o.crop,0,CONFIG.cropHp-1)||!int(o.eat,0,CONFIG.eatMs-1)||!int(o.raids,0,1e9)||!int(o.calm,0,CALM_MAX)
    ||(o.raid!==''&&!RAID_NAME[o.raid])||!plain(o.broken))return null;
  const walls=checkTiles(o.walls,o,core,CONFIG.wallMaxTiles);if(!walls)return null;
  for(const id of walls)if(roads.has(id))return null;
  const broken={};for(const [t,left] of Object.entries(o.broken)){if(!DAMAGEABLE.includes(t)||!core.built.some(b=>b.t===t)||!int(left,0,CONFIG.repairWork))return null;broken[t]=left;}
  let last=null;
  if(o.last!==null){const l=o.last;if(!plain(l)||Object.keys(l).sort().join()!=='def,hit,k,n,res,th'||!RAID_NAME[l.k]||!int(l.th,0,CONFIG.threatMax)||!int(l.def,0,1e6)
      ||(l.res!==''&&!RES.includes(l.res))||!int(l.n,0,1e9)||(l.hit!==''&&!DAMAGEABLE.includes(l.hit))||(l.res===''&&l.n!==0))return null;
    last={k:l.k,th:l.th,def:l.def,res:l.res,n:l.n,hit:l.hit};}
  return{...out,food:o.food,crop:o.crop,eat:o.eat,raids:o.raids,calm:o.calm,raid:o.raid,broken,walls:[...o.walls],last};
}
const validate=o=>validateAt(o,CONFIG.version);
const validateV4=o=>validateAt(o,4);
/* Haven 3.0 → 3.5: everything carries over exactly (resources, tools, people, felled trees, work left on nodes,
 * buildings, roads, expansions and jobs). People are the same people, never doubled. New: a store of Food so the town
 * isn't hungry the moment it opens (10, and 5 more a person), the four new jobs empty, and the full 5 minutes of play
 * before any raid can come. */
function fromV4(o4){return{...o4,v:CONFIG.version,gone:[...o4.gone],hp:{...o4.hp},built:o4.built.map(b=>({...b})),roads:[...o4.roads],jobs:{...emptyJobs(),...o4.jobs},
  food:CONFIG.migrateFood+CONFIG.migrateFoodEach*o4.workers,crop:0,eat:0,raids:0,calm:CONFIG.graceMs,raid:'',broken:{},walls:[],last:null};}
/* Haven 2.0's stored data (key lorebound-haven-settlement-v2), checked exactly as Haven 2.0 checks it: version 3 is
 * its retuned save, version 2 the one from before nodes held twice the work (its part-worked nodes hold half as much). */
function validateV2(o){
  if(!plain(o)||(o.v!==2&&o.v!==3))return null;
  if(Object.keys(o).sort().join()!=='built,gone,hp,land,ore,origin,stone,tally,tools,v,wood,workers')return null;
  const scale=o.v===2?2:1;for(const [k,v] of Object.entries(o.hp)){const n=world(Number.isSafeInteger(o.origin)?o.origin:0).nodes.get(Number(k));if(n&&Number.isSafeInteger(v)&&v>CONFIG.kinds[n.kind].hp/scale-1)return null;}
  if(!int(o.wood,0,1e9)||!int(o.stone,0,1e9)||!int(o.ore,0,1e9)||!int(o.tools,0,CONFIG.toolsMax)||!int(o.workers,0,CONFIG.workerMax)
    ||!int(o.origin,0,9999)||!int(o.land,0,CONFIG.lands.length-1)||!int(o.tally,0,1e9)||!Array.isArray(o.gone)||!plain(o.hp)||!Array.isArray(o.built))return null;
  const core=checkCore(o,V2_TYPES,1);if(!core)return null;
  return{v:o.v,wood:o.wood,stone:o.stone,ore:o.ore,tools:o.tools,workers:o.workers,origin:o.origin,land:o.land,tally:o.tally,gone:core.gone,hp:core.hp,built:core.built};
}
/* Haven 2.0 → 3.0: everything carries over exactly (resources, tools, workers, felled trees, work left on nodes,
 * buildings and their tiles, both expansions). New: no roads yet, and every worker on Auto. Work left on a node from
 * a save older than the retune doubles with the node, so it keeps the same share done. */
function fromV2(o2){const hp={};for(const [k,v] of Object.entries(o2.hp))hp[k]=o2.v===2?v*2:v;
  return fromV4({...o2,v:4,gone:[...o2.gone],hp,built:o2.built.map(b=>({...b})),roads:[],jobs:{wood:0,stone:0,ore:0}});}
/* Moving the first prototype over: its Wood, Better Tools and workers carry over as they are, and the patch it was on
 * becomes the middle of the settlement with the same trees already cleared (so they are not paid again). Patches
 * finished before that can't become land (their Wood was already paid), and no building is invented for them. */
function migrate(o1){
  const s=fresh(o1.patch);s.wood=o1.wood;s.tools=Math.min(o1.tools,CONFIG.toolsMax);s.workers=Math.min(o1.workers,CONFIG.workerMax);
  const off=CONFIG.lands[0][0];s.gone=o1.cleared.map(t=>wid(t%8+off,Math.floor(t/8)+off));s.food=CONFIG.migrateFood+CONFIG.migrateFoodEach*s.workers;return s;
}
/* Picks the state to play from a store with get(key)/set(key,value). Never deletes anything: an unreadable 3.5 save is
 * copied to its own key before anything replaces it, and the Haven 3.0, 2.0 and first-prototype keys are only read, so
 * they stay as backups. A player with none of them starts a new game with one settler. */
function loadFrom(store){
  const raw5=store.get(KEY);let note='';
  if(raw5!==null&&raw5!==undefined){let s=null;try{s=validate(JSON.parse(raw5));}catch{}if(s)return{state:s,note:''};store.set(BAD_KEY,raw5);note='unreadable';}
  const raw4=store.get(V4_KEY);
  if(raw4!==null&&raw4!==undefined){let o=null;try{o=validateV4(JSON.parse(raw4));}catch{}if(o)return{state:fromV4(o),note:note||'upgraded',from:4};}
  const raw2=store.get(V2_KEY);
  if(raw2!==null&&raw2!==undefined){let o=null;try{o=validateV2(JSON.parse(raw2));}catch{}if(o)return{state:fromV2(o),note:note||'upgraded',from:2};}
  const raw1=store.get(V1_KEY);
  if(raw1!==null&&raw1!==undefined){let o=null;try{o=validateV1(JSON.parse(raw1));}catch{}if(o)return{state:migrate(o),note:note||'moved',old:o,from:1};}
  return{state:newGame(),note};
}

/* ---------- Rules ---------- */
const afford=(s,c)=>RES.every(k=>s[k]>=(c[k]||0));
const shortOf=(s,c)=>{const o={};for(const k of RES)if((c[k]||0)>s[k])o[k]=c[k]-s[k];return o;};
function pay(s,c){for(const k of RES)s[k]-=c[k]||0;}
function scaled(c,keep){const o={};for(const k of RES)if(c[k])o[k]=keep===1?c[k]:Math.max(1,Math.round(c[k]*keep));return o;}
function cost(s,kind){
  if(kind==='tools'){const t=s.tools;if(t>=toolsCap(s))return null;
    if(t<CONFIG.toolsMax)return{wood:Math.round(CONFIG.toolsWood*CONFIG.toolsGrowth**t),stone:t?Math.round(CONFIG.toolsStone*CONFIG.toolsGrowth**(t-1)):0};
    const h=CONFIG.toolsHigh,k=h.growth**(t-CONFIG.toolsMax+1);return{wood:Math.round(h.wood*k),stone:Math.round(h.stone*k),ore:h.ore*(t-CONFIG.toolsMax+1)};}
  if(kind==='worker'){if(s.workers>=workerCap(s))return null;const n=s.workers,F=CONFIG.workerFlat;
    // Up to the 8th person exactly as Haven 3.0 priced them; after that each costs 15% more, not 80%.
    const wood=Math.round(CONFIG.workerBase*CONFIG.workerGrowth**Math.min(n,F)*CONFIG.workerLate**Math.max(0,n-F));
    return{wood,food:CONFIG.recruitFood+CONFIG.recruitFoodStep*n};}
  return null;
}
const manualPower=(s,tools=s.tools)=>CONFIG.manualPower+tools*CONFIG.toolsStep+FX.workshopManual[on(s,'workshop')];
const fits=(role,kind)=>role==='wood'?isWood(kind):role==='farm'?kind==='bush':role===kind;
function workerPower(s,kind,role='auto',tools=s.tools){
  const base=CONFIG.workerPower+CONFIG.workerToolsStep*Math.floor(tools/2)+FX.workshopWorker[on(s,'workshop')];
  const camp=isWood(kind)?FX.lumber[on(s,'lumber')]:FX.stoneyard[on(s,'stoneyard')];
  const own=!fits(role,kind)?1:role==='stone'?FX.quarry[on(s,'quarry')]:role==='ore'?FX.foundryOre[on(s,'foundry')]:CONFIG.specialist;
  return Math.max(1,Math.round(base*camp*own));
}
const hitsFor=(kind,power)=>Math.ceil(CONFIG.kinds[kind].hp/power);
// Out of Food: everyone but farmers works at half power until there is Food again.
const hungry=s=>s.workers>0&&s.food<=0;
const fed=(s,role,p)=>hungry(s)&&role!=='farm'?Math.max(1,Math.round(p*CONFIG.hungry)):p;
function buy(s,kind){const c=cost(s,kind);if(c===null)return{ok:false,reason:'max'};if(kind==='worker'&&hungry(s))return{ok:false,reason:'hungry'};
  if(!afford(s,c))return{ok:false,reason:'short',need:shortOf(s,c)};pay(s,c);if(kind==='tools')s.tools++;else s.workers++;return{ok:true,cost:c};}

/* One hit on a standing node. Work is stored on the node, and its resources are paid exactly once, by the hit that
 * finishes it. A hit on anything else (a felled tree, empty ground, a node in the mist) does nothing. */
function hitNode(s,id,power){
  if(!standing(s,id)||!int(power,1,1000))return null;
  const n=world(s.origin).nodes.get(id),max=CONFIG.kinds[n.kind].hp,left=(s.hp[id]??max)-power;
  if(left>0){s.hp[id]=left;return{done:false,left,max,kind:n.kind};}
  delete s.hp[id];s.gone.push(id);
  const gain=yieldOf(s,n.kind);
  for(const k of RES)if(gain[k])s[k]+=gain[k];
  s.tally++;const regrown=regrow(s);
  return{done:true,left:0,max,kind:n.kind,gain,regrown};
}
/* Regrowth, so the settlement can't run dry: every 3rd node finished (or straight away when fewer than one is left
 * standing; a Watchtower raises that to 3, 5 or 7), the oldest felled tree or mined deposit grows back at full strength,
 * on a tile with no building or road on it and only where it wouldn't wall off open ground. It always needs the full
 * work again, so it can't be farmed for instant resources. At most one grows back per node finished.
 * timedRegrow() below adds the same thing after 20 s of play. */
function regrow(s){
  if(s.tally%CONFIG.regrowEvery!==0&&standingIds(s).length>=FX.watch[on(s,'watchtower')])return null;
  return regrowOldest(s);
}
/* The play-time fallback: one count-down, clock.left, moved on only by Haven's own frames while it's open and visible
 * (each at most 100 ms), so time away never counts. When it runs out the oldest node grows back and it starts again.
 * It waits at full while nothing is felled; the caller resets it whenever something grows back the other way. */
function timedRegrow(s,clock,dt){
  if(!s.gone.length){clock.left=CONFIG.regrowMs;return null;}
  if(!(dt>0))return null;
  clock.left-=Math.min(dt,CONFIG.regrowMs);if(clock.left>0)return null;
  clock.left=CONFIG.regrowMs;return regrowOldest(s);
}
// The pace of hits by hand: a hit counts only 0.48 s or more after the last one that counted.
const canSwing=(last,now)=>last===null||now<last||now-last>=CONFIG.manualHitMs;
function regrowOldest(s){
  const b=blocked(s),before=reach(s,b);
  for(let i=0;i<s.gone.length;i++){const id=s.gone[i];if(buildingAt(s,id)||isRoad(s,id)||isWall(s,id))continue;
    b.add(id);const after=reach(s,b);b.delete(id);if(after.size<before.size-(before.has(id)?1:0))continue;
    s.gone.splice(i,1);return id;}
  return null;
}

/* Walking: inside the territory only on open ground or roads (not standing nodes, buildings or rubble), plus a one-tile
 * ring of forest edge just outside it, which is always open. Four straight directions only. */
function blocked(s){const wd=world(s.origin),b=new Set(wd.rubble);for(const id of standingIds(s))b.add(id);for(const x of s.built)b.add(wid(x.c,x.r));return b;}
function walkable(s,c,r,b=blocked(s)){const [lo,hi]=land(s);if(c<lo-1||r<lo-1||c>hi||r>hi)return false;if(c<lo||r<lo||c>=hi||r>=hi)return true;return !b.has(wid(c,r));}
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]],AROUND=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
// The open tiles inside the territory that can be walked to from the forest edge.
function reach(s,b=blocked(s)){
  const [lo]=land(s),seen=new Set([`${lo-1},${lo-1}`]),queue=[[lo-1,lo-1]],inside=new Set();
  for(let q=0;q<queue.length;q++){const [x,y]=queue[q];for(const [dx,dy] of DIRS){const nc=x+dx,nr=y+dy,k=`${nc},${nr}`;if(seen.has(k)||!walkable(s,nc,nr,b))continue;seen.add(k);queue.push([nc,nr]);if(inLand(s,nc,nr))inside.add(wid(nc,nr));}}
  return inside;
}
function bfs(s,c,r,b,left){
  const key=(x,y)=>`${x},${y}`,from=new Map([[key(c,r),null]]),queue=[[c,r]];
  for(let q=0;q<queue.length;q++){const [x,y]=queue[q];
    for(const [dx,dy] of AROUND){const tc=x+dx,tr=y+dy;if(inLand(s,tc,tr)&&left.has(wid(tc,tr))){const steps=[];for(let cell=[x,y];from.get(key(...cell))!==null;cell=from.get(key(...cell)))steps.unshift(cell);return{node:wid(tc,tr),steps};}}
    for(const [dx,dy] of DIRS){const nc=x+dx,nr=y+dy,k=key(nc,nr);if(!from.has(k)&&walkable(s,nc,nr,b)){from.set(k,[x,y]);queue.push([nc,nr]);}}}
  return null;
}
/* Nearest standing, unclaimed node a worker at (c,r) can reach: breadth-first search over at most 324 tiles, run only
 * when a worker needs a new target. A worker with a job looks for its own kind first, and works anything else it can
 * reach when none of its kind is left, so it never stands idle. Returns the steps to walk (excluding the start). */
function route(s,c,r,claimed=new Set(),role='auto'){
  const wd=world(s.origin),b=blocked(s),left=standingIds(s).filter(t=>!claimed.has(t));if(!left.length)return null;
  if(role!=='auto'){const mine=new Set(left.filter(t=>fits(role,wd.nodes.get(t).kind)));if(mine.size){const p=bfs(s,c,r,b,mine);if(p)return p;}}
  return bfs(s,c,r,b,new Set(left));
}
// A step onto a road tile is quicker. Positions outside the territory (the forest edge) are never roads.
const stepTime=(s,c,r)=>inLand(s,c,r)&&isRoad(s,wid(c,r))?Math.round(CONFIG.stepMs*CONFIG.roadStep):CONFIG.stepMs;

/* ---------- Building and upgrading ---------- */
function lockReason(s,type){const n=BP[type]?.needs;if(!n)return'';
  const miss=(n.built||[]).filter(t=>!has(s,t));if(miss.length)return`Needs ${miss.map(t=>BP[t].name).join(', ')}`;
  if(n.land&&s.land<n.land)return'Needs the first expansion';return'';}
// The Builder's Yard takes a bounded share off new buildings and upgrades (5%, 10% or 15%, never below 1 of anything).
const discount=(s,c)=>scaled(c,1-FX.yard[on(s,'yard')]);
const buildCost=(s,type)=>discount(s,BP[type].cost);
/* Building: one of each blueprint, on one free tile inside the territory: not on a standing tree or deposit, another
 * building, a road or rubble, and never where it would wall off open ground from the workers. Nothing is paid unless
 * it's built. */
function canPlace(s,type,c,r,b=blocked(s),before=null){
  if(!BP[type])return{ok:false,reason:'type'};if(has(s,type))return{ok:false,reason:'built'};if(lockReason(s,type))return{ok:false,reason:'locked'};
  if(!int(c,0,W-1)||!int(r,0,W-1)||!inLand(s,c,r))return{ok:false,reason:'outside'};
  const id=wid(c,r);if(buildingAt(s,id))return{ok:false,reason:'building'};if(world(s.origin).rubble.has(id))return{ok:false,reason:'rubble'};if(standing(s,id))return{ok:false,reason:'node'};if(isRoad(s,id))return{ok:false,reason:'road'};if(isWall(s,id))return{ok:false,reason:'wall'};
  before=before||reach(s,b);b.add(id);const after=reach(s,b);b.delete(id);
  if(after.size<before.size-(before.has(id)?1:0))return{ok:false,reason:'path'};
  return{ok:true};
}
function validSites(s,type){if(!BP[type]||has(s,type)||lockReason(s,type))return[];const [lo,hi]=land(s),b=blocked(s),before=reach(s,b),out=[];
  for(let r=lo;r<hi;r++)for(let c=lo;c<hi;c++)if(canPlace(s,type,c,r,b,before).ok)out.push(wid(c,r));return out;}
function build(s,type,c,r){const p=canPlace(s,type,c,r);if(!p.ok)return p;const bc=buildCost(s,type);if(!afford(s,bc))return{ok:false,reason:'short',need:shortOf(s,bc)};
  pay(s,bc);s.built.push({t:type,c,r,lv:1});return{ok:true,cost:bc};}

/* Upgrades raise a building where it stands, through three stages. The Town Hall sets how far the others can go,
 * and Settlement Level sets how far the Town Hall can go. Stone (Lv 3) needs Ore for its fittings. */
function maxLevel(s,type){if(type==='townhall'){const L=settlement(s).level,N=CONFIG.townHallNeeds;return L>=N[3]?3:L>=N[2]?2:1;}return Math.max(1,lvOf(s,'townhall'));}
function upgradeCost(s,type){const lv=lvOf(s,type);if(!BP[type]||!lv||lv>=CONFIG.maxLevel)return null;const to=lv+1,b=BP[type].cost,c=scaled(b,CONFIG.upgradeScale[to]);
  if(to===3)c.ore=(c.ore||0)+4+Math.round(((b.wood||0)+(b.stone||0))/12);return discount(s,c);}
function canUpgrade(s,type){const lv=lvOf(s,type);if(!BP[type]||!lv)return{ok:false,reason:'none'};if(lv>=CONFIG.maxLevel)return{ok:false,reason:'max'};
  const c=upgradeCost(s,type),to=lv+1;
  if(lv>=maxLevel(s,type))return{ok:false,reason:type==='townhall'?'level':'townhall',to,cost:c};
  if(!afford(s,c))return{ok:false,reason:'short',to,cost:c,need:shortOf(s,c)};return{ok:true,to,cost:c};}
function upgrade(s,type){const u=canUpgrade(s,type);if(!u.ok)return u;pay(s,u.cost);s.built.find(b=>b.t===type).lv=u.to;return u;}

/* Roads: one tile each, on open ground inside the territory (a felled tree's tile is fine). Never on a standing node,
 * a building, rubble or another road, so a tap on an existing road charges nothing. Workers walk on them faster. */
function canRoad(s,c,r){if(settlement(s).level<CONFIG.roadsAt)return{ok:false,reason:'locked'};if(s.roads.length>=CONFIG.roadMax)return{ok:false,reason:'max'};
  if(!int(c,0,W-1)||!int(r,0,W-1)||!inLand(s,c,r))return{ok:false,reason:'outside'};const id=wid(c,r);
  if(isRoad(s,id))return{ok:false,reason:'road'};if(isWall(s,id))return{ok:false,reason:'wall'};if(buildingAt(s,id))return{ok:false,reason:'building'};if(world(s.origin).rubble.has(id))return{ok:false,reason:'rubble'};if(standing(s,id))return{ok:false,reason:'node'};
  if(!afford(s,CONFIG.roadCost))return{ok:false,reason:'short',need:shortOf(s,CONFIG.roadCost)};return{ok:true};}
function layRoad(s,c,r){const p=canRoad(s,c,r);if(!p.ok)return p;pay(s,CONFIG.roadCost);s.roads.push(wid(c,r));return{ok:true,cost:CONFIG.roadCost};}
function roadSites(s){if(settlement(s).level<CONFIG.roadsAt||s.roads.length>=CONFIG.roadMax)return[];const [lo,hi]=land(s),wd=world(s.origin),out=[];
  for(let r=lo;r<hi;r++)for(let c=lo;c<hi;c++){const id=wid(c,r);if(!isRoad(s,id)&&!isWall(s,id)&&!buildingAt(s,id)&&!wd.rubble.has(id)&&!standing(s,id))out.push(id);}return out;}

/* Jobs: hired workers can be woodcutters, stone miners or ore miners; the rest are on Auto and work anything.
 * Changing jobs never pays anything or restarts a swing; a worker takes its new job when it picks its next target. */
function setJob(s,job,d){if(!JOBS.includes(job)||(d!==1&&d!==-1))return{ok:false,reason:'job'};const n=s.jobs[job]+d,sum=JOBS.reduce((a,k)=>a+s.jobs[k],0)+d;
  if(n<0)return{ok:false,reason:'none'};if(sum>s.workers)return{ok:false,reason:'full'};s.jobs[job]=n;return{ok:true};}
function roleOf(s,k){let n=0;for(const j of JOBS){n+=s.jobs[j];if(k<n)return j;}return'auto';}
// Every worker back on Auto in one go. Like setJob, it pays nothing and restarts no swing.
function allAuto(s){if(!JOBS.some(j=>s.jobs[j]>0))return{ok:false,reason:'none'};for(const j of JOBS)s.jobs[j]=0;return{ok:true};}

/* ---------- Haven Management: ordering, one next goal, what a node gives ----------
 * All worked out from the state as it is; nothing here is stored. */
// What finishing a node of this kind pays right now (the Sawmill and Stone Yard add to it).
function yieldOf(s,kind){const g={...CONFIG.kinds[kind].give};if(kind==='stone')g.stone+=FX.stoneyardStone[on(s,'stoneyard')];if(isWood(kind))g.wood+=FX.sawmill[on(s,'sawmill')];return g;}
// Build list order: 0 can be built or upgraded now, 1 short of Wood, Stone or Ore only, 2 waiting on something else or at its highest level.
function buildRank(s,type){if(!has(s,type)){if(lockReason(s,type))return 2;return afford(s,buildCost(s,type))?0:1;}
  const u=canUpgrade(s,type);return u.ok?0:u.reason==='short'?1:2;}
// Blueprints in list order: ready first, then short, then the rest, each keeping the blueprint order.
const buildOrder=(s,group)=>BLUEPRINTS.filter(b=>b.group===group).map((b,i)=>({id:b.id,k:buildRank(s,b.id)*100+i})).sort((a,b)=>a.k-b.k).map(x=>x.id);
/* At most one next goal, from real unmet needs only, or '' when nothing stands out. It never names anything Haven
 * doesn't have yet (no Food, raids or new districts until those are built). */
function goal(s){
  // Haven 3.5 first: a raid you can still prepare for, a repair you can pay for, then Food running short.
  if(raidsOpen(s)&&(s.raid||s.calm<=warnLead(s))){const k=nextKind(s);if(defense(s).total<threat(s,k))return`${RAID_NAME[k]} are coming. Put more people on Guard (People) or build palisade (Defense).`;}
  const fix=DAMAGEABLE.find(t=>isBroken(s,t)&&canRepair(s,t).ok);if(fix)return`Repair the ${BP[fix].name} so it works again (Defense).`;
  const fr=foodRate(s);
  if(s.workers&&(hungry(s)||(fr.grow<fr.eat&&s.food<fr.eat*2))){
    if(!has(s,'farm'))return lockReason(s,'farm')?'Forage berry bushes for Food.':'Build a Farm to feed Haven (Build), and forage berry bushes.';
    if(farmOpen(s)&&s.jobs.farm<farmCap(s))return'Make someone a Farmer (People) to feed Haven.';
    return'Forage berry bushes for Food.';}
  if(s.workers>=workerCap(s)&&!has(s,'house')&&afford(s,buildCost(s,'house')))return'Build a House so more people can live in Haven.';
  const xc=expandCost(s);
  if(xc&&!has(s,'survey'))return lockReason(s,'survey')?'':'Build a Survey Post to expand into the mist.';
  if(xc&&canExpand(s).ok)return`You can expand Haven to territory ${s.land+2} (Land).`;
  if(!has(s,'townhall')&&!lockReason(s,'townhall'))return'Build the Town Hall so your buildings can grow.';
  if(has(s,'townhall')){const th=lvOf(s,'townhall');if(th<CONFIG.maxLevel&&th<maxLevel(s,'townhall'))return`Raise the Town Hall to Lv ${th+1} so your buildings can grow.`;}
  if(s.workers<workerCap(s)&&!hungry(s)&&afford(s,cost(s,'worker')))return'You can recruit another person (People).';
  return'';}

// Expanding grows the same map by two tiles on every side. Nothing already there moves.
const expandCost=s=>{const c=CONFIG.expand[s.land];return c?scaled(c,1-FX.survey[lvOf(s,'survey')]):null;};
function canExpand(s){const c=expandCost(s);if(!c)return{ok:false,reason:'max'};if(!has(s,'survey'))return{ok:false,reason:'survey',cost:c};if(!afford(s,c))return{ok:false,reason:'short',cost:c,need:shortOf(s,c)};return{ok:true,cost:c};}
function expand(s){const e=canExpand(s);if(!e.ok)return e;pay(s,e.cost);s.land++;return e;}

/* ---------- Haven 3.5: Food ----------
 * People eat while Haven is open and on screen, and only then: 1 Food a person a minute. Food comes from berry bushes
 * (anyone can forage them, farmers look for them first) and from the Farm, where farmers' swings grow a crop that pays
 * at harvest. With no Food nobody starves and nothing is lost: work is slower (farmers excepted) and no one can be
 * recruited until there's Food again. */
const tileOf=(s,type)=>{const b=s.built.find(x=>x.t===type);return b?wid(b.c,b.r):null;};
const farmOpen=s=>has(s,'farm')&&!isBroken(s,'farm');
const farmCap=s=>FX.farmers[on(s,'farm')];
function farmHit(s,p){if(!farmOpen(s)||!int(p,1,1000))return null;s.crop+=p;if(s.crop<CONFIG.cropHp)return{done:false,crop:s.crop};
  s.crop=0;const n=FX.farmYield[on(s,'farm')];s.food+=n;return{done:true,gain:{food:n}};}
// Moves eating on by dt ms of play (at most 1 s at a time). Returns the Food eaten.
function eat(s,dt){if(!s.workers||!(dt>0))return 0;s.eat+=Math.round(Math.min(dt,1000))*s.workers;let n=0;
  while(s.eat>=CONFIG.eatMs){s.eat-=CONFIG.eatMs;if(s.food>0){s.food--;n++;}}return n;}
// Food a minute: what the farmers at the Farm grow, and what everyone eats. Foraging comes on top and isn't counted.
function foodRate(s){const farmers=farmOpen(s)?Math.min(s.jobs.farm,farmCap(s)):0,perHarvest=farmOpen(s)?FX.farmYield[on(s,'farm')]:0;
  const grow=farmers*perHarvest*CONFIG.farmPower*60000/(CONFIG.workerHitMs*CONFIG.cropHp);
  return{grow:Math.round(grow*10)/10,eat:s.workers*60000/CONFIG.eatMs,farmers};}

/* ---------- Haven 3.5: raids ----------
 * Raids start only once Haven has a House, a Farm and its first expansion, and then only after 5 minutes of play.
 * The count-down, the warning and the raiders' walk all run on Haven's own clock, so nothing happens while you're
 * away and a reload never brings a raid sooner. A raid alternates wolves (after Food, at the Farm) and bandits
 * (after whichever resource Haven holds most of, and one working building). When the raiders arrive, Defense against
 * Threat decides it: equal or more drives them off with no loss; less, and they take a capped share of one resource
 * and damage one building until it's repaired. Nothing else is ever taken: no levels, land, buildings or people. */
const raidsOpen=s=>has(s,'house')&&has(s,'farm')&&s.land>=1;
const raidKind=n=>n%2?'bandit':'beast';
const nextKind=s=>s.raid||raidKind(s.raids);
const threat=(s,kind)=>Math.min(CONFIG.threatMax,CONFIG.threat[kind]+Math.floor(settlement(s).level/2)+Math.min(5,Math.floor(s.raids/4)));
// The edge tiles of the territory, where a palisade counts.
function edgeIds(s){const [lo,hi]=land(s),out=[];for(let r=lo;r<hi;r++)for(let c=lo;c<hi;c++)if(c===lo||r===lo||c===hi-1||r===hi-1)out.push(wid(c,r));return out;}
function defense(s){const guards=Math.floor(s.jobs.guard*CONFIG.guardPower*(hungry(s)?CONFIG.hungry:1)),tower=FX.watchDefense[on(s,'watchtower')];
  const edge=edgeIds(s),walled=edge.filter(id=>isWall(s,id)).length,walls=Math.floor(CONFIG.wallMax*walled/edge.length);
  return{guards,tower,walls,walled,edge:edge.length,total:guards+tower+walls};}
const warnLead=s=>CONFIG.warnMs+CONFIG.warnScoutMs*Math.min(s.jobs.scout,CONFIG.warnScouts);
// What raiders are after. Wolves: the Farm. Bandits: one working building, taking turns through what's built.
function raidTarget(s,kind){if(kind==='beast')return farmOpen(s)?'farm':'';
  const list=DAMAGEABLE.filter(t=>has(s,t)&&!isBroken(s,t));return list.length?list[s.raids%list.length]:'';}
function raidLoot(s,kind){if(kind==='beast')return'food';let best='wood';for(const k of RES)if(s[k]>s[best])best=k;return best;}
// What would happen if the raid arrived now. Nothing is changed.
function raidOutcome(s,kind=nextKind(s)){const th=threat(s,kind),d=defense(s),won=d.total>=th;
  if(won)return{kind,won,th,def:d.total,res:'',n:0,hit:''};
  const res=raidLoot(s,kind),pct=Math.min(CONFIG.lossMax,CONFIG.lossMin+Math.round((CONFIG.lossMax-CONFIG.lossMin)*(th-d.total)/th));
  const cap=Math.min(CONFIG.lossCapMax,CONFIG.lossCapBase+CONFIG.lossCapLevel*settlement(s).level),n=Math.min(cap,Math.floor(s[res]*pct/100));
  return{kind,won,th,def:d.total,res:n?res:'',n,pct,cap,hit:raidTarget(s,kind)};}
// The raiders arrive: settled once, all at once. Returns what happened.
function resolveRaid(s){if(!s.raid)return null;const o=raidOutcome(s,s.raid);
  if(!o.won){if(o.n)s[o.res]-=o.n;if(o.hit)s.broken[o.hit]=0;}
  s.raids++;s.raid='';s.calm=o.won?CONFIG.peaceWonMs:CONFIG.peaceLostMs;s.last={k:o.kind,th:o.th,def:o.def,res:o.res,n:o.n,hit:o.hit};return o;}
/* Moves the raid clock on by dt ms of play (at most 1 s at a time). clock.walk is the raiders' walk, kept only while
 * the page is open: after a reload they set off from the edge again, so a reload never skips or repeats a raid. */
function tickThreat(s,clock,dt){if(!(dt>0))return null;dt=Math.min(dt,1000);
  if(s.raid){clock.walk=(clock.walk||0)+dt;if(clock.walk<CONFIG.raidWalkMs)return null;clock.walk=0;return{type:'raid',out:resolveRaid(s)};}
  if(!raidsOpen(s))return null;
  const before=s.calm;s.calm=Math.max(0,Math.round(s.calm-dt));
  if(before>warnLead(s)&&s.calm<=warnLead(s)&&s.calm>0)return{type:'warn',kind:nextKind(s)};
  if(s.calm>0)return null;s.raid=raidKind(s.raids);clock.walk=0;return{type:'spawn',kind:s.raid};}

/* Palisade: one tile at a time on the edge of the territory, 2 Wood and 1 Stone each. Defense counts the share of
 * the edge it covers. People walk through its gates, so it never walls anyone in. */
function canWall(s,c,r){if(settlement(s).level<CONFIG.roadsAt)return{ok:false,reason:'locked'};if(s.walls.length>=CONFIG.wallMaxTiles)return{ok:false,reason:'max'};
  if(!int(c,0,W-1)||!int(r,0,W-1)||!inLand(s,c,r))return{ok:false,reason:'outside'};const id=wid(c,r),[lo,hi]=land(s);
  if(c!==lo&&r!==lo&&c!==hi-1&&r!==hi-1)return{ok:false,reason:'inside'};
  if(isWall(s,id))return{ok:false,reason:'wall'};if(isRoad(s,id))return{ok:false,reason:'road'};if(buildingAt(s,id))return{ok:false,reason:'building'};if(standing(s,id))return{ok:false,reason:'node'};
  if(!afford(s,CONFIG.wallCost))return{ok:false,reason:'short',need:shortOf(s,CONFIG.wallCost)};return{ok:true};}
function layWall(s,c,r){const p=canWall(s,c,r);if(!p.ok)return p;pay(s,CONFIG.wallCost);s.walls.push(wid(c,r));return{ok:true,cost:CONFIG.wallCost};}
function wallSites(s){if(settlement(s).level<CONFIG.roadsAt||s.walls.length>=CONFIG.wallMaxTiles)return[];
  return edgeIds(s).filter(id=>!isWall(s,id)&&!isRoad(s,id)&&!buildingAt(s,id)&&!standing(s,id));}

/* Repairs: pay 30% of the building's price for each of its levels (Wood and Stone only, less with a Builder's Yard),
 * then 40 work by builders, or by you tapping it. It works again the moment the work is done. */
function repairCost(s,type){const b=BP[type].cost,lv=Math.max(1,lvOf(s,type));
  return discount(s,{wood:Math.max(2,Math.round(b.wood*CONFIG.repairShare*lv)),stone:Math.max(1,Math.round(b.stone*CONFIG.repairShare*lv))});}
function canRepair(s,type){if(!isBroken(s,type))return{ok:false,reason:'fine'};if(s.broken[type]>0)return{ok:false,reason:'started'};
  const c=repairCost(s,type);if(!afford(s,c))return{ok:false,reason:'short',cost:c,need:shortOf(s,c)};return{ok:true,cost:c};}
function startRepair(s,type){const r=canRepair(s,type);if(!r.ok)return r;pay(s,r.cost);s.broken[type]=CONFIG.repairWork;return r;}
function repairHit(s,type,p){if(!isBroken(s,type)||!(s.broken[type]>0)||!int(p,1,1000))return null;const left=s.broken[type]-p;
  if(left>0){s.broken[type]=left;return{done:false,left};}delete s.broken[type];return{done:true,left:0};}
const repairing=s=>Object.keys(s.broken).filter(t=>s.broken[t]>0);
// Where guards and scouts keep watch: guards walk between the Watchtower, Town Hall and Survey Post, scouts between
// the Survey Post and Watchtower. With none built they wait by the old ruin.
function postsFor(s,role){const list=(role==='guard'?['watchtower','townhall','survey']:['survey','watchtower']).map(t=>tileOf(s,t)).filter(x=>x!==null);
  return list.length?list:[[...world(s.origin).rubble][0]];}

/* ---------- Settlement Level ----------
 * Worked out from what stands in Haven right now: building levels (the Town Hall counts double), expansions, up to 20
 * roads, Better Tools and workers. Nothing is stored or added by events, so reloading, importing, opening two tabs or
 * tapping again can never raise it. Level L needs 2·(L−1)·L points: Lv 5 at 40, Lv 10 at 180, Lv 20 at 760. */
function points(s){const P=CONFIG.points;let p=0;for(const b of s.built)p+=P.level*b.lv*(b.lv+1)/2*(b.t==='townhall'?P.townHall:1);
  return p+P.land*s.land+P.road*Math.min(s.roads.length,P.roadCount)+P.tool*s.tools+P.worker*s.workers;}
const levelAt=L=>2*(L-1)*L;
const titleOf=L=>L>=20?'Great Stronghold':L>=16?'Stronghold':L>=6?'Town':L>=3?'Village':'Camp';
function settlement(s){const pts=points(s);let L=1;while(levelAt(L+1)<=pts)L++;
  return{level:L,points:pts,at:levelAt(L),next:levelAt(L+1),title:titleOf(L),milestone:MILESTONES.find(m=>m.lv>L)||null};}

/* ---------- Workers ----------
 * A worker walks to the nearest node it can reach that no other worker has claimed, then swings at it every 1.4 s
 * until it's finished (by anyone). Positions are not saved; they walk in again after a reload. */
function crewMember(k,s){const [lo,hi]=land(s),n=hi-lo,o=[5,5,2,2,7,3,6,1][k%8]%n,[c,r]=k%2?[lo+o,hi]:[hi,lo+o];return{k,c,r,steps:[],node:null,task:null,visit:k,phase:'idle',t:0,wait:0,face:1,stuck:false};}
function syncCrew(s,crew){while(crew.length<s.workers)crew.push(crewMember(crew.length,s));crew.length=Math.min(crew.length,s.workers);return crew;}
const POST_MS=5000; // a guard or scout stands at a post for 5 s, then walks to the next one
const typeAt=(s,id)=>buildingAt(s,id)?.t||'';
/* What a person does next, by job. Builders repair what has been paid for; farmers work the Farm (up to its places)
 * or forage berry bushes; guards and scouts keep watch at their posts; everyone else (and builders and farmers with
 * nothing of their own to do) works the nearest tree or deposit, their own kind first. */
function planFor(s,crew,w,role){
  const b=blocked(s);
  if(role==='guard'||role==='scout'){const posts=postsFor(s,role),id=posts[w.visit%posts.length],p=bfs(s,w.c,w.r,b,new Set([id]));return p&&{task:'post',node:id,steps:p.steps};}
  if(role==='build'){const fix=repairing(s).map(t=>tileOf(s,t));if(fix.length){const p=bfs(s,w.c,w.r,b,new Set(fix));if(p)return{task:'repair',node:p.node,steps:p.steps};}}
  if(role==='farm'&&farmOpen(s)&&crew.filter(o=>o!==w&&o.task==='farm').length<farmCap(s)){const p=bfs(s,w.c,w.r,b,new Set([tileOf(s,'farm')]));if(p)return{task:'farm',node:p.node,steps:p.steps};}
  const claimed=new Set(crew.filter(o=>o!==w&&o.task==='node'&&o.node!==null).map(o=>o.node)),p=route(s,w.c,w.r,claimed,role);
  return p&&{task:'node',node:p.node,steps:p.steps};}
// Whether what a person set out to do still makes sense; if not they choose again (only ever on a tile).
function stillOn(s,w,role){
  if(w.node===null)return false;
  if(w.task==='post')return role==='guard'||role==='scout';
  if(w.task==='farm')return role==='farm'&&farmOpen(s);
  if(w.task==='repair')return role==='build'&&(s.broken[typeAt(s,w.node)]||0)>0;
  return GATHER.has(role)&&standing(s,w.node)&&!(role==='build'&&repairing(s).length);}
/* Moves everyone on by dt milliseconds. The caller keeps dt small (at most 100 ms per frame), so time spent away
 * is never made up. Returns what happened, for the display. Nodes are only ever paid by hitNode(), which pays once;
 * a harvest by farmHit() and a repair by repairHit(), the same. */
function simulate(s,crew,dt){
  const events=[];syncCrew(s,crew);
  for(const w of crew){let left=dt,guard=0;const role=roleOf(s,w.k);
    while(left>0&&guard++<64){
      if(w.phase==='idle'){
        if(w.wait>0){const d=Math.min(w.wait,left);w.wait-=d;left-=d;continue;}
        const plan=planFor(s,crew,w,role);
        if(!plan){w.wait=CONFIG.retryMs;w.task=null;const gather=GATHER.has(role)&&standingIds(s).length>0;if(!w.stuck&&gather)events.push({type:'stuck',worker:w.k});w.stuck=gather;continue;}
        w.stuck=false;w.task=plan.task;w.node=plan.node;w.steps=plan.steps;w.phase=plan.steps.length?'walk':plan.task==='post'?'post':'work';w.t=0;events.push({type:'target',worker:w.k,node:w.node,task:w.task});continue;}
      const gone=!stillOn(s,w,role);
      if(w.phase==='walk'){
        // Only change course on a tile, never halfway between two. A newly placed building or a regrown tree in the
        // way sends the worker back to choose again.
        if(w.t===0&&(gone||!walkable(s,w.steps[0][0],w.steps[0][1]))){w.phase='idle';w.node=null;w.task=null;w.steps=[];continue;}
        const need=stepTime(s,w.steps[0][0],w.steps[0][1]),d=Math.max(0,Math.min(left,need-w.t));w.t+=d;left-=d;
        if(w.t>=need){const [nc,nr]=w.steps.shift();w.c=nc;w.r=nr;w.t=0;if(!w.steps.length)w.phase=w.task==='post'?'post':'work';}
        continue;}
      if(w.phase==='post'){
        if(gone){w.phase='idle';w.node=null;w.task=null;w.t=0;continue;}
        const d=Math.min(left,POST_MS-w.t);w.t+=d;left-=d;if(w.t>=POST_MS){w.t=0;w.visit++;w.phase='idle';w.node=null;w.task=null;}
        continue;}
      if(w.phase==='work'){
        if(gone){w.phase='idle';w.node=null;w.task=null;w.t=0;continue;}
        const d=Math.min(left,CONFIG.workerHitMs-w.t);w.t+=d;left-=d;
        if(w.t>=CONFIG.workerHitMs){w.t=0;
          if(w.task==='farm'){const res=farmHit(s,CONFIG.farmPower);if(res)events.push({type:'farm',worker:w.k,node:w.node,res});continue;}
          if(w.task==='repair'){const t=typeAt(s,w.node),res=repairHit(s,t,fed(s,role,CONFIG.repairPower));if(res){events.push({type:'repair',worker:w.k,node:w.node,t,res});if(res.done){w.node=null;w.task=null;w.phase='idle';}}continue;}
          const n=world(s.origin).nodes.get(w.node),res=hitNode(s,w.node,fed(s,role,workerPower(s,n.kind,role)));
          if(res){events.push({type:'hit',worker:w.k,node:w.node,res});if(res.done){w.node=null;w.task=null;w.phase='idle';}}}
        continue;}
      left=0;}}
  return events;
}
function resetCrew(crew){crew.length=0;}
function crewPosition(w,smooth,s){if(w.phase!=='walk'||!w.steps.length)return[w.c,w.r];const [nc,nr]=w.steps[0],k=Math.min(1,w.t/(s?stepTime(s,nc,nr):CONFIG.stepMs)),e=smooth?easeInOut(k):k<.5?0:1;return[w.c+(nc-w.c)*e,w.r+(nr-w.r)*e];}
const easeInOut=k=>.5-Math.cos(Math.PI*k)/2,easeOut=k=>1-(1-k)**3;

const logic={KEY,V4_KEY,V2_KEY,V1_KEY,BAD_KEY,CONFIG,FX,BLUEPRINTS,MILESTONES,JOBS,DAMAGEABLE,v1Patch,validateV1,validateV2,validateV4,fromV2,fromV4,world,land,inLand,standing,standingIds,buildingAt,has,lvOf,on,isBroken,fresh,newGame,validate,migrate,loadFrom,
  hungry,fed,farmOpen,farmCap,farmHit,eat,foodRate,raidsOpen,raidKind,threat,edgeIds,defense,warnLead,raidTarget,raidOutcome,resolveRaid,tickThreat,canWall,layWall,wallSites,
  repairCost,canRepair,startRepair,repairHit,repairing,postsFor,planFor,tileOf,
  cost,afford,manualPower,workerPower,hitsFor,buy,hitNode,regrow,regrowOldest,timedRegrow,canSwing,blocked,walkable,reach,route,stepTime,lockReason,buildCost,canPlace,validSites,build,
  maxLevel,upgradeCost,canUpgrade,upgrade,canRoad,layRoad,roadSites,setJob,roleOf,allAuto,yieldOf,buildRank,buildOrder,goal,TABS,toolsCap,workerCap,expandCost,canExpand,expand,points,levelAt,settlement,simulate,syncCrew,crewPosition};

/* ---------- Everything below needs a browser. ---------- */
// The drawer's open section is kept only while the page is open (never saved), so leaving Haven and coming back keeps it.
let drawerMemory=null;
let state=null,view=null,raf=0,lastFrame=0,anims=[],resetArmed=0,importArmed=0,lastBig=0,loadNote='',loadOld=null,loadSource=0,lastSwing=null,drawnAnims=false,saveClock=0;const crew=[];
const regrowClock={left:CONFIG.regrowMs},raidClock={walk:0};
const host=root.location?.hostname||'';
const TEST=host==='lorebound-dev.github.io'||host==='localhost'||host==='127.0.0.1';
root.LoreRuinsReclaimed={...logic,TEST,mount,unmount,crew,get state(){return state;},get mounted(){return !!view;},get running(){return !!raf;}};
if(typeof document==='undefined')return;

const motionQuery=root.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced=()=>!!motionQuery?.matches;
const storeApi={get:k=>{try{return root.localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{root.localStorage.setItem(k,v);}catch{}}};
function load(){if(state)return state;const r=loadFrom(storeApi);state=r.state;loadNote=r.note;loadOld=r.old||null;loadSource=r.from||0;if(r.note||r.from)store();return state;}
function store(){storeApi.set(KEY,JSON.stringify(state));}
const fmt=c=>RES.filter(k=>c[k]).map(k=>`${c[k]} ${RES_NAME[k]}`).join(' · ')||'Free';
const power=q=>{const v=q/4;return Number.isInteger(v)?String(v):v.toFixed(2).replace(/0$/,'');};
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
const bpButton=b=>`<button type="button" class="ruins-upgrade" data-ruins="bp" data-type="${b.id}"><span><strong></strong><small></small></span><b></b></button>`;

const SKETCH=`<section class="ruins-proto" aria-labelledby="ruinsTitle">
<header class="ruins-head"><div><small>Test prototype · trial numbers</small><h3 id="ruinsTitle">Ruins Reclaimed</h3></div><span class="ruins-head-actions"><button type="button" class="ruins-help-toggle" aria-expanded="false" aria-controls="ruinsHelp" aria-label="How Ruins Reclaimed works">?</button></span></header>
<div class="ruins-help" id="ruinsHelp" hidden><p>Tap a tree, stone or ore vein again and again to work it. Each swing takes about half a second; the thin line under the bar fills when you can swing again. The bar shows the work left; it pays once, when it comes down. Better Tools and the Workshop make each hit stronger.</p><p>Everything you can do sits under the map in four sections: Build, People, Defense and Land. Next shows one thing worth doing.</p><p>Build: pick a building, tap a lit tile, then confirm. Buildings stay where you put them. Tap a building to upgrade it: makeshift, then timber, then stone. The Town Hall sets how far the others can grow.</p><p>Roads: lay them one tile at a time. Workers walk faster on them.</p><p>People: recruit people (they need a place to live and some Food) and give them jobs. Woodcutters and miners do more work on their own kind. Farmers work the Farm or forage berry bushes. Builders repair. Guards add to Defense. Scouts warn of raids sooner. People on Auto work anything.</p><p>Food: everyone eats 1 Food a minute while Haven is open. Berry bushes and the Farm make Food. With no Food nobody is lost, but work is slower and no one joins until there's Food again.</p><p>Raids: once Haven has a House, a Farm and its first expansion, wolves and bandits come now and then, always with a warning. If your Defense (guards, Watchtower, palisade on the edge) is at least their Threat, they're driven off. If not, they take a small share of one resource and damage one building until you repair it. They never take buildings, levels, land or people, and nothing happens while you're away.</p><p>Land: expand Haven when you have a Survey Post.</p><p>Settlement Level comes from what stands in Haven: buildings and their levels, expansions, roads, tools and workers.</p><p>Every ${CONFIG.regrowEvery}rd tree or deposit you finish, and after every ${CONFIG.regrowMs/1000} seconds of play here, the oldest felled one grows back (straight away if nothing is left), so you can't run out. It always needs the full work again.</p><p>Workers swing every ${CONFIG.workerHitMs/1000} seconds, only while this screen is open.</p><p>This is a test. Its Wood, Stone, Ore and Food never touch your Gold, Shards, Essence or save. Numbers are trial values.</p><div class="ruins-help-buttons"><button type="button" data-ruins="reset">Reset demo</button><button type="button" data-ruins="reimport" hidden>Restart from earlier save</button></div></div>
<dl class="ruins-stats"><div><dt>Wood</dt><dd id="ruinsWood">0</dd></div><div><dt>Stone</dt><dd id="ruinsStone">0</dd></div><div><dt>Ore</dt><dd id="ruinsOre">0</dd></div><div><dt>Food</dt><dd id="ruinsFood">0</dd></div></dl>
<div class="ruins-level"><div class="ruins-level-row"><strong id="ruinsLevelName">Settlement Lv 1 · Camp</strong><span id="ruinsLevelPts">0 / 4</span></div><div class="ruins-level-bar" aria-hidden="true"><i id="ruinsLevelBar"></i></div><small id="ruinsNext"></small></div>
<p class="ruins-alert" id="ruinsAlert" role="status" aria-live="polite" hidden></p>
<div class="ruins-scene" id="ruinsScene"><canvas id="ruinsCanvas" tabindex="0" role="img"></canvas></div><p class="ruins-work" id="ruinsWorkText" hidden></p>
<p class="ruins-stage" id="ruinsStage" role="status" aria-live="polite"></p>
<div class="ruins-place" id="ruinsPlace" hidden><p id="ruinsPlaceText"></p><div><button type="button" class="ruins-confirm" data-ruins="confirm">Build here</button><button type="button" class="ruins-cancel" data-ruins="cancel">Cancel</button></div></div>
<div class="ruins-manage" id="ruinsManage">
<div class="ruins-manage-head"><p class="ruins-goal" id="ruinsGoal" hidden></p><button type="button" class="ruins-manage-toggle" data-ruins="manage" aria-expanded="true" aria-controls="ruinsManageBody">Hide</button></div>
<div class="ruins-manage-body" id="ruinsManageBody">
<div class="ruins-tabs" role="tablist" aria-label="Manage Haven">${TABS.map(t=>`<button type="button" role="tab" class="ruins-tab" id="ruinsTab-${t.id}" data-ruins="${t.id}" aria-controls="${t.pane}" aria-selected="false" tabindex="-1">${t.name}</button>`).join('')}</div>
<div class="ruins-pane ruins-build" id="ruinsBuild" role="tabpanel" aria-labelledby="ruinsTab-build" hidden>
<button type="button" class="ruins-upgrade" data-ruins="tools"><span><strong></strong><small></small></span><b></b></button>
<button type="button" class="ruins-upgrade" data-ruins="roads"><span><strong></strong><small></small></span><b></b></button>
<p class="ruins-build-head">Homes &amp; food</p><div class="ruins-bp-list" id="ruinsList-home">${BLUEPRINTS.filter(b=>b.group==='home').map(bpButton).join('')}</div>
<p class="ruins-build-head">Foundations</p><div class="ruins-bp-list" id="ruinsList-found">${BLUEPRINTS.filter(b=>b.group==='found').map(bpButton).join('')}</div>
<p class="ruins-build-head">Town</p><div class="ruins-bp-list" id="ruinsList-town">${BLUEPRINTS.filter(b=>b.group==='town').map(bpButton).join('')}</div></div>
<div class="ruins-pane ruins-jobs" id="ruinsJobs" role="tabpanel" aria-labelledby="ruinsTab-jobs" hidden>
<button type="button" class="ruins-upgrade" data-ruins="worker"><span><strong></strong><small></small></span><b></b></button>
<p id="ruinsJobsText"></p>${JOBS.map(j=>`<div class="ruins-job"><span><strong id="ruinsJobName-${j}"></strong><small id="ruinsJobInfo-${j}"></small></span><button type="button" data-ruins="job" data-job="${j}" data-d="less">−</button><b id="ruinsJobN-${j}">0</b><button type="button" data-ruins="job" data-job="${j}" data-d="add">+</button></div>`).join('')}
<button type="button" class="ruins-cancel ruins-auto" data-ruins="auto">Put every worker on Auto</button></div>
<div class="ruins-pane" id="ruinsDefensePane" role="tabpanel" aria-labelledby="ruinsTab-defense" hidden><p class="ruins-note ruins-threat" id="ruinsDefenseText"></p><p class="ruins-note" id="ruinsDefenseParts"></p><p class="ruins-note" id="ruinsLastRaid" hidden></p>
${DAMAGEABLE.map(t=>`<button type="button" class="ruins-upgrade ruins-repair" data-ruins="repair" data-fix="${t}" hidden><span><strong></strong><small></small></span><b></b></button>`).join('')}
<button type="button" class="ruins-upgrade" data-ruins="walls"><span><strong></strong><small></small></span><b></b></button><p class="ruins-note" id="ruinsWatchText"></p></div>
<div class="ruins-pane" id="ruinsLandPane" role="tabpanel" aria-labelledby="ruinsTab-land" hidden><p class="ruins-note" id="ruinsLandText"></p>
<button type="button" class="ruins-upgrade ruins-expand" data-ruins="expand"><span><strong></strong><small></small></span><b></b></button>
<button type="button" class="ruins-cancel" data-ruins="centre">Show the middle of Haven</button></div>
</div></div>
</section>`;

function mount(slot){
  if(view&&view.root.parentNode===slot)return;
  unmount();load();
  const wrap=document.createElement('div');wrap.innerHTML=SKETCH;const el=wrap.firstElementChild;slot.replaceChildren(el);
  const q=s=>el.querySelector(s);
  view={root:el,canvas:q('#ruinsCanvas'),scene:q('#ruinsScene'),wood:q('#ruinsWood'),stone:q('#ruinsStone'),ore:q('#ruinsOre'),food:q('#ruinsFood'),stage:q('#ruinsStage'),
    alert:q('#ruinsAlert'),defenseParts:q('#ruinsDefenseParts'),lastRaid:q('#ruinsLastRaid'),walls:q('[data-ruins=walls]'),
    repairs:Object.fromEntries(DAMAGEABLE.map(t=>[t,q(`[data-ruins=repair][data-fix=${t}]`)])),walling:false,repairing:null,alertText:null,
    levelName:q('#ruinsLevelName'),levelPts:q('#ruinsLevelPts'),levelBar:q('#ruinsLevelBar'),next:q('#ruinsNext'),
    place:q('#ruinsPlace'),placeText:q('#ruinsPlaceText'),confirm:q('[data-ruins=confirm]'),cancel:q('[data-ruins=cancel]'),buildPanel:q('#ruinsBuild'),expand:q('[data-ruins=expand]'),
    jobsPanel:q('#ruinsJobs'),jobsText:q('#ruinsJobsText'),auto:q('[data-ruins=auto]'),
    manage:q('[data-ruins=manage]'),manageBody:q('#ruinsManageBody'),goal:q('#ruinsGoal'),defenseText:q('#ruinsDefenseText'),watchText:q('#ruinsWatchText'),landText:q('#ruinsLandText'),
    tabs:Object.fromEntries(TABS.map(t=>[t.id,{btn:q(`[data-ruins=${t.id}]`),pane:q('#'+t.pane)}])),lists:{home:q('#ruinsList-home'),found:q('#ruinsList-found'),town:q('#ruinsList-town')},tab:'build',open:true,
    jobs:Object.fromEntries(JOBS.map(j=>[j,{name:q(`#ruinsJobName-${j}`),info:q(`#ruinsJobInfo-${j}`),n:q(`#ruinsJobN-${j}`),less:q(`[data-ruins=job][data-job=${j}][data-d=less]`),add:q(`[data-ruins=job][data-job=${j}][data-d=add]`)}])),
    roads:q('[data-ruins=roads]'),
    bps:Object.fromEntries(BLUEPRINTS.map(b=>[b.id,q(`[data-type=${b.id}]`)])),tools:q('[data-ruins=tools]'),worker:q('[data-ruins=worker]'),workText:q('#ruinsWorkText'),
    help:q('#ruinsHelp'),helpToggle:q('.ruins-help-toggle'),reset:q('[data-ruins=reset]'),reimport:q('[data-ruins=reimport]'),geo:null,down:null,placing:null,roading:false,upgrading:null,site:null,sites:[],selected:null,level:0};
  if(drawerMemory)Object.assign(view,drawerMemory);
  view.place.hidden=true;view.help.hidden=true;
  el.addEventListener('click',onClick);el.addEventListener('keydown',onPanelKey);
  view.canvas.addEventListener('pointerdown',onDown);view.canvas.addEventListener('pointerup',onUp);view.canvas.addEventListener('pointercancel',()=>{if(view)view.down=null;});
  view.canvas.addEventListener('keydown',onKey);
  root.addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVisible);
  syncCrew(state,crew);
  layout(true);
  if(loadNote==='moved'&&loadOld){say(`Your earlier demo moved over: ${loadOld.wood} Wood, Better Tools Lv ${state.tools}, ${plural(state.workers,'worker')}, and ${state.gone.length} trees already cleared in the middle. Patches finished before that don't become land.`);}
  else if(loadNote==='upgraded')say(`Haven 3.5: your settlement moved over with everything where it was (${plural(state.built.length,'building')}, ${plural(state.workers,'person','people')}, territory ${state.land+1}). People now eat Food: you start with ${state.food}. The ${loadSource===4?'3.0':'2.0'} save is kept as a backup.`);
  else if(loadNote==='unreadable')say('The saved settlement could not be read. A copy is kept, and a new one has started.');
  loadNote='';view.level=settlement(state).level;sortBuild();update();wake();
}
function unmount(){
  if(!view)return;sleep();store();anims=[];drawerMemory={tab:view.tab,open:view.open};
  root.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible);
  view.root.remove();view=null;
}

/* One clock: a single requestAnimationFrame loop, only while Haven is open and the page is visible, and only while
 * workers have something to do or an effect is playing. Each frame moves time on by at most 100 ms: no catch-up. */
const busy=()=>state.workers>0||anims.length>0||state.gone.length>0||!!state.raid||raidsOpen(state);
function wake(){if(!view||raf||document.hidden||!busy())return;lastFrame=0;raf=root.requestAnimationFrame(frame);}
function sleep(){if(raf)root.cancelAnimationFrame(raf);raf=0;lastFrame=0;}
function frame(now){
  raf=0;if(!view||document.hidden)return;
  const dt=lastFrame?Math.min(100,Math.max(0,now-lastFrame)):0;lastFrame=now;
  let changed=false;
  if(state.workers>0&&dt>0){
    for(const e of simulate(state,crew,dt)){
      if(e.type==='hit'){changed=true;struck(e.node,e.res,true);}
      else if(e.type==='farm'){changed=true;if(e.res.done)anims.push({type:'pop',c:e.node%W,r:Math.floor(e.node/W),text:`+${e.res.gain.food} Food`,worker:true,t0:now,life:1000});}
      else if(e.type==='repair'){changed=true;if(e.res.done)repaired(e.t,now);}}
  }
  // Play-time regrowth, eating and raids run on this same clock, so they stop whenever Haven is closed or hidden.
  const back=timedRegrow(state,regrowClock,dt);if(back!==null){changed=true;regrown(back,now);}
  const foodBefore=state.food;if(eat(state,dt)){changed=true;if(state.food===0&&foodBefore>0)say('Haven has run out of Food. Work is slower until there is Food again.');}
  const ev=tickThreat(state,raidClock,dt);
  if(ev){changed=true;if(ev.type==='warn')say(`Raid coming: ${RAID_NAME[ev.kind]} in ${Math.ceil(state.calm/1000)} s. Check Defense.`);
    else if(ev.type==='spawn')say(`${RAID_NAME[ev.kind]} are coming in from the edge of Haven!`);
    else if(ev.type==='raid')raided(ev.out,now);}
  saveClock+=dt;
  if(changed){saveClock=0;store();update();}else{if(state.workers>0)workLine();alertLine();if(saveClock>=2000){saveClock=0;store();}}
  // Only redraw when something moves; the last frame of an effect is drawn once more to clear it.
  if(changed||state.workers>0||anims.length||drawnAnims||state.raid){drawnAnims=anims.length>0;draw(now);}
  if(busy()){raf=root.requestAnimationFrame(frame);}else lastFrame=0;
}
function onVisible(){if(!view)return;if(document.hidden){sleep();store();}else{wake();}}

/* Input: a short press without much movement is a tap. Swipes scroll the scene sideways or the page up and down. */
function onDown(e){if(e.button>0)return;view.down={x:e.clientX,y:e.clientY,t:Date.now(),id:e.pointerId};}
function onUp(e){const d=view?.down;if(!d||d.id!==e.pointerId)return;view.down=null;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>12||Date.now()-d.t>700)return;
  const box=view.canvas.getBoundingClientRect();tapAt(e.clientX-box.left,e.clientY-box.top);}
function onKey(e){if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();if(view.roading||view.walling)return;if(view.repairing){confirmRepair();return;}if(view.upgrading){confirmUpgrade();return;}if(view.placing){if(view.site!==null)confirmBuild();return;}
  const target=view.selected!==null&&standing(state,view.selected)?view.selected:standingIds(state).sort((a,b)=>depth(b)-depth(a))[0];if(target!==undefined)work(target);}
const depth=id=>id%W+Math.floor(id/W);
const WHY={outside:'That land is still in the mist.',building:'There is a building there already.',rubble:'That rubble can’t be built on.',node:'Clear that tree or deposit first.',path:'That spot would wall off the paths. Pick another lit tile.',road:'There is a road there already.',wall:'There is palisade there already.',inside:'Palisade goes on the edge of Haven. Pick a lit tile.'};
function tapAt(x,y){
  const t=hit(x,y);if(!t)return;
  if(view.walling){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W),res=layWall(state,c,r);
    if(!res.ok){say(res.reason==='short'?`You need ${fmt(res.need)} more for palisade.`:res.reason==='max'?`Haven has its full ${CONFIG.wallMaxTiles} palisade tiles.`:WHY[res.reason]||'Pick a lit tile.');return;}
    store();view.sites=wallSites(state);say('');update();return;}
  if(view.roading){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W),res=layRoad(state,c,r);
    if(!res.ok){say(res.reason==='short'?'You need 1 more Stone for a road.':res.reason==='max'?`Haven has its full ${CONFIG.roadMax} road tiles.`:WHY[res.reason]||'Pick a lit tile.');return;}
    store();view.sites=roadSites(state);say('');update();return;}
  if(view.placing){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W);
    if(view.sites.includes(t.tile)){view.site=t.tile;placeLine();draw();return;}
    const p=canPlace(state,view.placing,c,r);say(p.ok?'':WHY[p.reason]||'Pick a lit tile.');return;}
  if(t.node!==undefined){work(t.node);return;}
  if(t.building){const type=t.building.t;if(isBroken(state,type)){if(state.broken[type]>0)fix(type);else openRepair(type);return;}openUpgrade(type);return;}
  if(t.raider){const k=state.raid,o=raidOutcome(state,k),tg=raidTarget(state,k);
    say(`${RAID_NAME[k]} · Threat ${o.th} against your Defense ${o.def}${tg?` · heading for the ${BP[tg].name}`:''}. ${o.won?'They will be driven off.':'Add guards in People to drive them off.'}`);return;}
  if(t.person){const w=t.person,role=roleOf(state,w.k),doing=w.task==='farm'?'working the Farm':w.task==='repair'?'repairing':w.task==='post'?'keeping watch':w.phase==='work'?'working':w.phase==='walk'?'walking to a job':'resting';
    say(`A ${JOB_ONE[role]}, ${doing}. Eats 1 Food a minute. Change jobs in People.`);return;}
}
/* A hit by hand on a building being repaired: the same 0.48 s pace as gathering, and your full hit power. */
function fix(type){const now=performance.now();if(!canSwing(lastSwing,now))return;const res=repairHit(state,type,manualPower(state));if(!res)return;lastSwing=now;
  const id=tileOf(state,type);anims.push({type:'chips',c:id%W,r:Math.floor(id/W),color:C.woodHi,t0:now,life:360});store();
  if(res.done)repaired(type,now);else say(`${BP[type].name}: ${res.left} repair work left. Builders help too.`);update();wake();}
function repaired(type,now){const id=tileOf(state,type);if(id!==null)anims.push({type:'pop',c:id%W,r:Math.floor(id/W),text:'Repaired',worker:true,t0:now,life:1100});say(`The ${BP[type].name} is repaired and working again.`);}
// The raiders arrive. Driven off: they run back the way they came. Not: what they took floats up where they struck.
function raided(o,now){if(!o)return;const side=(state.raids-1)%4,from=raidFrom(side),to=o.hit?tileOf(state,o.hit):raidHome();
  if(o.won){if(!reduced())anims.push({type:'flee',kind:o.kind,from,to:[to%W,Math.floor(to/W)],t0:now,life:1400});
    anims.push({type:'pop',c:to%W,r:Math.floor(to/W),text:'Driven off!',worker:true,t0:now,life:1300});
    say(`${RAID_NAME[o.kind]} driven off. Your Defense ${o.def} beat their Threat ${o.th}. Nothing lost.`);}
  else{if(o.n)anims.push({type:'pop',c:to%W,r:Math.floor(to/W),text:`−${o.n} ${RES_NAME[o.res]}`,worker:false,t0:now,life:1500});
    say(`${RAID_NAME[o.kind]} got through: Threat ${o.th} against your Defense ${o.def}.${o.n?` They took ${o.n} ${RES_NAME[o.res]}.`:''}${o.hit?` The ${BP[o.hit].name} is damaged until you repair it (Defense).`:''}`);}
  if(!reduced())anims.push({type:'shake',id:to,t0:now,life:300});}
/* One hit by the player. A worker heading for the same node simply carries on, or picks another once it's done.
 * Taps, clicks, Enter and held-down keys all come through here, so nothing gets round the pace: a tap mid-swing only
 * selects the node and does no work. */
function work(id){const n=world(state.origin).nodes.get(id),now=performance.now();if(!n||!standing(state,id))return;
  if(!canSwing(lastSwing,now)){view.selected=id;draw();return;}
  const res=hitNode(state,id,manualPower(state));if(!res)return;lastSwing=now;anims.push({type:'swing',id,t0:now,life:CONFIG.manualHitMs});view.selected=res.done?null:id;store();struck(id,res,false);
  if(!res.done){const h=Math.ceil(res.left/manualPower(state)),on=crew.some(w=>w.node===id&&w.phase==='work');
    say(`${CONFIG.kinds[n.kind].name}: ${plural(h,'more hit','more hits')} · gives ${fmt(yieldOf(state,n.kind))}${on?' · a worker is on it':''}.`);}update();wake();}
/* The drawer. While a building is being placed, a road laid or an upgrade confirmed, the bar above takes its place,
 * so only one set of choices is open at a time; it comes back on the same section afterwards. */
function showDrawer(){
  const busy=!!(view.placing||view.roading||view.walling||view.upgrading);view.manageBody.hidden=!view.open||busy;
  view.manage.hidden=busy;view.manage.textContent=view.open?'Hide':'Manage Haven';view.manage.setAttribute('aria-expanded',String(view.open));
  view.manage.setAttribute('aria-label',view.open?'Hide Haven Management':'Open Haven Management');
  for(const t of TABS){const v=view.tabs[t.id],on=t.id===view.tab;v.pane.hidden=!on;v.btn.setAttribute('aria-selected',String(on));v.btn.setAttribute('tabindex',on?'0':'-1');}}
// Ready choices first. Only reordered when a section opens or after something is built, never while you're choosing.
function sortBuild(){if(!view)return;for(const g of ['home','found','town']){const list=view.lists[g];if(typeof list?.append!=='function')continue;
  const order=buildOrder(state,g);if(order.every((id,i)=>list.children[i]===view.bps[id]))continue;list.append(...order.map(id=>view.bps[id]));}}
function openTab(id,focus){if(!view.tabs[id])return;endPlacing();view.tab=id;view.open=true;if(id==='build')sortBuild();say('');update();if(focus)view.tabs[id].btn.focus?.();}
// Arrow keys move between the four sections; Escape closes a bar first, then the drawer.
function onPanelKey(e){
  if(e.key==='Escape'){if(view.placing||view.roading||view.walling||view.upgrading){e.preventDefault();endPlacing();say('');update();view.canvas.focus?.();return;}
    if(view.open){e.preventDefault();view.open=false;update();view.manage.focus?.();}return;}
  const tab=e.target?.closest?.('[role=tab]');if(!tab||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'&&e.key!=='Home'&&e.key!=='End'))return;
  e.preventDefault();const i=TABS.findIndex(t=>t.id===view.tab),n=TABS.length,j=e.key==='Home'?0:e.key==='End'?n-1:(i+(e.key==='ArrowRight'?1:n-1))%n;openTab(TABS[j].id,true);}
function onClick(e){
  const b=e.target.closest?.('button');if(!b||!view)return;
  if(b===view.helpToggle){const open=view.help.hidden;view.help.hidden=!open;b.setAttribute('aria-expanded',String(open));return;}
  const what=b.dataset.ruins;
  if(what==='tools'||what==='worker'){const r=buy(state,what);if(r.ok){store();if(what==='worker')syncCrew(state,crew);
    say(what==='tools'?`Better Tools level ${state.tools}. Hit power is now ${power(manualPower(state))}.`:`Someone new joins Haven. ${plural(state.workers,'person','people')} now. They start on Auto; give them a job in People.`);update();wake();}
    else if(r.reason==='hungry')say('No one joins a hungry town. Get some Food first.');return;}
  if(what==='walls'){startWalls();return;}
  if(what==='repair'){openRepair(b.dataset.fix);return;}
  if(TABS.some(t=>t.id===what)){openTab(what,false);return;}
  if(what==='manage'){endPlacing();view.open=!view.open;if(view.open&&view.tab==='build')sortBuild();update();return;}
  if(what==='centre'){layout(true);draw();view.scene.scrollIntoView?.({block:'nearest'});view.canvas.focus?.();return;}
  if(what==='auto'){if(allAuto(state).ok){store();say(`Every worker is on Auto and works anything.`);update();}return;}
  if(what==='job'){const r=setJob(state,b.dataset.job,b.dataset.d==='add'?1:-1);if(r.ok){store();update();}return;}
  if(what==='bp'){if(has(state,b.dataset.type))openUpgrade(b.dataset.type);else startPlacing(b.dataset.type);return;}
  if(what==='roads'){startRoads();return;}
  if(what==='confirm'){if(view.repairing)confirmRepair();else if(view.upgrading)confirmUpgrade();else confirmBuild();return;}
  if(what==='cancel'){const wasRoads=view.roading,wasWalls=view.walling;endPlacing();
    say(wasRoads&&state.roads.length?`${plural(state.roads.length,'road tile')} in Haven.`:wasWalls&&state.walls.length?`${plural(state.walls.length,'palisade tile')} in Haven.`:'');update();return;}
  if(what==='expand'){if(Date.now()-lastBig<700)return;const r=expand(state);
    if(!r.ok){say(r.reason==='survey'?'Build a Survey Post first.':r.reason==='short'?`You need ${fmt(r.need)} more to expand.`:'Haven has reached its full size for now.');return;}
    lastBig=Date.now();store();endPlacing();if(!reduced())anims.push({type:'land',t0:performance.now(),life:900});
    say(`Haven grows. Territory ${state.land+1} / ${CONFIG.lands.length}. New trees, stone${state.land>=1?' and ore':''} wait at the edges.`);layout(true);update();wake();return;}
  if(what==='reset'){if(Date.now()-resetArmed>3000){resetArmed=Date.now();b.textContent='Tap again to reset the demo';return;}
    resetArmed=0;b.textContent='Reset demo';state=newGame();regrowClock.left=CONFIG.regrowMs;raidClock.walk=0;lastSwing=null;resetCrew(crew);anims=[];endPlacing();store();view.level=1;say('Demo reset. Only Haven’s test settlement was cleared.');layout(true);update();wake();return;}
  if(what==='reimport'){const r=loadFrom({get:k=>k===KEY?null:storeApi.get(k),set:()=>{}});if(!r.from)return;
    if(Date.now()-importArmed>3000){importArmed=Date.now();b.textContent='Tap again to replace this settlement';return;}
    importArmed=0;b.textContent='Restart from earlier save';state=r.state;raidClock.walk=0;resetCrew(crew);anims=[];endPlacing();store();view.level=settlement(state).level;
    say(r.from===4?`Restarted from your Haven 3.0 save: ${plural(state.built.length,'building')}, territory ${state.land+1}, ${state.food} Food to start.`:r.from===2?`Restarted from your Haven 2.0 save: ${plural(state.built.length,'building')}, territory ${state.land+1}.`:`Restarted from the old demo: ${state.wood} Wood, Better Tools Lv ${state.tools}, ${plural(state.workers,'worker')}.`);layout(true);update();return;}
}
function startPlacing(type){const bp=BP[type];if(!bp||has(state,type))return;
  const lock=lockReason(state,type);if(lock){say(`${bp.name}: ${lock}.`);return;}
  const c=buildCost(state,type);if(!afford(state,c)){say(`You need ${fmt(shortOf(state,c))} more for the ${bp.name}.`);return;}
  const sites=validSites(state,type);if(!sites.length){say('No free tile to build on. Clear a tree or deposit first.');return;}
  endPlacing();view.placing=type;view.site=null;view.sites=sites;placeLine();update();}
function startRoads(){const st=settlement(state);if(st.level<CONFIG.roadsAt){say(`Roads open at Settlement Lv ${CONFIG.roadsAt}.`);return;}
  const sites=roadSites(state);if(!sites.length){say(state.roads.length>=CONFIG.roadMax?`Haven has its full ${CONFIG.roadMax} road tiles.`:'No open ground for a road. Clear a tree or deposit first.');return;}
  endPlacing();view.roading=true;view.sites=sites;placeLine();update();}
function startWalls(){if(settlement(state).level<CONFIG.roadsAt){say(`Palisade opens at Settlement Lv ${CONFIG.roadsAt}.`);return;}
  const sites=wallSites(state);if(!sites.length){say(state.walls.length>=CONFIG.wallMaxTiles?`Haven has its full ${CONFIG.wallMaxTiles} palisade tiles.`:'The whole edge is walled, or trees and deposits stand on the rest. Clear them first.');return;}
  endPlacing();view.walling=true;view.sites=sites;placeLine();update();}
function openUpgrade(type){if(!has(state,type))return;endPlacing();view.upgrading=type;placeLine();update();}
function openRepair(type){if(!isBroken(state,type))return;if(state.broken[type]>0){say(`The ${BP[type].name} is being repaired: ${state.broken[type]} work left. Builders do it, or tap it yourself.`);return;}
  endPlacing();view.repairing=type;view.upgrading=type;placeLine();update();}
// Paying for a repair, like building: the bar closes on success, so a double tap can't pay twice.
function confirmRepair(){const type=view.repairing;if(!type)return;const res=startRepair(state,type);if(!res.ok){placeLine();return;}
  store();endPlacing();say(`Repair of the ${BP[type].name} paid. ${state.jobs.build?'Your builders are on their way.':'No one is a Builder: tap it yourself to repair it, or make someone a Builder in People.'}`);update();wake();}
function endPlacing(){if(!view)return;view.placing=null;view.roading=false;view.walling=false;view.upgrading=null;view.repairing=null;view.site=null;view.sites=[];view.place.hidden=true;view.confirm.hidden=false;view.cancel.textContent='Cancel';view.confirm.textContent='Build here';}
function placeLine(){view.place.hidden=false;
  if(view.roading){view.confirm.hidden=true;view.cancel.textContent='Done';
    view.placeText.textContent=`Tap lit tiles to lay road, ${fmt(CONFIG.roadCost)} each. Workers walk faster on roads. ${plural(state.roads.length,'tile')} laid.`;return;}
  if(view.walling){view.confirm.hidden=true;view.cancel.textContent='Done';const d=defense(state);
    view.placeText.textContent=`Tap lit edge tiles for palisade, ${fmt(CONFIG.wallCost)} each. ${d.walled} of ${d.edge} edge tiles walled: +${d.walls} Defense (+${CONFIG.wallMax} for all of it).`;return;}
  view.confirm.hidden=false;view.cancel.textContent='Cancel';
  if(view.repairing){const type=view.repairing,u=canRepair(state,type),c=repairCost(state,type);view.confirm.textContent='Repair';view.confirm.disabled=!u.ok;
    view.placeText.textContent=u.reason==='short'?`The ${BP[type].name} is damaged and does nothing until repaired. Repair costs ${fmt(c)}: you need ${fmt(u.need)} more.`
      :`Repair the ${BP[type].name} for ${fmt(c)}? Then builders (or your taps) do ${CONFIG.repairWork} work and it works again.`;return;}
  if(view.upgrading){const type=view.upgrading,bp=BP[type],lv=lvOf(state,type),u=canUpgrade(state,type);view.confirm.textContent='Upgrade';view.confirm.disabled=!u.ok;
    const now=`${bp.name} · Lv ${lv} (${STAGES[lv-1]}): ${bp.effects[lv-1]}.`;
    view.placeText.textContent=u.reason==='max'?`${now} It's at its highest level.`
      :u.reason==='townhall'?`${now} Raise the Town Hall to Lv ${u.to} to upgrade it.`
      :u.reason==='level'?`${now} Lv ${u.to} needs Settlement Lv ${CONFIG.townHallNeeds[u.to]}.`
      :u.reason==='short'?`${now} Lv ${u.to} (${STAGES[u.to-1]}) costs ${fmt(u.cost)}: you need ${fmt(u.need)} more.`
      :`${now} Upgrade to Lv ${u.to} (${STAGES[u.to-1]}) for ${fmt(u.cost)}? ${bp.effects[u.to-1]}.`;return;}
  const bp=BP[view.placing],c=buildCost(state,view.placing);view.confirm.textContent='Build here';view.confirm.disabled=view.site===null;
  view.placeText.textContent=view.site===null?`Tap a lit tile for the ${bp.name}. It costs ${fmt(c)}.`:`Build the ${bp.name} here for ${fmt(c)}?`;}
// A second tap on Build here finds placing already ended, so a double tap can never build or charge twice.
function confirmBuild(){if(!view.placing||view.site===null)return;const type=view.placing,c=view.site%W,r=Math.floor(view.site/W),res=build(state,type,c,r);
  if(!res.ok){say(res.reason==='short'?`You need ${fmt(res.need)} more.`:'That spot is no longer free. Pick another lit tile.');if(res.reason!=='short'){view.sites=validSites(state,type);view.site=null;placeLine();draw();}return;}
  store();endPlacing();sortBuild();if(!reduced())anims.push({type:'raise',t:type,t0:performance.now(),life:700});
  say(`${BP[type].name} built. ${BP[type].effects[0]}.`);update();wake();}
// The same for upgrades: the bar closes on success, so a second tap finds nothing to upgrade.
function confirmUpgrade(){const type=view.upgrading;if(!type)return;const res=upgrade(state,type);
  if(!res.ok){placeLine();return;}
  store();endPlacing();sortBuild();if(!reduced())anims.push({type:'raise',t:type,t0:performance.now(),life:700});
  say(`${BP[type].name} upgraded to Lv ${res.to} (${STAGES[res.to-1]}). ${BP[type].effects[res.to-1]}.`);update();wake();}
function say(text){if(view)view.stage.textContent=text;}

/* Display */
function update(){
  if(!view)return;
  view.wood.textContent=state.wood.toLocaleString('en-US');view.stone.textContent=state.stone.toLocaleString('en-US');view.ore.textContent=state.ore.toLocaleString('en-US');
  view.food.textContent=state.food.toLocaleString('en-US');view.food.classList?.toggle('ruins-empty',hungry(state));
  const st=settlement(state);
  if(view.level&&st.level>view.level){const m=MILESTONES.filter(x=>x.lv>view.level&&x.lv<=st.level).map(x=>x.text).join('. ');say(`${view.stage.textContent} Haven is now Settlement Lv ${st.level} · ${st.title}.${m?' '+m+'.':''}`.trim());}
  view.level=st.level;
  view.levelName.textContent=`Settlement Lv ${st.level} · ${st.title}`;view.levelPts.textContent=`${st.points} / ${st.next}`;
  view.levelBar.style.width=`${Math.round(100*(st.points-st.at)/(st.next-st.at))}%`;
  view.next.textContent=st.milestone?`Next: Lv ${st.milestone.lv} · ${st.milestone.text}`:'Every milestone reached for now';
  if(!view.stage.textContent&&!view.placing&&!view.roading&&!view.upgrading)say(state.built.length?'Gather, build, and grow Haven.':'Tap a tree or stone to start working it.');
  const tp=manualPower(state),np=state.tools<toolsCap(state)?manualPower(state,state.tools+1):null;
  priceButton(view.tools,cost(state,'tools'),`Better Tools · Lv ${state.tools}`,np===null?`Hit power ${power(tp)} · tree ${hitsFor('pine',tp)}, stone ${hitsFor('stone',tp)}, ore ${hitsFor('ore',tp)} hits${state.tools<CONFIG.toolsMax+FX.foundryTools[3]?' · a Foundry allows more':''}`:`Hit power ${power(tp)} → ${power(np)} · stone ${hitsFor('stone',tp)} → ${hitsFor('stone',np)} hits`);
  const cap=workerCap(state);
  priceButton(view.worker,cost(state,'worker'),`Recruit · ${state.workers} / ${cap} people`,state.workers>=cap?`Every place is taken${lvOf(state,'house')<3||lvOf(state,'warehouse')<3?' · a House or Warehouse makes room':''}`:'+1 person, on Auto until you give them a job');
  if(hungry(state)&&state.workers<cap){view.worker.disabled=true;view.worker.querySelector('small').textContent='No one joins a hungry town · get some Food first';}
  for(const bp of BLUEPRINTS){const btn=view.bps[bp.id],lv=lvOf(state,bp.id);let title,detail,price,off;
    if(!lv){const lock=lockReason(state,bp.id),c=buildCost(state,bp.id),short=!afford(state,c);title=bp.name;price=lock?'Locked':fmt(c);off=!!lock||short;
      detail=lock?`${lock} · ${bp.effects[0]}`:bp.effects[0]+(short?` · need ${fmt(shortOf(state,c))} more`:'');}
    else{const u=canUpgrade(state,bp.id);title=`${bp.name} · Lv ${lv}`;off=false;
      if(u.reason==='max'){detail=bp.effects[lv-1];price='Max';}
      else{price=fmt(u.cost);detail=`Lv ${u.to}: ${bp.effects[u.to-1]}`+(u.reason==='townhall'?` · needs Town Hall Lv ${u.to}`:u.reason==='level'?` · needs Settlement Lv ${CONFIG.townHallNeeds[u.to]}`:u.reason==='short'?` · need ${fmt(u.need)} more`:'');}}
    btn.querySelector('strong').textContent=title;btn.querySelector('small').textContent=detail;btn.querySelector('b').textContent=price;btn.disabled=off;
    btn.setAttribute('aria-label',`${title}. ${detail}. ${lv?(price==='Max'?'Highest level.':'Upgrade costs '+price+'.'):price==='Locked'?'Locked.':'Costs '+price+'.'}`);}
  const roadsOpen=st.level>=CONFIG.roadsAt;
  view.roads.querySelector('strong').textContent=`Roads · ${state.roads.length} laid`;
  view.roads.querySelector('small').textContent=roadsOpen?'Workers walk faster on roads. Tap tiles to lay them':`Opens at Settlement Lv ${CONFIG.roadsAt} · workers walk faster on roads`;
  view.roads.querySelector('b').textContent=roadsOpen?`${fmt(CONFIG.roadCost)} each`:'Locked';view.roads.disabled=!roadsOpen||state.roads.length>=CONFIG.roadMax||!afford(state,CONFIG.roadCost);
  view.roads.setAttribute('aria-label',`Roads. ${state.roads.length} laid. ${view.roads.querySelector('small').textContent}.`);
  const auto=state.workers-JOBS.reduce((a,k)=>a+state.jobs[k],0);
  const fr=foodRate(state),net=Math.round((fr.grow-fr.eat)*10)/10;
  view.jobsText.textContent=state.workers?`Population ${state.workers} / ${cap} · ${auto} on Auto. Food a minute: +${fr.grow} from the Farm, −${fr.eat} eaten (${net>=0?'+':''}${net}; berry bushes add more).${hungry(state)?' Out of Food: work is slower.':''}`:'Recruit someone first (above).';
  for(const j of JOBS){const v=view.jobs[j];v.name.textContent=JOB_NAME[j];v.n.textContent=String(state.jobs[j]);v.info.textContent=jobInfo(j);
    v.less.disabled=state.jobs[j]<=0;v.add.disabled=auto<=0;v.less.setAttribute('aria-label',`One fewer ${JOB_ONE[j]}`);v.add.setAttribute('aria-label',`One more ${JOB_ONE[j]}`);}
  const ex=canExpand(state),xc=expandCost(state),seen=sees(state)&&xc?ringCount(state.land+1):'';
  view.expand.querySelector('strong').textContent=xc?`Expand · Territory ${state.land+2}`:'Haven at full size';
  view.expand.querySelector('small').textContent=!xc?`All ${CONFIG.lands.length} territories open`:ex.reason==='survey'?'Needs a Survey Post':ex.reason==='short'?`Need ${fmt(ex.need)} more${seen?' · '+seen:''}`:seen||'The mist clears; the map grows';
  view.expand.querySelector('b').textContent=xc?fmt(xc):'Max';view.expand.disabled=!ex.ok;view.expand.setAttribute('aria-label',`${view.expand.querySelector('strong').textContent}. ${view.expand.querySelector('small').textContent}.`);
  view.auto.disabled=auto===state.workers;view.auto.setAttribute('aria-label',auto===state.workers?'Every worker is already on Auto':'Put every worker on Auto');
  manageText(st,xc);showDrawer();
  if(view.placing||view.roading||view.walling||view.upgrading)placeLine();
  view.reimport.hidden=storeApi.get(V4_KEY)===null&&storeApi.get(V2_KEY)===null&&storeApi.get(V1_KEY)===null;
  const sids=standingIds(state),wd=world(state.origin),count=k=>sids.filter(id=>{const n=wd.nodes.get(id).kind;return k==='wood'?isWood(n):n===k;}).length;
  view.canvas.setAttribute('aria-label',`Haven settlement, territory ${state.land+1} of ${CONFIG.lands.length}, Settlement Lv ${st.level}. ${count('wood')} trees, ${count('stone')} stone and ${count('ore')} ore left. ${state.built.length?'Buildings: '+state.built.map(b=>`${BP[b.t].name} Lv ${b.lv}`).join(', ')+'.':'No buildings yet.'}${state.roads.length?` ${plural(state.roads.length,'road tile')}.`:''}${state.walls.length?` ${plural(state.walls.length,'palisade tile')}.`:''} ${plural(state.workers,'person','people')}, ${state.food} Food.${Object.keys(state.broken).length?` Damaged: ${Object.keys(state.broken).map(t=>BP[t].name).join(', ')}.`:''}${state.raid?` ${RAID_NAME[state.raid]} are attacking.`:''} Tap a tree or deposit, or press Enter, to work it.`);
  workLine();draw();
}
// One short line under each job: what it does now, from the real numbers.
function jobInfo(j){
  if(JOB_KIND[j]){const kind=JOB_KIND[j],noun=j==='wood'?'trees':j==='stone'?'stone':'ore';return`Hit power ${power(workerPower(state,kind,j))} on ${noun} · Auto ${power(workerPower(state,kind))}`;}
  if(j==='farm')return farmOpen(state)?`${FX.farmYield[on(state,'farm')]} Food a harvest · ${Math.min(state.jobs.farm,farmCap(state))} / ${farmCap(state)} at the Farm · the rest forage berries`
    :has(state,'farm')?'The Farm is damaged · they forage berry bushes':'No Farm yet · they forage berry bushes';
  if(j==='build')return repairing(state).length?`Repairing the ${repairing(state).map(t=>BP[t].name).join(', ')}`:'Repair damaged buildings · gather when nothing needs it';
  if(j==='guard')return`+${CONFIG.guardPower} Defense each · keep watch instead of gathering`;
  return`Raid warning ${CONFIG.warnScoutMs/1000} s sooner each (up to ${CONFIG.warnScouts}) · see the next land`;}
// A Watchtower or a scout shows the next land through the mist.
const sees=s=>on(s,'watchtower')>0||s.jobs.scout>0;
const mmss=ms=>{const t=Math.ceil(ms/1000);return`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};
function ringCount(k){const n=[...world(state.origin).nodes.values()].filter(x=>x.land===k);return`You can see ${n.filter(x=>isWood(x.kind)).length} trees, ${n.filter(x=>x.kind==='stone').length} stone, ${n.filter(x=>x.kind==='ore').length} ore`;}
// The drawer's words: the one next goal, Defense (only what Haven really has) and Land.
function manageText(st,xc){
  const g=goal(state);view.goal.textContent=g?`Next: ${g}`:'';view.goal.hidden=!g;
  view.defenseText.textContent=threatText();
  const d=defense(state);
  view.defenseParts.textContent=`Defense ${d.total} = guards ${d.guards} (${state.jobs.guard} × ${CONFIG.guardPower}${hungry(state)&&state.jobs.guard?', halved while hungry':''}) + Watchtower ${d.tower} + palisade ${d.walls} (${d.walled} of ${d.edge} edge tiles).`;
  const l=state.last;view.lastRaid.hidden=!l;
  if(l)view.lastRaid.textContent=l.def>=l.th?`Last raid: ${RAID_NAME[l.k]} (Threat ${l.th}) were driven off by Defense ${l.def}. Nothing lost.`
    :`Last raid: ${RAID_NAME[l.k]} (Threat ${l.th}) beat Defense ${l.def}.${l.n?` They took ${l.n} ${RES_NAME[l.res]}.`:' They found nothing to take.'}${l.hit?` They damaged the ${BP[l.hit].name}.`:''}`;
  for(const t of DAMAGEABLE){const btn=view.repairs[t],broke=isBroken(state,t);btn.hidden=!broke;if(!broke)continue;const left=state.broken[t],u=canRepair(state,t);
    btn.querySelector('strong').textContent=`Repair the ${BP[t].name}`;
    btn.querySelector('small').textContent=left>0?`${left} work left · builders, or tap it yourself`:u.ok?'Damaged: it does nothing until repaired':`Damaged · need ${fmt(u.need)} more`;
    btn.querySelector('b').textContent=left>0?'Paid':fmt(repairCost(state,t));btn.disabled=left>0;btn.setAttribute('aria-label',`Repair the ${BP[t].name}. ${btn.querySelector('small').textContent}.`);}
  const wallsOpen=st.level>=CONFIG.roadsAt;
  view.walls.querySelector('strong').textContent=`Palisade · ${d.walled} / ${d.edge} edge tiles`;
  view.walls.querySelector('small').textContent=wallsOpen?`+${d.walls} Defense now, +${CONFIG.wallMax} for the whole edge · people walk through its gates`:`Opens at Settlement Lv ${CONFIG.roadsAt}`;
  view.walls.querySelector('b').textContent=wallsOpen?`${fmt(CONFIG.wallCost)} each`:'Locked';view.walls.disabled=!wallsOpen||!afford(state,CONFIG.wallCost);
  view.walls.setAttribute('aria-label',`${view.walls.querySelector('strong').textContent}. ${view.walls.querySelector('small').textContent}.`);
  const wl=lvOf(state,'watchtower');
  view.watchText.textContent=wl?`Watchtower · Lv ${wl} (${STAGES[wl-1]})${isBroken(state,'watchtower')?', damaged':''}: ${BP.watchtower.effects[wl-1]}.`:'No Watchtower yet. Build one (Build → Town) for +2 Defense and to see the next land through the mist.';
  const [lo,hi]=land(state),size=`${hi-lo}×${hi-lo}`;
  view.landText.textContent=`Territory ${state.land+1} of ${CONFIG.lands.length} · ${size} tiles.`+(xc?(sees(state)?` ${ringCount(state.land+1)} in the next land.`:''):' Haven is at its full size for now.');
  alertLine();}
// The Defense section's first line: when raids start, or the one coming, from the real clock and numbers.
function threatText(){
  if(!raidsOpen(state)){const miss=[!has(state,'house')&&'a House',!has(state,'farm')&&'a Farm',state.land<1&&'its first expansion'].filter(Boolean);
    return`No raids yet. They start once Haven has ${miss.join(', ').replace(/, ([^,]*)$/,' and $1')}, and then only after ${CONFIG.graceMs/60000} minutes of play. Wolves and bandits will come now and then, always with a warning.`;}
  const k=nextKind(state),o=raidOutcome(state,k),tg=o.hit?` and damage the ${BP[o.hit].name}`:'';
  const result=o.won?'They would be driven off.':`They would get through, take ${o.n?`${o.n} ${RES_NAME[o.res]}`:'nothing much'}${tg}.`;
  if(state.raid)return`${RAID_NAME[k]} are attacking now! Threat ${o.th} against your Defense ${o.def}. ${result}`;
  if(state.calm<=warnLead(state))return`Raid coming in ${mmss(state.calm)} of play: ${RAID_NAME[k]}, Threat ${o.th}, your Defense ${o.def}. ${result}`;
  return`Quiet for now. The next raid is spotted ${warnLead(state)/1000} s before it comes${state.jobs.scout?' (scouts help)':''}. ${state.last?'':'Raiders grow bolder as Haven grows.'}`;}
// One line above the map, only when something needs you: a raid, then running out of Food.
function alertLine(){if(!view)return;let t='',kind='';
  if(view.open&&view.tab==='defense'){const d=threatText();if(view.defenseText.textContent!==d)view.defenseText.textContent=d;}
  if(raidsOpen(state)||state.raid){const k=nextKind(state),o=raidOutcome(state,k);
    if(state.raid){t=`${RAID_NAME[k]} are attacking! Threat ${o.th} · your Defense ${o.def}.`;kind='raid';}
    else if(state.calm<=warnLead(state)){t=`Raid coming in ${mmss(state.calm)}: ${RAID_NAME[k]} · Threat ${o.th} · your Defense ${o.def}.`;kind='raid';}}
  if(!t&&hungry(state)){t='Out of Food: work is slower and no one joins. Forage berry bushes or farm.';kind='food';}
  if(!t&&state.workers){const fr=foodRate(state);if(fr.grow<fr.eat&&state.food<fr.eat*2){t=`Food is running low: ${state.food} left, ${fr.eat} eaten a minute.`;kind='food';}}
  if(t===view.alertText)return;view.alertText=t;view.alert.textContent=t;view.alert.hidden=!t;view.alert.dataset.kind=kind;}
let workText='';
function workLine(){
  if(!view)return;const n=state.workers;let t='';
  if(n){const working=crew.filter(w=>w.phase==='work').length,walking=crew.filter(w=>w.phase==='walk').length,stuck=crew.filter(w=>w.stuck).length;
    t=n===1?(working?'Your worker is working':walking?'Your worker is walking to a job':'Your worker is resting'):`${n} workers · ${walking} walking · ${working} working`;
    if(stuck===n)t='Workers can’t reach what’s left. Work it yourself.';}
  if(t!==workText){workText=t;view.workText.textContent=t;}view.workText.hidden=!t;
}
function priceButton(btn,c,title,detail){const short=c!==null&&!afford(state,c);btn.querySelector('strong').textContent=title;
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
  if(view.placing||view.roading||view.walling)return{tile};
  // Front objects first; a tap on a canopy, rock or roof counts for it.
  // Raiders first (they're rare and worth knowing about), then trees, deposits and buildings, then people.
  for(const p of raiderSpots(performance.now())){const [cx,cy]=iso(g,p.c+.5,p.r+.5);if(Math.abs(x-cx)<=10&&y<=cy+4&&y>=cy-20)return{raider:p};}
  const objs=[...standingIds(state).map(id=>({node:id,id})),...state.built.map(b=>({building:b,id:wid(b.c,b.r)}))].sort((p,q)=>depth(q.id)-depth(p.id));
  for(const o of objs){const [cx,cy]=iso(g,o.id%W+.5,Math.floor(o.id/W)+.5);if(Math.abs(x-cx)<=g.w*.4&&y<=cy+g.h*.5&&y>=cy-g.w*1.3)return o;}
  if(state.workers>0)for(const w of crew){const [wc,wr]=crewPosition(w,!reduced(),state),[cx,cy]=iso(g,wc+.5,wr+.5);if(Math.abs(x-cx)<=8&&y<=cy+3&&y>=cy-18)return{person:w};}
  return tile===undefined?null:{tile};
}
function poly(ctx,pts,fill){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function diamond(ctx,g,c,r,fill,edge){const a=iso(g,c,r),b=iso(g,c+1,r),d=iso(g,c+1,r+1),e=iso(g,c,r+1);poly(ctx,[a,b,d,e],fill);if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}}
// A rectangle of ground from (c0,r0) to (c1,r1) in tile units, drawn flat.
function patch(ctx,g,c0,r0,c1,r1,fill){poly(ctx,[iso(g,c0,r0),iso(g,c1,r0),iso(g,c1,r1),iso(g,c0,r1)],fill);}
// A box standing on the ground at (x,y), half-width hw (px along x), height ht. Top, left and right faces.
function box(ctx,x,y,hw,ht,top,left,right){const hh=hw/2;poly(ctx,[[x-hw,y],[x,y+hh],[x,y+hh-ht],[x-hw,y-ht]],left);poly(ctx,[[x+hw,y],[x,y+hh],[x,y+hh-ht],[x+hw,y-ht]],right);poly(ctx,[[x,y-hh-ht],[x+hw,y-ht],[x,y+hh-ht],[x-hw,y-ht]],top);}
const C={grass:['#2f5a3a','#36643f','#2b5236'],edge:'#1f3c29',dirtL:'#3b2d22',dirtR:'#2a2019',stone:'#7d7a6d',stoneHi:'#a7a08a',stoneLo:'#55544b',faint:'#4a5a48',moss:'#3d6b48',trunk:'#5a3d26',pine:['#163d2b','#1f5238','#2c6b48'],oak:['#1d4a2f','#2a6340','#3f8455'],bush:['#2a5c37','#3b7a4a'],brass:'#d6bd81',roof:'#6e3f2e',roofHi:'#8b5440',wood:'#7a5534',woodHi:'#9a7048',lantern:'#f3c46a',ore:['#3a3540','#4d4654','#2a2630'],vein:'#e09a46',veinHi:'#8fd6c9',mist:'#0d1d22',plot:'rgba(248,220,136,.22)',plotEdge:'#f8dc88',road:'#6f5c40',roadHi:'#86714f',roadEdge:'#4d3f2c'};
/* Upgrade stages change the look in place: Lv 1 is Haven 2.0's makeshift look (unchanged); Lv 2 is timber on a timber
 * deck with a brass pennant; Lv 3 is dressed stone with a slate roof and corner stones. */
const STAGE_LOOK=[null,
  {plinth:[C.stoneHi,C.stone,C.stoneLo],ph:.08,roof:C.roof,roofHi:C.roofHi,wood:C.wood,woodHi:C.woodHi,woodLo:'#5c4128',wall:'#8a7a62'},
  {plinth:[C.woodHi,C.wood,'#5c4128'],ph:.1,roof:'#7c4527',roofHi:'#a35d34',wood:'#8a5f38',woodHi:'#b08050',woodLo:'#674529',wall:'#a99272'},
  {plinth:['#bdb6a0','#8d887a','#5f5c52'],ph:.15,roof:'#3d4a58',roofHi:'#566a7c',wood:'#8d887a',woodHi:'#bdb6a0',woodLo:'#5f5c52',wall:'#a7a08a'}];

function draw(now){
  if(!view?.geo)return;const g=view.geo,ctx=view.canvas.getContext('2d');if(!ctx)return;now=now||performance.now();
  ctx.setTransform(g.dpr,0,0,g.dpr,0,0);ctx.clearRect(0,0,g.cssW,g.cssH);
  const wd=world(state.origin),gone=goneSet(state),[lo,hi]=land(state),smooth=!reduced(),roads=new Set(state.roads);
  anims=anims.filter(a=>now-a.t0<a.life);
  const landAnim=anims.find(a=>a.type==='land'),grow=landAnim?(now-landAnim.t0)/landAnim.life:1,[plo,phi]=state.land?CONFIG.lands[state.land-1]:[lo,hi];
  // Earth slab under the territory
  const L=iso(g,lo,hi),B=iso(g,hi,hi),R=iso(g,hi,lo),dep=Math.round(g.w*.3);
  poly(ctx,[L,B,[B[0],B[1]+dep],[L[0],L[1]+dep]],C.dirtL);poly(ctx,[B,R,[R[0],R[1]+dep],[B[0],B[1]+dep]],C.dirtR);
  // Ground: territory (with roads), then the ring of mist around it
  for(let r=g.a;r<g.a+g.V;r++)for(let c=g.a;c<g.a+g.V;c++){const id=wid(c,r),sh=wd.shade(id);
    if(inLand(state,c,r)){
      if(wd.rubble.has(id))diamond(ctx,g,c,r,C.faint,C.stoneLo);
      else if(buildingAt(state,id))diamond(ctx,g,c,r,'#4a4334',C.stoneLo);
      else diamond(ctx,g,c,r,C.grass[Math.floor(sh*3)],C.edge);
      if(roads.has(id))roadTile(ctx,g,c,r,roads,sh);
      if(landAnim&&(c<plo||r<plo||c>=phi||r>=phi)){ctx.globalAlpha=Math.max(0,1-grow);diamond(ctx,g,c,r,C.mist);ctx.globalAlpha=1;}}
    else{ctx.globalAlpha=.85;diamond(ctx,g,c,r,C.mist,'#16302f');ctx.globalAlpha=1;}}
  // Lit tiles while placing a building or laying road
  if(view.placing||view.roading||view.walling)for(const id of view.sites){diamond(ctx,g,id%W,Math.floor(id/W),id===view.site?'rgba(248,220,136,.45)':C.plot,C.plotEdge);}
  // Objects back to front
  const objs=[],shaking=new Map(anims.filter(a=>a.type==='shake').map(a=>[a.id,a])),falling=anims.filter(a=>a.type==='fall'),watch=sees(state),walls=new Set(state.walls);
  for(const n of wd.nodes.values()){const id=n.id,sh=wd.shade(id);
    if(n.land>state.land){if(watch&&n.land===state.land+1&&n.c>=g.a&&n.r>=g.a&&n.c<g.a+g.V&&n.r<g.a+g.V)objs.push([n.c+n.r,()=>{ctx.globalAlpha=.55;node(ctx,g,n,sh,0);ctx.globalAlpha=1;}]);continue;}
    if(!gone.has(id)){const s=shaking.get(id),dx=s&&smooth?Math.round(Math.sin((now-s.t0)/s.life*Math.PI*4)*2):0;objs.push([n.c+n.r,()=>node(ctx,g,n,sh,dx)]);}
    else if(!buildingAt(state,id)&&!roads.has(id)&&!walls.has(id))objs.push([n.c+n.r-.1,()=>remains(ctx,g,n)]);}
  for(const id of walls){const c=id%W,r=Math.floor(id/W);objs.push([c+r+.01,()=>palisade(ctx,g,c,r,walls)]);}
  for(const f of falling){const n=wd.nodes.get(f.id);if(n)objs.push([n.c+n.r,()=>fallingTree(ctx,g,n.c,n.r,n.kind,wd.shade(n.id),(now-f.t0)/f.life,f.dir)]);}
  for(const id of wd.rubble){const c=id%W,r=Math.floor(id/W);objs.push([c+r,()=>rubble(ctx,g,c,r,wd.shade(id))]);}
  const raise=anims.find(a=>a.type==='raise'),banner=settlement(state).level>=20;
  for(const b of state.built)objs.push([b.c+b.r+.02,()=>{if(raise&&raise.t===b.t)raising(ctx,g,b,(now-raise.t0)/raise.life,banner);else building(ctx,g,b.t,b.c,b.r,b.lv,banner);
    if(isBroken(state,b.t))damaged(ctx,g,b.c,b.r,state.broken[b.t],now,smooth);}]);
  if(view.placing&&view.site!==null){const c=view.site%W,r=Math.floor(view.site/W);objs.push([c+r+.03,()=>{ctx.globalAlpha=.6;building(ctx,g,view.placing,c,r,1);ctx.globalAlpha=1;}]);}
  // Mist silhouettes of the forest beyond (skipping tiles a Watchtower already shows)
  for(let r=g.a;r<g.a+g.V;r++)for(let c=g.a;c<g.a+g.V;c++){if(inLand(state,c,r))continue;const id=wid(c,r),sh=wd.shade(id),n=wd.nodes.get(id);if(watch&&n&&n.land===state.land+1)continue;
    if(sh<.55)objs.push([c+r,()=>{ctx.globalAlpha=.32;tree(ctx,g,c,r,sh<.3?'pine':'oak',sh);ctx.globalAlpha=1;}]);}
  if(state.workers>0)for(const w of crew){const [wc,wr]=crewPosition(w,smooth,state);objs.push([wc+wr+.05,()=>worker(ctx,g,w,wc,wr,now,smooth)]);}
  for(const p of raiderSpots(now))objs.push([p.c+p.r+.06,()=>raider(ctx,g,p,now,smooth)]);
  objs.sort((a,b)=>a[0]-b[0]).forEach(o=>o[1]());
  // Selected building outline
  if(view.upgrading){const b=state.built.find(x=>x.t===view.upgrading);if(b){diamond(ctx,g,b.c,b.r,'rgba(248,220,136,.12)',C.plotEdge);}}
  // Work bars over nodes that have been started
  for(const [k,left] of Object.entries(state.hp)){const n=wd.nodes.get(Number(k));if(!n)continue;const max=CONFIG.kinds[n.kind].hp,[x,y]=iso(g,n.c+.5,n.r+.5),bw=Math.round(g.w*.6),bx=Math.round(x-bw/2),by=Math.round(y-g.w*(n.kind==='stone'||n.kind==='ore'||n.kind==='bush'?.62:1.35));
    ctx.fillStyle='#000c';ctx.fillRect(bx-1,by-1,bw+2,6);ctx.fillStyle='#3a2f20';ctx.fillRect(bx,by,bw,4);ctx.fillStyle=Number(k)===view.selected?'#ffe8af':C.brass;ctx.fillRect(bx,by,Math.max(1,Math.round(bw*left/max)),4);
    // Your swing: a thin line under the bar that fills until you can hit again.
    const sw=anims.find(a=>a.type==='swing'&&a.id===Number(k));if(sw){ctx.fillStyle='#000c';ctx.fillRect(bx-1,by+5,bw+2,3);ctx.fillStyle='#9fd8c0';ctx.fillRect(bx,by+6,Math.max(1,Math.round(bw*Math.min(1,(now-sw.t0)/sw.life))),1);}}
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
  if(res.regrown!==null&&res.regrown!==undefined)regrown(res.regrown,now+400);}
// Something grew back: show it, and start the play-time count-down again so two don't come back close together.
function regrown(id,t0){regrowClock.left=CONFIG.regrowMs;anims.push({type:'pop',c:id%W,r:Math.floor(id/W),text:'Regrown',worker:true,t0,life:1100});}

/* Roads join up by themselves: a square of packed earth in the middle of the tile and a strip towards every
 * neighbouring road or building, so straight runs, bends and crossings all come out right. */
function roadTile(ctx,g,c,r,roads,v){const joins=id=>roads.has(id)||!!buildingAt(state,id);
  patch(ctx,g,c+.28,r+.28,c+.72,r+.72,C.road);
  if(c+1<W&&joins(wid(c+1,r)))patch(ctx,g,c+.5,r+.28,c+1,r+.72,C.road);if(c>0&&joins(wid(c-1,r)))patch(ctx,g,c,r+.28,c+.5,r+.72,C.road);
  if(r+1<W&&joins(wid(c,r+1)))patch(ctx,g,c+.28,r+.5,c+.72,r+1,C.road);if(r>0&&joins(wid(c,r-1)))patch(ctx,g,c+.28,r,c+.72,r+.5,C.road);
  const [x,y]=iso(g,c+.5,r+.5);ctx.fillStyle=C.roadHi;ctx.fillRect(Math.round(x-g.w*.12+v*4),Math.round(y-1),2,2);ctx.fillRect(Math.round(x+g.w*.08-v*3),Math.round(y+2),2,2);ctx.fillStyle=C.roadEdge;ctx.fillRect(Math.round(x-2+v*6),Math.round(y-g.h*.2),2,1);}
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
/* A small person in the colours of their job (LOOK, below): lantern-yellow cap on Auto, green woodcutter, grey stone
 * miner, orange ore miner, straw-hatted farmer with a hoe, yellow-capped builder with a hammer, helmeted guard with a
 * spear and shield, hooded scout with a bow. */
function worker(ctx,g,w,wc,wr,now,smooth){
  const [x0,y0]=iso(g,wc+.5,wr+.5),phase=w.phase;let face=w.face;
  if(phase==='walk'&&w.steps.length){const [nc,nr]=w.steps[0],dx=(nc-w.c)-(nr-w.r);if(dx)face=w.face=dx>0?1:-1;}
  else if(phase==='work'&&w.node!==null){const dx=(w.node%W-w.c)-(Math.floor(w.node/W)-w.r);if(dx)face=w.face=dx>0?1:-1;}
  const bob=smooth&&phase==='walk'?Math.round(Math.abs(Math.sin(w.t/CONFIG.stepMs*Math.PI))*-2):0,x=Math.round(x0),y=Math.round(y0)+bob;
  ctx.globalAlpha=inLand(state,Math.round(wc),Math.round(wr))?1:.75;
  ctx.fillStyle='#0006';ctx.fillRect(x-5,Math.round(y0)-1,10,3);
  const role=roleOf(state,w.k),L=LOOK[role];
  ctx.fillStyle=L.tunic;ctx.fillRect(x-3,y-11,6,9);ctx.fillStyle='#e0b98d';ctx.fillRect(x-2,y-15,5,4);
  // Each job has its own hat or hood, so you can tell them apart at a glance.
  ctx.fillStyle=L.cap;
  if(role==='farm'){ctx.fillRect(x-5,y-16,10,1);ctx.fillRect(x-3,y-18,6,2);}
  else if(role==='guard'){ctx.fillRect(x-3,y-18,6,4);ctx.fillStyle='#7a2b2b';ctx.fillRect(x,y-20,1,2);ctx.fillStyle='#8d887a';ctx.fillRect(x-4+(face>0?6:0),y-10,2,6);}
  else if(role==='scout'){ctx.fillRect(x-3,y-17,6,3);ctx.fillRect(x-3,y-15,1,4);ctx.fillRect(x+2,y-15,1,4);}
  else ctx.fillRect(x-3,y-17,6,2);
  if(role==='guard'){// a spear held upright, and no gathering
    ctx.fillStyle=C.wood;ctx.fillRect(x+face*5,y-22,1,20);ctx.fillStyle='#e0e4e8';ctx.fillRect(x+face*5-1,y-24,3,2);ctx.globalAlpha=1;return;}
  if(role==='scout'&&w.task==='post'){ctx.fillStyle=C.wood;ctx.fillRect(x+face*5,y-17,1,12);ctx.fillRect(x+face*6,y-18,1,2);ctx.fillRect(x+face*6,y-6,1,2);ctx.fillStyle='#c9b98a';ctx.fillRect(x+face*4,y-16,1,10);ctx.globalAlpha=1;return;}
  const n=w.task==='node'&&w.node!==null?world(state.origin).nodes.get(w.node):null,pick=n&&!isWood(n.kind),tool=w.task==='farm'?'hoe':w.task==='repair'?'hammer':pick?'pick':'axe';
  const swing=phase==='work'?(smooth?Math.sin(w.t/CONFIG.workerHitMs*Math.PI*2):((Math.floor(w.t/350)%2)?1:-1)):-.6;
  ctx.save();ctx.translate(x+face*3,y-10);ctx.rotate(face*(.9-swing*.9));ctx.fillStyle=C.wood;ctx.fillRect(-1,-9,2,9);ctx.fillStyle='#c9ced1';
  if(tool==='pick')ctx.fillRect(-4,-10,8,2);else if(tool==='hoe')ctx.fillRect(face>0?0:-3,-10,4,2);else if(tool==='hammer'){ctx.fillStyle='#8d887a';ctx.fillRect(-3,-11,6,3);}else ctx.fillRect(face>0?0:-4,-10,4,4);ctx.restore();
  ctx.globalAlpha=1;
}
const LOOK={auto:{tunic:'#2d5f6e',cap:C.lantern},wood:{tunic:'#3d5a2e',cap:'#7fc27a'},stone:{tunic:'#4f5049',cap:'#c9c3ad'},ore:{tunic:'#4a3a52',cap:C.vein},
  farm:{tunic:'#6b5a2a',cap:'#d8c070'},build:{tunic:'#7a4a22',cap:'#e8c040'},guard:{tunic:'#3a4a6a',cap:'#b8bcc4'},scout:{tunic:'#2f4a34',cap:'#4f7a44'}};
/* Placeholder buildings, drawn in code (no final sprites yet). Each fills its tile and stands about a tile tall; the
 * Town Hall and Watchtower stand taller as they grow. */
function gable(ctx,x,t,hw,rise,K){poly(ctx,[[x-hw,t],[x,t+hw/2],[x,t-rise]],K.roof);poly(ctx,[[x+hw,t],[x,t+hw/2],[x,t-rise]],K.roofHi);}
function building(ctx,g,type,c,r,lv=1,banner=false){
  const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0),w=g.w,K=STAGE_LOOK[lv]||STAGE_LOOK[1],R=n=>Math.round(n);
  if(type==='farm'){farmPlot(ctx,g,c,r,lv);return;}
  box(ctx,x,y,w*.44,w*K.ph,...K.plinth);const base=y-R(w*K.ph);
  if(type==='house'){if(lv===3){for(const sx of [-1,1])box(ctx,R(x+sx*w*.38),R(y-w*.02),w*.05,w*.2,'#cfc8b0','#8d887a','#5f5c52');}house(ctx,x,base,w,lv,K);
    if(lv>=2){ctx.fillStyle=K.woodLo;ctx.fillRect(R(x-w*.4),R(base-w*.62),2,R(w*.62));ctx.fillStyle=C.brass;ctx.fillRect(R(x-w*.4)+2,R(base-w*.62),R(w*.14),R(w*.08));}return;}
  if(lv===3){for(const sx of [-1,1])box(ctx,R(x+sx*w*.38),R(y-w*.02),w*.05,w*.2,'#cfc8b0','#8d887a','#5f5c52');}
  if(type==='workshop'){box(ctx,x,base,w*.36,w*.36,K.wall,K.wood,K.woodLo);const t=base-w*.36;gable(ctx,x,t,w*.42,w*.38,K);
    box(ctx,R(x+w*.18),R(t-w*.04),w*.06,w*.26,C.stoneHi,C.stone,C.stoneLo);ctx.fillStyle='#1c140e';ctx.fillRect(R(x+w*.1),R(base-w*.02),R(w*.14),R(-w*.22));ctx.fillStyle=C.lantern;ctx.fillRect(R(x-w*.2),R(base-w*.22),3,3);
    ctx.fillStyle='#3b3b40';ctx.fillRect(R(x-w*.36),R(y-w*.12),R(w*.14),R(w*.06));}
  else if(type==='lumber'){const t=base-w*.4;poly(ctx,[[x-w*.34,base-w*.02],[x-w*.06,t],[x-w*.02,base+w*.05]],K.wood);poly(ctx,[[x+w*.2,base-w*.08],[x-w*.06,t],[x-w*.02,base+w*.05]],K.woodLo);
    for(let k=0;k<(lv>1?4:3);k++){const ly=R(base+w*.06-k*w*.09),lx=R(x+w*.08+(k===2?w*.05:0));ctx.fillStyle=C.trunk;ctx.fillRect(lx,ly-R(w*.08),R(w*.28-(k===2?w*.1:0)),R(w*.08));ctx.fillStyle='#c09a68';ctx.fillRect(lx,ly-R(w*.08),R(w*.06),R(w*.08));}
    ctx.fillStyle='#c9ced1';ctx.fillRect(R(x-w*.3),R(base-w*.14),4,3);ctx.fillStyle=K.wood;ctx.fillRect(R(x-w*.29),R(base-w*.11),2,R(w*.12));}
  else if(type==='stoneyard'){box(ctx,R(x-w*.16),base,w*.14,w*.14,C.stoneHi,C.stone,C.stoneLo);box(ctx,R(x+w*.02),base+3,w*.14,w*.14,C.stoneHi,C.stone,C.stoneLo);box(ctx,R(x-w*.07),R(base-w*.14),w*.12,w*.12,'#b8b19a',C.stone,C.stoneLo);
    ctx.fillStyle=K.wood;ctx.fillRect(R(x+w*.24),R(base-w*.9),3,R(w*.92));ctx.fillRect(R(x-w*.04),R(base-w*.9),R(w*.31),3);ctx.fillStyle='#c9b98a';ctx.fillRect(R(x),R(base-w*.88),1,R(w*.5));
    box(ctx,R(x),R(base-w*.32),w*.06,w*.06,C.stoneHi,C.stone,C.stoneLo);}
  else if(type==='survey'){// a lookout with a platform and a brass pennant
    const th=w*1.05,legs=[[-.22,0],[.22,0],[0,.11],[0,-.11]];ctx.fillStyle=K.wood;for(const [lx,ly] of legs)ctx.fillRect(R(x+lx*w)-1,R(base+ly*w-th),3,R(th));
    ctx.fillStyle=K.woodHi;ctx.fillRect(R(x-w*.22),R(base-th*.45),R(w*.44),2);
    box(ctx,x,R(base-th),w*.3,w*.06,K.woodHi,K.wood,K.woodLo);ctx.fillStyle=K.wood;ctx.fillRect(x-1,R(base-th-w*.5),2,R(w*.45));ctx.fillStyle=C.brass;ctx.fillRect(x+1,R(base-th-w*.5),R(w*.2),R(w*.1));ctx.fillStyle=C.lantern;ctx.fillRect(R(x-w*.18),R(base-th-w*.12),3,3);}
  else if(type==='sawmill'){// an open shed with a round saw and a log on the bench
    box(ctx,R(x-w*.08),base,w*.26,w*.3,K.wall,K.wood,K.woodLo);gable(ctx,R(x-w*.08),base-w*.3,w*.3,w*.26,K);
    ctx.fillStyle=C.trunk;ctx.fillRect(R(x+w*.06),R(base-w*.1),R(w*.34),R(w*.08));ctx.fillStyle='#c09a68';ctx.fillRect(R(x+w*.34),R(base-w*.1),R(w*.06),R(w*.08));
    ctx.beginPath();ctx.arc(R(x+w*.24),R(base-w*.16),Math.max(3,w*.11),0,Math.PI*2);ctx.fillStyle='#c9ced1';ctx.fill();ctx.fillStyle='#55544b';ctx.fillRect(R(x+w*.24)-1,R(base-w*.16)-1,3,3);}
  else if(type==='quarry'){// stepped ledges of cut stone under a hoist
    box(ctx,R(x-w*.06),base,w*.32,w*.08,C.stone,C.stoneLo,'#43423a');box(ctx,R(x-w*.12),R(base-w*.08),w*.22,w*.08,C.stoneHi,C.stone,C.stoneLo);box(ctx,R(x-w*.18),R(base-w*.16),w*.12,w*.08,'#b8b19a',C.stone,C.stoneLo);
    ctx.fillStyle=K.wood;ctx.fillRect(R(x+w*.26),R(base-w*.8),3,R(w*.8));ctx.fillRect(R(x+w*.02),R(base-w*.8),R(w*.27),3);ctx.fillStyle='#c9b98a';ctx.fillRect(R(x+w*.06),R(base-w*.78),1,R(w*.4));
    box(ctx,R(x+w*.06),R(base-w*.34),w*.06,w*.06,C.stoneHi,C.stone,C.stoneLo);if(lv>1)box(ctx,R(x+w*.2),R(base+w*.04),w*.08,w*.08,C.stoneHi,C.stone,C.stoneLo);}
  else if(type==='foundry'){// a squat forge house with a chimney and an orange glow
    box(ctx,x,base,w*.34,w*.3,K.wall,lv===1?C.stone:K.wood,lv===1?C.stoneLo:K.woodLo);gable(ctx,x,base-w*.3,w*.38,w*.2,K);
    box(ctx,R(x+w*.16),R(base-w*.3),w*.07,w*.42,'#6a6a5e','#575649','#43423a');ctx.fillStyle='#f08a3a';ctx.fillRect(R(x-w*.22),R(base-w*.2),R(w*.12),R(w*.1));ctx.fillStyle='#ffd27a';ctx.fillRect(R(x-w*.19),R(base-w*.17),R(w*.05),R(w*.05));
    ctx.fillStyle='#8c8c8c88';ctx.fillRect(R(x+w*.14),R(base-w*.86),3,3);ctx.fillRect(R(x+w*.19),R(base-w*.96),2,2);}
  else if(type==='yard'){// plank stacks and a tall builder's crane with a block on its rope
    for(let k=0;k<3;k++){ctx.fillStyle=k%2?K.woodHi:K.wood;ctx.fillRect(R(x-w*.32),R(base-w*.05-k*w*.06),R(w*.3),R(w*.05));}
    box(ctx,R(x+w*.14),base,w*.1,w*.1,C.stoneHi,C.stone,C.stoneLo);
    ctx.fillStyle=K.woodLo;ctx.fillRect(R(x-w*.02),R(base-w*1.15),3,R(w*1.15));ctx.fillRect(R(x-w*.02),R(base-w*1.15),R(w*.4),3);ctx.fillStyle='#c9b98a';ctx.fillRect(R(x+w*.32),R(base-w*1.12),1,R(w*.5));
    box(ctx,R(x+w*.32),R(base-w*.58),w*.05,w*.06,C.stoneHi,C.stone,C.stoneLo);ctx.fillStyle=C.brass;ctx.fillRect(R(x-w*.02)-1,R(base-w*1.2),5,3);}
  else if(type==='warehouse'){// a long store with a wide door and crates outside
    box(ctx,x,base,w*.42,w*.28,K.wall,K.wood,K.woodLo);gable(ctx,x,base-w*.28,w*.46,w*.22,K);
    ctx.fillStyle='#1c140e';ctx.fillRect(R(x+w*.06),R(base),R(w*.2),R(-w*.2));ctx.fillStyle=K.woodHi;ctx.fillRect(R(x+w*.06),R(base-w*.2),R(w*.2),2);
    box(ctx,R(x-w*.24),R(base+w*.04),w*.07,w*.08,'#b08050','#8a5f38','#674529');if(lv>1)box(ctx,R(x-w*.12),R(base+w*.1),w*.07,w*.08,'#b08050','#8a5f38','#674529');}
  else if(type==='townhall'){// grows from a longhouse to a timber hall with a bell tower to a stone hall with towers
    const hw=w*[0,.36,.4,.44][lv],ht=w*[0,.3,.4,.5][lv];box(ctx,x,base,hw,ht,K.wall,K.wood,K.woodLo);const t=base-ht;gable(ctx,x,t,hw+w*.04,w*[0,.3,.36,.42][lv],K);
    ctx.fillStyle='#1c140e';ctx.fillRect(R(x+w*.08),R(base),R(w*.12),R(-w*.18));ctx.fillStyle=C.lantern;ctx.fillRect(R(x-w*.22),R(base-ht*.6),3,3);ctx.fillRect(R(x+w*.26),R(base-ht*.6),3,3);
    let top=t-w*[0,.3,.36,.42][lv];
    if(lv>=2){box(ctx,x,R(t-w*.12),w*.1,w*.26,K.wall,K.wood,K.woodLo);gable(ctx,x,R(t-w*.38),w*.13,w*.16,K);ctx.fillStyle=C.brass;ctx.fillRect(x-1,R(t-w*.3),3,3);top=t-w*.54;}
    if(lv===3){for(const sx of [-1,1]){const tx=R(x+sx*w*.36);box(ctx,tx,R(base+w*.02),w*.08,ht+w*.18,'#cfc8b0','#8d887a','#5f5c52');ctx.fillStyle='#cfc8b0';ctx.fillRect(tx-R(w*.08),R(base+w*.02-ht-w*.24),3,3);ctx.fillRect(tx+R(w*.05),R(base+w*.02-ht-w*.24),3,3);}}
    if(banner){ctx.fillStyle=K.woodLo;ctx.fillRect(x,R(top-w*.4),2,R(w*.42));ctx.fillStyle='#7a2b2b';ctx.fillRect(x+2,R(top-w*.4),R(w*.2),R(w*.16));ctx.fillStyle=C.brass;ctx.fillRect(x+2,R(top-w*.25),R(w*.2),2);}}
  else{// watchtower: taller and sturdier with each stage, with a lantern at the top
    const th=w*[0,.95,1.15,1.35][lv],tw=w*[0,.13,.16,.19][lv];
    if(lv===1){ctx.fillStyle=K.wood;for(const lx of [-.16,.16])ctx.fillRect(R(x+lx*w)-1,R(base-th),3,R(th));ctx.fillStyle=K.woodHi;ctx.fillRect(R(x-w*.16),R(base-th*.5),R(w*.32),2);}
    else box(ctx,x,base,tw,th,K.wall,K.wood,K.woodLo);
    box(ctx,x,R(base-th),w*.24,w*.06,K.woodHi,K.wood,K.woodLo);
    if(lv===3){ctx.fillStyle='#cfc8b0';for(const dx of [-.2,-.06,.08])ctx.fillRect(R(x+dx*w),R(base-th-w*.12),R(w*.08),R(w*.08));}
    else gable(ctx,x,R(base-th-w*.06),w*.22,w*.24,K);
    ctx.fillStyle=C.lantern;ctx.fillRect(x-1,R(base-th-w*.04),3,3);}
  if(lv>=2&&type!=='townhall'){ctx.fillStyle=K.woodLo;ctx.fillRect(R(x-w*.4),R(base-w*.62),2,R(w*.62));ctx.fillStyle=C.brass;ctx.fillRect(R(x-w*.4)+2,R(base-w*.62),R(w*.14),R(w*.08));}
}
/* ---------- Haven 3.5 pictures: all drawn in code from whole-pixel blocks, in Haven's existing small palette ---------- */
// The Farm: a tilled plot with rows of crops that sprout, grow and turn gold as the crop comes in, and a scarecrow.
function farmPlot(ctx,g,c,r,lv){const w=g.w,R=Math.round,k=state?state.crop/CONFIG.cropHp:0,dead=state&&isBroken(state,'farm');
  patch(ctx,g,c+.08,r+.08,c+.92,r+.92,'#4a3524');patch(ctx,g,c+.14,r+.14,c+.86,r+.86,'#5c4330');
  for(const rr of [.3,.5,.7]){patch(ctx,g,c+.16,r+rr-.03,c+.84,r+rr+.03,'#3b2a1d');
    for(const cc of [.24,.4,.56,.72]){const [x,y]=iso(g,c+cc,r+rr),X=R(x),Y=R(y);
      if(dead){ctx.fillStyle='#4d3a26';ctx.fillRect(X-1,Y-1,3,1);continue;}
      if(k<.34){ctx.fillStyle='#5fa04e';ctx.fillRect(X,Y-2,1,2);}
      else if(k<.67){ctx.fillStyle='#3f8455';ctx.fillRect(X-1,Y-4,1,4);ctx.fillStyle='#6fb85a';ctx.fillRect(X,Y-5,1,5);}
      else{ctx.fillStyle='#8a9a3a';ctx.fillRect(X,Y-5,1,5);ctx.fillStyle='#e8c860';ctx.fillRect(X-1,Y-7,3,2);}}}
  const [sx,sy]=iso(g,c+.8,r+.22),X=R(sx),Y=R(sy);ctx.fillStyle=C.trunk;ctx.fillRect(X,Y-R(w*.5),2,R(w*.5));ctx.fillRect(X-4,Y-R(w*.38),10,2);
  ctx.fillStyle='#8a5a3a';ctx.fillRect(X-2,Y-R(w*.4),6,R(w*.16));ctx.fillStyle='#d8c070';ctx.fillRect(X-3,Y-R(w*.5)-3,8,2);ctx.fillRect(X-1,Y-R(w*.5)-5,4,2);
  if(lv>=2){ctx.fillStyle=lv===3?C.stoneHi:C.woodHi;for(const [a,b] of [[.06,.06],[.94,.06],[.06,.94],[.94,.94],[.5,.06],[.06,.5]]){const [px,py]=iso(g,c+a,r+b);ctx.fillRect(R(px)-1,R(py)-5,2,5);}}
  if(lv===3){const [wx,wy]=iso(g,c+.22,r+.8);ctx.fillStyle='#3d4a58';ctx.fillRect(R(wx)-4,R(wy)-6,8,6);ctx.fillStyle='#566a7c';ctx.fillRect(R(wx)-4,R(wy)-6,8,2);}}
// The House: a cottage with a door, a lit window and a chimney; timber adds a second window, stone a second floor.
function house(ctx,x,base,w,lv,K){const R=Math.round,hw=w*[0,.3,.34,.36][lv],ht=w*[0,.26,.3,.46][lv];
  box(ctx,x,base,hw,ht,K.wall,K.wood,K.woodLo);const t=base-ht;gable(ctx,x,t,hw+w*.05,w*[0,.3,.32,.34][lv],K);
  ctx.fillStyle='#1c140e';ctx.fillRect(R(x+w*.1),R(base),R(w*.1),R(-w*.17));ctx.fillStyle=C.lantern;ctx.fillRect(R(x-w*.2),R(base-ht*.6),3,3);
  if(lv>=2)ctx.fillRect(R(x+w*.24),R(base-ht*.62),3,3);if(lv===3){ctx.fillRect(R(x-w*.2),R(base-ht*.9),3,3);ctx.fillRect(R(x+w*.24),R(base-ht*.92),3,3);}
  const cx=R(x-w*.14),ch=w*[0,.22,.26,.3][lv];box(ctx,cx,R(t-w*.08),w*.05,ch,lv===3?'#bdb6a0':C.stoneHi,lv===3?'#8d887a':C.stone,C.stoneLo);
  ctx.fillStyle='#8c8c8c88';ctx.fillRect(cx-1,R(t-w*.08-ch-6),3,3);ctx.fillRect(cx+2,R(t-w*.08-ch-11),2,2);}
// Palisade: a row of sharpened stakes bound with a rope, along the outside of the edge tile it stands on.
function palisade(ctx,g,c,r,walls){const [lo,hi]=land(state),runs=[];
  if(r===lo)runs.push([[c,r],[c+1,r]]);if(r===hi-1)runs.push([[c,r+1],[c+1,r+1]]);if(c===lo)runs.push([[c,r],[c,r+1]]);if(c===hi-1)runs.push([[c+1,r],[c+1,r+1]]);
  if(!runs.length)runs.push([[c,r+.5],[c+1,r+.5]]);// an older ring's palisade, left inside after expanding
  const h=Math.max(6,Math.round(g.w*.3));
  for(const [[c0,r0],[c1,r1]] of runs){for(let i=0;i<5;i++){const f=.1+i*.2,[x,y]=iso(g,c0+(c1-c0)*f,r0+(r1-r0)*f),X=Math.round(x),Y=Math.round(y);
      ctx.fillStyle='#0005';ctx.fillRect(X-1,Y,4,2);ctx.fillStyle=C.wood;ctx.fillRect(X-1,Y-h,3,h);ctx.fillStyle=C.woodHi;ctx.fillRect(X-1,Y-h,1,h);ctx.fillStyle='#5c4128';ctx.fillRect(X,Y-h-2,1,2);}
    const [ax,ay]=iso(g,c0+(c1-c0)*.1,r0+(r1-r0)*.1),[bx,by]=iso(g,c0+(c1-c0)*.9,r0+(r1-r0)*.9),n=Math.max(1,Math.round(Math.abs(bx-ax)/2));ctx.fillStyle='#c9b98a';
    for(let j=0;j<=n;j++)ctx.fillRect(Math.round(ax+(bx-ax)*j/n),Math.round(ay+(by-ay)*j/n-h*.6),2,1);}}
// A damaged building: soot and broken planks, smoke, and a red sign until the repair is paid; then a repair bar.
function damaged(ctx,g,c,r,left,now,smooth){const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0),w=g.w,R=Math.round;
  ctx.globalAlpha=.4;diamond(ctx,g,c,r,'#120c08');ctx.globalAlpha=1;
  ctx.fillStyle='#2a1d14';ctx.fillRect(R(x-w*.3),R(y-w*.06),R(w*.22),2);ctx.fillRect(R(x+w*.06),R(y+w*.02),R(w*.18),2);ctx.fillRect(R(x-w*.08),R(y-w*.2),2,R(w*.12));
  for(let j=0;j<3;j++){const t=smooth?((now/900+j/3)%1):j/3;ctx.globalAlpha=.55*(1-t);ctx.fillStyle='#8c8c8c';const s=2+Math.round(t*3);ctx.fillRect(R(x-w*.1+j*w*.1+t*4),R(y-w*.7-t*w*.5),s,s);}ctx.globalAlpha=1;
  if(left>0){const bw=R(w*.6),bx=R(x-bw/2),by=R(y-w*1.2);ctx.fillStyle='#000c';ctx.fillRect(bx-1,by-1,bw+2,6);ctx.fillStyle='#3a2f20';ctx.fillRect(bx,by,bw,4);
    ctx.fillStyle='#9fd8c0';ctx.fillRect(bx,by,Math.max(1,R(bw*(1-left/CONFIG.repairWork))),4);return;}
  const sx=R(x+w*.28),sy=R(y-w*1.05);ctx.fillStyle='#000a';ctx.fillRect(sx-1,sy-1,9,11);ctx.fillStyle='#b8322e';ctx.fillRect(sx,sy,7,9);ctx.fillStyle='#ffe8af';ctx.fillRect(sx+3,sy+2,1,4);ctx.fillRect(sx+3,sy+7,1,1);}
// Raiders come in from one side of Haven (taking turns round the four sides) towards what they're after.
function raidFrom(side){const [lo,hi]=land(state),m=Math.floor((lo+hi)/2);return side===0?[m,lo-1]:side===1?[hi,m]:side===2?[m,hi]:[lo-1,m];}
const raidHome=()=>[...world(state.origin).rubble][0];
function raiderSpots(now){const out=[];if(!state)return out;
  const walk=(kind,[fc,fr],[tc,tr],k,back)=>{const n=kind==='beast'?2:3;for(let i=0;i<n;i++){const kk=Math.max(0,Math.min(1,k-i*.06)),dc=tc-fc,dr=tr-fr,len=Math.hypot(dc,dr)||1,off=(i-(n-1)/2)*.45;
      out.push({kind,c:fc+dc*kk*.92-dr/len*off,r:fr+dr*kk*.92+dc/len*off,face:((dc-dr)>=0?1:-1)*(back?-1:1),i});}};
  if(state.raid){const to=raidTarget(state,state.raid),id=to?tileOf(state,to):raidHome();walk(state.raid,raidFrom(state.raids%4),[id%W,Math.floor(id/W)],Math.min(1,raidClock.walk/CONFIG.raidWalkMs),false);}
  for(const a of anims)if(a.type==='flee'&&now>=a.t0){const k=(now-a.t0)/a.life;if(k<1)walk(a.kind,a.to,a.from,k,true);}
  return out;}
function raider(ctx,g,p,now,smooth){const [x0,y0]=iso(g,p.c+.5,p.r+.5),x=Math.round(x0),f=p.face,step=smooth?Math.floor(now/140+p.i)%2:0,y=Math.round(y0)-step;
  ctx.fillStyle='#0006';ctx.fillRect(x-6,Math.round(y0)-1,12,3);
  if(p.kind==='beast'){// a grey wolf with red eyes, legs taking turns
    ctx.fillStyle='#3a3a42';ctx.fillRect(x-6,y-8,11,5);ctx.fillStyle='#55555f';ctx.fillRect(x-5,y-9,9,2);
    ctx.fillStyle='#3a3a42';ctx.fillRect(f>0?x+4:x-9,y-11,5,5);ctx.fillRect(f>0?x+5:x-8,y-13,1,2);ctx.fillRect(f>0?x+7:x-6,y-13,1,2);
    ctx.fillStyle='#ff4a3a';ctx.fillRect(f>0?x+7:x-8,y-10,1,1);ctx.fillStyle='#55555f';ctx.fillRect(f>0?x-9:x+5,y-9,4,2);
    ctx.fillStyle='#2a2a30';for(const [lx,on] of [[-5,0],[-2,1],[1,0],[3,1]])ctx.fillRect(x+lx*f,y-3+(on===step?0:-1),2,3+(on===step?0:-1));return;}
  // a hooded bandit with a red sash and a knife
  ctx.fillStyle='#2a2222';ctx.fillRect(x-3,y-11,7,9);ctx.fillStyle='#7a2b2b';ctx.fillRect(x-3,y-7,7,2);
  ctx.fillStyle='#4a2626';ctx.fillRect(x-3,y-17,7,6);ctx.fillRect(x-2,y-18,5,1);ctx.fillStyle='#120c0c';ctx.fillRect(x-1,y-15,4,3);ctx.fillStyle='#f3c46a';ctx.fillRect(f>0?x+1:x,y-14,1,1);
  ctx.fillStyle='#2a2222';ctx.fillRect(x-2,y-2,2,2+step);ctx.fillRect(x+1,y-2,2,3-step);
  ctx.fillStyle='#d0d4d8';ctx.fillRect(f>0?x+5:x-6,y-10,1,4);ctx.fillStyle=C.trunk;ctx.fillRect(f>0?x+5:x-6,y-6,1,2);}
function scaffold(ctx,g,c,r){const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0),w=g.w;box(ctx,x,y,w*.44,w*.06,C.stone,C.stoneLo,'#43423a');ctx.fillStyle=C.woodHi;
  for(const dx of [-.34,-.1,.12,.34])ctx.fillRect(Math.round(x+dx*w)-1,Math.round(y-w*.8),2,Math.round(w*.8));for(const h of [.3,.6])ctx.fillRect(Math.round(x-w*.36),Math.round(y-w*h),Math.round(w*.72),2);}
function raising(ctx,g,b,k,banner){if(k<.4){scaffold(ctx,g,b.c,b.r);return;}const e=easeOut((k-.4)/.6),[x,y]=iso(g,b.c+.5,b.r+.5),w=g.w,top=y-w*1.9,bottom=y+w*.4;
  ctx.save();ctx.beginPath();ctx.rect(x-w,bottom-(bottom-top)*e,w*2,(bottom-top)*e+2);ctx.clip();building(ctx,g,b.t,b.c,b.r,b.lv,banner);ctx.restore();ctx.globalAlpha=1-e;scaffold(ctx,g,b.c,b.r);ctx.globalAlpha=1;
  ctx.fillStyle='#b9ad8f';for(let j=0;j<5;j++){ctx.globalAlpha=(1-e)*.8;ctx.fillRect(Math.round(x+(j-2)*w*.2),Math.round(y+w*.1-e*w*.3-(j%2)*3),3,3);}ctx.globalAlpha=1;}

/* Haven, the first tab, opens Ruins Reclaimed directly every time (navigation.js). There is no other view and no way
 * through to the retired Hall. page() draws it into the destination; leave() stops it, keeping its progress. */
let shell=null;
function page(host){if(!host)return;if(!shell){shell=document.createElement('div');shell.className='ruins-shell';shell.innerHTML='<div class="ruins-slot"></div>';}
  if(shell.parentNode!==host)host.replaceChildren(shell);mount(shell.firstElementChild);}
function leave(){unmount();}
root.LoreRuinsReclaimed.page=page;root.LoreRuinsReclaimed.leave=leave;
})(globalThis);
