/* Isolated Adventure art component. Rarity always comes from species data in the game. */
(function(root){
  'use strict';
  const base='assets/adventure-rebuild/';
  // Joshua's ten approved v02 frames, one per rarity (assets/rarity-frames/manifest.json).
  const TIERS=['common','uncommon','rare','epic','legendary','mythic','ancient','exalted','transcendent','eternal'];
  const frame=tier=>`assets/rarity-frames/rarity-frame-${tier}-v02-264.png`;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(h,power,slot,artTestTier,level){
    // The explicit override is used only on the labeled, non-game look-development page.
    const tier=(artTestTier||h.rarity).toLowerCase(),own=h.rarity.toLowerCase();
    if(!TIERS.includes(tier))throw Error('Unsupported rarity frame');
    const habitat=h.category.toLowerCase();
    // The window behind the portrait keeps the companion's own Realm 1 backdrop, whatever frame an art test shows.
    const backplate=['common','uncommon','rare'].includes(own)?(own==='common'&&['wildgrowth','beasts','constructs','mortals','spirits'].includes(habitat)?'common-'+habitat:own+'-backplate'):'';
    return `<button type="button" class="dock-companion lore-card" data-dock-slot="${slot}" data-species="${escape(h.id)}" data-rarity="${tier}" data-habitat="${habitat}" title="${escape(h.name)} · ${escape(h.rarity)}" aria-label="${escape(h.name)}, ${escape(artTestTier?'art test: '+artTestTier+' frame':h.rarity)}, ${escape(power)} DPS. Inspect or change placement">
      <span class="card-face">
        <span class="card-window">${backplate?`<img class="card-backplate" src="${base+backplate}.webp" alt="" width="256" height="512" decoding="async">`:''}<span class="card-habitat-light" aria-hidden="true"></span>
          <svg class="card-habitat" viewBox="0 0 100 140" aria-hidden="true"><use href="${base}habitat-motifs.svg#${habitat}"/></svg>${backplate?`<img class="card-ambient" src="${base+own}-ambient.svg" alt="" width="100" height="180">`:''}
          <span class="dock-art-stage">${root.LoreArt.portrait(h,'dock-portrait')}</span></span>
        <img class="card-frame" src="${frame(tier)}" alt="" width="264" height="352" decoding="async">
        ${level?`<span class="dock-level">Lv. ${level}</span>`:''}<span class="card-name">${escape(h.name)}</span>
      </span>
      <span class="dock-dps"><b>${escape(power)}</b><small>DPS</small></span>
    </button>`;
  }
  root.LoreAdventureCard={render,TIERS};
})(globalThis);
