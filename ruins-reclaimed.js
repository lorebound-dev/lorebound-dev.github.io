/* Ruins Reclaimed: a test-site-only settlement prototype, shown by the Haven tab.
 * Haven 2.0: gather Wood, Stone and Ore from trees and deposits that take several hits, place buildings on the same
 * map, and grow that one map outwards.
 * Haven 3.0 adds seven more buildings, three upgrade stages for every building (makeshift, timber, stone), roads,
 * worker jobs and a Settlement Level worked out from what has been built.
 * Everything here is original code. The 2:1 isometric math is the standard textbook projection, worker paths use a plain
 * breadth-first search and the easing is two standard curves. Nothing is copied from mykonos-island-voxels, EasyStar.js,
 * Tween.js or clicker-engine (see docs/RUINS-RECLAIMED-PROTOTYPE.md).
 * Haven 3.5 adds people: Food, a House and a Farm, seven jobs (woodcutter, stone miner, ore miner, farmer, builder,
 * guard, scout), raids by wolves and bandits that can be seen walking in, a palisade, and repairs.
 * Haven 4 (#144, #145) turns the land into patches: a raised home clearing in the middle, and twelve 4×4 patches of
 * wild land round it, each cleared on the map for its own price, with its own mix of trees, stone and ore in clusters.
 * It never reads or writes the LOREBOUND save. Its own data lives in localStorage key lorebound-haven-settlement-v6,
 * and only on the test site or a local copy. Haven 4 is a fresh start (Noah's OK, 2026-11-09): the Haven 3.5 save in
 * lorebound-haven-settlement-v5 (and the older v4, v2 and first-prototype keys) is never read, changed or deleted, so
 * it stays exactly as it was, as a backup.
 * Gathering follows PR #91's retune (f306e3c): nodes hold twice the work, hits by hand are paced at one per 0.48 s,
 * workers swing every 1.75 s for twice the work, and regrowth comes every 3rd node or 20 s of play.
 * Eating, raids and farming only move on while Haven is open and on screen: nothing happens while you're away.
 * All numbers in CONFIG, FX and BLUEPRINTS are trial values for play-testing, not approved balance. */
