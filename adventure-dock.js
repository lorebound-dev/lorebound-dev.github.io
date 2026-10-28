/* Approved Adventure presentation, mounted after normal game startup. No fixtures or storage adapter. */
(function (root) {
  'use strict';
  // Historical isolated review routes retain their own presentation adapters.
  if (root.__LORE_REVIEW_ISOLATED__ === true) return;
  const $ = id => document.getElementById(id);
  const names = ['party'], roman = ['I', 'II', 'III', 'IV', 'V'];
  const icon = name => `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="assets/navigation-emblems.svg#${name}"/></svg>`;
  let mounted = false, selected = 0, collapsed = false, last = '', partyKey = '';
  function make(tag, className, html = '') { const n = document.createElement(tag); n.className = className; n.innerHTML = html; return n; }

  function choose(index, behavior = 'smooth') {
    if (root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) behavior = 'instant';
    selected = Number.isFinite(index) ? Math.max(0, Math.min(0, index)) : selected;
    $('adventureDeck').dataset.panel = names[selected];
    for (let i = 0; i < 1; i++) {
      const active = i === selected, panel = $('dockPanel-' + names[i]);
      panel.inert = collapsed || !active; panel.setAttribute('aria-hidden', String(!active || collapsed));
    }
    $('dockHandleLabel').textContent = names[selected][0].toUpperCase() + names[selected].slice(1);
    $('dockHandle').setAttribute('aria-label', 'Expand ' + names[selected] + ' panel');
    $('dockPages').scrollTo({left: selected * $('dockPages').clientWidth, behavior});
    $('dockToggle').setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + names[selected] + ' dock');
  }
  function collapse(value) {
    const wasCollapsed = collapsed;
    collapsed = value;
    $('game').classList.toggle('dock-is-collapsed', value);
    $('adventureDeck').querySelector('.dock-heading').inert = value;
    $('dockToggle').setAttribute('aria-expanded', String(!value));
    $('dockHandle').setAttribute('aria-expanded', String(!value));
    $('dockToggle').querySelector('span').textContent = value ? '⌃' : '⌄';
    choose(selected, 'instant');
    if (value && !wasCollapsed && $('adventureDeck').contains(document.activeElement)) $('dockHandle').focus({preventScroll:true});
    else if (!value && wasCollapsed && document.activeElement === $('dockHandle')) $('dockToggle').focus({preventScroll:true});
  }
  function refresh() {
    if (!mounted || !state) return;
    const s = state, R = root.LoreRealm, key = JSON.stringify([s.party.slots, s.masteryCopies, s.progress?.armory, s.upgrades, s.owned, s.gold, s.shards, s.summoning.selected, s.summoning.unlocked, s.essence, !!s.pending]);
    if (key === last || drag) return; last = key;
    const nextPartyKey = JSON.stringify([s.party.slots, s.masteryCopies, s.progress?.armory, s.upgrades, s.owned]);
    if (nextPartyKey !== partyKey) { partyKey = nextPartyKey; $('dockCompanions').innerHTML = s.party.slots.map((id, i) => {
      const h = id && R.species(id);
      return h ? root.LoreAdventureCard.render(h,statFmt(root.LoreParty.power(s,id)),i,null,s.version===5?root.LoreOwnership.leveling(s,id).level:null) : `<button type="button" class="dock-companion is-empty" data-dock-slot="${i}" aria-label="Empty slot ${i+1}. Choose companion"><span class="dock-empty">+</span><span>Empty</span></button>`;
    }).join('');
    for (const card of $('dockCompanions').querySelectorAll('.dock-companion:not(.is-empty)')) card.setAttribute('aria-describedby', 'dockReorderHint');
    $('dockHandleRoster').innerHTML = s.party.slots.map(id => {const h = id && R.species(id); return h ? '<span class="handle-sprite">' + root.LoreArt.portrait(h) + '</span>' : '<span class="handle-sprite handle-empty">·</span>';}).join(''); }
    // A level badge glows green with an up arrow only while its next level can actually be bought.
    if (s.version === 5) for (const card of $('dockCompanions').querySelectorAll('.dock-companion:not(.is-empty)')) {
      const id = s.party.slots[Number(card.dataset.dockSlot)], ready = !!id && root.LoreOwnership.canLevel(s, id), label = card.dataset.label ??= card.getAttribute('aria-label');
      card.querySelector('.dock-level')?.classList.toggle('can-level', ready);
      card.setAttribute('aria-label', ready ? label + ' Level upgrade available.' : label);
    }
    root.LoreOwnershipAdventure?.markDock?.();
  }

  // Hold a companion card, then drag it onto another slot to reorder the party. A quick tap still inspects, and a
  // finger that moves before the hold completes is a scroll, not a drag. Shift + arrow keys move the focused card.
  const HOLD_MS = 380, SLOP = 8;
  let drag = null, swallowClick = 0;
  // The lifted card follows the finger, so look past it for the slot underneath.
  function slotAt(x, y) { const n = (document.elementsFromPoint?.(x, y) || []).find(e => drag && e !== drag.card && !drag.card.contains(e) && e.closest?.('#dockCompanions [data-dock-slot]'))?.closest('#dockCompanions [data-dock-slot]'); return n ? Number(n.dataset.dockSlot) : null; }
  function clearDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    drag.card.classList.remove('is-lifted'); drag.card.style.transform = '';
    $('dockCompanions').classList.remove('is-reordering');
    for (const n of $('dockCompanions').querySelectorAll('.is-drop-target')) n.classList.remove('is-drop-target');
    drag = null;
  }
  function announce(text) { $('dockReorderStatus').textContent = text; }
  function moveTo(from, to, focus) {
    const id = state?.party.slots[from]; if (!id) return false;
    const placed = root.LoreTeam.move(id, to); if (placed === false) return false;
    root.LoreUI?.feedback?.('equip');
    last = ''; partyKey = ''; refresh();
    announce(R().species(id).name + ' moved to slot ' + (placed + 1) + '.');
    if (focus) $('dockCompanions').querySelector(`[data-dock-slot="${placed}"]`)?.focus({preventScroll:true});
    return true;
  }
  const R = () => root.LoreRealm;
  function wireReorder() {
    const box = $('dockCompanions');
    box.addEventListener('pointerdown', e => {
      const card = e.target.closest?.('.dock-companion:not(.is-empty)');
      if (!card || e.button > 0 || root.LoreOwnershipAdventure?.choosing || collapsed) return;
      clearDrag();
      drag = {card, from: Number(card.dataset.dockSlot), x: e.clientX, y: e.clientY, id: e.pointerId, live: false, target: null};
      drag.timer = setTimeout(() => {
        if (!drag) return;
        drag.live = true; card.classList.add('is-lifted'); box.classList.add('is-reordering');
        try { card.setPointerCapture?.(drag.id); } catch {}
        if (state?.summoning?.settings?.haptics) try { root.navigator?.vibrate?.(12); } catch {}
        announce('Moving ' + card.title.split(' · ')[0] + '. Drag onto another slot, then let go.');
      }, HOLD_MS);
    });
    box.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.live) { if (Math.hypot(dx, dy) > SLOP) clearDrag(); return; }
      e.preventDefault();
      drag.card.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
      const at = slotAt(e.clientX, e.clientY);
      for (const n of box.querySelectorAll('.is-drop-target')) n.classList.remove('is-drop-target');
      drag.target = at !== null && at !== drag.from ? at : null;
      if (drag.target !== null) box.querySelector(`[data-dock-slot="${drag.target}"]`)?.classList.add('is-drop-target');
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const {live, from, target} = drag, cancelled = e.type === 'pointercancel';
      clearDrag();
      if (!live) return;
      swallowClick = Date.now();
      if (cancelled || target === null) { announce('Move cancelled.'); return; }
      moveTo(from, target, false);
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    // A held finger must not scroll the page or open the browser's press menu while a card is lifted.
    box.addEventListener('touchmove', e => { if (drag?.live) e.preventDefault(); }, {passive: false});
    box.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });
    box.addEventListener('keydown', e => {
      const card = e.target.closest?.('.dock-companion:not(.is-empty)');
      if (e.key === 'Escape' && drag) { clearDrag(); announce('Move cancelled.'); return; }
      if (!card || !e.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(e.key) || root.LoreOwnershipAdventure?.choosing) return;
      e.preventDefault();
      const from = Number(card.dataset.dockSlot);
      moveTo(from, from + (e.key === 'ArrowLeft' ? -1 : 1), true);
    });
  }

  function activate() {
    if (mounted || !state || $('game').hidden) return;
    mounted = true;
    document.documentElement.classList.add('adventure-dock-preview', 'art-rebuild-preview');
    const game = $('game'), combat = $('combatLayout'), nav = game.querySelector('.realm-navigation');
    const shortcuts = make('div', 'dock-scene-shortcuts');
    shortcuts.append($('omnidexButton'), $('journalButton')); combat.append(shortcuts);
    combat.querySelector('.progress-row').append($('timer'));
    game.append($('toast'));
    const deck = make('section', 'adventure-deck'); deck.id = 'adventureDeck'; deck.setAttribute('aria-label', 'Adventure gameplay dock');
    deck.innerHTML = `<button id="dockHandle" type="button" aria-controls="dockBody" aria-expanded="false"><span class="handle-notch" aria-hidden="true"><svg viewBox="0 0 24 12"><path d="m5 9 7-6 7 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b id="dockHandleLabel" hidden>Party</b><span id="dockHandleRoster" aria-hidden="true"></span></button><header class="dock-heading"><button id="partyTraining" type="button">Training <span aria-hidden="true">›</span></button><button id="dockToggle" type="button" aria-controls="dockBody" aria-expanded="true" aria-label="Collapse party dock"><i aria-hidden="true"></i><span aria-hidden="true">⌄</span></button></header><div id="dockBody" class="dock-body"><div id="dockPages" class="dock-pages">${names.map(name => `<section id="dockPanel-${name}" class="dock-page" aria-label="Equipped companions"></section>`).join('')}</div></div>`;
    game.append(deck, $('summonDock'), nav);
    const foundation=make('div','art-foundation'); foundation.id='artFoundation'; foundation.setAttribute('aria-hidden','true'); game.append(foundation);
    for(const node of [deck, $('summonDock')]){const corners=make('span','art-corners');corners.setAttribute('aria-hidden','true');node.append(corners);}
    const crest=make('span','art-crest');crest.setAttribute('aria-hidden','true');deck.append(crest);
    const party = $('dockPanel-party');
    party.innerHTML = '<div id="dockCompanions" class="dock-companions"></div><p id="dockReorderHint" class="dock-sr-only">Hold and drag to reorder, or press Shift and an arrow key.</p><p id="dockReorderStatus" class="dock-sr-only" role="status" aria-live="polite"></p>';
    const summon = $('summonDock'); summon.append($('autoSummon')); $('autoSummon').classList.add('dock-auto-button');
    const optionsLabel = make('small', 'dock-tome-options', 'Options <span aria-hidden="true">›</span>'); $('tomeQuickAccess').append(optionsLabel);
    $('tomeQuickAccess').prepend(make('span', 'dock-options-icon', icon('armory')));
    $('autoSummon').setAttribute('role', 'switch');
    const syncAuto = () => $('autoSummon').setAttribute('aria-checked', String($('autoSummon').getAttribute('aria-label') === 'Stop auto summon'));
    new MutationObserver(syncAuto).observe($('autoSummon'), {attributes:true, attributeFilter:['aria-label']}); syncAuto();
    const text = make('span', 'dock-summon-copy'); text.append($('summonActionLabel'), summon.querySelector('.portal-caption')); $('summonPortal').append(text);
    // Keep the original handlers and original source elements. This adapter only moves/styles them.
    $('dockCompanions').onclick = event => {
      const b = event.target.closest('[data-dock-slot]'); if (!b) return;
      if (Date.now() - swallowClick < 500) return; // The release of a drag is not an inspect tap.
      if (root.LoreOwnershipAdventure?.choosing) { root.LoreOwnershipAdventure.pick(Number(b.dataset.dockSlot)); return; }
      root.LoreTeam.open(Number(b.dataset.dockSlot));
    };
    wireReorder();
    $('partyTraining').remove();
    $('dockToggle').onclick = () => collapse(!collapsed);
    $('dockHandle').onclick = () => collapse(false);
    // The unchanged global navigation owns the other four destinations.
    new MutationObserver(() => { const otherArea = game.classList.contains('area-open'); const returning = deck.hidden && !otherArea; deck.hidden = otherArea; $('summonDock').hidden = otherArea; if (returning) choose(selected, 'instant'); }).observe(game, {attributes: true, attributeFilter: ['class']});
    collapse(false); refresh();
    setInterval(refresh, 200);
    root.__ADVENTURE_DOCK_READY__ = true;
  }
  root.LoreAdventureDock = {activate, choose, collapse, refresh, get panel() {return names[selected];}, get collapsed() {return collapsed;}};
  // Observe the real entry lifecycle, including asynchronous save loading and first egg selection.
  // Invalid saves never reveal #game and therefore never mount the dock.
  const startup = new MutationObserver(() => { if (!$('game').hidden) { activate(); if (mounted) startup.disconnect(); } });
  startup.observe($('game'), {attributes:true, attributeFilter:['hidden']});
  activate();
  if (mounted) startup.disconnect();
})(globalThis);
