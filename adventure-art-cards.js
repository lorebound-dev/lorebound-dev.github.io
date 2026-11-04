/* Isolated Adventure art component. Rarity always comes from species data in the game. */
(function(root){
  'use strict';
  const TIERS=['common','uncommon','rare','epic','legendary','mythic','ancient','exalted','transcendent','eternal'];
  // Joshua's approved dock backgrounds (Artwork Inbox, Companion-Dock-Rarity-Backgrounds-v01), unchanged. Each carries its own
  // border, so it is the card's whole frame. Keyed by the game's rarity names (Joshua, 2026-11-04): the art's "07 Ascendant"
  // goes on Ancient cards, and Exalted and Transcendent match by name whatever the file numbers say.
  const dockBase='assets/dock-rarity/LOREBOUND_Dock_';
  const dockArt={common:['01_Common',1024,1536],uncommon:['02_Uncommon',1024,1536],rare:['03_Rare',1024,1536],epic:['04_Epic',1024,1536],legendary:['05_Legendary',1024,1536],mythic:['06_Mythic',1024,1536],ancient:['07_Ascendant',1024,1536],exalted:['09_Exalted',941,1672],transcendent:['08_Transcendent',941,1672],eternal:['10_Eternal',1024,1536]};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // No name on the card (Joshua, 2026-11-03): the full name stays in its title and accessible label, and in the
  // companion's details, the Omnidex and the swap view's summary.
  function render(h,power,slot,artTestTier,level){
    // The explicit override is used only on the labeled, non-game look-development page.
    const tier=(artTestTier||h.rarity).toLowerCase();
    if(!TIERS.includes(tier))throw Error('Unsupported rarity background');
    const habitat=h.category.toLowerCase();
    const [file,w,ht]=dockArt[tier];
    // No habitat glow, line pattern, ambient layer or second frame on the small card (Joshua, 2026-11-04): the rarity
    // background is its only decoration. Full-size habitats elsewhere are unchanged.
    return `<button type="button" class="dock-companion lore-card" data-dock-slot="${slot}" data-species="${escape(h.id)}" data-rarity="${tier}" data-habitat="${habitat}" title="${escape(h.name)} · ${escape(h.rarity)}" aria-label="${escape(h.name)}, ${escape(artTestTier?'art test: '+artTestTier+' background':h.rarity)}, ${level?'Lv. '+escape(level)+', ':''}${escape(power)} DPS. Inspect or change placement">
      <span class="card-face">
        <img class="card-dock-bg" src="${dockBase+file}.webp" alt="" width="${w}" height="${ht}" decoding="async">
        <span class="dock-art-stage">${root.LoreArt.portrait(h,'dock-portrait')}</span>
        ${level?`<span class="dock-level">Lv. ${level}</span>`:''}      </span>
      <span class="dock-dps"><b>${escape(power)}</b><small>DPS</small></span>
    </button>`;
  }
  root.LoreAdventureCard={render,TIERS};
})(globalThis);
