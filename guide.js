/* Guided opening and the ten-place party (request #97, approved by Joshua and Noah 2026-11-03). One save update,
   schema lorebound-ownership-11. It adds the opening goals, the first-boss help, the one-time +3 Essence on the
   first-summon claim and the saved markers they read. Nothing is paid by the update itself. */
(function(root){'use strict';
const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null);
const O=()=>root.LoreOwnership;
const SCHEMA='lorebound-ownership-11',SLOTS=10,OLD_SLOTS=5,ESSENCE=3,AID_FLOOR=10,AID_KILLS=[5,10,15],AID_PARTY=3;
const clone=x=>JSON.parse(JSON.stringify(x)),demand=(x,m)=>{if(!x)throw Error(m);};
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
// Opening goals. Rewards are the amounts Noah approved on 2026-11-03 for the test site; Joshua tunes them after playing.
const goals=[
 ['first-floor','The first step','Clear Floor 1','floors',1,25,0],
 ['team-two','A second voice','Have two companions in your party','partyHigh',2,50,0],
 ['portal-two','A wider Portal','Reach Portal Level 2','portal',2,100,1],
 ['portal-three','A brighter Portal','Reach Portal Level 3','portal',3,75,0],
 ['auto-start','Let it run','Start Auto Summon','autoStarted',1,75,0],
 ['aid-5',"Keeper's aid",'Defeat 5 enemies on Floor 10','aidKills',5,0,1],
 ['aid-10',"Keeper's aid",'Defeat 10 enemies on Floor 10','aidKills',10,0,1],
 ['aid-15',"Keeper's aid",'Defeat 15 enemies on Floor 10','aidKills',15,0,1],
 ['aid-ally','A helping hand','Defeat 15 enemies on Floor 10 with fewer than three companions','aidAlly',1,0,0]
].map(([id,name,goal,metric,target,gold,shards])=>({id,name,goal,metric,target,reward:{gold,shards},guide:true,aid:id.startsWith('aid-'),provisional:true}));
// Journal and Next goal order for the opening; every other quest keeps its place after these.
const ORDER=['first-bond','first-floor','first-summon','team-two','portal-two','team-power','team-three','portal-three','auto-start','first-ten','aid-5','aid-10','aid-15','aid-ally','first-boss'];
R.C.quests.push(...goals);

const ledger=s=>(s?.progress||s)?.guide;
const enabled=s=>s?.version===5&&ledger(s)?.version===1;
function slots(s){return s?.version===5&&s.schema===SCHEMA?SLOTS:OLD_SLOTS;}
// Portal level. #78 owns the real Portal and its odds; once it is loaded its level is used. Until then the old Tome
// tier gives a lower bound that holds whatever #78's final rows are: Tome I is Level 1, Tome II (92/8) maps to
// Level 2 (90/10), and Tome III and above have more Uncommon (17%+) than Levels 2 and 3 (10%, 11%), so they map to
// Level 3 or higher. Only goals up to Level 3 read it.
function portalNow(s){const p=root.LorePortal?.level?.(s);if(integer(p,1))return p;const t=(s.progress||s).summoning?.unlocked||1;return t>=3?3:t;}
function partyNow(s){return s.version===5?s.owned.length:s.party.slots.filter(Boolean).length;}
function bossCleared(s){return (s.progress||s).cleared.includes(AID_FLOOR);}
function valid(p){try{const g=p.guide;if(!g||g.version!==1||!/^[a-f0-9]{64}$/.test(g.sourceHash)||!integer(g.maxParty,1,SLOTS)||!integer(g.portal,1,1000)||typeof g.autoStarted!=='boolean'||!['owed','paid','none'].includes(g.essence))return false;
 const a=g.aid;if(!a||typeof a.eligible!=='boolean'||!integer(a.kills,0,AID_KILLS[2]))return false;if(!a.eligible&&(a.kills!==0||a.ally!==null))return false;
 if(a.ally!==null){const h=R.species(a.ally.speciesId);if(!h||h.rank!==0||h.category==='Aberrations'||typeof a.ally.id!=='string'||!a.ally.id.startsWith(h.id+'~')||!integer(a.ally.at)||!(p.quests||[]).includes('aid-ally'))return false;}
 else if((p.quests||[]).includes('aid-ally'))return false;
 return true;}catch{return false;}}
function convert(input,hash='0'.repeat(64)){demand(O().validate(input),'Invalid save; reconciliation required');if(input.schema===SCHEMA&&enabled(input))return clone(input);
 demand(input.schema==='lorebound-ownership-10'&&input.progress.guide===undefined&&/^[a-f0-9]{64}$/.test(hash),'Conflicting party data; reconciliation required');
 const s=O().hydrate(clone(input)),p=s.progress;
 // Markers start from what the save shows now. Nothing is inferred from history: past Floor 10 means no first-boss
 // help, and the +3 Essence is owed only if first-summon hasn't been claimed yet.
 p.guide={version:1,sourceHash:hash,maxParty:Math.max(1,s.owned.length),portal:portalNow(s),autoStarted:false,essence:p.quests.includes('first-summon')?'none':'owed',aid:{eligible:!bossCleared(s),kills:0,ally:null}};
 s.schema=SCHEMA;s.revision++;R.syncProgress(s);demand(O().validate(s),'Party update failed validation');return s;}
// Raises the saved markers to what the save shows now. Called from syncProgress, so every change passes through it.
function sync(s){if(!enabled(s))return;const g=ledger(s);g.maxParty=Math.min(SLOTS,Math.max(g.maxParty,partyNow(s)));g.portal=Math.max(g.portal,portalNow(s));}
// One ordinary defeat while farming the Floor 10 checkpoint, offline ones included. Stops counting at 15 and once
// the Floor 10 boss is beaten, so the help is finite and is never newly earned after the win.
function aidKill(s){if(!enabled(s))return;const a=ledger(s).aid;if(!a.eligible||bossCleared(s)||s.floor!==AID_FLOOR)return;a.kills=Math.min(AID_KILLS[2],a.kills+1);}
// Latched by Auto's first paid draw; opening settings or a refused start never count.
function autoStarted(s){if(!enabled(s)||ledger(s).autoStarted)return;ledger(s).autoStarted=true;R.syncProgress(s);}
function metric(s,k){if(!enabled(s))return 0;const g=ledger(s);switch(k){case 'partyHigh':return g.maxParty;case 'portal':return g.portal;case 'autoStarted':return g.autoStarted?1:0;case 'aidKills':return g.aid.kills;case 'aidAlly':return g.aid.eligible&&g.aid.kills>=AID_KILLS[2]&&g.maxParty<AID_PARTY?1:0;default:return 0;}}
// Whether a quest belongs on this save's Journal. Help goals show only to players who could still earn them, and
// stay until claimed once earned. The free companion closes if the party reached three without it.
function shows(s,q){if(!q.guide)return true;if(!enabled(s))return false;if(!q.aid)return true;const g=ledger(s),done=s.quests.includes(q.id),met=s.completedQuests.includes(q.id);if(!g.aid.eligible)return false;if(q.id==='aid-ally')return done||g.maxParty<AID_PARTY&&(met||!bossCleared(s));return done||met||!bossCleared(s);}
function order(list){const at=id=>{const i=ORDER.indexOf(id);return i<0?ORDER.length:i;};return list.map((q,i)=>({q,i})).sort((a,b)=>at(a.q.id)-at(b.q.id)||a.i-b.i).map(x=>x.q);}
// The Commons the free companion can be: ordinary Commons the current Tome can give that aren't in the party.
function choices(s){if(!enabled(s))return [];const owned=new Set(s.owned.map(c=>c.speciesId)),level=s.summoning.selected;return R.C.companions.filter(h=>h.rank===0&&h.category!=='Aberrations'&&!owned.has(h.id)&&(root.LoreEconomy?.weight(s,h,level)??h.weights[level-1])>0);}
// Checked before a claim is recorded. Returns a reason to refuse, or ''.
function check(s,q,opts={}){if(!q.guide)return '';if(!shows(s,q))return 'Quest not ready';if(q.id!=='aid-ally')return '';const g=ledger(s);if(g.maxParty>=AID_PARTY)return 'Your party already reached three companions';if(s.pending)return 'Choose what to do with your summon first';if(s.owned.length>=SLOTS)return 'Party is full';if(!choices(s).some(h=>h.id===opts.speciesId))return 'Choose a Common';return '';}
// Pays what the generic quest reward doesn't: the +3 Essence and the free companion. Runs once, after the claim is recorded.
function claimed(s,id,opts={},now=Date.now()){if(!enabled(s))return {};const g=ledger(s);
 if(id==='first-summon'&&g.essence==='owed'){const e=s.essence;s.essence=O().rational(BigInt(e.n)+BigInt(ESSENCE)*BigInt(e.d),BigInt(e.d));g.essence='paid';return {essence:ESSENCE};}
 if(id==='aid-ally'){const h=R.species(opts.speciesId);s.serial++;const c={id:h.id+'~'+s.serial,speciesId:h.id,createdAt:Math.trunc(now),invested:O().rational(0)};s.owned.push(c);
  // A free companion is a discovery but not a summon: no pull, no Shard, no receipt, and no extra mastery copy for a species already found.
  s.history[h.id]=Math.max(1,s.history[h.id]||0);g.aid.ally={speciesId:h.id,id:c.id,at:Math.trunc(now)};R.timers(s);sync(s);return {companion:h.name};}
 return {};}
function essenceOwed(s){return enabled(s)&&ledger(s).essence==='owed';}
const api={SCHEMA,SLOTS,OLD_SLOTS,ESSENCE,AID_FLOOR,AID_KILLS,AID_PARTY,goals,ORDER,ledger,enabled,slots,portalNow,valid,convert,sync,aidKill,autoStarted,metric,shows,order,choices,check,claimed,essenceOwed};
root.LoreGuide=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
