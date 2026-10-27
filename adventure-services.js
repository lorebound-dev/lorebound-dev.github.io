/* Entry points for existing services. This module never writes player state. */
(function(root){
'use strict';if(root.__LORE_REVIEW_ISOLATED__)return;
const $=id=>document.getElementById(id);let mounted=false,last='';
function mount(){
 if(mounted||!root.__ADVENTURE_DOCK_READY__)return;mounted=true;
 document.documentElement.classList.add('party-services');
 $('tomeQuickAccess').onclick=()=>{root.LoreTomes.resetPreview();root.LoreSummoning.openSettings('overview');};
 $('tomeQuickAccess').querySelector('.dock-tome-options').textContent='Library ›';
 $('summonSettings').setAttribute('aria-label','Tome Library');$('summonSettings').querySelector('h2').textContent='Tome Library';
 $('summonSettings').querySelector('.summon-cost').textContent='Select your book and its level';$('tomeCommon').append($('tomeTierCards'),$('summonLuckProgress'));const heading=document.createElement('p');heading.className='tome-level-label';heading.textContent='Tome level';$('tomeCommon').insertBefore(heading,$('tomeTierCards'));
 const footer=document.createElement('footer');footer.id='libraryProgression';
 footer.innerHTML='<p id="libraryRequirements"></p><button id="libraryProgressionOpen" type="button">Progression & batch controls ›</button>';
 const body=document.createElement('div');body.id='libraryBody';for(const node of [...$('summonSettings').children])if(node.tagName!=='HEADER')body.append(node);$('summonSettings').append(body,footer);
 $('libraryProgressionOpen').onclick=()=>{$('summonSettings').close();root.LoreSummoning.openSettings('upgrade');};
 // Preserve the original Auto control and handler for the engine; the new entry opens its existing settings.
 const old=document.createElement('div');old.hidden=true;old.id='autoLegacyControl';$('game').append(old);old.append($('autoSummon'));
 const auto=document.createElement('button');auto.id='autoAccess';auto.type='button';auto.innerHTML='<span id="autoAccessLabel">Auto</span><small id="autoAccessState">Set up</small><span id="autoAccessStatus" class="dock-sr-only" role="status" aria-live="polite"></span>';
 // One Auto button: it opens the setup sheet when Auto is off and stops Auto at once while it runs.
 $('summonDock').append(auto);auto.onclick=()=>{if(root.LoreSummoning.auto)root.LoreSummoning.stop('Stopped by you');else root.LoreSummoning.openSettings('auto');refresh();};
}
function refresh(){
 mount();if(!mounted||!state)return;
 const s=state,R=root.LoreRealm,t=R.C.tomes[s.summoning.unlocked-1],auto=root.LoreSummoning.auto;
 const key=[s.summoning.selected,s.summoning.unlocked,s.shards,s.gold,R.discoveredIds(s).length,auto,root.LoreSummoning.opened].join(':');if(key===last)return;const wasAuto=last.split(':')[5]==='true';last=key;
 $('tomeQuickAccess').setAttribute('aria-label','Open Tome Library');
 $('autoAccess').classList.toggle('is-running',auto);$('autoAccessLabel').textContent=auto?'Stop':'Auto';$('autoAccessState').textContent=auto?root.LoreSummoning.opened+' opened':'Set up';$('autoAccess').setAttribute('aria-label',auto?'Stop Auto Summon. '+root.LoreSummoning.opened+' opened so far.':'Set up Auto Summon');
 // Screen readers hear when Auto stops and why, never each flashing result.
 if(wasAuto&&!auto)$('autoAccessStatus').textContent='Auto Summon stopped'+(root.LoreSummoning.stopReason?': '+root.LoreSummoning.stopReason:'')+'.';
 $('libraryRequirements').textContent=t.upgradeShards===null?'All five Tomes unlocked.':`Next: ${R.C.tomes[s.summoning.unlocked].name} · ${root.LoreEconomy?.active(s)?root.LoreEconomy.requirement(s).gold+' Gold · '+R.discoveredIds(s).length+'/'+root.LoreEconomy.requirement(s).discoveries+' historical discoveries':t.upgradeShards+' Lore Shards required · '+s.shards+' available'}`;
}
setInterval(refresh,200);refresh();
})(globalThis);
