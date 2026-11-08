/* First-session coach (#161). Five short tips after a new player's first hatch: tapping, companions fighting on their
   own, claiming the first quest, the Rift and the Resource Guide. It never blocks the game: only its own plaque takes
   taps, tapping what a tip points at moves it on, and it hides whenever a dialog, a summon or a swap choice is on
   screen. Seen once per device (no save change); "Skip tips" ends it at any point. */
(function(root){'use strict';
const KEY='lorebound-first-coach',doc=root.document;
const STEPS=[
 {target:'#enemySprite',listen:'#battlefield',text:'Tap the enemy to strike with your weapon.'},
 {target:'#essenceResource',text:'Your companions attack by themselves, even while you’re away. Party DPS is their damage each second.'},
 {target:'#journalButton',text:'Quests give rewards. Your first one is ready: open the Journal and claim it.'},
 {target:'#summonPortal',text:'Spend Lore Shards at the Rift to summon new companions. Quests and bosses give you Shards.'},
 {target:'#goldResource',listen:'header.hud',text:'Tap Gold, Party DPS or Lore Shards any time to open the Resource Guide.'}
];
let step=-1,box=null,ring=null,timer=null,listening=null;
const seen=()=>{try{return root.localStorage?.getItem(KEY)==='done'}catch{return false}};
const remember=()=>{try{root.localStorage?.setItem(KEY,'done')}catch{}};
const el=sel=>doc?.querySelector?.(sel);
// Anything the player has to deal with first: dialogs (the Journal, a reveal, a summon decision), the summon scene or a swap choice.
function busy(){const game=el('#game');return !game||game.hidden||game.classList?.contains('summon-active')||game.classList?.contains('dock-choosing')||!!el('dialog[open]');}
function build(){box=doc.createElement('section');box.className='first-coach';box.setAttribute('role','dialog');box.setAttribute('aria-modal','false');box.setAttribute('aria-label','Tips');
 box.innerHTML='<p class="first-coach__count"></p><p class="first-coach__text" aria-live="polite"></p><div class="first-coach__actions"><button type="button" class="ui-button ui-button--secondary first-coach__skip">Skip tips</button><button type="button" class="ui-button ui-button--primary first-coach__next">Next</button></div>';
 ring=doc.createElement('i');ring.className='first-coach-ring';ring.setAttribute('aria-hidden','true');
 box.querySelector('.first-coach__skip').onclick=finish;box.querySelector('.first-coach__next').onclick=next;
 doc.body.append(ring,box);}
function unlisten(){if(listening){listening.node.removeEventListener('click',listening.fn);listening=null;}}
function show(){unlisten();const s=STEPS[step];box.querySelector('.first-coach__count').textContent=`Tip ${step+1} of ${STEPS.length}`;box.querySelector('.first-coach__text').textContent=s.text;box.querySelector('.first-coach__next').textContent=step===STEPS.length-1?'Done':'Next';
 const node=el(s.listen||s.target);if(node){const fn=()=>setTimeout(next,0);node.addEventListener('click',fn);listening={node,fn};}place();}
// The plaque sits on the far side of the screen from what it points at, so it never covers it.
function place(){if(!box)return;const hide=busy(),target=el(STEPS[step]?.target);box.hidden=hide;ring.hidden=hide||!target;if(hide||!target)return;
 const r=target.getBoundingClientRect(),h=root.innerHeight||doc.documentElement.clientHeight;ring.style.cssText=`left:${r.left-4}px;top:${r.top-4}px;width:${r.width+8}px;height:${r.height+8}px`;
 box.classList.toggle('below',r.top+r.height/2<h/2);}
function next(){if(step<0)return;step++;if(step>=STEPS.length){finish();return;}show();}
function finish(){remember();unlisten();clearInterval(timer);timer=null;step=-1;box?.remove();ring?.remove();box=ring=null;}
function start(){if(step>=0||seen()||!doc?.body)return;build();step=0;show();timer=setInterval(place,300);root.addEventListener?.('resize',place);}
root.LoreFirstCoach={start,finish,get step(){return step}};
})(globalThis);
