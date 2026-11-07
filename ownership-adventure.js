/* Normal Adventure ownership entry: one canonical roster, no spare inventory. */
(function(root){'use strict';const O=root.LoreOwnership,R=root.LoreRealm,$=id=>document.getElementById(id);let read,persist,redraw;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fresh(...args){const old=R.fresh(...args);return root.LoreGuide.convert(root.LoreTreasure.convert(root.LoreRecruitment.convert(root.LoreExpeditions.convert(root.LoreEndless.convert(root.LoreArmory.convert(root.LoreStory.convert(root.LoreRealmSystems.enable(root.LoreEconomy.enable(O.hydrate(O.migrate(JSON.stringify(old),old.party.slots.filter(Boolean),'0'.repeat(64))))))))))));}
function migration(raw,repo){const a=O.audit(raw),box=document.createElement('dialog');box.id='ownershipMigration';box.setAttribute('aria-label','Choose companions to retain');box.addEventListener('cancel',e=>e.preventDefault());document.body.appendChild(box);let selected=a.preselected||[],review=false;
 function render(){box.innerHTML='<h1>Your next chapter</h1><p>Retain one to five companions. Every discovery and mastery count stays with you.</p><p id="migrationError" role="alert"></p>';
 if(a.blocked.length){box.innerHTML+='<h2>Reconciliation required</h2><p>'+a.blocked.map(esc).join('</p><p>')+'</p><p>Your original save has not changed.</p>';return;}
 const p=selected.length?O.preview(raw,selected):{released:a.records,credit:a.records.reduce((n,c)=>n+O.salvage(c.speciesId),0)};
 box.innerHTML+=review?'<h2>Confirm your party</h2><div class="migrationRecords">'+p.released.map(c=>'<p>'+esc(R.species(c.speciesId).name)+' <b>+'+O.salvage(c.speciesId)+' Essence</b></p>').join('')+'</div>':'<div class="migrationRoster">'+a.records.map(c=>'<button data-retain="'+c.id+'" aria-pressed="'+selected.includes(c.id)+'">'+root.LoreArt.portrait(R.species(c.speciesId))+'<b>'+esc(R.species(c.speciesId).name)+'</b><small>'+R.species(c.speciesId).rarity+' · '+(selected.includes(c.id)?'Retain':'Release')+'</small></button>').join('')+'</div>';
 box.innerHTML+='<footer><p>'+selected.length+'/5 retained · '+p.released.length+' released · +'+p.credit+' Essence</p><p>An exact backup is verified before conversion.</p>'+(review?'<button id="migrationBack">Change selection</button><button id="migrationCommit">Confirm conversion</button>':'<button id="migrationReview" '+(!selected.length?'disabled':'')+'>Review conversion</button>')+'</footer>';
 box.querySelectorAll('[data-retain]').forEach(b=>b.onclick=()=>{const id=b.dataset.retain;if(selected.includes(id))selected=selected.filter(x=>x!==id);else if(selected.length<5)selected.push(id);else{$('migrationError').textContent='Deselect a companion before choosing another.';return;}render();});
 if($('migrationReview'))$('migrationReview').onclick=()=>{review=true;render();};if($('migrationBack'))$('migrationBack').onclick=()=>{review=false;render();};
 if($('migrationCommit'))$('migrationCommit').onclick=async()=>{const b=$('migrationCommit');b.disabled=true;try{await repo.convertOwnership(selected,true);location.reload();}catch(e){$('migrationError').textContent=e.message+' Reload to inspect recovery; your original backup is retained.';b.disabled=false;}};
 }
 render();box.showModal();}
// Joshua's text for each feature update: its title, what it adds, what it keeps, and its button.
const UPDATE_TEXT={story:['A corrected Chronicle','One enemy per ordinary floor. Ten manual boss checkpoints, with automatic farming while you prepare.','Your earned resources, companions, discoveries, completed floors and claimed rewards stay intact. Retired kill quotas are archived; an interrupted encounter returns to ordinary combat. No rewards are replayed.','Back up & update story'],armory:['Your Armory awaits','Initialize five permanent equipment pieces at level 0. All current progress and historical Training records remain intact. Training is not converted or reactivated.','No Gold is spent by this update. A verified exact backup and recovery journal protect your existing save.','Back up & enable Armory'],endless:['Beyond the First Chronicle','Enable the returning guardians and cosmetic relic journal. Endless becomes available only after Story Floor 100.','No completion reward is repeated. Story, Armory, companions and currencies are preserved in a verified backup.','Back up & enable Endless'],expeditions:['The Expedition Lodge','Prepare a permanent Town expedition ledger. The Lodge unlocks after Boss 10 and requires Gold restoration. Existing progress is preserved.','No Gold is spent and no expedition starts during this update. A verified exact backup and recovery journal protect your save.','Back up & enable Lodge'],recruitment:['The Recruitment Hall','Prepare a permanent Town recruit roster and two assignments. The Hall unlocks after Boss 20 and requires Gold restoration.','No Gold is spent and no recruit is granted by initialization. Existing expeditions, Town investments and all progress remain unchanged in a verified backup.','Back up & enable Recruitment'],treasure:['Collection records','Brings your save up to date with its collection records. Existing mastery, discoveries and investments remain intact.','No Gold is spent. Accomplishments you already earned are kept without replaying rewards. An exact verified backup protects your save.','Back up & update records'],autorefund:gold=>['Auto Summon Gold returned','Auto Summon no longer has a per-session limit, so the Gold you spent raising that limit comes back: '+gold.toLocaleString('en-US')+' Gold.','It is added once. Your companions, Rift level and everything else stay as they are, and a verified backup protects your save.','Back up & return Gold']};
// Every feature update the save still needs, in one popup: Joshua's own text for a single update, a short list for several.
// One confirmation backs up the original save once, applies them all and reloads once. An error always leaves Reload and the backups.
// The ten-place party update (request #97), kept on its own line so it never shares a line with other requests' text.
UPDATE_TEXT.guide=['Room for ten companions','Your party grows to ten places, and new opening goals join the Journal, with help at the first boss.','Every companion, level, discovery and claimed reward stays as it is. Nothing is paid by this update. A verified backup protects your save.','Back up & update party'];
function saveUpdates(raw,repo){
 const box=document.createElement('dialog');box.id='ownershipMigration';box.className='save-updates';box.setAttribute('aria-label','Save update');box.addEventListener('cancel',e=>e.preventDefault());document.body.appendChild(box);
 box.innerHTML='<div id="storyMigrationBody"><h1>Updating your Chronicle</h1><p>Checking which updates your save needs.</p></div><p id="storyMigrationError" role="alert"></p><footer><button id="storyMigrationCommit" disabled>Back up &amp; update</button><button id="storyMigrationReload" hidden>Reload</button><button id="storyMigrationBackups">Open save backups</button></footer>';
 const failed=(e,body)=>{const text=UPDATE_TEXT[e?.updateStep],step=typeof text==='function'?text(0):text;if(body)$('storyMigrationBody').innerHTML=body;$('storyMigrationError').textContent=(step?step[0]+': ':'')+(e?.message||String(e));$('storyMigrationCommit').hidden=true;$('storyMigrationReload').hidden=false;$('storyMigrationReload').focus();};
 $('storyMigrationReload').onclick=()=>location.reload();
 $('storyMigrationBackups').onclick=()=>{box.close();root.LoreSaveBackups.protect('Update deferred. Export a backup, or reload to see the update again.');};
 $('storyMigrationCommit').onclick=async()=>{$('storyMigrationCommit').disabled=true;try{await repo.convertUpdates(true);location.reload();}catch(e){failed(e);}};
 box.showModal();
 root.LoreSaveStorage.pendingUpdates(raw).then(steps=>{if(!steps.length)throw Error('No update could be prepared.');const t=steps.map(id=>{const x=UPDATE_TEXT[id];return typeof x==='function'?x(root.LoreEconomy.capacityRefund.amount(JSON.parse(raw))):x||[id,'','','Back up & update'];});
  $('storyMigrationBody').innerHTML=(t.length===1?'<h1>'+esc(t[0][0])+'</h1><p>'+esc(t[0][1])+'</p><p>'+esc(t[0][2])+'</p>':'<h1>Your Chronicle has grown</h1><p>Your save is ready for '+t.length+' updates:</p><ul class="save-update-list">'+t.map(x=>'<li><b>'+esc(x[0])+'</b>'+esc(x[1])+'</li>').join('')+'</ul><p>Everything you have earned stays intact. No Gold is spent and no rewards are replayed.</p>')+'<p>An exact recovery backup is verified before the conversion commits. Older builds cannot read this new version.</p>';
  $('storyMigrationCommit').textContent=t.length===1?t[0][3]:'Back up & update';$('storyMigrationCommit').disabled=false;$('storyMigrationCommit').focus();}).catch(e=>failed(e,'<h1>Your save couldn&#39;t be updated</h1><p>Nothing has changed. Reload to try again, or open the save backups to download a copy. If this keeps happening, share the message below.</p>'));
}
// Settles the pending companion through the existing decision transaction. A failed save restores the exact state.
// A swap keeps the draw open: the companion it replaced becomes the next choice in the same Party dock.
function settle(action,id){const s=read(),p=s?.pending;if(!p)return false;const before=JSON.stringify(s);try{O.replaceState(s,O.decide(s,p.drawId,action,id));R.timers(s);R.syncProgress(s);if(persist()===false)throw Error('Could not save decision');$('ownershipCompare')?.close();if(s.pending){redraw();if(picking){chosen=null;renderChoice();$('choiceRelease')?.focus?.({preventScroll:true});}else root.LoreSummoning.restorePending?.();return true;}const node=$('ownershipDecision');if(node)node.hidden=true;$('summonSheet').classList.remove('ownership-pending');exit(false);root.LoreSummoning.close();redraw();root.LoreSummoning.resumeSequence?.();return true;}catch(e){O.replaceState(s,JSON.parse(before));for(const id of ['ownershipError','ownershipCompareError','choiceError'])if($(id))$(id).textContent=e.message+' Pending companion retained. Reload to recover.';return false;}}
function decisions(){const s=read();if(!s?.pending)return;const p=s.pending,h=R.species(p.speciesId),duplicate=s.owned.some(c=>c.speciesId===h.id);let node=$('ownershipDecision');if(!node){node=document.createElement('section');node.id='ownershipDecision';$('summonSheet').querySelector('footer').appendChild(node);}node.hidden=false;$('summonSheet').classList.add('ownership-pending');
 $('summonOwnership').textContent=p.displaced?'Swapped out of your party · choose a new place or release':duplicate?'Active species · mastery permanently recorded':'Discovery and mastery permanently recorded';
 node.innerHTML='<p>Essence: '+s.essence.n+(s.essence.d==='1'?'':'/'+s.essence.d)+'</p><div>'+(!duplicate?'<button id="ownershipAccept">'+(s.owned.length<O.slots(s)?'Add to Party':'Swap into Party')+'</button>':'')+'<button id="ownershipRelease">Release · +'+O.salvage(h.id)+' Essence</button></div><p id="ownershipError" role="alert"></p>';
 $('ownershipRelease').onclick=()=>settle('release');if($('ownershipAccept'))$('ownershipAccept').onclick=()=>{if(root.__ADVENTURE_DOCK_READY__&&$('adventureDeck')){choose();return;}if(s.owned.length<O.slots(s)){settle('recruit');return;}compare();};
}
// Fallback for pages without the Adventure dock: the original replacement picker.
function compare(){const s=read(),p=s.pending,h=R.species(p.speciesId);let box=$('ownershipCompare');if(!box){box=document.createElement('dialog');box.id='ownershipCompare';document.body.appendChild(box);}box.innerHTML='<h2>Welcome '+esc(h.name)+'?</h2><label for="ownershipReplace">Choose a companion to replace</label><select id="ownershipReplace">'+s.owned.map(c=>'<option value="'+c.id+'">'+esc(R.species(c.speciesId).name)+'</option>').join('')+'</select><p id="ownershipTransfer"></p><p>Both species retain all discovery and mastery progress.</p><p id="ownershipCompareError" role="alert"></p><button id="ownershipSwap">Confirm replacement</button><button id="ownershipCancel">Keep choosing</button>';
 const update=()=>{const old=s.owned.find(c=>c.id===$('ownershipReplace').value),same=R.species(old.speciesId).rarity===h.rarity,q=O.transfer(old.invested,same),projected=O.hydrate(O.decide(s,p.drawId,'swap',old.id));$('ownershipTransfer').textContent=R.total(s).toFixed(1)+' → '+R.total(projected).toFixed(1)+' Party DPS. '+(same?'100%':'80%')+' investment transferred ('+q.n+(q.d==='1'?'':'/'+q.d)+' Essence). '+R.species(old.speciesId).name+' becomes your next choice.';};$('ownershipReplace').onchange=update;update();$('ownershipSwap').onclick=()=>settle('swap',$('ownershipReplace').value);$('ownershipCancel').onclick=()=>box.close();box.showModal();}
// Joshua's in-dock choice (2026-11-06): the reveal steps aside and the real Party dock opens with its cards wiggling.
// Above it the waiting companion floats as the same Party card it will be in the team, with only Release below it:
// no party DPS change, no per-card gains and no Confirm. Double-tapping (or double-clicking) a Party card swaps it with
// the floating card at once, and the two cards visibly trade places. The companion that left becomes the floating card,
// so it can be swapped again or released. Double-tapping an open slot adds the companion there. A single tap only
// highlights a card. Keyboard and screen-reader activation of a card (a click with no pointer behind it) swaps it
// directly. There is no Back (Joshua, 2026-11-06): the choice ends only with a swap or Release, and the companion
// stays waiting, saved as pending, until then. Every swap is the existing decision
// transaction in settle(); the motion only plays after it has been saved.
let picking=false,chosen=null,tap=null,press=null,busy=false;
const dps=n=>typeof statFmt==='function'?statFmt(n):String(Math.round(n*10)/10);
// Each type's habitat comes from companion-profile.js, so this view matches the team and Omnidex pages.
const habitat=category=>root.LoreCompanionProfile?.habitat(category)||"url('assets/void.png')";
// Two taps on the same card within DOUBLE_MS are a double-tap. A press longer than PRESS_MS, or one that moved more than
// SLOP pixels (a scroll or drag), is not a tap. SWAP_MS is the exchange motion; input is locked a little longer.
const DOUBLE_MS=350,PRESS_MS=500,SLOP=10,SWAP_MS=260,LOCK_MS=320;
// A tap belongs to one waiting companion and one exact target, so taps on two different cards, or taps that arrive
// after a swap changed the waiting companion, never pair up.
function tapKey(s,slot){return s.pending.drawId+':'+s.pending.id+':'+slot+':'+(s.owned[slot]?.id||'');}
function markDock(){const box=$('dockCompanions');if(!box?.querySelectorAll)return;const s=read(),on=picking&&!!s?.pending,name=on?R.species(s.pending.speciesId).name:'';
 for(const card of box.querySelectorAll('[data-dock-slot]')){const i=Number(card.dataset.dockSlot),empty=card.classList.contains('is-empty');card.classList.toggle('is-choice-pick',on&&i===chosen);
  if(!on){card.removeAttribute('aria-pressed');if(card.dataset.choiceLabel!==undefined){card.setAttribute('aria-label',card.dataset.choiceLabel);delete card.dataset.choiceLabel;}continue;}
  card.setAttribute('aria-pressed',String(i===chosen));card.dataset.choiceLabel??=card.getAttribute('aria-label')||'';
  card.setAttribute('aria-label',empty?'Open slot '+(i+1)+'. Add '+name+' here.':card.dataset.choiceLabel.replace(/\s*Level upgrade available\.$/,'')+' Swap with '+name+'.');}}
// The waiting companion as its Party card, with the level and DPS it has while it waits. It is a picture here, not a
// button, so it never opens the team.
function floatingCard(h,item,level,power){const label=h.name+', '+h.rarity+', Lv. '+level+', '+dps(power)+' DPS.';
 try{return root.LoreAdventureCard.render(h,dps(power),'',null,level).replace(/^<button type="button"/,'<div role="img"').replace(/ data-dock-slot="[^"]*"/,'').replace(/ title="[^"]*"/,'').replace(/ aria-label="[^"]*"/,' aria-label="'+esc(label)+'"').replace(/<\/button>\s*$/,'</div>');}
 catch{return '<div class="choice-fallback" role="img" aria-label="'+esc(label)+'">'+root.LoreArt.portrait(item)+'</div>';}}
function choose(){const s=read();if(!s?.pending||s.owned.some(c=>c.speciesId===s.pending.speciesId)||!root.__ADVENTURE_DOCK_READY__||!$('adventureDeck'))return false;picking=true;chosen=null;$('summonSheet').hidden=true;$('game').classList.remove('summon-active');$('combatLayout').inert=false;root.LoreNavigation?.showAdventure?.();root.LoreAdventureDock?.collapse(false);$('game').classList.add('dock-choosing');let panel=$('dockChoice');if(!panel){panel=document.createElement('section');panel.id='dockChoice';panel.setAttribute('aria-label','Choose a party slot');$('adventureDeck').appendChild(panel);}panel.hidden=false;renderChoice();$('choiceRelease')?.focus?.({preventScroll:true});return true;}
function renderChoice(){const s=read(),panel=$('dockChoice');if(!picking||!s?.pending||!panel)return;const p=s.pending,h=R.species(p.speciesId),item=root.LoreSummonModel.item(p.id),out=p.displaced,open=s.owned.length<5;
 panel.style.setProperty('--choice-color',item.color);panel.style.setProperty('--choice-habitat',habitat(h.category));panel.dataset.rarity=h.rarity.toLowerCase();const top=$('adventureDeck')?.getBoundingClientRect?.().top;if(top>0)panel.style.maxHeight=Math.max(270,top-12)+'px';
 let html='<div class="choice-head"><div class="choice-card">'+floatingCard(h,item,O.pendingLevel(s),R.combat(s,p.id).expectedDps)+'</div><div class="choice-info"><b class="choice-name">'+esc(h.name)+'</b><small class="choice-rarity"><i aria-hidden="true"></i>'+esc(h.rarity)+'</small>';
 html+='<p class="choice-hint">'+(open?'Double-tap an open slot to add, or a companion to swap':'Double-tap a companion to swap')+'</p></div></div>';
 html+='<button id="choiceRelease" class="choice-release" type="button">Release · +'+O.salvage(h.id)+' Essence</button><p id="choiceError" role="alert"></p>';
 panel.innerHTML=html;
 // One tap on the labelled Release button releases the floating companion, like the Release button on the result screen.
 $('choiceRelease').onclick=()=>{if(!busy)settle('release');};
 markDock();moveFloating(h,!out);}
// Joshua's Changes (2026-11-06): the floating companion moves with #117's companion movement (companion-motion.js):
// the tutorial pop-in, one windup-and-lunge about a second later, then its gentle idle (starters keep their own idle
// and particles, Wildgrowth sways, Spirits hover, the rest breathe). Tapping the floating card replays the lunge; a
// tap during a lunge restarts it. After a swap the card's flight is its entrance, so only the lunge and idle follow.
// It is only looks: it reads and writes nothing, and the delayed lunge is cancelled when the floating companion
// changes or this view closes. Reduced motion keeps the picture still.
const STRIKE={Wildgrowth:true,Beasts:true,Constructs:true};
let preview=0;
const stopPreview=()=>{if(preview)clearTimeout(preview);preview=0;};
function moveFloating(h,enter){stopPreview();const M=root.LoreCompanionMotion,card=$('dockChoice')?.querySelector?.('.choice-card'),stage=card?.querySelector?.('.dock-art-stage');if(!M||!stage)return;
 try{const body=document.createElement('span');body.className='cm-body';while(stage.firstChild)body.appendChild(stage.firstChild);stage.appendChild(body);
  stage.classList.add('cm-stage','cm-'+(M.IDLE[h.category]||'breathe'),'cm-cat-'+String(h.category).toLowerCase());
  const add=cls=>{const i=document.createElement('i');i.className=cls+' cm-deco';i.setAttribute('aria-hidden','true');stage.appendChild(i);};
  if(h.id in M.STARTERS){stage.classList.add('idle-'+M.STARTERS[h.id]);add('idle-glow');for(const m of ['m1','m2','m3'])add('idle-mote '+m);}
  if(STRIKE[h.category])add('reveal-strike');
  card.onclick=()=>{stopPreview();M.react(stage);};
  if(M.still())return;
  if(enter){stage.classList.add('cm-enter');setTimeout(()=>stage.classList.remove('cm-enter'),700);}
  const id=read()?.pending?.id;preview=setTimeout(()=>{preview=0;if(picking&&read()?.pending?.id===id&&stage.isConnected!==false)M.react(stage);},1000);}
 catch{}}
// A dock card was activated. Keyboard and screen-reader activation swaps at once; a tap waits for its second tap.
function pick(slot,e){if(!picking||busy)return;const s=read();if(!s?.pending)return exit(false);if(slot>=s.owned.length){if(s.owned.length>=O.slots(s))return;slot=s.owned.length;}
 const key=tapKey(s,slot),now=Date.now(),down=press;press=null;
 if(e&&e.detail===0){tap=null;return commit(slot,key);}
 if(down&&(now-down.t>PRESS_MS||(typeof e?.clientX==='number'&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>SLOP))){tap=null;return;}
 if(tap&&tap.key===key&&now-tap.t<=DOUBLE_MS){tap=null;return commit(slot,key);}
 tap={key,t:now};chosen=slot;markDock();}
// Swaps (or adds) through the existing decision transaction, only if the waiting companion and the target are still
// the ones that were tapped. Input stays locked through the motion, which plays only after a successful save.
function commit(slot,key){const s=read(),p=s?.pending;if(!p||busy||tapKey(s,slot)!==key)return false;const target=s.owned[slot]?.id,name=R.species(p.speciesId).name,left=target?R.species(s.owned[slot].speciesId).name:'';
 const from=rect($('dockChoice')?.querySelector?.('.choice-card')),to=rect(dockCard(slot));
 busy=true;setTimeout(()=>{busy=false;},LOCK_MS);
 if(!settle(target?'swap':'recruit',target))return false;
 root.LoreAdventureDock?.refresh?.();
 const status=$('dockReorderStatus');if(status)status.textContent=name+' joined your party in slot '+(slot+1)+'.'+(left&&read()?.pending?' '+left+' is waiting. Double-tap a companion to swap, or release.':'');
 exchange(slot,from,to);return true;}
const rect=n=>{try{const r=n?.getBoundingClientRect?.();return r&&r.width>0?r:null;}catch{return null;}};
const dockCard=slot=>$('dockCompanions')?.querySelector?.('[data-dock-slot="'+slot+'"]');
// The visible exchange: the card that joined travels from the floating spot to its slot, and the companion that left
// travels from the slot up to the floating spot. Reduced motion uses a short fade instead.
function exchange(slot,from,to){const reduce=!!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,game=$('game');
 const fly=(node,a)=>{const b=rect(node);if(!node?.animate||!b)return;
  if(reduce||!a){node.animate([{opacity:.35},{opacity:1}],{duration:160,easing:'ease-out'});return;}
  node.animate([{transformOrigin:'0 0',transform:'translate('+(a.left-b.left)+'px,'+(a.top-b.top)+'px) scale('+(a.width/b.width)+','+(a.height/b.height)+')'},{transformOrigin:'0 0',transform:'none'}],{duration:SWAP_MS,easing:'cubic-bezier(.3,.7,.3,1)'});};
 game?.classList.add('choice-swapping');setTimeout(()=>game?.classList.remove('choice-swapping'),SWAP_MS+20);
 fly(dockCard(slot),from);if(picking)fly($('dockChoice')?.querySelector?.('.choice-card'),to);}
document.addEventListener?.('pointerdown',e=>{if(picking&&e.target?.closest?.('#dockCompanions'))press={t:Date.now(),x:e.clientX,y:e.clientY};},true);
function exit(restore){if(!picking)return;picking=false;chosen=null;stopPreview();$('game').classList.remove('dock-choosing');const panel=$('dockChoice');if(panel)panel.hidden=true;markDock();if(restore&&read()?.pending){$('summonSheet').hidden=false;$('game').classList.add('summon-active');$('combatLayout').inert=true;decisions();$('ownershipAccept')?.focus?.({preventScroll:true});}}
setInterval(()=>{if(picking&&(!read()?.pending||!$('summonSheet').hidden))exit(false);},250);root.LoreOwnershipAdventure={fresh,migration,saveUpdates,decisions,choose,pick,markDock,exit,get choosing(){return picking;},connect(get,save,draw){read=get;persist=save;redraw=draw;}};
})(globalThis);
