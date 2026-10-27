'use strict';
globalThis.LoreOpeningMusic?.start();
const entry=document.querySelector('.screen');let entering=false;
entry.addEventListener('click',event=>{event.preventDefault();if(entering)return;entering=true;document.body.classList.add('leaving-title');const preview=new URLSearchParams(window.location.search).get('preview')==='prologue';const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;setTimeout(()=>window.location.assign(preview?'prologue.html?preview=prologue':'prologue.html'),reduced?0:600);});
