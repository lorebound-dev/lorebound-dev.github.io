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
 const auto=document.createElement('button');auto.id='autoAccess';auto.type='button';auto.innerHTML='<span>Auto</span><small id="autoAccessState">Off · Settings</small>';
 $('summonDock').append(auto);auto.onclick=()=>root.LoreSummoning.openSettings('auto');
 const help=document.createElement('p');help.className='auto-entry-note';help.textContent='Opening these settings pauses Auto. Save your choices, then start when ready.';$('summonAutoPane').prepend(help);
}
function refresh(){
 mount();if(!mounted||!state)return;
 const s=state,R=root.LoreRealm,t=R.C.tomes[s.summoning.unlocked-1],auto=root.LoreSummoning.auto;
 const key=[s.summoning.selected,s.summoning.unlocked,s.shards,s.gold,R.discoveredIds(s).length,auto].join(':');if(key===last)return;last=key;
 $('tomeQuickAccess').setAttribute('aria-label','Open Tome Library');
 $('autoAccessState').textContent=auto?'On · Settings':'Off · Settings';$('autoAccess').setAttribute('aria-label',auto?'Auto Summon running. Open settings and pause.':'Open Auto Summon settings');
 $('libraryRequirements').textContent=t.upgradeShards===null?'All five Tomes unlocked.':`Next: ${R.C.tomes[s.summoning.unlocked].name} · ${root.LoreEconomy?.active(s)?root.LoreEconomy.requirement(s).gold+' Gold · '+R.discoveredIds(s).length+'/'+root.LoreEconomy.requirement(s).discoveries+' historical discoveries':t.upgradeShards+' Lore Shards required · '+s.shards+' available'}`;
}
setInterval(refresh,200);refresh();
})(globalThis);
