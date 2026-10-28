(function(root){'use strict';const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null),M=root.LoreSummonModel||(typeof require==='function'?require('./summon-model.js'):null);
function power(s,id,base=false){return R.copy(s,id)?R.combat(s,id,base).expectedDps:0;}
function improvement(s,id,slot){const clone=JSON.parse(JSON.stringify(s)),before=R.total(root.LoreOwnership?.hydrate(clone)||clone);return R.equip(clone,id,slot).ok?R.total(clone)-before:0;}
function ranked(s,slot=null){return M.owned(s).map(h=>({...h,improvement:Number.isInteger(slot)?improvement(s,h.id,slot):power(s,h.id)})).sort((a,b)=>b.improvement-a.improvement||power(s,b.id)-power(s,a.id)||a.id.localeCompare(b.id));}
// Why Auto Summon must stop for a pending result, or '' when Auto may release it as usual. Joshua's list:
// a first discovery, the chosen rarity or rarer, a companion that would raise party DPS (strictly, after the
// approved investment transfer), or an open party slot it could fill. A species already in the party is never
// a second companion, so it follows its existing mastery-and-release handling.
function autoStop(s,entry,stopRank){const O=root.LoreOwnership,h=R.species(entry.itemId);if(entry.isNew)return 'New discovery';if(Number.isInteger(stopRank)&&stopRank<10&&entry.rank>=stopRank)return R.C.rarities[stopRank]+' or rarer';if(!s.pending||s.owned.some(c=>c.speciesId===h.id))return '';if(s.owned.length<5)return 'Open party slot';const now=R.total(s);return s.owned.some(c=>R.total(O.hydrate(O.decide(s,s.pending.drawId,'replace',c.id)))>now+1e-9)?'Stronger companion':'';}
const api={ensure:s=>s.party,power,total:R.total,position:(s,id)=>s.party.slots.indexOf(id),speciesPosition:()=>-1,equip:R.equip,remove:R.remove,improvement,ranked,autoStop};root.LoreParty=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
