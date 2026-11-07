/* Heroes screen for the fourth tab (DEV preview). Roster, portraits and the active hero live in heroes-model.js.
   Built once per visit and then only repainted, so scroll position and the open preview survive Equip and game updates.
   No timers: nothing runs while the tab is closed. */
(function(root){'use strict';
const M=root.LoreHeroes;
let box=null,el=null,fmt=null,previewId='',lastKey='';
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const slug=r=>r.toLowerCase();
const vars=h=>{const [ink,light,dark]=M.RARITY_COLORS[h.rarity];return `--hr-ink:${ink};--hr-light:${light};--hr-dark:${dark}`;};
const mult=n=>'×'+n.toFixed(2);
function num(n){return n<1000?String(Math.round(n*10)/10):(typeof fmt==='function'?fmt(n):String(Math.round(n)));}
function enabled(){return !!M&&M.enabled();}
// Weapon tap without any hero, so every hero's number is the weapon's tap times its own multiplier, once.
function weaponTap(s){const L=root.Lore;if(!L||!s)return 0;if(typeof L.weaponTap==='function')return L.weaponTap(s);return L.tapPower(s)/M.tapMultiplier();}

function card(h){return `<button type="button" class="hero-card" data-hero="${h.id}" style="${vars(h)}" aria-pressed="false"><span class="hero-card-art">${M.portrait(h.id)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-tap">Tap ${mult(h.tap)} · <b data-tap="${h.id}"></b></span><span class="hero-card-state" data-state="${h.id}"></span></button>`;}
function tier(r){const list=M.ROSTER.filter(h=>h.rarity===r);return `<section class="hero-tier" data-tier="${slug(r)}" style="${vars(list[0])}"><h3 class="hero-tier-title">${r}<span>${list.length} heroes</span></h3><div class="hero-grid">${list.map(card).join('')}</div><div class="hero-preview-slot"></div></section>`;}
function build(){box.innerHTML=`<section class="heroes" aria-label="Heroes">
<p class="hero-dev"><strong>DEV preview.</strong> Every hero can be chosen for free while Joshua compares tap power. Names, art, numbers and how heroes are earned are not final.</p>
<p class="hero-warn" data-h="warn" role="status" hidden></p>
<article class="hero-current" data-h="current" aria-live="polite"></article>
<div class="hero-jump" role="group" aria-label="Jump to a rarity">${M.RARITIES.map(r=>`<button type="button" data-jump="${slug(r)}" style="${vars(M.ROSTER.find(h=>h.rarity===r))}">${r}</button>`).join('')}</div>
${M.RARITIES.map(tier).join('')}
</section>`;
 const q=s=>box.querySelector(s);el={root:q('.heroes'),warn:q('[data-h="warn"]'),current:q('[data-h="current"]')};
 el.root.addEventListener('click',click);previewId='';lastKey='';}

function current(s){const h=M.active(),base=weaponTap(s);return `<div class="hero-portrait" style="${vars(h)}">${M.portrait(h.id)}</div><div class="hero-current-text"><span class="hero-kicker">Active hero</span><h3>${esc(h.name)}</h3><span class="hero-rarity" style="${vars(h)}">${h.rarity}</span>
<dl class="hero-stats"><div><dt>Tap power</dt><dd>${num(base*h.tap)}</dd></div><div><dt>Weapon × hero</dt><dd>${num(base)} ${mult(h.tap)}</dd></div></dl>
<p class="hero-trait"><b>${esc(h.trait)}</b> · concept, not active yet</p></div>`;}
function preview(h,s){const a=M.active(),base=weaponTap(s),on=a.id===h.id;return `<div class="hero-preview" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-mult">Tap ${mult(h.tap)}</p></div></div>
<p class="hero-preview-line">${on?`Current tap ${num(base*h.tap)}`:`Current tap ${num(base*a.tap)} → <b>${num(base*h.tap)}</b>`}</p>
<p class="hero-trait"><b>${esc(h.trait)}:</b> ${esc(h.traitText)}. <i>Concept · not active yet</i></p>
<div class="hero-preview-actions"><button type="button" class="hero-button" data-equip="${h.id}"${on?' disabled':''}>${on?'Selected':'Equip'}</button><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div></div>`;}

function paint(s){if(!el)return;const a=M.active(),base=weaponTap(s),key=JSON.stringify([a.id,base,previewId,M.warning()]);if(key===lastKey)return;lastKey=key;
 el.current.innerHTML=current(s);el.current.setAttribute('style',vars(a));
 const w=M.warning();el.warn.hidden=!w;el.warn.textContent=w;
 for(const h of M.ROSTER){const c=el.root.querySelector(`[data-hero="${h.id}"]`),on=h.id===a.id;c.classList.toggle('is-active',on);c.classList.toggle('is-open',h.id===previewId);c.setAttribute('aria-pressed',String(on));
  c.setAttribute('aria-label',`${h.name}, ${h.rarity}, tap ${mult(h.tap)}${on?', active hero':''}`);
  el.root.querySelector(`[data-tap="${h.id}"]`).textContent=num(base*h.tap);el.root.querySelector(`[data-state="${h.id}"]`).textContent=on?'Active':'';}
 for(const slot of el.root.querySelectorAll('.hero-preview-slot'))slot.innerHTML='';
 const p=M.byId(previewId);if(p)el.root.querySelector(`[data-tier="${slug(p.rarity)}"] .hero-preview-slot`).innerHTML=preview(p,s);}
let read=null;
function click(e){const t=e.target.closest?.('button');if(!t||t.disabled||!el)return;const s=read?.();
 if(t.dataset.jump){el.root.querySelector(`[data-tier="${t.dataset.jump}"]`)?.scrollIntoView?.({block:'start',behavior:'smooth'});return;}
 if(t.dataset.hero){previewId=previewId===t.dataset.hero?'':t.dataset.hero;lastKey='';paint(s);if(previewId)el.root.querySelector(`[data-preview="${previewId}"]`)?.scrollIntoView?.({block:'nearest',behavior:'smooth'});return;}
 if(t.dataset.close){const id=previewId;previewId='';lastKey='';paint(s);el.root.querySelector(`[data-hero="${id}"]`)?.focus?.({preventScroll:true});return;}
 if(t.dataset.equip){if(M.select(t.dataset.equip)){root.LoreUI?.feedback?.('upgrade');lastKey='';paint(s);root.draw?.();el.root.querySelector(`[data-preview="${t.dataset.equip}"] [data-close]`)?.focus?.({preventScroll:true});}}}

// target: the destination box; get: reads the current LOREBOUND state; format: the game's number format.
function mount(target,get,format){if(!enabled()||!target)return false;read=get;fmt=format;if(box!==target||!el?.root?.isConnected){leave();box=target;build();}paint(read?.());return true;}
function leave(){if(el?.root)el.root.removeEventListener('click',click);box=null;el=null;previewId='';lastKey='';}
root.LoreHeroesUI={enabled,mount,leave};
})(globalThis);
