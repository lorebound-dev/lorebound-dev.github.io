/* Entry points for existing services. This module never writes player state. */
(function(root){
'use strict';if(root.__LORE_REVIEW_ISOLATED__)return;
const $=id=>document.getElementById(id);let mounted=false,last='';
function mount(){
 if(mounted||!root.__ADVENTURE_DOCK_READY__)return;mounted=true;
 document.documentElement.classList.add('party-services');
 // Upgrade Rift: the shrine's left plaque opens the Rift Upgrades menu (#tomeQuickSheet): the Rift's one level, its odds now
 // and next, the upgrade, quantity and a Summoning odds entry. Auto stays on its own plaque, so the menu's Auto row is hidden
 // (tome-popup.css). The five levels, their costs and odds are unchanged.
 $('tomeQuickAccess').onclick=()=>root.LoreSummoning.openSettings('upgrade');
 $('tomeQuickAccess').querySelector('.dock-tome-options').textContent='Upgrade Rift';
 // Summoning odds opens straight on its Exact odds tab. The Rift has one level, so there is no book or level to pick: the
 // level row only previews the other levels, and the old book list (one book) is hidden.
 $('quickTomeDetails').onclick=()=>{root.LoreTomePopup.close();root.LoreTomes.resetPreview();root.LoreSummoning.openSettings('odds');};
 $('summonSettings').setAttribute('aria-label','Summoning odds');$('summonSettings').querySelector('h2').textContent='Summoning odds';
 $('summonSettings').querySelector('.summon-cost').textContent='Every companion the Rift can summon, at each level';$('tomeOverviewTab').textContent='Levels';const bookChoice=$('tomeSelect').parentElement;if(bookChoice)bookChoice.hidden=true;$('tomeCommon').append($('tomeTierCards'),$('summonLuckProgress'));const heading=document.createElement('p');heading.className='tome-level-label';heading.textContent='Rift level';$('tomeCommon').insertBefore(heading,$('tomeTierCards'));
 const footer=document.createElement('footer');footer.id='libraryProgression';
 footer.innerHTML='<p id="libraryRequirements"></p><button id="libraryProgressionOpen" type="button">Progression & batch controls ›</button>';
 const body=document.createElement('div');body.id='libraryBody';for(const node of [...$('summonSettings').children])if(node.tagName!=='HEADER')body.append(node);$('summonSettings').append(body,footer);
 $('libraryProgressionOpen').onclick=()=>{$('summonSettings').close();root.LoreSummoning.openSettings('upgrade');};
 // Preserve the original Auto control and handler for the engine; the new entry opens its existing settings.
 const old=document.createElement('div');old.hidden=true;old.id='autoLegacyControl';$('game').append(old);old.append($('autoSummon'));
 const auto=document.createElement('button');auto.id='autoAccess';auto.type='button';auto.innerHTML='<svg class="auto-access-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8.5A7.5 7.5 0 0 0 5 9.5M5.5 15.5A7.5 7.5 0 0 0 19 14.5"/><path d="M19 3.5v5h-5M5 20.5v-5h5"/></svg><span class="auto-access-word" aria-hidden="true">Auto</span><span id="autoAccessLabel" class="auto-access-stop" hidden>Stop Auto</span><span id="autoAccessStatus" class="dock-sr-only" role="status" aria-live="polite"></span>';
 // One Auto button: an icon with the word Auto that opens the setup sheet when Auto is off, and a small red "Stop Auto" while Auto
 // runs or waits on a paused decision. One press stops it at once.
 $('summonDock').append(auto);auto.onclick=()=>{if(root.LoreSummoning.auto)root.LoreSummoning.stop('Stopped by you');else root.LoreSummoning.openSettings('auto');refresh();};
}
function refresh(){
 mount();if(!mounted||!state)return;
 const s=state,R=root.LoreRealm,level=root.LorePortal?root.LorePortal.level(s):s.summoning.unlocked,t=R.C.tomes[level-1],auto=root.LoreSummoning.auto;
 const key=[level,s.shards,s.gold,R.discoveredIds(s).length,auto,root.LoreSummoning.opened].join(':');if(key===last)return;const wasAuto=last.split(':')[4]==='true';last=key;
 $('autoAccess').classList.toggle('is-running',auto);$('autoAccessLabel').hidden=!auto;$('autoAccess').setAttribute('aria-label',auto?'Stop Auto. '+root.LoreSummoning.opened+' opened so far.':'Auto summon settings');
 // Screen readers hear when Auto stops and why, never each flashing result.
 if(wasAuto&&!auto)$('autoAccessStatus').textContent='Auto Summon stopped'+(root.LoreSummoning.stopReason?': '+root.LoreSummoning.stopReason:'')+'.';
 $('libraryRequirements').textContent=t.upgradeShards===null?'The Rift is at Level '+level+', its highest level.':`Next: Rift Level ${level+1} · ${root.LoreEconomy?.active(s)?root.LoreEconomy.requirement(s).gold+' Gold · '+R.discoveredIds(s).length+'/'+root.LoreEconomy.requirement(s).discoveries+' historical discoveries':t.upgradeShards+' Lore Shards required · '+s.shards+' available'}`;
}
setInterval(refresh,200);refresh();
})(globalThis);
