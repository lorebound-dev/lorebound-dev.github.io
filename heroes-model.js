/* Heroes (fourth tab, DEV preview). 25 fixed placeholder heroes, 2–3 per companion rarity, and the one active hero.
   Only the active hero's tap multiplier is real: Lore.tapPower multiplies the weapon's tap damage by it once.
   Runs only on the test site and local copies, like Ascension before it. On the real game the multiplier is always 1.
   The choice lives under its own localStorage key and never touches the LOREBOUND save. Portraits are drawn from squares in code. */
(function(root){'use strict';
const KEY='lorebound-heroes-preview-v01',DEFAULT='rowan-thatch',HOSTS=['lorebound-dev.github.io','localhost','127.0.0.1',''];
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
function portrait(id,cls='hero-art'){const h=BY_ID[id]||BY_ID[DEFAULT],g=grid(h),pal=palette(h);let rects='';
 g.forEach((row,y)=>{for(let x=0;x<W;){const ch=row[x];let n=1;while(x+n<W&&row[x+n]===ch)n++;if(ch!=='.')rects+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${pal[ch]}"/>`;x+=n;}});
 return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;}

// The Heroes tab's placeholder helm, drawn from squares like the portraits. home.html carries the same drawing inline.
const HELM=['.....bb.....','....obbo....','...owwwvo...','..olwwwwvo..','.olwwwwwwvo.','.owoooooovo.','.olwwoowwvo.','.owwwoowwvo.','.owwoooowvo.','..oo....oo..'],HELM_PAL={o:'#2a1a10',w:'#e2c180',v:'#9b6d2f',l:'#fae3a3',b:'#a8452e'};
function navIcon(cls='nav-art'){let rects='';HELM.forEach((row,y)=>{for(let x=0;x<row.length;){const ch=row[x];let n=1;while(x+n<row.length&&row[x+n]===ch)n++;if(ch!=='.')rects+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${HELM_PAL[ch]}"/>`;x+=n;}});
 return `<svg class="${cls}" viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;}
function enabled(){try{return HOSTS.includes(String(root.location?.hostname??'-'));}catch{return false;}}
let active=null,warn='';
function load(){if(active)return active;let id=DEFAULT;try{const raw=root.localStorage?.getItem(KEY);if(raw!==null&&raw!==undefined){const v=JSON.parse(raw);if(v&&v.v===1&&BY_ID[v.active])id=v.active;}}catch{}active=id;return active;}
function activeHero(){return BY_ID[enabled()?load():DEFAULT];}
function select(id){if(!enabled()||!BY_ID[id])return false;active=id;try{root.localStorage.setItem(KEY,JSON.stringify({v:1,active:id}));warn='';}catch{warn='This device would not keep your hero choice. It resets to Rowan Thatch next time.';}return true;}
// The only real effect: 1 on the real game, the active hero's multiplier on the test site.
function tapMultiplier(){return enabled()?activeHero().tap:1;}
root.LoreHeroes={KEY,DEFAULT,RARITIES,RARITY_COLORS,ROSTER,byId:id=>BY_ID[id]||null,enabled,active:activeHero,select,tapMultiplier,portrait,grid,navIcon,warning:()=>warn,_reset(){active=null;warn='';}};
})(globalThis);
