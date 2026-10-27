/* Dev tools for the LOREBOUND test site only (https://lorebound-dev.github.io/dev.html).
   This file lives in pocket-fortune/tools/test-site and never in pocket-fortune/dist, because everything in dist goes live.
   .github/workflows/publish-test.yml copies it onto the test site next to each test build.
   It loads the same save code as Save backups, changes the save only through the game's own rules, and stores the
   result the way Save backups imports a file: checked, with a recovery copy of the old save and a verified write. */
(function(root){'use strict';
const LOCK='lorebound-realm1-writer',LENT=1e12; // Gold and Lore Shards lent to the Tome unlocks, then taken back
const game=()=>({R:root.LoreRealm,O:root.LoreOwnership,S:root.LoreSaveStorage,E:root.LoreEconomy});
const group=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
function essenceText(q){const n=BigInt(q.n),d=BigInt(q.d),rest=n%d;return group(n/d)+(rest?' '+rest+'/'+d:'');}
function values(s){const {R}=game();return {floor:s.realmComplete?R.E.floors+', all cleared':String(s.floor),gold:group(s.gold),shards:group(s.shards),essence:essenceText(s.essence),tome:s.summoning.unlocked+' of '+R.C.tomes.length};}

// Each change works on a copy of the save. The copy is kept only if the change worked and the game's own save check accepts it.
function change(current,edit){const {O}=game(),next=O.hydrate(JSON.parse(JSON.stringify(current)));let result;
 try{result=edit(next);}catch(e){return {ok:false,text:'The game stopped that change: '+(e?.message||e),state:current};}
 if(!result.ok)return {...result,state:current};
 if(!O.validate(JSON.parse(JSON.stringify(next))))return {ok:false,text:'The game’s save check didn’t accept that change, so it wasn’t made.',state:current};
 return {...result,state:next};}

function addCurrency(s,key,amount,name){const next=s[key]+amount;
 if(!Number.isSafeInteger(next))return {ok:false,text:'A save can’t hold that much '+name+'.'};
 s[key]=next;game().R.syncProgress(s);return {ok:true,text:'Added '+group(amount)+' '+name+'.'};}
// Essence is an exact fraction {n,d} in the save; the game's own rational() keeps it in lowest terms, which the save check requires.
function addEssence(s,amount){const {R,O}=game(),q=s.essence;
 s.essence=O.rational(BigInt(q.n)+BigInt(amount)*BigInt(q.d),BigInt(q.d));R.syncProgress(s);return {ok:true,text:'Added '+group(amount)+' Essence.'};}

// Wins each fight the way the game does: a boss floor starts its boss fight first, then the hit ends the fight, and the
// game hands out that floor's Gold, Lore Shards and XP and updates quests. A fight the game won't end stops the loop.
function clearThrough(s,last){const {R}=game();
 if(s.realmComplete)return {ok:false,text:'All '+R.E.floors+' floors are already cleared.'};
 if(s.floor>last)return {ok:false,text:'Floor '+last+' is already cleared.'};
 const first=s.floor,gold=s.gold,shards=s.shards,xp=s.playerXp;
 for(let fights=0;!s.realmComplete&&s.floor<=last&&fights<10000;fights++){if(R.ready(s))R.startBoss(s);if(!R.damage(s,1e300))break;}
 const done=s.realmComplete?R.E.floors:s.floor-1;
 if(done<first)return {ok:false,text:'The game didn’t let that fight end, so nothing changed.'};
 const found=s.shards-shards;
 return {ok:true,text:'Cleared '+(done===first?'Floor '+first:'Floors '+first+'–'+done)+'.'+(s.realmComplete?' Realm 1 is complete.':'')+(done<last&&!s.realmComplete?' The game stopped at Floor '+s.floor+'.':'')+' The game gave its usual rewards: '+group(s.gold-gold)+' Gold, '+group(found)+' Lore Shard'+(found===1?'':'s')+' and '+group(s.playerXp-xp)+' XP.'};}

// Unlocks each next Tome with the game's own unlock, on lent Gold and Lore Shards, then puts the old amounts back.
// The game still checks everything else, such as how many species have been discovered.
function unlockTomes(s){const {R}=game(),total=R.C.tomes.length,from=s.summoning.unlocked,gold=s.gold,shards=s.shards;
 if(from>=total)return {ok:false,text:'Every Tome is already unlocked.'};
 let refused=null;s.gold=LENT;s.shards=LENT;
 try{for(let i=0;i<total&&s.summoning.unlocked<total;i++){const r=R.upgradeTome(s);if(!r?.ok){refused=r?.reason||'no reason given';break;}}}
 finally{s.gold=gold;s.shards=shards;}
 R.syncProgress(s);
 const to=s.summoning.unlocked,opened=to===from?'':to===from+1?'Unlocked Tome '+to+'. ':'Unlocked Tomes '+(from+1)+'–'+to+'. ';
 if(!refused)return {ok:true,text:opened+'Every Tome is open, and no Gold was spent.'};
 return {ok:to>from,text:opened+whyNot(s,refused)};}
function whyNot(s,reason){const need=game().E?.requirement?.(s);
 if(need&&need.found<need.discoveries)return 'Tome '+need.level+' needs '+need.discoveries+' species discovered, and this save has '+need.found+'. Summon in the game to discover more, then try again.';
 if(s.pending)return 'First finish your summon in the game: choose what to do with the companion that’s waiting. Then try again.';
 return 'The game said: '+reason+'.';}

const actions={gold:n=>s=>addCurrency(s,'gold',n,'Gold'),shards:n=>s=>addCurrency(s,'shards',n,'Lore Shards'),essence:n=>s=>addEssence(s,n),
 floors:n=>s=>clearThrough(s,Math.min(game().R.E.floors,s.floor+n-1)),through:n=>s=>clearThrough(s,n),all:()=>s=>clearThrough(s,game().R.E.floors),tomes:()=>s=>unlockTomes(s)};

// Save backups' own list of scripts, in order, minus its page code. It always matches the build the test site shows.
async function loadGameScripts(){const page=await fetch('save-backups.html',{cache:'no-cache'});
 if(!page.ok)throw Error('save-backups.html: '+page.status);
 const doc=new DOMParser().parseFromString(await page.text(),'text/html'),list=[...doc.querySelectorAll('script[src]')].map(x=>x.getAttribute('src')).filter(src=>!/^(\.\/)?save-backups(-page)?\.js([?#]|$)/.test(src));
 if(!list.length)throw Error('save-backups.html lists no scripts');
 for(const src of list)await new Promise((resolve,reject)=>{const x=document.createElement('script');x.src=new URL(src,page.url).href;x.onload=resolve;x.onerror=()=>reject(Error('could not load '+src));document.head.appendChild(x);});
 if(!root.LoreSaveStorage||!root.LoreRealm||!root.LoreOwnership)throw Error('the save code is missing');}

function start(){const $=id=>document.getElementById(id),buttons=[...document.querySelectorAll('[data-do]')];
 // phase: loading → ready → saved, or stopped (no save to change) / blocked (this page can't save any more)
 let repo=null,state=null,baseRaw='',base=null,phase='loading',busy=false,committing=false,note='';
 const changed=()=>!!state&&JSON.stringify(state)!==baseRaw;
 function render(){const ready=phase==='ready'&&!busy;
  $('loading').hidden=phase!=='loading';
  for(const b of buttons)b.disabled=!ready;
  $('save').disabled=!ready;$('back').disabled=$('startOver').disabled=$('backups').disabled=busy;
  $('back').textContent=changed()&&phase!=='saved'?'Back without saving':'Back to the game';
  $('savebar').hidden=!state;
  if(!state)return;
  const now=values(state);for(const k of Object.keys(now)){$(k).textContent=now[k];$(k+'Was').textContent=now[k]===base[k]?'':'was '+base[k];}
  const pending=note||(phase==='blocked'?(changed()?'These changes weren’t saved.':''):changed()?'Not saved yet. Tap Save and play to keep these changes.':'No changes yet.');
  if($('pending').textContent!==pending)$('pending').textContent=pending;
  $('savebar').classList.toggle('changed',changed());}
 function problem(text,{retry=false,backups=false}={}){phase=state?'blocked':'stopped';
  $('noticeText').textContent=text;$('retry').hidden=!retry;$('backups').hidden=!backups;$('notice').hidden=false;$('tools').hidden=!state;render();}
 async function leave(url){busy=true;render();try{repo?.release();}catch{}
  // Let go of the save lock before the next page asks for it, so it doesn't think the game is open somewhere else.
  try{for(let i=0;i<40&&root.navigator?.locks?.query;i++){const {held=[]}=await root.navigator.locks.query();if(!held.some(l=>l.name===LOCK))break;await new Promise(r=>setTimeout(r,25));}}catch{}
  root.location.href=url;}
 async function save(){if(phase!=='ready'||busy)return;
  if(!changed())return leave('home.html');
  busy=true;note='Saving…';render();
  try{const {S}=game(),prepared=await S.prepare(JSON.stringify(state));
   if(prepared.kind!=='current'||prepared.version!==5)throw Error('The changed save didn’t check out.');
   committing=true;repo.commit(repo.preview(prepared),true);}
  catch(e){committing=false;busy=false;note='Nothing was saved. '+(e?.message||e);render();if(repo.blocked)problem('This page can’t save any more. Tap Try again to start from the latest test save.',{retry:true});return;}
  phase='saved';note='Saved. Opening the game…';leave('home.html');}
 function ready(result){const {S}=game();
  if(result.kind==='missing')return problem('There’s no test save yet. Open the test game and choose an egg, then come back here.');
  if(result.kind==='interrupted')return problem('An earlier save change didn’t finish. Open Save backups to sort it out, or tap Start over.',{backups:true});
  if(result.kind==='legacy')return problem('This test save is from an older version of the game. Open Save backups to bring it up to date, or tap Start over.',{backups:true});
  if(result.kind!=='current')return problem('The dev tools can’t read this test save. The game’s save check said: “'+(result.error||result.kind)+'” If the test game still plays it fine, tell Noah. Otherwise open Save backups, or tap Start over.',{backups:true});
  let update=true;try{update=result.state?.version!==5||S.needsUpdate(result.state);}catch(e){return problem('The dev tools couldn’t check this save, so tell Noah. The error was: '+(e?.message||e));}
  if(update)return problem('Open the test game once first, so it can update your save. Then come back here.');
  if(!repo.exclusive)return problem('This browser can’t change saves safely. Try a newer browser.');
  const raw=JSON.stringify(result.state),was=values(result.state);
  state=result.state;baseRaw=raw;base=was;phase='ready';$('notice').hidden=true;$('tools').hidden=false;render();}
 for(const b of buttons)b.addEventListener('click',()=>{if(phase!=='ready'||busy)return;const r=change(state,actions[b.dataset.do](Number(b.dataset.n||0)));state=r.state;note='';b.closest('section').querySelector('.result').textContent=r.text;render();});
 $('save').addEventListener('click',save);
 $('back').addEventListener('click',()=>leave('home.html'));
 $('startOver').addEventListener('click',()=>leave('reset.html'));
 $('backups').addEventListener('click',()=>leave('save-backups.html'));
 $('retry').addEventListener('click',()=>root.location.reload());
 root.addEventListener('pageshow',e=>{if(e.persisted)root.location.reload();});
 render();
 loadGameScripts().then(()=>{const {S}=game();
  try{repo=S.create(S.browserAdapter(),{locks:root.navigator?.locks,onBlock:reason=>{if(!committing&&phase==='ready')problem('The test save changed somewhere else, so these changes can’t be saved. Close other tabs with the test game, then tap Try again. ('+reason+')',{retry:true});}});}
  catch(e){return problem('The test save couldn’t be opened: '+(e?.message||e)+' Tap Try again.',{retry:true});}
  root.addEventListener('storage',e=>repo.external(e));
  root.addEventListener('pagehide',()=>repo.release());
  repo.start(ready,e=>problem(e?.code==='writer'?'The test game is open in another tab or window. Close it, then tap Try again.':'The test save couldn’t be opened: '+(e?.message||e)+' Tap Try again.',{retry:true}));
  setInterval(()=>repo.heartbeat(),10000);
 },e=>problem('The dev tools couldn’t load the game’s save code ('+(e?.message||e)+'). Check your connection, then tap Try again.',{retry:true}))
 .catch(e=>problem('Something went wrong: '+(e?.message||e)+' Tap Try again.',{retry:true}));}

const api={change,actions,values,essenceText,addCurrency,addEssence,clearThrough,unlockTomes};
root.LoreDevTools=api;
if(typeof module!=='undefined')module.exports=api;
if(typeof document!=='undefined')start();
})(globalThis);
