/* Heroes screen for the fourth tab (DEV preview). Roster, portraits, openings, mastery, signatures and Crests live in heroes-model.js.
   The Hero Shop is not a separate screen: tapping any hero opens its preview with its Crest price and a Recruit / Buy copy button.
   Built once per visit and then only repainted, so scroll position and the open preview survive Equip, openings and game updates.
   One 20-second timer runs only while the tab is open, to keep the opening countdown current. */
(function(root){'use strict';
const M=root.LoreHeroes;
// confirmId: the hero whose Crest purchase is waiting for Confirm. note: the short result of the last purchase, shown in its preview.
let box=null,el=null,fmt=null,previewId='',lastKey='',oddsOpen=false,shownReceipt='',timer=null,read=null,confirmId='',note=null;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const slug=r=>r.toLowerCase();
const vars=h=>{const [ink,light,dark]=M.RARITY_COLORS[h.rarity];return `--hr-ink:${ink};--hr-light:${light};--hr-dark:${dark}`;};
const mult=n=>'×'+n.toFixed(2);
const ROMAN=['','I','II','III','IV','V','VI'];
function num(n){return n<1000?String(Math.round(n*10)/10):(typeof fmt==='function'?fmt(n):String(Math.round(n)));}
function enabled(){return !!M&&M.enabled();}
// Weapon tap without any hero, so every hero's number is the weapon's tap times its own multiplier, once.
function weaponTap(s){const L=root.Lore;if(!L||!s||typeof L.weaponTap!=='function')return 0;return L.weaponTap(s);}
// Tap power with a hero: weapon × its multiplier + its flat tap, the same sum Lore.tapPower uses for the equipped one.
const tapOf=(id,base)=>M.tapWith(id,M.copies(id),base);
// At most two effect rows. A diamond marks each, coloured by what it boosts.
const kind=t=>/Gold/.test(t)?'gold':/Tap/.test(t)?'tap':'dps';
function rows(id,copies,long=false){return M.effects(id,copies,long).map(t=>`<span class="hero-fx hero-fx-${kind(t)}">${esc(t)}</span>`).join('');}
const crestText=n=>`${n.toLocaleString?.('en-US')??n} Hero Crest${n===1?'':'s'}`;
function left(ms){const m=Math.max(1,Math.ceil(ms/60000)),h=Math.floor(m/60);return h?`${h}h ${m%60}m`:`${m}m`;}
// "Mastery II · 3/5", or the max.
function mastery(id,copies){const r=M.rank(id,copies),next=M.nextThreshold(id,copies);return `${r?'Mastery '+ROMAN[r]:'No mastery yet'} · ${next?`Copies ${copies}/${next}`:`Copies ${copies} · max`}`;}
function bar(id,copies){const t=M.THRESHOLDS[M.byId(id).rarity],r=M.rank(id,copies),next=M.nextThreshold(id,copies),from=r?t[r-1]:1,pct=next?Math.round(100*(copies-from)/(next-from)):100;
 return `<span class="hero-bar" role="presentation"><span style="width:${pct}%"></span></span>`;}
// A small opening-card motif drawn from squares.
const CARD=['.oooooo.','obbbbbbo','obggggbo','obgwwgbo','obgwwgbo','obggggbo','obbbbbbo','.oooooo.'],CARD_PAL={o:'#2a1a10',b:'#9b6d2f',g:'#e2c180',w:'#fae3a3'};
function cardIcon(){let r='';CARD.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]!=='.')r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${CARD_PAL[row[x]]}"/>`;});return `<svg class="hero-open-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`;}

function slot(h){return `<div class="hero-slot" data-slot="${h.id}"></div>`;}
const n2=n=>n.toLocaleString?.('en-US')??String(n);
// "Found" or "Found · 2 copies waiting" for a found hero that isn't recruited yet.
const foundText=held=>held>1?`Found · ${held} copies waiting`:'Found';
function card(h,a,base){const copies=M.copies(h.id),held=M.held(h.id);
 // Found by an opening, not recruited: still a shadow, with its held copies and the one-time recruit price.
 if(!copies&&held)return `<button type="button" class="hero-card is-locked is-found${h.id===previewId?' is-open':''}" data-hero="${h.id}" style="${vars(h)}" aria-label="${esc(h.name)}, ${h.rarity}, ${foundText(held)}, recruit for ${crestText(M.recruitPrice(h.id))}"><span class="hero-card-art">${M.portrait(h.id,'hero-art',true)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-lock">${foundText(held)}</span><span class="hero-card-hint">Recruit · ${n2(M.recruitPrice(h.id))} Crests</span></button>`;
 // Never found: name, rarity frame, shadow and its full Crest price only. Tapping opens the buy preview.
 if(!copies)return `<button type="button" class="hero-card is-locked${h.id===previewId?' is-open':''}" data-hero="${h.id}" style="${vars(h)}" aria-label="${esc(h.name)}, ${h.rarity}, undiscovered, buy for ${crestText(M.priceOf(h.id))}"><span class="hero-card-art">${M.portrait(h.id,'hero-art',true)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-lock">Undiscovered</span><span class="hero-card-hint">Buy · ${n2(M.priceOf(h.id))} Crests</span></button>`;
 const on=h.id===a.id,tap=M.heroTap(h.id,copies),fx=M.effects(h.id,copies);
 return `<button type="button" class="hero-card${on?' is-active':''}${h.id===previewId?' is-open':''}" data-hero="${h.id}" style="${vars(h)}" aria-pressed="${on}" aria-label="${esc(h.name)}, ${h.rarity}, tap ${mult(tap)}, ${esc(fx.join(', '))}, ${esc(mastery(h.id,copies))}${on?', equipped':''}"><span class="hero-card-art">${M.portrait(h.id)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-tap">Tap ${mult(tap)} · <b>${num(tapOf(h.id,base))}</b></span><span class="hero-card-fx">${rows(h.id,copies)}</span><span class="hero-card-mastery">${esc(mastery(h.id,copies))}</span>${bar(h.id,copies)}${on?'<span class="hero-card-state">Equipped</span>':''}</button>`;}
function tier(r){const list=M.ROSTER.filter(h=>h.rarity===r);return `<section class="hero-tier" data-tier="${slug(r)}" style="${vars(list[0])}"><h3 class="hero-tier-title">${r}<span data-found="${slug(r)}"></span></h3><div class="hero-grid">${list.map(slot).join('')}</div><div class="hero-preview-slot"></div></section>`;}
function odds(){return `<p class="hero-odds-note">Each opening is free and separate: first a rarity, then one of its heroes at even chance. No guarantees. Every opening also gives Hero Crests, more for rarer heroes. A new hero is only found: recruit it once for its Recruit price, and every copy you found counts. Or buy a hero you haven't found at its Buy price. Test numbers, not final.</p><table><thead><tr><th scope="col">Rarity</th><th scope="col">Odds</th><th scope="col">Crests</th><th scope="col">Recruit</th><th scope="col">Buy</th></tr></thead><tbody>${M.RARITIES.map(r=>`<tr style="${vars(M.ROSTER.find(h=>h.rarity===r))}"><th scope="row">${r}</th><td>${M.ODDS[r]}%</td><td>+${M.CREST_REWARD[r]}</td><td>${n2(M.RECRUIT_PRICE[r])}</td><td>${n2(M.CREST_PRICE[r])}</td></tr>`).join('')}</tbody></table>`;}
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
<dl class="hero-stats"><div><dt>Tap power</dt><dd>${num(tapOf(h.id,base))}</dd></div><div><dt>Tap ${mult(tap)}</dt><dd>${r?'Mastery '+ROMAN[r]:'No mastery'}</dd></div></dl><p class="hero-current-fx">${rows(h.id,copies)}</p></div>`;}
function openBar(){const c=M.clock(),ch=M.charges(c.now),p=M.pending();let note,can=false;
 if(!c.trusted)note='Connect to check opening timer';
 else if(p)note='See your result below first';
 else if(ch.available<=0)note=`Next opening in ${left(ch.nextAt-c.now)}`;
 else{can=true;note=ch.nextAt?`Next one back in ${left(ch.nextAt-c.now)}`:'Each one comes back 24 hours after you use it';}
 return `${cardIcon()}<div class="hero-open-text"><strong>${c.trusted?ch.available:'–'}/${ch.max} openings</strong><span>${note}</span><span class="hero-crests" aria-label="${crestText(M.crests())}"><i aria-hidden="true"></i>${crestText(M.crests())} · tap a hero to recruit or buy a copy</span></div><div class="hero-open-actions"><button type="button" class="hero-button hero-open-button" data-open="1"${can?'':' disabled'}>OPEN HERO</button><button type="button" class="hero-button hero-quiet hero-odds-button" data-odds="1" aria-expanded="${oddsOpen}">Odds</button></div>`;}
// The Crest purchase for one hero: price, balance, then Confirm / Cancel showing the balance after. Nothing is spent until Confirm.
// A found hero (not recruited) only offers its one-time recruit price; a never-found one its full Buy price; an owned one Buy copy.
const isRecruit=id=>!M.copies(id)&&M.held(id)>0;
const priceFor=id=>isRecruit(id)?M.recruitPrice(id):M.priceOf(id);
function shop(h,copies){const recruit=isRecruit(h.id),price=priceFor(h.id),have=M.crests(),label=recruit?'Recruit':copies?'Buy copy':'Buy';
 const done=note&&note.id===h.id?`<p class="hero-shop-done" role="status">${esc(note.text)}</p>`:'';
 if(copies&&M.maxed(h.id,copies))return done+`<p class="hero-shop-line">Mastery VI · more copies add nothing.</p>`;
 const what=recruit?`recruit ${esc(h.name)}`:copies?`one more copy of ${esc(h.name)}`:`buy ${esc(h.name)}`;
 if(confirmId===h.id)return done+`<p class="hero-shop-line">Spend <b>${crestText(price)}</b> to ${what}? You have ${crestText(have)}, and ${n2(have-price)} after.</p><div class="hero-preview-actions"><button type="button" class="hero-button" data-confirm-buy="${h.id}">Confirm</button><button type="button" class="hero-button hero-quiet" data-cancel-buy="1">Cancel</button></div>`;
 const hint=recruit?`<p class="hero-preview-line">Found in an opening, so it costs less than buying. Every copy you found counts toward its mastery.</p>`:!copies?`<p class="hero-preview-line">Find it in an opening to recruit it for ${crestText(M.recruitPrice(h.id))} instead.</p>`:'';
 return done+`<p class="hero-shop-line">${label}: <b>${crestText(price)}</b> · you have ${crestText(have)}</p>${hint}<button type="button" class="hero-button hero-quiet hero-buy" data-buy="${h.id}"${have<price?' disabled':''}>${have<price?`Need ${n2(price-have)} more Crests`:`${label} · ${n2(price)} Crests`}</button>`;}
function preview(h,s){const a=M.active(),base=weaponTap(s),on=a.id===h.id,copies=M.copies(h.id);
 // Not recruited (found or never found): name, rarity and price only. No tap number, effects or colours.
 const held=M.held(h.id),status=held?foundText(held):'Undiscovered';
 if(!copies)return `<div class="hero-preview is-locked${held?' is-found':''}" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}, ${status}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id,'hero-art',true)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-line">${status}</p></div></div>
