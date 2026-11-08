/* Heroes screen for the fourth tab (DEV preview). Roster, portraits, chests, fragments, mastery, signatures and Crests live
   in heroes-model.js; this file only shows them. Since #168 the screen is:
   - a small top line (equipped hero, Hero Crests, Chest Level, an About button);
   - one ornate shelf with the three chests (ready, or dim with the time until it comes back);
   - one swipable strip of all 25 heroes in roster order, each with a rarity frame, name, rarity and fragment count;
   - a hero's detail (stats, Equip, the fragment shop) under the strip, only after tapping its card;
   - a chest screen (one big chest, the real odds for the next chest, OPEN and Back) after tapping a chest.
   OPEN asks the model for one chest first. The model commits the result (fragments, Crests, charge, chest count, receipt)
   in one write before anything moves. Only then: the lid opens, an orb in the drawn hero's rarity colour rises, the chest
   goes, the strip scrolls to that hero's own card, the orb flies there and lands with a short sparkle, and the card shows
   its new count. The result is acknowledged when it lands (or on Skip). Leaving or reloading mid-way keeps it pending, and
   the next visit replays a short landing from the stored receipt: never a new roll and never a second charge.
   Without timers or with reduced motion it lands at once. The strip, shelf and detail are only repainted, so the strip's
   scroll position survives Equip, chests and game updates. One 20-second timer runs only while the tab is open. */
