/* Heroes screen for the fourth tab (DEV preview). Roster, portraits, openings and mastery live in heroes-model.js.
   Built once per visit and then only repainted, so scroll position and the open preview survive Equip, openings and game updates.
   One 20-second timer runs only while the tab is open, to keep the opening countdown current. */
(function(root){'use strict';
const M=root.LoreHeroes;
let box=null,el=null,fmt=null,previewId='',lastKey='',oddsOpen=false,shownReceipt='',timer=null,read=null;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const slug=r=>r.toLowerCase();
const vars=h=>{const [ink,light,dark]=M.RARITY_COLORS[h.rarity];return `--hr-ink:${ink};--hr-light:${light};--hr-dark:${dark}`;};
const mult=n=>'×'+n.toFixed(2);
const ROMAN=['','I','II','III','IV','V','VI'];
function num(n){return n<1000?String(Math.round(n*10)/10):(typeof fmt==='function'?fmt(n):String(Math.round(n)));}
function enabled(){return !!M&&M.enabled();}
// Weapon tap without any hero, so every hero's number is the weapon's tap times its own multiplier, once.
function weaponTap(s){const L=root.Lore;if(!L||!s)return 0;if(typeof L.weaponTap==='function')return L.weaponTap(s);return L.tapPower(s)/M.tapMultiplier();}
function left(ms){const m=Math.max(1,Math.ceil(ms/60000)),h=Math.floor(m/60);return h?`${h}h ${m%60}m`:`${m}m`;}
// "Mastery II · 3/5", or the max.
function mastery(id,copies){const r=M.rank(id,copies),next=M.nextThreshold(id,copies);return `${r?'Mastery '+ROMAN[r]:'No mastery yet'} · ${next?`Copies ${copies}/${next}`:`Copies ${copies} · max`}`;}
function bar(id,copies){const t=M.THRESHOLDS[M.byId(id).rarity],r=M.rank(id,copies),next=M.nextThreshold(id,copies),from=r?t[r-1]:1,pct=next?Math.round(100*(copies-from)/(next-from)):100;
 return `<span class="hero-bar" role="presentation"><span style="width:${pct}%"></span></span>`;}
// A small opening-card motif drawn from squares.
const CARD=['.oooooo.','obbbbbbo','obggggbo','obgwwgbo','obgwwgbo','obggggbo','obbbbbbo','.oooooo.'],CARD_PAL={o:'#2a1a10',b:'#9b6d2f',g:'#e2c180',w:'#fae3a3'};
function cardIcon(){let r='';CARD.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]!=='.')r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${CARD_PAL[row[x]]}"/>`;});return `<svg class="hero-open-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`;}

function slot(h){return `<div class="hero-slot" data-slot="${h.id}"></div>`;}
function card(h,a,base){const copies=M.copies(h.id);
 if(!copies)return `<div class="hero-card is-locked" style="${vars(h)}" role="img" aria-label="${esc(h.name)}, ${h.rarity}, undiscovered"><span class="hero-card-art">${M.portrait(h.id,'hero-art',true)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-lock">Undiscovered</span><span class="hero-card-hint">Find in daily openings</span></div>`;
 const on=h.id===a.id,tap=M.heroTap(h.id,copies);
 return `<button type="button" class="hero-card${on?' is-active':''}${h.id===previewId?' is-open':''}" data-hero="${h.id}" style="${vars(h)}" aria-pressed="${on}" aria-label="${esc(h.name)}, ${h.rarity}, tap ${mult(tap)}, ${esc(mastery(h.id,copies))}${on?', equipped':''}"><span class="hero-card-art">${M.portrait(h.id)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-tap">Tap ${mult(tap)} · <b>${num(base*tap)}</b></span><span class="hero-card-mastery">${esc(mastery(h.id,copies))}</span>${bar(h.id,copies)}${on?'<span class="hero-card-state">Equipped</span>':''}</button>`;}
function tier(r){const list=M.ROSTER.filter(h=>h.rarity===r);return `<section class="hero-tier" data-tier="${slug(r)}" style="${vars(list[0])}"><h3 class="hero-tier-title">${r}<span data-found="${slug(r)}"></span></h3><div class="hero-grid">${list.map(slot).join('')}</div><div class="hero-preview-slot"></div></section>`;}
function odds(){return `<p class="hero-odds-note">Each opening is free and separate: first a rarity, then one of its heroes at even chance. No guarantees. Test numbers, not final.</p><table><tbody>${M.RARITIES.map(r=>`<tr style="${vars(M.ROSTER.find(h=>h.rarity===r))}"><th scope="row">${r}</th><td>${M.ODDS[r]}%</td></tr>`).join('')}</tbody></table>`;}
function build(){box.innerHTML=`<section class="heroes" aria-label="Heroes">
<p class="hero-dev"><strong>DEV preview.</strong> Heroes are kept on this device only, outside your save. Names, art, odds and numbers are not final.</p>
<p class="hero-warn" data-h="warn" role="status" hidden></p>
<article class="hero-current" data-h="current" aria-live="polite"></article>
<section class="hero-open" data-h="open" aria-label="Hero openings"></section>
<div class="hero-odds" data-h="odds" hidden>${odds()}</div>
<div class="hero-reveal-slot" data-h="reveal"></div>
<div class="hero-jump" role="group" aria-label="Jump to a rarity">${M.RARITIES.map(r=>`<button type="button" data-jump="${slug(r)}" style="${vars(M.ROSTER.find(h=>h.rarity===r))}">${r}</button>`).join('')}</div>
${M.RARITIES.map(tier).join('')}
</section>`;
 const q=s=>box.querySelector(s);el={root:q('.heroes'),warn:q('[data-h="warn"]'),current:q('[data-h="current"]'),open:q('[data-h="open"]'),odds:q('[data-h="odds"]'),reveal:q('[data-h="reveal"]'),cards:{}};
 el.root.addEventListener('click',click);previewId='';lastKey='';shownReceipt='';}

function current(s){const h=M.active(),base=weaponTap(s),copies=M.copies(h.id),tap=M.heroTap(h.id,copies),r=M.rank(h.id,copies);return `<div class="hero-portrait" style="${vars(h)}">${M.portrait(h.id)}</div><div class="hero-current-text"><span class="hero-kicker">Equipped</span><h3>${esc(h.name)}</h3><span class="hero-rarity" style="${vars(h)}">${h.rarity}</span>
<dl class="hero-stats"><div><dt>Tap power</dt><dd>${num(base*tap)}</dd></div><div><dt>Tap ${mult(tap)}</dt><dd>${r?'Mastery '+ROMAN[r]:'No mastery'}</dd></div></dl></div>`;}
function openBar(){const c=M.clock(),ch=M.charges(c.now),p=M.pending();let note,can=false;
 if(!c.trusted)note='Connect to check opening timer';
 else if(p)note='See your result below first';
 else if(ch.available<=0)note=`Next opening in ${left(ch.nextAt-c.now)}`;
 else{can=true;note=ch.nextAt?`Next one back in ${left(ch.nextAt-c.now)}`:'Each one comes back 24 hours after you use it';}
 return `${cardIcon()}<div class="hero-open-text"><strong>${c.trusted?ch.available:'–'}/${ch.max} openings</strong><span>${note}</span></div><div class="hero-open-actions"><button type="button" class="hero-button hero-open-button" data-open="1"${can?'':' disabled'}>OPEN HERO</button><button type="button" class="hero-button hero-quiet hero-odds-button" data-odds="1" aria-expanded="${oddsOpen}">Odds</button></div>`;}
function preview(h,s){const a=M.active(),base=weaponTap(s),on=a.id===h.id,copies=M.copies(h.id),tap=M.heroTap(h.id,copies),r=M.rank(h.id,copies),now=M.heroTap(a.id,M.copies(a.id));
 return `<div class="hero-preview" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-mult">Tap ${mult(tap)}</p></div></div>
<p class="hero-preview-line">Base ${mult(h.tap)}${r?` · Mastery ${ROMAN[r]} +${Math.round(r*M.MASTERY_STEP*100)}%`:''}</p>
<p class="hero-preview-line">${esc(mastery(h.id,copies))}</p>${bar(h.id,copies)}
<p class="hero-preview-line">${on?`Current tap ${num(base*tap)}`:`Current tap ${num(base*now)} → <b>${num(base*tap)}</b>`}</p>
<p class="hero-trait"><b>${esc(h.trait)}:</b> ${esc(h.traitText)}. <i>Concept · not active yet</i></p>
<div class="hero-preview-actions"><button type="button" class="hero-button" data-equip="${h.id}"${on?' disabled':''}>${on?'Equipped':'Equip'}</button><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div></div>`;}
// The result of an opening: starts as the shadow, flashes the rarity and resolves into the portrait. Skipping only shortens it.
function reveal(p){const h=M.byId(p.id),up=p.after>p.before,tap=M.heroTap(h.id,p.copies),a=M.active();
 const body=p.isNew?`<p class="hero-reveal-line">Tap ${mult(tap)} · added to your heroes</p>`
  :`<p class="hero-reveal-line">Copies ${p.copies}</p><p class="hero-reveal-line">${esc(mastery(h.id,p.copies))}</p>${bar(h.id,p.copies)}${up?`<p class="hero-reveal-rank">Mastery ${ROMAN[p.after]} reached · Tap ${mult(tap)}</p>`:''}`;
 return `<div class="hero-reveal rarity-${slug(h.rarity)}${up?' is-rankup':''}" data-reveal="${esc(p.receipt)}" style="${vars(h)}" role="dialog" aria-label="Hero opening result">
<button type="button" class="hero-reveal-art" data-skip="1" aria-label="Skip reveal"><span class="hr-shadow">${M.portrait(h.id,'hero-art',true)}</span><span class="hr-color">${M.portrait(h.id)}</span></button>
<div class="hero-reveal-text"><span class="hero-reveal-tag">${p.isNew?'NEW':'DUPLICATE'}</span><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span>${body}</div>
<div class="hero-preview-actions">${p.isNew&&a.id!==h.id?`<button type="button" class="hero-button" data-reveal-equip="${h.id}">Equip</button>`:''}<button type="button" class="hero-button${p.isNew&&a.id!==h.id?' hero-quiet':''}" data-continue="${esc(p.receipt)}">Continue</button></div></div>`;}

function paint(s){if(!el)return;const a=M.active(),base=weaponTap(s),bar_=openBar(),p=M.pending(),owned=M.ROSTER.map(h=>M.copies(h.id));
 const key=JSON.stringify([a.id,base,previewId,M.warning(),bar_,p?.receipt||'',owned,oddsOpen]);if(key===lastKey)return;lastKey=key;
 el.current.innerHTML=current(s);el.current.setAttribute('style',vars(a));el.open.innerHTML=bar_;
 el.odds.hidden=!oddsOpen;const w=M.warning();el.warn.hidden=!w;el.warn.textContent=w;
 if((p?.receipt||'')!==shownReceipt){shownReceipt=p?.receipt||'';el.reveal.innerHTML=p?reveal(p):'';}
 for(const h of M.ROSTER){const html=card(h,a,base);if(el.cards[h.id]!==html){el.cards[h.id]=html;el.root.querySelector(`[data-slot="${h.id}"]`).innerHTML=html;}}
 for(const r of M.RARITIES){const list=M.ROSTER.filter(h=>h.rarity===r);el.root.querySelector(`[data-found="${slug(r)}"]`).textContent=`${list.filter(h=>M.copies(h.id)).length}/${list.length} found`;}
 for(const slot of el.root.querySelectorAll('.hero-preview-slot'))slot.innerHTML='';
 const pv=M.byId(previewId);if(pv&&M.copies(pv.id))el.root.querySelector(`[data-tier="${slug(pv.rarity)}"] .hero-preview-slot`).innerHTML=preview(pv,s);}
function repaint(){lastKey='';paint(read?.());}
function tapChanged(){root.draw?.();}
function doOpen(){const c=M.clock(),r=M.open({now:c.now,trusted:c.trusted});
 if(!r.ok){if(r.reason==='clock')Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);repaint();return;}
 if(r.replay){repaint();return;}
 root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();el?.reveal?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
function click(e){const t=e.target.closest?.('button');if(!t||t.disabled||!el)return;const s=read?.();
 if(t.dataset.jump){el.root.querySelector(`[data-tier="${t.dataset.jump}"]`)?.scrollIntoView?.({block:'start',behavior:'smooth'});return;}
 if(t.dataset.open){doOpen();return;}
 if(t.dataset.odds){oddsOpen=!oddsOpen;repaint();return;}
 if(t.dataset.skip){t.closest?.('.hero-reveal')?.classList?.add('is-done');return;}
 if(t.dataset.continue){M.acknowledge(t.dataset.continue);repaint();return;}
 if(t.dataset.revealEquip){const p=M.pending();if(M.select(t.dataset.revealEquip)){if(p)M.acknowledge(p.receipt);root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();}return;}
 if(t.dataset.hero){previewId=previewId===t.dataset.hero?'':t.dataset.hero;repaint();if(previewId)el.root.querySelector(`[data-preview="${previewId}"]`)?.scrollIntoView?.({block:'nearest',behavior:'smooth'});return;}
 if(t.dataset.close){const id=previewId;previewId='';repaint();el.root.querySelector(`[data-hero="${id}"]`)?.focus?.({preventScroll:true});return;}
 if(t.dataset.equip){if(M.select(t.dataset.equip)){root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();el.root.querySelector(`[data-preview="${t.dataset.equip}"] [data-close]`)?.focus?.({preventScroll:true});}else repaint();}}
// Another tab opened or equipped a hero.
function onStorage(e){if(e?.key===M.KEY||e?.key===null){M.reload();repaint();tapChanged();}}

// target: the destination box; get: reads the current LOREBOUND state; format: the game's number format.
function mount(target,get,format){if(!enabled()||!target)return false;read=get;fmt=format;if(box!==target||!el?.root?.isConnected){leave();box=target;build();
  if(!M.clock().trusted)Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);
  timer=root.setInterval?.(()=>paint(read?.()),20000)??null;root.addEventListener?.('storage',onStorage);}
 paint(read?.());return true;}
function leave(){if(el?.root)el.root.removeEventListener('click',click);if(timer!==null)root.clearInterval?.(timer);timer=null;root.removeEventListener?.('storage',onStorage);box=null;el=null;previewId='';lastKey='';shownReceipt='';}
root.LoreHeroesUI={enabled,mount,leave};
})(globalThis);
