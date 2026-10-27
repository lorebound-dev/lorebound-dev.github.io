/* Disposable visual timeline. Rewards and pending discoveries belong to summoning.js. */
(function(root){
'use strict';
if(root.__LORE_REVIEW_ISOLATED__)return;
const hierarchy=Object.freeze(['Common','Uncommon','Rare','Epic','Legendary','Mythic','Ancient','Exalted','Transcendent','Eternal']);
// stages (ms): spiral, silhouette, burst and reveal, finish. Everyday tiers are quick; Rare keeps more build-up.
const effects=Object.freeze({
 Common:Object.freeze({color:'#e5edf0',trails:1,particles:18,shape:'spark',rays:0,glow:8,stages:[220,500,780,1200]}),
 Uncommon:Object.freeze({color:'#a4ed64',trails:2,particles:28,shape:'leaf',rays:6,glow:14,stages:[300,750,1150,1800]}),
 Rare:Object.freeze({color:'#46baff',trails:3,particles:40,shape:'rune',rays:12,glow:22,stages:[450,1100,1600,2600]})
});
const $=id=>document.getElementById(id);let timers=[],raf=0,canvas=null,started=0,current=null;
const motion=root.matchMedia('(prefers-reduced-motion: reduce)');
function cancel(){timers.forEach(clearTimeout);timers=[];cancelAnimationFrame(raf);raf=0;canvas?.remove();canvas=null;}
function stage(value){$('summonSheet').dataset.discoveryStage=value;}
function prepare(result){cancel();const item=root.LoreSummonModel?.item?.(result.itemId)||root.LoreRealm.species(result.itemId);current=effects[item?.rarity];
 const sheet=$('summonSheet');sheet.classList.add('animated-discovery');sheet.style.setProperty('--reveal-light',current?.color||'#e5edf0');
 // Higher tiers intentionally have no art direction: keep the existing renderer as fallback.
 sheet.classList.toggle('configured-reveal',!!current);stage('awake');
}
function settle(){cancel();stage('settled');}
function play(result,reveal,finish,speed=1){
 if(!current)return false;
 const spec={...current,stages:current.stages.map(ms=>ms*speed)};stage('awake');started=performance.now();
 const at=(delay,fn)=>timers.push(setTimeout(fn,delay));
 at(spec.stages[0],()=>stage('spiral'));at(spec.stages[1],()=>stage('silhouette'));
 at(spec.stages[2],()=>{stage('burst');reveal();});at(spec.stages[3],finish);
 const host=$('summonFx');host.replaceChildren();canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const ctx=canvas.getContext('2d'),box=$('summonScene').getBoundingClientRect(),w=box.width,h=box.height,dpr=Math.min(root.devicePixelRatio||1,1.5);
 canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
 const center=w/2,ground=h-12,radius=Math.min(w*.38,125),height=Math.min(h*.75,280);
 function draw(now){
  if(!canvas||document.hidden)return;
  const t=(now-started)/1000,ms=now-started,burst=Math.max(0,(ms-spec.stages[2])/700),fade=burst?Math.pow(Math.max(0,1-(ms-spec.stages[2])/(spec.stages[3]-spec.stages[2])),2):1;
  ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
  const awaken=ms<spec.stages[0],build=Math.min(1,ms/spec.stages[1]);
  // Perspective helixes: trailing arcs wind upward continuously, not a rotating flat image.
  for(let k=0;k<spec.trails;k++){
   ctx.beginPath();
   for(let i=0;i<=110;i++){
    const u=i/110,theta=u*Math.PI*3.4-t*3.5+k*Math.PI*2/spec.trails;
    const r=radius*(.4+.6*Math.sin(u*Math.PI))*(awaken?.5:1)*(1+burst*.4);
    const x=center+Math.cos(theta)*r,y=ground-u*height*build+Math.sin(theta)*r*.18;
    if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.globalAlpha=(awaken?.15:.55)*fade;ctx.strokeStyle=spec.color;ctx.shadowColor=spec.color;ctx.shadowBlur=spec.glow;ctx.lineWidth=2.2;ctx.stroke();
   ctx.globalAlpha=.65*fade;ctx.shadowBlur=3;ctx.strokeStyle='#eefaff';ctx.lineWidth=.7;ctx.stroke();
  }
  for(let i=0;i<spec.particles;i++){
   const seed=i*.6180339,u=(seed+t*.24)%1,theta=i*2.39996+t*(1.1+i%3*.25),r=radius*(.38+(i%7)/9)*(1+burst*.7);
   const x=center+Math.cos(theta)*r,y=ground-u*height*build+Math.sin(theta)*12-burst*25;
   ctx.save();ctx.translate(x,y);ctx.rotate(theta);ctx.globalAlpha=Math.sin(u*Math.PI)*fade;ctx.fillStyle=spec.color;ctx.strokeStyle=spec.color;ctx.shadowBlur=8;ctx.lineWidth=1;
   if(spec.shape==='leaf'){ctx.beginPath();ctx.ellipse(0,0,2,5,0,0,Math.PI*2);ctx.fill();}
   else if(spec.shape==='rune'&&i%3===0){ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(4,1);ctx.lineTo(0,5);ctx.lineTo(-3,0);ctx.closePath();ctx.moveTo(0,-5);ctx.lineTo(1,7);ctx.stroke();}
   else {ctx.fillRect(-1,-2,2,4);ctx.fillRect(-2,-1,4,2);}ctx.restore();
  }
  if(burst>0&&burst<1){
   const halo=ctx.createRadialGradient(center,ground-height*.4,0,center,ground-height*.4,radius*(1+burst));
   halo.addColorStop(0,spec.color);halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.globalAlpha=Math.sin(burst*Math.PI)*(spec.trails*.06);ctx.fillRect(0,0,w,h);
   for(let i=0;i<spec.rays;i++){const angle=i*Math.PI*2/spec.rays+t*.2,reach=radius*(.5+burst),cy=ground-height*.4;ctx.beginPath();ctx.moveTo(center+Math.cos(angle)*reach*.6,cy+Math.sin(angle)*reach*.6);ctx.lineTo(center+Math.cos(angle)*reach,cy+Math.sin(angle)*reach);ctx.strokeStyle=spec.color;ctx.globalAlpha=(1-burst)*.8;ctx.lineWidth=2;ctx.stroke();}
   ctx.globalAlpha=(1-burst)*.8;ctx.strokeStyle=spec.color;ctx.shadowBlur=20;ctx.lineWidth=3*(1-burst)+1;ctx.beginPath();ctx.ellipse(center,ground-18,radius*(.6+burst),18+burst*22,0,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=1;raf=requestAnimationFrame(draw);
 }
 raf=requestAnimationFrame(draw);return true;
}
motion.addEventListener?.('change',e=>{if(e.matches&&!$('summonSheet').hidden)$('summonSkip').click();});
root.addEventListener('pagehide',cancel);
root.LoreDiscoveryReveal=Object.freeze({hierarchy,effects,prepare,play,settle,cancel,get active(){return !!raf;}});
})(globalThis);