(function(root){'use strict';
const M=root.LoreHeroes;
// confirm: the purchase waiting for Confirm ({id, n}). note: the short result of the last purchase, shown in its detail.
// view: 'main' or 'chest'. anim: the landing in progress ({p, timers, fly}). hold: the card and Crest values to show until
// the orb lands. toast: the last landed result. landId: the card playing its landing effect.
let box=null,el=null,fmt=null,read=null,timer=null,detailId='',confirm=null,note=null,aboutOpen=false,view='main',msg='',
 toast=null,landId='',landTimer=null,landed='',hold=null,anim=null,stripLeft=0,parts={};
// Timings in ms (DEV, tune by feel): lid, orb rising, chest going, strip scroll, flight, landing effect.
const T={lid:380,orb:380,gone:260,scroll:160,fly:780,land:1100,short:450};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
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
// The shelf's short form: "23h" or "45m".
function short(ms){const m=Math.max(1,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+'h':m+'m';}
// The real chance, honest for tiny ones: "0%" only when it is exactly 0, "<0.01%" when it is positive but smaller.
const chance=p=>p<=0?'0%':p<0.01?'&lt;0.01%':p.toFixed(2)+'%';
// "Mastery II · 15/21 fragments", or the max.
function mastery(id,f){const r=M.rank(id,f),next=M.nextThreshold(id,f);return `${r?'Mastery '+ROMAN[r]:'No mastery yet'} · ${next?`${f}/${next} fragments`:`${f} fragments · max`}`;}
function bar(id,f){const r=M.rank(id,f),next=M.nextThreshold(id,f);let pct=100;
 if(f<M.UNLOCK)pct=Math.round(100*f/M.UNLOCK);else if(next){const from=r?M.MILESTONES[r-1]:M.UNLOCK;pct=Math.round(100*(f-from)/(next-from));}
 return `<span class="hero-bar" role="presentation"><span style="width:${pct}%"></span></span>`;}
const reduced=()=>{try{return !!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}catch{return false;}};

// The chest, drawn from squares: a lid and a body, so the lid can lift on its own.
const LID=['..oooooooooooo..','.owwwwgwwgwwwwo.','owwwwwgwwgwwwwwo','owwwwwgwwgwwwwwo','obbbbbbbbbbbbbbo'];
const BASE=['odddddbllbdddddo','owwwwwbllbwwwwwo','owwwwwbbbbwwwwwo','owwwwwgwwgwwwwwo','owwwwwgwwgwwwwwo','obbbbbbbbbbbbbbo','.oooooooooooooo.'];
const CHEST_PAL={o:'#2a1a10',w:'#8a5a34',d:'#5a3820',g:'#c9a560',b:'#e2c180',l:'#fae3a3'};
function pix(rows_,pal,cls){let r='';rows_.forEach((row,y)=>{for(let x=0;x<row.length;){const ch=row[x];let n=1;while(x+n<row.length&&row[x+n]===ch)n++;if(ch!=='.')r+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${pal[ch]}"/>`;x+=n;}});
 return `<svg class="${cls}" viewBox="0 0 ${rows_[0].length} ${rows_.length}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r}</svg>`;}
function chestArt(cls=''){return `<span class="hero-chest-art${cls?' '+cls:''}" aria-hidden="true">${pix(LID,CHEST_PAL,'hc-lid')}<span class="hc-glow"></span>${pix(BASE,CHEST_PAL,'hc-base')}</span>`;}

// What a card shows while the orb is still on its way: the count from before the chest.
const shownFrags=id=>hold&&hold.id===id?hold.frags:M.fragments(id);
function slot(h){return `<div class="hero-slot" role="listitem" data-slot="${h.id}"></div>`;}
// One card per hero: portrait (or its shadow until unlocked), name, rarity and the fragment count. Nothing else.
function card(h,a){const f=shownFrags(h.id),gated=!M.tierOpen(h.rarity),owned=f>=M.UNLOCK,on=owned&&h.id===a.id,next=M.nextThreshold(h.id,f);
 const count=gated?`Chest ${n2(M.GATES[h.rarity])}`:next?`${f}/${next}`:`${f} · max`;
 const status=gated?`locked until chest ${M.GATES[h.rarity]}`:owned?mastery(h.id,f):`${f} of ${M.UNLOCK} fragments`;
 let fx='',extra='';
 if(landId===h.id&&toast){const p=toast;fx=` is-landing${p.isNew?' is-unlocking':''}${!p.isNew&&p.to>p.from?' is-rankup':''}${p.jackpot?' is-jackpot':''}`;
  extra=`<span class="hero-spark" aria-hidden="true"></span><span class="hero-card-float" aria-hidden="true">+${p.added} Fragment${p.added===1?'':'s'}</span>`;}
 return `<button type="button" class="hero-card${owned?'':' is-locked'}${gated?' is-gated':''}${f&&!owned?' is-found':''}${on?' is-active':''}${detailId===h.id?' is-open':''}${fx}" data-hero="${h.id}" style="${vars(h)}" aria-label="${esc(h.name)}, ${h.rarity}, ${esc(status)}${on?', equipped':''}"><span class="hero-card-art">${M.portrait(h.id,'hero-art',!owned)}</span><span class="hero-card-name">${esc(h.name)}</span><span class="hero-card-rarity">${h.rarity}</span><span class="hero-card-frags">${count}</span>${gated?'':bar(h.id,f)}${extra}</button>`;}

// The rules in plain words, only behind the "?" button.
function about(){const full=M.RARITIES.map(r=>String(M.ODDS[r])).join(' / '),crests=M.RARITIES.map(r=>`${r} ${M.CREST_REWARD[r]}`).join(', ');
 return `<p><strong>DEV preview.</strong> Heroes are kept on this device only, outside your save. Names, art, odds and numbers are not final.</p>
<p>Each chest is free and separate: first a rarity, then one of its heroes at even chance. No guarantees. A rarity can't drop at all until enough chests are opened. Then it starts tiny and grows over ${M.RAMP} chests to its full share (${full}%). Each chest gives 1 Hero Fragment, or very rarely (${M.JACKPOT*100}%) a full hero: ${M.UNLOCK} fragments. ${M.UNLOCK} fragments unlock a hero, and more raise its mastery at ${M.MILESTONES.join(', ')}.</p>
<p>Every chest also gives Hero Crests (${crests}), which buy single fragments of unlocked rarities. Tap a hero to buy.</p>`;}
function top(){const a=M.active(),cr=hold?hold.crests:M.crests(),opened=M.opened(),next=M.nextUnlock(opened),pct=next?Math.round(100*(opened-next.from)/(next.at-next.from)):100;
 return `<div class="hero-top-row"><span class="hero-badge" style="${vars(a)}"><span class="hero-badge-art">${M.portrait(a.id)}</span><span class="hero-badge-text"><small>Equipped</small>${esc(a.name)}</span></span><span class="hero-crests" aria-label="${crestText(cr)}"><i aria-hidden="true"></i>${n2(cr)}</span><button type="button" class="hero-about-button" data-about="1" aria-expanded="${aboutOpen}" aria-label="About Heroes">?</button></div>
<div class="hero-level"><span class="hero-level-name">Chest Level ${M.level(opened)}</span><span class="hero-level-next">${next?`Next: ${next.rarity} at ${n2(next.at)}`:'All rarities unlocked'}</span><span class="hero-bar" role="presentation"><span style="width:${pct}%"></span></span></div>`;}
// The shelf: one chest per charge. Ready ones come first; a spent one is dim and shows when it comes back.
// Unlimited (#169, test only): all three are always ready, with no times and one small label instead of the count.
function shelf(){const c=M.clock(),ch=M.charges(c.now),at=ch.at||[];let s='';
 if(ch.unlimited){for(let i=0;i<ch.max;i++)s+=`<button type="button" class="hero-shelf-chest is-ready" data-chest="${i}"${anim?' disabled':''} aria-label="Hero chest, ready. See the odds and open it">${chestArt()}</button>`;
  return `<div class="hero-shelf-arch" aria-hidden="true"></div><div class="hero-shelf-row">${s}</div><div class="hero-shelf-plank" aria-hidden="true"></div><p class="hero-shelf-line"><span>Unlimited chests</span><span class="hero-dev-tag">TEST · UNLIMITED</span></p>`;}
 for(let i=0;i<ch.max;i++){const ready=c.trusted&&i<ch.available,back=at[i-ch.available]??ch.nextAt;
  const label=!c.trusted?'–':ready?'':short(back-c.now),aria=ready?'Hero chest, ready. See the odds and open it':c.trusted?`Hero chest, back in ${left(back-c.now)}. See the odds`:'Hero chest. Connect to check the chest timer';
  s+=`<button type="button" class="hero-shelf-chest ${ready?'is-ready':'is-spent'}" data-chest="${i}"${anim?' disabled':''} aria-label="${aria}">${chestArt()}${label?`<span class="hero-shelf-time">${label}</span>`:''}</button>`;}
 const line=!c.trusted?'Connect to check chest timer':ch.available?`${ch.available}/${ch.max} chests ready`:`0/${ch.max} · next in ${left(ch.nextAt-c.now)}`;
 return `<div class="hero-shelf-arch" aria-hidden="true"></div><div class="hero-shelf-row">${s}</div><div class="hero-shelf-plank" aria-hidden="true"></div><p class="hero-shelf-line"><span>${line}</span><span class="hero-dev-tag">DEV preview</span></p>`;}
// The chest screen: one big chest, the real odds for the next chest (worked out from the chests opened), OPEN and Back.
function scene(){const c=M.clock(),ch=M.charges(c.now),opened=M.opened(),now=M.odds(opened),p=M.pending(),can=!!p||ch.unlimited||(c.trusted&&ch.available>0);
 const list=M.RARITIES.map(r=>{const open=opened>=M.GATES[r];return `<li${open?'':' class="is-gated"'} style="${tierVars(r)}"><i aria-hidden="true"></i><span class="hero-odds-name">${r}</span><span class="hero-odds-gate">${open?'':'Chest '+n2(M.GATES[r])}</span><b>${chance(now[r])}</b></li>`;}).join('');
 const status=p?'Result waiting':ch.unlimited?'Unlimited · TEST':!c.trusted?'Connect to check chest timer':ch.available?`${ch.available}/${ch.max} ready`:`Next in ${left(ch.nextAt-c.now)}`;
 return `<div class="hero-scene-head"><button type="button" class="hero-button hero-quiet hero-back" data-back="1">Back</button><h3>Hero Chest</h3><span class="hero-scene-status">${status}</span></div>
<div class="hero-scene-stage">${chestArt('is-big')}<span class="hero-orb" aria-hidden="true"></span></div>
<p class="hero-scene-sub">Odds for chest ${n2(opened+1)}</p>
<ol class="hero-scene-odds" aria-label="Odds for your next chest">${list}</ol>
<p class="hero-scene-msg" role="status"${msg?'':' hidden'}>${esc(msg)}</p>
<button type="button" class="hero-button hero-open-button" data-open="1"${can?'':' disabled'}>OPEN</button>`;}
// One short line under the shelf after a landing. Tapping the card shows everything else.
function toastHtml(){if(!toast)return '';const p=toast,h=M.byId(p.id),a=M.active(),owned=p.after>=M.UNLOCK;
 const got=p.jackpot?`FULL HERO · +${p.added} Fragments`:p.added===0?'Mastery VI · this fragment adds nothing':`+${p.added} Fragment${p.added===1?'':'s'}`;
 const prog=p.added===0?'':p.isNew?' · Unlocked':owned?(p.to>p.from?` · Mastery ${ROMAN[p.to]} reached`:` · ${p.after}/${M.nextThreshold(h.id,p.after)??'max'}`):` · ${p.after}/${M.UNLOCK} to unlock`;
 const equip=p.isNew&&a.id!==h.id?`<button type="button" class="hero-button" data-reveal-equip="${h.id}">Equip</button>`:'';
 return `<div class="hero-toast${p.jackpot?' is-jackpot':''}" style="${vars(h)}" role="status" data-toast="${esc(p.receipt)}"><p><b>${esc(h.name)}</b> · ${h.rarity}</p><p>${got}${prog} · +${crestText(p.crests)}</p>${p.tier?`<p class="hero-toast-tier" style="${tierVars(p.tier)}">${p.tier.toUpperCase()} HEROES UNLOCKED</p>`:''}<div class="hero-toast-actions">${equip}<button type="button" class="hero-toast-close" data-toast-close="1" aria-label="Dismiss">×</button></div></div>`;}

// The Crest purchase for one hero: 1 fragment, or every fragment still missing to unlock it. Nothing is spent until Confirm.
function shop(h,f){const price=M.fragPrice(h.id),have=M.crests(),done=note&&note.id===h.id?`<p class="hero-shop-done" role="status">${esc(note.text)}</p>`:'';
 if(M.maxed(h.id,f))return done+`<p class="hero-shop-line">Mastery VI · more fragments add nothing.</p>`;
 if(confirm&&confirm.id===h.id){const cost=price*confirm.n,unlock=f<M.UNLOCK&&f+confirm.n>=M.UNLOCK;
  return done+`<p class="hero-shop-line">Spend <b>${crestText(cost)}</b> on ${fragText(confirm.n)} of ${esc(h.name)}?${unlock?' That unlocks it.':''} You have ${crestText(have)}, and ${n2(have-cost)} after.</p><div class="hero-preview-actions"><button type="button" class="hero-button" data-confirm-buy="${h.id}">Confirm</button><button type="button" class="hero-button hero-quiet" data-cancel-buy="1">Cancel</button></div>`;}
 const missing=f<M.UNLOCK?M.UNLOCK-f:0,btn=(n,label)=>{const cost=price*n;return `<button type="button" class="hero-button hero-quiet hero-buy" data-buy="${h.id}" data-count="${n}"${have<cost?' disabled':''}>${label} · ${n2(cost)} Crests</button>`;};
 return done+`<p class="hero-shop-line">Fragment: <b>${crestText(price)}</b> · you have ${crestText(have)}</p>${btn(1,'Buy 1 fragment')}${missing>1?btn(missing,`Buy ${missing} to unlock`):''}`;}
// A hero's detail, under the strip: everything the card leaves out.
function detail(h,s){const a=M.active(),base=weaponTap(s),on=a.id===h.id,f=M.fragments(h.id);
 // Not unlocked: name, rarity, fragment progress and the shop only. No tap number, effects or colours.
 if(f<M.UNLOCK){const gated=!M.tierOpen(h.rarity);
  const status=gated?`Locked · ${h.rarity} heroes unlock at Chest ${M.GATES[h.rarity]}. You've opened ${n2(M.opened())}.`:f?`${f}/${M.UNLOCK} fragments · ${M.UNLOCK-f} more to unlock, for free`:`Undiscovered · ${M.UNLOCK} fragments unlock it, for free`;
  return `<div class="hero-preview is-locked${f?' is-found':''}" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id,'hero-art',true)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}</span><p class="hero-preview-line">${status}</p></div></div>
${gated?'':bar(h.id,f)+shop(h,f)}<div class="hero-preview-actions is-single"><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div></div>`;}
 const tap=M.heroTap(h.id,f),r=M.rank(h.id,f),next=M.nextThreshold(h.id,f),nextFx=next?M.effects(h.id,next):[];
 return `<div class="hero-preview" data-preview="${h.id}" style="${vars(h)}" role="region" aria-label="${esc(h.name)}">
<div class="hero-preview-head"><div class="hero-portrait">${M.portrait(h.id)}</div><div><h4>${esc(h.name)}</h4><span class="hero-rarity">${h.rarity}${on?' · Equipped':''}</span><p class="hero-preview-mult">Tap ${mult(tap)}</p></div></div>
<p class="hero-preview-fx">${rows(h.id,f,true)}</p><p class="hero-fx-help">${esc(M.help(h.id))}</p>
<p class="hero-preview-line">Base ${mult(h.tap)}${r?` · Mastery ${ROMAN[r]}: tap +${Math.round(r*M.MASTERY_STEP*100)}%, signature +${Math.round(r*M.SIGNATURE_STEP*100)}%`:''}</p>
<p class="hero-preview-line">${esc(mastery(h.id,f))}</p>${bar(h.id,f)}
${next?`<p class="hero-preview-line hero-next">At Mastery ${ROMAN[r+1]}: Tap ${mult(M.heroTap(h.id,next))} · ${esc(nextFx.join(' · '))}</p>`:''}
<p class="hero-preview-line">${on?`Current tap ${num(tapOf(h.id,base))}`:`Current tap ${num(tapOf(a.id,base))} → <b>${num(tapOf(h.id,base))}</b>`}</p>
<div class="hero-preview-actions"><button type="button" class="hero-button" data-equip="${h.id}"${on?' disabled':''}>${on?'Equipped':'Equip'}</button><button type="button" class="hero-button hero-quiet" data-close="1">Close</button></div>
${shop(h,f)}</div>`;}

function build(){box.innerHTML=`<section class="heroes" aria-label="Heroes">
<p class="hero-warn" data-h="warn" role="status" hidden></p>
<div class="hero-top" data-h="top"></div>
<div class="hero-about" data-h="about" hidden></div>
<section class="hero-shelf" data-h="shelf" aria-label="Hero chests"></section>
<section class="hero-scene" data-h="scene" aria-label="Hero chest" hidden></section>
<div class="hero-toast-slot" data-h="toast"></div>
<div class="hero-strip" data-h="strip" role="list" aria-label="All heroes" tabindex="0">${M.ROSTER.map(slot).join('')}</div>
<div class="hero-detail-slot" data-h="detail"></div>
<div class="hero-fly" data-h="fly" aria-hidden="true"></div>
<button type="button" class="hero-skip" data-skip="1" hidden>Skip</button>
</section>`;
 const q=s=>box.querySelector(s),h=k=>q(`[data-h="${k}"]`);
 el={root:q('.heroes'),warn:h('warn'),top:h('top'),about:h('about'),shelf:h('shelf'),scene:h('scene'),toast:h('toast'),strip:h('strip'),detail:h('detail'),fly:h('fly'),skip:q('[data-skip]'),cards:{}};
 el.root.addEventListener('click',click);parts={};detailId='';view='main';msg='';}

function set(k,html){if(parts[k]!==html){parts[k]=html;el[k].innerHTML=html;}}
function paint(s){if(!el)return;const a=M.active(),chest=view==='chest',w=M.warning();
 el.warn.hidden=!w;el.warn.textContent=w;
 el.top.hidden=chest;set('top',top());
 el.about.hidden=chest||!aboutOpen;set('about',aboutOpen?about():'');
 el.shelf.hidden=chest;set('shelf',shelf());
 // The chest screen isn't redrawn while its animation runs.
 el.scene.hidden=!chest;if(!anim)set('scene',chest?scene():'');
 el.toast.hidden=chest;set('toast',toastHtml());
 el.strip.hidden=chest;for(const h of M.ROSTER){const html=card(h,a);if(el.cards[h.id]!==html){el.cards[h.id]=html;el.strip.querySelector(`[data-slot="${h.id}"]`).innerHTML=html;}}
 el.detail.hidden=chest;const d=M.byId(detailId);set('detail',d?detail(d,s):'');
 el.skip.hidden=!anim;el.root.classList?.toggle?.('is-playing',!!anim);}
function repaint(){paint(read?.());}
function tapChanged(){root.draw?.();}
// Switch between the main view and the chest screen, keeping the strip where it was (a hidden strip can lose its scroll).
function show(v){if(!el||v===view)return;if(v==='chest')stripLeft=el.strip.scrollLeft||0;view=v;repaint();if(v==='main'&&el.strip.scrollLeft!==undefined)el.strip.scrollLeft=stripLeft;}
const cardEl=id=>el?.strip?.querySelector?.(`[data-hero="${id}"]`);
// Bring a hero's card to the middle of the strip, and the strip into view.
function toCard(id,behavior){const s=el?.strip,c=cardEl(id);if(!s||!c)return;const slotEl=c.parentElement||c;
 const leftPx=(slotEl.offsetLeft||0)-((s.clientWidth||0)-(slotEl.offsetWidth||0))/2;
 if(typeof s.scrollTo==='function')s.scrollTo({left:Math.max(0,leftPx),behavior});else if(s.scrollLeft!==undefined)s.scrollLeft=Math.max(0,leftPx);
 s.scrollIntoView?.({block:'nearest',behavior});}
const sceneCls=(c,on)=>el?.scene?.classList?.toggle?.(c,on);
function after(ms,fn){if(!anim)return;const t=root.setTimeout(()=>{if(anim)fn();},ms);anim.timers.push(t);}
// Resizing or rotating mid-way lands the result at once, so the orb never flies to the wrong place.
function settleNow(){if(anim)land(anim.p);}
function listen(on){root[on?'addEventListener':'removeEventListener']?.('resize',settleNow);}
// Hiding the page mid-way stops the animation but keeps the result pending; coming back (or a reload) replays a short landing.
function onVisibility(){if(!el)return;if(root.document?.hidden){if(anim){stop();hold=null;show('main');repaint();}return;}
 const p=M.pending();if(p&&!anim&&landed!==p.receipt)play(p,true);}
// Stops whatever is moving. Nothing about the result changes here.
function stop(){if(!anim)return;for(const t of anim.timers)root.clearTimeout?.(t);try{anim.fly?.cancel?.();}catch{}anim=null;listen(false);if(el){el.fly.innerHTML='';for(const c of ['is-lid','is-orb','is-gone'])sceneCls(c,false);}}

// p: a result the model has already committed. short: a result from earlier (a reload, another tab): only a short landing.
function play(p,short_){if(anim||!el)return;const h=M.byId(p.id);if(!h)return;
 toast=null;landId='';landed='';hold={id:p.id,frags:p.before,crests:Math.max(0,M.crests()-(p.crests||0))};
 if(typeof root.setTimeout!=='function'||reduced()){land(p);return;}
 anim={p,timers:[],fly:null};listen(true);
 if(short_||view!=='chest'){show('main');repaint();after(60,()=>{toCard(p.id,'smooth');after(T.short,()=>land(p));});return;}
 repaint();const orb=el.scene.querySelector?.('.hero-orb');orb?.setAttribute?.('style',vars(h));
 sceneCls('is-lid',true);
 after(T.lid,()=>{sceneCls('is-orb',true);
  after(T.orb,()=>{sceneCls('is-gone',true);
   after(T.gone,()=>fly(p,orb));});});}
// The orb leaves the chest screen and flies, in an arc, to the centre of the hero's own card in the strip.
function fly(p,orb){const R=el.root.getBoundingClientRect?.(),o=orb?.getBoundingClientRect?.();
 show('main');for(const c of ['is-lid','is-orb','is-gone'])sceneCls(c,false);
 if(!R||!o){land(p);return;}
 const x0=o.left-R.left+o.width/2,y0=o.top-R.top+o.height/2;
 el.fly.innerHTML=`<span class="hero-orb is-flying" style="${vars(M.byId(p.id))};left:${x0}px;top:${y0}px"></span>`;
 toCard(p.id,'smooth');
 // Measure the card only once the strip has stopped moving (checked every 80ms, at most about a second).
 const settled=(fn,tries=0,last=NaN)=>{const x=el.strip.scrollLeft;if((x===last&&tries>1)||tries>=12)fn();else after(80,()=>settled(fn,tries+1,x));};
 after(T.scroll,()=>settled(()=>{const c=cardEl(p.id)?.querySelector?.('.hero-card-art')||cardEl(p.id),R2=el.root.getBoundingClientRect(),r=c?.getBoundingClientRect?.(),f=el.fly.querySelector('.hero-orb');
  if(!r||!f?.animate){land(p);return;}
  const dx=r.left-R2.left+r.width/2-x0,dy=r.top-R2.top+r.height/2-y0,base='translate(-50%,-50%) ';
  anim.fly=f.animate([{transform:base+'translate(0,0) scale(1)'},{transform:base+`translate(${dx*.4}px,${dy*.5-90}px) scale(1.15)`,offset:.45},{transform:base+`translate(${dx}px,${dy}px) scale(.6)`}],{duration:T.fly,easing:'cubic-bezier(.45,.05,.55,.95)',fill:'forwards'});
  anim.fly.onfinish=()=>land(p);after(T.fly+500,()=>land(p));}));}
// The orb arrives (or Skip): the card shows its new count with a short sparkle, and the result is marked seen.
function land(p){if(landed===p.receipt)return;landed=p.receipt;const skipped=!!anim;stop();show('main');hold=null;
 M.acknowledge(p.receipt);toast=p;landId=p.id;repaint();toCard(p.id,skipped&&!reduced()?'smooth':'auto');
 root.LoreUI?.feedback?.('upgrade');tapChanged();
 if(landTimer!==null)root.clearTimeout?.(landTimer);landTimer=typeof root.setTimeout==='function'?root.setTimeout(()=>{landTimer=null;landId='';repaint();},T.land):null;
 if(landTimer===null)landId='';}

const WHY_OPEN={clock:'Connect to check the chest timer.',save:'This device would not save it, so no chest was used.'};
function doOpen(){if(anim)return;const c=M.clock(),r=M.open({now:c.now,trusted:c.trusted});
 if(!r.ok){msg=r.reason==='empty'?`No chest ready. Next one in ${left((r.nextAt||0)-(c.now||0))}.`:WHY_OPEN[r.reason]||'No chest was opened.';
  if(r.reason==='clock')Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);parts.scene=null;repaint();return;}
 msg='';play(r.result,!!r.replay);}
// One confirmed purchase, at the count, price and collection the player saw. A repeat tap finds the collection changed and does nothing.
const WHY={funds:'Not enough Hero Crests.',stale:'Your heroes changed (another tab or a chest). Check the price and try again.',max:'This hero is already at Mastery VI.',count:'That is more fragments than this hero can use.',save:'This device would not save it, so nothing was spent.',price:'The price changed. Check it and try again.',locked:'This rarity is still locked.'};
// seen/seenPrice: the collection and the total price the player was shown when they tapped Buy.
let seen=0,seenPrice=0;
function ask(id,n){confirm={id,n};seen=M.seq();seenPrice=M.fragPrice(id)*n;note=null;}
function buyNow(id,n){const h=M.byId(id);if(!h)return;const r=M.buy({id,count:n,price:seenPrice,seq:seen});
 if(r.ok){const b=r.result;note={id,text:`Bought ${fragText(b.count)}.`+(b.isNew?` ${h.name} is unlocked. Equip it when you like.`:b.after<M.UNLOCK?` ${b.after}/${M.UNLOCK} to unlock.`:b.to>b.from?` Mastery ${ROMAN[b.to]} reached.`:` ${mastery(id,b.after)}.`)};root.LoreUI?.feedback?.('upgrade');}
 else note={id,text:WHY[r.reason]||'Nothing was bought.'};
 repaint();tapChanged();}
const focus=sel=>el?.root?.querySelector?.(sel)?.focus?.({preventScroll:true});
function click(e){const t=e.target.closest?.('button');if(!t||t.disabled||!el)return;const d=t.dataset;
 if(d.skip){settleNow();return;}
 if(anim)return;
 if(d.chest!==undefined){msg='';show('chest');parts.scene=null;repaint();el.scene.scrollIntoView?.({block:'nearest'});focus('[data-open]');return;}
 if(d.back){msg='';show('main');focus('[data-chest="0"]');return;}
 if(d.open){doOpen();return;}
 if(d.about){aboutOpen=!aboutOpen;repaint();return;}
 if(d.toastClose){toast=null;repaint();return;}
 if(d.revealEquip){if(M.select(d.revealEquip)){root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();}return;}
 if(d.buy){ask(d.buy,Number(d.count)||1);repaint();focus(`[data-preview="${d.buy}"] [data-confirm-buy]`);return;}
 if(d.cancelBuy){confirm=null;repaint();return;}
 if(d.confirmBuy){const id=d.confirmBuy;if(!confirm||confirm.id!==id)return;const n=confirm.n;confirm=null;buyNow(id,n);return;}
 if(d.hero){detailId=detailId===d.hero?'':d.hero;confirm=null;note=null;repaint();if(detailId)el.detail.scrollIntoView?.({block:'nearest',behavior:reduced()?'auto':'smooth'});return;}
 if(d.close){const id=detailId;detailId='';confirm=null;note=null;repaint();focus(`[data-hero="${id}"]`);return;}
 if(d.equip){if(M.select(d.equip)){root.LoreUI?.feedback?.('upgrade');repaint();tapChanged();focus(`[data-preview="${d.equip}"] [data-close]`);}else repaint();}}
// Another tab opened a chest, bought or equipped a hero.
function onStorage(e){if(e?.key===M.KEY||e?.key===null){M.reload();repaint();tapChanged();}}

// target: the destination box; get: reads the current LOREBOUND state; format: the game's number format.
function mount(target,get,format){if(!enabled()||!target)return false;read=get;fmt=format;if(box!==target||!el?.root?.isConnected){leave();box=target;build();
  if(!M.clock().trusted&&!M.unlimited?.())Promise.resolve(root.LoreClock?.verify?.()).then(repaint,repaint);
  timer=root.setInterval?.(()=>paint(read?.()),20000)??null;root.addEventListener?.('storage',onStorage);root.document?.addEventListener?.('visibilitychange',onVisibility);}
 paint(read?.());
 // A chest opened before a reload, or while the tab was away, lands now from its stored receipt.
 const p=M.pending();if(p&&!anim&&landed!==p.receipt)play(p,true);
 return true;}
function leave(){stop();if(el?.root)el.root.removeEventListener('click',click);if(timer!==null)root.clearInterval?.(timer);timer=null;if(landTimer!==null)root.clearTimeout?.(landTimer);landTimer=null;
 root.removeEventListener?.('storage',onStorage);root.document?.removeEventListener?.('visibilitychange',onVisibility);box=null;el=null;detailId='';confirm=null;note=null;view='main';msg='';toast=null;landId='';landed='';hold=null;parts={};}
root.LoreHeroesUI={enabled,mount,leave};
})(globalThis);
