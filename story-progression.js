/* Corrected story contract. No balancing, Endless encounters, or artwork assignments. */
(function(root){'use strict';
const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null);
const SCHEMA='lorebound-ownership-5';
// Review limits reuse the installed six-hour / 65% offline policy. The encounter
// budget bounds device work, not story length; capped remainder is not banked.
const policy=Object.freeze({version:1,offlineSeconds:R.E.offlineCapSeconds,offlineEfficiency:R.E.offlineEfficiency,maxOfflineEncounters:10000,
 firstClear:'Retain the existing per-floor first-clear Gold, Shards and XP schedule; ordinary kill Gold/XP remain separate.',
 provisional:true});
const isBoss=f=>Number.isInteger(f)&&f>=10&&f<=100&&f%10===0;
const ledger=s=>(s.progress||s).story;
const record=s=>ledger(s)?.realms?.['1'];
const active=s=>ledger(s)?.version===1;
const demand=(x,message)=>{if(!x)throw Error(message);};
function valid(p){try{
 if(!Number.isInteger(p.floor)||p.floor<1||p.floor>100)return false;
 const l=p.story,t=l.realms['1'],n=p.realmComplete?100:p.floor-1;
 if(l.version!==1||l.selectedRealm!==1||Object.keys(l.realms).join()!=='1'||t.floor!==p.floor||(t.endless!==null&&!root.LoreEndless?.valid(p))||t.status!==(p.realmComplete?'complete':'story'))return false;
 const expected=Array.from({length:n},(_,i)=>i+1),bosses=expected.filter(isBoss);
 if(JSON.stringify(t.completed)!==JSON.stringify(expected)||JSON.stringify(t.bosses)!==JSON.stringify(bosses)||JSON.stringify(p.cleared)!==JSON.stringify(expected)||p.bossClears!==bosses.length)return false;
 if(Object.keys(t.receipts).length!==n||expected.some(f=>!['legacy','story-v1'].includes(t.receipts[f])))return false;
 if(!Number.isSafeInteger(t.randomState)||t.randomState<0||t.randomState>4294967295||p.kills!==0)return false;
 if(p.realmComplete){if(p.mode!=='regular'||t.enemyFloor!==null||!t.completion||t.completion.title!=='realm1-conqueror'||t.completion.trophy!=='realm1-conquered'||t.completion.rewardReceipt!==100)return false;}
 else {if(t.completion!==null||!Number.isInteger(t.enemyFloor))return false;if(p.mode==='boss'){if(!isBoss(p.floor)||t.enemyFloor!==p.floor)return false;}else if(isBoss(p.floor)){if(t.enemyFloor<p.floor-9||t.enemyFloor>=p.floor)return false;}else if(t.enemyFloor!==p.floor)return false;}
 return l.migration?.version===1&&/^[a-f0-9]{64}$/.test(l.migration.sourceHash)&&Number.isSafeInteger(l.migration.historicalBossClears)&&l.migration.historicalBossClears>=0&&l.migration.historicalBossClears<=100;
 }catch{return false;}}
function random(s){const t=record(s);t.randomState=(Math.imul(t.randomState,1664525)+1013904223)>>>0;return t.randomState/4294967296;}
function lifetimeBosses(s){return active(s)?ledger(s).migration.historicalBossClears+record(s).bosses.filter(f=>record(s).receipts[f]==='story-v1').length:s.bossClears||0;}
function source(s){return active(s)?record(s).enemyFloor??s.floor:s.floor;}
function spawn(s,rng){const t=record(s);if(t.status==='complete'){t.enemyFloor=null;s.enemyHp=0;return;}
 const draw=()=>{const x=rng?rng():random(s);return Math.max(0,Math.min(.999999999,Number.isFinite(x)?x:0));};
 t.enemyFloor=isBoss(s.floor)?s.floor-9+Math.floor(draw()*9):s.floor;
 // Existing placeholder sprites only; final owner mapping is a separate milestone.
 s.enemyIndex=Math.floor(draw()*6);s.enemyHp=R.regularHp(s);if(!s.discovered.includes(s.enemyIndex))s.discovered.push(s.enemyIndex);
}
function completion(){return {title:'realm1-conqueror',trophy:'realm1-conquered',rewardReceipt:100};}
function convert(input,sourceHash='0'.repeat(64)){
 demand(root.LoreOwnership.validate(input),'Invalid ownership save; reconciliation required');
 if(active(input)){demand([SCHEMA,'lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9'].includes(input.schema)&&valid(input.progress),'Invalid story ledger');return root.LoreOwnership.hydrate(JSON.parse(JSON.stringify(input)));}
 const s=root.LoreOwnership.hydrate(JSON.parse(JSON.stringify(input))),p=s.progress;
 demand(/^[a-f0-9]{64}$/.test(sourceHash),'Verified source fingerprint required');
 const n=p.realmComplete?100:p.floor-1,expected=Array.from({length:n},(_,i)=>i+1);
 demand(!p.realmComplete||p.floor===100,'Completion floor conflicts with history');
 demand(p.cleared.length===n&&expected.every(f=>p.cleared.includes(f)),'Historical floor clears conflict with the story frontier; reconciliation required');
 demand(Number.isSafeInteger(p.bossClears)&&p.bossClears===p.cleared.length,'Historical boss count is ambiguous; reconciliation required');
 // Commit the old ledger exactly before granting no new rewards. Preserve all
 // pending summon receipts, completed objectives, currencies and investments.
 R.syncProgress(s);
 root.LoreRealmSystems.enable(root.LoreEconomy.enable(s));
 p.story={version:1,selectedRealm:1,realms:{'1':{floor:p.floor,status:p.realmComplete?'complete':'story',completed:expected,bosses:expected.filter(isBoss),receipts:Object.fromEntries(expected.map(f=>[f,'legacy'])),enemyFloor:null,endless:null,completion:p.realmComplete?completion():null,randomState:0x4c4f5245}},migration:{version:1,sourceHash,historicalBossClears:p.bossClears,historicalKillsOnFloor:p.kills,interruptedEncounter:p.mode==='boss'}};
 p.cleared=[...expected];p.bossClears=expected.filter(isBoss).length;p.kills=0;p.mode='regular';p.bossRemaining=R.E.bossSeconds;p.bossUnlockedFloor=!p.realmComplete&&isBoss(p.floor)?p.floor:null;
 s.schema=SCHEMA;s.revision++;spawn(s);R.timers(s,true);R.syncProgress(s);
 demand(root.LoreOwnership.validate(s),'Story conversion failed validation');return s;
}
function firstClear(s,f){const t=record(s);if(t.receipts[f])return {gold:0,shards:0,xp:0,first:false};
 demand(f===t.completed.length+1,'Non-contiguous story reward rejected');
 const reward={gold:R.goldReward(s,true),shards:root.LoreEconomy.floorShards(f),xp:R.E.bossXp,first:true};
 t.receipts[f]='story-v1';t.completed.push(f);s.cleared.push(f);if(isBoss(f))t.bosses.push(f);
 s.gold+=reward.gold;s.shards+=reward.shards;s.playerXp+=reward.xp;s.bossClears=t.bosses.length;
 return reward;
}
function finish(s,rng,offline=false){const t=record(s);if(t.status==='complete')return null;
 const boss=s.mode==='boss',floor=s.floor,farm=!boss&&isBoss(floor);
 let gold=0,xp=0,shards=0,first=false;
 if(!boss){gold=R.goldReward(s);if(farm&&root.LoreArmory?.active(s))gold=root.LoreArmory.farmingGold(s,gold);if(farm&&root.LoreRecruitment?.enabled(s))gold=root.LoreRecruitment.applyGold(s,gold,'farmingGold');xp=R.E.regularXp;s.gold+=gold;s.playerXp+=xp;s.regularKills++;if(!offline&&root.LoreRealmSystems.active(s))s.progress.realmSystems.activeKills++;}
 if(!farm){const r=firstClear(s,floor);gold+=r.gold;xp+=r.xp;shards=r.shards;first=r.first;
  if(floor===100){s.realmComplete=true;t.status='complete';t.completion=completion();}else{s.floor++;t.floor=s.floor;}
 }
 s.mode='regular';s.kills=0;s.bossRemaining=R.E.bossSeconds;s.bossUnlockedFloor=!s.realmComplete&&isBoss(s.floor)?s.floor:null;spawn(s,rng);if(boss)R.timers(s,true);R.syncProgress(s);
 return {kind:boss?'boss':'kill',clear:floor,first,farming:farm,realmBoss:boss&&floor===100,biomeBoss:boss&&floor===100,gold,shards,xp,essence:0,relic:false};
}
function offline(s,now){const high=s.clock.highWater,delta=(now-high)/1000,invalid=!Number.isFinite(now)||delta<0;
 const out={seconds:invalid?0:Math.min(policy.offlineSeconds,delta),kills:0,gold:0,shards:0,xp:0,floors:[],interruptedBoss:false,invalidClock:invalid,capped:delta>policy.offlineSeconds,encounterCap:false};
 if(invalid||delta===0)return out;
 if(s.mode==='boss'){out.interruptedBoss=true;s.mode='regular';s.bossRemaining=R.E.bossSeconds;spawn(s);}
 const dps=s.party.slots.reduce((n,id)=>n+(id?R.combat(s,id).damage/R.combat(s,id).interval:0),0)*policy.offlineEfficiency;
 let budget=dps*out.seconds;
 while(!s.realmComplete&&budget>0&&out.kills<policy.maxOfflineEncounters){
  if(budget<s.enemyHp){s.enemyHp-=budget;budget=0;break;}
  budget-=s.enemyHp;const event=finish(s,undefined,true);out.kills++;out.gold+=event.gold;out.shards+=event.shards;out.xp+=event.xp;if(event.first)out.floors.push(event.clear);
 }
 out.encounterCap=budget>0&&!s.realmComplete;R.saveClock(s,now);R.timers(s,true);R.syncProgress(s);return out;
}
root.LoreStory={SCHEMA,policy,isBoss,ledger,record,active,valid,lifetimeBosses,source,spawn,convert,finish,offline};
if(typeof module!=='undefined')module.exports=root.LoreStory;
})(globalThis);
