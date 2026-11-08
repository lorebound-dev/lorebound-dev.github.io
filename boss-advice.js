/* Advisory boss readiness and boss-outcome wording. Read-only: it never changes boss HP, the timer, unlocks,
   rewards or saves. The recommended Party DPS is the boss's HP over the boss timer with a 10% margin. */
(function(root){
'use strict';
const MARGIN=1.1;
const R=()=>root.LoreRealm||(typeof require==='function'?require('./realm1.js'):null);
const pad=n=>String(n).padStart(3,'0');
// Same rounding as the Party DPS shown at the top of Adventure, so the two numbers always agree on screen.
function shown(n){if(n<1000)return Math.round(n*10)/10;return Math.round(n);}
function text(n){const v=shown(n);return v<1000?String(v):(typeof root.fmt==='function'?root.fmt(v):v.toLocaleString('en-US'));}
function recommended(hp,seconds){return Math.ceil(hp/seconds*MARGIN);}
function story(s){return !!root.LoreStory?.active(s);}
// The floors a player farms while a boss floor waits. Story saves farm the cleared floors before the boss.
function farmRange(s){return story(s)&&root.LoreStory.isBoss(s.floor)?[s.floor-9,s.floor-1]:null;}
function advice(s){
 const E=R().E,hp=R().bossHp(s),seconds=E.bossSeconds,need=recommended(hp,seconds),dps=R().total(s);
 return {hp,seconds,need,dps,ready:shown(dps)>=need};
}
function buttonLine(a){return `Party DPS ${text(a.dps)} · ${text(a.need)} advised`;}
// The same two numbers for a narrow row, where the quest's Claim plaque shares the space (320 wide).
function buttonShort(a){return `DPS ${text(a.dps)} / ${text(a.need)}`;}
function buttonLabel(a,s){
 const farm=farmRange(s);
 return `Challenge Boss. Party DPS ${text(a.dps)}. Recommended ${text(a.need)} to beat ${text(a.hp)} HP in ${a.seconds} seconds. `+
  (a.ready?'Your party meets the estimate.':'Your party is below the estimate.')+' This is an estimate, not a promise: attack timing and critical hits change the result.'+
  (farm?` Until you challenge, your party farms cleared Floors ${pad(farm[0])} to ${pad(farm[1])} for Gold.`:'');
}
function roomNote(a){
 return a.ready
  ?`Party DPS ${text(a.dps)} · ${text(a.need)} advised. Keep tapping: attack timing still decides the fight.`
  :`Party DPS ${text(a.dps)} · ${text(a.need)} advised. Tap the boss to add damage. Flee any time at no cost.`;
}
function failureText(kind,a,s){
 const farm=farmRange(s),parts=[];
 parts.push(kind==='flee'?'Your party returns safely.':'The guardian still stands.');
 if(kind!=='flee'){
  if(a.ready)parts.push(`Your Party DPS of ${text(a.dps)} meets the ${text(a.need)} estimate, so this one is close. Tap the boss throughout the fight to add damage.`);
  else parts.push(`Your Party DPS is ${text(a.dps)}; about ${text(a.need)} is advised. Summon new companions, or level a companion with Essence, then try again.`);
 }
 parts.push('The boss stays unlocked, and there is no penalty for trying again. No boss rewards were awarded.');
 if(farm)parts.push(`Meanwhile your party farms cleared Floors ${pad(farm[0])} to ${pad(farm[1])} for Gold.`);
 return parts.join(' ');
}
// Victory wording from the clear the engine just recorded.
function victoryText(event,s){
 if(event.realmBoss)return null;
 if(!event.first)return 'The guardian falls again. First-clear rewards were already claimed.';
 if(story(s)&&root.LoreStory.isBoss(event.clear))return `Chapter complete. Floor ${pad(event.clear+1)} begins the next chapter of the ruins. Floors ${pad(event.clear-9)} to ${pad(event.clear)} stay cleared.`;
 return 'The path deeper into the ruins opens.';
}
const api={MARGIN,recommended,advice,shown,text,farmRange,buttonLine,buttonShort,buttonLabel,roomNote,failureText,victoryText};
root.LoreBossAdvice=api;
if(typeof module!=='undefined')module.exports=api;
})(globalThis);
