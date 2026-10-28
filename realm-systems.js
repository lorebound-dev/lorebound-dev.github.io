/* Realm 1 chapters and Town ledger. Feature-versioned; no retroactive reward replay. */
(function(root){'use strict';
const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null);
const chapters=[
 ['chapter15','Beyond the first gate','Clear Floor 15','floors',15,200,2,'The overgrown path'],
 ['chapter25','Into the ruins','Clear Floor 25','floors',25,300,3,'The overgrown path'],
 ['chapter-power15','A practiced company','Discover 15 species','discoveries',15,200,0,'The overgrown path'],
 ['chapter-level5','A trusted companion','Raise an active companion to level 5','companionLevel',5,250,0,'The inner courtyard'],
 ['chapter50','The inner courtyard','Clear Floor 50','floors',50,400,0,'The inner courtyard'],
 ['chapter60','A light for Town','Clear Floor 60','floors',60,500,0,'The inner courtyard'],
 ['chapter75','The final ascent','Clear Floor 75','floors',75,500,0,'The final ascent'],
 ['chapter-mastery3','Voices remembered','Reach permanent species mastery III','mastery',3,250,0,'The final ascent'],
 ['chapter100','The First Chronicle','Complete Realm 1','floors',100,750,0,'The final ascent']
].map(([id,name,goal,metric,target,gold,shards,chapter])=>({id,name,goal,metric,target,reward:{gold,shards},chapter,realmSystems:true}));
const milestones=[
 ['active-kills100','A path through the moss','Defeat 100 ordinary enemies while playing','activeKills',100,100],
 ['power5','Standing together','Discover 5 species','discoveries',5,100],
 ['power15','Strength of purpose','Discover 15 species','discoveries',15,150],
 ['first-uncommon','An unfamiliar voice','Discover an Uncommon species','uncommonHistory',1,100],
 ['mastery3','Familiar echoes','Reach species mastery III','mastery',3,150],
 ['companion5','A growing bond','Raise an active companion to level 5','companionLevel',5,200],
 ['active-kills500','Courtyard guardian','Defeat 500 ordinary enemies while playing','activeKills',500,250],
 ['conquest25','Deeper roots','Clear Floor 25','floors',25,200],
 ['conquest50','Half the chronicle','Clear Floor 50','floors',50,300],
 ['power30','An enduring company','Raise an active companion to level 7','companionLevel',7,300],
 ['conquest75','The last approach','Clear Floor 75','floors',75,400],
 ['companion10','A seasoned companion','Raise an active companion to level 10','companionLevel',10,400],
 ['companion20','A lifelong bond','Raise an active companion to level 20','companionLevel',20,500],
 ['summons100','A hundred answers','Complete 100 lifetime summons','summons',100,200],
 ['summons500','The living chronicle','Complete 500 lifetime summons','summons',500,500]
].map(([id,name,goal,metric,target,gold])=>({id,name,goal,metric,target,reward:{gold},realmSystems:true}));
R.C.quests.push(...chapters);R.C.achievements.push(...milestones);
function active(s){return s?.version===5&&s.progress.realmSystems?.version===1;}
function validate(x){return !!x&&x.version===1&&Number.isSafeInteger(x.activeKills)&&x.activeKills>=0&&(x.shardworks===null||validWorks(x.shardworks));}
function enable(s){if(s.version!==5)throw Error('Ownership version 5 required');root.LoreOwnership?.hydrate(s);if(s.progress.realmSystems===undefined)s.progress.realmSystems={version:1,activeKills:0,shardworks:null};if(!validate(s.progress.realmSystems))throw Error('Unsupported Realm systems ledger');if(s.progress.realmBalanceVersion!==undefined&&s.progress.realmBalanceVersion!==1)throw Error('Unsupported Realm balance version');if(s.progress.realmBalanceVersion===undefined){
 // Preserve earned legacy objectives, including unclaimed completions, before retiring Training.
 const p=s.progress,e=R.E;
 const oldMax=p.mode==='boss'?Math.round(e.regularHpBase*e.bossHpGrowth**(p.floor-1))*(p.floor===e.floors?e.realmBossHpMultiplier:e.bossHpMultiplier):Math.round(e.regularHpBase*e.regularHpGrowth**(p.floor-1));
 const fraction=Math.min(1,Math.max(0,p.enemyHp/oldMax));p.realmBalanceVersion=1;
 p.enemyHp=fraction*(p.mode==='boss'?R.bossHp(s):R.regularHp(s));
 p.completedQuests??=[];p.achievements??=[];
 for(const [id,key,n] of [['team-power','teamPower',1],['precision','precision',1],['chapter-power15','teamPower',15]])if(p.upgrades[key]>=n&&!p.completedQuests.includes(id))p.completedQuests.push(id);
 for(const [id,n] of [['power5',5],['power15',15],['power30',30]])if(p.upgrades.teamPower>=n&&!p.achievements.includes(id))p.achievements.push(id);
 }s.progress.realmBalanceVersion=1;if(!['lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9'].includes(s.schema))s.schema='lorebound-ownership-4';return s;}
function metric(s,k){if(!active(s))return 0;switch(k){case 'activeKills':return s.progress.realmSystems.activeKills;case 'companionLevel':return Math.max(1,...s.owned.map(c=>root.LoreOwnership.leveling(s,c.id).level));case 'uncommonHistory':return Object.keys(s.history).filter(id=>R.species(id).rank===1).length;default:return 0;}}

// Candidate curve selected for this review; each elapsed interval uses the old levels.
const rates=[3,4,5.5,7.5,10,14],hours=[8,12,18,24,36,48],rateCosts=[2000,4500,9000,18000,36000],reservoirCosts=[1500,3500,7000,14000,28000],unit=7200000;
function validWorks(w){return !!w&&w.version===1&&['rateLevel','reservoirLevel'].every(k=>Number.isInteger(w[k])&&w[k]>=0&&w[k]<=5)&&['lastAt','restoredAt','earned','remainder'].every(k=>Number.isSafeInteger(w[k])&&w[k]>=0)&&w.lastAt>=w.restoredAt&&w.remainder<unit;}
function view(s){const w=s.progress.realmSystems?.shardworks;return w?{restored:true,rate:rates[w.rateLevel],hours:hours[w.reservoirLevel],cap:rates[w.rateLevel]*hours[w.reservoirLevel],fraction:w.remainder/unit,earned:w.earned,rateLevel:w.rateLevel,reservoirLevel:w.reservoirLevel,rateCost:rateCosts[w.rateLevel]??null,reservoirCost:reservoirCosts[w.reservoirLevel]??null}:{restored:false,eligible:s.cleared.includes(60),cost:5000};}
function accrue(s,now){if(!active(s)||!Number.isFinite(now))return 0;const w=s.progress.realmSystems.shardworks;if(!w)return 0;now=Math.trunc(now);if(now<=w.lastAt)return 0;const rate=rates[w.rateLevel],cap=rate*hours[w.reservoirLevel],elapsed=Math.min(now-w.lastAt,hours[w.reservoirLevel]*3600000),amount=Math.min(cap*unit,w.remainder+elapsed*(rate*2)),credit=Math.floor(amount/unit);if(!Number.isSafeInteger(s.shards+credit)||!Number.isSafeInteger(w.earned+credit))throw Error('Shard balance exceeds safe arithmetic');w.remainder=amount%unit;w.lastAt=now;w.earned+=credit;s.shards+=credit;return credit;}
function purchase(s,kind,expected,now){if(!active(s)||s.pending||!Number.isFinite(now)||now<0)return {ok:false,reason:'Building unavailable'};const ledger=s.progress.realmSystems,w=ledger.shardworks;
 if(kind==='restore'){if(w||expected!==null||!s.cleared.includes(60)||s.gold<5000)return {ok:false,reason:'Restoration unavailable'};s.gold-=5000;ledger.shardworks={version:1,rateLevel:0,reservoirLevel:0,lastAt:Math.trunc(now),restoredAt:Math.trunc(now),earned:0,remainder:0};return {ok:true};}
 const field=kind==='rate'?'rateLevel':kind==='reservoir'?'reservoirLevel':null;if(!w||!field||w[field]!==expected||now<w.lastAt)return {ok:false,reason:'Upgrade offer changed'};const cost=(kind==='rate'?rateCosts:reservoirCosts)[expected];if(cost===undefined||s.gold<cost)return {ok:false,reason:'Not affordable'};accrue(s,now);s.gold-=cost;w[field]++;return {ok:true};}

root.LoreRealmSystems={rates,hours,rateCosts,reservoirCosts,view,accrue,purchase,active,validate,enable,metric,chapters,milestones};if(typeof module!=='undefined')module.exports=root.LoreRealmSystems;
})(globalThis);