(function(root){'use strict';

const KEY='lorebound-haven-settlement-v6',V5_KEY='lorebound-haven-settlement-v5',BAD_KEY=KEY+'-unreadable';
// Keys of earlier Havens. Only looked at to say that an earlier town is kept; never read into the game, changed or deleted.
const OLD_KEYS=Object.freeze([V5_KEY,'lorebound-haven-settlement-v4','lorebound-haven-settlement-v2','lorebound-ruins-prototype-v01']);
// Work: your hit at the starting hit power of 1 does 4 work. Since Haven 2.0's retune a node holds twice the work it
// did at first, so it takes twice your hits; a worker's swing was doubled with it, so workers take as many swings.
const CONFIG=Object.freeze({
  version:6,
  world:16,
  home:[4,12],            // the raised home clearing: the middle 8×8 (tiles 4 to 11 both ways)
  patch:4,                // the rest of the map is twelve 4×4 patches of wild land, cleared one at a time
  // Clearing a patch (trial numbers): 8 Wood and 4 Stone for the first, then 4 Wood and 2 Stone more for each patch
  // already cleared. Never Ore, so a patch never waits on something only found in land not yet cleared.
  clearCost:{wood:8,stone:4},clearStep:{wood:4,stone:2},clearMs:800,
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
  // What grows where (#145, a trial layout): small clusters, never the middle of the home clearing. The home clearing
  // has 15 trees and bushes and 7 stone round its edge; each patch has 7 nodes (old rings had about 5.7 for 16 tiles,
  // so this is about 23% more). Woods: 6 trees and bushes and 1 stone. Stony ground: 3 stone, 2 ore and 2 trees.
  // Wild corners: 4 trees, 1 stone and 2 ore.
  homeNodes:{pine:6,oak:5,bush:4,stone:7},
  patchNodes:{wood:[['wood',4],['wood',2],['stone',1]],stone:[['stone',3],['ore',2],['wood',2]],wild:[['wood',4],['ore',2],['stone',1]]},
  regrowEvery:3,          // every 3rd node you finish lets the oldest felled tree or mined deposit grow back
  regrowMs:20000,         // and so does every 20 s of play with Haven open, if nothing has grown back in that time
  maxLevel:3,             // building stages: 1 makeshift, 2 timber, 3 stone
  upgradeScale:[0,1,2.5,5],
  specialist:1.5,         // a worker on its own job (wood, stone or ore) does 1½× work there
  roadCost:{stone:1},roadMax:80,roadsAt:2,
  // Settlement Level: worked out again from what stands in Haven every time, never stored, so nothing can be counted twice.
  points:{level:10,townHall:2,land:5,road:2,roadCount:20,tool:3,worker:4}, // land: 5 for each cleared patch (60 for all 12)
  townHallNeeds:[0,0,8,14],  // Settlement Level needed to raise the Town Hall to Lv 2 and Lv 3
  // Haven 3.5, people and Food (trial numbers).
  workerFlat:7,workerLate:1.15, // recruit costs grow 1.8× each up to the 8th person (as in 3.0), then 1.15× each
  recruitFood:3,recruitFoodStep:2, // and Food: 3, then 2 more for each person already in Haven
  startFood:10,           // a new Haven starts with 1 settler and 10 Food
  eatMs:60000,            // each person eats 1 Food a minute of play with Haven open
  hungry:.5,              // with no Food, everyone but farmers works at half power, and no one can be recruited
  farmPower:4,cropHp:60,  // a farmer adds 4 to the crop per swing; 60 makes a harvest (15 swings, about 26 s)
  // Raids (trial numbers): only once Haven has a House, a Farm and its first cleared patch, and only during play.
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
    effects:['Lets you clear more land round Haven','Lets you clear more land; clearing costs 10% less','Lets you clear more land; clearing costs 20% less']},
  {id:'sawmill',name:'Sawmill',group:'town',cost:{wood:30,stone:12},needs:{built:['lumber']},
    effects:['+1 Wood from every tree or bush felled','+2 Wood from every tree or bush felled','+3 Wood from every tree or bush felled']},
  {id:'quarry',name:'Quarry',group:'town',cost:{wood:26,stone:22},needs:{built:['stoneyard']},
    effects:['Stone miners do 2× work on stone (1½× without it)','Stone miners do 2½× work on stone','Stone miners do 3× work on stone']},
  {id:'yard',name:'Builder’s Yard',group:'town',cost:{wood:34,stone:22},needs:{built:['workshop','survey']},
    effects:['New buildings and upgrades cost 5% less','New buildings and upgrades cost 10% less','New buildings and upgrades cost 15% less']},
  {id:'townhall',name:'Town Hall',group:'town',cost:{wood:60,stone:40},needs:{built:['workshop','lumber','stoneyard','survey']},
    effects:['The heart of Haven. Other buildings stay at Lv 1 until it grows','Other buildings can be upgraded to Lv 2 (timber)','Other buildings can be upgraded to Lv 3 (stone)']},
  {id:'watchtower',name:'Watchtower',group:'town',cost:{wood:30,stone:26},needs:{built:['survey']},
    effects:['Shows what grows in far land through the mist; regrowth keeps 3 nodes standing; +2 Defense','Regrowth keeps 5 trees or deposits standing; +4 Defense','Regrowth keeps 7 trees or deposits standing; +6 Defense']},
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
const JOB_SHORT={wood:'woodcutting',stone:'on stone',ore:'on ore',farm:'farming',build:'building',guard:'guarding',scout:'scouting'};
const JOB_KIND={wood:'pine',stone:'stone',ore:'ore'};
const GATHER=new Set(['auto','wood','stone','ore','farm','build']); // jobs that work trees and deposits (farmers forage berry bushes)
const RAID_NAME={beast:'Wolves',bandit:'Bandits'};
/* Haven Management: four in-game windows, one open at a time. "jobs" is People. Defense shows raids, guards, the
 * palisade and repairs; Land is a short overview of the land, with Find Next Clearing. */
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

/* ---------- The land (#144, #145) ----------
 * One 16×16 grid with fixed tile numbers. The middle 8×8 is the home clearing, drawn raised above the rest: a hearth in
 * the middle (it can't be built on or walked through), a short worn footpath out to its edge, an open middle to build
 * on, and clusters of trees, bushes and stone round its edge. The rest of the map is cut into twelve 4×4 patches of
 * wild land, each with its own fixed mix of nodes in small clusters, towards its outer side. A patch is cleared once,
 * for its price, when it shares a whole side with land Haven has: then it's Haven's land like the home clearing, and its
 * nodes can be worked. Clearing pays nothing: the brush that goes is only a picture, and every node stays. */
const [HLO,HHI]=CONFIG.home,P4=CONFIG.patch,NB=W/P4;
const HEARTH=wid(7,7),FOOTPATH=Object.freeze([wid(7,8),wid(7,9),wid(7,10),wid(7,11)]);
const PATCH_NAME={wood:'Woods',stone:'Stony ground',wild:'Wild corner'};
// Each side of the home clearing has one wooded patch and one stony one; the corners are wild, with ore.
const PATCHES=(()=>{const kinds={0:'wild',1:'wood',2:'stone',3:'wild',4:'stone',7:'wood',8:'wood',11:'stone',12:'wild',13:'stone',14:'wood',15:'wild'},out=[];
  for(let b=0;b<NB*NB;b++){if(!(b in kinds))continue;const bx=b%NB,by=Math.floor(b/NB),c0=bx*P4,r0=by*P4,tiles=[];
    for(let r=r0;r<r0+P4;r++)for(let c=c0;c<c0+P4;c++)tiles.push(wid(c,r));
    out.push(Object.freeze({id:out.length+1,bx,by,c0,r0,kind:kinds[b],name:PATCH_NAME[kinds[b]],tiles:Object.freeze(tiles)}));}
  return Object.freeze(out);})();
const PATCH=Object.fromEntries(PATCHES.map(p=>[p.id,p]));
const ZONE=new Array(W*W).fill(0);for(const p of PATCHES)for(const id of p.tiles)ZONE[id]=p.id;
const zoneAt=(c,r)=>c>=0&&r>=0&&c<W&&r<W?ZONE[wid(c,r)]:-1;
// Which patches share a side (zone 0 is the home clearing).
const ZADJ=(()=>{const a=Array.from({length:PATCHES.length+1},()=>new Set());
  for(let r=0;r<W;r++)for(let c=0;c<W;c++){const z=ZONE[wid(c,r)];for(const [dc,dr] of [[1,0],[0,1]]){const n=zoneAt(c+dc,r+dr);if(n>=0&&n!==z){a[z].add(n);a[n].add(z);}}}
  return Object.freeze(a.map(s=>Object.freeze([...s].sort((x,y)=>x-y))));})();

/* Haven's land for a list of cleared patches: its tiles, its edge (tiles with a side on wild land or the map's end),
 * and near, the one-tile ring of forest edge just outside it (on or just off the map), which people can always walk. */
const code=(c,r)=>(r+1)*(W+2)+c+1;
const lands=new Map();
function landOf(list){const key=[...list].sort((a,b)=>a-b).join(',');if(lands.has(key))return lands.get(key);
  const zones=new Set([0,...list]),tiles=new Set(),ids=[];for(let id=0;id<W*W;id++)if(zones.has(ZONE[id])){tiles.add(id);ids.push(id);}
  const has=(c,r)=>c>=0&&r>=0&&c<W&&r<W&&tiles.has(wid(c,r)),near=new Set(),nearList=[];
  for(let r=-1;r<=W;r++)for(let c=-1;c<=W;c++){if(has(c,r))continue;let by=false;
    for(let dr=-1;dr<=1&&!by;dr++)for(let dc=-1;dc<=1;dc++)if(has(c+dc,r+dr)){by=true;break;}
    if(by){near.add(code(c,r));nearList.push([c,r]);}}
  const edge=ids.filter(id=>{const c=id%W,r=Math.floor(id/W);return !has(c+1,r)||!has(c-1,r)||!has(c,r+1)||!has(c,r-1);});
  // The edge walked round once, clockwise as you look at it from the top corner of the map, for the palisade.
  const ang=id=>{const a=Math.atan2(Math.floor(id/W)-7.5,id%W-7.5)+Math.PI*.75;return a<0?a+Math.PI*2:a;};
  const ring=[...edge].sort((a,b)=>ang(a)-ang(b)||a-b);
  const v=Object.freeze({zones,tiles,ids,near,nearList,edge,edgeSet:new Set(edge),ring});lands.set(key,v);return v;}
const owns=new WeakMap();
function own(s){const z=s.zones,o=owns.get(z);if(o&&o.n===z.length)return o.v;const v=landOf(z);owns.set(z,{n:z.length,v});return v;}

// Small clusters: each group starts from one of the best-placed free tiles and takes the free tiles nearest to it.
function clusters(cells,groups,rand,score){const free=new Set(cells),out=[];
  for(const [kind,n] of groups){const left=[...free].map(id=>[score(id),id]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]).map(x=>x[1]);if(!left.length)break;
    const seed=left[Math.floor(rand()*Math.max(1,Math.ceil(left.length/3)))],sc=seed%W,sr=Math.floor(seed/W);
    const near=left.map(id=>[Math.hypot(id%W-sc,Math.floor(id/W)-sr)+rand()*.9,id]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    for(const [,id] of near.slice(0,n)){free.delete(id);out.push([id,kind]);}}
  return out;}
const worlds=new Map();
function world(origin){
  if(worlds.has(origin))return worlds.get(origin);
  const rubble=new Set([HEARTH]),path=new Set(FOOTPATH);let nodes=null;
  for(let attempt=0;attempt<60&&!nodes;attempt++){
    const rand=seeded(origin*131+attempt*7919+11),list=new Map();
    const put=(id,kind,zone)=>list.set(id,Object.freeze({id,c:id%W,r:Math.floor(id/W),kind,zone}));
    // The home clearing: only its two outer rows of tiles, never the footpath.
    const ringOf=id=>{const c=id%W,r=Math.floor(id/W);return Math.min(c-HLO,r-HLO,HHI-1-c,HHI-1-r);};
    const band=[];for(let r=HLO;r<HHI;r++)for(let c=HLO;c<HHI;c++){const id=wid(c,r);if(ringOf(id)<=1&&!path.has(id))band.push(id);}
    const H=CONFIG.homeNodes,woods=shuffle([...Array(H.pine).fill('pine'),...Array(H.oak).fill('oak'),...Array(H.bush).fill('bush')],rand);
    const placed=clusters(band,[['wood',5],['stone',3],['wood',4],['stone',2],['wood',3],['stone',2],['wood',3]],rand,id=>1-ringOf(id)+rand()*.5);
    for(const [id,k] of placed)put(id,k==='wood'?woods.pop():k,0);
    // Each patch: its own mix, nearer its outer side, so the side facing Haven stays open.
    for(const p of PATCHES)for(const [id,k] of clusters(p.tiles,CONFIG.patchNodes[p.kind],rand,id=>Math.hypot(id%W-7.5,Math.floor(id/W)-7.5)+rand()*.6)){
      const v=rand();put(id,k==='wood'?(v<.4?'pine':v<.8?'oak':'bush'):k,p.id);}
    // Kept only if nobody can be walled in: with every patch cleared, every open tile can be walked to from outside;
    // and the home clearing alone, or with any one patch, has open ground to build on that can be reached.
    const b=new Set([...rubble,...list.keys()]),all=landOf(PATCHES.map(p=>p.id)),open=reach(null,b,all);
    let ok=all.ids.every(id=>b.has(id)||open.has(id));
    for(let z=0;ok&&z<=PATCHES.length;z++){const L=landOf(z?[z]:[]),o=reach(null,b,L),mine=L.ids.filter(id=>ZONE[id]===z&&o.has(id)).length;if(mine<(z?6:20))ok=false;}
    if(ok)nodes=list;}
  const shadeRand=seeded(77),shade=Array.from({length:(W+2)*(W+2)},()=>shadeRand());
  const w=Object.freeze({origin,nodes,rubble,path,shade:id=>shade[(Math.floor(id/W)+1)*(W+2)+id%W+1]??.5});worlds.set(origin,w);return w;
}
const inLand=(s,c,r)=>c>=0&&r>=0&&c<W&&r<W&&own(s).tiles.has(wid(c,r));
const goneSet=s=>new Set(s.gone);
function standingIds(s){const g=goneSet(s),z=own(s).zones,out=[];for(const n of world(s.origin).nodes.values())if(z.has(n.zone)&&!g.has(n.id))out.push(n.id);return out;}
function standing(s,id){const n=world(s.origin).nodes.get(id);return !!n&&own(s).zones.has(n.zone)&&!s.gone.includes(id);}
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

// A blank Haven 4 state. newGame() is what a player starting out gets: one settler and a little Food.
function fresh(origin=0){return{v:CONFIG.version,wood:0,stone:0,ore:0,food:0,tools:0,workers:0,origin,zones:[],tally:0,gone:[],hp:{},built:[],roads:[],jobs:emptyJobs(),
  crop:0,eat:0,raids:0,calm:CONFIG.graceMs,raid:'',broken:{},walls:[],last:null};}
function newGame(origin=0){const s=fresh(origin);s.workers=1;s.food=CONFIG.startFood;return s;}
const int=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const toolsCap=s=>CONFIG.toolsMax+FX.foundryTools[lvOf(s,'foundry')];
// Places for people: 5 to start, plus the Warehouse and the House. A damaged building never takes places away.
const workerCap=s=>CONFIG.workerMax+FX.warehouse[lvOf(s,'warehouse')]+FX.house[lvOf(s,'house')];

/* ---------- Stored data: strict check of Haven 4 (version 6). Returns a clean copy, or null for anything odd. ---------- */
// Cleared patches, in the order they were cleared: each one next to land Haven already had, none twice.
function checkZones(z){if(!Array.isArray(z)||z.length>PATCHES.length)return null;const have=new Set([0]);
  for(const id of z){if(!int(id,1,PATCHES.length)||have.has(id)||!ZADJ[id].some(n=>have.has(n)))return null;have.add(id);}return[...z];}
// Felled nodes, work left and buildings, all on Haven's own land.
function checkCore(o,zones,types,maxLv){
  const wd=world(o.origin),L=landOf(zones),seen=new Set();
  for(const id of o.gone){const n=wd.nodes.get(id);if(!int(id,0,W*W-1)||!n||!L.zones.has(n.zone)||seen.has(id))return null;seen.add(id);}
  const hp={};
  for(const [k,v] of Object.entries(o.hp)){if(!/^\d{1,3}$/.test(k))return null;const id=Number(k),n=wd.nodes.get(id);
    if(!n||!L.zones.has(n.zone)||seen.has(id)||!int(v,1,CONFIG.kinds[n.kind].hp-1))return null;hp[id]=v;}
  if(o.built.length>types.size)return null;
  const done=new Set(),tiles=new Set(),built=[];
  for(const b of o.built){
    if(!plain(b)||Object.keys(b).sort().join()!=='c,lv,r,t'||!types.has(b.t)||done.has(b.t)||!int(b.lv,1,maxLv)||!int(b.c,0,W-1)||!int(b.r,0,W-1))return null;
    const id=wid(b.c,b.r);if(!L.tiles.has(id)||tiles.has(id)||wd.rubble.has(id)||(wd.nodes.has(id)&&!seen.has(id)))return null;
    done.add(b.t);tiles.add(id);built.push({t:b.t,c:b.c,r:b.r,lv:b.lv});}
  return{gone:[...o.gone],hp,built,tiles,seen,wd,L};
}
const CALM_MAX=Math.max(CONFIG.graceMs,CONFIG.peaceWonMs,CONFIG.peaceLostMs);
const FIELDS='broken,built,calm,crop,eat,food,gone,hp,jobs,last,ore,origin,raid,raids,roads,stone,tally,tools,v,walls,wood,workers,zones';
function checkTiles(list,core,max){if(!Array.isArray(list)||list.length>max)return null;const out=new Set();
  for(const id of list){if(!int(id,0,W*W-1)||out.has(id))return null;
    if(!core.L.tiles.has(id)||core.tiles.has(id)||core.wd.rubble.has(id)||(core.wd.nodes.has(id)&&!core.seen.has(id)))return null;out.add(id);}return out;}
function validate(o){
  if(!plain(o)||Object.keys(o).sort().join()!==FIELDS)return null;
  if(o.v!==CONFIG.version||!int(o.wood,0,1e9)||!int(o.stone,0,1e9)||!int(o.ore,0,1e9)||!int(o.tools,0,CONFIG.toolsMax+6)||!int(o.workers,0,CONFIG.workerMax+9)
    ||!int(o.origin,0,9999)||!int(o.tally,0,1e9)||!Array.isArray(o.gone)||!plain(o.hp)||!Array.isArray(o.built)||!Array.isArray(o.roads)||!plain(o.jobs))return null;
  const zones=checkZones(o.zones);if(!zones)return null;
  const core=checkCore(o,zones,new Set(Object.keys(BP)),CONFIG.maxLevel);if(!core)return null;
  // A second patch can only be cleared with a Survey Post, and a building is never taken away.
  if(zones.length>=2&&!core.built.some(b=>b.t==='survey'))return null;
  if(o.tools>toolsCap(core)||o.workers>workerCap(core))return null;
  const roads=checkTiles(o.roads,core,CONFIG.roadMax);if(!roads)return null;
  if(Object.keys(o.jobs).sort().join()!==[...JOBS].sort().join()||!JOBS.every(k=>int(o.jobs[k],0,o.workers))||JOBS.reduce((a,k)=>a+o.jobs[k],0)>o.workers)return null;
  if(!int(o.food,0,1e9)||!int(o.crop,0,CONFIG.cropHp-1)||!int(o.eat,0,CONFIG.eatMs-1)||!int(o.raids,0,1e9)||!int(o.calm,0,CALM_MAX)
    ||(o.raid!==''&&!RAID_NAME[o.raid])||!plain(o.broken))return null;
  const walls=checkTiles(o.walls,core,CONFIG.wallMaxTiles);if(!walls)return null;
  for(const id of walls)if(roads.has(id))return null;
  const broken={};for(const [t,left] of Object.entries(o.broken)){if(!DAMAGEABLE.includes(t)||!core.built.some(b=>b.t===t)||!int(left,0,CONFIG.repairWork))return null;broken[t]=left;}
  let last=null;
  if(o.last!==null){const l=o.last;if(!plain(l)||Object.keys(l).sort().join()!=='def,hit,k,n,res,th'||!RAID_NAME[l.k]||!int(l.th,0,CONFIG.threatMax)||!int(l.def,0,1e6)
      ||(l.res!==''&&!RES.includes(l.res))||!int(l.n,0,1e9)||(l.hit!==''&&!DAMAGEABLE.includes(l.hit))||(l.res===''&&l.n!==0))return null;
    last={k:l.k,th:l.th,def:l.def,res:l.res,n:l.n,hit:l.hit};}
  return{v:o.v,wood:o.wood,stone:o.stone,ore:o.ore,food:o.food,tools:o.tools,workers:o.workers,origin:o.origin,zones,tally:o.tally,gone:core.gone,hp:core.hp,built:core.built,
    roads:[...o.roads],jobs:Object.fromEntries(JOBS.map(j=>[j,o.jobs[j]])),crop:o.crop,eat:o.eat,raids:o.raids,calm:o.calm,raid:o.raid,broken,walls:[...o.walls],last};
}
/* Picks the state to play from a store with get(key)/set(key,value). Never deletes anything: an unreadable Haven 4
 * save is copied to its own key before a new town replaces it. Haven 4 is a fresh start: an earlier Haven (3.5, 3.0,
 * 2.0 or the first prototype) is never read in, and its key is left exactly as it is, as a backup. */
function loadFrom(store){
  const raw=store.get(KEY);
  if(raw!==null&&raw!==undefined){let s=null;try{s=validate(JSON.parse(raw));}catch{}if(s)return{state:s,note:''};store.set(BAD_KEY,raw);return{state:newGame(),note:'unreadable'};}
  const old=OLD_KEYS.some(k=>{const v=store.get(k);return v!==null&&v!==undefined;});
  return{state:newGame(),note:old?'fresh':''};
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

/* Walking: on Haven's land only on open ground or roads (not standing nodes, buildings or the hearth), plus the
 * one-tile ring of forest edge just outside it, which is always open. Four straight directions only. */
function blocked(s){const wd=world(s.origin),b=new Set(wd.rubble);for(const id of standingIds(s))b.add(id);for(const x of s.built)b.add(wid(x.c,x.r));return b;}
function walkable(s,c,r,b=blocked(s),o=own(s)){if(c<-1||r<-1||c>W||r>W)return false;if(c>=0&&r>=0&&c<W&&r<W&&o.tiles.has(wid(c,r)))return !b.has(wid(c,r));return o.near.has(code(c,r));}
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]],AROUND=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
// The open tiles on Haven's land that can be walked to from the forest edge (from anywhere along it).
function reach(s,b=blocked(s),o=own(s)){
  const seen=new Set(),queue=[],inside=new Set();for(const [c,r] of o.nearList){seen.add(code(c,r));queue.push([c,r]);}
  for(let q=0;q<queue.length;q++){const [x,y]=queue[q];for(const [dx,dy] of DIRS){const nc=x+dx,nr=y+dy;if(!walkable(s,nc,nr,b,o))continue;const k=code(nc,nr);if(seen.has(k))continue;seen.add(k);queue.push([nc,nr]);if(nc>=0&&nr>=0&&nc<W&&nr<W&&o.tiles.has(wid(nc,nr)))inside.add(wid(nc,nr));}}
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
  if(n.land&&s.zones.length<n.land)return'Needs cleared land';return'';}
// The Builder's Yard takes a bounded share off new buildings and upgrades (5%, 10% or 15%, never below 1 of anything).
const discount=(s,c)=>scaled(c,1-FX.yard[on(s,'yard')]);
const buildCost=(s,type)=>discount(s,BP[type].cost);
/* Building: one of each blueprint, on one free tile of Haven's land: not on a standing tree or deposit, another
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
function validSites(s,type){if(!BP[type]||has(s,type)||lockReason(s,type))return[];const b=blocked(s),before=reach(s,b),out=[];
  for(const id of own(s).ids)if(canPlace(s,type,id%W,Math.floor(id/W),b,before).ok)out.push(id);return out;}
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

/* Roads: one tile each, on open ground on Haven's land (a felled tree's tile is fine). Never on a standing node,
 * a building, rubble or another road, so a tap on an existing road charges nothing. Workers walk on them faster. */
function canRoad(s,c,r){if(settlement(s).level<CONFIG.roadsAt)return{ok:false,reason:'locked'};if(s.roads.length>=CONFIG.roadMax)return{ok:false,reason:'max'};
  if(!int(c,0,W-1)||!int(r,0,W-1)||!inLand(s,c,r))return{ok:false,reason:'outside'};const id=wid(c,r);
  if(isRoad(s,id))return{ok:false,reason:'road'};if(isWall(s,id))return{ok:false,reason:'wall'};if(buildingAt(s,id))return{ok:false,reason:'building'};if(world(s.origin).rubble.has(id))return{ok:false,reason:'rubble'};if(standing(s,id))return{ok:false,reason:'node'};
  if(!afford(s,CONFIG.roadCost))return{ok:false,reason:'short',need:shortOf(s,CONFIG.roadCost)};return{ok:true};}
function layRoad(s,c,r){const p=canRoad(s,c,r);if(!p.ok)return p;pay(s,CONFIG.roadCost);s.roads.push(wid(c,r));return{ok:true,cost:CONFIG.roadCost};}
function roadSites(s){if(settlement(s).level<CONFIG.roadsAt||s.roads.length>=CONFIG.roadMax)return[];const wd=world(s.origin),out=[];
  for(const id of own(s).ids){if(!isRoad(s,id)&&!isWall(s,id)&&!buildingAt(s,id)&&!wd.rubble.has(id)&&!standing(s,id))out.push(id);}return out;}

/* Jobs: hired workers can be woodcutters, stone miners or ore miners; the rest are on Auto and work anything.
 * Changing jobs never pays anything or restarts a swing; a worker takes its new job when it picks its next target. */
function setJob(s,job,d){if(!JOBS.includes(job)||(d!==1&&d!==-1))return{ok:false,reason:'job'};const n=s.jobs[job]+d,sum=JOBS.reduce((a,k)=>a+s.jobs[k],0)+d;
  if(n<0)return{ok:false,reason:'none'};if(sum>s.workers)return{ok:false,reason:'full'};s.jobs[job]=n;return{ok:true};}
function roleOf(s,k){let n=0;for(const j of JOBS){n+=s.jobs[j];if(k<n)return j;}return'auto';}
// Every worker back on Auto in one go. Like setJob, it pays nothing and restarts no swing.
function allAuto(s){if(!JOBS.some(j=>s.jobs[j]>0))return{ok:false,reason:'none'};for(const j of JOBS)s.jobs[j]=0;return{ok:true};}
/* #141: tap a building to staff it. A building that matches a job adds or takes away one of that job through setJob, so
 * the saved job counts stay the only record and the People counters always agree. Only someone on Auto is assigned:
 * nobody is taken from another job, hired or charged, and − puts them back on Auto. The Farm takes up to its places
 * (2 / 3 / 4); other jobs have no places of their own, so only the number of people limits them. */
const STAFF=Object.freeze({farm:'farm',lumber:'wood',stoneyard:'stone',foundry:'ore',workshop:'build',watchtower:'guard',survey:'scout'});
const staffCap=(s,type)=>type==='farm'?FX.farmers[lvOf(s,'farm')]:null;
function staff(s,type,d){const job=STAFF[type];if(!job||!has(s,type)||(d!==1&&d!==-1))return{ok:false,reason:'job'};
  if(d===1){if(autoJobs(s)<1)return{ok:false,reason:'busy'};const cap=staffCap(s,type);if(cap!==null&&s.jobs[job]>=cap)return{ok:false,reason:'cap',cap};}
  const r=setJob(s,job,d);return r.ok?{ok:true,job,n:s.jobs[job]}:r;}

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
  const nz=nextClear(s),cz=nz===null?null:canClear(s,nz);
  if(cz&&cz.ok)return'You can clear more land: tap a Clear sign on the map, or Find Next Clearing (Land).';
  if(cz&&cz.reason==='survey')return lockReason(s,'survey')?'':'Build a Survey Post to clear more land.';
  if(!has(s,'townhall')&&!lockReason(s,'townhall'))return'Build the Town Hall so your buildings can grow.';
  if(has(s,'townhall')){const th=lvOf(s,'townhall');if(th<CONFIG.maxLevel&&th<maxLevel(s,'townhall'))return`Raise the Town Hall to Lv ${th+1} so your buildings can grow.`;}
  if(s.workers<workerCap(s)&&!hungry(s)&&afford(s,cost(s,'worker')))return'You can recruit another person (People).';
  return'';}

/* ---------- One suggestion at a time (#140) ----------
 * Haven names one useful, legal next step from what it has and needs right now, with its exact price. It never names
 * anything locked as something to buy now, never spends anything by itself and never changes a price or a rule: it
 * only picks which existing choice to show first. Worked out fresh every time; nothing is stored. */
const autoJobs=s=>s.workers-JOBS.reduce((a,k)=>a+s.jobs[k],0);
function pick(s,kind,o={}){const c=o.cost||null,ready=o.ready!==undefined?o.ready:!c||afford(s,c);
  return{kind,key:o.key||kind,type:o.type||'',job:o.job||'',zone:o.zone||0,cost:c,need:c&&!ready?shortOf(s,c):null,ready,name:o.name,why:o.why||'',verb:o.verb||'Build'};}
// Whether a building has anywhere to go: stops at the first tile that passes every placing rule.
function hasSite(s,type){const b=blocked(s);let before=null;
  for(const id of own(s).ids){const c=id%W,r=Math.floor(id/W);if(b.has(id)||isRoad(s,id)||isWall(s,id))continue;before=before||reach(s,b);if(canPlace(s,type,c,r,b,before).ok)return true;}return false;}
function buildPick(s,type){if(has(s,type)||lockReason(s,type)||!hasSite(s,type))return null;
  return pick(s,'build',{key:'build:'+type,type,cost:buildCost(s,type),name:BP[type].name,why:WHY_SHORT[type]||''});}
function upgradePick(s,type){const u=canUpgrade(s,type);if(!u.ok&&u.reason!=='short')return null;
  return pick(s,'upgrade',{key:'upgrade:'+type,type,cost:u.cost,name:`${BP[type].name} Lv ${u.to}`,why:WHY_SHORT[type]||'',verb:'Upgrade'});}
const WHY_SHORT={house:'Room for people',farm:'+Food',workshop:'Stronger hits',lumber:'Faster wood',stoneyard:'Faster stone',survey:'Lets Haven grow',
  sawmill:'More wood',quarry:'Faster stone',yard:'Cheaper building',townhall:'Buildings can grow',watchtower:'+Defense',warehouse:'Room for workers',foundry:'Better tools'};
function wallPick(s){if(settlement(s).level<CONFIG.roadsAt||autoWall(s)===null)return null;
  return pick(s,'wall',{cost:CONFIG.wallCost,name:'Add Palisade',why:'+Defense',verb:'Add'});}
function jobPick(s,job,why){if(autoJobs(s)<1)return null;return pick(s,'job',{key:'job:'+job,job,name:`One more ${JOB_ONE[job]}`,why,verb:'Assign'});}
// Defense first when a raid is close and Haven would lose it; a repair it can start; then what keeps raids off.
function defensePick(s,quiet=false){
  const fix=DAMAGEABLE.find(t=>isBroken(s,t)&&!(s.broken[t]>0));
  if(raidsOpen(s)&&(s.raid||s.calm<=warnLead(s))&&defense(s).total<threat(s,nextKind(s))){
    const p=jobPick(s,'guard','+'+CONFIG.guardPower+' Defense')||wallPick(s)||buildPick(s,'watchtower');if(p)return p;}
  if(fix)return pick(s,'repair',{key:'repair:'+fix,type:fix,cost:repairCost(s,fix),name:`Repair ${BP[fix].name}`,why:'Works again',verb:'Repair'});
  if(quiet)return null;
  if(raidsOpen(s)||has(s,'house')&&has(s,'farm')){const p=buildPick(s,'watchtower');if(p)return p;}
  return wallPick(s);}
function suggest(s){
  const d=defensePick(s,true);if(d)return d;
  const fr=foodRate(s),auto=autoJobs(s);
  if(s.workers&&(hungry(s)||(fr.grow<fr.eat&&s.food<fr.eat*2))){
    const p=buildPick(s,'farm')||(farmOpen(s)&&s.jobs.farm<farmCap(s)&&jobPick(s,'farm','+Food'));if(p)return p;
    return pick(s,'gather',{name:'Pick berries',why:'+Food',ready:false});}
  for(const t of ['house','farm']){const p=buildPick(s,t);if(p)return p;}
  const wc=cost(s,'worker');
  // A small town is told to grow its crew (up to 3 people) even before it can pay; after that, only when it can.
  if(wc&&!hungry(s)&&(afford(s,wc)||s.workers<3))return pick(s,'worker',{cost:wc,name:'Recruit',why:'+1 person',verb:'Recruit'});
  if(!wc&&lvOf(s,'house')){const p=upgradePick(s,'house');if(p)return p;}
  // The first patch of wild land comes once the House, the Farm and a small crew stand (#144: gently, after gathering
  // and building), then the rest of the foundations, then more land.
  if(!s.zones.length){const p=clearPick(s);if(p)return p;}
  for(const t of ['workshop','lumber','stoneyard','survey']){const p=buildPick(s,t);if(p)return p;}
  {const p=clearPick(s);if(p)return p;}
  for(const t of ['townhall','sawmill','quarry','yard','watchtower','warehouse','foundry']){const p=buildPick(s,t);if(p)return p;}
  if(has(s,'townhall')){const p=upgradePick(s,'townhall');if(p)return p;}
  // The cheapest upgrade Haven can do or is only short of materials for.
  const ups=s.built.map(b=>upgradePick(s,b.t)).filter(Boolean),sum=c=>RES.reduce((a,k)=>a+(c[k]||0),0);
  if(ups.length)return ups.sort((a,b)=>sum(a.cost)-sum(b.cost))[0];
  const tc=cost(s,'tools');if(tc)return pick(s,'tools',{cost:tc,name:`Better Tools Lv ${s.tools+1}`,why:'Stronger hits',verb:'Buy'});
  if(wc&&!hungry(s))return pick(s,'worker',{cost:wc,name:'Recruit',why:'+1 person',verb:'Recruit'});
  if(!s.built.length||auto)return pick(s,'gather',{name:'Gather',why:'Tap trees and rocks',ready:false});
  return null;}
/* Finding a resource (#145). When the suggestion is short of something, Find shows the nearest standing tree, bush,
 * stone or ore vein that gives it. Which one: of everything the price is short of, the one that takes the most hits by
 * hand to make up. Where: the closest to the middle of Haven, preferring one a worker can also walk up to. It only
 * looks: nothing is stored, paid or worked. */
const GIVES={wood:['pine','oak','bush'],stone:['stone'],ore:['ore'],food:['bush']};
function findWhat(s,need){let best=null,most=0;for(const k of RES){const n=need?.[k]||0;if(!n)continue;
    const per=Math.min(...GIVES[k].map(x=>CONFIG.kinds[x].hp/(yieldOf(s,x)[k]||Infinity))),work=n*per;if(work>most){most=work;best=k;}}return best;}
function nearestNode(s,res){const kinds=GIVES[res];if(!kinds)return null;const wd=world(s.origin),o=own(s),m=7.5,open=reach(s);
  let best=null,bs=Infinity;
  for(const id of standingIds(s)){const n=wd.nodes.get(id);if(!kinds.includes(n.kind))continue;
    const near=AROUND.some(([dx,dy])=>{const c=n.c+dx,r=n.r+dy;return inLand(s,c,r)?open.has(wid(c,r)):o.near.has(code(c,r));});
    const sc=(near?0:1000)+Math.abs(n.c-m)+Math.abs(n.r-m)+(res==='wood'&&n.kind==='bush'?3:0);if(sc<bs||(sc===bs&&id<best)){bs=sc;best=id;}}
  return best;}
/* Places chosen for the player. Palisade: the edge of Haven's land walked round in one fixed order from the top
 * corner, whatever its shape; the next tile is a free edge tile beside palisade already on the edge, so it grows as
 * one run, or else the first free edge tile. Buildings: a free tile that passes every placing rule. A Watchtower goes
 * one tile in from the edge (so the palisade can still go round it), other buildings as near the hearth as they fit.
 * Nothing already there moves. */
const perimeter=s=>[...own(s).ring];
function autoWall(s){const free=new Set(wallSites(s));if(!free.size)return null;const o=own(s),ring=o.ring;
  const by=id=>AROUND.some(([dc,dr])=>{const c=id%W+dc,r=Math.floor(id/W)+dr;return c>=0&&r>=0&&c<W&&r<W&&o.edgeSet.has(wid(c,r))&&isWall(s,wid(c,r));});
  return ring.find(id=>free.has(id)&&by(id))??ring.find(id=>free.has(id))??null;}
// How many tiles in from the edge of Haven's land a tile is (0 on the edge).
function inFrom(o,c,r){for(let k=0;k<W;k++){for(let dr=-k-1;dr<=k+1;dr++)for(let dc=-k-1;dc<=k+1;dc++){const x=c+dc,y=r+dr;if(!(x>=0&&y>=0&&x<W&&y<W&&o.tiles.has(wid(x,y))))return k;}}return W;}
function autoSite(s,type){const sites=validSites(s,type);if(!sites.length)return null;const o=own(s),m=7.5;
  const score=id=>{const c=id%W,r=Math.floor(id/W);if(type==='watchtower'){const e=inFrom(o,c,r);return Math.abs(e-1)*100+Math.abs(c-m)+r;}return Math.abs(c-m)+Math.abs(r-m);};
  return sites.map(id=>[score(id),id]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])[0][1];}
// Lays one palisade tile where autoWall() picks: the same price and rules as laying it by hand.
function addWall(s){const id=autoWall(s);if(id===null)return{ok:false,reason:wallSites(s).length?'none':'full'};const r=layWall(s,id%W,Math.floor(id/W));return r.ok?{...r,id}:r;}

// The Build window's one choice: the suggestion when it's something to build, else the first thing ready to build or
// upgrade, else the first one only short of materials.
function paneBuild(s,g=suggest(s)){if(g&&['build','upgrade','tools'].includes(g.kind))return g;
  const all=BLUEPRINTS.map(b=>has(s,b.id)?upgradePick(s,b.id):buildPick(s,b.id)).filter(Boolean);return all.find(p=>p.ready)||all[0]||null;}
// The People window's one choice: a job or a recruit, when that's the suggestion.
function panePeople(s,g=suggest(s)){return g&&(g.kind==='job'||g.kind==='worker')?g:null;}

/* ---------- Clearing land (#144) ----------
 * A patch of wild land is cleared once, for its price, on the map. Only a patch that shares a side with Haven's land can
 * be cleared, so Haven always stays one piece. The first needs nothing else; after that a Survey Post is needed (it also
 * takes 10% or 20% off). The price grows with each patch cleared and is only ever Wood and Stone, which the home
 * clearing always has (felled nodes grow back), so clearing can never get stuck. Clearing pays nothing and takes
 * nothing away: buildings, roads and everything standing stay where they are, and the patch's own trees, stone and ore
 * stay standing to be worked. */
