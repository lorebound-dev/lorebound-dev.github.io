/* Heroes screen for the fourth tab (DEV preview). Roster, portraits, chests, fragments, mastery, signatures and Crests live
   in heroes-model.js. Since #153 every chest gives hero fragments, 3 unlock a hero, and the chest level decides which
   rarities can drop at all. The Crest shop is not a separate screen: tapping a hero opens its preview with Buy 1 fragment
   (and Buy N to unlock when more than one is missing), then Confirm.
   Built once per visit and then only repainted, so scroll position and the open preview survive Equip, chests and game updates.
   One 20-second timer runs only while the tab is open, to keep the opening countdown current. */
(function(root){'use strict';
const M=root.LoreHeroes;
// confirm: the purchase waiting for Confirm ({id, n}). note: the short result of the last purchase, shown in its preview.
let box=null,el=null,fmt=null,previewId='',lastKey='',oddsOpen=false,shownReveal='',timer=null,read=null,confirm=null,note=null;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const slug=r=>r.toLowerCase();
const vars=h=>{const [ink,light,dark]=M.RARITY_COLORS[h.rarity];return `--hr-ink:${ink};--hr-light:${light};--hr-dark:${dark}`;};
const tierVars=r=>vars(M.ROSTER.find(h=>h.rarity===r));
const mult=n=>'×'+n.toFixed(2);
const ROMAN=['','I','II','III','IV','V','VI'];
function num(n){return n<1000?String(Math.round(n*10)/10):(typeof fmt==='function'?fmt(n):String(Math.round(n)));}
function enabled(){return !!M&&M.enabled();}
// Weapon tap without any hero, so every hero's number is the weapon's tap times its own multiplier, once.
function weaponTap(s){const L=root.Lore;if(!L||!s||typeof L.weaponTap!=='function')return 0;return L.weaponTap(s);}
// Tap power with a hero: weapon × its multiplier + its flat tap, the same sum Lore.tapPower uses for the equipped one.
const tapOf=(id,base)=>M.tapWith(id,M.fragments(id),base);
// At most two effect rows. A diamond marks each, coloured by what it boosts.
const kind=t=>/Gold/.test(t)?'gold':/Tap/.test(t)?'tap':'dps';
function rows(id,frags,long=false){return M.effects(id,frags,long).map(t=>`<span class="hero-fx hero-fx-${kind(t)}">${esc(t)}</span>`).join('');}
const n2=n=>n.toLocaleString?.('en-US')??String(n);
const crestText=n=>`${n2(n)} Hero Crest${n===1?'':'s'}`;
const fragText=n=>`${n} fragment${n===1?'':'s'}`;
function left(ms){const m=Math.max(1,Math.ceil(ms/60000)),h=Math.floor(m/60);return h?`${h}h ${m%60}m`:`${m}m`;}
// The real chance, honest for tiny ones: "0%" only when it is exactly 0, "<0.01%" when it is positive but smaller.
const chance=p=>p<=0?'0%':p<0.01?'&lt;0.01%':p.toFixed(2)+'%';
// "Mastery II · 15/21 fragments", or the max.
function mastery(id,f){const r=M.rank(id,f),next=M.nextThreshold(id,f);return `${r?'Mastery '+ROMAN[r]:'No mastery yet'} · ${next?`${f}/${next} fragments`:`${f} fragments · max`}`;}
function bar(id,f){const r=M.rank(id,f),next=M.nextThreshold(id,f);let pct=100;
 if(f<M.UNLOCK)pct=Math.round(100*f/M.UNLOCK);else if(next){const from=r?M.MILESTONES[r-1]:M.UNLOCK;pct=Math.round(100*(f-from)/(next-from));}
 return `<span class="hero-bar" role="presentation"><span style="width:${pct}%"></span></span>`;}
// A small chest motif drawn from squares.
const CARD=['.oooooo.','obbbbbbo','obggggbo','obgwwgbo','obgwwgbo','obggggbo','obbbbbbo','.oooooo.'],CARD_PAL={o:'#2a1a10',b:'#9b6d2f',g:'#e2c180',w:'#fae3a3'};
function cardIcon(){let r='';CARD.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]!=='.')r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${CARD_PAL[row[x]]}"/>`;});return `<svg class="hero-open-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`;}

function slot(h){return `<div class="hero-slot" data-slot="${h.id}"></div>`;}
// A hero that isn't unlocked: its shadow, name and one short status. Never colours, numbers or effects.
function shadowCard(h,f,open){const gated=!M.tierOpen(h.rarity),cls=gated?' is-gated':f?' is-found':'';
 const lock=gated?'Locked':f?`${f}/${M.UNLOCK} fragments`:'Undiscovered',hint=gated?`Unlocks at Chest ${M.GATES[h.rarity]}`:`${n2(M.fragPrice(h.id))} Crests a fragment`;
 return `<button type="button" class="hero-card is-locked${cls}${open?' is-open':''}" data-hero="${h.id}" style="${vars(h)}" aria-label="${esc(h.name)}, ${h.rarity}, ${lock}, ${hint}"><span class="hero-card-art">${M.portrait(h.id,'hero-art',true)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-lock">${lock}</span>${f&&!gated?bar(h.id,f):''}<span class="hero-card-hint">${hint}</span></button>`;}
function card(h,a,base){const f=M.fragments(h.id),open=h.id===previewId;if(f<M.UNLOCK)return shadowCard(h,f,open);
 const on=h.id===a.id,tap=M.heroTap(h.id,f),fx=M.effects(h.id,f);
 return `<button type="button" class="hero-card${on?' is-active':''}${open?' is-open':''}" data-hero="${h.id}" style="${vars(h)}" aria-pressed="${on}" aria-label="${esc(h.name)}, ${h.rarity}, tap ${mult(tap)}, ${esc(fx.join(', '))}, ${esc(mastery(h.id,f))}${on?', equipped':''}"><span class="hero-card-art">${M.portrait(h.id)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-tap">Tap ${mult(tap)} · <b>${num(tapOf(h.id,base))}</b></span><span class="hero-card-fx">${rows(h.id,f)}</span><span class="hero-card-mastery">${esc(mastery(h.id,f))}</span>${bar(h.id,f)}${on?'<span class="hero-card-state">Equipped</span>':''}</button>`;}
function tier(r){const list=M.ROSTER.filter(h=>h.rarity===r);return `<section class="hero-tier" data-tier="${slug(r)}" style="${vars(list[0])}"><h3 class="hero-tier-title">${r}<span data-found="${slug(r)}"></span></h3><div class="hero-grid">${list.map(slot).join('')}</div><div class="hero-preview-slot"></div></section>`;}
// The odds as they are for the next chest, worked out from the chests opened.
function odds(){const opened=M.opened(),now=M.odds(opened),full=M.RARITIES.map(r=>String(M.ODDS[r])).join(' / ');
 return `<p class="hero-odds-note">Each chest is free and separate: first a rarity, then one of its heroes at even chance. No guarantees. A rarity can't drop at all until enough chests are opened. Then it starts tiny and grows over ${M.RAMP} chests to its full share (${full}%). Each chest gives 1 fragment, or very rarely (${M.JACKPOT*100}%) a full hero: ${M.UNLOCK} fragments. ${M.UNLOCK} fragments unlock a hero, and more raise its mastery at ${M.MILESTONES.join(', ')}. Every chest also gives Hero Crests, which buy single fragments of unlocked rarities. Test numbers, not final.</p><table><thead><tr><th scope="col">Rarity</th><th scope="col">Now</th><th scope="col">Unlock</th><th scope="col">Crests</th><th scope="col">Fragment</th></tr></thead><tbody>${M.RARITIES.map(r=>`<tr style="${tierVars(r)}"${M.tierOpen(r)?'':' class="is-gated"'}><th scope="row">${r}</th><td>${chance(now[r])}</td><td>${M.tierOpen(r)?'Open':'Chest '+M.GATES[r]}</td><td>+${M.CREST_REWARD[r]}</td><td>${n2(M.FRAG_PRICE[r])}</td></tr>`).join('')}</tbody></table>`;}
function build(){box.innerHTML=`<section class="heroes" aria-label="Heroes">
<p class="hero-dev"><strong>DEV preview.</strong> Heroes are kept on this device only, outside your save. Names, art, odds and numbers are not final.</p>
<p class="hero-warn" data-h="warn" role="status" hidden></p>
<article class="hero-current" data-h="current" aria-live="polite"></article>
<section class="hero-open" data-h="open" aria-label="Hero chests"></section>
<div class="hero-odds" data-h="odds" hidden></div>
<div class="hero-reveal-slot" data-h="reveal"></div>
<div class="hero-jump" role="group" aria-label="Jump to a rarity">${M.RARITIES.map(r=>`<button type="button" data-jump="${slug(r)}" style="${tierVars(r)}">${r}</button>`).join('')}</div>
${M.RARITIES.map(tier).join('')}
</section>`;
 const q=s=>box.querySelector(s);el={root:q('.heroes'),warn:q('[data-h="warn"]'),current:q('[data-h="current"]'),open:q('[data-h="open"]'),odds:q('[data-h="odds"]'),reveal:q('[data-h="reveal"]'),cards:{}};
 el.root.addEventListener('click',click);previewId='';lastKey='';shownReveal='';}

function current(s){const h=M.active(),base=weaponTap(s),f=M.fragments(h.id),tap=M.heroTap(h.id,f),r=M.rank(h.id,f);return `<div class="hero-portrait" style="${vars(h)}">${M.portrait(h.id)}</div><div class="hero-current-text"><span class="hero-kicker">Equipped</span><h3>${esc(h.name)}</h3><span class="hero-rarity" style="${vars(h)}">${h.rarity}</span>
<dl class="hero-stats"><div><dt>Tap power</dt><dd>${num(tapOf(h.id,base))}</dd></div><div><dt>Tap ${mult(tap)}</dt><dd>${r?'Mastery '+ROMAN[r]:'No mastery'}</dd></div></dl><p class="hero-current-fx">${rows(h.id,f)}</p></div>`;}
// Chest level: one short line and a small bar toward the next rarity.
function chestLine(){const opened=M.opened(),next=M.nextUnlock(opened),pct=next?Math.round(100*(opened-next.from)/(next.at-next.from)):100;
 return `<div class="hero-chest"><span class="hero-chest-level">Chest Level ${M.level(opened)} · ${n2(opened)} opened</span><span class="hero-chest-next">${next?`Next: ${next.rarity} at ${n2(next.at)} chests`:'All rarities unlocked'}</span><span class="hero-bar hero-chest-bar" role="presentation"><span style="width:${pct}%"></span></span></div>`;}
function openBar(){const c=M.clock(),ch=M.charges(c.now),p=M.pending();let line,can=false;
 if(!c.trusted)line='Connect to check opening timer';
 else if(p)line='See your result below first';
 else if(ch.available<=0)line=`Next opening in ${left(ch.nextAt-c.now)}`;
 else{can=true;line=ch.nextAt?`Next one back in ${left(ch.nextAt-c.now)}`:'Each one comes back 24 hours after you use it';}
 return `${cardIcon()}<div class="hero-open-text"><strong>${c.trusted?ch.available:'–'}/${ch.max} openings</strong><span>${line}</span><span class="hero-crests" aria-label="${crestText(M.crests())}"><i aria-hidden="true"></i>${crestText(M.crests())} · tap a hero to buy fragments</span></div>${chestLine()}<div class="hero-open-actions"><button type="button" class="hero-button hero-open-button" data-open="1"${can?'':' disabled'}>OPEN CHEST</button><button type="button" class="hero-button hero-quiet hero-odds-button" data-odds="1" aria-expanded="${oddsOpen}">Odds</button></div>`;}
// The Crest purchase for one hero: 1 fragment, or every fragment still missing to unlock it. Nothing is spent until Confirm.
function shop(h,f){const price=M.fragPrice(h.id),have=M.crests(),done=note&&note.id===h.id?`<p class="hero-shop-done" role="status">${esc(note.text)}</p>`:'';
 if(M.maxed(h.id,f))return done+`<p class="hero-shop-line">Mastery VI · more fragments add nothing.</p>`;
 if(confirm&&confirm.id===h.id){const cost=price*confirm.n,unlock=f<M.UNLOCK&&f+confirm.n>=M.UNLOCK;
  return done+`<p class="hero-shop-line">Spend <b>${crestText(cost)}</b> on ${fragText(confirm.n)} of ${esc(h.name)}?${unlock?' That unlocks it.':''} You have ${crestText(have)}, and ${n2(have-cost)} after.</p><div class="hero-preview-actions"><button type="button" class="hero-button" data-confirm-buy="${h.id}">Confirm</button><button type="button" class="hero-button hero-quiet" data-cancel-buy="1">Cancel</button></div>`;}
 const missing=f<M.UNLOCK?M.UNLOCK-f:0,btn=(n,label)=>{const cost=price*n;return `<button type="button" class="hero-button hero-quiet hero-buy" data-buy="${h.id}" data-count="${n}"${have<cost?' disabled':''}>${label} · ${n2(cost)} Crests</button>`;};
 return done+`<p class="hero-shop-line">Fragment: <b>${crestText(price)}</b> · you have ${crestText(have)}</p>${btn(1,'Buy 1 fragment')}${missing>1?btn(missing,`Buy ${missing} to unlock`):''}`;}
function preview(h,s){const a=M.active(),base=weaponTap(s),on=a.id===h.id,f=M.fragments(h.id);
 // Not unlocked: name, rarity, fragment progress and the shop only. No tap number, effects or colours.
 if(f<M.UNLOCK){const gated=!M.tierOpen(h.rarity);
  const status=gated?`Locked · ${h.rarity} heroes unlock at Chest ${M.GATES[h.rarity]}. You've opened ${n2(M.opened())}.`:f?`${f}/${M.UNLOCK} fragments · ${M.UNLOCK-f} more to unlock, for free`:`Undiscovered · ${M.UNLOCK} fragments unlock it, for free`;
  return `<div class="hero-preview is-locked${f?' is-found':''}" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id,'hero-art',true)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-line">${status}</p></div></div>
${gated?'':bar(h.id,f)+shop(h,f)}<div class="hero-preview-actions is-single"><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div></div>`;}
 const tap=M.heroTap(h.id,f),r=M.rank(h.id,f),next=M.nextThreshold(h.id,f),nextFx=next?M.effects(h.id,next):[];
 return `<div class="hero-preview" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-mult">Tap ${mult(tap)}</p></div></div>
<p class="hero-preview-fx">${rows(h.id,f,true)}</p><p class="hero-fx-help">${esc(M.help(h.id))}</p>
<p class="hero-preview-line">Base ${mult(h.tap)}${r?` · Mastery ${ROMAN[r]}: tap +${Math.round(r*M.MASTERY_STEP*100)}%, signature +${Math.round(r*M.SIGNATURE_STEP*100)}%`:''}</p>
<p class="hero-preview-line">${esc(mastery(h.id,f))}</p>${bar(h.id,f)}
${next?`<p class="hero-preview-line hero-next">At Mastery ${ROMAN[r+1]}: Tap ${mult(M.heroTap(h.id,next))} · ${esc(nextFx.join(' · '))}</p>`:''}
<p class="hero-preview-line">${on?`Current tap ${num(tapOf(h.id,base))}`:`Current tap ${num(tapOf(a.id,base))} → <b>${num(tapOf(h.id,base))}</b>`}</p>
<div class="hero-preview-actions"><button type="button" class="hero-button" data-equip="${h.id}"${on?' disabled':''}>${on?'Equipped':'Equip'}</button><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div>
${shop(h,f)}</div>`;}
// The result of a chest. A hero that is (now) unlocked starts as its shadow, flashes its rarity and resolves into the
// portrait; one that still needs fragments flashes and stays a shadow. Skipping only shortens it.
function reveal(p){const h=M.byId(p.id),a=M.active(),open=p.after>=M.UNLOCK,up=open&&p.to>p.from;
 const tag=p.jackpot?`FULL HERO · +${p.added||M.UNLOCK} fragments`:p.isNew?'NEW HERO':p.added===0?'MASTERY VI':'FRAGMENT';
 const crests=p.crests?`<p class="hero-reveal-crests">+${crestText(p.crests)}</p>`:'';
 let body;
 if(!open)body=`<p class="hero-reveal-line">+${fragText(p.added)} · ${p.after}/${M.UNLOCK} to unlock</p>${bar(h.id,p.after)}`;
 else if(p.isNew)body=`<p class="hero-reveal-line">Unlocked · Tap ${mult(M.heroTap(h.id,p.after))}</p><p class="hero-preview-fx">${rows(h.id,p.after)}</p>${p.after>M.UNLOCK?`<p class="hero-reveal-line">${esc(mastery(h.id,p.after))}</p>`:''}`;
 else if(p.added===0)body=`<p class="hero-reveal-line">Already at Mastery VI · this fragment adds nothing</p>`;
 else body=`<p class="hero-reveal-line">+${fragText(p.added)} · ${esc(mastery(h.id,p.after))}</p>${bar(h.id,p.after)}${up?`<p class="hero-reveal-rank">Mastery ${ROMAN[p.to]} reached · Tap ${mult(M.heroTap(h.id,p.after))}</p>`:''}`;
 const tierLine=p.tier?`<p class="hero-reveal-tier" style="${tierVars(p.tier)}">${p.tier.toUpperCase()} HEROES UNLOCKED</p>`:'';
 const equip=p.isNew&&a.id!==h.id;
 return `<div class="hero-reveal rarity-${slug(h.rarity)}${open?'':' is-shadow'}${up?' is-rankup':''}${p.jackpot?' is-jackpot':''}" data-reveal="${esc(p.receipt)}" style="${vars(h)}" role="dialog" aria-label="Hero chest result">
<button type="button" class="hero-reveal-art" data-skip="1" aria-label="Skip reveal"><span class="hr-shadow">${M.portrait(h.id,'hero-art',true)}</span>${open?`<span class="hr-color">${M.portrait(h.id)}</span>`:''}</button>
<div class="hero-reveal-text"><span class="hero-reveal-tag">${tag}</span><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span>${body}${crests}</div>${tierLine}
<div class="hero-preview-actions">${equip?`<button type="button" class="hero-button" data-reveal-equip="${h.id}">Equip</button>`:''}<button type="button" class="hero-button${equip?' hero-quiet':''}" data-continue="${esc(p.receipt)}">Continue</button></div></div>`;}

function paint(s){if(!el)return;const a=M.active(),base=weaponTap(s),bar_=openBar(),p=M.pending(),frags=M.ROSTER.map(h=>M.fragments(h.id));
 const key=JSON.stringify([a.id,base,previewId,M.warning(),bar_,p?.receipt||'',frags,oddsOpen,confirm,note]);if(key===lastKey)return;lastKey=key;
 el.current.innerHTML=current(s);el.current.setAttribute('style',vars(a));el.open.innerHTML=bar_;
 el.odds.hidden=!oddsOpen;el.odds.innerHTML=oddsOpen?odds():'';const w=M.warning();el.warn.hidden=!w;el.warn.textContent=w;
 // Re-drawn only when it changes (a new result), so the reveal animation isn't restarted by a repaint.
 const rv=p?reveal(p):'';if(rv!==shownReveal){shownReveal=rv;el.reveal.innerHTML=rv;}
 for(const h of M.ROSTER){const html=card(h,a,base);if(el.cards[h.id]!==html){el.cards[h.id]=html;el.root.querySelector(`[data-slot="${h.id}"]`).innerHTML=html;}}
 for(const r of M.RARITIES){const list=M.ROSTER.filter(h=>h.rarity===r);el.root.querySelector(`[data-found="${slug(r)}"]`).textContent=M.tierOpen(r)?`${list.filter(h=>M.unlocked(h.id)).length}/${list.length} unlocked`:`Unlocks at Chest ${M.GATES[r]}`;}
 for(const slot of el.root.querySelectorAll('.hero-preview-slot'))slot.innerHTML='';
 const pv=M.byId(previewId);if(pv)el.root.querySelector(`[data-tier="${slug(pv.rarity)}"] .hero-preview-slot`).innerHTML=preview(pv,s);}
function repaint(){lastKey='';paint(read?.());}
function tapChanged(){root.draw?.();}
function doOpen(){const c=M.clock(),r=M.open({now:c.now,trusted:c.trusted});
 if(!r.ok){if(r.reason==='clock')Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);repaint();return;}
 if(r.replay){repaint();return;}
 root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();el?.reveal?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
// One confirmed purchase, at the count, price and collection the player saw. A repeat tap finds the collection changed and does nothing.
const WHY={funds:'Not enough Hero Crests.',stale:'Your heroes changed (another tab or a chest). Check the price and try again.',max:'This hero is already at Mastery VI.',count:'That is more fragments than this hero can use.',save:'This device would not save it, so nothing was spent.',price:'The price changed. Check it and try again.',locked:'This rarity is still locked.'};
// seen/seenPrice: the collection and the total price the player was shown when they tapped Buy.
let seen=0,seenPrice=0;
function ask(id,n){confirm={id,n};seen=M.seq();seenPrice=M.fragPrice(id)*n;note=null;}
function buyNow(id,n){const h=M.byId(id);if(!h)return;const r=M.buy({id,count:n,price:seenPrice,seq:seen});
 if(r.ok){const b=r.result;note={id,text:`Bought ${fragText(b.count)}.`+(b.isNew?` ${h.name} is unlocked. Equip it when you like.`:b.after<M.UNLOCK?` ${b.after}/${M.UNLOCK} to unlock.`:b.to>b.from?` Mastery ${ROMAN[b.to]} reached.`:` ${mastery(id,b.after)}.`)};root.LoreUI?.feedback?.('upgrade');}
 else note={id,text:WHY[r.reason]||'Nothing was bought.'};
 repaint();tapChanged();}
function click(e){const t=e.target.closest?.('button');if(!t||t.disabled||!el)return;
 if(t.dataset.jump){el.root.querySelector(`[data-tier="${t.dataset.jump}"]`)?.scrollIntoView?.({block:'start',behavior:'smooth'});return;}
 if(t.dataset.open){doOpen();return;}
 if(t.dataset.odds){oddsOpen=!oddsOpen;repaint();return;}
 if(t.dataset.skip){t.closest?.('.hero-reveal')?.classList?.add('is-done');return;}
 if(t.dataset.continue){M.acknowledge(t.dataset.continue);repaint();return;}
 if(t.dataset.revealEquip){const p=M.pending();if(M.select(t.dataset.revealEquip)){if(p)M.acknowledge(p.receipt);root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();}return;}
 if(t.dataset.buy){ask(t.dataset.buy,Number(t.dataset.count)||1);repaint();el.root.querySelector(`[data-preview="${t.dataset.buy}"] [data-confirm-buy]`)?.focus?.({preventScroll:true});return;}
 if(t.dataset.cancelBuy){confirm=null;repaint();return;}
 if(t.dataset.confirmBuy){const id=t.dataset.confirmBuy;if(!confirm||confirm.id!==id)return;const n=confirm.n;confirm=null;buyNow(id,n);return;}
 if(t.dataset.hero){previewId=previewId===t.dataset.hero?'':t.dataset.hero;confirm=null;note=null;repaint();if(previewId)el.root.querySelector(`[data-preview="${previewId}"]`)?.scrollIntoView?.({block:'nearest',behavior:'smooth'});return;}
 if(t.dataset.close){const id=previewId;previewId='';confirm=null;note=null;repaint();el.root.querySelector(`[data-hero="${id}"]`)?.focus?.({preventScroll:true});return;}
 if(t.dataset.equip){if(M.select(t.dataset.equip)){root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();el.root.querySelector(`[data-preview="${t.dataset.equip}"] [data-close]`)?.focus?.({preventScroll:true});}else repaint();}}
// Another tab opened a chest, bought or equipped a hero.
function onStorage(e){if(e?.key===M.KEY||e?.key===null){M.reload();repaint();tapChanged();}}

// target: the destination box; get: reads the current LOREBOUND state; format: the game's number format.
function mount(target,get,format){if(!enabled()||!target)return false;read=get;fmt=format;if(box!==target||!el?.root?.isConnected){leave();box=target;build();
  if(!M.clock().trusted)Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);
  timer=root.setInterval?.(()=>paint(read?.()),20000)??null;root.addEventListener?.('storage',onStorage);}
 paint(read?.());return true;}
function leave(){if(el?.root)el.root.removeEventListener('click',click);if(timer!==null)root.clearInterval?.(timer);timer=null;root.removeEventListener?.('storage',onStorage);box=null;el=null;previewId='';lastKey='';shownReveal='';confirm=null;note=null;}
root.LoreHeroesUI={enabled,mount,leave};
})(globalThis);
