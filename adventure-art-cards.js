/* Isolated Adventure art component. Rarity always comes from species data in the game. */
(function(root){
  'use strict';
  const base='assets/adventure-rebuild/';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(h,power,slot,artTestTier,level){
    // The explicit override is used only on the labeled, non-game look-development page.
    const tier=(artTestTier||h.rarity).toLowerCase();
    if(!['common','uncommon','rare'].includes(tier))throw Error('Unsupported Realm 1 art tier');
    const habitat=h.category.toLowerCase();
    const backplate=tier==='common'&&['wildgrowth','beasts','constructs','mortals','spirits'].includes(habitat)?'common-'+habitat:tier+'-backplate';
    return `<button type="button" class="dock-companion lore-card" data-dock-slot="${slot}" data-species="${escape(h.id)}" data-rarity="${tier}" data-habitat="${habitat}" title="${escape(h.name)} · ${escape(h.rarity)}" aria-label="${escape(h.name)}, ${escape(h.rarity)}, ${escape(power)} DPS. Inspect or change placement">
      <img class="card-backplate" src="${base+backplate}.webp" alt="" width="256" height="512" decoding="async">
      <span class="card-habitat-light" aria-hidden="true"></span>
      <svg class="card-habitat" viewBox="0 0 100 140" aria-hidden="true"><use href="${base}habitat-motifs.svg#${habitat}"/></svg>
      <img class="card-ambient" src="${base+tier}-ambient.svg" alt="" width="100" height="180">
      <span class="dock-art-stage">${root.LoreArt.portrait(h,'dock-portrait')}</span>
      ${level?`<span class="dock-level">Lv. ${level}</span>`:''}<span class="dock-dps"><b>${escape(power)}</b><small>DPS</small></span>
      <img class="card-frame" src="${base+tier}-frame.svg" alt="" width="100" height="180">
      <img class="card-rarity" src="${base+tier}-emblem.svg" alt="${escape(artTestTier?'Art test: '+artTestTier:h.rarity)}" width="24" height="24">
    </button>`;
  }
  root.LoreAdventureCard={render};
})(globalThis);
