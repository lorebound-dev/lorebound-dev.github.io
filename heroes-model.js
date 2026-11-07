/* Heroes (fourth tab, DEV preview). 25 fixed placeholder heroes, 2–3 per companion rarity, and the one active hero.
   Heroes are found in free openings: 3 charges, each back 24 trusted hours after it was used. A repeat adds a copy,
   and copies raise that hero's mastery (six ranks, +8% of its tap multiplier and +5% of its signature each).
   Every opening also pays Hero Crests by the drawn rarity; Crests buy one copy of a chosen hero (purchases never pay Crests).
   Since #152 an opening that draws a hero you haven't recruited only finds it: the hero stays a shadow with its copies held,
   and recruiting it costs a lower, one-time Crest price (RECRUIT_PRICE). Recruiting moves every held copy into its mastery.
   Only the equipped hero counts, and each part is applied once, in one place:
   - tap: Lore.tapPower = weapon tap × hero tap multiplier + the hero's flat tap (tap());
   - companions: LoreRealm.combat adds the hero's all-DPS % plus the matching-type % to each hit, and a flat expected DPS
     per matching companion (companion()); Party DPS, real hits, boss readiness and offline all read combat;
   - Gold: each paid Quest reward (regular kill, checkpoint farming, first boss clear, Endless) goes through gold() once.
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
// Hero Crests per opening by the drawn hero's rarity, and the price of one copy of a chosen hero (#151, DEV trial values).
const CREST_REWARD={Common:5,Uncommon:6,Rare:7,Epic:8,Legendary:10,Mythic:13,Ancient:17,Exalted:22,Transcendent:30,Eternal:45};
const CREST_PRICE={Common:80,Uncommon:140,Rare:230,Epic:360,Legendary:550,Mythic:850,Ancient:1200,Exalted:1750,Transcendent:2500,Eternal:3600};
// One-time price to recruit a hero an opening has found (#152, DEV trial values, about a quarter of CREST_PRICE).
const RECRUIT_PRICE={Common:20,Uncommon:35,Rare:60,Epic:90,Legendary:140,Mythic:215,Ancient:300,Exalted:440,Transcendent:625,Eternal:900};
// Each signature grows by 5% of its listed value per mastery rank (linear, ×1.30 at VI).
const SIGNATURE_STEP=0.05;
const TYPES=['Mortals','Beasts','Spirits','Constructs','Wildgrowth','Aberrations'];
// Signatures from #151 (DEV trial values). tap: flat tap. gold: Quest Gold %. goldFlat: Gold per paid reward. all: all companion DPS %.
// type: [type, DPS %] for equipped companions of that type. typeFlat: [type, expected DPS] added to each equipped companion of that type.
const SIG={
 'rowan-thatch':{goldFlat:2},'elia-flint':{typeFlat:['Beasts',3]},'garrick-moss':{tap:3},
 'venn-copperleaf':{gold:.06},'mara-duskstep':{type:['Mortals',.08]},'torren-pike':{tap:6},
 'sylas-embermark':{type:['Spirits',.12]},'kira-dawnbrook':{gold:.10,tap:3},'corin-shadefall':{type:['Aberrations',.15]},
 'ashara-moonblade':{type:['Mortals',.18],tap:5},'lucan-blackthorn':{type:['Constructs',.22]},'riven-stormglass':{type:['Wildgrowth',.18],gold:.07},
 'evelith-dawnstar':{type:['Spirits',.24],gold:.08},'magnus-ironsong':{type:['Constructs',.27],tap:8},'lysandra-nightfall':{type:['Beasts',.25],gold:.10},
 'orwyn-sunforge':{all:.07,gold:.15},'seraphine-hollowlight':{all:.12},
 'talmir-runeweaver':{all:.12,type:['Aberrations',.20]},'ellara-firstbloom':{all:.14,type:['Wildgrowth',.22]},
 'aurek-starwarden':{all:.16,type:['Mortals',.24]},'liora-dawnbringer':{all:.18,gold:.15},
 'velis-astralborn':{all:.20,type:['Spirits',.27]},'nymeris-skybound':{all:.22,gold:.18},
 'aethren-endless':{all:.25,type:['Beasts',.30]},'selka-everflame':{all:.23,gold:.25}};
const SKIN=['#f1c9a5','#d9a27c','#b57a55','#8a5a3c'],HAIR=['#5a3a22','#2a1d1a','#c9a560','#a8452e','#e8e1d4','#3b4a6b'];
// [id, name, rarity, tap multiplier, headgear, weapon, cloak, armor colour, skin, hair, retired concept label (unused)]. Provisional DEV values from the request.
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
].map(([id,name,rarity,tap,head,weapon,cloak,armor,skin,hair,trait],index)=>Object.freeze({id,name,rarity,rank:RARITIES.indexOf(rarity),index,tap,head,weapon,cloak:!!cloak,armor,skin:SKIN[skin],hair:HAIR[hair],signature:Object.freeze({...SIG[id]})}));
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
// The hero's signature at its mastery rank: every listed value × (1 + 5% × rank). Nothing is rounded here.
function signature(id,copies){const h=BY_ID[id];if(!h)return null;const k=1+SIGNATURE_STEP*rank(id,copies),g=h.signature;
 return {tap:(g.tap||0)*k,gold:(g.gold||0)*k,goldFlat:(g.goldFlat||0)*k,all:(g.all||0)*k,type:g.type?[g.type[0],g.type[1]*k]:null,typeFlat:g.typeFlat?[g.typeFlat[0],g.typeFlat[1]*k]:null};}
// Short effect rows (never more than two), e.g. "+25% All DPS", "+30% Beasts". long: the preview's wording. One decimal at most.
const pct=n=>'+'+Math.round(n*1000)/10+'%',flat=n=>'+'+Math.round(n*10)/10;
function effects(id,copies,long=false){const x=signature(id,copies);if(!x)return [];const out=[];
 if(x.all)out.push(pct(x.all)+' All DPS');
 if(x.type)out.push(pct(x.type[1])+' '+x.type[0]+(long?' DPS':''));
 if(x.typeFlat)out.push(flat(x.typeFlat[1])+' DPS per '+x.typeFlat[0].replace(/s$/,'')+(long?' companion':''));
 if(x.tap)out.push(flat(x.tap)+' Tap'+(long?' power':''));
 if(x.gold)out.push(pct(x.gold)+' '+(long?'Quest Gold':'Gold'));
 if(x.goldFlat)out.push(flat(x.goldFlat)+' Gold per '+(long?'rewarded Quest kill':'kill'));
 return out.slice(0,2);}
// One short line on what the signature targets.
function help(id){const g=BY_ID[id]?.signature||{},t=(g.type||g.typeFlat)?.[0],parts=[];
 if(g.all)parts.push('every equipped companion');if(t)parts.push(`equipped ${t} only`);if(g.tap)parts.push('your taps');if(g.gold||g.goldFlat)parts.push('Gold paid by Quest enemies and first boss clears');
 return 'Only while equipped. Boosts '+parts.join(', ')+'.';}
// One opening: a rarity from ODDS, then an even pick among that rarity's heroes. rng() returns [0,1).
function draw(rng){let x=rng()*100,rarity=RARITIES[RARITIES.length-1];for(const r of RARITIES){x-=ODDS[r];if(x<0){rarity=r;break;}}
 const list=ROSTER.filter(h=>h.rarity===rarity);return list[Math.min(list.length-1,Math.floor(rng()*list.length))];}

// The collection record. spent: when each used charge comes back (trusted ms). high: latest trusted time seen.
// pending: the committed result of the last opening until the player has seen it, so a reload replays it and never re-rolls.
// v3 adds crests (the Hero Crests balance) and bought (the last Crest purchase, by its receipt). The key keeps its v02 name.
// A v2 record (#150) keeps everything and starts at 0 Crests: openings already paid out earn nothing after the fact, and a
// v2 result still waiting to be seen shows no Crests (Crests start with the next opening).
// v4 adds found: heroes an opening has drawn but the player hasn't recruited, with the copies held for each. A hero is in
// owned or in found, never both. A v2/v3 collection keeps every owned hero as recruited and starts with nothing found.
const fresh=()=>({v:4,owned:{[DEFAULT]:1},found:{},active:DEFAULT,spent:[],high:0,seq:0,receipt:'',pending:null,crests:0,bought:null});
const wallet=n=>Number.isSafeInteger(n)&&n>=0;
function clean(v){if(!v||typeof v!=='object'||![2,3,4].includes(v.v)||!v.owned||typeof v.owned!=='object'||Array.isArray(v.owned))return null;
 const owned={};for(const [id,n] of Object.entries(v.owned))if(own(id)&&count(n))owned[id]=n;if(!owned[DEFAULT])owned[DEFAULT]=1;
 const found={},f=v.v===4&&v.found&&typeof v.found==='object'&&!Array.isArray(v.found)?v.found:{};for(const [id,n] of Object.entries(f))if(own(id)&&!owned[id]&&count(n))found[id]=n;
 const high=Number.isFinite(v.high)&&v.high>=0?v.high:0;
 // A return time more than 24h past the latest trusted time is a future jump: it can only come back 24h from then.
 const spent=(Array.isArray(v.spent)?v.spent:[]).filter(Number.isFinite).map(t=>Math.min(t,high+RECHARGE_MS)).sort((a,b)=>a-b).slice(-CHARGES);
 const p=v.pending,v3=v.v>=3,ok=p&&typeof p==='object'&&typeof p.receipt==='string'&&p.receipt&&own(p.id);
 // A found result stays valid after the hero is recruited (from the board, while the result is still on screen).
 const pending=!ok?null:p.found===true&&v.v===4?(count(p.held)&&(found[p.id]||owned[p.id])?{receipt:p.receipt,id:p.id,isNew:p.held===1,found:true,held:p.held,copies:0,before:0,after:0,crests:wallet(p.crests)?p.crests:0}:null)
  :owned[p.id]&&count(p.copies)?{receipt:p.receipt,id:p.id,isNew:!!p.isNew,copies:p.copies,before:rank(p.id,p.copies-1),after:rank(p.id,p.copies),crests:v3&&wallet(p.crests)?p.crests:0}:null;
 const b=v3?v.bought:null,bought=b&&typeof b==='object'&&typeof b.receipt==='string'&&b.receipt&&own(b.id)&&owned[b.id]&&count(b.copies)&&wallet(b.price)?{receipt:b.receipt,id:b.id,isNew:!!b.isNew,copies:b.copies,price:b.price,before:b.recruit===true?0:rank(b.id,b.copies-1),after:rank(b.id,b.copies),...(b.recruit===true?{recruit:true}:{})}:null;
 return {v:4,owned,found,active:own(v.active)&&owned[v.active]?v.active:DEFAULT,spent,high,seq:Number.isInteger(v.seq)&&v.seq>=0?v.seq:0,receipt:typeof v.receipt==='string'?v.receipt:'',pending,crests:v3&&wallet(v.crests)?v.crests:0,bought};}
let state=null,warn='';
function storage(){try{return root.localStorage||null;}catch{return null;}}
// Always re-read before a change, so another tab's opening is seen first.
function load(){const ls=storage();let rec=null;try{const raw=ls?.getItem(KEY);if(raw===null||raw===undefined)rec=fresh();else{rec=clean(JSON.parse(raw));if(!rec){rec=fresh();warn='Your hero collection could not be read on this device, so it started again with Rowan Thatch.';}}}catch{rec=state||fresh();}
 state=rec;return rec;}
function current(){return state||load();}
// Write, then read back. If the device won't keep it, nothing changes.
function commit(next){const ls=storage(),text=JSON.stringify(next);try{if(!ls)throw Error('no storage');ls.setItem(KEY,text);if(ls.getItem(KEY)!==text)throw Error('not kept');}catch{warn='This device would not save your heroes, so nothing was changed. Try again.';return false;}state=next;warn='';return true;}
// The game's trusted clock (origin HTTP Date + monotonic time). Never the device clock on its own.
function clock(){const C=root.LoreClock;const trusted=!!C?.trusted?.();return {trusted,now:trusted?C.now(0):null};}
function charges(now,rec=current()){const t=Math.max(Number(now)||0,rec.high),out=rec.spent.filter(x=>x>t);return {available:CHARGES-out.length,max:CHARGES,nextAt:out.length?out[0]:null};}
function makeReceipt(t,seq){let r='';try{const a=new Uint32Array(2);root.crypto.getRandomValues(a);r=a[0].toString(36)+a[1].toString(36);}catch{r=Math.floor(Math.random()*2**32).toString(36);}return `h${Math.floor(t).toString(36)}-${seq}-${r}`;}
// The random way to get a hero. Checks the charge, draws, and stores hero, copies, Crests, charge and receipt in one write.
function open({now,trusted,rng=Math.random}={}){if(!enabled())return {ok:false,reason:'off'};const rec=load();
 if(rec.pending)return {ok:true,replay:true,result:rec.pending};
 if(!trusted||!Number.isFinite(now))return {ok:false,reason:'clock'};
 const t=Math.max(now,rec.high),c=charges(t,rec);if(c.available<=0)return {ok:false,reason:'empty',nextAt:c.nextAt};
 // A recruited hero gets a copy at once. Any other hero is only found: its held copies go up by one and it stays locked.
 const h=draw(rng),had=rec.owned[h.id]||0,seq=rec.seq+1,receipt=makeReceipt(t,seq),crests=CREST_REWARD[h.rarity];
 let pending,owned=rec.owned,found=rec.found;
 if(had){const copies=had+1;pending={receipt,id:h.id,isNew:false,copies,before:rank(h.id,had),after:rank(h.id,copies),crests};owned={...owned,[h.id]:copies};}
 else{const held=(found[h.id]||0)+1;pending={receipt,id:h.id,isNew:held===1,found:true,held,copies:0,before:0,after:0,crests};found={...found,[h.id]:held};}
 if(!wallet(rec.crests+crests))return {ok:false,reason:'save'};
 const next={...rec,owned,found,spent:[...rec.spent.filter(x=>x>t),t+RECHARGE_MS],high:t,seq,receipt,pending,crests:rec.crests+crests};
 if(!commit(next))return {ok:false,reason:'save'};return {ok:true,result:pending};}
// The player has seen the result. Only clears the matching receipt.
function acknowledge(receipt){if(!enabled())return false;const rec=load();if(!rec.pending||rec.pending.receipt!==receipt)return false;return commit({...rec,pending:null});}
// The chosen way: one copy of a named hero for its rarity's Crest price. price and seq are what the player confirmed:
// if either changed (another tab, a double tap, an opening in between) nothing happens. Uses no opening and pays no Crests.
function priceOf(id){const h=BY_ID[id];return h?CREST_PRICE[h.rarity]:null;}
function maxed(id,copies){const h=BY_ID[id];return !!h&&copies>=THRESHOLDS[h.rarity][5];}
function buy({id,price,seq}={}){if(!enabled())return {ok:false,reason:'off'};if(!own(id))return {ok:false,reason:'unknown'};const rec=load();
 if(price!==CREST_PRICE[BY_ID[id].rarity])return {ok:false,reason:'price'};if(seq!==rec.seq)return {ok:false,reason:'stale'};
 // A found hero bought this way keeps its held copies: they and the bought copy all count, in the same write.
 const had=rec.owned[id]||0,held=had?0:rec.found[id]||0;if(maxed(id,had))return {ok:false,reason:'max'};if(!wallet(rec.crests)||rec.crests<price)return {ok:false,reason:'funds'};
 const copies=had+held+1,nextSeq=rec.seq+1,bought={receipt:'b'+makeReceipt(rec.high,nextSeq).slice(1),id,isNew:!had,copies,price,before:had?rank(id,had):0,after:rank(id,copies)};
 const found={...rec.found};delete found[id];
 if(!commit({...rec,owned:{...rec.owned,[id]:copies},found,crests:rec.crests-price,seq:nextSeq,bought}))return {ok:false,reason:'save'};return {ok:true,result:bought};}
// Recruit a hero an opening found, for its rarity's one-time RECRUIT_PRICE. Every held copy becomes a lifetime copy.
// Needs no clock: the Crests and the find were both earned already. price and seq are what the player confirmed.
function recruitPrice(id){const h=BY_ID[id];return h?RECRUIT_PRICE[h.rarity]:null;}
function recruit({id,price,seq}={}){if(!enabled())return {ok:false,reason:'off'};if(!own(id))return {ok:false,reason:'unknown'};const rec=load();
 if(rec.owned[id])return {ok:false,reason:'owned'};const held=rec.found[id]||0;if(!held)return {ok:false,reason:'notfound'};
 if(price!==RECRUIT_PRICE[BY_ID[id].rarity])return {ok:false,reason:'price'};if(seq!==rec.seq)return {ok:false,reason:'stale'};
 if(!wallet(rec.crests)||rec.crests<price)return {ok:false,reason:'funds'};
 const nextSeq=rec.seq+1,bought={receipt:'r'+makeReceipt(rec.high,nextSeq).slice(1),id,isNew:true,recruit:true,copies:held,price,before:0,after:rank(id,held)};
 const found={...rec.found};delete found[id];
 if(!commit({...rec,owned:{...rec.owned,[id]:held},found,crests:rec.crests-price,seq:nextSeq,bought}))return {ok:false,reason:'save'};return {ok:true,result:bought};}
function select(id){if(!enabled()||!own(id))return false;const rec=load();if(!rec.owned[id])return false;if(rec.active===id)return true;return commit({...rec,active:id});}
function activeHero(){return BY_ID[enabled()?current().active:DEFAULT];}
function copiesOf(id){return enabled()?current().owned[id]||0:(id===DEFAULT?1:0);}
// Copies held for a found hero that isn't recruited yet (0 once recruited). They give nothing until it is.
function heldOf(id){return enabled()&&own(id)?current().found[id]||0:0;}
// The equipped hero's effects. On the real game every one of them is nothing.
function tapMultiplier(){if(!enabled())return 1;const rec=current();return heroTap(rec.active,rec.owned[rec.active]);}
function bonus(){if(!enabled())return null;const rec=current();return signature(rec.active,rec.owned[rec.active]);}
// Tap with a given hero and copies: weapon × multiplier (with mastery) + flat tap (with mastery).
function tapWith(id,copies,weapon){return weapon*heroTap(id,copies)+(signature(id,copies)?.tap||0);}
function tap(weapon){if(!enabled())return weapon;const rec=current();return tapWith(rec.active,rec.owned[rec.active],weapon);}
// A paid Quest Gold reward with the hero: × (1 + Gold %) + flat, rounded once. A zero or missing reward stays as it is.
function gold(amount){const x=bonus();if(!x||!(amount>0)||!Number.isFinite(amount)||!(x.gold||x.goldFlat))return amount;return Math.round(amount*(1+x.gold)+x.goldFlat);}
// For one companion of a type: the DPS % to add (all + matching type, added together) and the flat expected DPS.
// key changes with the equipped hero and its rank, so combat's cache never keeps an old hero.
function companion(type){const x=bonus();if(!x)return {pct:0,flat:0,key:''};const rec=current();
 return {pct:x.all+(x.type&&x.type[0]===type?x.type[1]:0),flat:x.typeFlat&&x.typeFlat[0]===type?x.typeFlat[1]:0,key:rec.active+':'+rank(rec.active,rec.owned[rec.active])};}
// Another tab changed the collection: drop the cached copy.
try{root.addEventListener?.('storage',e=>{if(e?.key===KEY||e?.key===null)state=null;});}catch{}
root.LoreHeroes={KEY,LEGACY_KEY,DEFAULT,RARITIES,RARITY_COLORS,ROSTER,ODDS,THRESHOLDS,CHARGES,RECHARGE_MS,MASTERY_STEP,SIGNATURE_STEP,CREST_REWARD,CREST_PRICE,RECRUIT_PRICE,TYPES,byId:id=>own(id)?BY_ID[id]:null,
 enabled,clock,active:activeHero,copies:copiesOf,owned:id=>copiesOf(id)>0,rank,heroTap,nextThreshold,draw,charges:now=>charges(now),pending:()=>enabled()?current().pending:null,
 crests:()=>enabled()?current().crests:0,seq:()=>enabled()?current().seq:0,lastBought:()=>enabled()?current().bought:null,priceOf,maxed,buy,recruitPrice,recruit,held:heldOf,signature,effects,help,
 open,acknowledge,select,tapMultiplier,bonus,tap,tapWith,gold,companion,portrait,grid,navIcon,warning:()=>warn,reload:()=>{state=null;return load();},_reset(){state=null;warn='';}};
})(globalThis);
