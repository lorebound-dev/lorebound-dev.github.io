(function(root){'use strict';const looks=[{"image": "player-base.png", "x": "50.32002%", "y": "60.48000%", "size": "256.61885% 168.60593%"}, {"image": "player-female-v2.png", "x": "51.22760%", "y": "59.19056%", "size": "247.91068% 162.88441%"}];const shirts=[{name:'Charcoal',color:'#57535c'},{name:'Forest',color:'#486d55'},{name:'Ocean',color:'#436785'},{name:'Wine',color:'#854b5d'},{name:'Ochre',color:'#a58242'},{name:'Violet',color:'#71608c'}];
const skins=[{name:'Light',color:'#f1b780'},{name:'Warm',color:'#d79a66'},{name:'Tan',color:'#af744a'},{name:'Brown',color:'#805137'},{name:'Deep',color:'#543728'}];
const images=new Map(),renders=new Map();
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function inside(x,y,points){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [a,b]=points[i],[c,d]=points[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
// Material regions follow the original sprite silhouettes, including neck and wrists.
const skinRegions=[
 [[.26,.18],[.46,.125],[.84,.15],[.86,.25],[.68,.30],[.65,.38],[.40,.38],[.38,.28],[.30,.24]],
 [[.02,.475],[.22,.475],[.25,.64],[.05,.65]],
 [[.72,.475],[.97,.475],[1,.66],[.74,.66]]
];
function tintPixel(r,g,b,x,y,shirt,skin){
 const inSkin=skinRegions.some(p=>inside(x,y,p));
 const isSkin=inSkin&&r>55&&r-g>12&&g-b>7&&g/r>.56&&g/r<.88&&b/r<.76;
 const isShirt=y>.31&&y<.65&&Math.max(r,g,b)-Math.min(r,g,b)<25&&r>29&&r<145;
 if(isSkin&&skin){const c=rgb(skins[skin].color),light=Math.max(.45,Math.min(1.2,(r*.3+g*.59+b*.11)/187));return c.map(v=>Math.min(255,Math.round(v*light)))}
 if(isShirt&&shirt){const c=rgb(shirts[shirt].color),light=(r*.3+g*.59+b*.11)/78;return c.map(v=>Math.min(255,Math.round(v*light)))}
 return [r,g,b];
}
function source(p){if(!images.has(p.image)){images.set(p.image,new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src='assets/'+p.image}));}return images.get(p.image)}
function render(p,shirt,skin){const key=p.image+':'+shirt+':'+skin;if(!renders.has(key))renders.set(key,source(p).then(im=>{if(!im)return null;const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);const pixels=cx.getImageData(0,0,c.width,c.height),d=pixels.data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<180)continue;const x=(i/4)%c.width,y=Math.floor(i/4/c.width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}for(let i=0;i<d.length;i+=4){if(d[i+3]<180)continue;const x=((i/4)%c.width-x0)/(x1-x0),y=(Math.floor(i/4/c.width)-y0)/(y1-y0),v=tintPixel(d[i],d[i+1],d[i+2],x,y,shirt,skin);d[i]=v[0];d[i+1]=v[1];d[i+2]=v[2];}cx.putImageData(pixels,0,0);return c.toDataURL('image/png')}));return renders.get(key)}
root.LorePlayer={looks,shirts,skins,tintPixel,apply(element,index,options={}){const p=looks[index===1?1:0],shirt=Number.isInteger(options.shirt)&&shirts[options.shirt]?options.shirt:0,skin=Number.isInteger(options.skin)&&skins[options.skin]?options.skin:0;const token={};element._appearance=token;element.style.backgroundImage="url('assets/"+p.image+"')";element.style.backgroundSize=p.size;element.style.backgroundPosition=p.x+' '+p.y;if((shirt||skin)&&typeof Image!=='undefined')render(p,shirt,skin).then(url=>{if(url&&element._appearance===token)element.style.backgroundImage='url("'+url+'")'}).catch(()=>{});}};})(globalThis);
