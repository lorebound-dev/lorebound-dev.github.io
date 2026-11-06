/* TEST-ONLY preview of companion details (request 2026-11-06-companion-details-art-qa). Not part of the game: home.html
   never loads it. It opens the companion page from #108 with the five newly approved Commons and, for comparison, six
   current companions exactly as the game draws them. Nothing is read from or written to any save, nothing is owned,
   summoned or spent, and the five Commons are not added to the game's companions: they exist only on this page.
   Current companions show their base numbers for a new copy, from the game's own engine on a throwaway starting state. */
(function(root){'use strict';
const $=id=>document.getElementById(id),R=root.LoreRealm,A=root.LoreArt,P=root.LoreCompanionProfile;
const ART='assets/review/common5-preview/';
// The five approved Commons. Categories are #98's planned ones; they have no stats, odds, Tome, size or weight yet.
const NEW=[['reedwatch-tinker','Reedwatch Tinker','Mortals'],['millward-bellkeeper','Millward Bellkeeper','Mortals'],['dewfern','Dewfern','Wildgrowth'],
 ['coppice-cricket','Coppice Cricket','Wildgrowth'],['unstitch','Unstitch','Aberrations']].map(([id,name,category])=>({id,name,category,rarity:'Common',src:ART+id+'-768.png',preview:true}));
// Current companions, unchanged: the three starters and one from each other category.
const BASE=['bramblebud','cinderclack','glimwick','lost-squire','soot-sprite','crooked-eye'];
const state=R.fresh(0,0),copies={};
for(const id of BASE){const owned=state.party.slots.find(x=>x&&x.split('~')[0]===id);copies[id]=owned||R.addCopy(state,id).id;}
const current=BASE.map(id=>({...R.species(id),copy:copies[id]}));
const all=[...NEW,...current];let at=0;
const num=n=>n<1000?String(Math.round(n*10)/10):Math.round(n).toLocaleString('en-US');
function picture(el,h){if(h.preview){el.className='starter-sheet bound-card-sprite companion-art';el.innerHTML=`<img src="${h.src}" alt="${h.name}">`;el.setAttribute('aria-label',h.name);}else{el.className='starter-sheet bound-card-sprite';A.apply(el,h,{creatureOnly:true});}}
function fill(h){
 const sheet=$('boundSheet');
 // The motion script reads these before the name changes, so a switch while the page is open plays the new companion's motion.
 sheet.dataset.cmSpecies=h.preview?'':h.id;sheet.dataset.cmCategory=h.category;
 $('boundKicker').textContent=h.preview?'PREVIEW · NEW, NOT IN GAME':'PREVIEW · CURRENT, UNCHANGED';
 $('boundRarityBadge').innerHTML=A.rarity(h.rarity);$('boundRarityBadge').style.color=h.color||'';
 $('boundTypeBadge').innerHTML=`<svg viewBox="0 0 32 32"><use href="assets/category-sigils.svg#${h.category.toLowerCase()}"/></svg><b>${h.category}</b>`;
 picture($('boundCardSprite'),h);
 const habitat=P.habitat(h.category)||'';sheet.classList.toggle('bound-habitat',!!habitat);sheet.style.setProperty('--companion-habitat',habitat||'none');
 if(h.preview){for(const id of ['boundCardLevel','boundCardDps','boundCardHp','boundCardDef'])$(id).textContent='—';
  $('boundFlavor').textContent='Size and weight not set yet';
  $('boundEvolutionTarget').textContent='Not set yet';$('boundEvolutionFill').style.width='0%';$('boundEvolutionHint').textContent='Mastery starts once this companion is in the game.';
  $('boundSources').innerHTML='<p>'+h.category+' · Common · Preview only</p><p>Not in the game yet: it can’t be summoned or owned, and its stats, odds and Tome aren’t set. The numbers above stay blank until they are.</p>';}
 else{const c=R.combat(state,h.copy,true),t=R.C.masteryThresholds[h.category==='Aberrations'?'aberration':'ordinary'][h.rarity];
  $('boundCardLevel').textContent=Number(c.interval.toFixed(3))+'s';$('boundCardDps').textContent=num(c.expectedDps);$('boundCardHp').textContent=num(c.damage);$('boundCardDef').textContent=(c.crit*100).toFixed(1)+'%';
  $('boundFlavor').textContent=P.text(h.id)||'';
  $('boundEvolutionTarget').textContent='Lv. 0 / 6 · 1 lifetime summons';$('boundEvolutionFill').style.width='0%';$('boundEvolutionHint').textContent='Next: '+t[0]+(t[0]===1?' summon':' summons');
  $('boundSources').innerHTML='<p>'+h.category+' · '+h.rarity+' · Preview copy, not owned</p><p>Available from Tome '+['I','II','III','IV','V'][h.unlock-1]+' onward</p><p>Base numbers for a new copy. In the game they include your upgrades.</p>';}
 $('boundFlavor').hidden=!$('boundFlavor').textContent;
 $('boundSheetName').textContent=h.name;
 $('cmpCount').textContent=(at+1)+' / '+all.length;
}
function open(i){at=(i+all.length)%all.length;fill(all[at]);const sheet=$('boundSheet');if(!sheet.open)sheet.showModal();sheet.scrollTop=0;}
function card(h,i){return `<button type="button" class="cmp-pick" data-pick="${i}"><span class="cmp-thumb">${h.preview?`<img src="${h.src}" alt="">`:A.portrait(h)}</span><b>${h.name}</b><small>${h.category}${h.preview?' · new':''}</small></button>`;}
$('cmpNew').innerHTML=NEW.map((h,i)=>card(h,i)).join('');
$('cmpBase').innerHTML=current.map((h,i)=>card(h,NEW.length+i)).join('');
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-pick]');if(b)open(Number(b.dataset.pick));});
$('cmpPrev').onclick=()=>open(at-1);$('cmpNext').onclick=()=>open(at+1);
$('closeBound').onclick=$('cmpList').onclick=()=>$('boundSheet').close();
// The page's buttons stand where the game's are, for layout only. Here they do nothing.
for(const id of ['levelButton','boundSwap','boundRemove','boundStatToggle'])$(id).disabled=true;
$('boundSwap').textContent='Change placement';$('boundRemove').hidden=true;$('boundStatToggle').hidden=true;
$('cmpStill').onchange=()=>document.documentElement.classList.toggle('cm-still',$('cmpStill').checked);
const start=new URLSearchParams(location.search).get('companion');if(start){const i=all.findIndex(h=>h.id===start);if(i>=0)open(i);}
root.LoreCompanionPreview=Object.freeze({all,open});
})(globalThis);
