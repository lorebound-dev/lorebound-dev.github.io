/* Ascension's adventurer: an original placeholder pixel figure drawn as SVG squares (no image files).
   Outfit and tool follow the current career (Labor, Martial, Arcane) and grow grander at higher jobs.
   Placeholder art until Joshua approves a character sprite package; not approved art. */
(function(root){'use strict';
const TIERS={Labor:[0,0,1,1,2,2],Martial:[0,1,1,2,2,2,3,3],Arcane:[0,1,1,2,2,3]};
const LOOK={
 Labor:[{title:'Ragged laborer',body:'#7a5a3a',trim:'#5b4129',legs:'#4a3a2a',tool:'bowl'},{title:'Field worker',body:'#6f7a4a',trim:'#4d5532',legs:'#3f3a2e',straw:'#c9a85a',tool:'pick'},{title:'Craftsman',body:'#5a3d2a',trim:'#c9a560',legs:'#2e2a26',apron:'#8a6a44',tool:'hammer'}],
 Martial:[{title:'Squire',body:'#7a5236',trim:'#4f3424',legs:'#3a2e24',tool:'dagger'},{title:'Footman',body:'#8a949c',trim:'#5b646c',legs:'#4a4f55',helm:'#8a949c',tool:'sword'},{title:'Knight',body:'#c3ccd3',trim:'#7d8a94',legs:'#7d8a94',helm:'#c3ccd3',plume:'#a33a32',tool:'sword',shield:'#7d8a94'},{title:'Champion',body:'#e6e9ec',trim:'#d9b45a',legs:'#9aa6ae',helm:'#e6e9ec',plume:'#e2c180',tool:'sword',shield:'#d9b45a',aura:'#f3da9c'}],
 Arcane:[{title:'Student',body:'#3a5a8a',trim:'#2a4166',robe:true,tool:'book'},{title:'Mage',body:'#5a3d8a',trim:'#3d2966',robe:true,cap:'#4a3277',tool:'staff',orb:'#c9a560'},{title:'Wizard',body:'#2d2a6e',trim:'#d9b45a',robe:true,cap:'#2d2a6e',tool:'staff',orb:'#97dbff'},{title:'Archmage',body:'#1d1a4e',trim:'#e2c180',robe:true,cap:'#1d1a4e',tool:'staff',orb:'#f3da9c',aura:'#97dbff'}]};
const SKIN='#e0b08a',SHADE='#b9835f',HAIR='#5a3a22',EYE='#1a1410',BOOT='#2a1f18',WOOD='#8a6a44',STEEL='#9aa6ae',BLADE='#dfe6ea';
function look(A,job){const branch=A.job[job].branch,i=A.JOBS[branch].findIndex(j=>j[0]===job),tier=TIERS[branch][Math.max(0,i)]??0;return {branch,tier,...LOOK[branch][tier]};}
function svg(A,s){const L=look(A,s.job),r=[],px=(x,y,w,h,c,o)=>r.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${o?` opacity="${o}"`:''}/>`);
 if(L.aura){px(5,3,14,23,L.aura,.14);px(7,2,10,25,L.aura,.12);}
 px(6,25,12,1,'#000',.35);
 // shield and book sit in the left hand, behind the arm
 if(L.shield){px(3,13,5,7,L.shield);px(4,14,3,5,L.body);px(5,15,1,3,L.trim);}
 // legs or robe
 if(L.robe){px(8,19,8,5,L.body);px(8,23,8,1,L.trim);px(9,24,2,1,BOOT);px(13,24,2,1,BOOT);}
 else{px(9,19,2,5,L.legs);px(13,19,2,5,L.legs);px(8,24,3,1,BOOT);px(13,24,3,1,BOOT);}
 // torso and arms
 px(8,12,8,7,L.body);px(10,12,4,1,L.trim);px(8,17,8,1,L.trim);
 if(L.apron)px(10,14,4,6,L.apron);
 if(L.branch==='Labor'&&L.tier===0){px(9,14,2,2,L.trim);px(13,18,2,1,L.trim);}
 if(L.robe&&L.tier>=2){px(11,13,2,4,L.trim);}
 px(6,12,2,6,L.body);px(16,12,2,6,L.body);px(6,18,2,1,SKIN);px(16,18,2,1,SKIN);
 // neck and head
 px(11,11,2,1,SHADE);px(9,5,6,6,SKIN);px(10,7,1,1,EYE);px(13,7,1,1,EYE);px(11,9,2,1,SHADE);
 if(L.helm){px(8,4,8,2,L.helm);px(8,6,1,3,L.helm);px(15,6,1,3,L.helm);if(L.plume)px(11,1,2,3,L.plume);}
 else if(L.cap){px(8,4,8,1,L.cap);px(9,3,6,1,L.cap);px(10,2,4,1,L.cap);px(11,1,2,1,L.cap);px(12,0,1,1,L.cap);px(9,4,6,1,L.trim);}
 else{px(9,4,6,1,HAIR);px(9,5,1,2,HAIR);px(14,5,1,2,HAIR);if(L.straw){px(7,4,10,1,L.straw);px(9,2,6,2,L.straw);}}
 // tools in the right hand
 if(L.tool==='bowl')px(3,18,4,1,WOOD),px(4,19,2,1,WOOD);
 if(L.tool==='pick'){px(18,10,1,10,WOOD);px(16,10,5,1,STEEL);px(16,11,1,1,STEEL);px(20,11,1,1,STEEL);}
 if(L.tool==='hammer'){px(18,12,1,8,WOOD);px(17,10,4,2,STEEL);}
 if(L.tool==='dagger'){px(18,14,1,4,BLADE);px(17,18,3,1,L.trim);px(18,19,1,1,WOOD);}
 if(L.tool==='sword'){px(18,5,1,12,BLADE);px(17,17,3,1,L.trim);px(18,18,1,2,WOOD);}
 if(L.tool==='book'){px(3,15,4,5,'#8a3a32');px(4,16,2,3,'#e8dcc0');}
 if(L.tool==='staff'){px(18,6,1,19,'#6a4a2a');px(17,3,3,3,L.orb);if(L.tier>=2)px(16,2,5,5,L.orb,.25);}
 const label=`${s.job}, ${L.title.toLowerCase()} of the ${L.branch} career`;
 return {key:[s.job,A.alive(s)].join('|'),label,title:L.title,branch:L.branch,html:`<svg class="asc-figure-art${A.alive(s)?'':' is-gone'}" viewBox="0 0 24 28" shape-rendering="crispEdges" role="img" aria-label="${label}"><g class="asc-figure-body">${r.join('')}</g></svg>`};}
root.LoreAscensionFigure={svg,look};
})(globalThis);
