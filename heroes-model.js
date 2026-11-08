/* Heroes (fourth tab, DEV preview). 25 fixed placeholder heroes, 2–3 per companion rarity, and the one active hero.
   Heroes come from free chest openings: 3 charges, each back 24 trusted hours after it was used (#150).
   Since #153 every chest gives one FRAGMENT of one hero (or, at JACKPOT odds, a full hero: 3 fragments of it). 3 fragments
   unlock a hero for free, and more fragments raise its mastery at the cumulative MILESTONES (six ranks, +8% of its tap
   multiplier and +5% of its signature each). Which rarities a chest can give depends only on how many chests were opened:
   a rarity is exactly 0% until its GATE, then starts at 1/RAMP of its ODDS weight and grows over RAMP chests to it.
   Every chest also pays Hero Crests by the drawn rarity (#151); Crests buy single fragments of a chosen hero whose rarity
   the chest level has unlocked (FRAG_PRICE). Purchases never pay Crests, use no opening and never count as a chest.
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
// Provisional DEV test values from Joshua's requests #150 and #153 (not approved for the real game).
const CHARGES=3,RECHARGE_MS=24*60*60*1000,MASTERY_STEP=0.08;
// The fully grown weight of each rarity (#150's table). Since #153 these are only reached RAMP chests after the gate.
const ODDS={Common:25,Uncommon:21,Rare:17,Epic:13,Legendary:9,Mythic:6,Ancient:4,Exalted:2.5,Transcendent:1.5,Eternal:1};
// Completed chests needed before a rarity can be drawn at all (#153).
const GATES={Common:0,Uncommon:6,Rare:18,Epic:40,Legendary:75,Mythic:115,Ancient:165,Exalted:225,Transcendent:300,Eternal:400};
const RAMP=150,JACKPOT=0.002,UNLOCK=3;
// Cumulative fragments for mastery I–VI, the same for every rarity (#153). 48 is the most a hero can hold.
const MILESTONES=[8,14,21,29,38,48],MAX_FRAGS=48;
// Crest price of one chosen fragment (#153).
const FRAG_PRICE={Common:30,Uncommon:50,Rare:80,Epic:120,Legendary:185,Mythic:285,Ancient:400,Exalted:585,Transcendent:835,Eternal:1200};
// Before #153: lifetime copies needed for mastery I–VI. Only used to carry older test collections over.
const LATE=[2,3,4,5,6,8];
const OLD_THRESHOLDS={Common:[2,4,7,11,16,24],Uncommon:[2,4,7,10,14,20],Rare:[2,3,5,8,12,18],Epic:[2,3,5,7,10,14],Legendary:[2,3,4,6,8,11],Mythic:LATE,Ancient:LATE,Exalted:LATE,Transcendent:LATE,Eternal:LATE};
const RARITIES=['Common','Uncommon','Rare','Epic','Legendary','Mythic','Ancient','Exalted','Transcendent','Eternal'];
// The same ink/light/dark as the companion rarity classes in adventure.css (.rarity-common …).
const RARITY_COLORS={Common:['#b7bbc0','#e1e2df','#666d75'],Uncommon:['#6fa783','#c1dfbb','#315c46'],Rare:['#6f9dc5','#c8e0f2','#324e78'],Epic:['#ac83c3','#e6c8f1','#61437e'],Legendary:['#c49c52','#fae3a3','#805328'],Mythic:['#c36f76','#f5b6ad','#7a343e'],Ancient:['#ab8873','#ead5b1','#635242'],Exalted:['#b7b6a4','#fff9d9','#8a8268'],Transcendent:['#71afb5','#c3f3e8','#3f6b81'],Eternal:['#b49abc','#fde1ef','#5e4f83']};
// Hero Crests per opening by the drawn hero's rarity (#151, DEV trial values).
const CREST_REWARD={Common:5,Uncommon:6,Rare:7,Epic:8,Legendary:10,Mythic:13,Ancient:17,Exalted:22,Transcendent:30,Eternal:45};
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
const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const fragCount=n=>Number.isInteger(n)&&n>=0&&n<=MAX_FRAGS;
// Mastery rank 0–6 from a hero's fragments (0 until it's unlocked at 3), and its tap multiplier with it.
function rank(id,frags){if(!BY_ID[id]||!(frags>=UNLOCK))return 0;return MILESTONES.filter(n=>frags>=n).length;}
function heroTap(id,frags){const h=BY_ID[id];return h?h.tap*(1+MASTERY_STEP*rank(id,frags)):1;}
// The next fragment total that matters: 3 to unlock, then the next mastery milestone (null at VI).
function nextThreshold(id,frags){if(!BY_ID[id])return null;if(!(frags>=UNLOCK))return UNLOCK;return MILESTONES.find(n=>frags<n)??null;}
// The hero's signature at its mastery rank: every listed value × (1 + 5% × rank). Nothing is rounded here.
function signature(id,frags){const h=BY_ID[id];if(!h)return null;const k=1+SIGNATURE_STEP*rank(id,frags),g=h.signature;
 return {tap:(g.tap||0)*k,gold:(g.gold||0)*k,goldFlat:(g.goldFlat||0)*k,all:(g.all||0)*k,type:g.type?[g.type[0],g.type[1]*k]:null,typeFlat:g.typeFlat?[g.typeFlat[0],g.typeFlat[1]*k]:null};}
// Short effect rows (never more than two), e.g. "+25% All DPS", "+30% Beasts". long: the preview's wording. One decimal at most.
const pct=n=>'+'+Math.round(n*1000)/10+'%',flat=n=>'+'+Math.round(n*10)/10;
function effects(id,frags,long=false){const x=signature(id,frags);if(!x)return [];const out=[];
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

// Chest level (#153). opened: chests completed before this one. A rarity weighs exactly 0 before its gate, then
// ODDS × (opened − gate + 1)/RAMP, capped at ODDS. Common always weighs 25. Worked out fresh each time, so nothing drifts.
function weights(opened){const n=Number.isFinite(opened)&&opened>0?Math.floor(opened):0,out={};
 for(const r of RARITIES){const g=GATES[r];out[r]=n<g?0:r==='Common'?ODDS.Common:ODDS[r]*Math.min(1,(n-g+1)/RAMP);}return out;}
// The real chance of each rarity on the next chest, in % (they add up to 100).
function odds(opened){const w=weights(opened),t=RARITIES.reduce((n,r)=>n+w[r],0),out={};for(const r of RARITIES)out[r]=w[r]?100*w[r]/t:0;return out;}
// Chest Level 1–10: how many rarities can be drawn.
function level(opened){const n=Number(opened)||0;return RARITIES.filter(r=>n>=GATES[r]).length;}
// The next rarity to unlock, with its gate and the one before it (for a progress bar). null when all ten are open.
function nextUnlock(opened){const n=Number(opened)||0,i=RARITIES.findIndex(r=>n<GATES[r]);return i<0?null:{rarity:RARITIES[i],at:GATES[RARITIES[i]],from:GATES[RARITIES[i-1]]};}
// One chest: a rarity from the current weights (only unlocked ones), then an even pick among its heroes. rng() returns [0,1).
// Even an rng of 0.9999… lands on the last unlocked rarity, never a locked one.
function draw(rng,opened=0){const w=weights(opened),list=RARITIES.filter(r=>w[r]>0),total=list.reduce((n,r)=>n+w[r],0);
 let x=rng()*total,rarity=list[list.length-1];for(const r of list){x-=w[r];if(x<0){rarity=r;break;}}
 const heroes=ROSTER.filter(h=>h.rarity===rarity);return heroes[Math.min(heroes.length-1,Math.floor(rng()*heroes.length))];}

// The collection record (v5, #153). frags: fragments held per hero (3+ means unlocked). opened: chests completed.
// spent: when each used charge comes back (trusted ms). high: latest trusted time seen. pending: the committed result of the
// last chest until it's been seen, so a reload replays it and never re-rolls. bought: the last Crest purchase, by receipt.
// The key keeps its v02 name. Older test collections (v2 #150, v3 #151, v4 #152) are carried over in clean().
const fresh=()=>({v:5,frags:{[DEFAULT]:UNLOCK},opened:0,active:DEFAULT,spent:[],high:0,seq:0,receipt:'',pending:null,crests:0,bought:null});
const wallet=n=>Number.isSafeInteger(n)&&n>=0;
// A result's derived parts, worked out from what was stored.
function outcome(p){return {...p,isNew:p.before<UNLOCK&&p.after>=UNLOCK,from:rank(p.id,p.before),to:rank(p.id,p.after)};}
function cleanResult(p,frags){if(!isObj(p)||typeof p.receipt!=='string'||!p.receipt||!own(p.id)||!fragCount(p.before)||!fragCount(p.after)||p.after<p.before||(frags[p.id]||0)<p.after)return null;
 return outcome({receipt:p.receipt,id:p.id,before:p.before,after:p.after,added:p.after-p.before,jackpot:p.jackpot===true,crests:wallet(p.crests)?p.crests:0,tier:RARITIES.includes(p.tier)&&p.tier!=='Common'?p.tier:null});}
function cleanBought(b,frags){if(!isObj(b)||typeof b.receipt!=='string'||!b.receipt||!own(b.id)||!count(b.count)||!wallet(b.price)||!fragCount(b.before)||!fragCount(b.after)||b.after!==b.before+b.count||(frags[b.id]||0)<b.after)return null;
 return outcome({receipt:b.receipt,id:b.id,count:b.count,price:b.price,before:b.before,after:b.after});}
// Before #153 a hero was owned with copies (or, in v4, found with held copies). Owned heroes stay unlocked, at the fragment
// total of the mastery rank they had; held copies become plain fragments (3 or more unlock it, with no fee). The chests
// opened so far weren't counted, so they're estimated as every copy drawn or bought, minus Rowan's starting copy.
// An old unseen result or purchase receipt was already paid out, so it is dropped rather than shown or paid again.
function carry(v){if(!isObj(v.owned))return null;const frags={},rarityOf=id=>BY_ID[id].rarity;let opened=0;
 for(const [id,n] of Object.entries(v.owned))if(own(id)&&count(n)){const r=OLD_THRESHOLDS[rarityOf(id)].filter(t=>n>=t).length;frags[id]=r?MILESTONES[r-1]:UNLOCK;opened+=n;}
 if(v.v===4&&isObj(v.found))for(const [id,n] of Object.entries(v.found))if(own(id)&&!has(frags,id)&&count(n)){frags[id]=Math.min(MAX_FRAGS,n);opened+=n;}
 if(!(frags[DEFAULT]>=UNLOCK))frags[DEFAULT]=UNLOCK;opened=Math.max(0,opened-(own(DEFAULT)&&count(v.owned[DEFAULT])?1:0));
 return {frags,opened,pending:null,bought:null};}
function clean(v){if(!isObj(v)||![2,3,4,5].includes(v.v))return null;let part;
 if(v.v===5){if(!isObj(v.frags))return null;const frags={};for(const [id,n] of Object.entries(v.frags))if(own(id)&&fragCount(n)&&n>0)frags[id]=n;if(!(frags[DEFAULT]>=UNLOCK))frags[DEFAULT]=UNLOCK;
  part={frags,opened:Number.isSafeInteger(v.opened)&&v.opened>=0?v.opened:0,pending:cleanResult(v.pending,frags),bought:cleanBought(v.bought,frags)};}
 else if(!(part=carry(v)))return null;
 const high=Number.isFinite(v.high)&&v.high>=0?v.high:0;
 // A return time more than 24h past the latest trusted time is a future jump: it can only come back 24h from then.
 const spent=(Array.isArray(v.spent)?v.spent:[]).filter(Number.isFinite).map(t=>Math.min(t,high+RECHARGE_MS)).sort((a,b)=>a-b).slice(-CHARGES);
 return {v:5,...part,active:own(v.active)&&part.frags[v.active]>=UNLOCK?v.active:DEFAULT,spent,high,seq:Number.isInteger(v.seq)&&v.seq>=0?v.seq:0,receipt:typeof v.receipt==='string'?v.receipt:'',crests:v.v>=3&&wallet(v.crests)?v.crests:0};}
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
function charges(now,rec=current()){const t=Math.max(Number(now)||0,rec.high),out=rec.spent.filter(x=>x>t);return {available:CHARGES-out.length,max:CHARGES,nextAt:out.length?out[0]:null,at:out.slice()};}
function makeReceipt(t,seq){let r='';try{const a=new Uint32Array(2);root.crypto.getRandomValues(a);r=a[0].toString(36)+a[1].toString(36);}catch{r=Math.floor(Math.random()*2**32).toString(36);}return `h${Math.floor(t).toString(36)}-${seq}-${r}`;}
// One chest. Checks the charge, draws a hero from the unlocked rarities, then a separate JACKPOT roll for 3 fragments
// instead of 1, and stores fragments, chest count, Crests, charge and receipt in one write. A hero at 48 fragments
// gains nothing more, and the result says so (added 0). tier: a rarity this chest has just made possible for the next one.
function open({now,trusted,rng=Math.random}={}){if(!enabled())return {ok:false,reason:'off'};const rec=load();
 if(rec.pending)return {ok:true,replay:true,result:rec.pending};
 if(!trusted||!Number.isFinite(now))return {ok:false,reason:'clock'};
 const t=Math.max(now,rec.high),c=charges(t,rec);if(c.available<=0)return {ok:false,reason:'empty',nextAt:c.nextAt};
 const h=draw(rng,rec.opened),jackpot=rng()<JACKPOT,before=rec.frags[h.id]||0,after=Math.min(MAX_FRAGS,before+(jackpot?3:1)),opened=rec.opened+1,crests=CREST_REWARD[h.rarity];
 if(!wallet(rec.crests+crests))return {ok:false,reason:'save'};
 const seq=rec.seq+1,receipt=makeReceipt(t,seq),tier=RARITIES.find(r=>r!=='Common'&&GATES[r]===opened)||null;
 const pending=outcome({receipt,id:h.id,before,after,added:after-before,jackpot,crests,tier});
 const next={...rec,frags:{...rec.frags,[h.id]:after},opened,spent:[...rec.spent.filter(x=>x>t),t+RECHARGE_MS],high:t,seq,receipt,pending,crests:rec.crests+crests};
 if(!commit(next))return {ok:false,reason:'save'};return {ok:true,result:pending};}
// The player has seen the result. Only clears the matching receipt.
function acknowledge(receipt){if(!enabled())return false;const rec=load();if(!rec.pending||rec.pending.receipt!==receipt)return false;return commit({...rec,pending:null});}
function fragPrice(id){const h=BY_ID[id];return h?FRAG_PRICE[h.rarity]:null;}
function maxed(id,frags){return !!BY_ID[id]&&frags>=MAX_FRAGS;}
// Can the chest level's rarity be bought or drawn yet?
function tierOpen(rarity,opened){return RARITIES.includes(rarity)&&(Number(opened)||0)>=GATES[rarity];}
// The chosen way: n fragments of a named hero, at its rarity's FRAG_PRICE each, only for a rarity the chest level has
// unlocked. n, price and seq are what the player confirmed: if any changed (another tab, a double tap, a chest in
// between) nothing happens. Uses no opening, pays no Crests, never counts as a chest. Unlocking at 3 costs nothing more.
function buy({id,count:n=1,price,seq}={}){if(!enabled())return {ok:false,reason:'off'};if(!own(id))return {ok:false,reason:'unknown'};if(!count(n))return {ok:false,reason:'count'};
 const rec=load(),h=BY_ID[id],before=rec.frags[id]||0;if(!tierOpen(h.rarity,rec.opened))return {ok:false,reason:'locked'};
 if(before>=MAX_FRAGS)return {ok:false,reason:'max'};if(before+n>MAX_FRAGS)return {ok:false,reason:'count'};
 if(price!==FRAG_PRICE[h.rarity]*n)return {ok:false,reason:'price'};if(seq!==rec.seq)return {ok:false,reason:'stale'};
 if(!wallet(rec.crests)||rec.crests<price)return {ok:false,reason:'funds'};
 const nextSeq=rec.seq+1,bought=outcome({receipt:'b'+makeReceipt(rec.high,nextSeq).slice(1),id,count:n,price,before,after:before+n});
 if(!commit({...rec,frags:{...rec.frags,[id]:before+n},crests:rec.crests-price,seq:nextSeq,bought}))return {ok:false,reason:'save'};return {ok:true,result:bought};}
function select(id){if(!enabled()||!own(id))return false;const rec=load();if(!(rec.frags[id]>=UNLOCK))return false;if(rec.active===id)return true;return commit({...rec,active:id});}
function activeHero(){return BY_ID[enabled()?current().active:DEFAULT];}
// Fragments held for a hero (Rowan has his 3 from the start). On the real game only Rowan, unlocked.
function fragmentsOf(id){if(!own(id))return 0;return enabled()?current().frags[id]||0:(id===DEFAULT?UNLOCK:0);}
const unlocked=id=>fragmentsOf(id)>=UNLOCK;
// The equipped hero's effects. On the real game every one of them is nothing.
function tapMultiplier(){if(!enabled())return 1;const rec=current();return heroTap(rec.active,rec.frags[rec.active]);}
function bonus(){if(!enabled())return null;const rec=current();return signature(rec.active,rec.frags[rec.active]);}
// Tap with a given hero and fragments: weapon × multiplier (with mastery) + flat tap (with mastery).
function tapWith(id,frags,weapon){return weapon*heroTap(id,frags)+(signature(id,frags)?.tap||0);}
function tap(weapon){if(!enabled())return weapon;const rec=current();return tapWith(rec.active,rec.frags[rec.active],weapon);}
// A paid Quest Gold reward with the hero: × (1 + Gold %) + flat, rounded once. A zero or missing reward stays as it is.
function gold(amount){const x=bonus();if(!x||!(amount>0)||!Number.isFinite(amount)||!(x.gold||x.goldFlat))return amount;return Math.round(amount*(1+x.gold)+x.goldFlat);}
// For one companion of a type: the DPS % to add (all + matching type, added together) and the flat expected DPS.
// key changes with the equipped hero and its rank, so combat's cache never keeps an old hero.
function companion(type){const x=bonus();if(!x)return {pct:0,flat:0,key:''};const rec=current();
 return {pct:x.all+(x.type&&x.type[0]===type?x.type[1]:0),flat:x.typeFlat&&x.typeFlat[0]===type?x.typeFlat[1]:0,key:rec.active+':'+rank(rec.active,rec.frags[rec.active])};}
// Another tab changed the collection: drop the cached copy.
try{root.addEventListener?.('storage',e=>{if(e?.key===KEY||e?.key===null)state=null;});}catch{}
const openedNow=()=>enabled()?current().opened:0;
root.LoreHeroes={KEY,LEGACY_KEY,DEFAULT,RARITIES,RARITY_COLORS,ROSTER,ODDS,GATES,RAMP,JACKPOT,UNLOCK,MILESTONES,MAX_FRAGS,FRAG_PRICE,CHARGES,RECHARGE_MS,MASTERY_STEP,SIGNATURE_STEP,CREST_REWARD,TYPES,byId:id=>own(id)?BY_ID[id]:null,
 enabled,clock,active:activeHero,fragments:fragmentsOf,unlocked,owned:unlocked,rank,heroTap,nextThreshold,draw,weights,odds,level,nextUnlock,
 opened:openedNow,tierOpen:r=>tierOpen(r,openedNow()),charges:now=>charges(now),pending:()=>enabled()?current().pending:null,
 crests:()=>enabled()?current().crests:0,seq:()=>enabled()?current().seq:0,lastBought:()=>enabled()?current().bought:null,fragPrice,maxed,buy,signature,effects,help,
 open,acknowledge,select,tapMultiplier,bonus,tap,tapWith,gold,companion,portrait,grid,navIcon,warning:()=>warn,reload:()=>{state=null;return load();},_reset(){state=null;warn='';}};
})(globalThis);
