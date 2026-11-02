/* Universal companion roster, stage 1: the 30 owner-approved Realm 2 (Ashen Expanse) companions.
   NOT LOADED BY ANY GAME PAGE YET. Nothing here changes odds, saves, the Omnidex or combat until
   Noah approves the pool and save-validator changes (request 2026-11-01-universal-approved-companions).

   Source: LOREBOUND_ASSET_MAPPING_149.json (owner-approved art list), assets R2-CMP-001..030.
   Names and rarities are copied from it unchanged. Categories come from each approved file name.
   IDs are derived from names the way Realm 1's are (lowercase, spaces to hyphens), because the list
   gives none (canonical_game_id is null for all 30).

   PROVISIONAL, UNBALANCED: attack intervals and crit chances below are the Realm 1 averages for the
   same rarity and category, as Joshua approved on 2026-11-02. Where Realm 1 has no companion of that
   rarity and category, the Realm 1 average for the whole rarity is used and marked 'rarity-average'.
   Epic has no Realm 1 equivalent: Joshua approved (2026-11-02, provisional) the Realm 1 Rare average
   for the category plus one crit point. Epic mastery thresholds are owner-approved PROVISIONAL values.
   Damage needs no new value: the engine derives it from rarity (baseDps x rarityGrowth^rank), and
   category 'Aberrations' already gets aberrationMultiplier (x4) and the aberration mastery table.

   Summon odds (summon below) are NOT live. Ordinary species share their rarity's ordinary budget
   evenly; Aberrations are exceptional with their own rate, which is still undecided (null).
   Epic: 1% total at the permanent Portal level where Rare reaches 5%, 0.5% each, 0% below it. */