function clearCost(s){if(s.zones.length>=PATCHES.length)return null;const n=s.zones.length,A=CONFIG.clearCost,B=CONFIG.clearStep;
  return scaled({wood:A.wood+B.wood*n,stone:A.stone+B.stone*n},1-FX.survey[lvOf(s,'survey')]);}
const touches=(s,z)=>ZADJ[z].some(n=>n===0||s.zones.includes(n));
function canClear(s,z){const p=PATCH[z];if(!p)return{ok:false,reason:'zone'};if(s.zones.includes(z))return{ok:false,reason:'owned'};
  if(!touches(s,z))return{ok:false,reason:'far'};const c=clearCost(s);
  if(s.zones.length&&!has(s,'survey'))return{ok:false,reason:'survey',cost:c};
  if(!afford(s,c))return{ok:false,reason:'short',cost:c,need:shortOf(s,c)};return{ok:true,cost:c};}
function clearZone(s,z){const e=canClear(s,z);if(!e.ok)return e;pay(s,e.cost);s.zones.push(z);return{...e,zone:z};}
// The one short reason a patch is locked, for its lock sign.
const LOCKED={far:'Clear the land next to it first.',survey:'Needs a Survey Post (Build).'};
// Patches that can be cleared now or are only short of Wood or Stone. The one to point at next: the kind that gives
// what Haven has least of (a wooded patch when Wood is shorter, a stony one when Stone is), wild corners last.
const openZones=s=>PATCHES.filter(p=>!s.zones.includes(p.id)&&touches(s,p.id)).map(p=>p.id);
function nextClear(s){const open=openZones(s);if(!open.length)return null;const want=s.stone*2<s.wood?'stone':'wood';
  const rank=z=>PATCH[z].kind===want?0:PATCH[z].kind==='wild'?2:1;return open.sort((a,b)=>rank(a)-rank(b)||a-b)[0];}
function clearPick(s){const z=nextClear(s);if(z===null)return null;const c=canClear(s,z);if(!c.ok&&c.reason!=='short')return null;
  return pick(s,'clear',{key:'clear',zone:z,cost:c.cost,name:'Clear land',why:PATCH[z].name,verb:'Clear'});}

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
const raidsOpen=s=>has(s,'house')&&has(s,'farm')&&s.zones.length>=1;
const raidKind=n=>n%2?'bandit':'beast';
const nextKind=s=>s.raid||raidKind(s.raids);
const threat=(s,kind)=>Math.min(CONFIG.threatMax,CONFIG.threat[kind]+Math.floor(settlement(s).level/2)+Math.min(5,Math.floor(s.raids/4)));
// The edge tiles of Haven's land (a side on wild land or the end of the map), where a palisade counts.
const edgeIds=s=>[...own(s).edge];
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

/* Palisade: one tile at a time on the edge of Haven's land, 2 Wood and 1 Stone each. Defense counts the share of
 * the edge it covers. People walk through its gates, so it never walls anyone in. */
function canWall(s,c,r){if(settlement(s).level<CONFIG.roadsAt)return{ok:false,reason:'locked'};if(s.walls.length>=CONFIG.wallMaxTiles)return{ok:false,reason:'max'};
  if(!int(c,0,W-1)||!int(r,0,W-1)||!inLand(s,c,r))return{ok:false,reason:'outside'};const id=wid(c,r);
  if(!own(s).edgeSet.has(id))return{ok:false,reason:'inside'};
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
// the Survey Post and Watchtower. With none built they wait by the hearth.
function postsFor(s,role){const list=(role==='guard'?['watchtower','townhall','survey']:['survey','watchtower']).map(t=>tileOf(s,t)).filter(x=>x!==null);
  return list.length?list:[[...world(s.origin).rubble][0]];}

/* ---------- Settlement Level ----------
 * Worked out from what stands in Haven right now: building levels (the Town Hall counts double), cleared patches, up to 20
 * roads, Better Tools and workers. Nothing is stored or added by events, so reloading, importing, opening two tabs or
 * tapping again can never raise it. Level L needs 2·(L−1)·L points: Lv 5 at 40, Lv 10 at 180, Lv 20 at 760. */
function points(s){const P=CONFIG.points;let p=0;for(const b of s.built)p+=P.level*b.lv*(b.lv+1)/2*(b.t==='townhall'?P.townHall:1);
  return p+P.land*s.zones.length+P.road*Math.min(s.roads.length,P.roadCount)+P.tool*s.tools+P.worker*s.workers;}
const levelAt=L=>2*(L-1)*L;
const titleOf=L=>L>=20?'Great Stronghold':L>=16?'Stronghold':L>=6?'Town':L>=3?'Village':'Camp';
function settlement(s){const pts=points(s);let L=1;while(levelAt(L+1)<=pts)L++;
  return{level:L,points:pts,at:levelAt(L),next:levelAt(L+1),title:titleOf(L),milestone:MILESTONES.find(m=>m.lv>L)||null};}

/* ---------- Workers ----------
 * A worker walks to the nearest node it can reach that no other worker has claimed, then swings at it every 1.4 s
 * until it's finished (by anyone). Positions are not saved; they walk in again after a reload. */
// Someone new walks in from the forest edge, on the side nearest you (the front of the map), each at a different spot.
function crewMember(k,s){const list=own(s).nearList.filter(([c,r])=>c+r>=W+2),[c,r]=list[(k*7+3)%list.length]||[W,W];return{k,c,r,steps:[],node:null,task:null,visit:k,phase:'idle',t:0,wait:0,face:1,stuck:false};}
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

const logic={STAFF,staff,staffCap,KEY,V5_KEY,OLD_KEYS,BAD_KEY,CONFIG,FX,BLUEPRINTS,MILESTONES,JOBS,DAMAGEABLE,PATCHES,ZADJ,HEARTH,FOOTPATH,zoneAt,landOf,own,world,inLand,standing,standingIds,buildingAt,has,lvOf,on,isBroken,fresh,newGame,validate,loadFrom,
  hungry,fed,farmOpen,farmCap,farmHit,eat,foodRate,raidsOpen,raidKind,threat,edgeIds,defense,warnLead,raidTarget,raidOutcome,resolveRaid,tickThreat,canWall,layWall,wallSites,
  repairCost,canRepair,startRepair,repairHit,repairing,postsFor,planFor,tileOf,
  cost,afford,manualPower,workerPower,hitsFor,buy,hitNode,regrow,regrowOldest,timedRegrow,canSwing,blocked,walkable,reach,route,stepTime,lockReason,buildCost,canPlace,validSites,build,
  maxLevel,upgradeCost,canUpgrade,upgrade,canRoad,layRoad,roadSites,setJob,roleOf,allAuto,yieldOf,buildRank,buildOrder,goal,suggest,defensePick,perimeter,autoWall,autoSite,addWall,findWhat,nearestNode,paneBuild,panePeople,TABS,toolsCap,workerCap,clearCost,canClear,clearZone,openZones,nextClear,clearPick,inFrom,points,levelAt,settlement,simulate,syncCrew,crewPosition};

/* ---------- Everything below needs a browser. ---------- */
// The drawer's open section is kept only while the page is open (never saved), so leaving Haven and coming back keeps it.
let drawerMemory=null;
let state=null,view=null,raf=0,lastFrame=0,anims=[],resetArmed=0,lastBig=0,loadNote='',lastSwing=null,drawnAnims=false,saveClock=0;const crew=[];
const regrowClock={left:CONFIG.regrowMs},raidClock={walk:0};
const host=root.location?.hostname||'';
const TEST=host==='lorebound-dev.github.io'||host==='localhost'||host==='127.0.0.1';
root.LoreRuinsReclaimed={...logic,TEST,mount,unmount,crew,get state(){return state;},get mounted(){return !!view;},get running(){return !!raf;}};
if(typeof document==='undefined')return;

const motionQuery=root.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced=()=>!!motionQuery?.matches;
const storeApi={get:k=>{try{return root.localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{root.localStorage.setItem(k,v);}catch{}}};
function load(){if(state)return state;const r=loadFrom(storeApi);state=r.state;loadNote=r.note;if(r.note)store();return state;}
function store(){storeApi.set(KEY,JSON.stringify(state));}
const fmt=c=>RES.filter(k=>c[k]).map(k=>`${c[k]} ${RES_NAME[k]}`).join(' · ')||'Free';
const power=q=>{const v=q/4;return Number.isInteger(v)?String(v):v.toFixed(2).replace(/0$/,'');};
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
// One big choice at the top of a window: a small drawing, a name, what it's for, and its price (or what's missing).
const pickCard=pane=>`<button type="button" class="ruins-upgrade ruins-pick" data-ruins="pick" data-pane="${pane}" hidden><canvas class="ruins-icon" aria-hidden="true"></canvas><span><strong></strong><small></small></span><b></b></button>`;
const bpButton=b=>`<button type="button" class="ruins-upgrade" data-ruins="bp" data-type="${b.id}"><span><strong></strong><small></small></span><b></b></button>`;

const SKETCH=`<section class="ruins-proto" aria-labelledby="ruinsTitle">
<h3 id="ruinsTitle" class="ruins-title-sr">Haven (test prototype, trial numbers)</h3>
<dl class="ruins-stats"><div><dt>Wood</dt><dd id="ruinsWood">0</dd></div><div><dt>Stone</dt><dd id="ruinsStone">0</dd></div><div id="ruinsOreBox"><dt>Ore</dt><dd id="ruinsOre">0</dd></div><div><dt>Food</dt><dd id="ruinsFood">0</dd></div></dl>
<div class="ruins-level"><div class="ruins-level-main"><div class="ruins-level-row"><strong id="ruinsLevelName">Settlement Lv 1 · Camp</strong><span id="ruinsLevelPts">0 / 4</span></div><div class="ruins-level-bar" aria-hidden="true"><i id="ruinsLevelBar"></i></div><small id="ruinsNext" hidden></small></div><button type="button" class="ruins-help-toggle" aria-expanded="false" aria-controls="ruinsHelp" aria-label="How Haven works">?</button></div>
<div class="ruins-world"><div class="ruins-field"><div class="ruins-scene" id="ruinsScene"><canvas id="ruinsCanvas" tabindex="0" role="img"></canvas></div>
<div class="ruins-zoom" role="group" aria-label="Zoom"><button type="button" data-ruins="zoomin" aria-label="Zoom in">+</button><button type="button" data-ruins="zoomout" aria-label="Zoom out">−</button><button type="button" class="ruins-home" data-ruins="home" aria-label="Center town"><i></i></button></div>
<div class="ruins-over"><p class="ruins-alert" id="ruinsAlert" role="status" aria-live="polite" hidden></p>
<div class="ruins-next" id="ruinsHud" hidden><canvas class="ruins-icon" aria-hidden="true"></canvas><span><strong id="ruinsHudName"></strong><small id="ruinsHudCost"></small></span><button type="button" class="ruins-next-go" data-ruins="suggest">Build</button></div>
<div class="ruins-help ruins-win" id="ruinsHelp" role="group" aria-label="How Haven works" hidden><div class="ruins-win-head"><strong>How Haven works</strong><button type="button" class="ruins-close" data-ruins="helpclose" aria-label="Close How Haven works">×</button></div><div class="ruins-win-body"><p>Tap a tree, stone or ore vein again and again to work it. Each swing takes about half a second; the thin line under the bar fills when you can swing again. The bar shows the work left; it pays once, when it comes down. Better Tools and the Workshop make each hit stronger.</p><p>Everything you can do opens from the four buttons along the bottom of the screen: Build, People, Defense and Land. Each opens a small window over the town, and × (or the same button again) closes it. The box at the top of the town suggests one thing worth doing next, with its price; you never have to follow it. Each window shows one choice first; More shows everything. Tap a building or a person to see what you can do with them.</p><p>Drag the town to look around. Pinch, or use + and −, to zoom; the square button brings the middle back.</p><p>Add Palisade (Defense) picks the next edge tile for you and shows it before you pay. Pick for me does the same for a building; you can still tap any lit tile yourself.</p><p>Build: pick a building, tap a lit tile, then confirm. Buildings stay where you put them. Tap a building to upgrade it: makeshift, then timber, then stone. The Town Hall sets how far the others can grow.</p><p>Roads: lay them one tile at a time. Workers walk faster on them.</p><p>People: recruit people at the House or in People (they need a place to live and some Food). Tap a building to give it workers: + takes someone on Auto, − puts them back. The Farm, Lumber Camp, Stone Yard, Foundry, Workshop, Watchtower and Survey Post each have their job; More jobs in People has every job, even before its building.Woodcutters and miners do more work on their own kind. Farmers work the Farm or forage berry bushes. Builders repair. Guards add to Defense. Scouts warn of raids sooner. People on Auto work anything.</p><p>Food: everyone eats 1 Food a minute while Haven is open. Berry bushes and the Farm make Food. With no Food nobody is lost, but work is slower and no one joins until there's Food again.</p><p>Raids: once Haven has a House, a Farm and its first cleared patch, wolves and bandits come now and then, always with a warning. If your Defense (guards, Watchtower, palisade on the edge) is at least their Threat, they're driven off. If not, they take a small share of one resource and damage one building until you repair it. They never take buildings, levels, land or people, and nothing happens while you're away.</p><p>Land: Haven starts on a raised home clearing. The wild land round it is cut into patches. A patch beside your land shows a Clear sign with its price: tap it, check the price, then Clear. Most of the brush goes; its trees, stone and ore stay for you to work. Patches further out show a lock until the land next to them is cleared, and after the first one you need a Survey Post. Find Next Clearing (Land) shows you one.</p><p>Settlement Level comes from what stands in Haven: buildings and their levels, cleared land, roads, tools and workers.</p><p>Every ${CONFIG.regrowEvery}rd tree or deposit you finish, and after every ${CONFIG.regrowMs/1000} seconds of play here, the oldest felled one grows back (straight away if nothing is left), so you can't run out. It always needs the full work again.</p><p>Workers swing every ${CONFIG.workerHitMs/1000} seconds, only while this screen is open.</p><p>This is a test. Its Wood, Stone, Ore and Food never touch your Gold, Shards, Essence or save. Numbers are trial values.</p><div class="ruins-help-buttons"><button type="button" data-ruins="reset">Reset demo</button></div></div></div>
<i class="ruins-gap"></i><div class="ruins-caption"><p class="ruins-work" id="ruinsWorkText" hidden></p><p class="ruins-stage" id="ruinsStage" role="status" aria-live="polite"></p></div>
<div class="ruins-place" id="ruinsPlace" hidden><strong class="ruins-place-name" id="ruinsPlaceName"></strong><p id="ruinsPlaceText"></p><div class="ruins-staff" id="ruinsStaff" hidden><span><strong id="ruinsStaffName"></strong><small id="ruinsStaffInfo"></small></span><button type="button" data-ruins="staff" data-d="less">−</button><b id="ruinsStaffN">0</b><button type="button" data-ruins="staff" data-d="add">+</button></div><button type="button" class="ruins-cancel ruins-bar-go" data-ruins="recruit" hidden>Recruit</button><button type="button" class="ruins-cancel ruins-bar-go" data-ruins="topeople" hidden>Reassign in People</button><div><button type="button" class="ruins-confirm" data-ruins="confirm">Build here</button><button type="button" class="ruins-confirm" data-ruins="autopick" hidden>Pick for me</button><button type="button" class="ruins-cancel" data-ruins="cancel">Cancel</button></div></div>
<div class="ruins-win" id="ruinsManageBody" role="group" aria-labelledby="ruinsWinTitle" hidden>
<div class="ruins-win-head"><strong id="ruinsWinTitle">Build</strong><button type="button" class="ruins-more-btn" data-ruins="more" aria-expanded="false">More</button><button type="button" class="ruins-close" data-ruins="manage" aria-controls="ruinsManageBody">×</button></div>
<p class="ruins-goal ruins-more" id="ruinsGoal" hidden></p>
<div class="ruins-pane ruins-build" id="ruinsBuild" role="tabpanel" aria-labelledby="ruinsTab-build" hidden>
${pickCard('build')}
<button type="button" class="ruins-upgrade ruins-more" data-ruins="tools"><span><strong></strong><small></small></span><b></b></button>
<button type="button" class="ruins-upgrade ruins-more" data-ruins="roads"><span><strong></strong><small></small></span><b></b></button>
<p class="ruins-build-head ruins-more">Homes &amp; food</p><div class="ruins-bp-list ruins-more" id="ruinsList-home">${BLUEPRINTS.filter(b=>b.group==='home').map(bpButton).join('')}</div>
<p class="ruins-build-head ruins-more">Foundations</p><div class="ruins-bp-list ruins-more" id="ruinsList-found">${BLUEPRINTS.filter(b=>b.group==='found').map(bpButton).join('')}</div>
<p class="ruins-build-head ruins-more">Town</p><div class="ruins-bp-list ruins-more" id="ruinsList-town">${BLUEPRINTS.filter(b=>b.group==='town').map(bpButton).join('')}</div></div>
<div class="ruins-pane ruins-jobs" id="ruinsJobs" role="tabpanel" aria-labelledby="ruinsTab-jobs" hidden>
<p class="ruins-note ruins-threat" id="ruinsPeopleShort"></p><p class="ruins-note" id="ruinsJobSum"></p>${pickCard('jobs')}
<button type="button" class="ruins-upgrade" data-ruins="worker"><span><strong></strong><small></small></span><b></b></button>
<p id="ruinsJobsText" class="ruins-more"></p>${JOBS.map(j=>`<div class="ruins-job ruins-more" id="ruinsJob-${j}"><span><strong id="ruinsJobName-${j}"></strong><small id="ruinsJobInfo-${j}"></small></span><button type="button" data-ruins="job" data-job="${j}" data-d="less">−</button><b id="ruinsJobN-${j}">0</b><button type="button" data-ruins="job" data-job="${j}" data-d="add">+</button></div>`).join('')}
<button type="button" class="ruins-cancel ruins-auto ruins-more" data-ruins="auto">Put every worker on Auto</button></div>
<div class="ruins-pane" id="ruinsDefensePane" role="tabpanel" aria-labelledby="ruinsTab-defense" hidden><p class="ruins-note ruins-threat" id="ruinsDefShort"></p>${pickCard('defense')}<p class="ruins-note ruins-more" id="ruinsDefenseText"></p><p class="ruins-note ruins-more" id="ruinsDefenseParts"></p><p class="ruins-note ruins-more" id="ruinsLastRaid" hidden></p>
${DAMAGEABLE.map(t=>`<button type="button" class="ruins-upgrade ruins-repair" data-ruins="repair" data-fix="${t}" hidden><span><strong></strong><small></small></span><b></b></button>`).join('')}
<button type="button" class="ruins-upgrade ruins-more" data-ruins="walls"><span><strong></strong><small></small></span><b></b></button><p class="ruins-note ruins-more" id="ruinsWatchText"></p></div>
<div class="ruins-pane" id="ruinsLandPane" role="tabpanel" aria-labelledby="ruinsTab-land" hidden><p class="ruins-note ruins-threat" id="ruinsLandShort"></p>
<button type="button" class="ruins-upgrade ruins-expand" data-ruins="findclear"><span><strong>Find Next Clearing</strong><small></small></span><b></b></button>
<button type="button" class="ruins-cancel" data-ruins="centre">Center Home</button><p class="ruins-note ruins-more" id="ruinsLandText"></p></div>
</div></div></div>
<div class="ruins-tabs" id="ruinsManage" role="tablist" aria-label="Manage Haven">${TABS.map(t=>`<button type="button" role="tab" class="ruins-tab" id="ruinsTab-${t.id}" data-ruins="${t.id}" aria-controls="ruinsManageBody" aria-selected="false" aria-expanded="false" tabindex="-1">${t.name}</button>`).join('')}</div></div>
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
    place:q('#ruinsPlace'),placeName:q('#ruinsPlaceName'),placeText:q('#ruinsPlaceText'),confirm:q('[data-ruins=confirm]'),cancel:q('[data-ruins=cancel]'),buildPanel:q('#ruinsBuild'),findClear:q('[data-ruins=findclear]'),landShort:q('#ruinsLandShort'),clearing:null,badges:[],
    jobsPanel:q('#ruinsJobs'),jobsText:q('#ruinsJobsText'),auto:q('[data-ruins=auto]'),
    manage:q('[data-ruins=manage]'),manageBody:q('#ruinsManageBody'),winTitle:q('#ruinsWinTitle'),goal:q('#ruinsGoal'),defenseText:q('#ruinsDefenseText'),watchText:q('#ruinsWatchText'),landText:q('#ruinsLandText'),
    tabs:Object.fromEntries(TABS.map(t=>[t.id,{btn:q(`[data-ruins=${t.id}]`),pane:q('#'+t.pane)}])),lists:{home:q('#ruinsList-home'),found:q('#ruinsList-found'),town:q('#ruinsList-town')},tab:'build',open:false,info:null,
    jobs:Object.fromEntries(JOBS.map(j=>[j,{name:q(`#ruinsJobName-${j}`),info:q(`#ruinsJobInfo-${j}`),n:q(`#ruinsJobN-${j}`),less:q(`[data-ruins=job][data-job=${j}][data-d=less]`),add:q(`[data-ruins=job][data-job=${j}][data-d=add]`)}])),
    roads:q('[data-ruins=roads]'),
    bps:Object.fromEntries(BLUEPRINTS.map(b=>[b.id,q(`[data-type=${b.id}]`)])),tools:q('[data-ruins=tools]'),worker:q('[data-ruins=worker]'),workText:q('#ruinsWorkText'),
    help:q('#ruinsHelp'),helpToggle:q('.ruins-help-toggle'),helpClose:q('[data-ruins=helpclose]'),reset:q('[data-ruins=reset]'),geo:null,down:null,placing:null,roading:false,upgrading:null,site:null,sites:[],selected:null,level:0,
    oreBox:q('#ruinsOreBox'),hud:q('#ruinsHud'),hudIcon:q('#ruinsHud canvas'),hudName:q('#ruinsHudName'),hudCost:q('#ruinsHudCost'),hudGo:q('[data-ruins=suggest]'),autopick:q('[data-ruins=autopick]'),
    moreBtn:q('[data-ruins=more]'),more:false,peopleShort:q('#ruinsPeopleShort'),defShort:q('#ruinsDefShort'),zoomIn:q('[data-ruins=zoomin]'),zoomOut:q('[data-ruins=zoomout]'),
    pickBtns:Object.fromEntries(['build','jobs','defense'].map(p=>[p,q(`[data-ruins=pick][data-pane=${p}]`)])),picks:{},sug:null,
    jobRows:Object.fromEntries(JOBS.map(j=>[j,q(`#ruinsJob-${j}`)])),jobSum:q('#ruinsJobSum'),
    staff:q('#ruinsStaff'),staffName:q('#ruinsStaffName'),staffInfo:q('#ruinsStaffInfo'),staffN:q('#ruinsStaffN'),staffLess:q('[data-ruins=staff][data-d=less]'),staffAdd:q('[data-ruins=staff][data-d=add]'),recruit:q('[data-ruins=recruit]'),toPeople:q('[data-ruins=topeople]'),zoom:1,ptrs:new Map(),pinch:null,panning:false};
  if(drawerMemory)Object.assign(view,drawerMemory);
  view.place.hidden=true;view.help.hidden=true;
  el.addEventListener('click',onClick);el.addEventListener('keydown',onPanelKey);
  view.canvas.addEventListener('pointerdown',onDown);view.canvas.addEventListener('pointerup',onUp);view.canvas.addEventListener('pointermove',onMove);
  view.canvas.addEventListener('pointercancel',e=>{if(!view)return;view.down=null;view.ptrs.delete(e?.pointerId);if(view.ptrs.size<2)view.pinch=null;if(!view.ptrs.size)view.panning=false;});
  view.scene.addEventListener?.('wheel',onWheel,{passive:false});
  view.canvas.addEventListener('keydown',onKey);
  root.addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVisible);
  if(typeof root.ResizeObserver==='function'){view.resizer=new root.ResizeObserver(onSceneResize);view.resizer.observe(view.scene);}
  syncCrew(state,crew);
  layout(true);
  if(loadNote==='fresh')say('Haven 4: a new map with wild land you clear patch by patch. This is a fresh town; your earlier Haven is kept as it was, as a backup.');
  else if(loadNote==='unreadable')say('The saved settlement could not be read. A copy is kept, and a new one has started.');
  loadNote='';view.level=settlement(state).level;sortBuild();update();wake();
}
function unmount(){
  if(!view)return;sleep();store();anims=[];drawerMemory={tab:view.tab,open:view.open,zoom:view.zoom};
  root.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible);view.resizer?.disconnect();
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

