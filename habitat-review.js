/* Review page only: draws each habitat behind a companion at phone sizes. home.html never loads it. */
(function(){'use strict';
const sizes=[[320,610],[375,812],[390,844],[430,932]];
const groups=[
 {title:'Mortals: Ruined Fortress v03 or Forgotten Courtyard v02',a:['habitat-ruined-fortress','Ruined Fortress v03','In the test game'],b:['habitat-forgotten-courtyard','Forgotten Courtyard v02','Comparison only'],ids:['lost-squire','hollow-knight']},
 {title:'Beasts: Volcanic stays; Wildstone Grotto for comparison',a:['habitat-volcanic','Volcanic','In the game, unchanged'],b:['habitat-wildstone-grotto','Wildstone Grotto','Comparison only'],ids:['cinderclack','moonveil-stag','gloom-bat']},
 {title:'Spirits: Veiled Sanctuary',a:['habitat-veiled-sanctuary','Veiled Sanctuary','In the test game'],ids:['lantern-wisp','dusk-revenant']},
 {title:'Aberrations: Fractured Observatory',a:['habitat-fractured-observatory','Fractured Observatory','In the test game'],ids:['crooked-eye','hollow-maw']}];
const C=globalThis.LoreRealm.C,P=globalThis.LoreCompanionProfile,D=globalThis.LoreCompanionPhase1Data?.species||{};
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=h=>D[h.id]?.variants?.['768']?.src||globalThis.LoreArt?.art(h)?.src||'';
let size=sizes[2];
function phone(h,bg,compare){const [w,ht]=size,m=P.measure(h.id),artH=Math.max(150,Math.min(280,ht*.3));
 return `<div class="phone" style="width:${w}px;height:${ht}px;--habitat:url('assets/${bg}.png')">${compare?'<span class="tag">Comparison only</span>':''}<span class="rarity">${esc(h.rarity)}</span><h3>${esc(h.name)}</h3><div class="art" style="height:${artH}px">${art(h)?`<img src="${esc(art(h))}" alt="${esc(h.name)}">`:''}</div><p class="measures">${m?esc(m.sizeLabel+' '+m.size+' · Weight '+m.weight):''}</p><div class="plaque"><dl><dt>Category</dt><dt>Rarity</dt><dd>${esc(h.category)}</dd><dd>${esc(h.rarity)}</dd></dl></div><div class="button">Return</div></div>`;}
function slot(h,[bg,name,note],compare,k){const [w,ht]=size;return `<div class="slot"><div class="label${compare?' compare':''}"><b>${esc(name)}</b>${esc(note)}</div><div class="scaler" style="width:${Math.floor(w*k)}px;height:${Math.floor(ht*k)}px"><div style="transform:scale(${k});transform-origin:0 0">${phone(h,bg,compare)}</div></div></div>`;}
function draw(){const room=Math.min(920,document.documentElement.clientWidth-24),k2=Math.min(1,(room-10)/2/size[0]),k1=Math.min(1,room/size[0]);
 document.getElementById('pairs').innerHTML=groups.map(g=>`<section><h2>${esc(g.title)}</h2>${g.ids.map(id=>{const h=C.companions.find(c=>c.id===id);if(!h)return '';return `<div class="pair">${g.b?slot(h,g.a,false,k2)+slot(h,g.b,true,k2):slot(h,g.a,false,Math.min(k1,.8))}</div>`;}).join('')}</section>`).join('');
 document.querySelectorAll('.sizes button').forEach((b,i)=>b.setAttribute('aria-pressed',String(sizes[i]===size)));}
document.querySelector('.sizes').innerHTML=sizes.map(([w,h])=>`<button type="button">${w}×${h}</button>`).join('');
document.querySelectorAll('.sizes button').forEach((b,i)=>b.onclick=()=>{size=sizes[i];draw();});
addEventListener('resize',draw);draw();
})();
