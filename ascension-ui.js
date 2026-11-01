/* Ascension screen for the fourth tab (test prototype). Rules live in ascension-core.js.
   Runs only on the test site and local copies; the real game keeps the Arena placeholder.
   Keeps its own run under one localStorage key and never touches the LOREBOUND save. */
(function(root){'use strict';
const A=root.LoreAscensionCore,F=root.LoreAscensionFigure,PLANNED_BONUS=0.5,HOSTS=['lorebound-dev.github.io','localhost','127.0.0.1',''],STEP=1000/(A?.TICKS||20),MAX_STEPS=400,SAVE_MS=5000,PAINT_MS=200;
let figureKey='',state=null,box=null,el=null,raf=0,lastT=0,acc=0,lastSave=0,lastPaint=0,warn='',labelled=false;
function enabled(){try{return !!A&&HOSTS.includes(String(root.location?.hostname??'-'));}catch{return false;}}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function fmt(n){n=Math.floor(n);if(!Number.isFinite(n))return '∞';const a=Math.abs(n);if(a<1000)return String(n);const u=['k','M','B','T','Qa','Qi'];let i=-1,v=a;while(v>=1000&&i<u.length-1){v/=1000;i++;}return (n<0?'-':'')+(v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2))+u[i];}
const pct=x=>Math.max(0,Math.min(100,x*100)).toFixed(1)+'%';
const ageText=s=>{const d=Math.floor(s.days),y=Math.floor(d/A.YEAR);return `${y} years, ${d-y*A.YEAR} days`;};
const effectText=(n,s)=>{const sk=A.skill[n],e=A.skillEffect(s,n);return sk.effect<0?`×${e.toFixed(2)} ${sk.about}`:`+${((e-1)*100).toFixed(0)}% ${sk.about}`;};
const needText=(s,n)=>A.NEEDS[n].map(([t,l])=>`${t} ${Math.min(s.tasks[t].level,l)}/${l}`).join(' · ');

function load(){let raw=null;try{raw=localStorage.getItem(A.KEY);}catch{warn='This device would not open the Ascension save. Progress here may not be kept. Your LOREBOUND save is not affected.';return A.fresh();}
 if(raw===null)return A.fresh();let s=null;try{s=A.validate(JSON.parse(raw));}catch{}
 if(!s)warn='The saved Ascension run could not be read, so a new life has started. Your LOREBOUND save is not affected.';return s||A.fresh();}
function persist(){if(!state)return;try{localStorage.setItem(A.KEY,JSON.stringify(state));if(warn.startsWith('Could not save'))warn='';}catch{warn='Could not save this Ascension run on this device. Progress here may be lost. Your LOREBOUND save is not affected.';}lastSave=performance.now();}

// The fourth tab is named Ascend with its approved emblem in home.html on every host, so nothing is relabelled here any more.
function label(){labelled=true;}

function rows(kind,list,s){return list.map(([n])=>`<li data-row="${kind}" data-name="${esc(n)}"><button type="button" data-pick="${kind}" data-name="${esc(n)}"><span class="asc-row-name">${esc(n)}</span><span class="asc-row-meta"></span></button>${kind==='job'||kind==='skill'?'<div class="asc-bar" aria-hidden="true"><i></i></div>':''}</li>`).join('');}
function group(title,kind,table,open){return `<details class="asc-group"${open?' open':''}><summary>${esc(title)}</summary><ul class="asc-rows">${rows(kind,table)}</ul></details>`;}
function build(){const J=A.JOBS,S=A.SKILLS;box.innerHTML=`<section class="ascension" aria-label="Ascend">
<p class="asc-intro">Guide a separate adventurer through one lifetime of work and study, then be reborn stronger. Nothing here is earned or spent in your LOREBOUND save.</p>
<p class="asc-warn" data-a="warn" role="status" hidden></p>
<div class="asc-hero"><figure class="asc-figure"><div class="asc-figure-frame" data-a="figure"></div><figcaption><strong data-a="figTitle"></strong><span class="asc-lives" data-a="figLives"></span></figcaption></figure><dl class="asc-status"><div><dt>Age</dt><dd data-a="age"></dd></div><div><dt>Coins</dt><dd data-a="coins"></dd></div><div><dt>Net per day</dt><dd data-a="net"></dd></div><div><dt>Job XP per day</dt><dd data-a="rate"></dd></div></dl></div>
<div class="asc-bar asc-life" aria-hidden="true"><i data-a="lifeBar"></i></div><p class="asc-note" data-a="lifeNote"></p>
<div class="asc-active">
 <article class="asc-card"><span class="asc-kicker">Job</span><h3 data-a="jobName"></h3><p class="asc-level" data-a="jobLevel"></p><div class="asc-bar" aria-hidden="true"><i data-a="jobBar"></i></div><p class="asc-note" data-a="jobInfo"></p></article>
 <article class="asc-card"><span class="asc-kicker">Skill</span><h3 data-a="skillName"></h3><p class="asc-level" data-a="skillLevel"></p><div class="asc-bar" aria-hidden="true"><i data-a="skillBar"></i></div><p class="asc-note" data-a="skillInfo"></p></article>
</div>
<div class="asc-auto"><label><input type="checkbox" data-auto="autoPromote"> Auto promote</label><label><input type="checkbox" data-auto="autoLearn"> Auto learn</label><p class="asc-note" data-a="autoNote"></p></div>
<details class="asc-list" open><summary>Careers</summary>${group('Labor','job',J.Labor,true)}${group('Martial','job',J.Martial,false)}${group('Arcane','job',J.Arcane,false)}</details>
<details class="asc-list"><summary>Skills</summary>${group('Fundamentals','skill',S.Fundamentals,true)}${group('Combat','skill',S.Combat,false)}${group('Magic','skill',S.Magic,false)}</details>
<details class="asc-list"><summary>Market</summary><p class="asc-note" data-a="shopNote"></p>${group('Homes','home',A.HOMES,true)}${group('Goods','good',A.GOODS,false)}</details>
<section class="asc-rebirth"><h3>Rebirth</h3><p class="asc-note" data-a="rebirthNote"></p><button type="button" class="asc-button" data-act="preview">Prepare rebirth</button><div class="asc-confirm" data-a="rebirthBox" hidden></div></section>
<footer class="asc-footer"><div class="asc-speed" role="group" aria-label="Review speed"><span>Review speed (test site only)</span>${[1,10,50].map(x=>`<button type="button" data-speed="${x}" aria-pressed="false">${x}×</button>`).join('')}</div>
<button type="button" class="asc-button asc-quiet" data-act="reset">Start Ascension over</button><div class="asc-confirm" data-a="resetBox" hidden></div>
<p class="asc-note">Based on Progress Knight by ihtasham42, which is in the public domain. Names, prices and pacing are a test, not final.</p></footer></section>`;
 const q=s=>box.querySelector(s);el={root:q('.ascension'),rows:[...box.querySelectorAll('[data-row]')].map(li=>({li,kind:li.dataset.row,name:li.dataset.name,btn:li.querySelector('button'),meta:li.querySelector('.asc-row-meta'),bar:li.querySelector('.asc-bar i')})),auto:[...box.querySelectorAll('[data-auto]')],speed:[...box.querySelectorAll('[data-speed]')],preview:q('[data-act=preview]')};
 for(const n of box.querySelectorAll('[data-a]'))el[n.dataset.a]=n;figureKey='';
 el.root.addEventListener('click',click);el.root.addEventListener('change',change);}

const set=(node,prop,v)=>{if(node&&node[prop]!==v)node[prop]=v;};
const width=(node,v)=>{if(node&&node.style.width!==v)node.style.width=v;};
function paint(){const s=state;if(!el)return;
 set(el.warn,'textContent',warn);
 if(F){const f=F.svg(A,s);if(f.key!==figureKey){figureKey=f.key;el.figure.innerHTML=f.html;}set(el.figTitle,'textContent',f.title);}
 const lives=s.rebirths+1,gems='<i class="asc-diamond" aria-hidden="true"></i>'.repeat(Math.min(s.rebirths,10));if(el.figLives.dataset.lives!==String(lives)){el.figLives.dataset.lives=String(lives);el.figLives.innerHTML=gems+'<span>Life '+lives+'</span>';}set(el.warn,'hidden',!warn);
 const net=A.income(s)-A.expense(s),life=A.lifespan(s);
 set(el.age,'textContent',ageText(s));set(el.coins,'textContent',fmt(s.coins));set(el.net,'textContent',(net>=0?'+':'')+fmt(net));set(el.rate,'textContent',fmt(A.xpGain(s,s.job)));
 width(el.lifeBar,pct(s.days/life));
 set(el.lifeNote,'textContent',A.alive(s)?`Lifespan ${Math.floor(life/A.YEAR)} years · time runs ${(A.speed(s)/4).toFixed(2)}× · income ${fmt(A.income(s))} − upkeep ${fmt(A.expense(s))} per day`:'Your adventurer has died of old age. Time has stopped. Rebirth to start a new life.');
 for(const k of ['job','skill']){const n=s[k],t=s.tasks[n];set(el[k+'Name'],'textContent',n);set(el[k+'Level'],'textContent',`Level ${t.level}${t.maxLevel?` · best ${t.maxLevel}`:''}`);width(el[k+'Bar'],pct(t.xp/A.maxXp(s,n)));
  set(el[k+'Info'],'textContent',k==='job'?`${fmt(A.income(s))} Coins per day · ${fmt(A.xpGain(s,n))} XP per day`:`${effectText(n,s)} · ${fmt(A.xpGain(s,n))} XP per day`);}
 const auto=A.unlocked(s,'automation');for(const c of el.auto){set(c,'disabled',!auto);set(c,'checked',!!s[c.dataset.auto]);}
 set(el.autoNote,'textContent',auto?'Auto promote moves to the next job in the same career once it unlocks. Auto learn trains the unlocked skill that is quickest to level.':`Automation unlocks at age ${A.AUTO_AGE}.`);
 const shop=A.unlocked(s,'shop');set(el.shopNote,'textContent',shop?'Homes and goods cost Coins every day. If Coins run out, you lose them all and become homeless.':`The market opens once you have ${A.SHOP_COINS} Coins.`);
 const hidden={};for(const r of el.rows){const {kind,name:n}=r;let on=false,meta='',show=true,pick=false;
  if(kind==='job'||kind==='skill'){on=A.unlocked(s,n);pick=s[kind]===n;const t=s.tasks[n];
   if(on){meta=`Lv ${t.level} · `+(kind==='job'?`${fmt(A.job[n].income*(1+Math.log10(t.level+1)))}/day`:effectText(n,s));width(r.bar,pct(t.xp/A.maxXp(s,n)));}
   else{show=!hidden[kind+(A.job[n]||A.skill[n]).branch];hidden[kind+(A.job[n]||A.skill[n]).branch]=true;meta='Needs '+needText(s,n);width(r.bar,'0%');}}
  else{const item=kind==='home'?A.home[n]:A.good[n];on=n==='Homeless'||A.canBuy(s,n);pick=kind==='home'?s.home===n:s.goods.includes(n);
   const what=kind==='home'?`×${item.effect} happiness`:`×${item.effect} ${item.about}`;meta=on?`${what} · ${fmt(Math.round(item.upkeep*A.skillEffect(s,'Bargaining')))}/day`:`Opens at ${fmt(item.unlock)} Coins`;}
  set(r.li,'hidden',!show);set(r.btn,'disabled',!on);r.li.classList.toggle('is-active',pick);r.li.classList.toggle('is-locked',!on);set(r.meta,'textContent',meta);r.btn.setAttribute('aria-pressed',String(pick));}
 const ready=A.unlocked(s,'rebirth');set(el.preview,'disabled',!ready);
 set(el.rebirthNote,'textContent',(ready?'Your adventurer is old enough to be reborn. Each job and skill keeps its best level as a lasting XP bonus.':`Rebirth opens at age ${A.REBIRTH_AGE}. Each job and skill then keeps its best level as a lasting XP bonus: +10% XP for every best level.`)+(s.rebirths?` Rebirths so far: ${s.rebirths}.`:'')+` Planned reward, not switched on yet: +${PLANNED_BONUS}% companion damage in Adventure for each rebirth.`);
 for(const b of el.speed){const p=String(s.speed===Number(b.dataset.speed));if(b.getAttribute('aria-pressed')!==p)b.setAttribute('aria-pressed',p);}}

function showRebirth(){const p=A.rebirthPreview(state),top=p.rows.slice(0,5).map(r=>`<li>${esc(r.name)}: ×${r.before.toFixed(1)} → ×${r.after.toFixed(1)} XP</li>`).join('');
 el.rebirthBox.innerHTML=`<strong>Start a new life?</strong><p class="asc-note">Resets: age (back to 14), Coins, every job and skill level, home and goods. Automation and the market stay open.</p><p class="asc-note">Stays: each job and skill's best level, as a lasting XP bonus.${p.rows.length?'':' None of your levels beat your best yet, so this life adds no new bonus.'}</p>${top?`<ul class="asc-bonus">${top}</ul>`:''}<p class="asc-note asc-planned">Planned reward, not switched on yet: this rebirth would add +${PLANNED_BONUS}% companion damage in Adventure, for a total of +${((state.rebirths+1)*PLANNED_BONUS).toFixed(1)}%. It is waiting for Noah's OK, so nothing in Adventure changes for now.</p><p class="asc-note">Only this minigame resets. Your LOREBOUND heroes, companions and save are not touched.</p><div class="asc-pair"><button type="button" class="asc-button" data-act="rebirth">Be reborn</button><button type="button" class="asc-button asc-quiet" data-act="cancel-rebirth">Cancel</button></div>`;
 el.rebirthBox.hidden=false;el.rebirthBox.querySelector('[data-act=cancel-rebirth]').focus({preventScroll:true});}
function showReset(){el.resetBox.innerHTML=`<strong>Start Ascension over?</strong><p class="asc-note">This deletes only this minigame's run, including every best level and rebirth. Your LOREBOUND save is not touched.</p><div class="asc-pair"><button type="button" class="asc-button" data-act="reset-yes">Delete this run</button><button type="button" class="asc-button asc-quiet" data-act="reset-no">Cancel</button></div>`;el.resetBox.hidden=false;el.resetBox.querySelector('[data-act=reset-no]').focus({preventScroll:true});}
function click(e){const t=e.target.closest?.('button');if(!t||t.disabled)return;
 if(t.dataset.pick){if(A.select(state,t.dataset.pick,t.dataset.name)){persist();paint();}return;}
 if(t.dataset.speed){state.speed=Number(t.dataset.speed);persist();paint();return;}
 const act=t.dataset.act;
 if(act==='preview')showRebirth();
 else if(act==='cancel-rebirth'){el.rebirthBox.hidden=true;el.preview.focus({preventScroll:true});}
 else if(act==='rebirth'){if(A.rebirth(state)){acc=0;persist();}el.rebirthBox.hidden=true;paint();el.preview.focus({preventScroll:true});}
 else if(act==='reset')showReset();
 else if(act==='reset-no'){el.resetBox.hidden=true;}
 else if(act==='reset-yes'){try{localStorage.removeItem(A.KEY);}catch{}state=A.fresh();acc=0;warn='';persist();el.resetBox.hidden=true;paint();}}
function change(e){const c=e.target;if(c?.dataset?.auto&&A.unlocked(state,'automation')){state[c.dataset.auto]=!!c.checked;persist();paint();}}

function paused(){return document.hidden||!!box.closest?.('[hidden]')||!!document.querySelector('dialog[open]');}
// One clock only: fixed 1/20 s steps from real time, capped so a slow frame or return never replays a burst.
function frame(t){raf=0;if(!box||!box.isConnected||!el?.root?.isConnected){leave();return;}
 if(paused())lastT=0;else{if(lastT){acc+=Math.min(250,t-lastT)*state.speed;let n=0;while(acc>=STEP&&n<MAX_STEPS){A.tick(state);acc-=STEP;n++;}if(n>=MAX_STEPS)acc=0;}lastT=t;}
 if(t-lastPaint>=PAINT_MS){lastPaint=t;paint();}
 if(t-lastSave>=SAVE_MS)persist();
 raf=requestAnimationFrame(frame);}
function start(){if(!raf){lastT=0;acc=0;raf=requestAnimationFrame(frame);}}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastT=0;acc=0;}

function mount(target){if(!enabled()||!target)return false;label();if(box===target&&el?.root?.isConnected)return true;leave();box=target;state=state||load();build();paint();start();return true;}
function leave(){stop();if(state&&box)persist();if(el?.root){el.root.removeEventListener('click',click);el.root.removeEventListener('change',change);}box=null;el=null;}
if(enabled()&&root.document){document.addEventListener('visibilitychange',()=>{if(!box)return;if(document.hidden){stop();persist();}else start();});root.addEventListener?.('pagehide',()=>{if(box)persist();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});else label();}
root.LoreAscensionUI={enabled,mount,leave,label};
})(globalThis);