${shop(h,0)}<div class="hero-preview-actions is-single"><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div></div>`;
 const tap=M.heroTap(h.id,copies),r=M.rank(h.id,copies),next=M.nextThreshold(h.id,copies),nextFx=next?M.effects(h.id,next):[];
 return `<div class="hero-preview" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-mult">Tap ${mult(tap)}</p></div></div>
<p class="hero-preview-fx">${rows(h.id,copies,true)}</p><p class="hero-fx-help">${esc(M.help(h.id))}</p>
<p class="hero-preview-line">Base ${mult(h.tap)}${r?` · Mastery ${ROMAN[r]}: tap +${Math.round(r*M.MASTERY_STEP*100)}%, signature +${Math.round(r*M.SIGNATURE_STEP*100)}%`:''}</p>
<p class="hero-preview-line">${esc(mastery(h.id,copies))}</p>${bar(h.id,copies)}
${next?`<p class="hero-preview-line hero-next">At Mastery ${ROMAN[r+1]}: Tap ${mult(M.heroTap(h.id,next))} · ${esc(nextFx.join(' · '))}</p>`:''}
<p class="hero-preview-line">${on?`Current tap ${num(tapOf(h.id,base))}`:`Current tap ${num(tapOf(a.id,base))} → <b>${num(tapOf(h.id,base))}</b>`}</p>
<div class="hero-preview-actions"><button type="button" class="hero-button" data-equip="${h.id}"${on?' disabled':''}>${on?'Equipped':'Equip'}</button><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div>
${shop(h,copies)}</div>`;}
// The result of an opening: starts as the shadow, flashes the rarity and resolves into the portrait. Skipping only shortens it.
function reveal(p){const h=M.byId(p.id),up=p.after>p.before,tap=M.heroTap(h.id,p.copies),a=M.active();
 const crests=p.crests?`<p class="hero-reveal-crests">+${crestText(p.crests)}</p>`:'';
 if(p.found)return found(p,h,crests);
 const body=p.isNew?`<p class="hero-reveal-line">Tap ${mult(tap)} · added to your heroes</p><p class="hero-preview-fx">${rows(h.id,p.copies)}</p>${crests}`
  :`<p class="hero-reveal-line">Copies ${p.copies}</p><p class="hero-reveal-line">${esc(mastery(h.id,p.copies))}</p>${bar(h.id,p.copies)}${up?`<p class="hero-reveal-rank">Mastery ${ROMAN[p.after]} reached · Tap ${mult(tap)}</p>`:''}${crests}`;
 return `<div class="hero-reveal rarity-${slug(h.rarity)}${up?' is-rankup':''}" data-reveal="${esc(p.receipt)}" style="${vars(h)}" role="dialog" aria-label="Hero opening result">