/* Input: a short press without much movement is a tap. One finger dragging moves the town both ways (never the page);
 * two fingers pinch to zoom around the point between them. A drag or a pinch is never a tap, so it can't chop, place,
 * build or spend anything. */
function onDown(e){if(e.button>0)return;view.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});try{view.canvas.setPointerCapture?.(e.pointerId);}catch{}
  if(view.ptrs.size===1){view.down={x:e.clientX,y:e.clientY,t:Date.now(),id:e.pointerId};view.panning=false;return;}
  view.down=null;const [a,b]=[...view.ptrs.values()];view.pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:view.zoom};}
function onMove(e){const p=view?.ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(view.ptrs.size===1){const d=view.down;if(!view.panning&&d&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<=6)return;view.panning=true;
    const sc=view.scene;sc.scrollLeft=(sc.scrollLeft||0)-dx;sc.scrollTop=(sc.scrollTop||0)-dy;return;}
  if(view.ptrs.size===2&&view.pinch&&view.pinch.d>=10){const [a,b]=[...view.ptrs.values()],box=view.scene.getBoundingClientRect?.()||{left:0,top:0};
    zoomTo(view.pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/view.pinch.d,[(a.x+b.x)/2-box.left,(a.y+b.y)/2-box.top]);}}
function onUp(e){if(!view)return;view.ptrs.delete(e.pointerId);if(view.ptrs.size<2)view.pinch=null;if(!view.ptrs.size)view.panning=false;
  const d=view.down;if(!d||d.id!==e.pointerId)return;view.down=null;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>12||Date.now()-d.t>700)return;
  const box=view.canvas.getBoundingClientRect();tapAt(e.clientX-box.left,e.clientY-box.top);}
// A trackpad pinch (or Ctrl + wheel) zooms too; a plain wheel scrolls the town as before.
function onWheel(e){if(!view||!e.ctrlKey)return;e.preventDefault();const box=view.scene.getBoundingClientRect?.()||{left:0,top:0};zoomTo(view.zoom*(e.deltaY<0?1.1:1/1.1),[e.clientX-box.left,e.clientY-box.top]);}
function onKey(e){if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();if(view.roading||view.walling)return;if(view.clearing!==null){confirmClear();return;}if(view.repairing){confirmRepair();return;}if(view.upgrading){confirmUpgrade();return;}if(view.placing){if(view.site!==null)confirmBuild();return;}
  const target=view.selected!==null&&standing(state,view.selected)?view.selected:standingIds(state).sort((a,b)=>depth(b)-depth(a))[0];if(target!==undefined)work(target);}
const depth=id=>id%W+Math.floor(id/W);
const WHY={outside:'That land is still wild. Clear it first (tap its Clear sign).',building:'There is a building there already.',rubble:'The hearth stays where it is.',node:'Clear that tree or deposit first.',path:'That spot would wall off the paths. Pick another lit tile.',road:'There is a road there already.',wall:'There is palisade there already.',inside:'Palisade goes on the edge of Haven. Pick a lit tile.'};
// A tile that can't take what's being placed blinks red for a moment (drawn on the ground; nothing is charged).
function nope(id){if(id===undefined||id===null)return;anims=anims.filter(a=>a.type!=='nope');anims.push({type:'nope',c:id%W,r:Math.floor(id/W),t0:performance.now(),life:600});draw();wake();}
function tapAt(x,y){
  const t=hit(x,y);if(!t)return;
  if(view.walling==='auto')return; // the tile is already picked for you; Build here or Cancel
  if(view.walling){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W),res=layWall(state,c,r);
    if(!res.ok){nope(t.tile);say(res.reason==='short'?`You need ${fmt(res.need)} more for palisade.`:res.reason==='max'?`Haven has its full ${CONFIG.wallMaxTiles} palisade tiles.`:WHY[res.reason]||'Pick a lit tile.');return;}
    store();view.sites=wallSites(state);say('');update();return;}
  if(view.roading){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W),res=layRoad(state,c,r);
    if(!res.ok){nope(t.tile);say(res.reason==='short'?'You need 1 more Stone for a road.':res.reason==='max'?`Haven has its full ${CONFIG.roadMax} road tiles.`:WHY[res.reason]||'Pick a lit tile.');return;}
    store();view.sites=roadSites(state);say('');update();return;}
  if(view.placing){if(t.tile===undefined)return;const c=t.tile%W,r=Math.floor(t.tile/W);
    if(view.sites.includes(t.tile)){view.site=t.tile;placeLine();draw();return;}
    const p=canPlace(state,view.placing,c,r);if(!p.ok)nope(t.tile);say(p.ok?'':WHY[p.reason]||'Pick a lit tile.');return;}
  if(t.zone!==undefined){openClear(t.zone);return;}
  // Wild land itself: one short line, never a charge. The sign is what clears it.
  if(t.wild!==undefined){const k=canClear(state,t.wild);say(k.reason==='far'||k.reason==='survey'?`${PATCH[t.wild].name}: ${LOCKED[k.reason]}`:`${PATCH[t.wild].name}: wild land. Tap its Clear sign to clear it.`);return;}
  if(t.node!==undefined){work(t.node);return;}
  if(t.building){const type=t.building.t;if(isBroken(state,type)){if(state.broken[type]>0)fix(type);else openRepair(type);return;}openUpgrade(type);return;}
  if(t.raider){const k=state.raid,o=raidOutcome(state,k),tg=raidTarget(state,k);
    openInfo(RAID_NAME[k],`Threat ${o.th} against your Defense ${o.def}${tg?` · heading for the ${BP[tg].name}`:''}. ${o.won?'They will be driven off.':'Add guards in People to drive them off.'}`,'defense');return;}
  if(t.person){const w=t.person,role=roleOf(state,w.k),doing=w.task==='farm'?'working the Farm':w.task==='repair'?'repairing':w.task==='post'?'keeping watch':w.phase==='work'?'working':w.phase==='walk'?'walking to a job':'resting';
    const job=JOB_ONE[role];openInfo(job[0].toUpperCase()+job.slice(1),`${doing[0].toUpperCase()+doing.slice(1)}. Eats 1 Food a minute. Tap a building to give it workers.`,'jobs');return;}
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
/* Find (#145): the nearest node that gives what the suggestion is short of gets the gold tile and a pointer for a
 * moment, and the town scrolls to it if it's off screen. Looking only: nothing is worked, paid or saved. */
function findNode(res){const id=nearestNode(state,res),name=res==='food'?'berry bush':RES_NAME[res];
  if(id===null){say(`No ${name} standing right now. Felled ones grow back in a little while.`);return;}
  const n=world(state.origin).nodes.get(id),now=performance.now();view.selected=id;anims=anims.filter(a=>a.type!=='find');anims.push({type:'find',id,t0:now,life:2400});
  const g=view.geo,sc=view.scene;if(g&&sc){const [x,y]=iso(g,n.c+.5,n.r+.5),cw=sc.clientWidth||0,sh=sc.clientHeight||0,ox=Math.max(0,(cw-g.cssW)/2),oy=Math.max(0,(sh-g.cssH)/2),
      vx=x+ox-(sc.scrollLeft||0),vy=y+oy-(sc.scrollTop||0);
    if(vx<40||vx>cw-40||vy<g.w*1.6+60||vy>sh-60){sc.scrollLeft=Math.max(0,x+ox-cw/2);sc.scrollTop=Math.max(0,y+oy-sh/2);}}
  const h=Math.ceil((state.hp[id]??CONFIG.kinds[n.kind].hp)/manualPower(state));
  say(`Nearest ${CONFIG.kinds[n.kind].name}: tap it ${plural(h,'time','times')} for ${fmt(yieldOf(state,n.kind))}.`);draw();wake();}
/* The in-game menus. Four small buttons along the bottom edge of the screen (Build, People, Defense, Land) each open
 * one small window over the town; × or the same button again closes it, and the town behind keeps its size and pan.
 * While a building is being placed, a road laid, an upgrade confirmed or a person looked at, the small bar on the
 * town takes the window's place, so only one set of choices is open at a time; Cancel brings the window back. */
const busyBar=()=>!!(view.placing||view.roading||view.walling||view.upgrading||view.info||view.clearing);
function showDrawer(){
  const busy=busyBar(),shown=view.open&&!busy;view.manageBody.hidden=!shown;
  const name=TABS.find(t=>t.id===view.tab)?.name||'';view.winTitle.textContent=name;view.manage.setAttribute('aria-label','Close '+name);
  for(const t of TABS){const v=view.tabs[t.id],on=t.id===view.tab;v.pane.hidden=!on;v.btn.setAttribute('aria-selected',String(on&&shown));v.btn.setAttribute('aria-expanded',String(on&&shown));v.btn.setAttribute('tabindex',on?'0':'-1');}}
// Ready choices first. Only reordered when a section opens or after something is built, never while you're choosing.
function sortBuild(){if(!view)return;for(const g of ['home','found','town']){const list=view.lists[g];if(typeof list?.append!=='function')continue;
  const order=buildOrder(state,g);if(order.every((id,i)=>list.children[i]===view.bps[id]))continue;list.append(...order.map(id=>view.bps[id]));}}
