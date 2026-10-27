/* Isolated review host. Production entries do not load this file. */
(function () {
  'use strict';
  const query = new URL(location.href).searchParams;
  const frame = document.getElementById('dockReviewFrame');
  const status = document.getElementById('reviewStatus');
  const sizes = ['320,610', '375,610', '390,844', '430,932'];
  let loadSerial = 0;
  document.body.dataset.review = String(query.get('review') === '1');
  const size = document.getElementById('reviewSize');
  size.value = sizes.includes(query.get('size')) ? query.get('size') : '390,844';

  function fixture() {
    const R = globalThis.LoreRealm, s = R.fresh(0, Date.now());
    s.floor = 23; s.gold = 18420; s.shards = 42;
    s.summoning.unlocked = 3; s.summoning.selected = 1;
    const squad=query.get('squad')==='rarities' ? ['bramblebud','cinderclack','rustblade','rune-wisp','hollow-knight'] : ['bramblebud','cinderclack','glimwick','lost-squire','soot-sprite'];
    for (const id of squad.slice(1)) R.addCopy(s, id);
    s.party.slots = squad.map(id => s.copies.find(c => c.speciesId === id).id);
    s.masteryCopies.bramblebud = 21;
    s.kills = query.get('scenario') === 'boss' ? R.killRequirement(s) : 3;
    s.enemyHp = R.regularHp(s);
    R.syncProgress(s);
    s.notices.seenSpecies = s.copies.map(c => c.speciesId);
    s.notices.announcedQuests = Object.keys(R.C.quests || {});
    s.summoning.settings.sound = false; s.summoning.settings.haptics = false;
    return s;
  }

  async function load() {
    const serial = ++loadSerial;
    delete document.body.dataset.ready;
    status.textContent = 'Loading isolated Adventure…';
    if (query.get('review') === '1') {
      const [w, h] = size.value.split(','); frame.style.width = w + 'px'; frame.style.height = h + 'px';
    }
    try {
      const response = await fetch('home.html');
      if (!response.ok) throw Error('The existing Adventure source could not be loaded.');
      const html = (await response.text()).replace(/<link[^>]*data-adventure-integration[^>]*>/g, '');
      const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(src => !['adventure-dock.js', 'adventure-art-cards.js'].includes(src));
      const memory = JSON.stringify({'lorebound-realm1-v4': JSON.stringify(fixture())}).replaceAll('<', '\\u003c');
      const bootstrap = `<base href="${new URL('.', location.href).href}"><script>(function(){const memory=${memory};const storage={getItem:k=>memory[k]??null,setItem:(k,v)=>{memory[k]=String(v)},removeItem:k=>{delete memory[k]},key:i=>Object.keys(memory)[i]??null,get length(){return Object.keys(memory).length}};try{Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:false});Object.defineProperty(globalThis,'sessionStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}},configurable:false});globalThis.__LORE_REVIEW_ISOLATED__=true;}catch{globalThis.__LORE_REVIEW_ISOLATED__=false;}})();<\/script>`;
      const settings = JSON.stringify({panel: query.get('panel') || 'party', collapsed: query.get('collapsed') === '1'}).replaceAll('<', '\\u003c');
      const insetStyle = query.get('safe') === 'iphone' ? '<style>:root{--preview-safe-top:59px;--preview-safe-bottom:34px}</style>' : '';
      const loader = `<script>(async()=>{if(globalThis.__LORE_REVIEW_ISOLATED__!==true)throw Error('Storage isolation failed. Game startup was stopped.');for(const src of ${JSON.stringify([...scripts, 'adventure-art-cards.js', 'adventure-art-prototype.js'])})await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Could not load '+src));document.body.append(s);});await LoreAdventureDock.activate(${settings});parent.postMessage({kind:'adventure-dock-ready',serial:${serial}},'*');})().catch(e=>{document.body.textContent=e.message;});<\/script>`;
      if (serial !== loadSerial) return;
      frame.srcdoc = html.replace(/<script src="[^"]+"><\/script>/g, '')
        .replace('<head>', '<head>' + bootstrap)
        .replace('</head>', '<link rel="stylesheet" href="adventure-dock-prototype.css"><link rel="stylesheet" href="adventure-art-cards.css"><link rel="stylesheet" href="adventure-art-portrait-fit.css"><link rel="stylesheet" href="adventure-art-prototype.css">' + insetStyle + '</head>')
        .replace('</body>', loader + '</body>');
    } catch (error) { status.textContent = error.message; }
  }
  window.addEventListener('message', event => {
    if (event.source === frame.contentWindow && event.data?.kind === 'adventure-dock-ready' && event.data.serial === loadSerial) {
      status.textContent = 'Ready · real game handlers · isolated memory save · no player data accessed';
      document.body.dataset.ready = 'true';
    }
  });
  size.onchange = load; document.getElementById('reloadReview').onclick = load;
  load();
})();
