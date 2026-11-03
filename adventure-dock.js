/* Approved Adventure presentation, mounted after normal game startup. No fixtures or storage adapter. */
(function (root) {
  'use strict';
  // Historical isolated review routes retain their own presentation adapters.
  if (root.__LORE_REVIEW_ISOLATED__ === true) return;
  const $ = id => document.getElementById(id);
  const names = ['party'], roman = ['I', 'II', 'III', 'IV', 'V'];
  const icon = name => `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="assets/navigation-emblems.svg#${name}"/></svg>`;
  let mounted = false, selected = 0, collapsed = false, last = '', partyKey = '', page = 0;
  // Ten places (request #97, Joshua's ten-companion layout §2–5). The tray shows all ten in two rows of five when the
  // fight still keeps 240px of scene; otherwise one row of five with a 1–5 / 6–10 switch, and the two rows open as a
  // sheet over the lower scene. The mode comes from the measured screen, never the phone model. When even one row and
  // a 44px control band would leave under 240px, the band goes and one control sits beside the goal and Challenge
  // band (party-layout.css). Five-place saves keep one row.
  const PAGE = 5, TARGET = 240, BAND = 44, ACTION = 52, EDGE = 1, CARD_EXTRA = 37;
  let view = 'expanded', sheet = false, fit = null, measured = '';
  function setPage(n) { page = n; last = ''; partyKey = ''; refresh(); }
  // Room the fight keeps with each tray layout. The combat area and the tray share one fixed height (the summon rail's
  // top minus the combat area's top), so the choice never feeds back into the measurement.
  function measure() {
    const combat = $('combatLayout'), deck = $('adventureDeck'), rail = $('summonDock'), game = $('game');
    if (!combat?.getBoundingClientRect || !deck || !rail || deck.hidden || rail.hidden || game.classList.contains('boss-room') || game.classList.contains('party-sheet-tall')) return null;
    const shared = rail.getBoundingClientRect().top - combat.getBoundingClientRect().top;
    const width = Math.min(430, deck.clientWidth), floor = combat.querySelector('.location')?.offsetHeight || 36;
    if (!(shared > 0) || !(width > 0)) return null;
    // Card width is (W − 24 − 4×4) / 5; its height keeps the portrait square between the Lv. badge and the DPS plate.
    const cardW = (width - 24 - 16) / 5, cardH = Math.round(cardW + CARD_EXTRA);
    const body = rows => 8 + rows * cardH + (rows - 1) * 8 + 10, scene = (band, rows) => Math.round(shared - floor - ACTION - band - body(rows) - EDGE);
    return {cardW, cardH, body, rail: rail.offsetHeight, two: scene(BAND, 2), band: scene(BAND, 1), corner: scene(0, 1)};
  }
  // Picks the layout and sets the sizes party-layout.css reads. --dock-panel-height keeps meaning "tray height minus
  // the old 22px heading", which realm1-art.js reads when the tray is folded.
  function arrange(s) {
    const game = $('game'), many = s.party.slots.length > PAGE, choosing = !!root.LoreOwnershipAdventure?.choosing;
    const m = measure(); if (m) fit = m; if (!fit) return '';
    const mode = many && fit.two >= TARGET && (choosing || view === 'expanded') ? 'expanded' : 'compact';
    const controls = mode === 'expanded' || fit.band >= TARGET ? 'band' : 'corner';
    if (!many || mode === 'expanded') sheet = false;
    const over = many && mode === 'compact' && (sheet || choosing), band = controls === 'band' ? BAND : 0, body = fit.body(mode === 'expanded' ? 2 : 1);
    // A waiting summon's panel sits above the sheet. When both don't fit under the top bar, the summon rail steps aside
    // until the decision is made (it can't summon while one waits anyway).
    const hud = game.querySelector('.hud')?.getBoundingClientRect?.().bottom || 0, nav = game.querySelector('.realm-navigation')?.getBoundingClientRect?.().top || 0;
    const tall = over && choosing && nav > 0 && ($('dockChoice')?.scrollHeight || 0) + 6 + BAND + fit.body(2) + EDGE > nav - hud - fit.rail;
    game.dataset.partyView = mode; game.dataset.partyControls = controls; game.classList.toggle('party-sheet', over); game.classList.toggle('party-sheet-tall', tall);
    const vars = {'--party-card-h': fit.cardH, '--party-band': band, '--party-body': body, '--dock-panel-height': band + body + EDGE - 22,
      '--party-sheet-body': fit.body(2), '--party-sheet-h': BAND + fit.body(2) + EDGE, '--party-sheet-lift': over ? BAND + fit.body(2) - band - body : 0};
    for (const [k, v] of Object.entries(vars)) game.style.setProperty(k, v + 'px');
    return [mode, controls, over].join(':');
  }
  // The Party button: two rows ↔ one row where two rows fit, otherwise it opens and closes the two-row sheet. While a
  // summon waits for its place, all ten stay in view.
  function toggleView() {
    if (!state || root.LoreOwnershipAdventure?.choosing || state.party.slots.length <= PAGE) return;
    if (sheet) sheet = false;
    else if ($('game').dataset.partyView === 'expanded') view = 'compact';
    else if (fit && fit.two >= TARGET) view = 'expanded';
    else sheet = true;
    last = ''; partyKey = ''; refresh();
    $('dockPartyView').focus({preventScroll:true});
  }
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
    if (value && sheet) { sheet = false; last = ''; partyKey = ''; refresh(); }
    if (value && !wasCollapsed && $('adventureDeck').contains(document.activeElement)) $('dockHandle').focus({preventScroll:true});
    else if (!value && wasCollapsed && document.activeElement === $('dockHandle')) $('dockToggle').focus({preventScroll:true});
  }
  function refresh() {
    if (!mounted || !state) return;
    const s = state, R = root.LoreRealm, key = JSON.stringify([s.party.slots, s.masteryCopies, s.progress?.armory, s.upgrades, s.owned, s.gold, s.shards, s.summoning.selected, s.summoning.unlocked, s.essence, !!s.pending]);
    const layout = arrange(s);
    if ((key === last && layout === measured) || drag) return; last = key; measured = layout;
    const many = s.party.slots.length > PAGE, filled = s.party.slots.filter(Boolean).length, [mode, controls, over] = layout.split(':'), all = mode === 'expanded' || over === 'true';
    if (!many || filled <= PAGE) page = 0;
    const nextPartyKey = JSON.stringify([s.party.slots, s.masteryCopies, s.progress?.armory, s.upgrades, s.owned, page, layout]);
    if (nextPartyKey !== partyKey) { partyKey = nextPartyKey;
    $('game').classList.toggle('party-ten', many);
    // Party n/10 on the left, the page switch in the middle (one row with more than five companions), collapse on the right.
    const count = filled + '/' + s.party.slots.length, viewButton = $('dockPartyView');
    $('dockPartyCount').textContent = count;
    viewButton.setAttribute('aria-disabled', String(!many || !!root.LoreOwnershipAdventure?.choosing));
    viewButton.setAttribute('aria-expanded', String(all));
    viewButton.setAttribute('aria-label', 'Party, ' + filled + ' of ' + s.party.slots.length + ' places filled.' + (!many ? '' : all ? (over === 'true' ? ' Close the party sheet.' : ' Show one row.') : ' Show all ten places.'));
    const pages = $('dockPartyPages'); pages.hidden = !(many && filled > PAGE && mode === 'compact' && controls === 'band' && over !== 'true');
    for (const b of pages.querySelectorAll('[data-party-page]')) b.setAttribute('aria-pressed', String(Number(b.dataset.partyPage) === page));
    $('dockCompanions').innerHTML = s.party.slots.map((id, i) => {
      if (many && !all && Math.floor(i / PAGE) !== page) return '';
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
    if (state.party.slots.length > PAGE) page = Math.floor(placed / PAGE);
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
    deck.innerHTML = `<button id="dockHandle" type="button" aria-controls="dockBody" aria-expanded="false"><span class="handle-notch" aria-hidden="true"><svg viewBox="0 0 24 12"><path d="m5 9 7-6 7 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b id="dockHandleLabel" hidden>Party</b><span id="dockHandleRoster" aria-hidden="true"></span></button><header class="dock-heading"><button id="dockPartyView" class="dock-party-view" type="button" aria-controls="dockBody"><i class="party-view-icon" aria-hidden="true"></i><span class="party-view-label">Party</span> <b id="dockPartyCount"></b></button><div id="dockPartyPages" class="dock-party-pages" role="group" aria-label="Party places shown" hidden><button type="button" data-party-page="0" aria-pressed="true" aria-label="Show party places 1 to 5">1–5</button><button type="button" data-party-page="1" aria-pressed="false" aria-label="Show party places 6 to 10">6–10</button></div><button id="dockToggle" type="button" aria-controls="dockBody" aria-expanded="true" aria-label="Collapse party dock"><i aria-hidden="true"></i><span aria-hidden="true">⌄</span></button></header><div id="dockBody" class="dock-body"><div id="dockPages" class="dock-pages">${names.map(name => `<section id="dockPanel-${name}" class="dock-page" aria-label="Equipped companions"></section>`).join('')}</div></div>`;
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
    $('dockToggle').onclick = () => collapse(!collapsed);
    $('dockPartyView').onclick = toggleView;
    $('dockPartyPages').onclick = event => { const b = event.target.closest('[data-party-page]'); if (b) setPage(Number(b.dataset.partyPage)); };
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && sheet && !document.querySelector('dialog[open]')) { sheet = false; last = ''; partyKey = ''; refresh(); } });
    $('dockHandle').onclick = () => collapse(false);
    // The unchanged global navigation owns the other four destinations.
    new MutationObserver(() => { const otherArea = game.classList.contains('area-open'); const returning = deck.hidden && !otherArea; deck.hidden = otherArea; $('summonDock').hidden = otherArea; if (returning) choose(selected, 'instant'); }).observe(game, {attributes: true, attributeFilter: ['class']});
    collapse(false); refresh();
    setInterval(refresh, 200);
    root.__ADVENTURE_DOCK_READY__ = true;
  }
  root.LoreAdventureDock = {activate, choose, collapse, refresh, setPage, toggleView, get page() {return page;}, get view() {return $('game')?.dataset.partyView;}, get sheet() {return sheet;}, get fit() {return fit;}, get panel() {return names[selected];}, get collapsed() {return collapsed;}};
  // Observe the real entry lifecycle, including asynchronous save loading and first egg selection.
  // Invalid saves never reveal #game and therefore never mount the dock.
  const startup = new MutationObserver(() => { if (!$('game').hidden) { activate(); if (mounted) startup.disconnect(); } });
  startup.observe($('game'), {attributes:true, attributeFilter:['hidden']});
  activate();
  if (mounted) startup.disconnect();
})(globalThis);