function openTab(id,focus){if(!view.tabs[id])return;endPlacing();closeHelp();view.tab=id;view.open=true;view.more=false;if(id==='build')sortBuild();view.tabs[id].pane.scrollTop=0;say('');update();if(focus)view.tabs[id].btn.focus?.();}
function closeHelp(){if(!view.help.hidden){view.help.hidden=true;view.helpToggle.setAttribute('aria-expanded','false');}}
// Arrow keys move between the four menus; Escape closes a bar first, then the window (or How Haven works).
function onPanelKey(e){
  if(e.key==='Escape'){if(busyBar()){e.preventDefault();endPlacing();say('');update();view.canvas.focus?.();return;}
    if(!view.help.hidden){e.preventDefault();closeHelp();view.helpToggle.focus?.();return;}
    if(view.open){e.preventDefault();view.open=false;update();view.tabs[view.tab].btn.focus?.();}return;}
  const tab=e.target?.closest?.('[role=tab]');if(!tab||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'&&e.key!=='Home'&&e.key!=='End'))return;
  e.preventDefault();const list=TABS.filter(t=>tabOn(t.id)),i=Math.max(0,list.findIndex(t=>t.id===view.tab)),n=list.length,j=e.key==='Home'?0:e.key==='End'?n-1:(i+(e.key==='ArrowRight'?1:n-1))%n;openTab(list[j].id,true);}
// Menus show up once they're useful: Build and People from the start, Defense once Haven has a House and a Farm (what
// raids need before they start), or palisade, a Watchtower, raids or damage; Land with the House and the Farm too (when
// clearing is suggested), or a Survey Post or cleared land. The Clear signs are on the map from the start.
function tabOn(id){if(id==='defense')return has(state,'house')&&has(state,'farm')||raidsOpen(state)||!!state.raid||state.walls.length>0||Object.keys(state.broken).length>0||has(state,'watchtower');
  if(id==='land')return has(state,'house')&&has(state,'farm')||has(state,'survey')||state.zones.length>0;return true;}
/* Taking the suggestion (or a window's one choice). It goes through exactly the same steps as the full lists: a
 * building or palisade still shows where it goes and its price before Build here, an upgrade or repair still asks.
 * Only Recruit, Better Tools and a job change happen on the tap (clearing land shows the patch and asks first), as their own buttons always have, and the
 * price is on the button. A second tap within 0.6 s is ignored, so a double tap can't take the next suggestion too. */
let lastAct=-1e9;
function act(sug){if(!sug||!sug.ready||!view)return;const now=performance.now();if(now-lastAct<600)return;lastAct=now;
  if(sug.kind==='build'){startPlacing(sug.type,sug.type==='watchtower');return;}
  if(sug.kind==='upgrade'){openUpgrade(sug.type);return;}
  if(sug.kind==='repair'){openRepair(sug.type);return;}
  if(sug.kind==='wall'){startAutoWall();return;}
  if(sug.kind==='worker'||sug.kind==='tools'){buyThing(sug.kind==='tools'?'tools':'worker');return;}
  if(sug.kind==='clear'){openClear(sug.zone,true);return;}
  if(sug.kind==='job'){if(setJob(state,sug.job,1).ok){done(sug.key);store();say(`One more ${JOB_ONE[sug.job]}.`);update();}}}
// A done suggestion gets a small gold burst on the map, where it happened, then the next suggestion shows.
function done(key,id){if(!view||!key||view.sugKey!==key)return;const at=id??wid(8,8),now=performance.now();
  if(!reduced())anims.push({type:'ack',c:at%W,r:Math.floor(at/W),t0:now,life:900});anims.push({type:'pop',c:at%W,r:Math.floor(at/W),text:'Done!',worker:false,t0:now+150,life:1100});wake();}
function buyThing(what){const r=buy(state,what);if(r.ok){done(what);store();if(what==='worker')syncCrew(state,crew);
    say(what==='tools'?`Better Tools level ${state.tools}. Hit power is now ${power(manualPower(state))}.`:`Someone new joins Haven. ${plural(state.workers,'person','people')} now. They start on Auto; tap a building to give them a job.`);update();wake();}
  else if(r.reason==='hungry')say('No one joins a hungry town. Get some Food first.');}
/* Clearing a patch (#144): tap its Clear sign and a small bar asks, with the exact price; Clear pays once (the bar closes,
 * so a second tap finds nothing to clear) and the brush sweeps away. A lock sign only says why, in one short line. */
function zoneCentre(z){const p=PATCH[z];return[p.c0+P4/2,p.r0+P4/2];}
function showZone(z){const g=view.geo,sc=view.scene;if(!g||!sc)return;const [c,r]=zoneCentre(z),[x,y]=iso(g,c,r),cw=sc.clientWidth||0,sh=sc.clientHeight||0,ox=Math.max(0,(cw-g.cssW)/2),oy=Math.max(0,(sh-g.cssH)/2);
  const vx=x+ox-(sc.scrollLeft||0),vy=y+oy-(sc.scrollTop||0);if(vx<60||vx>cw-60||vy<g.w*1.6+60||vy>sh-110){sc.scrollLeft=Math.max(0,x+ox-cw/2);sc.scrollTop=Math.max(0,y+oy-sh/2);}}
function openClear(z,pan=false){const c=canClear(state,z);if(c.reason==='owned')return;
  if(c.reason==='far'||c.reason==='survey'){say(`${PATCH[z].name}: ${LOCKED[c.reason]}`);return;}
  endPlacing();closeHelp();view.clearing=z;if(pan)showZone(z);placeLine();update();}
function zoneCount(z){const n=[...world(state.origin).nodes.values()].filter(x=>x.zone===z),k=f=>n.filter(f).length,parts=[];
  const w=k(x=>isWood(x.kind)),st=k(x=>x.kind==='stone'),o=k(x=>x.kind==='ore');if(w)parts.push(plural(w,'tree'));if(st)parts.push(`${st} stone`);if(o)parts.push(`${o} ore`);return parts.join(', ');}
function confirmClear(){const z=view.clearing;if(z===null||Date.now()-lastBig<700)return;const r=clearZone(state,z);
  if(!r.ok){placeLine();return;}
  lastBig=Date.now();const [c,rr]=zoneCentre(z);done('clear',wid(Math.floor(c),Math.floor(rr)));store();endPlacing();anims.push({type:'clear',z,t0:performance.now(),life:reduced()?1:CONFIG.clearMs});
  say(`${PATCH[z].name} cleared. ${zoneCount(z)} stand there to gather, and there's room to build.`);update();wake();}
// Find Next Clearing (Land): the patch to clear next is shown on the map, its edge pulsing for a moment, with its Clear
// bar open (so it can be cleared from the keyboard too). Only looking: nothing is paid until Clear.
function findClear(){const z=nextClear(state);if(z===null){say('All the land round Haven is cleared.');return;}
  const c=canClear(state,z);view.open=false;showZone(z);anims=anims.filter(a=>a.type!=='findzone');anims.push({type:'findzone',z,t0:performance.now(),life:2400});
  if(c.reason!=='survey'){openClear(z);view.canvas.focus?.();}
  say(c.reason==='survey'?`Next: ${PATCH[z].name}. ${LOCKED.survey}`:c.ok?`Next: ${PATCH[z].name}, ${fmt(c.cost)}. Clear it here, or tap its sign later.`:`Next: ${PATCH[z].name}, ${fmt(c.cost)}: you need ${fmt(c.need)} more.`);update();wake();}
// Add Palisade: Haven picks the next edge tile and shows it, gold, with its price; nothing is paid until Build here.
function startAutoWall(){if(settlement(state).level<CONFIG.roadsAt){say(`Palisade opens at Settlement Lv ${CONFIG.roadsAt}.`);return;}
  const id=autoWall(state);if(id===null){say(state.walls.length>=CONFIG.wallMaxTiles?`Haven has its full ${CONFIG.wallMaxTiles} palisade tiles.`:'No free edge tile. Clear trees or rocks on the edge first.');return;}
  endPlacing();view.walling='auto';view.sites=[id];view.site=id;placeLine();update();}
// Paid once: the bar closes on success, so a second tap finds nothing to build.
function confirmWall(){const id=view.site;if(view.walling!=='auto'||id===null)return;const r=layWall(state,id%W,Math.floor(id/W));
  if(!r.ok){endPlacing();say(r.reason==='short'?`You need ${fmt(r.need)} more for palisade.`:'That tile is taken now. Tap Add Palisade again.');update();return;}
  done('wall',id);store();endPlacing();const d=defense(state);say(`Palisade added: ${d.walled} / ${d.edge} edge tiles, +${d.walls} Defense.`);update();wake();}
/* Zoom: + and −, a pinch, or Ctrl + wheel. It scales the tiles between 20px and 72px around a point (the middle, or
 * between your fingers), keeping that point still. Only kept while the page is open, never saved. */
const ZMIN=20,ZMAX=72;
function zoomTo(z,focus){const g=view?.geo;if(!g)return;z=Math.max(ZMIN/g.base,Math.min(ZMAX/g.base,z));if(Math.abs(z-view.zoom)<.001)return;
  view.zoom=z;const w0=g.w;layout(false,focus);if(view.geo.w!==w0)draw();zoomButtons();}
function zoomButtons(){const g=view?.geo;if(!g)return;view.zoomIn.disabled=g.w>=ZMAX;view.zoomOut.disabled=g.w<=ZMIN;}
function onClick(e){
  const b=e.target.closest?.('button');if(!b||!view)return;
  if(b===view.helpToggle){const open=view.help.hidden;if(open){endPlacing();view.open=false;update();}view.help.hidden=!open;b.setAttribute('aria-expanded',String(open));return;}
  if(b===view.helpClose){closeHelp();view.helpToggle.focus?.();return;}
  const what=b.dataset.ruins;
  if(what==='tools'||what==='worker'){buyThing(what);return;}
  if(what==='suggest'){if(view.findRes)findNode(view.findRes);else act(view.sug);return;}
  if(what==='pick'){act(view.picks[b.dataset.pane]);return;}
  if(what==='more'){view.more=!view.more;update();return;}
  if(what==='zoomin'||what==='zoomout'){zoomTo(view.zoom*(what==='zoomin'?1.25:.8));return;}
  if(what==='autopick'){if(!view.placing)return;const id=autoSite(state,view.placing);if(id===null){say('No free tile to build on. Clear a tree or deposit first.');return;}view.site=id;placeLine();draw();return;}
  if(what==='walls'){startWalls();return;}
  if(what==='repair'){openRepair(b.dataset.fix);return;}
  // The same menu button again closes its window, so one tap always gives the whole town back.
  if(TABS.some(t=>t.id===what)){if(view.open&&view.tab===what&&!busyBar()){view.open=false;update();return;}openTab(what,false);return;}
  if(what==='manage'){endPlacing();view.open=false;update();view.tabs[view.tab].btn.focus?.();return;}
  if(what==='centre'){view.open=false;layout(true);update();view.canvas.focus?.();return;}
  if(what==='auto'){if(allAuto(state).ok){store();say(`Every worker is on Auto and works anything.`);update();}return;}
  if(what==='home'){layout(true);draw();return;}
  if(what==='job'){const add=b.dataset.d==='add',r=setJob(state,b.dataset.job,add?1:-1);if(r.ok){if(add)done('job:'+b.dataset.job);store();update();}return;}
  if(what==='bp'){if(has(state,b.dataset.type))openUpgrade(b.dataset.type);else startPlacing(b.dataset.type);return;}
  if(what==='roads'){startRoads();return;}
  if(what==='confirm'){if(view.info){const go=view.info.go;endPlacing();openTab(go,false);return;}if(view.clearing!==null){confirmClear();return;}if(view.walling==='auto'){confirmWall();return;}if(view.repairing)confirmRepair();else if(view.upgrading)confirmUpgrade();else confirmBuild();return;}
  if(what==='cancel'){const wasRoads=view.roading,wasWalls=view.walling;endPlacing();
    say(wasRoads&&state.roads.length?`${plural(state.roads.length,'road tile')} in Haven.`:wasWalls&&state.walls.length?`${plural(state.walls.length,'palisade tile')} in Haven.`:'');update();return;}
  if(what==='findclear'){findClear();return;}
  if(what==='staff'){staffTap(b.dataset.d==='add');return;}
  if(what==='recruit'){buyThing('worker');if(view.upgrading)placeLine();return;}
  if(what==='topeople'){endPlacing();openTab('jobs',false);view.more=true;update();return;}
  if(what==='reset'){if(Date.now()-resetArmed>3000){resetArmed=Date.now();b.textContent='Tap again to reset the demo';return;}
    resetArmed=0;b.textContent='Reset demo';state=newGame();regrowClock.left=CONFIG.regrowMs;raidClock.walk=0;lastSwing=null;resetCrew(crew);anims=[];endPlacing();store();view.level=1;say('Demo reset. Only Haven’s test settlement was cleared.');layout(true);update();wake();return;}
}
function startPlacing(type,auto=false){const bp=BP[type];if(!bp||has(state,type))return;
  const lock=lockReason(state,type);if(lock){say(`${bp.name}: ${lock}.`);return;}
  const c=buildCost(state,type);if(!afford(state,c)){say(`You need ${fmt(shortOf(state,c))} more for the ${bp.name}.`);return;}
  const sites=validSites(state,type);if(!sites.length){say('No free tile to build on. Clear a tree or deposit first.');return;}
  endPlacing();view.placing=type;view.sites=sites;view.site=auto?autoSite(state,type):null;placeLine();update();}
function startRoads(){const st=settlement(state);if(st.level<CONFIG.roadsAt){say(`Roads open at Settlement Lv ${CONFIG.roadsAt}.`);return;}
  const sites=roadSites(state);if(!sites.length){say(state.roads.length>=CONFIG.roadMax?`Haven has its full ${CONFIG.roadMax} road tiles.`:'No open ground for a road. Clear a tree or deposit first.');return;}
  endPlacing();view.roading=true;view.sites=sites;placeLine();update();}
function startWalls(){if(settlement(state).level<CONFIG.roadsAt){say(`Palisade opens at Settlement Lv ${CONFIG.roadsAt}.`);return;}
  const sites=wallSites(state);if(!sites.length){say(state.walls.length>=CONFIG.wallMaxTiles?`Haven has its full ${CONFIG.wallMaxTiles} palisade tiles.`:'The whole edge is walled, or trees and deposits stand on the rest. Clear them first.');return;}
  endPlacing();view.walling=true;view.sites=sites;placeLine();update();}
// A person or raider tapped on the town: who they are, with one way on to the menu where they're managed. Nothing is
// charged and nothing new can be done here; Close returns to the town as it was.
function openInfo(title,text,go){endPlacing();closeHelp();view.info={title,text,go};placeLine();update();}
function openUpgrade(type){if(!has(state,type))return;endPlacing();view.upgrading=type;placeLine();update();}
function openRepair(type){if(!isBroken(state,type))return;if(state.broken[type]>0){say(`The ${BP[type].name} is being repaired: ${state.broken[type]} work left. Builders do it, or tap it yourself.`);return;}
  endPlacing();view.repairing=type;view.upgrading=type;placeLine();update();}
// Paying for a repair, like building: the bar closes on success, so a double tap can't pay twice.
function confirmRepair(){const type=view.repairing;if(!type)return;const res=startRepair(state,type);if(!res.ok){placeLine();return;}
  done('repair:'+type,tileOf(state,type));store();endPlacing();say(`Repair of the ${BP[type].name} paid. ${state.jobs.build?'Your builders are on their way.':'No one is a Builder: tap it yourself to repair it, or make someone a Builder in People.'}`);update();wake();}
function endPlacing(){if(!view)return;view.info=null;view.clearing=null;view.placing=null;view.roading=false;view.walling=false;view.upgrading=null;view.repairing=null;view.site=null;view.sites=[];view.place.hidden=true;view.confirm.hidden=false;view.autopick.hidden=true;view.cancel.textContent='Cancel';view.confirm.textContent='Build here';hideStaff();}
function placeLine(){view.place.hidden=false;view.confirm.disabled=false;view.autopick.hidden=true;hideStaff();
  if(view.info){view.placeName.textContent=view.info.title;view.placeText.textContent=view.info.text;view.confirm.hidden=false;view.confirm.textContent=TABS.find(t=>t.id===view.info.go).name;view.cancel.textContent='Close';return;}
  if(view.clearing!==null){const z=view.clearing,c=canClear(state,z);view.placeName.textContent=`Clear · ${PATCH[z].name}`;view.confirm.hidden=false;view.confirm.textContent='Clear';view.confirm.disabled=!c.ok;view.cancel.textContent='Cancel';
    const inside=zoneCount(z);
    view.placeText.textContent=c.ok?`Clear this land for ${fmt(c.cost)}? Most of the brush goes; ${inside} stay to gather.`:c.reason==='short'?`Clearing costs ${fmt(c.cost)}: you need ${fmt(c.need)} more.`:LOCKED[c.reason]||'';return;}
  // One plain heading for what's in hand, so it's clear what a tap on the town will do.
  view.placeName.textContent=view.roading?'Laying road':view.walling==='auto'?'Add Palisade':view.walling?'Building palisade':view.repairing?`Repair · ${BP[view.repairing].name}`
    :view.upgrading?`${BP[view.upgrading].name} · Lv ${lvOf(state,view.upgrading)}`:view.placing?`Placing · ${BP[view.placing].name}`:'';
  if(view.roading){view.confirm.hidden=true;view.cancel.textContent='Done';
    view.placeText.textContent=`Tap lit tiles to lay road, ${fmt(CONFIG.roadCost)} each. Workers walk faster on roads. ${plural(state.roads.length,'tile')} laid.`;return;}
  if(view.walling==='auto'){const d=defense(state),ok=afford(state,CONFIG.wallCost);view.confirm.hidden=false;view.confirm.textContent='Build here';view.confirm.disabled=!ok;view.cancel.textContent='Cancel';
    view.placeText.textContent=ok?`Here, for ${fmt(CONFIG.wallCost)}? ${d.walled} / ${d.edge} edge tiles done.`:`${fmt(CONFIG.wallCost)} a tile: you need ${fmt(shortOf(state,CONFIG.wallCost))} more.`;return;}
  if(view.walling){view.confirm.hidden=true;view.cancel.textContent='Done';const d=defense(state);
    view.placeText.textContent=`Tap lit edge tiles for palisade, ${fmt(CONFIG.wallCost)} each. ${d.walled} of ${d.edge} edge tiles walled: +${d.walls} Defense (+${CONFIG.wallMax} for all of it).`;return;}
  view.confirm.hidden=false;view.cancel.textContent='Cancel';
  if(view.repairing){const type=view.repairing,u=canRepair(state,type),c=repairCost(state,type);view.confirm.textContent='Repair';view.confirm.disabled=!u.ok;
    view.placeText.textContent=u.reason==='short'?`The ${BP[type].name} is damaged and does nothing until repaired. Repair costs ${fmt(c)}: you need ${fmt(u.need)} more.`
      :`Repair the ${BP[type].name} for ${fmt(c)}? Then builders (or your taps) do ${CONFIG.repairWork} work and it works again.`;return;}
  if(view.upgrading){const type=view.upgrading,bp=BP[type],lv=lvOf(state,type),u=canUpgrade(state,type);view.confirm.textContent='Upgrade';view.confirm.disabled=!u.ok;view.confirm.hidden=u.reason==='max';view.cancel.textContent='Close';
    // #141: what the building does now in one line, then its next level in a few words.
    const now=`${bp.effects[lv-1]}.`;
    view.placeText.textContent=u.reason==='max'?`${now} Highest level.`
      :u.reason==='townhall'?`${now} Lv ${u.to} later: needs Town Hall Lv ${u.to}.`
      :u.reason==='level'?`${now} Lv ${u.to} later: needs Settlement Lv ${CONFIG.townHallNeeds[u.to]}.`
      :u.reason==='short'?`${now} Lv ${u.to} (${STAGES[u.to-1]}): ${fmt(u.cost)}, need ${fmt(u.need)} more.`
      :`${now} Upgrade to Lv ${u.to} (${STAGES[u.to-1]}) for ${fmt(u.cost)}?`;staffLine(type);return;}
  const bp=BP[view.placing],c=buildCost(state,view.placing);view.confirm.textContent='Build here';view.confirm.disabled=view.site===null;view.confirm.hidden=view.site===null;view.autopick.hidden=view.site!==null;
  view.placeText.textContent=view.site===null?`Tap a lit tile, or Pick for me. ${fmt(c)}. Drag to look around.`:`Build the ${bp.name} here for ${fmt(c)}?`;}
function hideStaff(){if(!view.staff)return;view.staff.hidden=true;view.recruit.hidden=true;view.toPeople.hidden=true;}
/* #141: a tapped building's people. A House recruits (same price and rules as People); a building with a job shows
 * how many have it, with − and +. With no one on Auto, + is off and the bar offers People to free someone. */
function staffLine(type){
  if(type==='house'){const c=cost(state,'worker'),cap=workerCap(state),full=c===null,hun=!full&&hungry(state),short=!full&&!hun&&!afford(state,c);view.recruit.hidden=false;
    view.recruit.textContent=full?`People ${state.workers} / ${cap} · full`:hun?'Recruit · need Food':short?`Recruit · need ${fmt(shortOf(state,c))}`:`Recruit · ${fmt(c)}`;
    view.recruit.disabled=full||hun||short;view.recruit.setAttribute('aria-label',`${view.recruit.textContent}. ${state.workers} of ${cap} people.`);return;}
  const job=STAFF[type];if(!job)return;const n=state.jobs[job],cap=staffCap(state,type),auto=autoJobs(state),capped=cap!==null&&n>=cap;
  view.staff.hidden=false;view.staffName.textContent=JOB_NAME[job];view.staffN.textContent=cap===null?String(n):`${n} / ${cap}`;
  view.staffInfo.textContent=capped?`The Farm is full · ${auto} on Auto`:auto<1?'No free workers':`${auto} on Auto`;
  view.staffLess.disabled=n<=0;view.staffAdd.disabled=auto<1||capped;view.toPeople.hidden=auto>=1||capped;
  view.staffLess.setAttribute('aria-label',`One fewer ${JOB_ONE[job]}, back to Auto`);view.staffAdd.setAttribute('aria-label',`One more ${JOB_ONE[job]} from Auto`);}
// + or − on a building: only someone on Auto changes job, nothing is paid, and they finish what they're doing first.
function staffTap(add){const type=view.upgrading;if(!type||view.repairing)return;const r=staff(state,type,add?1:-1);
  if(!r.ok){say(r.reason==='busy'?'No free workers. Recruit at the House, or free someone in People.':r.reason==='cap'?`The Farm has room for ${r.cap} farmers.`:'');placeLine();return;}
  if(add)done('job:'+r.job,tileOf(state,type));store();const id=tileOf(state,type);
  if(id!==null)anims.push({type:'pop',c:id%W,r:Math.floor(id/W),text:`${add?'+1':'−1'} ${JOB_ONE[r.job]}`,worker:true,t0:performance.now(),life:900});
  say(add?`One more ${JOB_ONE[r.job]}. They head over after their current task.`:`One ${JOB_ONE[r.job]} is back on Auto.`);update();wake();}
// A second tap on Build here finds placing already ended, so a double tap can never build or charge twice.
function confirmBuild(){if(!view.placing||view.site===null)return;const type=view.placing,c=view.site%W,r=Math.floor(view.site/W),res=build(state,type,c,r);
  if(!res.ok){say(res.reason==='short'?`You need ${fmt(res.need)} more.`:'That spot is no longer free. Pick another lit tile.');if(res.reason!=='short'){view.sites=validSites(state,type);view.site=null;placeLine();draw();}return;}
  done('build:'+type,wid(c,r));store();endPlacing();sortBuild();view.open=false;if(!reduced())anims.push({type:'raise',t:type,t0:performance.now(),life:700});
  say(`${BP[type].name} built. ${BP[type].effects[0]}.`);update();wake();}
// The same for upgrades: the bar closes on success, so a second tap finds nothing to upgrade.
function confirmUpgrade(){const type=view.upgrading;if(!type)return;const res=upgrade(state,type);
  if(!res.ok){placeLine();return;}
  done('upgrade:'+type,tileOf(state,type));store();endPlacing();sortBuild();if(!reduced())anims.push({type:'raise',t:type,t0:performance.now(),life:700});
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
  // The message line sits on the bottom edge of the town, so it stays empty when there's nothing to say.
  if(!view.stage.textContent&&!view.placing&&!view.roading&&!view.upgrading&&!state.built.length)say('Tap a tree or stone to start working it.');
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
  view.auto.disabled=auto===state.workers;view.auto.setAttribute('aria-label',auto===state.workers?'Every worker is already on Auto':'Put every worker on Auto');
  manageText(st);showDrawer();simple(auto,cap);
  if(view.placing||view.roading||view.walling||view.upgrading||view.clearing!==null)placeLine();
  const sids=standingIds(state),wd=world(state.origin),count=k=>sids.filter(id=>{const n=wd.nodes.get(id).kind;return k==='wood'?isWood(n):n===k;}).length;
  view.canvas.setAttribute('aria-label',`Haven settlement, ${plural(state.zones.length,'patch','patches')} of ${PATCHES.length} cleared round the home clearing, Settlement Lv ${st.level}. ${count('wood')} trees, ${count('stone')} stone and ${count('ore')} ore left. ${state.built.length?'Buildings: '+state.built.map(b=>`${BP[b.t].name} Lv ${b.lv}`).join(', ')+'.':'No buildings yet.'}${state.roads.length?` ${plural(state.roads.length,'road tile')}.`:''}${state.walls.length?` ${plural(state.walls.length,'palisade tile')}.`:''} ${plural(state.workers,'person','people')}, ${state.food} Food.${Object.keys(state.broken).length?` Damaged: ${Object.keys(state.broken).map(t=>BP[t].name).join(', ')}.`:''}${state.raid?` ${RAID_NAME[state.raid]} are attacking.`:''} Tap a tree or deposit, or press Enter, to work it.`);
  workLine();draw();
}
/* The simple view (#140): one suggestion in a box at the top of the town, one big choice at the top of each window,
 * a short line where the long ones were (they're under More), and only the counters and menus Haven needs yet. */
function simple(auto,cap){
  const sug=suggest(state);view.sug=sug;view.sugKey=sug?.key||'';
  const covered=busyBar()||(view.open&&!view.manageBody.hidden)||!view.help.hidden;view.hud.hidden=!sug||covered;
  if(sug&&!covered){view.hudName.textContent=sug.name;view.hudCost.textContent=costLine(sug);
    // Short of something (or told to pick berries): the button becomes Find, which points at the nearest one.
    view.findRes=sug.need?findWhat(state,sug.need):sug.kind==='gather'&&sug.why==='+Food'?'food':null;const find=!!view.findRes;
    view.hudGo.hidden=sug.kind==='gather'&&!find;view.hudGo.textContent=find?'Find':sug.verb;view.hudGo.disabled=!sug.ready&&!find;
    view.hudGo.setAttribute('aria-label',find?`Find the nearest ${view.findRes==='food'?'berry bush':RES_NAME[view.findRes]}. ${sug.name}: ${costLine(sug)}.`:`${sug.verb} ${sug.name}. ${costLine(sug)}.`);drawIcon(view.hudIcon,sug);}
  else view.findRes=null;
  view.picks={build:paneBuild(state,sug),jobs:panePeople(state,sug),defense:defensePick(state)};
  for(const [p,btn] of Object.entries(view.pickBtns))card(btn,view.picks[p]);
  view.manageBody.classList?.toggle('ruins-show-more',view.more);view.moreBtn.textContent=view.more?'Less':view.tab==='jobs'?'More jobs':'More';view.moreBtn.setAttribute('aria-expanded',String(view.more));
  view.peopleShort.textContent=state.workers?`${state.workers} / ${cap} people · ${auto} on Auto`:'No one lives here yet';
  const held=JOBS.filter(j=>state.jobs[j]).map(j=>`${state.jobs[j]} ${JOB_SHORT[j]}`).join(' · ');
  view.jobSum.textContent=!state.workers?'Recruit someone below.':`${held?held+'. ':''}Tap a building to give it workers.`;
  view.defShort.textContent=defShort();
  view.oreBox.hidden=!state.ore&&!state.zones.length&&!has(state,'foundry');
  for(const t of TABS)view.tabs[t.id].btn.hidden=!tabOn(t.id);
  zoomButtons();}
const costLine=sug=>sug.need?`Need ${fmt(sug.need)}`:sug.cost?`${sug.why} · ${fmt(sug.cost)}`:sug.why;
function card(btn,sug){btn.hidden=!sug;if(!sug)return;btn.querySelector('strong').textContent=sug.name;btn.querySelector('small').textContent=sug.why;
  const price=sug.kind==='gather'?'':sug.need?`Need ${fmt(sug.need)}`:sug.cost?`${sug.verb} · ${fmt(sug.cost)}`:sug.verb;
  btn.querySelector('b').textContent=price;btn.disabled=!sug.ready;btn.setAttribute('aria-label',`${sug.name}. ${sug.why}. ${price}.`);drawIcon(btn.querySelector('canvas'),sug);}
// Defense in one line: what's coming (or that it's quiet) against what Haven has.
function defShort(){const d=defense(state).total;if(!raidsOpen(state)&&!state.raid)return`Quiet · Defense ${d}`;
  const k=nextKind(state),th=threat(state,k);
  if(state.raid)return`${RAID_NAME[k]} attacking · Threat ${th} · Defense ${d}`;
  if(state.calm<=warnLead(state))return`${RAID_NAME[k]} in ${mmss(state.calm)} · Threat ${th} · Defense ${d}`;
  return`Quiet · Defense ${d} · next Threat ${th}`;}
/* Small pixel drawings for the suggestion: the real building as it's drawn on the map, a tree for gathering, and an
 * 8×8 sprite at 3× for the rest. Drawn only when what it shows changes. */
const SPRITE={tools:['..SSSS..','..SSSS..','...ww...','...ww...','...ww...','...ww...','...ww...','........'],
  person:['...hh...','...hh...','..cccc..','.hcccch.','..cccc..','..w..w..','..w..w..','........'],
  wall:['w..w..w.','ww.ww.ww','wwwwwwww','ww.ww.ww','wwwwwwww','ww.ww.ww','ww.ww.ww','........'],
  flag:['.kbbbb..','.kbbbbb.','.kbbbb..','.k......','.k......','.k......','gggggggg','........']};
function drawIcon(cv,sug){const ctx=cv?.getContext?.('2d');if(!ctx||!sug)return;const lv=sug.type?(sug.kind==='upgrade'?lvOf(state,sug.type)+1:Math.max(1,lvOf(state,sug.type))):0,k=`${sug.kind}:${sug.type||sug.job}:${lv}`;
  if(cv.dataset.k===k)return;cv.dataset.k=k;const d=Math.min(3,Math.max(1,Math.round(root.devicePixelRatio||1)));
  cv.width=28*d;cv.height=28*d;cv.style.width='28px';cv.style.height='28px';ctx.setTransform?.(d,0,0,d,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,28,28);
  if(sug.type){building(ctx,{w:14,h:7,ox:14,oy:20,a:0},sug.type,0,0,lv);return;}
  if(sug.kind==='gather'){tree(ctx,{w:16,h:8,ox:14,oy:18,a:0},0,0,'pine',.5);return;}
  const rows=SPRITE[sug.kind==='tools'?'tools':sug.kind==='wall'?'wall':sug.kind==='clear'?'flag':'person'],col={S:C.stoneHi,w:C.woodHi,h:'#e0b48a',c:sug.job==='guard'?'#8a8676':'#4f8a5c',k:C.ink,b:C.brass,g:C.grass[1]};
  rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(col[ch]){ctx.fillStyle=col[ch];ctx.fillRect(2+x*3,2+y*3,3,3);}}));}
