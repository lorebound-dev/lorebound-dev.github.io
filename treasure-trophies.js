/* Hall of Triumphs trophies. Read-only display goals derived from existing records: no rewards, claims or save writes. First-view notes for the Crown and Sixfold Covenant live on this device only. */
(function(root){'use strict';
const R=()=>root.LoreRealm,T=()=>root.LoreTreasure,N=()=>root.LoreEndless,S=()=>root.LoreStory;
const SEEN_KEY='lorebound-hall-trophies-seen',LOCAL=Object.freeze(['realm-conqueror','sixfold-covenant']);
const order=Object.freeze([
 // Requirements stay one short line, like the approved plaque, so they fit its dark inset on a 320px phone.
 {id:'realm-conqueror',name:'Crown of the Conqueror',requirement:'Defeat the Floor 100 Story boss',unit:null},
 {id:'whole-chronicle',name:'The Whole Chronicle',requirement:'Discover all 30 Realm 1 companions',unit:'discovered'},
 {id:'sixfold-covenant',name:'The Sixfold Covenant',requirement:'Mastery VI in each of the six families',unit:'families at Mastery VI'},
 {id:'guardian-memorial',name:'Guardian Memorial',requirement:'Find all ten guardian relics',unit:'relics found'},
 {id:'last-vigil',name:'The Last Vigil',requirement:'All ten guardian relics at Mastery VI',unit:'relics at Mastery VI'}]);
const awarded=(s,id)=>T().ledger(s)?.awards?.includes(id)===true;
function families(s){const max=R().C.economy.masteryMax,copies={masteryCopies:s.history};return R().C.categories.filter(c=>R().C.companions.some(h=>h.category===c&&R().mastery(copies,h.id)>=max));}
function progress(s){const list=T().groups(s),entries=id=>list.find(g=>g.id===id)?.entries||[],companions=entries('companions'),relics=entries('relics'),found=companions.filter(e=>e.known).length,relicsFound=relics.filter(e=>e.known).length,mastered=relics.filter(e=>e.rank===e.maxRank).length,memorial=!!N().record(s).memorial,story=S().record(s),six=families(s).length;
 return {
  'realm-conqueror':{earned:s.realmComplete===true&&!!story?.completion,found:null,total:null},
  'whole-chronicle':{earned:companions.length===30&&found===30||awarded(s,'realm1-companions'),found,total:companions.length},
  'sixfold-covenant':{earned:six===R().C.categories.length,found:six,total:R().C.categories.length},
  'guardian-memorial':{earned:memorial,found:memorial?relics.length:relicsFound,total:relics.length},
  'last-vigil':{earned:relics.length>0&&mastered===relics.length||awarded(s,'relics-mastered'),found:mastered,total:relics.length}};}
function list(s){const p=progress(s);return order.map(t=>{const x=p[t.id],earned=!!x.earned,status=earned?'Unlocked':t.unit?`${x.found} / ${x.total} ${t.unit}`:'Locked';return {...t,earned,found:earned&&x.total!=null?x.total:x.found,total:x.total,status};});}
function earnedCount(s){return list(s).filter(t=>t.earned).length;}
function seen(){try{const v=JSON.parse(root.localStorage.getItem(SEEN_KEY)||'[]');return Array.isArray(v)?v.filter(id=>LOCAL.includes(id)):[];}catch{return [];}}
function unseen(s){const done=seen();return list(s).filter(t=>t.earned&&LOCAL.includes(t.id)&&!done.includes(t.id)).map(t=>t.id);}
function markSeen(ids){try{const next=[...new Set([...seen(),...ids.filter(id=>LOCAL.includes(id))])];root.localStorage.setItem(SEEN_KEY,JSON.stringify(next));return true;}catch{return false;}}
root.LoreTrophies={SEEN_KEY,LOCAL,order,list,earnedCount,families,unseen,markSeen};if(typeof module!=='undefined')module.exports=root.LoreTrophies;
})(globalThis);
