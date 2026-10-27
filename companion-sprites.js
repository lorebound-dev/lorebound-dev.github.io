/* Aspect-safe, bounded sprite renderer. Opt-in infrastructure; no player-state dependencies. */
(function(root){'use strict';
 const contexts=['battlefield','party','collapsed','discovery','omnidex'];
 function entry(id){return root.LoreSpriteManifest.species.find(s=>s.id===id)||null;}
 function layout(record,width,height,context='party'){
  if(!contexts.includes(context)||!(width>0&&height>0))throw Error('Invalid sprite stage');
  const [, ,fw,fh]=record.frame,c=record.contexts[context],p=record.pivot;
  const ax=width*c.anchor[0]+c.offset[0],ay=height*c.anchor[1]+c.offset[1];
  // Bound the complete source frame, including transparent padding, around its explicit pivot.
  const limits=[p[0]?ax/p[0]:Infinity,fw-p[0]?(width-ax)/(fw-p[0]):Infinity,p[1]?ay/p[1]:Infinity,fh-p[1]?(height-ay)/(fh-p[1]):Infinity];
  const scale=Math.max(0,Math.min(...limits)*Math.min(1,c.scale));
  return {x:ax-p[0]*scale,y:ay-p[1]*scale,width:fw*scale,height:fh*scale,scale,anchorX:ax,anchorY:ay};
 }
 function mount(host,id,context='party',options={}){
  const record=entry(id);host.replaceChildren();host.classList.add('sprite-stage');host.dataset.species=id;host.dataset.context=context;
  if(!record){host.textContent='Unknown species — no substitute artwork';host.dataset.assetState='missing';return {destroy(){host.replaceChildren();}};}
  host.setAttribute('role','img');host.setAttribute('aria-label',record.name);host.dataset.assetState='loading';
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
  svg.setAttribute('viewBox',record.frame.join(' '));svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('aria-hidden','true');svg.classList.add('sprite-pixels');
  image.setAttribute('width',record.canvas[0]);image.setAttribute('height',record.canvas[1]);image.setAttribute('preserveAspectRatio','xMidYMid meet');svg.append(image);host.append(svg);
  let dead=false,observer=null;const base=options.baseURL||document.baseURI;
  // Experimental/unapproved replacement metadata is ignored. Optional candidate is for failure testing only.
  const approved=new URL(record.source,base).href;let triedFallback=false;
  image.addEventListener('load',()=>{if(!dead)host.dataset.assetState=triedFallback?'fallback':'ready';});
  image.addEventListener('error',()=>{if(dead)return;if(image.getAttribute('href')!==approved&&!triedFallback){triedFallback=true;image.setAttribute('href',approved);options.onFallback?.(id);}else{host.dataset.assetState='missing';host.textContent=record.name+' — approved artwork unavailable';}});
  image.setAttribute('href',options.testMissingSource?new URL('missing-sprite-fixture.png',base).href:approved);
  const resize=()=>{if(dead)return;const b=host.getBoundingClientRect();if(!b.width||!b.height)return;const r=layout(record,b.width,b.height,context);Object.assign(svg.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});host.dataset.scale=r.scale;};
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(host);}else window.addEventListener('resize',resize);
  resize();return {record,resize,destroy(){dead=true;observer?.disconnect();window.removeEventListener('resize',resize);host.replaceChildren();}};
 }
 const api={entry,layout,mount,contexts};root.LoreSprites=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