(function(root){'use strict';
const C=root.LoreConfig||(typeof require==='function'?require('./realm1-config.js'):null);
const categoryMap={Beast:'Beasts',Mortal:'Mortals',Spirit:'Spirits',Construct:'Constructs',Wildgrowth:'Wildgrowth',Aberration:'Aberrations'};
// asset id | name | source category | rarity | approved source file | source SHA-256 | width | height
const sources=[
['R2-CMP-001','Embersting Skitter','Beast','Common','r2_companion_beast_common_01_scorched_scorpion_v01_ORIGINAL.png','f017d1995803b4187b3641447af7f49cba908bfa08d0f8702a351e366e721406',1619,971],
['R2-CMP-002','Mosscrest Raptor','Beast','Common','R2-CMP-002_Mosscrest_Raptor_Common_Beast_ORIGINAL.png','0bab31ca1b9af9daa4cbab1464ac8281e26be0ca0264673a61b9025636c5ddd6',1254,1254],
['R2-CMP-003','Glowbloom Sprout','Wildgrowth','Common','R2-CMP-003_Glowbloom_Sprout_Common_Wildgrowth_ORIGINAL.png','c4ee593a9c41ce0850f96b0f922d742d02bc83514148f476dcdac6f8deb31a4d',1254,1254],
['R2-CMP-004','Kilnpot Tender','Construct','Common','R2-CMP-004_Kilnpot_Tender_Common_Construct_ORIGINAL.png','85cbb1b5516beb3bd4959963ba909ab08f3b044bc9d3114fc93a7f7c6200ba68',1254,1254],
['R2-CMP-005','Wayfarer Pell','Mortal','Common','R2-CMP-005_Wayfarer_Pell_Common_Mortal_ORIGINAL.png','ab3fe5732cdf185f054330c2da7184d30d04c453ea156e36d236105f49454175',1254,1254],
['R2-CMP-006','Hushveil','Spirit','Common','R2-CMP-006_Hushveil_Common_Spirit_ORIGINAL.png','6bfa008f639c414f83f82eecec77dd0258fb6355693d07cc52eeda9301e71d22',1254,1254],
['R2-CMP-007','Thorncap Nibbler','Wildgrowth','Common','R2-CMP-007_Thorncap_Nibbler_Common_Wildgrowth_ORIGINAL.png','7fd442fe70705a2daf449bd42cb1e10271172311fc81df9a2147f70c9459b939',1254,1254],
['R2-CMP-008','Ashhook Militiaman','Mortal','Common','R2-CMP-008_Ashhook_Militiaman_Common_Mortal_ORIGINAL.png','fa43c7b07fe66e874b03418f15157a1f27c2b1ed28cef4c3c7c6b05d6fb6fbfb',1254,1254],
['R2-CMP-009','Duskwhorl','Spirit','Common','R2-CMP-009_Duskwhorl_Common_Spirit_LANTERN_FREE_ORIGINAL.png','ec5e20765b4d9e85f4e70c091234d6333bbaa2c1a415715148b312b2b501dad4',1254,1254],
['R2-CMP-010','Sweepjack','Construct','Common','R2-CMP-010_Sweepjack_Common_Construct_ORIGINAL.png','61debaf4d3a0f6a75c379f4496882e0731c581c7fcb305881e02c645ca3ec62d',1459,1078],
['R2-CMP-011','Reedwhim','Wildgrowth','Common','R2-CMP-011_Reedwhim_Common_Wildgrowth_ORIGINAL.png','f61a85b54717a4833fc6d93783f4194bce2933f5c19dfe4af1540769d4f4c92c',1536,1024],
['R2-CMP-012','Parallax Shard','Aberration','Common','R2-CMP-012_Parallax_Shard_Common_Aberration_ORIGINAL.png','81a1831724e68e9ac4901614367d0b22c103b15624bb8df9942f50d0fb38efc1',1536,1024],
['R2-CMP-013','Mara Vell','Mortal','Uncommon','R2-CMP-013_Mara_Vell_Uncommon_Mortal_ORIGINAL.png','61b52988439fb82696809053522448575169dc9cee097d22c496abef414ee5bb',1254,1254],
['R2-CMP-014','Rainchime','Spirit','Uncommon','R2-CMP-014_Rainchime_Uncommon_Spirit_ORIGINAL.png','87eb599093698a65dee26ad0f90e8466264e83c63af9939622d817795c6bf964',1254,1254],
['R2-CMP-015','Sporecap Mummer','Wildgrowth','Uncommon','R2-CMP-015_Sporecap_Mummer_Uncommon_Wildgrowth_ORIGINAL.png','598ccb33d7cda5b853a1efdec34cdfa8a74c7e18189c75c9beb42be9f138c4f4',1254,1254],
['R2-CMP-016','Rilltail','Beast','Uncommon','R2-CMP-016_Rilltail_Uncommon_Beast_ORIGINAL.png','ceadf7799e7d5860ca2bc75d50eca160723b77405b6ea208958c400b52766d4b',1536,1024],
['R2-CMP-017','Tallywheel','Construct','Uncommon','R2-CMP-017_Tallywheel_Uncommon_Construct_ORIGINAL.png','96f282839a27b09fbe33f6cf616a12689aef20ebc002d22b4ab11d94b0f06092',1536,1024],
['R2-CMP-018','Neris Thimble','Mortal','Uncommon','R2-CMP-018_Neris_Thimble_Uncommon_Mortal_ORIGINAL.png','5dde3d0354b2b04b5d647580ebb506e3483dc48a983871acaebdf028fda5466f',1448,1086],
['R2-CMP-019','Gloamstep Hare','Beast','Uncommon','R2-CMP-019_Gloamstep_Hare_Uncommon_Beast_ORIGINAL.png','4d472a8659812a5ec5308358429a30b986f4a21c5dde42a1fe98154db5b5fa65',1536,1024],
['R2-CMP-020','Quietbell','Spirit','Uncommon','R2-CMP-020_Quietbell_Uncommon_Spirit_ORIGINAL.png','32821481bab6d612bd576c793d61513f9286e20bd8167a2b2d63a4c87745ae64',1536,1024],
['R2-CMP-021','Keywarden','Construct','Uncommon','R2-CMP-021_Keywarden_Uncommon_Construct_ORIGINAL.png','13093863773832534919049c8be8627a6f49f5f4040ba932cc58cc12f1b58516',1536,1024],
['R2-CMP-022','Serin Vale','Mortal','Rare','R2-CMP-022_Serin_Vale_Rare_Mortal_ORIGINAL.png','748b310bad126cb94a1a87856e1378e170d0f3e2a168243782635933deb4d280',1536,1024],
['R2-CMP-023','Vesperglass Stag','Beast','Rare','R2-CMP-023_Vesperglass_Stag_Rare_Beast_ORIGINAL.png','a85f3f3ae984cdfe9fc24aa178da954005c08b79c9a1ffc21feda79f545dec1a',1536,1024],
['R2-CMP-024','Morrowthread','Spirit','Rare','R2-CMP-024_Morrowthread_Rare_Spirit_ORIGINAL.png','9232ba7c646b87fd57f337a2080c396ff038ea67cf933024d3bb9b3979d9c910',1536,1024],
['R2-CMP-025','Veyra Shardstring','Mortal','Rare','R2-CMP-025_Veyra_Shardstring_Rare_Mortal_ORIGINAL.png','e28c844b97257f6663aafa18ec6602d098ce1f0f2eb8bb48b8ffbcb27b393ac4',1536,1024],
['R2-CMP-026','Astervane','Construct','Rare','R2-CMP-026_Astervane_Rare_Construct_ORIGINAL.png','811c709d23380895098fb6f521b83ba7d07da08d2d0e7e436b3b3cc0df288ed6',1536,1024],
['R2-CMP-027','Inkspore Cantor','Wildgrowth','Rare','R2-CMP-027_Inkspore_Cantor_Rare_Wildgrowth_ORIGINAL.png','60a3f9ddb0bcf8fb10c5c8ac781ca7ecc12138272f1083e3b98b60082cccfc0a',1536,1024],
['R2-CMP-028','Riftmourn','Aberration','Rare','R2-CMP-028_Riftmourn_Rare_Aberration_ORIGINAL.png','545e3bcfbd8daff73583e1503523fb2fee6e680e386a26c37fa23267bb8ecfb3',1536,1024],
['R2-CMP-029','The Last Waltz','Spirit','Epic','R2-CMP-029_The_Last_Waltz_Epic_Spirit_ORIGINAL.png','de90c831729d42ee42d7f0b54a56331a507ab33c08c630a6b75c42c61aa7c0f6',1536,1024],
['R2-CMP-030','Hushgate','Construct','Epic','R2-CMP-030_Hushgate_Epic_Construct_ORIGINAL.png','d17ec7e9867716b3364668e62085dc7e7c8c88a3e824fc12670ac1ba70e7e16c',1536,1024]];
const round=(n,d)=>Math.round(n*10**d)/10**d,mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
// Realm 1 averages by rarity (and category). Crit is kept as a fraction, like LoreConfig.baseCrit.
function realm1Average(rarity,category){const pick=C.companions.filter(h=>h.rarity===rarity&&(!category||h.category===category));return pick.length?{interval:round(mean(pick.map(h=>h.interval)),2),baseCrit:round(mean(pick.map(h=>h.baseCrit)),4),from:pick.map(h=>h.id)}:null;}
// Owner-approved PROVISIONAL Epic mastery (2026-11-02): cumulative lifetime summons incl. the first discovery.
// Aberration Epic does not exist, so no aberration Epic table is needed.
const masteryThresholds={ordinary:{Epic:[2,3,4,6,8,10]}};
// Owner-approved PROVISIONAL (2026-11-02): Rare average for the category (or whole Rare) plus one crit point.
function epicStats(category){const exact=realm1Average('Rare',category),base=exact||realm1Average('Rare');return {interval:base.interval,baseCrit:round(base.baseCrit+.01,4),from:base.from,rule:'Realm 1 Rare average'+(exact?' ('+category+')':' (all categories)')+' plus 1% crit'};}
// Owner-approved PROVISIONAL Epic unlock (2026-11-02). The Portal level is the one where Rare reaches 5%
// (#78); which other rarity gives up the 1 percentage point is still Noah's decision (null).
const epicUnlock={atRarePercent:5,totalPercent:1,perSpeciesPercent:.5,takenFrom:null,approved:'provisional'};
const slug=name=>name.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const companions=sources.map(([assetId,name,sourceCategory,rarity,file,sha256,width,height],i)=>{
  const category=categoryMap[sourceCategory],rank=C.rarities.indexOf(rarity),epic=rarity==='Epic';
  const exact=epic?null:realm1Average(rarity,category),stats=epic?epicStats(category):(exact||realm1Average(rarity)),aberration=category==='Aberrations';
  return {id:slug(name),assetId,name,category,sourceCategory,realm:2,rarity,rank,
    interval:stats.interval,baseCrit:stats.baseCrit,
    stats:{provisional:true,source:epic?'epic-rare-average-plus-crit':exact?'rarity-category-average':'rarity-average',from:stats.from},
    mastery:aberration?'aberration':'ordinary',
    summon:epic?{kind:'epic',percent:epicUnlock.perSpeciesPercent,live:false}:aberration?{kind:'exceptional',percent:null,live:false}:{kind:'even-share',percent:null,live:false},
    art:{file,sha256,width,height,delivered:false}};});
function validate(){const errors=[],ids=new Set(C.companions.map(h=>h.id)),names=new Set(C.companions.map(h=>h.name.toLowerCase()));
  if(companions.length!==30)errors.push('Realm 2 companion count');
  const counts={Common:12,Uncommon:9,Rare:7,Epic:2};for(const [r,n]of Object.entries(counts))if(companions.filter(h=>h.rarity===r).length!==n)errors.push('Rarity count '+r);
  for(const h of companions){if(ids.has(h.id)||names.has(h.name.toLowerCase()))errors.push('Collides with an existing species '+h.id);ids.add(h.id);names.add(h.name.toLowerCase());
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(h.id))errors.push('ID format '+h.id);
    if(!C.categories.includes(h.category))errors.push('Category '+h.id);if(h.rank<0)errors.push('Rarity '+h.id);
    if(h.summon.live!==false)errors.push('Summon odds must stay off until approved '+h.id);
    if(h.category==='Aberrations'&&(h.summon.kind!=='exceptional'||h.mastery!=='aberration'||!C.masteryThresholds.aberration[h.rarity]))errors.push('Aberration rules '+h.id);
    if(!(h.interval>0)||!(h.baseCrit>=0&&h.baseCrit<=C.economy.critCap)||!h.stats.provisional)errors.push('Provisional combat '+h.id);
    if(!/^[0-9a-f]{64}$/.test(h.art.sha256))errors.push('Source hash '+h.id);}
  for(const group of Object.values(masteryThresholds))for(const [rarity,t]of Object.entries(group))if(t.length!==C.economy.masteryMax||t.some((n,i)=>!Number.isInteger(n)||n<1||(i>0&&n<=t[i-1])))errors.push('Mastery thresholds '+rarity);
  return errors;}
const api={version:2,status:'staged-not-loaded',provisional:true,categoryMap,companions,masteryThresholds,epicUnlock,realm1Average,validate};
root.LoreUniversalRoster=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
