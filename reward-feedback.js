/* Presentation only: floor-clear banners and the "While you were away" summary.
   Reads the reward each transaction already paid. Never pays, saves or changes progress. */
(function(root){'use strict';
const BANNER_MS=3000,SHORT_ABSENCE_SECONDS=60;
const plain=n=>root.LoreUI?.format?root.LoreUI.format(n):String(Math.round(n));
function parts(r,fmt=plain){return [['Gold',r.gold],['Lore Shards',r.shards],['XP',r.xp]].filter(([,n])=>Number.isFinite(n)&&n>0).map(([label,n])=>'+'+fmt(n)+' '+label);}
// Only the first-clear bonus of a story floor, never the kill payment that came with it.
function clearBonus(e){if(!e||e.kind!=='kill'||!e.first||e.farming||!e.bonus||!Number.isInteger(e.clear))return null;const b={floor:e.clear,gold:e.bonus.gold||0,shards:e.bonus.shards||0,xp:e.bonus.xp||0};return parts(b).length?b:null;}
function bannerText(b,fmt=plain){const where=b.first===b.last||b.last===undefined?'Floor '+b.floor+' cleared':'Floors '+b.first+'–'+b.last+' cleared';return parts(b,fmt).join(' · ')+' — '+where;}
function duration(seconds){const m=Math.max(1,Math.floor(seconds/60));if(m<60)return m+'m';const h=Math.floor(m/60),r=m%60;return r?h+'h '+r+'m':h+'h';}
// The offline result is the receipt: its totals are exactly what the engine paid.
function away(r,elapsed,s){if(!r||!(elapsed>SHORT_ABSENCE_SECONDS))return null;const gains=(r.gold||0)>0||(r.shards||0)>0||(r.xp||0)>0||(r.relicDrops||0)>0;if(!gains)return null;
 const floors=Array.isArray(r.floors)?r.floors.length:0,head='While you were away ('+duration(elapsed)+')',line=[...(floors?[floors+(floors===1?' floor':' floors')+' cleared']:[]),...parts(r)].join(' · ');
 let where='';const story=!!s&&root.LoreStory?.active?.(s);
 if(story&&!s.realmComplete&&!r.endless){if(root.LoreStory.isBoss(s.floor))where=floors?'Your party stopped at the Floor '+s.floor+' boss. Boss challenges stay manual.':'Your party kept farming before the Floor '+s.floor+' boss.';else where='Your party is on Floor '+s.floor+'.';}
 return {head,line,where,floors,capped:!!r.capped,rewarded:r.capped?duration(r.seconds):''};}
// Two settled episodes still waiting to be shown become one panel with their exact totals.
function merge(a,b){const x=a.r,y=b.r,sum=k=>(x[k]||0)+(y[k]||0);return {elapsed:a.elapsed+b.elapsed,r:{...y,seconds:sum('seconds'),kills:sum('kills'),gold:sum('gold'),shards:sum('shards'),xp:sum('xp'),relicDrops:sum('relicDrops'),floors:[...(x.floors||[]),...(y.floors||[])],newRelics:[...(x.newRelics||[]),...(y.newRelics||[])],capped:!!(x.capped||y.capped),encounterCap:!!(x.encounterCap||y.encounterCap),interruptedBoss:!!(x.interruptedBoss||y.interruptedBoss)}};}
let queue=[],showing=null,timer=null;
function reduced(){return !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
function el(){return root.document?.getElementById?.('clearBanner')||null;}
// The banner belongs to the Adventure screen: another tab (#game.area-open or the destination page), the summon
// scene, any open sheet or popup (an open <dialog>) or a hidden page means it is not in view.
function inView(){const d=root.document;if(!d)return true;if(d.hidden)return false;const g=d.getElementById?.('game');if(g?.classList?.contains?.('area-open'))return false;
 for(const id of ['destinationPage','summonSheet']){const n=d.getElementById?.(id);if(n&&n.hidden===false)return false;}
 return !d.querySelector?.('dialog[open]');}
function next(){showing=null;const b=el();if(!b)return;if(!queue.length||!inView()){queue=[];b.hidden=true;b.textContent='';return;}
 // A fast party can clear several floors at once; anything waiting shows as one exact total.
 const items=queue.splice(0),sum={floor:items[0].floor,first:items[0].floor,last:items.at(-1).floor,gold:0,shards:0,xp:0};for(const x of items){sum.gold+=x.gold;sum.shards+=x.shards;sum.xp+=x.xp;}
 showing=sum;b.textContent=bannerText(sum);b.classList?.toggle('still',reduced());b.hidden=false;b.classList?.remove('show');void b.offsetWidth;b.classList?.add('show');timer=setTimeout(next,BANNER_MS);}
const seen=new Set();
// A clear made while another screen is in view is marked seen and dropped, so it never replays later.
function announce(e){const x=clearBonus(e);if(!x||seen.has(x.floor))return false;seen.add(x.floor);if(!inView()){hide();return false;}queue.push(x);if(!showing)next();return true;}
function hide(){clearTimeout(timer);queue=[];showing=null;const b=el();if(b){b.hidden=true;b.textContent='';}}
// Called every combat tick: leaving Adventure or opening a sheet hides the banner at once and drops anything queued.
function check(){if((showing||queue.length)&&!inView())hide();}
root.LoreRewardFeedback={BANNER_MS,SHORT_ABSENCE_SECONDS,parts,clearBonus,bannerText,duration,away,merge,announce,hide,check,inView,get queued(){return queue.length+(showing?1:0);}};
if(typeof module!=='undefined')module.exports=root.LoreRewardFeedback;
})(globalThis);
