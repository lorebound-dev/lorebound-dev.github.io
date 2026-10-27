/* Omnidex card portraits only. Source pixels, combat and detail portraits are untouched. */
(function(root){'use strict';
const defaults=Object.freeze({width:88,height:88,bottom:6,scale:1,offsetX:0,offsetY:0});
const overrides=Object.freeze({
  'cinderclack':Object.freeze({scale:0.94,offsetX:0,offsetY:0}),
  'rune-wisp':Object.freeze({scale:0.96,offsetX:0,offsetY:-2}),
  'wick-wisp':Object.freeze({scale:1.04,offsetX:0,offsetY:1})
});
function speciesId(art){if(art.sheet)return ['bramblebud','cinderclack','glimwick'][art.cell]||null;const name=(art.src||'').split('?')[0].split('/').pop();return name?.endsWith('.png')?name.slice(0,-4):null;}
function resolve(art){const id=speciesId(art);return {...defaults,...overrides[id],speciesId:id};}
const api={defaults,overrides,speciesId,resolve};root.OmnidexCardPortraitFit=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