<button type="button" class="hero-reveal-art" data-skip="1" aria-label="Skip reveal"><span class="hr-shadow">${M.portrait(h.id,'hero-art',true)}</span><span class="hr-color">${M.portrait(h.id)}</span></button>
<div class="hero-reveal-text"><span class="hero-reveal-tag">${p.isNew?'NEW':'DUPLICATE'}</span><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span>${body}</div>
<div class="hero-preview-actions">${p.isNew&&a.id!==h.id?`<button type="button" class="hero-button" data-reveal-equip="${h.id}">Equip</button>`:''}<button type="button" class="hero-button${p.isNew&&a.id!==h.id?' hero-quiet':''}" data-continue="${esc(p.receipt)}">Continue</button></div></div>`;}
// A hero the opening found but you haven't recruited: the shadow flashes its rarity and stays a shadow (it isn't yours yet).
// Recruit opens its preview with Confirm; Save for later keeps the offer on the board, with no time limit.
function found(p,h,crests){const now=M.copies(h.id)>0,price=M.recruitPrice(h.id),have=M.crests(),held=M.held(h.id)||p.held;
 const line=now?'Recruited':`Not recruited yet · ${held>1?`${held} copies waiting`:'1 copy waiting'}`;
 const act=now?`<button type="button" class="hero-button" data-continue="${esc(p.receipt)}">Continue</button>`
  :have>=price?`<button type="button" class="hero-button" data-reveal-recruit="${h.id}">Recruit · ${n2(price)} Crests</button><button type="button" class="hero-button hero-quiet" data-continue="${esc(p.receipt)}">Save for later</button>`
  :`<button type="button" class="hero-button hero-quiet" data-continue="${esc(p.receipt)}">Save for later</button>`;
 const need=!now&&have<price?`<p class="hero-reveal-line">Recruit for ${crestText(price)} · need ${n2(price-have)} more</p>`:'';
 return `<div class="hero-reveal is-found rarity-${slug(h.rarity)}" data-reveal="${esc(p.receipt)}" style="${vars(h)}" role="dialog" aria-label="Hero opening result">
