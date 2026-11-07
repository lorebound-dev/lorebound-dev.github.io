/* Heroes (fourth tab, DEV preview). 25 fixed placeholder heroes, 2–3 per companion rarity, and the one active hero.
   Heroes are found in free openings: 3 charges, each back 24 trusted hours after it was used. A repeat adds a copy,
   and copies raise that hero's mastery (six ranks, +8% of its tap multiplier each).
   Only the active hero's tap multiplier is real: Lore.tapPower multiplies the weapon's tap damage by it once.
   Runs only on the test site and local copies, like Ascension before it. On the real game the multiplier is always 1.
   The collection lives under its own localStorage key and never touches the LOREBOUND save, so it is NOT shippable as a
   daily-limited reward until Noah approves moving it into the save. The old v01 preview key is read by nothing and kept.
   Portraits are drawn from squares in code. */
(function(root){'use strict';
const KEY='lorebound-heroes-dev-v02',LEGACY_KEY='lorebound-heroes-preview-v01',DEFAULT='rowan-thatch',HOSTS=['lorebound-dev.github.io','localhost','127.0.0.1',''];
// Provisional DEV test values from Joshua's request #150 (not approved for the real game).
const CHARGES=3,RECHARGE_MS=24*60*60*1000,MASTERY_STEP=0.08;
const ODDS={Common:25,Uncommon:21,Rare:17,Epic:13,Legendary:9,Mythic:6,Ancient:4,Exalted:2.5,Transcendent:1.5,Eternal:1};
// Lifetime copies (the first find is copy 1) needed for mastery I–VI.
const LATE=[2,3,4,5,6,8];
const THRESHOLDS={Common:[2,4,7,11,16,24],Uncommon:[2,4,7,10,14,20],Rare:[2,3,5,8,12,18],Epic:[2,3,5,7,10,14],Legendary:[2,3,4,6,8,11],Mythic:LATE,Ancient:LATE,Exalted:LATE,Transcendent:LATE,Eternal:LATE};
const RARITIES=['Common','Uncommon','Rare','Epic','Legendary','Mythic','Ancient','Exalted','Transcendent','Eternal'];
// The same ink/light/dark as the companion rarity classes in adventure.css (.rarity-common …).
const RARITY_COLORS={Common:['#b7bbc0','#e1e2df','#666d75'],Uncommon:['#6fa783','#c1dfbb','#315c46'],Rare:['#6f9dc5','#c8e0f2','#324e78'],Epic:['#ac83c3','#e6c8f1','#61437e'],Legendary:['#c49c52','#fae3a3','#805328'],Mythic:['#c36f76','#f5b6ad','#7a343e'],Ancient:['#ab8873','#ead5b1','#635242'],Exalted:['#b7b6a4','#fff9d9','#8a8268'],Transcendent:['#71afb5','#c3f3e8','#3f6b81'],Eternal:['#b49abc','#fde1ef','#5e4f83']};
// Concepts only: shown as "not active yet" until Joshua decides how bonuses work.
const TRAITS={fortune:['Fortune','A little more Gold from each defeat'],focus:['Battle focus','Quick taps build a short damage streak'],breaker:['Guard breaker','Extra tap damage against bosses'],precision:['Precision','Taps can land critical hits'],rally:['Rally','Companions strike harder while you tap']};
const SKIN=['#f1c9a5','#d9a27c','#b57a55','#8a5a3c'],HAIR=['#5a3a22','#2a1d1a','#c9a560','#a8452e','#e8e1d4','#3b4a6b'];
// [id, name, rarity, tap multiplier, headgear, weapon, cloak, armor colour, skin, hair, trait]. Provisional DEV values from the request.
const ROSTER=[
 ['rowan-thatch','Rowan Thatch','Common',1.00,'hair','sword',0,'#7b5a3a',0,0,'focus'],
 ['elia-flint','Elia Flint','Common',1.02,'long','bow',0,'#5f7048',1,3,'precision'],
 ['garrick-moss','Garrick Moss','Common',1.04,'hair','shield',0,'#6b6e5a',2,1,'breaker'],
 ['venn-copperleaf','Venn Copperleaf','Uncommon',1.06,'bandana','daggers',0,'#9a6a3a',0,3,'fortune'],
 ['mara-duskstep','Mara Duskstep','Uncommon',1.08,'hood','daggers',1,'#3f4a52',1,1,'precision'],
 ['torren-pike','Torren Pike','Uncommon',1.10,'helm','spear',0,'#55704f',3,0,'breaker'],
 ['sylas-embermark','Sylas Embermark','Rare',1.13,'wizard','staff',0,'#8a3b2f',0,4,'focus'],
 ['kira-dawnbrook','Kira Dawnbrook','Rare',1.15,'long','bow',1,'#4e7a8a',2,2,'fortune'],
 ['corin-shadefall','Corin Shadefall','Rare',1.17,'hood','sword',1,'#2f3a4a',1,1,'precision'],
 ['ashara-moonblade','Ashara Moonblade','Epic',1.20,'long','sword',1,'#4d4a7a',3,4,'focus'],
 ['lucan-blackthorn','Lucan Blackthorn','Epic',1.23,'helm','shield',0,'#3a3540',0,1,'breaker'],
 ['riven-stormglass','Riven Stormglass','Epic',1.26,'wizard','staff',1,'#3a5f8a',1,5,'rally'],
 ['evelith-dawnstar','Evelith Dawnstar','Legendary',1.30,'circlet','staff',1,'#e8dcc0',0,2,'rally'],
 ['magnus-ironsong','Magnus Ironsong','Legendary',1.34,'helm','spear',1,'#6a6f78',2,3,'breaker'],
 ['lysandra-nightfall','Lysandra Nightfall','Legendary',1.38,'hood','bow',1,'#2a2440',3,1,'precision'],
 ['orwyn-sunforge','Orwyn Sunforge','Mythic',1.45,'helm','shield',1,'#9a4a2a',1,3,'fortune'],
 ['seraphine-hollowlight','Seraphine Hollowlight','Mythic',1.50,'circlet','staff',1,'#f0e6d8',0,4,'rally'],
 ['talmir-runeweaver','Talmir Runeweaver','Ancient',1.58,'wizard','staff',1,'#4a5a3a',2,4,'focus'],
 ['ellara-firstbloom','Ellara Firstbloom','Ancient',1.64,'circlet','bow',0,'#5a8a4a',1,2,'fortune'],
 ['aurek-starwarden','Aurek Starwarden','Exalted',1.72,'helm','spear',1,'#d8d0b0',3,5,'breaker'],
 ['liora-dawnbringer','Liora Dawnbringer','Exalted',1.80,'circlet','sword',1,'#f2e2b8',0,2,'rally'],
 ['velis-astralborn','Velis Astralborn','Transcendent',1.90,'hood','staff',1,'#2a4a5a',2,5,'precision'],
 ['nymeris-skybound','Nymeris Skybound','Transcendent',2.00,'circlet','spear',1,'#8ac0c8',1,4,'focus'],
 ['aethren-endless','Aethren Endless','Eternal',2.15,'crown','sword',1,'#5a4a7a',0,4,'rally'],
 ['selka-everflame','Selka Everflame','Eternal',2.30,'wizard','staff',1,'#a03a3a',3,3,'fortune']
].map(([id,name,rarity,tap,head,weapon,cloak,armor,skin,hair,trait],index)=>Object.freeze({id,name,rarity,rank:RARITIES.indexOf(rarity),index,tap,head,weapon,cloak:!!cloak,armor,skin:SKIN[skin],hair:HAIR[hair],trait:TRAITS[trait][0],traitText:TRAITS[trait][1]}));
const BY_ID=Object.assign(Object.create(null),Object.fromEntries(ROSTER.map(h=>[h.id,h])));

// 16×18 pixel layers. '.' is see-through. o outline, s skin, e eyes, h hair, a armour, b trim, p legs, k boots, w metal, d wood, c cloak, g gem.
const W=16,H=18,blank=()=>Array(H).fill('.'.repeat(W));
const layer=rows=>{const g=blank();for(const [r,line] of Object.entries(rows))g[r]=line;return g;};
const BODY=layer({3:'.....oooooo.....',4:'....osssssso....',5:'....osesseso....',6:'....osssssso....',7:'.....oossoo.....',8:'...ooaaaaaaoo...',9:'..oaaaabbaaaao..',10:'..oaoaaaaaaoao..',11:'..oaoaabbaaoao..',12:'..osobbbbbboso..',13:'....oaaaaaao....',14:'....oppooppo....',15:'....oppooppo....',16:'...okkkookkko...',17:'...oooo..oooo...'});
const CLOAK=layer({8:'...cccccccccc...',9:'..occcccccccco..',10:'.occcccccccccco.',11:'.occcccccccccco.',12:'.occcccccccccco.',13:'.occcccccccccco.',14:'.occcccccccccco.',15:'.occcccccccccco.',16:'.occcccccccccco.',17:'.oooooooooooooo.'});
const HAIR_SHORT={2:'.....oooooo.....',3:'....ohhhhhho....',4:'.....h....h.....'},HAIR_LONG={...HAIR_SHORT,5:'.....h....h.....',6:'.....h....h.....',7:'....ohh..hho....'};
const HEAD={
 hair:[HAIR_SHORT],
 long:[HAIR_LONG],
 bandana:[HAIR_SHORT,{3:'....obbbbbbo....',4:'.....h....hbb...'}],
 helm:[{0:'.......bb.......',1:'......obbo......',2:'.....owwwwo.....',3:'....owwwwwwo....',4:'....ow....wo....',5:'....ow....wo....',6:'.....w....w.....'}],
 hood:[{1:'......oooo......',2:'.....occcco.....',3:'....occcccco....',4:'....oc....co....',5:'....oc....co....',6:'....oc....co....',7:'....occ..cco....'}],
 wizard:[HAIR_SHORT,{0:'........oo......',1:'.......occo.....',2:'......occcco....',3:'..oggggggggggo..'}],
 circlet:[HAIR_LONG,{3:'....owgwwgwo....'}],
 crown:[HAIR_LONG,{1:'.....w.ww.w.....',2:'.....wwggww.....',3:'....owwwwwwo....'}]};
const shaft=(from,to,col,rows={})=>{for(let r=from;r<=to;r++)rows[r]=rows[r]||'.'.repeat(col)+'d'+'.'.repeat(W-col-1);return rows;};
const WEAPON={
 sword:{3:'..............o.',4:'.............owo',5:'.............owo',6:'.............owo',7:'.............owo',8:'.............owo',9:'.............owo',10:'.............owo',11:'.............bbb',12:'.............dd.',13:'..............o.'},
 spear:shaft(3,16,13,{0:'.............w..',1:'............owo.',2:'............owo.'}),
 staff:shaft(4,16,13,{0:'............oo..',1:'...........oggo.',2:'...........oggo.',3:'............oo..'}),
 bow:{6:'..d.............',7:'.dw.............',8:'.dw.............',9:'.dw.............',10:'.dw.............',11:'.dw.............',12:'.dw.............',13:'.dw.............',14:'.dw.............',15:'..d.............'},
 shield:{9:'.oooo...........',10:'obbbbo..........',11:'owggwo..........',12:'owggwo..........',13:'obwwbo..........',14:'.obbo...........',15:'..oo............'},
 daggers:{8:'.............o..',9:'.w...........w..',10:'.w...........w..',11:'.w...........w..',12:'..d..........d..'}};
function shade(hex,f){const n=parseInt(hex.slice(1),16),c=[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(f<0?v*(1+f):v+(255-v)*f))));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');}
function grid(h){const g=(h.cloak?CLOAK:blank()).map(r=>r.split(''));const put=rows=>{for(const [r,line] of Object.entries(rows))for(let x=0;x<W;x++)if(line[x]!=='.')g[r][x]=line[x];};
 put(Object.fromEntries(BODY.map((l,i)=>[i,l])));for(const part of HEAD[h.head])put(part);put(WEAPON[h.weapon]);return g.map(r=>r.join(''));}
function palette(h){const [ink,light,dark]=RARITY_COLORS[h.rarity];return {o:'#1b1420',e:'#1b1420',s:h.skin,h:h.hair,a:h.armor,b:ink,p:shade(h.armor,-0.45),k:'#3a2a22',w:h.rank>=6?'#e2c180':'#c9d2d8',d:'#6b4528',c:dark,g:light};}
// One rect per horizontal run of one colour; crisp squares at any size.
// Undiscovered heroes: the same figure in charcoal, outline kept darker so the shape still reads.
const SHADOW={o:'#0b0d10',fill:'#3a3f47'};
function portrait(id,cls='hero-art',shadow=false){const h=BY_ID[id]||BY_ID[DEFAULT],g=grid(h),pal=shadow?new Proxy({},{get:(_,ch)=>ch==='o'?SHADOW.o:SHADOW.fill}):palette(h);let rects='';
 g.forEach((row,y)=>{for(let x=0;x<W;){const ch=row[x];let n=1;while(x+n<W&&row[x+n]===ch)n++;if(ch!=='.')rects+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${pal[ch]}"/>`;x+=n;}});
 return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;}

// The Heroes tab's placeholder helm, drawn from squares like the portraits. home.html carries the same drawing inline.
const HELM=['.....bb.....','....obbo....','...owwwvo...','..olwwwwvo..','.olwwwwwwvo.','.owoooooovo.','.olwwoowwvo.','.owwwoowwvo.','.owwoooowvo.','..oo....oo..'],HELM_PAL={o:'#2a1a10',w:'#e2c180',v:'#9b6d2f',l:'#fae3a3',b:'#a8452e'};
function navIcon(cls='nav-art'){let rects='';HELM.forEach((row,y)=>{for(let x=0;x<row.length;){const ch=row[x];let n=1;while(x+n<row.length&&row[x+n]===ch)n++;if(ch!=='.')rects+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${HELM_PAL[ch]}"/>`;x+=n;}});
 return `<svg class="${cls}" viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;}
function enabled(){try{return HOSTS.includes(String(root.location?.hostname??'-'));}catch{return false;}}
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const own=id=>typeof id==='string'&&has(BY_ID,id);
const count=n=>Number.isInteger(n)&&n>=1&&n<=100000;
// Mastery rank 0–6 from lifetime copies, and the hero's tap multiplier with it.
function rank(id,copies){const h=BY_ID[id];if(!h||!(copies>0))return 0;return THRESHOLDS[h.rarity].filter(n=>copies>=n).length;}
function heroTap(id,copies){const h=BY_ID[id];return h?h.tap*(1+MASTERY_STEP*rank(id,copies)):1;}
function nextThreshold(id,copies){const h=BY_ID[id];return h?THRESHOLDS[h.rarity].find(n=>copies<n)??null:null;}
// One opening: a rarity from ODDS, then an even pick among that rarity's heroes. rng() returns [0,1).
function draw(rng){let x=rng()*100,rarity=RARITIES[RARITIES.length-1];for(const r of RARITIES){x-=ODDS[r];if(x<0){rarity=r;break;}}
 const list=ROSTER.filter(h=>h.rarity===rarity);return list[Math.min(list.length-1,Math.floor(rng()*list.length))];}

// The collection record. spent: when each used charge comes back (trusted ms). high: latest trusted time seen.
// pending: the committed result of the last opening until the player has seen it, so a reload replays it and never re-rolls.
const fresh=()=>({v:2,owned:{[DEFAULT]:1},active:DEFAULT,spent:[],high:0,seq:0,receipt:'',pending:null});
function clean(v){if(!v||typeof v!=='object'||v.v!==2||!v.owned||typeof v.owned!=='object'||Array.isArray(v.owned))return null;
 const owned={};for(const [id,n] of Object.entries(v.owned))if(own(id)&&count(n))owned[id]=n;if(!owned[DEFAULT])owned[DEFAULT]=1;
 const high=Number.isFinite(v.high)&&v.high>=0?v.high:0;
 // A return time more than 24h past the latest trusted time is a future jump: it can only come back 24h from then.
 const spent=(Array.isArray(v.spent)?v.spent:[]).filter(Number.isFinite).map(t=>Math.min(t,high+RECHARGE_MS)).sort((a,b)=>a-b).slice(-CHARGES);
 const p=v.pending;const pending=p&&typeof p==='object'&&typeof p.receipt==='string'&&p.receipt&&own(p.id)&&owned[p.id]&&count(p.copies)?{receipt:p.receipt,id:p.id,isNew:!!p.isNew,copies:p.copies,before:rank(p.id,p.copies-1),after:rank(p.id,p.copies)}:null;
 return {v:2,owned,active:own(v.active)&&owned[v.active]?v.active:DEFAULT,spent,high,seq:Number.isInteger(v.seq)&&v.seq>=0?v.seq:0,receipt:typeof v.receipt==='string'?v.receipt:'',pending};}
let state=null,warn='';
function storage(){try{return root.localStorage||null;}catch{return null;}}
// Always re-read before a change, so another tab's opening is seen first.
function load(){const ls=storage();let rec=null;try{const raw=ls?.getItem(KEY);if(raw===null||raw===undefined)rec=fresh();else{rec=clean(JSON.parse(raw));if(!rec){rec=fresh();warn='Your hero collection could not be read on this device, so it started again with Rowan Thatch.';}}}catch{rec=state||fresh();}
 state=rec;return rec;}
function current(){return state||load();}
// Write, then read back. If the device won't keep it, nothing changes.
function commit(next){const ls=storage(),text=JSON.stringify(next);try{if(!ls)throw Error('no storage');ls.setItem(KEY,text);if(ls.getItem(KEY)!==text)throw Error('not kept');}catch{warn='This device would not save your heroes, so nothing was changed. Try again.';return false;}state=next;warn='';return true;}
function enabled(){try{return HOSTS.includes(String(root.location?.hostname??'-'));}catch{return false;}}
// The game's trusted clock (origin HTTP Date + monotonic time). Never the device clock on its own.
function clock(){const C=root.LoreClock;const trusted=!!C?.trusted?.();return {trusted,now:trusted?C.now(0):null};}
function charges(now,rec=current()){const t=Math.max(Number(now)||0,rec.high),out=rec.spent.filter(x=>x>t);return {available:CHARGES-out.length,max:CHARGES,nextAt:out.length?out[0]:null};}
function makeReceipt(t,seq){let r='';try{const a=new Uint32Array(2);root.crypto.getRandomValues(a);r=a[0].toString(36)+a[1].toString(36);}catch{r=Math.floor(Math.random()*2**32).toString(36);}return `h${Math.floor(t).toString(36)}-${seq}-${r}`;}
// The only way to get a hero. Checks the charge, draws, and stores hero, copies, charge and receipt in one write.
function open({now,trusted,rng=Math.random}={}){if(!enabled())return {ok:false,reason:'off'};const rec=load();
 if(rec.pending)return {ok:true,replay:true,result:rec.pending};
 if(!trusted||!Number.isFinite(now))return {ok:false,reason:'clock'};
 const t=Math.max(now,rec.high),c=charges(t,rec);if(c.available<=0)return {ok:false,reason:'empty',nextAt:c.nextAt};
 const h=draw(rng),had=rec.owned[h.id]||0,copies=had+1,seq=rec.seq+1,receipt=makeReceipt(t,seq);
 const pending={receipt,id:h.id,isNew:!had,copies,before:rank(h.id,had),after:rank(h.id,copies)};
 const next={...rec,owned:{...rec.owned,[h.id]:copies},spent:[...rec.spent.filter(x=>x>t),t+RECHARGE_MS],high:t,seq,receipt,pending};
 if(!commit(next))return {ok:false,reason:'save'};return {ok:true,result:pending};}
// The player has seen the result. Only clears the matching receipt.
function acknowledge(receipt){if(!enabled())return false;const rec=load();if(!rec.pending||rec.pending.receipt!==receipt)return false;return commit({...rec,pending:null});}
function select(id){if(!enabled()||!own(id))return false;const rec=load();if(!rec.owned[id])return false;if(rec.active===id)return true;return commit({...rec,active:id});}
function activeHero(){return BY_ID[enabled()?current().active:DEFAULT];}
function copiesOf(id){return enabled()?current().owned[id]||0:(id===DEFAULT?1:0);}
// The only real effect: 1 on the real game, the active hero's multiplier (with mastery) on the test site.
function tapMultiplier(){if(!enabled())return 1;const rec=current();return heroTap(rec.active,rec.owned[rec.active]);}
// Another tab changed the collection: drop the cached copy.
try{root.addEventListener?.('storage',e=>{if(e?.key===KEY||e?.key===null)state=null;});}catch{}
root.LoreHeroes={KEY,LEGACY_KEY,DEFAULT,RARITIES,RARITY_COLORS,ROSTER,ODDS,THRESHOLDS,CHARGES,RECHARGE_MS,MASTERY_STEP,byId:id=>own(id)?BY_ID[id]:null,
 enabled,clock,active:activeHero,copies:copiesOf,owned:id=>copiesOf(id)>0,rank,heroTap,nextThreshold,draw,charges:now=>charges(now),pending:()=>enabled()?current().pending:null,
 open,acknowledge,select,tapMultiplier,portrait,grid,navIcon,warning:()=>warn,reload:()=>{state=null;return load();},_reset(){state=null;warn='';}};
})(globalThis);
