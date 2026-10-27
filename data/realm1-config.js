/* Realm 1 Version 1. Approved roster/probabilities; approved regular-growth pacing. */
(function(root){'use strict';
const rarities=['Common','Uncommon','Rare','Epic','Legendary','Mythic','Ancient','Exalted','Transcendent','Eternal'];
const categories=['Mortals','Beasts','Spirits','Constructs','Wildgrowth','Aberrations'];
// name | category | rarity | interval seconds | base crit percent | Tome I..V percent
const rows=[
['Bramblebud','Wildgrowth','Common',2,1,[13.95,8.15,6.55,6,5.45]],
['Cinderclack','Beasts','Common',1,3,[11.05,6.45,5.19,4.75,4.31]],
['Glimwick','Constructs','Common',1.5,2,[11.05,6.45,5.19,4.75,4.31]],
['Lost Squire','Mortals','Common',1.8,1,[13.95,8.15,6.55,6,5.45]],
['Cavern Scout','Mortals','Common',1.1,3,[11.63,6.79,5.46,5,4.54]],
['Wandering Acolyte','Mortals','Common',2.2,2,[0,0,4.37,4,3.63]],
['Rustblade','Mortals','Uncommon',1.3,4,[0,0,3.53,3.04,3.01]],
['Hollow Knight','Mortals','Rare',2.5,5,[0,0,0,0,1.58]],
['Gloom Bat','Beasts','Common',.8,2,[12.79,7.47,6.01,5.5,4.99]],
['Stoneback Toad','Beasts','Common',2.4,1,[0,7.47,6.01,5.5,4.99]],
['Cave Moth','Beasts','Uncommon',1,4,[0,0,2.73,2.35,2.33]],
['Moonveil Stag','Beasts','Rare',1.2,3,[0,0,0,0,1.74]],
['Soot Sprite','Spirits','Common',1.4,2,[11.63,6.79,5.46,5,4.54]],
['Wick Wisp','Spirits','Common',1.2,3,[0,7.13,5.73,5.25,4.77]],
['Lantern Wisp','Spirits','Common',1.9,1,[0,6.11,4.91,4.5,4.09]],
['Rune Wisp','Spirits','Uncommon',1.6,3,[0,0,3.69,3.17,3.15]],
['Ashen Familiar','Spirits','Uncommon',1.1,4,[0,0,0,2.76,2.74]],
['Dusk Revenant','Spirits','Uncommon',2.3,2,[0,0,0,0,2.19]],
['Pebblekin','Constructs','Common',2.3,1,[13.95,8.15,6.55,6,5.45]],
['Rustmite','Constructs','Common',.9,3,[0,5.77,4.64,4.25,3.86]],
['Dripstone','Constructs','Uncommon',2,2,[0,0,3.21,2.76,2.74]],
['Stone Sentinel','Constructs','Rare',2.8,4,[0,0,0,1,1.58]],
['Rootling','Wildgrowth','Common',1.7,2,[0,7.12,5.73,5.25,4.77]],
['Shroomlet','Wildgrowth','Common',2.1,1,[0,0,4.65,4.25,3.85]],
['Twigling','Wildgrowth','Uncommon',1.4,3,[0,8,3.84,3.31,3.28]],
['Briarling','Wildgrowth','Uncommon',1.8,4,[0,0,0,2.76,2.74]],
['Gravecap','Wildgrowth','Uncommon',2.4,2,[0,0,0,2.35,2.32]],
['Crooked Eye','Aberrations','Common',1.6,3,[0,0,0,.5,1]],
['Hollow Maw','Aberrations','Uncommon',2.6,4,[0,0,0,0,.5]],
['Forgotten Watcher','Aberrations','Rare',3,5,[0,0,0,0,.1]]];
const companions=rows.map(([name,category,rarity,interval,crit,probabilities],index)=>({id:name.toLowerCase().replaceAll(' ','-'),index,name,category,realm:1,rarity,rank:rarities.indexOf(rarity),interval,baseCrit:crit/100,weights:probabilities.map(n=>Math.round(n*100)),unlock:probabilities.findIndex(n=>n>0)+1,sprite:index<3?index:null}));
const economy={floors:100,killsToBoss:10,killBands:[10,15,20,25,30],bossSeconds:30,regularHpBase:200,regularHpGrowth:1.030,bossHpGrowth:1.025,bossHpMultiplier:5,realmBossHpMultiplier:6.5,regularGoldBase:21,bossGoldBase:200,goldGrowth:1.03,bossShards:2,tenthShards:5,realmBossShards:20,baseDps:10,rarityGrowth:2,aberrationMultiplier:4,critMultiplier:1.5,critCap:.35,teamPowerStep:.05,teamPowerCost:100,teamPowerGrowth:1.15,precisionStep:.005,precisionCost:250,precisionGrowth:1.18,masteryStep:.02,masteryMax:6,slots:5,spawnSeconds:.15,startingGold:100,startingShards:0,tapDamage:3,regularXp:8,bossXp:40,firstAttackFraction:.35,slotStaggerSeconds:.06,offlineCapSeconds:21600,offlineEfficiency:.65,offlineMaxFutureMs:300000};
const tomes=[{level:1,name:'Forgotten Pages I',price:100,upgradeShards:10,count:8,rarityWeights:[10000,0,0]},{level:2,name:'Forgotten Pages II',price:150,upgradeShards:25,count:14,rarityWeights:[9200,800,0]},{level:3,name:'Forgotten Pages III',price:250,upgradeShards:50,count:20,rarityWeights:[8300,1700,0]},{level:4,name:'Forgotten Pages IV',price:400,upgradeShards:65,count:25,rarityWeights:[7650,2250,100]},{level:5,name:'Forgotten Pages V',price:600,upgradeShards:null,count:30,rarityWeights:[7000,2500,500]}];
// Proposals awaiting approval: total lifetime summons, INCLUDING the first discovery.
const masteryThresholds={ordinary:{Common:[2,5,10,20,35,60],Uncommon:[2,4,7,12,20,32],Rare:[2,3,5,8,12,18]},aberration:{Common:[2,3,5,8,12,18],Uncommon:[2,3,4,6,9,12],Rare:[2,3,4,5,6,8]}};
// Stable Chronicle IDs. Versioned economy supplies Shard rewards; floor milestones count completed story floors.
const quests=[['first-bond','A voice answers','Discover your first companion','discoveries',1,50],['first-ten','Clear a path','Defeat 10 ordinary enemies','kills',10,100],['first-summon','Forgotten Pages','Summon from the tome','summons',1,100],['team-three','Strength together','Equip three companions','team',3,150],['team-power','A shared strength','Raise an active companion to level 2','companionLevel',2,150],['first-boss','Challenge the keeper','Defeat a floor boss','bosses',1,200],['tome-two','Turn the page','Unlock Tome II','tome',2,250],['precision','An exact strike','Discover 8 species','discoveries',8,250],['mastery','A familiar voice','Reach a species mastery level','mastery',1,300],['floor-ten','The first chapter','Clear floor 10','floors',10,500]].map(([id,name,goal,metric,target,gold])=>({id,name,goal,metric,target,reward:{gold},provisional:true}));
const achievements=[['conquest10','Keepers fall','Clear 10 floors','floors',10],['conquest100','Realm reclaimed','Complete Realm 1','floors',100],['discovery10','Many voices','Discover 10 species','discoveries',10],['discovery30','The whole chronicle','Discover every Realm 1 species','discoveries',30],['mastery6','A lasting bond','Reach mastery level 6','mastery',6],['tome5','Forgotten no more','Unlock Tome V','tome',5]].map(([id,name,goal,metric,target])=>({id,name,goal,metric,target}));
function validate(){const errors=[];if(companions.length!==30||new Set(companions.map(h=>h.id)).size!==30)errors.push('Species count/IDs');for(const [rank,count]of [[0,16],[1,10],[2,4]])if(companions.filter(h=>h.rank===rank).length!==count)errors.push('Rarity count '+rank);for(const t of tomes){if(companions.reduce((n,h)=>n+h.weights[t.level-1],0)!==10000)errors.push('Probability total '+t.level);if(companions.filter(h=>h.weights[t.level-1]>0).length!==t.count)errors.push('Unlock count '+t.level);for(let rank=0;rank<3;rank++)if(companions.filter(h=>h.rank===rank).reduce((n,h)=>n+h.weights[t.level-1],0)!==t.rarityWeights[rank])errors.push('Rarity total '+t.level+':'+rank);}for(const h of companions){if(h.weights.length!==5||h.weights.some(w=>!Number.isInteger(w)||w<0||w>10000))errors.push('Invalid weights '+h.id);if(!categories.includes(h.category)||h.interval<=0||h.baseCrit<0||h.baseCrit>economy.critCap)errors.push('Invalid combat '+h.id);if(h.weights.slice(h.unlock-1).some(w=>w<=0))errors.push('Unlock continuity '+h.id);}for(const group of Object.values(masteryThresholds))for(const [rarity,thresholds]of Object.entries(group))if(thresholds.length!==economy.masteryMax||thresholds.some((n,i)=>!Number.isInteger(n)||n<1||(i>0&&n<=thresholds[i-1])))errors.push('Mastery thresholds '+rarity);if(companions.slice(0,3).some(h=>h.unlock!==1))errors.push('Starter availability');return errors;}
// Review balance v1: chapter knots, linear interpolation with integer HP.
// Only schema-4 Realm 1 saves use these values; historical formulas remain readable.
const realm1Balance={version:1,regularHp:[[1,100],[20,450],[40,800],[60,1150],[80,1400],[100,1650]],bossHp:[[1,250],[20,1300],[40,1700],[60,2100],[80,2500],[100,2800]]};
const realms=[{id:1,name:"Realm 1",speciesIds:companions.map(h=>h.id)}];
const api={version:2,realm1Balance,realms,rarities,categories,companions,economy,tomes,masteryThresholds,quests,achievements,validate};root.LoreConfig=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
