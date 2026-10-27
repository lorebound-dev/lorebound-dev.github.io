/* Anchor the active session to the origin's HTTP Date, not the editable device clock. */
(function(root){'use strict';let anchor=null,at=0,last=null;const mono=()=>root.performance?.now?.()||0;
async function verify(){if(last)return last;last=(async()=>{if(!root.fetch)return null;let timeout;try{const controller=typeof root.AbortController==='function'?new root.AbortController():null;if(controller)timeout=setTimeout(()=>controller.abort(),6000);const response=await root.fetch('data/realm1-config.js?clock='+Math.trunc(mono()),{method:'HEAD',cache:'no-store',...(controller?{signal:controller.signal}:{})});const raw=response.headers.get('Date'),value=Date.parse(raw);if(!response.ok||!Number.isFinite(value))return null;anchor=value;at=mono();return value;}catch{return null;}finally{clearTimeout(timeout);last=null;}})();return last;}
function now(fallback){return anchor===null?fallback:anchor+Math.max(0,mono()-at);}
root.LoreClock={verify,now,trusted:()=>anchor!==null};})(globalThis);