// One short line under each job: what it does now, from the real numbers.
function jobInfo(j){
  if(JOB_KIND[j]){const kind=JOB_KIND[j],noun=j==='wood'?'trees':j==='stone'?'stone':'ore';return`Hit power ${power(workerPower(state,kind,j))} on ${noun} · Auto ${power(workerPower(state,kind))}`;}
  if(j==='farm')return farmOpen(state)?`${FX.farmYield[on(state,'farm')]} Food a harvest · ${Math.min(state.jobs.farm,farmCap(state))} / ${farmCap(state)} at the Farm · the rest forage berries`
    :has(state,'farm')?'The Farm is damaged · they forage berry bushes':'No Farm yet · they forage berry bushes';
  if(j==='build')return repairing(state).length?`Repairing the ${repairing(state).map(t=>BP[t].name).join(', ')}`:'Repair damaged buildings · gather when nothing needs it';
  if(j==='guard')return`+${CONFIG.guardPower} Defense each · keep watch instead of gathering`;
  return`Raid warning ${CONFIG.warnScoutMs/1000} s sooner each (up to ${CONFIG.warnScouts}) · see into far land`;}
// A Watchtower or a scout shows what grows in far land (patches not yet beside Haven) through the mist.
const sees=s=>on(s,'watchtower')>0||s.jobs.scout>0;
const mmss=ms=>{const t=Math.ceil(ms/1000);return`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};
// The drawer's words: the one next goal, Defense (only what Haven really has) and Land.
function manageText(st){
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
  view.watchText.textContent=wl?`Watchtower · Lv ${wl} (${STAGES[wl-1]})${isBroken(state,'watchtower')?', damaged':''}: ${BP.watchtower.effects[wl-1]}.`:'No Watchtower yet. Build one (Build → Town) for +2 Defense and to see into far land.';
  landLine();
  alertLine();}
// Land in a few words, and Find Next Clearing with the next patch's name and price.
function landLine(){const n=state.zones.length,z=nextClear(state),c=z===null?null:canClear(state,z),b=view.findClear,off=FX.survey[on(state,'survey')];
  view.landShort.textContent=`Home clearing + ${plural(n,'patch','patches')} of ${PATCHES.length} · ${own(state).ids.length} tiles`;
  b.querySelector('small').textContent=z===null?'All the land round Haven is cleared':c.reason==='survey'?`${PATCH[z].name} · needs a Survey Post`:c.ok?`${PATCH[z].name} · shows it on the map`:`${PATCH[z].name} · need ${fmt(c.need)} more`;
  b.querySelector('b').textContent=z===null?'Done':fmt(c.cost);b.disabled=z===null;b.setAttribute('aria-label',`Find Next Clearing. ${b.querySelector('small').textContent}.`);
  view.landText.textContent=`A Clear sign on the map shows what a patch beside Haven costs; a lock is land further out.${sees(state)?' Your Watchtower or scouts show what grows there.':''} Each patch cleared makes the next ${fmt(CONFIG.clearStep)} dearer${off?`, then ${Math.round(off*100)}% off for your Survey Post`:''}.`;}
// The Defense section's first line: when raids start, or the one coming, from the real clock and numbers.
function threatText(){
  if(!raidsOpen(state)){const miss=[!has(state,'house')&&'a House',!has(state,'farm')&&'a Farm',!state.zones.length&&'a cleared patch of land'].filter(Boolean);
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

/* Isometric canvas. The view shows the whole 16×16 map (home clearing, cleared and wild patches) plus a one-tile ring
 * of mist. Tile (c,r) has its top corner at
 * ox+(c−r)·w/2, oy+(c+r−2a)·h/2, where a is the first tile shown and h = w/2. Wider than the screen, the scene scrolls. */
function onResize(){if(!view)return;layout(false);draw();}
/* The town fills the space between the counters and the drawer (ruins-reclaimed.css). Tiles grow until the map is as
 * tall as the room the town has with the open section folded away, up to 44px, and the map pans both ways when it's
 * bigger than its space. So opening a section covers part of the town without shrinking it, and while a building,
 * road or palisade is being placed the tile size stays put, so the tile you aimed at doesn't move. */
/* The menus float over the town, so the town's room is just its own height: opening or closing one never resizes it.
 * Tiles are sized so the home clearing (8×8 and a ring round it) fills that room, as the first territory did; the wild
 * patches round it are there to pan to. */
function townRoom(){return view.scene.clientHeight||0;}
/* Zoom (#140) scales that fitted tile size (base) by view.zoom, to an even size between 20px and 72px. A zoom, a
 * resize or a new territory keeps the point in focus still: the middle of the town's space, or between your fingers. */
function layout(center,focus){
  const cv=view.canvas,sc=view.scene,cw=sc.clientWidth||300,sh=sc.clientHeight||0,V=W+2,old=view.geo;
  const keep=old&&old.V===V&&!center&&!!(view.placing||view.roading||view.walling||view.upgrading||view.clearing!==null),fitH=(townRoom()-16)/(2.1+(HHI-HLO+2)/2);
  const base=keep?old.base:Math.max(24,Math.min(44,Math.floor(Math.max(cw/10.4,fitH||0)/2)*2));
  const w=Math.max(ZMIN,Math.min(ZMAX,Math.round(base*(view.zoom||1)/2)*2)),h=w/2,top=Math.round(w*1.5),cssW=Math.round(V*w+w*.6),cssH=Math.round(top+V*h+w*.6+6),dpr=Math.min(root.devicePixelRatio||1,3);
  const [px,py]=focus||[cw/2,sh/2],offX=o=>Math.max(0,(cw-o.cssW)/2),offY=o=>Math.max(0,(sh-o.cssH)/2);
  const fx=old?((sc.scrollLeft||0)+px-offX(old))/old.cssW:.5,fy=old?((sc.scrollTop||0)+py-offY(old))/old.cssH:.5,same=old&&old.cssW===cssW&&old.cssH===cssH&&old.dpr===dpr;
  if(!same){cv.style.width=cssW+'px';cv.style.height=cssH+'px';cv.width=Math.round(cssW*dpr);cv.height=Math.round(cssH*dpr);}
  view.geo={w,h,base,ox:Math.round(cssW/2),oy:top,a:-1,V,dpr,cssW,cssH};view.size=[cw,sh];
  if(center){sc.scrollLeft=Math.max(0,(cssW-cw)/2);sc.scrollTop=Math.max(0,(cssH-sh)/2);}
  else if(!same){sc.scrollLeft=Math.max(0,fx*cssW+offX(view.geo)-px);sc.scrollTop=Math.max(0,fy*cssH+offY(view.geo)-py);}
}
/* Re-fit only when the town's space really changes size (the phone turns, the drawer folds, the help opens). */
function onSceneResize(){if(!view)return;const sc=view.scene,[w0,h0]=view.size||[0,0];
  if(Math.abs((sc.clientWidth||0)-w0)<2&&Math.abs((sc.clientHeight||0)-h0)<2)return;layout(false);draw();}
const iso=(g,c,r)=>[g.ox+(c-r)*g.w/2,g.oy+(c+r-2*g.a)*g.h/2];
function hit(x,y){
  const g=view.geo;if(!g)return null;
  const u=(x-g.ox)/(g.w/2),v=(y-g.oy)/(g.h/2),c=Math.floor((u+v)/2)+g.a,r=Math.floor((v-u)/2)+g.a,tile=inLand(state,c,r)?wid(c,r):undefined;
  if(view.placing||view.roading||view.walling)return{tile};
  // The signs on wild land sit on top of everything.
  for(const b of view.badges||[])if(Math.abs(x-b.x)<=b.hw&&Math.abs(y-b.y)<=b.hh)return{zone:b.z};
  // Front objects first; a tap on a canopy, rock or roof counts for it.
  // Raiders first (they're rare and worth knowing about), then trees, deposits and buildings, then people.
  for(const p of raiderSpots(performance.now())){const [cx,cy]=iso(g,p.c+.5,p.r+.5);if(Math.abs(x-cx)<=10&&y<=cy+4&&y>=cy-20)return{raider:p};}
  const objs=[...standingIds(state).map(id=>({node:id,id})),...state.built.map(b=>({building:b,id:wid(b.c,b.r)}))].sort((p,q)=>depth(q.id)-depth(p.id));
  // Zoomed out, a tree or rock still takes a finger: at least 24px wide and 28px tall (#145).
  const hw=Math.max(g.w*.4,12),up=Math.max(g.w*1.3,28),dn=Math.max(g.h*.5,6);
  for(const o of objs){const [cx,cy]=iso(g,o.id%W+.5,Math.floor(o.id/W)+.5);if(Math.abs(x-cx)<=hw&&y<=cy+dn&&y>=cy-up)return o;}
  if(state.workers>0)for(const w of crew){const [wc,wr]=crewPosition(w,!reduced(),state),[cx,cy]=iso(g,wc+.5,wr+.5);if(Math.abs(x-cx)<=8&&y<=cy+3&&y>=cy-18)return{person:w};}
  if(tile!==undefined)return{tile};const z=zoneAt(c,r);return z>0?{wild:z}:null;
}
function poly(ctx,pts,fill){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function diamond(ctx,g,c,r,fill,edge){const a=iso(g,c,r),b=iso(g,c+1,r),d=iso(g,c+1,r+1),e=iso(g,c,r+1);poly(ctx,[a,b,d,e],fill);if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}}
// A rectangle of ground from (c0,r0) to (c1,r1) in tile units, drawn flat.
function patch(ctx,g,c0,r0,c1,r1,fill){poly(ctx,[iso(g,c0,r0),iso(g,c1,r0),iso(g,c1,r1),iso(g,c0,r1)],fill);}
// A box standing on the ground at (x,y), half-width hw (px along x), height ht. Top, left and right faces.
function box(ctx,x,y,hw,ht,top,left,right){const hh=hw/2;poly(ctx,[[x-hw,y],[x,y+hh],[x,y+hh-ht],[x-hw,y-ht]],left);poly(ctx,[[x+hw,y],[x,y+hh],[x,y+hh-ht],[x+hw,y-ht]],right);poly(ctx,[[x,y-hh-ht],[x+hw,y-ht],[x,y+hh-ht],[x-hw,y-ht]],top);}
/* Haven's palette. The town reads at phone size: grass a few steps lighter than the forest around it, a packed-earth
 * footprint under every building, trees, rocks and people with a dark one-pixel outline so they stand off the grass. */
const C={grass:['#3b6c43','#42764a','#36633e'],grassHi:'#5a9358',grassLo:'#2c5535',edge:'#2f5a37',bloom:['#e8d27a','#d9a0c8','#f2efe0'],dirtL:'#5a4330',dirtR:'#3e2f22',dirtLip:'#6f5a3e',
  lot:'#6b5c42',lotEdge:'#8c7856',lotLo:'#584b36',ink:'#0c1a12',stone:'#8a8676',stoneHi:'#b9b29b',stoneLo:'#5d5b51',faint:'#566553',moss:'#4a7d52',trunk:'#5a3d26',pine:['#1d5236','#286a45','#3a8a57'],oak:['#24603a','#337a49','#56a05c'],bush:['#2f6a3d','#46894f'],berry:'#c8465a',
  valid:'rgba(159,216,192,.3)',validEdge:'#9fd8c0',pick:'rgba(248,220,136,.55)',pickEdge:'#ffe8af',nope:'rgba(214,72,62,.6)',nopeEdge:'#ff9a8a',brass:'#d6bd81',roof:'#6e3f2e',roofHi:'#8b5440',wood:'#7a5534',woodHi:'#9a7048',lantern:'#f3c46a',ore:['#4a4452','#655c70','#342f3c'],vein:'#e09a46',veinHi:'#8fd6c9',mist:'#0d1d22',plot:'rgba(248,220,136,.22)',plotEdge:'#f8dc88',road:'#6f5c40',roadHi:'#86714f',roadEdge:'#4d3f2c',
  // Haven 4: cleared patches a shade darker than the home clearing; wild land dark and overgrown; the worn footpath.
  grassP:['#37663f','#3d6f45','#335e3b'],wild:['#1f3b2b','#22412f','#1c3727'],wildFar:['#172d22','#1a3226','#152a1f'],wildEdge:'#142a20',
  brush:['#24452f','#2c5236','#1b3524'],brushHi:'#3d6a46',pathDirt:'#6b5a3e',pathHi:'#7d6a4a'};
// Chip colours for a hit on each kind: bark and leaves, leaves and berries, stone, ore with its glint.
const CHIPS={pine:['#9a7a52',C.pine[2],'#c9a878'],oak:['#9a7a52',C.oak[2],'#c9a878'],bush:[C.bush[1],C.berry,'#7fb86a'],stone:[C.stoneHi,C.stone,'#d8d2bc'],ore:[C.ore[1],C.vein,C.veinHi]};
/* Upgrade stages change the look in place: Lv 1 is Haven 2.0's makeshift look (unchanged); Lv 2 is timber on a timber
 * deck with a brass pennant; Lv 3 is dressed stone with a slate roof and corner stones. */
const STAGE_LOOK=[null,
  {plinth:[C.stoneHi,C.stone,C.stoneLo],ph:.08,roof:C.roof,roofHi:C.roofHi,wood:C.wood,woodHi:C.woodHi,woodLo:'#5c4128',wall:'#8a7a62'},
  {plinth:[C.woodHi,C.wood,'#5c4128'],ph:.1,roof:'#7c4527',roofHi:'#a35d34',wood:'#8a5f38',woodHi:'#b08050',woodLo:'#674529',wall:'#a99272'},
  {plinth:['#bdb6a0','#8d887a','#5f5c52'],ph:.15,roof:'#3d4a58',roofHi:'#566a7c',wood:'#8d887a',woodHi:'#bdb6a0',woodLo:'#5f5c52',wall:'#a7a08a'}];

function draw(now){
  if(!view?.geo)return;const g=view.geo,ctx=view.canvas.getContext('2d');if(!ctx)return;now=now||performance.now();
  ctx.setTransform(g.dpr,0,0,g.dpr,0,0);ctx.clearRect(0,0,g.cssW,g.cssH);
  const wd=world(state.origin),gone=goneSet(state),o=own(state),smooth=!reduced(),roads=new Set(state.roads);
  anims=anims.filter(a=>now-a.t0<a.life);
  // A patch being cleared still looks wild until the sweep has passed each of its tiles, from its back corner to its front.
  const sweep=anims.find(a=>a.type==='clear'),sk=sweep?(now-sweep.t0)/sweep.life:1;
  const swept=id=>{if(!sweep||ZONE[id]!==sweep.z)return true;const p=PATCH[sweep.z];return sk>=(id%W-p.c0+Math.floor(id/W)-p.r0+1)/(2*P4-1);};
  const mine=id=>o.tiles.has(id)&&swept(id),open=new Set(openZones(state)),watch=sees(state);
  // How high each tile is drawn: 2 the home clearing, 1 a cleared patch, 0 wild land and the mist beyond the map.
  const lvl=(c,r)=>{if(c<0||r<0||c>=W||r>=W)return 0;const id=wid(c,r);return mine(id)?(ZONE[id]===0?2:1):0;};
  // Wild land first: dark, overgrown ground, a little lighter where a patch can be cleared now than further out.
  for(let r=g.a;r<g.a+g.V;r++)for(let c=g.a;c<g.a+g.V;c++){if(lvl(c,r))continue;const z=zoneAt(c,r);
    if(z<0){ctx.globalAlpha=.85;diamond(ctx,g,c,r,C.mist,'#16302f');ctx.globalAlpha=1;continue;}
    const sh=wd.shade(wid(c,r));diamond(ctx,g,c,r,(open.has(z)||sweep?.z===z?C.wild:C.wildFar)[Math.floor(sh*3)],C.wildEdge);}
  // Then Haven's land: the cleared patches, then the raised home clearing, back to front, each tile with an earth face
  // where it steps down to lower ground in front of it (deeper where the home clearing meets wild land).
  const stepH=Math.max(3,Math.round(g.w*.2)),nearHearth=id=>AROUND.some(([dc,dr])=>wid(id%W+dc,Math.floor(id/W)+dr)===HEARTH);
  for(const L of [1,2])for(let d=0;d<=2*(W-1);d++)for(let c=Math.max(0,d-W+1);c<=Math.min(W-1,d);c++){const r=d-c;if(lvl(c,r)!==L)continue;const id=wid(c,r),sh=wd.shade(id);
    if(wd.rubble.has(id))diamond(ctx,g,c,r,C.lot,C.lotEdge);
    else if(buildingAt(state,id))lot(ctx,g,c,r);
    else{diamond(ctx,g,c,r,(L===2?C.grass:C.grassP)[Math.floor(sh*3)],C.edge);if(!roads.has(id)){if(wd.path.has(id))footpath(ctx,g,c,r,sh);else tuft(ctx,g,c,r,sh,nearHearth(id));}}
    if(roads.has(id))roadTile(ctx,g,c,r,roads,sh);
    const dl=L-lvl(c,r+1),dr=L-lvl(c+1,r);
    if(dl>0)face(ctx,iso(g,c,r+1),iso(g,c+1,r+1),dl*stepH,C.dirtL);if(dr>0)face(ctx,iso(g,c+1,r+1),iso(g,c+1,r),dr*stepH,C.dirtR);}
  // The patch whose Clear bar is open, and the one Find Next Clearing points at, have a gold edge.
  const ring=(z,a)=>{ctx.globalAlpha=a;for(const id of PATCH[z].tiles)diamond(ctx,g,id%W,Math.floor(id/W),'rgba(248,220,136,.16)',C.pickEdge);ctx.globalAlpha=1;};
  if(view.clearing!==null)ring(view.clearing,1);
  for(const a of anims)if(a.type==='findzone'){const k=(now-a.t0)/a.life;ring(a.z,Math.max(0,Math.min(1,(1-k)*3))*(smooth?.55+.45*Math.sin(now/140):1));}
  // What's selected, on the ground: the tree or deposit you're working, or the building whose bar is open.
  if(view.selected!==null&&standing(state,view.selected))diamond(ctx,g,view.selected%W,Math.floor(view.selected/W),'rgba(248,220,136,.22)',C.pickEdge);
  const chosen=view.upgrading?state.built.find(x=>x.t===view.upgrading):null;if(chosen)diamond(ctx,g,chosen.c,chosen.r,'rgba(248,220,136,.3)',C.pickEdge);
  // Lit tiles while placing a building or laying road: pale green where it can go, gold on the tile you picked.
  if(view.placing||view.roading||view.walling)for(const id of view.sites){const on=id===view.site;diamond(ctx,g,id%W,Math.floor(id/W),on?C.pick:C.valid,on?C.pickEdge:C.validEdge);}
  // A tile that can't take it blinks red.
  for(const a of anims)if(a.type==='nope'){ctx.globalAlpha=Math.max(0,1-(now-a.t0)/a.life);diamond(ctx,g,a.c,a.r,C.nope,C.nopeEdge);ctx.globalAlpha=1;}
  // Objects back to front
  const objs=[],shaking=new Map(anims.filter(a=>a.type==='shake').map(a=>[a.id,a])),sprouting=new Map(anims.filter(a=>a.type==='sprout').map(a=>[a.id,a])),falling=anims.filter(a=>a.type==='fall'),walls=new Set(state.walls);
  for(const n of wd.nodes.values()){const id=n.id,sh=wd.shade(id);
    // In wild land a node is only a dim shape: clear the patch to work it. Beside Haven you can see what grows; further
    // out only with a Watchtower or scouts.
    if(!mine(id)){const a=open.has(n.zone)||sweep?.z===n.zone?.6:watch?.45:0;if(a)objs.push([n.c+n.r,()=>{ctx.globalAlpha=a;node(ctx,g,n,sh,0);ctx.globalAlpha=1;}]);continue;}
    if(!gone.has(id)){const s=shaking.get(id),dx=s&&smooth?Math.round(Math.sin((now-s.t0)/s.life*Math.PI*4)*2):0,sp=sprouting.get(id);
      if(sp){const k=Math.max(0,Math.min(1,(now-sp.t0)/sp.life)),z=k<.75?.3+.8*easeOut(k/.75):1.1-.1*((k-.75)/.25),[bx,by]=iso(g,n.c+.5,n.r+.5);
        objs.push([n.c+n.r,()=>{ctx.save();ctx.translate(bx,by);ctx.scale(z,z);ctx.translate(-bx,-by);node(ctx,g,n,sh,0);ctx.restore();}]);}
      else objs.push([n.c+n.r,()=>node(ctx,g,n,sh,dx)]);}
    else if(!buildingAt(state,id)&&!roads.has(id)&&!walls.has(id))objs.push([n.c+n.r-.1,()=>remains(ctx,g,n)]);}
  for(const id of walls){const c=id%W,r=Math.floor(id/W);objs.push([c+r+.01,()=>palisade(ctx,g,c,r,walls)]);}
  for(const f of falling){const n=wd.nodes.get(f.id);if(n)objs.push([n.c+n.r,()=>fallingTree(ctx,g,n.c,n.r,n.kind,wd.shade(n.id),(now-f.t0)/f.life,f.dir)]);}
  for(const id of wd.rubble){const c=id%W,r=Math.floor(id/W);objs.push([c+r,()=>hearth(ctx,g,c,r,now,smooth)]);}
  // A lantern on a post where the footpath leaves the home clearing (nothing to tap; gone if something is built there).
  {const end=FOOTPATH[FOOTPATH.length-1];if(!buildingAt(state,end)&&!roads.has(end)&&!walls.has(end))objs.push([end%W+Math.floor(end/W)+.04,()=>lanternPost(ctx,g,end%W,Math.floor(end/W),now,smooth)]);}
  const raise=anims.find(a=>a.type==='raise'),banner=settlement(state).level>=20;
  for(const b of state.built)objs.push([b.c+b.r+.02,()=>{if(raise&&raise.t===b.t)raising(ctx,g,b,(now-raise.t0)/raise.life,banner);else building(ctx,g,b.t,b.c,b.r,b.lv,banner);
    if(isBroken(state,b.t))damaged(ctx,g,b.c,b.r,state.broken[b.t],now,smooth);}]);
  if(view.placing&&view.site!==null){const c=view.site%W,r=Math.floor(view.site/W);objs.push([c+r+.03,()=>{ctx.globalAlpha=.78;building(ctx,g,view.placing,c,r,1);ctx.globalAlpha=1;}]);}
  // Add Palisade: a see-through preview of the tile Haven picked, joined to the palisade already there.
  if(view.walling==='auto'&&view.site!==null){const c=view.site%W,r=Math.floor(view.site/W),with_=new Set([...walls,view.site]);objs.push([c+r+.03,()=>{ctx.globalAlpha=.7;palisade(ctx,g,c,r,with_);ctx.globalAlpha=1;}]);}
  // Wild land is overgrown: low dark brush on every tile with nothing showing (only a picture: it can't be tapped or
  // gathered, and clearing a patch sweeps it away), and the dark shapes of the forest beyond the map.
  for(let r=g.a;r<g.a+g.V;r++)for(let c=g.a;c<g.a+g.V;c++){if(lvl(c,r))continue;const z=zoneAt(c,r),id=wid(c,r),sh=wd.shade(id);
    if(z<0){if(sh<.55)objs.push([c+r,()=>{ctx.globalAlpha=.32;tree(ctx,g,c,r,sh<.3?'pine':'oak',sh);ctx.globalAlpha=1;}]);continue;}
    const n=wd.nodes.get(id),shown=n&&(open.has(z)||sweep?.z===z||watch);if(shown)continue;
    objs.push([c+r-.05,()=>brush(ctx,g,c,r,sh,!open.has(z)&&sweep?.z!==z)]);
    if(sh<.3&&!open.has(z))objs.push([c+r,()=>{ctx.globalAlpha=.3;tree(ctx,g,c,r,'pine',sh);ctx.globalAlpha=1;}]);}
  if(state.workers>0)for(const w of crew){const [wc,wr]=crewPosition(w,smooth,state);objs.push([wc+wr+.05,()=>worker(ctx,g,w,wc,wr,now,smooth)]);}
  for(const p of raiderSpots(now))objs.push([p.c+p.r+.06,()=>raider(ctx,g,p,now,smooth)]);
  objs.sort((a,b)=>a[0]-b[0]).forEach(o=>o[1]());
  // The building whose bar is open gets a small gold pointer above its roof; so does the tile picked for a new one.
  if(chosen)pointer(ctx,g,chosen.c,chosen.r,TALL[chosen.t]?.[chosen.lv]||1.1,now,smooth);
  if(view.placing&&view.site!==null)pointer(ctx,g,view.site%W,Math.floor(view.site/W),TALL[view.placing]?.[1]||1.1,now,smooth);
  if(view.walling==='auto'&&view.site!==null)pointer(ctx,g,view.site%W,Math.floor(view.site/W),.8,now,smooth);
  // Find: a pointer over the node, and its tile's gold edge pulses (steady with reduced motion) until it fades.
  for(const a of anims)if(a.type==='find'&&standing(state,a.id)){const n=wd.nodes.get(a.id),k=(now-a.t0)/a.life;if(!n)continue;
    ctx.globalAlpha=Math.max(0,Math.min(1,(1-k)*3))*(smooth?.55+.45*Math.sin(now/140):1);diamond(ctx,g,n.c,n.r,'rgba(248,220,136,.35)',C.pickEdge);ctx.globalAlpha=1;
    pointer(ctx,g,n.c,n.r,isWood(n.kind)&&n.kind!=='bush'?1.5:.85,now,smooth);}
  // Clearing: as the sweep passes each tile, a few leaves and twigs of brush fly up and fade.
  if(sweep&&smooth){const p=PATCH[sweep.z];for(const id of p.tiles){const t=(id%W-p.c0+Math.floor(id/W)-p.r0+1)/(2*P4-1),k=(sk-t)/.3;if(k<0||k>=1)continue;
    const [x,y]=iso(g,id%W+.5,Math.floor(id/W)+.5),v=wd.shade(id);ctx.globalAlpha=1-k;
    for(let j=0;j<4;j++){ctx.fillStyle=C.brush[j%3];ctx.fillRect(Math.round(x+(j-1.5)*g.w*.16+v*4),Math.round(y-g.w*.1-k*g.w*.6-(j%2)*3),3,3);}ctx.globalAlpha=1;}}
  signs(ctx,g,open,sweep);
  // Work bars over nodes that have been started
  for(const [k,left] of Object.entries(state.hp)){const n=wd.nodes.get(Number(k));if(!n)continue;const max=CONFIG.kinds[n.kind].hp,[x,y]=iso(g,n.c+.5,n.r+.5),bw=Math.round(g.w*.6),bx=Math.round(x-bw/2),by=Math.round(y-g.w*(n.kind==='stone'||n.kind==='ore'||n.kind==='bush'?.62:1.35));
    ctx.fillStyle='#000c';ctx.fillRect(bx-1,by-1,bw+2,6);ctx.fillStyle='#3a2f20';ctx.fillRect(bx,by,bw,4);ctx.fillStyle=Number(k)===view.selected?'#ffe8af':C.brass;ctx.fillRect(bx,by,Math.max(1,Math.round(bw*left/max)),4);
    // Your swing: a thin line under the bar that fills until you can hit again.
    const sw=anims.find(a=>a.type==='swing'&&a.id===Number(k));if(sw){ctx.fillStyle='#000c';ctx.fillRect(bx-1,by+5,bw+2,3);ctx.fillStyle='#9fd8c0';ctx.fillRect(bx,by+6,Math.max(1,Math.round(bw*Math.min(1,(now-sw.t0)/sw.life))),1);}}
  // Chips and floating rewards
  for(const a of anims){if(now<a.t0)continue;const k=Math.min(1,(now-a.t0)/a.life),[x,y]=iso(g,a.c+.5,a.r+.5);
    // A hit: five chips fly up and drop, in the node's own colours (bark and leaves, berries, stone, ore and its glint).
    if(a.type==='chips'){const cs=a.colors||[a.color];ctx.globalAlpha=1-k;for(let j=0;j<5;j++){const ang=-Math.PI*(.15+j*.17),d=3+k*g.w*.4;ctx.fillStyle=cs[j%cs.length];ctx.fillRect(Math.round(x+Math.cos(ang)*d)-1,Math.round(y-g.w*.35+Math.sin(ang)*d+k*k*8)-1,3,3);}ctx.globalAlpha=1;}
    // Stone or ore finished: the rock breaks into eight chunks that tumble out and settle.
    if(a.type==='crumble'){const cs=a.colors,e=easeOut(k);ctx.globalAlpha=Math.max(0,1-k*k);for(let j=0;j<8;j++){const ang=Math.PI*(j/8)*2+.3,d=2+e*g.w*.32,s=j%3?3:4;
        ctx.fillStyle=cs[j%cs.length];ctx.fillRect(Math.round(x+Math.cos(ang)*d)-1,Math.round(y-g.w*.18+Math.sin(ang)*d*.5-Math.sin(k*Math.PI)*6+k*k*6)-1,s,s);}ctx.globalAlpha=1;}
    // Grown back: four small green pixels rise from it.
    if(a.type==='sprout'){ctx.globalAlpha=Math.max(0,1-k);ctx.fillStyle='#9be07a';for(let j=0;j<4;j++)ctx.fillRect(Math.round(x+(j-1.5)*g.w*.14),Math.round(y-g.w*(.2+k*.5)-(j%2)*4),2,2);ctx.globalAlpha=1;}
    // A suggestion done: eight chunky gold pixels burst out from where it happened.
    if(a.type==='ack'){const e=easeOut(k),R=Math.round;ctx.globalAlpha=Math.max(0,1-k*k);ctx.fillStyle='#f8dc88';
      for(let j=0;j<8;j++){const ang=j*Math.PI/4,d=4+e*g.w*.8;ctx.fillRect(R(x+Math.cos(ang)*d)-2,R(y-g.w*.5+Math.sin(ang)*d*.6)-2,4,4);}ctx.globalAlpha=1;}
    if(a.type==='pop'){const lift=smooth?easeOut(k)*20:0;ctx.globalAlpha=Math.max(0,1-k*k);ctx.font='bold 13px Georgia,serif';ctx.textAlign='center';ctx.fillStyle='#000a';ctx.fillText(a.text,x+1,y-g.w*.9-lift+1);ctx.fillStyle=a.worker?'#9fd8c0':C.brass;ctx.fillText(a.text,x,y-g.w*.9-lift);ctx.globalAlpha=1;}}
}
// Feedback for one hit: a shake and chips; a finished node tips over or crumbles, and its reward floats up.
function struck(id,res,byWorker){const now=performance.now(),c=id%W,r=Math.floor(id/W),smooth=!reduced(),wood=isWood(res.kind);
  const colors=CHIPS[res.kind]||[C.stoneHi];
  if(smooth){anims.push({type:'shake',id,t0:now,life:180});anims.push({type:'chips',c,r,colors,t0:now,life:360});}
  if(!res.done)return;
  if(smooth&&!wood)anims.push({type:'crumble',c,r,colors,t0:now,life:460});
  if(smooth&&wood){const w=byWorker?crew.find(x=>Math.abs(x.c-c)<=1&&Math.abs(x.r-r)<=1):null;anims.push({type:'fall',id,t0:now,life:420,dir:w&&w.c-w.r>c-r?-1:1});}
  anims.push({type:'pop',c,r,text:'+'+RES.filter(k=>res.gain[k]).map(k=>`${res.gain[k]} ${RES_NAME[k]}`).join(' +'),worker:byWorker,t0:smooth&&wood?now+300:now,life:smooth?850:1100});
  if(res.regrown!==null&&res.regrown!==undefined)regrown(res.regrown,now+400);}
// Something grew back: show it, and start the play-time count-down again so two don't come back close together.
function regrown(id,t0){regrowClock.left=CONFIG.regrowMs;if(!reduced())anims.push({type:'sprout',id,c:id%W,r:Math.floor(id/W),t0,life:520});anims.push({type:'pop',c:id%W,r:Math.floor(id/W),text:'Regrown',worker:true,t0,life:1100});}

/* Roads join up by themselves: a square of packed earth in the middle of the tile and a strip towards every
 * neighbouring road or building, so straight runs, bends and crossings all come out right. */
function roadTile(ctx,g,c,r,roads,v){const joins=id=>roads.has(id)||!!buildingAt(state,id);
  patch(ctx,g,c+.28,r+.28,c+.72,r+.72,C.road);
  if(c+1<W&&joins(wid(c+1,r)))patch(ctx,g,c+.5,r+.28,c+1,r+.72,C.road);if(c>0&&joins(wid(c-1,r)))patch(ctx,g,c,r+.28,c+.5,r+.72,C.road);
  if(r+1<W&&joins(wid(c,r+1)))patch(ctx,g,c+.28,r+.5,c+.72,r+1,C.road);if(r>0&&joins(wid(c,r-1)))patch(ctx,g,c+.28,r,c+.72,r+.5,C.road);
  const [x,y]=iso(g,c+.5,r+.5);ctx.fillStyle=C.roadHi;ctx.fillRect(Math.round(x-g.w*.12+v*4),Math.round(y-1),2,2);ctx.fillRect(Math.round(x+g.w*.08-v*3),Math.round(y+2),2,2);ctx.fillStyle=C.roadEdge;ctx.fillRect(Math.round(x-2+v*6),Math.round(y-g.h*.2),2,1);}
// A building's lot: packed earth with a lighter rim and a few flagstones, so every building sits on its own grid tile.
function lot(ctx,g,c,r){diamond(ctx,g,c,r,C.lot,C.lotEdge);const [x,y]=iso(g,c+.5,r+.5),w=g.w,R=Math.round;ctx.fillStyle=C.lotLo;
  ctx.fillRect(R(x-w*.3),R(y+w*.04),3,2);ctx.fillRect(R(x+w*.22),R(y+w*.06),3,2);ctx.fillRect(R(x-w*.04),R(y+w*.16),4,2);}
// A few blades of grass and, on some tiles (and always round the hearth), a flower: fixed per tile, so nothing flickers.
function tuft(ctx,g,c,r,v,bloom=false){const [x,y]=iso(g,c+.5,r+.5),w=g.w,R=Math.round,k=Math.floor(v*997)%9,ox=((k*7)%5-2)*w*.06,oy=((k*3)%3-1)*w*.04;
  ctx.fillStyle=C.grassHi;ctx.fillRect(R(x+ox-w*.16),R(y+oy-1),1,2);ctx.fillRect(R(x+ox-w*.14),R(y+oy-2),1,3);ctx.fillRect(R(x+ox+w*.12),R(y-oy+2),1,2);
  ctx.fillStyle=C.grassLo;ctx.fillRect(R(x-ox+w*.02),R(y+oy+w*.12),2,1);
  if(k<2||bloom){ctx.fillStyle=C.bloom[(k+Math.floor(v*31))%3];ctx.fillRect(R(x-ox+w*.18),R(y-oy-w*.04),2,2);}
  if(bloom){ctx.fillStyle=C.bloom[(k+1)%3];ctx.fillRect(R(x+ox-w*.2),R(y+oy+w*.02),2,2);}}
// A small gold pointer floating over what's picked.
const TALL={townhall:[0,1.3,1.6,1.9],watchtower:[0,1.5,1.7,1.9],survey:[0,1.8,1.8,1.8],yard:[0,1.45,1.45,1.45]};
function pointer(ctx,g,c,r,up,now,smooth){const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0-g.w*up)+(smooth?Math.round(Math.sin(now/260)*1.5):0);
  poly(ctx,[[x-6,y-8],[x+6,y-8],[x,y+1]],C.ink);poly(ctx,[[x-4,y-7],[x+4,y-7],[x,y-1]],C.brass);ctx.fillStyle=C.pickEdge;ctx.fillRect(x-3,y-7,3,1);}
function node(ctx,g,n,v,dx){if(isWood(n.kind)){tree(ctx,g,n.c,n.r,n.kind,v,dx);return;}
  const [x0,y0]=iso(g,n.c+.5,n.r+.5),x=Math.round(x0+(v-.5)*4)+dx,y=Math.round(y0),w=g.w;ctx.fillStyle='#0005';ctx.fillRect(x-w*.3,y-2,w*.6,4);
  // A dark rim round each rock, so stone and ore stand off the grass.
  const rim=(bx,by,hw,ht)=>box(ctx,bx,by+1,hw+1.5,ht+2,C.ink,C.ink,C.ink);
  if(n.kind==='stone'){rim(x-Math.round(w*.08),y,w*.2,w*.2);rim(x+Math.round(w*.14),y+2,w*.13,w*.13);rim(x-Math.round(w*.02),Math.round(y-w*.2),w*.1,w*.1);box(ctx,x-Math.round(w*.08),y,w*.2,w*.2,C.stoneHi,C.stone,C.stoneLo);box(ctx,x+Math.round(w*.14),y+2,w*.13,w*.13,C.stoneHi,C.stone,C.stoneLo);box(ctx,x-Math.round(w*.02),Math.round(y-w*.2),w*.1,w*.1,'#b8b19a',C.stone,C.stoneLo);return;}
  const o=C.ore;rim(x,y,w*.24,w*.26);rim(x+Math.round(w*.16),y+2,w*.12,w*.14);box(ctx,x,y,w*.24,w*.26,o[1],o[0],o[2]);box(ctx,x+Math.round(w*.16),y+2,w*.12,w*.14,o[1],o[0],o[2]);
  ctx.fillStyle=C.vein;ctx.fillRect(x-Math.round(w*.14),Math.round(y-w*.2),3,3);ctx.fillRect(x+Math.round(w*.06),Math.round(y-w*.12),3,3);ctx.fillRect(x-Math.round(w*.04),Math.round(y-w*.32),3,2);ctx.fillStyle=C.veinHi;ctx.fillRect(x+Math.round(w*.1),Math.round(y-w*.26),2,2);}
function remains(ctx,g,n){const [x,y]=iso(g,n.c+.5,n.r+.5),w=g.w;
  if(isWood(n.kind)){if(n.kind==='bush')return;ctx.fillStyle=C.trunk;ctx.fillRect(Math.round(x-w*.07),Math.round(y-w*.1),Math.round(w*.14),Math.round(w*.1));ctx.fillStyle='#9a7a52';ctx.fillRect(Math.round(x-w*.07),Math.round(y-w*.12),Math.round(w*.14),3);return;}
  ctx.fillStyle=n.kind==='ore'?C.ore[0]:C.stoneLo;ctx.fillRect(Math.round(x-w*.16),Math.round(y-2),4,3);ctx.fillRect(Math.round(x+w*.06),Math.round(y),4,3);ctx.fillRect(Math.round(x-w*.02),Math.round(y-w*.08),3,2);}
// The earth face of a step down: from edge a→b of a tile, d pixels deep, with a grassy lip and a darker foot.
function face(ctx,a,b,d,fill){poly(ctx,[a,b,[b[0],b[1]+d],[a[0],a[1]+d]],fill);poly(ctx,[[a[0],a[1]+d*.6],[b[0],b[1]+d*.6],[b[0],b[1]+d],[a[0],a[1]+d]],'#0003');
  ctx.beginPath();ctx.moveTo(a[0],a[1]+1);ctx.lineTo(b[0],b[1]+1);ctx.strokeStyle=C.grassLo;ctx.lineWidth=2;ctx.stroke();}
// The worn footpath from the hearth to the edge of the home clearing: a strip of bare earth with a few pebbles.
function footpath(ctx,g,c,r,v){patch(ctx,g,c+.32,r,c+.68,r+1,C.pathDirt);patch(ctx,g,c+.4,r+.1,c+.6,r+.9,C.pathHi);
  const [x,y]=iso(g,c+.5,r+.5),R=Math.round;ctx.fillStyle=C.lotLo;ctx.fillRect(R(x-g.w*.1+v*4),R(y-1),2,2);ctx.fillRect(R(x+g.w*.08-v*3),R(y+2),2,1);}
// The hearth in the middle of the home clearing: a ring of stones round a small fire, and a little banner on a pole.
// Only a picture: it can't be tapped, built on or walked through.
function hearth(ctx,g,c,r,now,smooth){const [x0,y0]=iso(g,c+.5,r+.5),x=Math.round(x0),y=Math.round(y0),w=g.w,R=Math.round,f=smooth?Math.floor(now/160)%3:0;
  ctx.globalAlpha=.18;diamond(ctx,g,c,r,C.lantern);ctx.globalAlpha=1;
  for(let j=0;j<8;j++){const a=j*Math.PI/4,sx=R(x+Math.cos(a)*w*.22),sy=R(y+Math.sin(a)*w*.11);ctx.fillStyle=C.ink;ctx.fillRect(sx-2,sy-2,5,4);ctx.fillStyle=j%2?C.stone:C.stoneHi;ctx.fillRect(sx-1,sy-1,3,2);}
  ctx.fillStyle=C.trunk;ctx.fillRect(R(x-w*.12),y-1,R(w*.24),2);
  ctx.fillStyle='#e0702e';ctx.fillRect(x-3,y-5-(f===1?1:0),6,4);ctx.fillStyle=C.lantern;ctx.fillRect(x-2+(f===2?1:0),y-8-(f===0?1:0),3,4);ctx.fillStyle='#fff3c4';ctx.fillRect(x-1,y-5,1,2);
  const px=R(x-w*.36),py=R(y-w*.1);ctx.fillStyle=C.ink;ctx.fillRect(px-1,py-R(w*.9)-1,3,R(w*.9)+2);ctx.fillStyle=C.wood;ctx.fillRect(px,py-R(w*.9),1,R(w*.9));
  ctx.fillStyle='#7a2b2b';ctx.fillRect(px+1,py-R(w*.9),R(w*.24),R(w*.14));ctx.fillStyle=C.brass;ctx.fillRect(px+1,py-R(w*.9)+R(w*.14)-2,R(w*.24),2);}
// A lantern on a post, glowing softly.
function lanternPost(ctx,g,c,r,now,smooth){const [x0,y0]=iso(g,c+.72,r+.72),x=Math.round(x0),y=Math.round(y0),h=Math.round(g.w*.55),glow=smooth?.25+.1*Math.sin(now/300):.3;
  ctx.fillStyle=C.ink;ctx.fillRect(x-2,y-h-1,4,h+2);ctx.fillStyle='#5c4128';ctx.fillRect(x-1,y-h,2,h);ctx.fillStyle=C.ink;ctx.fillRect(x-3,y-h-5,7,6);ctx.fillStyle=C.lantern;ctx.fillRect(x-2,y-h-4,5,4);
  ctx.globalAlpha=glow;ctx.fillStyle=C.lantern;ctx.fillRect(x-5,y-h-7,11,10);ctx.globalAlpha=1;}
// Brush on wild land: a few low dark clumps, darker further out. Only a picture, never something to gather.
function brush(ctx,g,c,r,v,far){const [x0,y0]=iso(g,c+.5,r+.5),w=g.w,R=Math.round,k=Math.floor(v*991);
  for(let j=0;j<3;j++){const dx=((k>>j)%5-2)*w*.09+(j-1)*w*.2,dy=((k>>(j+2))%3-1)*w*.05+(j===1?-w*.06:w*.03),bw=R(w*(.16+((k>>j)%3)*.04)),bh=R(w*.1)+2,x=R(x0+dx),y=R(y0+dy);
    ctx.fillStyle=C.ink;ctx.fillRect(x-(bw>>1)-1,y-bh-1,bw+2,bh+2);ctx.fillStyle=C.brush[(j+k)%3];ctx.fillRect(x-(bw>>1),y-bh,bw,bh);
    if(!far&&j===1){ctx.fillStyle=C.brushHi;ctx.fillRect(x-(bw>>1)+1,y-bh,Math.max(2,bw>>1),2);}}
  if(far){ctx.globalAlpha=.3;diamond(ctx,g,c,r,C.mist);ctx.globalAlpha=1;}}
/* The signs on wild land (#144). A patch beside Haven: a Clear sign with its price (Wood and Stone icons), gold when
 * you can pay, the missing amount in red when not; on small screens only the icons and numbers. A patch further out,
 * or one waiting on a Survey Post: a small lock. Each sign stays on its patch while you pan and zoom, and takes a tap
 * of at least 44 by 36 pixels. Hidden while you place something, so a tap on a tile always reaches the tile. */
function signs(ctx,g,open,sweep){view.badges=[];if(view.placing||view.roading||view.walling)return;
  const compact=g.w<34||(view.size?.[0]||400)<=360,tw=t=>ctx.measureText?.(t)?.width??t.length*7;ctx.font='bold 12px Georgia,serif';ctx.textAlign='left';ctx.textBaseline='middle';
  for(const p of PATCHES){if(state.zones.includes(p.id)||sweep?.z===p.id)continue;const [x0,y0]=iso(g,p.c0+P4/2,p.r0+P4/2),x=Math.round(x0),y=Math.round(y0-g.w*.3);
    const c=open.has(p.id)?canClear(state,p.id):{ok:false,reason:'far'},lock=c.reason==='far'||c.reason==='survey',hot=view.clearing===p.id;
    if(lock){const bw=22,bh=20,bx=x-bw/2,by=y-bh/2;plate(ctx,bx,by,bw,bh,hot?C.pickEdge:'#4f8a5c');
      ctx.fillStyle=LCD[4];ctx.fillRect(x-3,by+4,6,2);ctx.fillRect(x-4,by+5,2,5);ctx.fillRect(x+2,by+5,2,5);ctx.fillStyle=C.brass;ctx.fillRect(x-5,by+9,10,7);ctx.fillStyle=LCD[0];ctx.fillRect(x-1,by+11,2,3);
      view.badges.push({z:p.id,x,y,hw:22,hh:18});continue;}
    const cost=c.cost,need=c.need||{},parts=['wood','stone'].filter(k=>cost[k]),word=compact?'':'Clear';
    const widths=parts.map(k=>9+tw(String(cost[k]))+4),bw=Math.round(10+(word?tw(word)+6:0)+widths.reduce((a,b)=>a+b,0)),bh=20,bx=Math.round(x-bw/2),by=y-bh/2;
    plate(ctx,bx,by,bw,bh,hot||c.ok?C.pickEdge:'#9bbc6f');let cx=bx+5;
    if(word){ctx.fillStyle=c.ok?'#ffe8af':LCD[5];ctx.fillText(word,cx,y+1);cx+=tw(word)+6;}
    parts.forEach((k,i)=>{icon(ctx,k,cx,y);cx+=9;ctx.fillStyle=need[k]?'#f0a090':LCD[5];ctx.fillText(String(cost[k]),cx,y+1);cx+=widths[i]-9;});
    view.badges.push({z:p.id,x,y,hw:Math.max(22,bw/2+2),hh:18});}
  ctx.textBaseline='alphabetic';}
function plate(ctx,x,y,w,h,edge){ctx.fillStyle='#0008';ctx.fillRect(x+2,y+2,w,h);ctx.fillStyle=edge;ctx.fillRect(x,y,w,h);ctx.fillStyle=LCD[0];ctx.fillRect(x+2,y+2,w-4,h-4);}
// Tiny Wood and Stone pictures for the signs: a log, and a grey rock.
function icon(ctx,k,x,y){if(k==='wood'){ctx.fillStyle=C.ink;ctx.fillRect(x-1,y-4,9,7);ctx.fillStyle=C.woodHi;ctx.fillRect(x,y-3,7,5);ctx.fillStyle='#c9a878';ctx.fillRect(x+5,y-3,2,5);ctx.fillStyle=C.wood;ctx.fillRect(x,y,5,1);return;}
  ctx.fillStyle=C.ink;ctx.fillRect(x-1,y-4,8,7);ctx.fillStyle=C.stoneHi;ctx.fillRect(x,y-3,6,3);ctx.fillStyle=C.stone;ctx.fillRect(x,y,6,2);}
function tree(ctx,g,c,r,kind,v,dx=0){const [x,y0]=iso(g,c+.5,r+.5),w=g.w,y=Math.round(y0),X=Math.round(x+(v-.5)*w*.12)+dx;
  // Every tree and bush has a dark one-pixel rim (drawn first, one pixel bigger) and a lit side, so it reads at phone size.
  if(kind==='bush'){const cl=C.bush;ctx.fillStyle='#0004';ctx.fillRect(X-w*.26,y-2,w*.52,4);
    ctx.fillStyle=C.ink;ctx.fillRect(X-w*.26-1,y-w*.3-1,w*.52+2,w*.3+2);ctx.fillRect(X-w*.18-1,y-w*.4-1,w*.36+2,w*.1+2);
    ctx.fillStyle=cl[0];ctx.fillRect(X-w*.26,y-w*.3,w*.52,w*.3);ctx.fillRect(X-w*.18,y-w*.4,w*.36,w*.1);ctx.fillStyle=cl[1];ctx.fillRect(X-w*.14,y-w*.36,w*.16,w*.1);
    ctx.fillStyle=C.berry;ctx.fillRect(Math.round(X-w*.16),Math.round(y-w*.18),2,2);ctx.fillRect(Math.round(X+w*.08),Math.round(y-w*.26),2,2);ctx.fillRect(Math.round(X+w*.02),Math.round(y-w*.1),2,2);return;}
  ctx.fillStyle='#0005';ctx.fillRect(X-w*.22,y-2,w*.44,4);const tw=Math.max(4,w*.1);ctx.fillStyle=C.ink;ctx.fillRect(X-Math.max(2,w*.05)-1,y-w*.42,tw+2,w*.42+1);ctx.fillStyle=C.trunk;ctx.fillRect(X-Math.max(2,w*.05),y-w*.42,tw,w*.42);
  if(kind==='pine'){const cl=C.pine,tall=w*(1.15+v*.2),tiers=[];for(let k=0;k<3;k++){const b=y-w*.3-k*tall*.26,half=w*(.36-k*.08);tiers.push([b,half,b-tall*.36]);}
    for(const [b,half,t] of tiers)poly(ctx,[[X,t-1.5],[X+half+1.5,b+1],[X-half-1.5,b+1]],C.ink);
    tiers.forEach(([b,half,t],k)=>{poly(ctx,[[X,t],[X+half,b],[X-half,b]],cl[k===2?2:k]);poly(ctx,[[X,t],[X-half,b],[X-half*.45,b]],k===2?'#4f9e66':cl[k+1]);});return;}
  const cl=C.oak,cy=y-w*(.78+v*.12),rr=w*.33;ctx.fillStyle=C.ink;ctx.fillRect(X-rr-1,cy-rr*.6-1,rr*2+2,rr*1.4+2);ctx.fillRect(X-rr*.7-1,cy-rr-1,rr*1.4+2,rr*2+2);ctx.fillStyle=cl[0];ctx.fillRect(X-rr,cy-rr*.6,rr*2,rr*1.4);ctx.fillRect(X-rr*.7,cy-rr,rr*1.4,rr*2);ctx.fillStyle=cl[1];ctx.fillRect(X-rr*.75,cy-rr*.8,rr*1.2,rr*1.1);ctx.fillStyle=cl[2];ctx.fillRect(X-rr*.5,cy-rr*.7,rr*.5,rr*.4);}
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
  ctx.fillStyle='#0006';ctx.fillRect(x-5,Math.round(y0)-1,10,3);ctx.fillStyle='rgba(248,220,136,.4)';ctx.fillRect(x-3,Math.round(y0),6,1);
  const role=roleOf(state,w.k),L=LOOK[role];
  // A dark rim round body and head, so people stand out on grass, earth and road alike.
  ctx.fillStyle=C.ink;ctx.fillRect(x-4,y-12,8,11);ctx.fillRect(x-3,y-16,7,5);
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
function palisade(ctx,g,c,r,walls){const o=own(state),out=(x,y)=>!(x>=0&&y>=0&&x<W&&y<W&&o.tiles.has(wid(x,y))),runs=[];
  // Along every side of the tile that faces wild land, whatever shape Haven's land has.
  if(out(c,r-1))runs.push([[c,r],[c+1,r]]);if(out(c,r+1))runs.push([[c,r+1],[c+1,r+1]]);if(out(c-1,r))runs.push([[c,r],[c,r+1]]);if(out(c+1,r))runs.push([[c+1,r],[c+1,r+1]]);
  if(!runs.length)runs.push([[c,r+.5],[c+1,r+.5]]);// palisade left inside once the land beyond it was cleared
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
// They set off from just outside Haven's land, level with the hearth, on that side.
function raidFrom(side){const o=own(state),m=8,col=o.ids.filter(id=>id%W===m).map(id=>Math.floor(id/W)),row=o.ids.filter(id=>Math.floor(id/W)===m).map(id=>id%W);
  return side===0?[m,Math.min(...col)-1]:side===1?[Math.max(...row)+1,m]:side===2?[m,Math.max(...col)+1]:[Math.min(...row)-1,m];}
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
/* Haven's handheld: a thin frame around Haven (ruins-reclaimed.css), and, once per page session, a HAVEN title screen
 * that waits for Start, then a short pixel-static wipe into the town. Presentation only: nothing here is saved (a reload
 * is a new session), and the town isn't mounted until Start, so no Haven time passes on the title screen. The wipe runs
 * on its own animation frames (no timers) for WIPE_MS, blocks taps while it plays, and stops at once if Haven is left. */
let shell=null,title=null,started=false,fx=0;
const WIPE_MS=600;
const LCD=['#0f2a1c','#1d4430','#2f6244','#4f8a5c','#9bbc6f','#d4ebb0'];
// A 5×7 pixel letter set of our own, only the letters Haven's title needs.
const GLYPH={H:'10001100011000111111100011000110001',A:'01110100011000111111100011000110001',V:'10001100011000110001100010101000100',
  E:'11111100001000011110100001000011111',N:'10001110011010110011100011000110001',P:'11110100011000111110100001000010000',
  R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100'};
function pixelText(ctx,s,x,y,k,color){ctx.fillStyle=color;let cx=x;
  for(const ch of s){const g=GLYPH[ch];if(g)for(let i=0;i<35;i++)if(g[i]==='1')ctx.fillRect(cx+(i%5)*k,y+Math.floor(i/5)*k,k,k);cx+=6*k;}}
// One canvas at a whole-number scale, so every pixel stays square and sharp.
function pixelCanvas(cv,w,h,k){const ctx=cv?.getContext?.('2d');if(!ctx)return null;const d=Math.min(3,Math.max(1,Math.round(root.devicePixelRatio||1)));
  cv.width=w*k*d;cv.height=h*k*d;cv.style.width=`${w*k}px`;cv.style.height=`${h*k}px`;ctx.setTransform?.(k*d,0,0,k*d,0,0);ctx.imageSmoothingEnabled=false;return ctx;}
function drawTitle(el,space){
  const k=Math.max(2,Math.min(5,Math.floor(space*.78/64))),ctx=pixelCanvas(el.querySelector('.ruins-title-logo'),64,46,k);
  if(ctx){pixelText(ctx,'HAVEN',4,3,2,LCD[2]);pixelText(ctx,'HAVEN',3,2,2,LCD[5]);
    ctx.fillStyle=LCD[1];ctx.fillRect(0,39,64,7);ctx.fillStyle=LCD[2];ctx.fillRect(0,39,64,1);
    for(const [x,s] of [[10,1],[17,0],[50,1],[56,0]]){ctx.fillStyle=LCD[3];[1,3,3,5,5,7].slice(s).forEach((w,i)=>ctx.fillRect(x-(w>>1),31+s+i,w,1));ctx.fillStyle=LCD[1];ctx.fillRect(x,37,1,2);}
    ctx.fillStyle=LCD[2];[2,4,6,8,10,12].forEach((w,i)=>ctx.fillRect(32-(w>>1),26+i,w,1));
    ctx.fillStyle=LCD[3];ctx.fillRect(27,32,10,7);ctx.fillStyle=LCD[0];ctx.fillRect(31,35,2,4);ctx.fillStyle=LCD[5];ctx.fillRect(28,33,2,2);ctx.fillRect(34,33,2,2);}
  const p=pixelCanvas(el.querySelector('.ruins-title-start'),65,7,Math.max(2,Math.round(k*.6)));if(p)pixelText(p,'PRESS START',0,0,1,LCD[5]);}
function showTitle(slot){
  if(title&&title.parentNode===slot)return;
  const wrap=document.createElement('div');
  wrap.innerHTML='<button type="button" class="ruins-title" aria-label="Haven. Press Start to open your town."><canvas class="ruins-title-logo" aria-hidden="true"></canvas><span class="ruins-title-press" aria-hidden="true"><canvas class="ruins-title-start"></canvas></span><small aria-hidden="true">Tap to start</small></button>';
  title=wrap.firstElementChild;title.addEventListener('click',start);slot.replaceChildren(title);
  drawTitle(title,slot.clientWidth||shell.clientWidth||300);}
// Start, once: the town mounts underneath and the static wipes off it. A second tap or key press does nothing.
function start(){if(started||!shell||!title)return;started=true;title=null;mount(shell.firstElementChild);
  if(!reduced())wipe();view?.canvas.focus?.({preventScroll:true});}
function wipe(){
  const cv=shell.querySelector('.ruins-static'),ctx=cv?.getContext?.('2d');if(!ctx)return;
  const slot=shell.firstElementChild,w=48,h=Math.max(24,Math.min(160,Math.round(w*(slot.clientHeight||480)/(slot.clientWidth||300))));
  cv.width=w;cv.height=h;cv.hidden=false;let t0=0;
  const step=now=>{fx=0;if(!t0)t0=now;const t=now-t0;if(t>=WIPE_MS){endWipe();return;}
    // A few still frames of low-contrast static (new noise every 80 ms, never a full-screen flash), then a bright
    // scanline sweeps down and the town shows above it.
    const edge=t<150?-1:Math.floor((t-150)/(WIPE_MS-150)*(h+2));let seed=(Math.floor(t/80)+1)*2654435761>>>0;
    const rnd=()=>{seed^=seed<<13;seed>>>=0;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;return seed/4294967296;};
    ctx.clearRect(0,0,w,h);
    for(let y=Math.max(0,edge+2);y<h;y++){const dim=y%2;for(let x=0;x<w;x++){ctx.fillStyle=LCD[Math.min(3,Math.floor(rnd()*4)+(dim?-1:0))]||LCD[0];ctx.fillRect(x,y,1,1);}}
    if(edge>=0){ctx.fillStyle=LCD[4];ctx.fillRect(0,edge,w,1);ctx.fillStyle=LCD[3];ctx.fillRect(0,edge+1,w,1);}
    fx=root.requestAnimationFrame(step);};
  fx=root.requestAnimationFrame(step);}
function endWipe(){if(fx)root.cancelAnimationFrame(fx);fx=0;const cv=shell?.querySelector('.ruins-static');if(cv){cv.hidden=true;cv.getContext?.('2d')?.clearRect(0,0,cv.width,cv.height);}}
function page(host){if(!host)return;if(!shell){shell=document.createElement('div');shell.className='ruins-shell';shell.innerHTML='<div class="ruins-slot"></div><canvas class="ruins-static" aria-hidden="true" hidden></canvas>';}
  if(shell.parentNode!==host)host.replaceChildren(shell);if(started)mount(shell.firstElementChild);else showTitle(shell.firstElementChild);}
function leave(){endWipe();unmount();}
Object.assign(root.LoreRuinsReclaimed,{page,leave,WIPE_MS});Object.defineProperty(root.LoreRuinsReclaimed,'started',{get:()=>started});
})(globalThis);
