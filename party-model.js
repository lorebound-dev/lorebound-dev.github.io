(function(root){'use strict';const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null),M=root.LoreSummonModel||(typeof require==='function'?require('./summon-model.js'):null);
function power(s,id,base=false){return R.copy(s,id)?R.combat(s,id,base).expectedDps:0;}
function improvement(s,id,slot){const clone=JSON.parse(JSON.stringify(s)),before=R.total(root.LoreOwnership?.hydrate(clone)||clone);return R.equip(clone,id,slot).ok?R.total(clone)-before:0;}
function ranked(s,slot=null){return M.owned(s).map(h=>({...h,improvement:Number.isInteger(slot)?improvement(s,h.id,slot):power(s,h.id)})).sort((a,b)=>b.improvement-a.improvement||power(s,b.id)-power(s,a.id)||a.id.localeCompare(b.id));}
const api={ensure:s=>s.party,power,total:R.total,position:(s,id)=>s.party.slots.indexOf(id),speciesPosition:()=>-1,equip:R.equip,remove:R.remove,improvement,ranked};root.LoreParty=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
