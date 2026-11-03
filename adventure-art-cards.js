/* Isolated Adventure art component. Rarity always comes from species data in the game. */
(function(root){
  'use strict';
  // Joshua's ten approved v02 frames, one per rarity (assets/rarity-frames/manifest.json).
  const TIERS=['common','uncommon','rare','epic','legendary','mythic','ancient','exalted','transcendent','eternal'];
  const frame=tier=>`assets/rarity-frames/rarity-frame-${tier}-v02-264.png`;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // No name on the card (Joshua, 2026-11-03): the full name stays in its title and accessible label, and in the
  // companion's details, the Omnidex and the swap view's summary.
  function render(h,power,slot,artTestTier,level){
    // The explicit override is used only on the labeled, non-game look-development page.
    const tier=(artTestTier||h.rarity).toLowerCase();
    if(!TIERS.includes(tier))throw Error('Unsupported rarity frame');
    const habitat=h.category.toLowerCase();
    // The window behind the portrait is one plain colour for the frame's rarity (Joshua, 2026-11-03): no backdrop,
    // pattern, glow or ambient layer on the small card. Full-size habitats elsewhere are unchanged.
    return `<button type="button" class="dock-companion lore-card" data-dock-slot="${slot}" data-species="${escape(h.id)}" data-rarity="${tier}" data-habitat="${habitat}" title="${escape(h.name)} · ${escape(h.rarity)}" aria-label="${escape(h.name)}, ${escape(artTestTier?'art test: '+artTestTier+' frame':h.rarity)}, ${level?'Lv. '+escape(level)+', ':''}${escape(power)} DPS. Inspect or change placement">
      <span class="card-face">
        <span class="card-window"><span class="dock-art-stage">${root.LoreArt.portrait(h,'dock-portrait')}</span></span>
        <img class="card-frame" src="${frame(tier)}" alt="" width="264" height="352" decoding="async">
        ${level?`<span class="dock-level">Lv. ${level}</span>`:''}      </span>
      <span class="dock-dps"><b>${escape(power)}</b><small>DPS</small></span>
    </button>`;
  }
  root.LoreAdventureCard={render,TIERS};
})(globalThis);
