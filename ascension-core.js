/* Ascension: a separate career-and-rebirth minigame for the fourth tab (test prototype).
   Its rules are ported from Progress Knight by ihtasham42, pinned at commit
   f6dd0c3c444d838f80325bbdca918160b99e89e5 and released under the Unlicense (public domain).
   See docs/ascension/PROVENANCE.md for what was ported and what differs.
   This file has no DOM, timers or storage. It never reads or writes the LOREBOUND save. */
(function(root){'use strict';
const VERSION=1,DAY=1,YEAR=365*DAY,START_DAYS=14*YEAR,BASE_LIFESPAN=70*YEAR,BASE_SPEED=4,TICKS=20,REBIRTH_AGE=65,AUTO_AGE=20,SHOP_COINS=50,MAX_LEVEL_STEPS=10000;
// [name, base XP for level 1, base income per day]: Progress Knight jobBaseData.
const JOBS={
 Labor:[['Beggar',50,5],['Farmer',100,9],['Fisherman',200,15],['Miner',400,40],['Blacksmith',800,80],['Merchant',1600,150]],
 Martial:[['Squire',100,5],['Footman',1000,50],['Veteran footman',10000,120],['Knight',100000,300],['Veteran knight',1000000,1000],['Elite knight',7500000,3000],['Holy knight',40000000,15000],['Legendary knight',150000000,50000]],
 Arcane:[['Student',100000,100],['Apprentice mage',1000000,1000],['Mage',10000000,7500],['Wizard',100000000,50000],['Master wizard',10000000000,250000],['Chairman',1000000000000,1000000]]};
// [name, base XP, effect per level, what it improves]: Progress Knight skillBaseData without Dark magic.
const SKILLS={
 Fundamentals:[['Concentration',100,0.01,'Skill XP'],['Productivity',100,0.01,'Job XP'],['Bargaining',100,-0.01,'Upkeep'],['Meditation',100,0.01,'Happiness']],
 Combat:[['Strength',100,0.01,'Martial pay'],['Battle tactics',100,0.01,'Martial XP'],['Muscle memory',100,0.01,'Strength XP']],
 Magic:[['Mana control',100,0.01,'Arcane XP'],['Immortality',100,0.01,'Lifespan'],['Time warping',100,0.01,'Time speed'],['Super immortality',100,0.01,'Lifespan']]};
// [name, upkeep per day, effect, what it improves]: Progress Knight itemBaseData.
const HOMES=[['Homeless',0,1],['Tent',15,1.4],['Wooden hut',100,2],['Cottage',750,3.5],['House',3000,6],['Large house',25000,12],['Small palace',300000,25],['Grand palace',5000000,60]];
const GOODS=[['Book',10,1.5,'Skill XP'],['Dumbbells',50,1.5,'Strength XP'],['Personal squire',200,2,'Job XP'],['Steel longsword',1000,2,'Martial XP'],['Butler',7500,1.5,'Happiness'],['Sapphire charm',50000,3,'Magic XP'],['Study desk',1000000,2,'Skill XP'],['Library',10000000,1.5,'Skill XP']];
// Task level requirements: Progress Knight gameData.requirements.
const NEEDS={
 Beggar:[],Farmer:[['Beggar',10]],Fisherman:[['Farmer',10]],Miner:[['Strength',10],['Fisherman',10]],Blacksmith:[['Strength',30],['Miner',10]],Merchant:[['Bargaining',50],['Blacksmith',10]],
 Squire:[['Strength',5]],Footman:[['Strength',20],['Squire',10]],'Veteran footman':[['Battle tactics',40],['Footman',10]],Knight:[['Strength',100],['Veteran footman',10]],'Veteran knight':[['Battle tactics',150],['Knight',10]],'Elite knight':[['Strength',300],['Veteran knight',10]],'Holy knight':[['Mana control',500],['Elite knight',10]],'Legendary knight':[['Mana control',1000],['Battle tactics',1000],['Holy knight',10]],
 Student:[['Concentration',200],['Meditation',200]],'Apprentice mage':[['Mana control',400],['Student',10]],Mage:[['Mana control',700],['Apprentice mage',10]],Wizard:[['Mana control',1000],['Mage',10]],'Master wizard':[['Mana control',1500],['Wizard',10]],Chairman:[['Mana control',2000],['Master wizard',10]],
 Concentration:[],Productivity:[['Concentration',5]],Bargaining:[['Concentration',20]],Meditation:[['Concentration',30],['Productivity',20]],
 Strength:[],'Battle tactics':[['Concentration',20]],'Muscle memory':[['Concentration',30],['Strength',30]],
 'Mana control':[['Concentration',200],['Meditation',200]],Immortality:[['Apprentice mage',10]],'Time warping':[['Mage',10]],'Super immortality':[['Chairman',1000]]};
const job={},skill={},home={},good={},branchOf={};
for(const [b,list] of Object.entries(JOBS))for(const [name,xp,income] of list){job[name]={name,xp,income,branch:b};branchOf[name]=b;}
for(const [b,list] of Object.entries(SKILLS))for(const [name,xp,effect,about] of list){skill[name]={name,xp,effect,about,branch:b};branchOf[name]=b;}
for(const [name,upkeep,effect] of HOMES)home[name]={name,upkeep,effect,unlock:upkeep*100};
for(const [name,upkeep,effect,about] of GOODS)good[name]={name,upkeep,effect,about,unlock:name==='Book'?0:upkeep*100};
const taskNames=[...Object.keys(job),...Object.keys(skill)];
const PERMANENT=['automation','shop'],watched=[...taskNames,...Object.keys(home),...Object.keys(good),'automation','shop','rebirth'];

function fresh(){const tasks={};for(const n of taskNames)tasks[n]={level:0,maxLevel:0,xp:0};return {v:VERSION,days:START_DAYS,coins:0,job:'Beggar',skill:'Concentration',home:'Homeless',goods:[],tasks,seen:{},rebirths:0,autoPromote:false,autoLearn:false,speed:1,ticks:0};}
const num=(x,min=0)=>typeof x==='number'&&Number.isFinite(x)&&x>=min;
// Accepts only a well-formed version 1 run; anything else returns null so the caller can warn and start fresh.
function validate(raw){if(!raw||typeof raw!=='object'||raw.v!==VERSION)return null;const s=fresh();
 if(!num(raw.days,START_DAYS)||!num(raw.coins)||!num(raw.rebirths)||!job[raw.job]||!skill[raw.skill]||!home[raw.home]||!Array.isArray(raw.goods)||!raw.tasks||typeof raw.tasks!=='object')return null;
 for(const n of taskNames){const t=raw.tasks[n];if(!t||!num(t.level)||!num(t.maxLevel)||!num(t.xp))return null;s.tasks[n]={level:Math.floor(t.level),maxLevel:Math.floor(t.maxLevel),xp:t.xp};}
 if(raw.goods.some(g=>!good[g]))return null;
 Object.assign(s,{days:raw.days,coins:raw.coins,rebirths:Math.floor(raw.rebirths),job:raw.job,skill:raw.skill,home:raw.home,goods:[...new Set(raw.goods)],autoPromote:raw.autoPromote===true,autoLearn:raw.autoLearn===true,speed:[1,10,50].includes(raw.speed)?raw.speed:1,ticks:num(raw.ticks)?raw.ticks:0});
 if(raw.seen&&typeof raw.seen==='object')for(const k of Object.keys(raw.seen))if(raw.seen[k]===true)s.seen[k]=true;
 if(!unlocked(s,s.job))s.job='Beggar';if(!unlocked(s,s.skill))s.skill='Concentration';return s;}

const level=(s,n)=>s.tasks[n].level;
const skillEffect=(s,n)=>Math.max(0.1,1+skill[n].effect*level(s,n)); // Bargaining is floored at ×0.1 so upkeep never turns negative.
const goodEffect=(s,n)=>s.goods.includes(n)?good[n].effect:1;
const maxXp=(s,n)=>{const l=level(s,n);return Math.round((job[n]||skill[n]).xp*(l+1)*Math.pow(1.01,l));};
const maxLevelBonus=(s,n)=>1+s.tasks[n].maxLevel/10;
const happiness=s=>skillEffect(s,'Meditation')*goodEffect(s,'Butler')*home[s.home].effect;
const age=s=>s.days/YEAR;
const lifespan=s=>BASE_LIFESPAN*skillEffect(s,'Immortality')*skillEffect(s,'Super immortality');
const alive=s=>s.days<lifespan(s);
const speed=s=>alive(s)?BASE_SPEED*skillEffect(s,'Time warping'):0; // days per second
function xpMultipliers(s,n){const m=[maxLevelBonus(s,n),happiness(s)];
 if(job[n])m.push(skillEffect(s,'Productivity'),goodEffect(s,'Personal squire'));else m.push(skillEffect(s,'Concentration'),goodEffect(s,'Book'),goodEffect(s,'Study desk'),goodEffect(s,'Library'));
 if(branchOf[n]==='Martial'&&job[n])m.push(skillEffect(s,'Battle tactics'),goodEffect(s,'Steel longsword'));
 else if(n==='Strength')m.push(skillEffect(s,'Muscle memory'),goodEffect(s,'Dumbbells'));
 else if(branchOf[n]==='Magic')m.push(goodEffect(s,'Sapphire charm'));
 else if(branchOf[n]==='Arcane')m.push(skillEffect(s,'Mana control'));
 return m;}
const xpGain=(s,n)=>Math.round(10*xpMultipliers(s,n).reduce((a,b)=>a*b,1)); // XP per day
const income=s=>{const n=s.job;let m=1+Math.log10(level(s,n)+1);if(branchOf[n]==='Martial')m*=skillEffect(s,'Strength');return Math.round(job[n].income*m);};
const upkeepOf=(s,base)=>Math.round(base*skillEffect(s,'Bargaining'));
const expense=s=>upkeepOf(s,home[s.home].upkeep)+s.goods.reduce((a,g)=>a+upkeepOf(s,good[g].upkeep),0);

function met(s,needs){return needs.every(([n,l])=>level(s,n)>=l);}
// Like Progress Knight, an unlock stays unlocked for the rest of the life once reached.
function unlocked(s,n){if(s.seen[n])return true;let ok=false;
 if(NEEDS[n])ok=met(s,NEEDS[n]);else if(home[n])ok=s.coins>=home[n].unlock;else if(good[n])ok=s.coins>=good[n].unlock;
 else if(n==='automation')ok=age(s)>=AUTO_AGE;else if(n==='shop')ok=s.coins>=SHOP_COINS;else if(n==='rebirth')ok=age(s)>=REBIRTH_AGE;
 if(ok)s.seen[n]=true;return ok;}
function canBuy(s,n){return unlocked(s,'shop')&&unlocked(s,n);}

function addXp(s,n,days){const t=s.tasks[n];t.xp+=xpGain(s,n)*days;let need=maxXp(s,n),steps=0;
 if(!Number.isFinite(need)){t.xp=0;return;}
 while(t.xp>=need&&steps<MAX_LEVEL_STEPS){t.xp-=need;t.level++;steps++;need=maxXp(s,n);if(!Number.isFinite(need)){t.xp=0;break;}}}
function bankrupt(s){s.coins=0;s.home='Homeless';s.goods=[];}
function nextInBranch(n){const list=JOBS[branchOf[n]];const i=list.findIndex(j=>j[0]===n);return list[i+1]?.[0]||null;}
function autoStep(s){if(!unlocked(s,'automation'))return;
 if(s.autoPromote){const next=nextInBranch(s.job);if(next&&unlocked(s,next))s.job=next;}
 if(s.autoLearn){let best=null,bestXp=Infinity;for(const n of Object.keys(skill))if(unlocked(s,n)){const x=maxXp(s,n);if(x<bestXp){best=n;bestXp=x;}}if(best)s.skill=best;}}
// One fixed step of 1/20 second, in Progress Knight's update order.
function tick(s){const days=speed(s)/TICKS;if(!days)return false;s.days+=days;autoStep(s);addXp(s,s.job,days);s.coins+=income(s)*days;addXp(s,s.skill,days);s.coins-=expense(s)*days;if(s.coins<0)bankrupt(s);s.ticks++;for(const n of watched)unlocked(s,n);return true;}

function select(s,kind,n){if(kind==='job'&&job[n]&&unlocked(s,n)){s.job=n;return true;}if(kind==='skill'&&skill[n]&&unlocked(s,n)){s.skill=n;return true;}
 if(kind==='home'&&home[n]&&(n==='Homeless'||canBuy(s,n))){s.home=n;return true;}
 if(kind==='good'&&good[n]){if(s.goods.includes(n)){s.goods=s.goods.filter(g=>g!==n);return true;}if(canBuy(s,n)){s.goods=[...s.goods,n];return true;}}return false;}
function rebirthPreview(s){const rows=taskNames.map(n=>{const t=s.tasks[n],best=Math.max(t.level,t.maxLevel);return {name:n,level:t.level,before:1+t.maxLevel/10,after:1+best/10};}).filter(r=>r.after>r.before).sort((a,b)=>b.after-a.after);return {ready:unlocked(s,'rebirth'),age:age(s),rows};}
function rebirth(s){if(!unlocked(s,'rebirth'))return false;for(const n of taskNames){const t=s.tasks[n];t.maxLevel=Math.max(t.maxLevel,t.level);t.level=0;t.xp=0;}
 const keep={};for(const k of PERMANENT)if(s.seen[k])keep[k]=true;
 Object.assign(s,{days:START_DAYS,coins:0,job:'Beggar',skill:'Concentration',home:'Homeless',goods:[],seen:keep,rebirths:s.rebirths+1});return true;}

root.LoreAscensionCore={VERSION,KEY:'lorebound-ascension-prototype-v01',TICKS,YEAR,REBIRTH_AGE,AUTO_AGE,SHOP_COINS,JOBS,SKILLS,HOMES,GOODS,NEEDS,job,skill,home,good,fresh,validate,tick,select,rebirth,rebirthPreview,unlocked,canBuy,age,lifespan,alive,speed,maxXp,xpGain,income,expense,skillEffect,happiness,nextInBranch};
})(globalThis);
