/* Versioned ownership domain shared by Adventure and the isolated review entry. */
(function(root){'use strict';
const R=root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null);
const E=root.LoreEconomy||(typeof require==='function'?require('./economy-v2.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x)),known=id=>R.C.companions.find(h=>h.id===id);
const salvage=id=>({Common:1,Uncommon:3,Rare:8})[known(id)?.rarity];
function demand(ok,message){if(!ok)throw Error(message);}
function rational(n,d=1n){n=BigInt(n);d=BigInt(d);demand(n>=0n&&d>0n,'Invalid Essence');let a=n,b=d;while(b)[a,b]=[b,a%b];return {n:String(n/a),d:String(d/a)};}
function qvalid(x){try{return !!x&&typeof x.n==='string'&&typeof x.d==='string'&&/^\d+$/.test(x.n)&&/^[1-9]\d*$/.test(x.d)&&JSON.stringify(rational(x.n,x.d))===JSON.stringify(x);}catch{return false;}}
function plus(a,b){return rational(BigInt(a.n)*BigInt(b.d)+BigInt(b.n)*BigInt(a.d),BigInt(a.d)*BigInt(b.d));}
function transfer(q,same){return rational(BigInt(q.n)*(same?1n:4n),BigInt(q.d)*(same?1n:5n));}
function audit(raw){
 let s;try{s=JSON.parse(raw);}catch{return {blocked:['Invalid JSON']};}
 const blocked=[];if(!s||s.version!==4||!R.validate(s))return {blocked:['Unsupported or invalid legacy save']};
 if(s.configVersion!==R.C.version)blocked.push('Legacy game configuration requires reconciliation');
 if(!Number.isSafeInteger(s.essence)||s.essence<0||s.essenceSpent!==0)blocked.push('Legacy Essence balance or spent investment cannot be reconciled');
 for(const key of ['pendingManualResults','pendingDiscoveries'])if(s.summoning[key]!==undefined&&(!Array.isArray(s.summoning[key])||s.summoning[key].length))blocked.push('Resolve already-awarded '+key+' in the legacy game');
 if(s.mode==='boss')blocked.push('Finish or flee the current boss encounter in the legacy game');
 for(const [id,n] of Object.entries(s.masteryCopies))if(!known(id)||!Number.isSafeInteger(n)||n<0)blocked.push('Unrecognized historical species/count');
 // This shipped legacy schema has no trusted individual investment contract.
 for(const c of s.copies)if(Object.keys(c).some(k=>!['id','speciesId','at'].includes(k)))blocked.push('Unrecognized individual record fields require reconciliation');
 return {blocked:[...new Set(blocked)],state:s,preselected:s.party.slots.filter(Boolean),records:clone(s.copies)};
}
function preview(raw,selected){const a=audit(raw);demand(!a.blocked.length,a.blocked.join('; '));
 demand(Array.isArray(selected)&&selected.length>=1&&selected.length<=5&&new Set(selected).size===selected.length&&selected.every(id=>a.state.copies.some(c=>c.id===id)),'Retain one to five unique owned companions');
 const released=a.records.filter(c=>!selected.includes(c.id));return {...a,selected:[...selected],released,credit:released.reduce((n,c)=>n+salvage(c.speciesId),0)};
}
function migrate(raw,selected,sourceHash){const p=preview(raw,selected),s=clone(p.state),history=clone(s.masteryCopies);
 const owned=selected.map(id=>({...clone(s.copies.find(c=>c.id===id)),invested:rational(0)}));
 if(s.summoning.owned)delete s.summoning.owned; // Derived legacy inventory cache, never an independent entitlement.
 const previousEssence=s.essence;delete s.copies;delete s.party;delete s.masteryCopies;delete s.essence;delete s.essenceSpent;
 const out={version:5,schema:'lorebound-ownership-1',revision:0,progress:s,owned,history,essence:rational(BigInt(previousEssence)+BigInt(p.credit)),pending:null,serial:p.state.serial,receipts:{},receiptFloor:0,drawSequence:0,migration:{sourceHash,selected:[...selected],released:p.released.map(c=>c.id),credit:p.credit}};
 demand(validate(out),'Invalid migration result');return out;
}
function validate(s){try{
 if(!s||s.version!==5||!['lorebound-ownership-1','lorebound-ownership-2','lorebound-ownership-3','lorebound-ownership-4','lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)||!Number.isSafeInteger(s.revision)||s.revision<0||!Number.isSafeInteger(s.serial)||s.serial<0||!qvalid(s.essence)||!Array.isArray(s.owned)||s.owned.length<1||s.owned.length>5)return false;
 if(new Set(s.owned.map(c=>c.id)).size!==s.owned.length||new Set(s.owned.map(c=>c.speciesId)).size!==s.owned.length)return false;
 if(!s.owned.every(c=>known(c.speciesId)&&c.id.startsWith(c.speciesId+'~')&&Number.isSafeInteger(Number(c.id.split('~')[1]))&&Number(c.id.split('~')[1])>0&&Number(c.id.split('~')[1])<=s.serial&&qvalid(c.invested)&&s.history[c.speciesId]>=1))return false;
 if(!s.history||Object.entries(s.history).some(([id,n])=>!known(id)||!Number.isSafeInteger(n)||n<1))return false;
 if(!s.migration||!/^[a-f0-9]{64}$/.test(s.migration.sourceHash)||!Number.isSafeInteger(s.migration.credit)||s.migration.credit<0)return false;
 const p=s.progress;if(s.schema==='lorebound-ownership-10'&&!root.LoreTreasure?.valid(p))return false;if(p?.treasureHall!==undefined&&s.schema!=='lorebound-ownership-10')return false;if(['lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&!root.LoreRecruitment?.valid(p))return false;if(p?.recruitment!==undefined&&!['lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema))return false;if(['lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&!root.LoreExpeditions?.valid(p))return false;if(p?.expeditions!==undefined&&!['lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema))return false;if(['lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&!root.LoreEndless?.valid(p))return false;if(p?.story?.realms?.['1']?.endless!=null&&!['lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema))return false;if(['lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&!root.LoreArmory?.valid(p?.armory))return false;if(p?.armory!==undefined&&!['lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema))return false;if(['lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&!root.LoreStory?.valid(p))return false;if(p?.story!==undefined&&!['lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema))return false;if(['lorebound-ownership-4','lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&p?.realmBalanceVersion!==1)return false;if(p?.realmBalanceVersion!==undefined&&(!['lorebound-ownership-4','lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)||p.realmBalanceVersion!==1))return false;if(['lorebound-ownership-3','lorebound-ownership-4','lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)&&(!root.LoreRealmSystems?.validate(p?.realmSystems)||p?.economyVersion!==2))return false;if(p?.realmSystems!==undefined&&(!['lorebound-ownership-3','lorebound-ownership-4','lorebound-ownership-5','lorebound-ownership-6','lorebound-ownership-7','lorebound-ownership-8','lorebound-ownership-9','lorebound-ownership-10'].includes(s.schema)||!root.LoreRealmSystems?.validate(p.realmSystems)))return false;if(s.schema==='lorebound-ownership-2'&&p?.economyVersion!==2)return false;if(p?.economyVersion!==undefined&&(p.economyVersion!==2||!E.capacities.includes(p.summoning?.autoCapacity)))return false;if(!p||p.version!==4||p.realm!==1||'copies'in p||'party'in p||'masteryCopies'in p||'essence'in p||!Number.isSafeInteger(p.gold)||p.gold<0||!Number.isSafeInteger(p.shards)||p.shards<0)return false;
 if(p.realmSystems?.shardworks&&!p.cleared.includes(60))return false;
 if(!s.receipts||Array.isArray(s.receipts)||Object.keys(s.receipts).length>65||!Number.isSafeInteger(s.receiptFloor)||!Number.isSafeInteger(s.drawSequence)||s.receiptFloor<0||s.drawSequence<s.receiptFloor)return false;
 if(Object.keys(s.receipts).length!==s.drawSequence-s.receiptFloor||Object.keys(s.receipts).some(id=>String(Number(id))!==id||!Number.isSafeInteger(Number(id))||Number(id)<=s.receiptFloor||Number(id)>s.drawSequence))return false;
 const records=Object.keys(s.history).map((id,i)=>({id:id+'~'+(i+1),speciesId:id,at:0}));
 if(!records.length||!R.validate({...p,copies:records,party:{slots:[records[0].id,null,null,null,null]},masteryCopies:s.history,serial:Math.max(s.serial,records.length),essence:0,essenceSpent:0}))return false;
 for(const [id,r] of Object.entries(s.receipts))if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!known(r.speciesId)||!Number.isSafeInteger(r.cost)||r.cost<0||!['Gold','Lore Shards'].includes(r.currency)||(r.currency==='Lore Shards'&&r.cost!==1)||typeof r.settled!=='boolean'||(r.settled&&(!['recruit','replace','release'].includes(r.action)||!Number.isSafeInteger(r.credit)||r.credit<0)))return false;
 const unresolved=Object.entries(s.receipts).filter(([,r])=>!r.settled);if(unresolved.length!==(s.pending?1:0))return false;
 if(s.pending){const x=s.pending,r=s.receipts[x.drawId];if(!known(x.speciesId)||!s.history[x.speciesId]||!r||r.settled)return false;
  // A companion swapped out of the party waits as the same draw's decision: its own record, never also active.
  if(x.displaced===true){const n=Number(x.id.split('~')[1]);if(!x.id.startsWith(x.speciesId+'~')||!Number.isSafeInteger(n)||n<1||n>s.serial||s.owned.some(c=>c.id===x.id||c.speciesId===x.speciesId)||!Number.isSafeInteger(r.swaps)||r.swaps<1)return false;}
  else if(x.displaced!==undefined||r.speciesId!==x.speciesId||x.id!==x.speciesId+'~'+s.serial)return false;}
 return true;
 }catch{return false;}}
function mastery(s,id){demand(known(id),'Unknown species');return R.mastery({masteryCopies:s.history},id);}
function combat(s,id){if(root.LoreArmory?.active(s))return R.combat(hydrate(s),id);const c=s.owned.find(c=>c.id===id);demand(c,'Companion is not active');const x=R.combat({...s.progress,masteryCopies:s.history},id),ratio=(1+.04*mastery(s,c.speciesId))*(1+leveling(s,id).bonus)/(1+R.E.masteryStep*mastery(s,c.speciesId));return {...x,damage:x.damage*ratio,expectedDps:x.expectedDps*ratio};}
function draw(s,drawId,rng=Math.random,now=Date.now()){
 demand(validate(s),'Invalid ownership save');demand(typeof drawId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(drawId)&&!['__proto__','constructor','prototype'].includes(drawId),'Invalid receipt ID');
 const seq=Number(drawId);demand(Number.isSafeInteger(seq)&&seq>0&&String(seq)===drawId,'Use a monotonic draw sequence');if(seq<=s.receiptFloor||Object.hasOwn(s.receipts,drawId))return clone(s);demand(seq===s.drawSequence+1,'Draw sequence conflict');
 demand(!s.pending,'Resolve your pending companion first');const t=R.C.tomes[s.progress.summoning.selected-1],modern=E.active(s),cost=modern?1:t?.price,currency=modern?'Lore Shards':'Gold',balance=modern?'shards':'gold';demand(t&&s.progress.summoning.selected<=s.progress.summoning.unlocked&&s.progress[balance]>=cost,'Not enough '+currency+' or Tome unavailable');
 const roll=rng();demand(Number.isFinite(roll)&&roll>=0&&roll<1,'Invalid draw');let cumulative=0;const h=R.C.companions.find(h=>(cumulative+=E.weight(s,h,t.level)||0)>roll*10000);
 demand(h,'Invalid Tome weights');const out=clone(s);out.drawSequence=seq;out.progress[balance]-=cost;out.progress.summoning.pulls++;out.serial++;out.history[h.id]=(out.history[h.id]||0)+1;
 out.progress.summoning.history.push({ownershipReceipt:drawId,itemId:h.id,name:h.name,rarity:h.rarity,cost,currency,at:now});out.progress.summoning.history=out.progress.summoning.history.slice(-40);
 out.pending={drawId,id:h.id+'~'+out.serial,speciesId:h.id,createdAt:now};out.receipts[drawId]={speciesId:h.id,cost,currency,settled:false};out.revision++;demand(validate(out),'Invalid draw result');return out;
}
function decide(s,drawId,action,replaceId){
 demand(validate(s),'Invalid ownership save');if(Number(drawId)<=s.receiptFloor||s.receipts[drawId]?.settled)return clone(s);
 demand(s.pending?.drawId===drawId,'No matching pending result');demand(['recruit','replace','swap','release'].includes(action),'Invalid companion decision');
 const out=clone(s),incoming={id:s.pending.id,speciesId:s.pending.speciesId,createdAt:s.pending.createdAt,invested:rational(0)};let credit=0;
 if(action!=='release')demand(!out.owned.some(c=>c.speciesId===incoming.speciesId),'This species is already active; release the duplicate');
 // Swap: the incoming companion takes the slot with the approved investment transfer, and the companion it replaces
 // becomes this draw's next decision instead of being released. Its invested Essence has moved, so it waits with
 // none, and no release Essence is paid until it is actually released. The draw stays unsettled until then.
 if(action==='swap'){const i=out.owned.findIndex(c=>c.id===replaceId);demand(i>=0,'Choose an active companion');const old=out.owned[i];incoming.invested=transfer(old.invested,known(old.speciesId).rarity===known(incoming.speciesId).rarity);out.owned[i]=incoming;out.pending={drawId,id:old.id,speciesId:old.speciesId,createdAt:old.createdAt??old.at??0,displaced:true};out.receipts[drawId]={...out.receipts[drawId],swaps:(out.receipts[drawId].swaps||0)+1};out.revision++;R.syncProgress(hydrate(out));demand(validate(out),'Invalid swap result');return out;}
 if(action==='recruit'){demand(out.owned.length<5,'Party is full');out.owned.push(incoming);}
 if(action==='replace'){const i=out.owned.findIndex(c=>c.id===replaceId);demand(i>=0,'Choose an active companion');const old=out.owned[i];incoming.invested=transfer(old.invested,known(old.speciesId).rarity===known(incoming.speciesId).rarity);credit=salvage(old.speciesId);out.owned[i]=incoming;}
 if(action==='release')credit=salvage(incoming.speciesId);
 out.essence=plus(out.essence,rational(credit));out.receipts[drawId]={...out.receipts[drawId],settled:true,action,replaceId:replaceId||null,credit};out.pending=null;const settled=Object.keys(out.receipts).filter(id=>out.receipts[id].settled).sort((a,b)=>Number(a)-Number(b));while(settled.length>64){const id=settled.shift();out.receiptFloor=Number(id);delete out.receipts[id];}out.revision++;R.syncProgress(hydrate(out));demand(validate(out),'Invalid decision result');return out;
}
// Review-selected curve; exact rational investment is the only level source of truth.
const levelMultipliers={Common:1,Uncommon:1.8,Rare:3};
function levelCost(level,rarity){const cost=Math.ceil(3*level**1.6*levelMultipliers[rarity]);demand(Number.isSafeInteger(cost)&&cost>0,'Level cost outside supported arithmetic');return cost;}
// The level of the waiting companion, from the same curve. A pending record holds no investment (a swap moves it to
// the companion that joins), so this reads that real empty investment rather than a fixed label.
function pendingLevel(s){demand(s.pending,'No companion is waiting');const p=s.pending;return leveling({owned:[{id:p.id,speciesId:p.speciesId,invested:p.invested??rational(0)}]},p.id).level;}
function leveling(s,id){const c=s.owned.find(c=>c.id===id);demand(c,'Companion is not active');const rarity=known(c.speciesId).rarity,q=c.invested;let level=1,total=0n,next=BigInt(levelCost(level,rarity));while(BigInt(q.n)>=(total+next)*BigInt(q.d)){total+=next;level++;next=BigInt(levelCost(level,rarity));}const needed=rational((total+next)*BigInt(q.d)-BigInt(q.n),BigInt(q.d));return {level,bonus:.04*(level-1),invested:clone(q),needed,nextCost:Number(next),threshold:String(total+next)};}
function buyLevel(s,id,expectedInvestment){demand(validate(s),'Invalid ownership save');demand(!s.pending,'Resolve the pending companion first');const info=leveling(s,id);demand(JSON.stringify(info.invested)===expectedInvestment,'Level offer changed; refresh before purchasing');const a=s.essence,b=info.needed;demand(BigInt(a.n)*BigInt(b.d)>=BigInt(b.n)*BigInt(a.d),'Not enough Essence');const out=clone(s);out.essence=rational(BigInt(a.n)*BigInt(b.d)-BigInt(b.n)*BigInt(a.d),BigInt(a.d)*BigInt(b.d));out.owned.find(c=>c.id===id).invested=rational(info.threshold);out.revision++;R.syncProgress(hydrate(out));demand(validate(out),'Invalid level purchase');return out;}
// True when the next individual level can be bought right now under buyLevel's own rules: an active companion,
// no pending decision and enough unspent Essence for the exact next cost. Display only; it never buys anything.
function canLevel(s,id){try{if(s?.version!==5||s.pending)return false;const q=leveling(s,id).needed,a=s.essence;return BigInt(a.n)*BigInt(q.d)>=BigInt(q.n)*BigInt(a.d);}catch{return false;}}
function hydrate(s){if(s?.version!==5)return s;
 const fields=new Set([...Object.keys(s.progress),'presentation','bossUnlockedFloor']);
 for(const k of fields)if(!['version','serial','essence'].includes(k)&&!Object.hasOwn(s,k))Object.defineProperty(s,k,{configurable:true,get:()=>s.progress[k],set:v=>s.progress[k]=v});
 if(!Object.hasOwn(s,'copies'))Object.defineProperties(s,{
 copies:{configurable:true,get:()=>s.owned},masteryCopies:{configurable:true,get:()=>s.history},
 party:{configurable:true,get:()=>({slots:[...s.owned.map(c=>c.id),...Array(5-s.owned.length).fill(null)]})}});
 return s;
}
function replaceState(s,next){for(const k of Object.keys(s))delete s[k];Object.assign(s,next);return hydrate(s);}
function result(s){if(!s.pending)return null;const p=s.pending,h=known(p.speciesId),r=s.receipts[p.drawId];return {ok:true,id:Number(p.drawId),drawId:p.drawId,itemId:p.id,species:h.index,rank:h.rank,rarity:h.rarity,name:h.name,type:h.category,isNew:!p.displaced&&(r.isNew??false),masteryUp:!p.displaced&&(r.masteryUp??false),displaced:!!p.displaced,copies:s.history[h.id],autoEquipped:false,cost:r.cost};}
function pull(s,rng,now){try{const id=String(s.drawSequence+1),before={...s.history},next=draw(s,id,rng,now),h=known(next.pending.speciesId);next.receipts[id].isNew=!before[h.id];next.receipts[id].masteryUp=R.mastery({masteryCopies:next.history},h.id)>R.mastery({masteryCopies:before},h.id);replaceState(s,next);R.syncProgress(s);return result(s);}catch(e){return {ok:false,reason:e.message};}}
const api={levelCost,leveling,pendingLevel,buyLevel,canLevel,hydrate,replaceState,result,pull,audit,preview,migrate,validate,rational,transfer,mastery,combat,draw,decide,salvage};root.LoreOwnership=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
