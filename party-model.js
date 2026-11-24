(function(root){'use strict';const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null),M=root.LoreSummonModel||(typeof require==='function'?require('./summon-model.js'):null);
function power(s,id,base=false){return R.copy(s,id)?R.combat(s,id,base).expectedDps:0;}
function improvement(s,id,slot){const clone=JSON.parse(JSON.stringify(s)),before=R.total(root.LoreOwnership?.hydrate(clone)||clone);return R.equip(clone,id,slot).ok?R.total(clone)-before:0;}
function ranked(s,slot=null){return M.owned(s).map(h=>({...h,improvement:Number.isInteger(slot)?improvement(s,h.id,slot):power(s,h.id)})).sort((a,b)=>b.improvement-a.improvement||power(s,b.id)-power(s,a.id)||a.id.localeCompare(b.id));}
// The rarities Auto Summon stops for, as the exact set of ticked ranks. A save from before the checkboxes keeps its
// old meaning: its "stop at this rarity or rarer" becomes that rarity and every rarer one.
function stopRarities(settings){const list=settings?.stopRarities,rank=settings?.stopRank;if(Array.isArray(list))return [...new Set(list.filter(r=>Number.isInteger(r)&&r>=0&&r<R.C.rarities.length))].sort((a,b)=>a-b);return Number.isInteger(rank)&&rank>=0&&rank<10?R.C.rarities.map((_,i)=>i).filter(i=>i>=rank):[];}
// Why Auto Summon must stop for a result, or '' when Auto releases it as usual. Joshua's rule: a lifetime first
// discovery always stops it, ticked or not, and so does any exactly ticked rarity, duplicates included. Only unticked
// duplicates of companions already discovered are released. Stronger companions and open slots don't stop it by
// themselves. Pending decisions and save failures still stop it elsewhere.
function autoStop(s,entry,ranks){return entry.isNew?'New discovery':ranks.includes(entry.rank)?R.C.rarities[entry.rank]+' found':'';}
const api={ensure:s=>s.party,power,total:R.total,position:(s,id)=>s.party.slots.indexOf(id),speciesPosition:()=>-1,equip:R.equip,remove:R.remove,improvement,ranked,stopRarities,autoStop};root.LoreParty=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
