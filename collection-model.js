/* Collection projections only. No probability, combat or ownership changes. */
(function(root){'use strict';const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null),C=R.C;
function realms(){return C.realms.filter(r=>r.released!==false);}
function catalogue(realm='all'){const ids=new Set(realms().filter(r=>realm==='all'||r.id===Number(realm)).flatMap(r=>r.speciesIds));return C.companions.filter(h=>ids.has(h.id));}
function known(s,h){return R.discoveredIds(s).includes(h.id);}
// Where a species can come from, read from the weights summons really roll (the Rift's LorePortal when it is installed, else the
// Shard economy's table, else the Tome arrays) at every Rift level, never from a static list. Released: some level can summon it.
// Now: the current Rift level can (without the Rift, any unlocked Tome). A species no level can summon is a preview entry: it keeps
// its named card but stays out of totals, Missing and rarity completion until its odds go live. Discovery is permanent, so a
// discovered species always counts, whatever its odds are today.
function weightAt(s,h,level){const P=root.LorePortal||root.LoreEconomy?.portal;try{const w=P?.weight?P.weight(s,h,level):root.LoreEconomy?.weight?root.LoreEconomy.weight(s,h,level):h.weights?.[level-1];return w>0?w:0;}catch{return 0;}}
function availability(s,h){const P=root.LorePortal||root.LoreEconomy?.portal,max=C.tomes.length,a=s?.summoning||s?.progress?.summoning,unlocked=Number.isInteger(a?.unlocked)?Math.min(max,Math.max(1,a.unlocked)):1,current=P?.level?P.level(s):unlocked,levels=[];for(let l=1;l<=max;l++)if(weightAt(s,h,l)>0)levels.push(l);const now=P?.level?levels.includes(current):levels.some(l=>l<=current);return {released:levels.length>0,now,levels,from:levels[0]||null,status:now?'now':levels.length?'later':'unreleased'};}
function released(s,h){return availability(s,h).released;}
function counted(s,h){return known(s,h)||released(s,h);}
function state(s,h){if(known(s,h))return 'discovered';const a=availability(s,h);return a.now?'eligible':a.released?'locked':'unreleased';}
function progress(s,realm='all'){const list=catalogue(realm).filter(h=>counted(s,h)),discovered=list.filter(h=>known(s,h)).length,total=list.length;return {discovered,total,percent:total?Math.round(discovered/total*100):0};}
function record(s,h){const discovered=known(s,h),copies=s.version===5?s.owned:s.copies,active=copies.find(c=>c.speciesId===h.id),equipped=!!active&&(s.version===5||(s.party?.slots||[]).includes(active.id)),seen=(s.notices||s.progress?.notices)?.seenSpecies||[];return {discovered,active:!!active,equipped,copyId:active?.id||h.id,unread:discovered&&!seen.includes(h.id),historical:discovered&&!active,mastery:discovered?mastery(s,h.id):null};}
function families(s,realm='all',rarity='all'){return C.categories.map(category=>{const list=catalogue(realm).filter(h=>h.category===category&&(rarity==='all'||h.rarity===rarity)&&counted(s,h)),found=list.filter(h=>known(s,h)).length;return {category,found,total:list.length,complete:list.some(h=>released(s,h))&&found===list.length};}).filter(f=>f.total);}
function filter(s,{realm='all',tier='all',category='all',rarity='all',view='all',mastery:rank='all'}={}){return catalogue(realm).filter(h=>{const x=record(s,h);return (tier==='all'||h.rarity===tier)&&(category==='all'||h.category===category)&&(rarity==='all'||x.discovered&&h.rarity===rarity)&&(view==='all'||view==='discovered'&&x.discovered||view==='missing'&&!x.discovered&&released(s,h)||view==='unread'&&x.unread||view==='equipped'&&x.equipped||view==='historical'&&x.historical)&&(rank==='all'||rank==='complete'&&x.mastery?.level===R.E.masteryMax||rank==='incomplete'&&x.discovered&&x.mastery.level<R.E.masteryMax);});}
// One row per rarity in canonical order, counted from the same catalogue and discovery history as everything above. total counts
// what can be collected (released or already discovered); species counts every catalogue entry and preview the undiscovered
// preview entries. A rarity with no species at all (species 0) stays defined here; the Omnidex leaves it out of browsing.
function complete(s,list){const need=list.filter(h=>released(s,h));return need.length>0&&need.every(h=>known(s,h));}
function tiers(s,realm='all'){const list=catalogue(realm);return C.rarities.map(rarity=>{const all=list.filter(h=>h.rarity===rarity),own=all.filter(h=>counted(s,h)),found=own.filter(h=>known(s,h)).length,total=own.length;return {rarity,found,total,species:all.length,preview:all.length-total,percent:total?Math.round(found/total*100):0,complete:complete(s,all)};});}
function mastery(s,id){const h=R.species(id),count=(s.version===5?s.history:s.masteryCopies)[h.id]||0,thresholds=C.masteryThresholds[h.category==='Aberrations'?'aberration':'ordinary'][h.rarity],level=thresholds.filter(n=>count>=n).length,previous=level?thresholds[level-1]:0,next=thresholds[level];return {count,level,previous,next,remaining:next?Math.max(0,next-count):0,percent:next?Math.max(0,Math.min(100,(count-previous)/(next-previous)*100)):100,bonus:level*(s.version===5?.08:R.E.masteryStep)*100,nextBonus:next?(level+1)*(s.version===5?.08:R.E.masteryStep)*100:null};}
function odds(s,level=root.LorePortal?root.LorePortal.level(s):s.summoning.unlocked,missing=false){if(!Number.isInteger(level)||level<1||level>C.tomes.length)return [];return C.companions.filter(h=>(root.LoreEconomy?.weight(s,h,level)??h.weights[level-1])>0&&(!missing||!known(s,h))).map(h=>({id:h.id,name:known(s,h)?h.name:'???',known:known(s,h),rarity:h.rarity,category:h.category,weight:(root.LoreEconomy?.weight(s,h,level)??h.weights[level-1]),percent:(root.LoreEconomy?.weight(s,h,level)??h.weights[level-1])/100,h}));}
function probability(weight){return (weight/100).toFixed(2)+'%';}
// Collection rewards in Lore Shards: one for each species ever discovered, and a one-time bonus for each completed rarity.
const REWARDS={discovery:1,rarity:10};
// Claim receipts live in the save's progress (version 5) or at the top of a version 4 save. A save without them has claimed nothing yet. Rarity receipts are kept by name, so a later roster change never pays a rarity twice or loses a claim.
function home(s){return s.version===5?s.progress:s;}
function receipts(s){const r=home(s)?.collectionRewards,list=x=>Array.isArray(x)?x.filter(id=>typeof id==='string'):[];return {species:list(r?.species),rarities:list(r?.rarities)};}
function claimed(s,h){return receipts(s).species.includes(h.id);}
// What is ready to claim, for every rarity or one: discovered species (from permanent discovery history, so released ones count) and
// complete rarities, minus what was already paid. A rarity is complete when every species some Rift level can summon is discovered;
// preview entries don't count. Receipts are by name, so odds going live later can reopen a rarity but never pay it twice.
function rewards(s,rarity='all'){const r=receipts(s),found=new Set(R.discoveredIds(s)),list=catalogue(),species=list.filter(h=>(rarity==='all'||h.rarity===rarity)&&found.has(h.id)&&!r.species.includes(h.id)).map(h=>h.id),rarities=C.rarities.filter(t=>(rarity==='all'||t===rarity)&&!r.rarities.includes(t)&&complete(s,list.filter(h=>h.rarity===t)));return {species,rarities,shards:species.length*REWARDS.discovery+rarities.length*REWARDS.rarity};}
// Pays everything ready in one change to s: the Shards and their receipts together. The caller saves it, or puts s back when the save fails.
function claimRewards(s,rarity='all'){const due=rewards(s,rarity);if(!due.shards)return {ok:false,reason:'Nothing to claim',...due};const r=receipts(s);home(s).collectionRewards={species:[...r.species,...due.species],rarities:[...r.rarities,...due.rarities]};s.shards+=due.shards;return {ok:true,...due};}
const api={realms,catalogue,known,availability,released,counted,state,progress,record,families,tiers,filter,mastery,odds,probability,REWARDS,receipts,claimed,rewards,claimRewards};root.LoreCollection=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
