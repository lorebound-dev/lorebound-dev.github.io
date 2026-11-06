/* Cosmetic companion lore: one habitat per category. No combat, odds or save data. */
(function(root){'use strict';
// One full-screen habitat per category; the starry void stays as the fallback. Joshua chose Ruined Fortress v03 for
// Mortals and kept the volcano for Beasts; the alternatives he didn't pick are kept in reviews/companion-habitats/.
const habitats=Object.freeze({Wildgrowth:'habitat-woodland',Beasts:'habitat-volcanic',Constructs:'habitat-moonlit',Mortals:'habitat-ruined-fortress',Spirits:'habitat-veiled-sanctuary',Aberrations:'habitat-fractured-observatory'});
const fallback='void';
function habitat(category){if(!(category in habitats))return '';return `url('assets/${habitats[category]||fallback}.png')`;}
// Joshua removed size and weight from every companion screen (request 2026-11-06-companion-details-art-qa, answer 4 in #123).
// The Team sheet, Omnidex page and summon reveal hide their line when this is empty, and the tutorial's "A NEW BOND"
// screen shows the starter's own description instead.
function text(){return '';}
root.LoreCompanionProfile=Object.freeze({habitats,fallback,habitat,text});
})(globalThis);
