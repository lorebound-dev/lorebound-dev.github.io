/* Released family metadata plus a legacy-save adapter. No prices, odds or save writes here.
   Realm 1's persisted `realm` identifies its sole book; summoning.selected/unlocked store levels.
   Future independent book inventories require their own engine/save adapter before release. */
(function(root){'use strict';
const C=root.LoreConfig||(typeof require==='function'?require('./data/realm1-config.js'):null);
const families=Object.freeze([{id:'forgotten-pages',name:'Forgotten Pages',realm:1,levels:C.tomes}]);
function current(s){return families.find(f=>f.realm===s.realm)||null;}
function available(s){return families.filter(f=>f.realm===s.realm);}
function selection(s){const family=current(s);return family?{familyId:family.id,level:s.summoning.selected,unlocked:s.summoning.unlocked}:null;}
const api={families,current,available,selection};root.LoreTomeFamilies=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
