/* Cosmetic companion lore: one habitat per category and fixed display measurements. No combat, odds or save data. */
(function(root){'use strict';
// Only three full-screen habitats exist. Mortals, Spirits and Aberrations use the tutorial egg screen's starry void until Joshua supplies art (see pocket-fortune/docs/ARTWORK-NEEDS.md).
const habitats=Object.freeze({Wildgrowth:'habitat-woodland',Beasts:'habitat-volcanic',Constructs:'habitat-moonlit',Mortals:null,Spirits:null,Aberrations:null});
const fallback='void';
// Species id (owned copy ids like 'bramblebud~3' resolve too): [size label, metres, weight in kg or a word for bodiless species]
const measures=Object.freeze({
 bramblebud:['Height',.3,1.4],cinderclack:['Size',.4,6.5],glimwick:['Height',.4,2.8],
 'lost-squire':['Height',1.5,48],'cavern-scout':['Height',1.7,62],'wandering-acolyte':['Height',1.7,58],rustblade:['Height',1.8,84],'hollow-knight':['Height',2,140],
 'gloom-bat':['Size',.6,.4],'stoneback-toad':['Height',.5,18],'cave-moth':['Size',.5,.2],'moonveil-stag':['Height',1.6,190],
 'soot-sprite':['Size',.2,'Weightless'],'wick-wisp':['Size',.2,'Weightless'],'lantern-wisp':['Size',.3,'Weightless'],'rune-wisp':['Size',.4,'Weightless'],'ashen-familiar':['Height',.5,1.2],'dusk-revenant':['Height',1.9,'Weightless'],
 pebblekin:['Height',.3,12],rustmite:['Size',.3,4.5],dripstone:['Height',.6,35],'stone-sentinel':['Height',2.6,1250],
 rootling:['Height',.4,3.2],shroomlet:['Height',.3,.9],twigling:['Height',.6,2.1],briarling:['Height',.8,9.5],gravecap:['Height',.7,6],
 'crooked-eye':['Size',.5,3.4],'hollow-maw':['Size',4.2,260],'forgotten-watcher':['Height',2.3,'Unknown']});
function habitat(category){if(!(category in habitats))return '';return `url('assets/${habitats[category]||fallback}.png')`;}
function measure(id){const m=measures[String(id).split('~')[0]];if(!m)return null;return {sizeLabel:m[0],size:m[1].toFixed(1)+' m',weight:typeof m[2]==='number'?m[2].toLocaleString('en-US',{maximumFractionDigits:1})+' kg':m[2]};}
function text(id){const m=measure(id);return m?`${m.sizeLabel} ${m.size} · Weight ${m.weight}`:'';}
root.LoreCompanionProfile=Object.freeze({habitats,fallback,measures,habitat,measure,text});
})(globalThis);