<button type="button" class="hero-reveal-art" data-skip="1" aria-label="Skip reveal"><span class="hr-shadow">${M.portrait(h.id,'hero-art',true)}</span></button>
<div class="hero-reveal-text"><span class="hero-reveal-tag">FOUND</span><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-reveal-line">${line}</p>${need}${crests}</div>
<div class="hero-preview-actions">${act}</div></div>`;}

function paint(s){if(!el)return;const a=M.active(),base=weaponTap(s),bar_=openBar(),p=M.pending(),owned=M.ROSTER.map(h=>M.copies(h.id)+':'+M.held(h.id));
 const key=JSON.stringify([a.id,base,previewId,M.warning(),bar_,p?.receipt||'',owned,oddsOpen,confirmId,note]);if(key===lastKey)return;lastKey=key;
 el.current.innerHTML=current(s);el.current.setAttribute('style',vars(a));el.open.innerHTML=bar_;
 el.odds.hidden=!oddsOpen;const w=M.warning();el.warn.hidden=!w;el.warn.textContent=w;
 // Re-drawn only when it changes: a new result, or a found hero recruited or its price now affordable.
 const rv=p?reveal(p):'';if(rv!==shownReceipt){shownReceipt=rv;el.reveal.innerHTML=rv;}
 for(const h of M.ROSTER){const html=card(h,a,base);if(el.cards[h.id]!==html){el.cards[h.id]=html;el.root.querySelector(`[data-slot="${h.id}"]`).innerHTML=html;}}
 for(const r of M.RARITIES){const list=M.ROSTER.filter(h=>h.rarity===r);el.root.querySelector(`[data-found="${slug(r)}"]`).textContent=`${list.filter(h=>M.copies(h.id)).length}/${list.length} recruited`;}
 for(const slot of el.root.querySelectorAll('.hero-preview-slot'))slot.innerHTML='';
 const pv=M.byId(previewId);if(pv)el.root.querySelector(`[data-tier="${slug(pv.rarity)}"] .hero-preview-slot`).innerHTML=preview(pv,s);}
function repaint(){lastKey='';paint(read?.());}
function tapChanged(){root.draw?.();}
function doOpen(){const c=M.clock(),r=M.open({now:c.now,trusted:c.trusted});
 if(!r.ok){if(r.reason==='clock')Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);repaint();return;}
 if(r.replay){repaint();return;}
 root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();el?.reveal?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
// One confirmed purchase, at the price and collection the player saw. A repeat tap finds the collection changed and does nothing.
const WHY={funds:'Not enough Hero Crests.',stale:'Your heroes changed (another tab or an opening). Check the price and try again.',max:'This hero is already at Mastery VI.',save:'This device would not save it, so nothing was spent.',price:'The price changed. Check it and try again.',owned:'This hero is already recruited.',notfound:'Your heroes changed. Check the price and try again.'};
// seen/seenPrice/seenRecruit: the collection, price and kind of purchase the player was shown when they tapped Recruit or Buy.
let seen=0,seenPrice=0,seenRecruit=false;
function ask(id){confirmId=id;seen=M.seq();seenPrice=priceFor(id);seenRecruit=isRecruit(id);note=null;}
function buyNow(id){const h=M.byId(id);if(!h)return;const r=(seenRecruit?M.recruit:M.buy)({id,price:seenPrice,seq:seen});
 if(r.ok){const b=r.result,up=b.after>b.before;note={id,text:b.recruit?`Recruited ${h.name} with ${b.copies} ${b.copies===1?'copy':'copies'}${b.after?` · Mastery ${ROMAN[b.after]}`:''}. Equip it when you like.`:b.isNew?`Bought ${h.name}${b.copies>1?` with ${b.copies} copies`:''}. Equip it when you like.`:`Copy bought · Copies ${b.copies}${up?` · Mastery ${ROMAN[b.after]} reached`:''}`};root.LoreUI?.feedback?.('upgrade');}
 else note={id,text:WHY[r.reason]||'Nothing was bought.'};
 repaint();tapChanged();}
function click(e){const t=e.target.closest?.('button');if(!t||t.disabled||!el)return;const s=read?.();
 if(t.dataset.jump){el.root.querySelector(`[data-tier="${t.dataset.jump}"]`)?.scrollIntoView?.({block:'start',behavior:'smooth'});return;}
 if(t.dataset.open){doOpen();return;}
 if(t.dataset.odds){oddsOpen=!oddsOpen;repaint();return;}
 if(t.dataset.skip){t.closest?.('.hero-reveal')?.classList?.add('is-done');return;}
 if(t.dataset.continue){M.acknowledge(t.dataset.continue);repaint();return;}
 if(t.dataset.revealEquip){const p=M.pending();if(M.select(t.dataset.revealEquip)){if(p)M.acknowledge(p.receipt);root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();}return;}
 // Recruit from the result: the result is seen, and the hero's preview opens at Confirm. The offer never expires either way.
 if(t.dataset.revealRecruit){const id=t.dataset.revealRecruit,p=M.pending();if(!M.byId(id))return;if(p)M.acknowledge(p.receipt);previewId=id;ask(id);repaint();
  const pv=el.root.querySelector(`[data-preview="${id}"]`);pv?.scrollIntoView?.({block:'nearest',behavior:'smooth'});pv?.querySelector?.('[data-confirm-buy]')?.focus?.({preventScroll:true});return;}
 if(t.dataset.buy){ask(t.dataset.buy);repaint();el.root.querySelector(`[data-preview="${confirmId}"] [data-confirm-buy]`)?.focus?.({preventScroll:true});return;}
 if(t.dataset.cancelBuy){confirmId='';repaint();return;}
 if(t.dataset.confirmBuy){const id=t.dataset.confirmBuy;if(confirmId!==id)return;confirmId='';buyNow(id);return;}
 if(t.dataset.hero){previewId=previewId===t.dataset.hero?'':t.dataset.hero;confirmId='';note=null;repaint();if(previewId)el.root.querySelector(`[data-preview="${previewId}"]`)?.scrollIntoView?.({block:'nearest',behavior:'smooth'});return;}
 if(t.dataset.close){const id=previewId;previewId='';confirmId='';note=null;repaint();el.root.querySelector(`[data-hero="${id}"]`)?.focus?.({preventScroll:true});return;}
 if(t.dataset.equip){if(M.select(t.dataset.equip)){root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();el.root.querySelector(`[data-preview="${t.dataset.equip}"] [data-close]`)?.focus?.({preventScroll:true});}else repaint();}}
// Another tab opened or equipped a hero.
function onStorage(e){if(e?.key===M.KEY||e?.key===null){M.reload();repaint();tapChanged();}}

// target: the destination box; get: reads the current LOREBOUND state; format: the game's number format.
function mount(target,get,format){if(!enabled()||!target)return false;read=get;fmt=format;if(box!==target||!el?.root?.isConnected){leave();box=target;build();
  if(!M.clock().trusted)Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);
  timer=root.setInterval?.(()=>paint(read?.()),20000)??null;root.addEventListener?.('storage',onStorage);}
 paint(read?.());return true;}
function leave(){if(el?.root)el.root.removeEventListener('click',click);if(timer!==null)root.clearInterval?.(timer);timer=null;root.removeEventListener?.('storage',onStorage);box=null;el=null;previewId='';lastKey='';shownReceipt='';confirmId='';note=null;}
root.LoreHeroesUI={enabled,mount,leave};
})(globalThis);
