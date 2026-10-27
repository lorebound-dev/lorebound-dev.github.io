/* Presentation-only adapter. Never loaded by home.html. Requires the isolated review host. */
(function (root) {
  'use strict';
  if (root.__LORE_REVIEW_ISOLATED__ !== true) throw Error('Adventure dock requires memory-only storage.');
  const $ = id => document.getElementById(id);
  const names = ['party', 'upgrades', 'tomes'], roman = ['I', 'II', 'III', 'IV', 'V'];
  const icon = name => `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="assets/navigation-emblems.svg#${name}"/></svg>`;
  let selected = 0, collapsed = false, last = '', partyKey = '', scrollTimer, dragging = null, suppressClick = false;
  function make(tag, className, html = '') { const n = document.createElement(tag); n.className = className; n.innerHTML = html; return n; }

  function choose(index, behavior = 'smooth') {
    if (root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) behavior = 'instant';
    selected = Math.max(0, Math.min(2, index));
    $('adventureDeck').dataset.panel = names[selected];
    for (let i = 0; i < 3; i++) {
      const active = i === selected, tab = $('dockTab-' + names[i]), panel = $('dockPanel-' + names[i]);
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
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
    else if (!value && wasCollapsed && document.activeElement === $('dockHandle')) $('dockTab-' + names[selected]).focus({preventScroll:true});
  }
  function buy(key) {
    // Delegate to the unchanged Armory click handler, including its save/rollback transaction.
    const source = document.createElement('button'); source.hidden = true;
    source.dataset.permanentUpgrade = key; $('destinationContent').append(source);
    source.click(); source.remove(); refresh();
  }
  function refresh() {
    if (!state) return;
    const s = state, R = root.LoreRealm, key = JSON.stringify([s.party.slots, s.masteryCopies, s.upgrades, s.gold, s.shards, s.summoning.selected, s.summoning.unlocked]);
    if (key === last) return; last = key;
    const nextPartyKey = JSON.stringify([s.party.slots, s.masteryCopies, s.upgrades]);
    if (nextPartyKey !== partyKey) { partyKey = nextPartyKey; $('dockCompanions').innerHTML = s.party.slots.map((id, i) => {
      const h = id && R.species(id);
      return `<button type="button" class="dock-companion ${h ? '' : 'is-empty'}" data-dock-slot="${i}" title="${h ? h.name : 'Choose companion'}" aria-label="${h ? h.name + ', ' + statFmt(root.LoreParty.power(s, id)) + ' DPS. Inspect or change placement' : 'Empty slot ' + (i + 1) + '. Choose companion'}">${h ? '<span class="dock-art-stage">' + root.LoreArt.portrait(h, 'dock-portrait') + `</span><span class="dock-dps"><b>${statFmt(root.LoreParty.power(s, id))}</b><small>DPS</small></span>` : '<span class="dock-empty">+</span><span class="dock-dps">Empty</span>'}</button>`;
    }).join(''); }
    $('dockHandleRoster').innerHTML = s.party.slots.map(id => {const h = id && R.species(id); return h ? '<span class="handle-sprite">' + root.LoreArt.portrait(h) + '</span>' : '<span class="handle-sprite handle-empty">·</span>';}).join('');
    $('dockUpgradeRows').innerHTML = [['teamPower', 'Team Power', 'armory'], ['precision', 'Critical Precision', 'arena']].map(([key, title, glyph]) => {
      const cost = R.upgradeCost(s, key), level = s.upgrades[key];
      const benefit = key === 'teamPower' ? '×' + (1 + R.E.teamPowerStep * level).toFixed(2) + ' party damage' : '+' + (R.E.precisionStep * level * 100).toFixed(1) + '% crit chance';
      return `<div class="dock-upgrade">${icon(glyph)}<div><h3>${title} <small>Lv. ${level}</small></h3><p>${benefit}</p></div><button type="button" data-dock-upgrade="${key}" aria-label="${cost === null ? title + ' maximum' : 'Upgrade ' + title + ' for ' + fmt(cost) + ' Gold'}" ${cost === null || s.gold < cost ? 'disabled' : ''}>${cost === null ? 'Maximum' : '<img src="assets/resource-gold.svg" alt=""><span>' + fmt(cost) + ' Gold</span>'}</button></div>`;
    }).join('');
    $('dockTomeChoices').innerHTML = R.C.tomes.map(t => `<button type="button" data-dock-tome="${t.level}" aria-label="${t.name}, ${t.level <= s.summoning.unlocked ? t.price + ' Gold per summon' : 'Locked'}" aria-pressed="${t.level === s.summoning.selected}" ${t.level > s.summoning.unlocked ? 'disabled' : ''}><img class="dock-tier-art" src="${root.LoreArt.tomeSource(t.level)}" alt=""><span class="dock-tier-copy"><b>Tome ${roman[t.level - 1]}</b><small>${t.count} species · ${fmt(t.price)} Gold</small></span><span class="dock-tier-state" aria-hidden="true">${t.level > s.summoning.unlocked ? '<svg class="dock-lock" viewBox="0 0 12 14"><path d="M2 6h8v6H2zM4 6V4a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor"/></svg>' : t.level === s.summoning.selected ? '✓' : '›'}</span></button>`).join('');
    const tome = R.C.tomes[s.summoning.selected - 1];
    $('dockTomeSummary').textContent = tome.name + ' · ' + tome.count + ' eligible species';
  }

  async function activate(options = {}) {
    for (let i = 0; !state && i < 400; i++) await new Promise(resolve => setTimeout(resolve, 20));
    if (!state) throw Error('The isolated game did not finish loading.');
    document.documentElement.classList.add('adventure-dock-preview');
    const game = $('game'), combat = $('combatLayout'), nav = game.querySelector('.realm-navigation');
    const shortcuts = make('div', 'dock-scene-shortcuts');
    shortcuts.append($('omnidexButton'), $('journalButton')); combat.append(shortcuts);
    combat.querySelector('.progress-row').append($('timer'));
    game.append($('toast'));
    const deck = make('section', 'adventure-deck'); deck.id = 'adventureDeck'; deck.setAttribute('aria-label', 'Adventure gameplay dock');
    deck.innerHTML = `<button id="dockHandle" type="button" aria-controls="dockBody" aria-expanded="false"><span class="handle-notch" aria-hidden="true"><svg viewBox="0 0 24 12"><path d="m5 9 7-6 7 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b id="dockHandleLabel">Party</b><span id="dockHandleRoster" aria-hidden="true"></span></button><header class="dock-heading"><div class="dock-tabs" role="tablist" aria-label="Adventure dock panels">${names.map((name, i) => `<button id="dockTab-${name}" role="tab" type="button" aria-controls="dockPanel-${name}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${name[0].toUpperCase() + name.slice(1)}</button>`).join('')}</div><button id="dockToggle" type="button" aria-controls="dockBody" aria-expanded="true" aria-label="Collapse party dock"><i aria-hidden="true"></i><span aria-hidden="true">⌄</span></button></header><div id="dockBody" class="dock-body"><div id="dockPages" class="dock-pages">${names.map(name => `<section id="dockPanel-${name}" class="dock-page" role="tabpanel" aria-labelledby="dockTab-${name}"></section>`).join('')}</div></div>`;
    game.append(deck, $('summonDock'), nav);
    const party = $('dockPanel-party');
    party.innerHTML = '<div id="dockCompanions" class="dock-companions"></div>';
    $('dockPanel-upgrades').innerHTML = '<div id="dockUpgradeRows" class="dock-upgrade-rows"></div>';
    $('dockPanel-tomes').innerHTML = '<div class="dock-tome-scroll"><div id="dockTomeChoices" class="dock-tome-choices" aria-label="Select an unlocked Tome"></div></div><p id="dockTomeSummary" hidden></p><div class="dock-tome-links"><button id="dockTomeLibrary" type="button">Tome library <span aria-hidden="true">›</span></button><button id="dockExactOdds" type="button">Exact odds <span aria-hidden="true">›</span></button></div>';
    const summon = $('summonDock'); summon.append($('autoSummon')); $('autoSummon').classList.add('dock-auto-button');
    const optionsLabel = make('small', 'dock-tome-options', 'Options <span aria-hidden="true">›</span>'); $('tomeQuickAccess').append(optionsLabel);
    $('tomeQuickAccess').prepend(make('span', 'dock-options-icon', icon('armory')));
    $('autoSummon').setAttribute('role', 'switch');
    const syncAuto = () => $('autoSummon').setAttribute('aria-checked', String($('autoSummon').getAttribute('aria-label') === 'Stop auto summon'));
    new MutationObserver(syncAuto).observe($('autoSummon'), {attributes:true, attributeFilter:['aria-label']}); syncAuto();
    const text = make('span', 'dock-summon-copy'); text.append($('summonActionLabel'), summon.querySelector('.portal-caption')); $('summonPortal').append(text);
    // Keep the original handlers and original source elements. This adapter only moves/styles them.
    $('dockCompanions').onclick = event => { const b = event.target.closest('[data-dock-slot]'); if (b) root.LoreTeam.open(Number(b.dataset.dockSlot)); };
    $('dockUpgradeRows').onclick = event => { const b = event.target.closest('[data-dock-upgrade]'); if (b) buy(b.dataset.dockUpgrade); };
    $('dockTomeLibrary').onclick = () => root.LoreSummoning.openSettings('overview');
    $('dockExactOdds').onclick = () => root.LoreSummoning.openSettings('odds');
    $('dockTomeChoices').onclick = event => {
      const b = event.target.closest('[data-dock-tome]'); if (!b || b.disabled) return;
      root.LoreSummoning.stop('Tome selected'); root.LoreTomes.render(state);
      $('tomeSelect').value = b.dataset.dockTome; $('tomeSelect').dispatchEvent(new Event('change')); refresh();
    };
    $('dockToggle').onclick = () => collapse(!collapsed);
    $('dockHandle').onclick = () => collapse(false);
    for (const [i, name] of names.entries()) {
      const tab = $('dockTab-' + name);
      tab.onclick = () => { if (collapsed) collapse(false); choose(i); };
      tab.onkeydown = e => {
        const next = e.key === 'ArrowRight' ? (selected + 1) % 3 : e.key === 'ArrowLeft' ? (selected + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : null;
        if (next === null) return; e.preventDefault(); if (collapsed) collapse(false); choose(next); $('dockTab-' + names[next]).focus();
      };
    }
    const pages = $('dockPages');
    pages.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => { if (!dragging) choose(Math.round(pages.scrollLeft / pages.clientWidth), 'instant'); }, 110); }, {passive: true});
    // Native touch scrolling owns axis arbitration. Mouse dragging is a desktop convenience.
    pages.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) dragging = {x:e.clientX,y:e.clientY,left:pages.scrollLeft,id:e.pointerId,moved:false}; });
    pages.addEventListener('pointermove', e => {
      if (!dragging) return; const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (!dragging.moved && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) { dragging.moved = true; pages.setPointerCapture(e.pointerId); pages.style.scrollSnapType = 'none'; }
      if (dragging.moved) { e.preventDefault(); pages.scrollLeft = dragging.left - dx; }
    });
    const release = event => { if (!dragging) return; const moved = dragging.moved; dragging = null; pages.style.scrollSnapType = ''; if (moved) { suppressClick = event.type === 'pointerup'; setTimeout(() => { suppressClick = false; }, 0); choose(Math.round(pages.scrollLeft / pages.clientWidth)); } };
    pages.addEventListener('pointerup', release); pages.addEventListener('pointercancel', release);
    pages.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    window.addEventListener('resize', () => choose(selected, 'instant'));
    // The unchanged global navigation owns the other four destinations.
    new MutationObserver(() => { const otherArea = game.classList.contains('area-open'); deck.hidden = otherArea; $('summonDock').hidden = otherArea; }).observe(game, {attributes: true, attributeFilter: ['class']});
    selected = Math.max(0, names.indexOf(options.panel)); collapse(!!options.collapsed); refresh();
    setInterval(refresh, 200);
    root.__ADVENTURE_DOCK_READY__ = true;
  }
  root.LoreAdventureDock = {activate, choose, collapse, refresh, get panel() {return names[selected];}, get collapsed() {return collapsed;}};
})(globalThis);
