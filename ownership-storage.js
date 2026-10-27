/* Backup-first conversion and single-key atomic transactions. No default live keys. */
(function(root){'use strict';
const O=root.LoreOwnership||(typeof require==='function'?require('./ownership-v5.js'):null);
async function digest(raw){const c=root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null);if(!c?.subtle)throw Error('Secure backup verification unavailable');return Array.from(new Uint8Array(await c.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');}
function create({storage,prefix,sourceKey,lock}){
 if(!prefix||!sourceKey||prefix===sourceKey||!lock)throw Error('Explicit isolated keys and exclusive writer lock required');
 const keys={state:prefix+':state',backup:prefix+':backup',journal:prefix+':journal'};
 function write(key,raw){storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Storage verification failed');}
 async function recover(){
  const raw=storage.getItem(keys.state),jr=storage.getItem(keys.journal);if(!jr){if(raw!==null)throw Error('Missing conversion journal');return null;}
  const j=JSON.parse(jr),backup=storage.getItem(keys.backup);if(j.version!==1||!['prepared','committed'].includes(j.phase)||typeof backup!=='string'||await digest(backup)!==j.sourceHash)throw Error('Backup or journal integrity failure');
  if(raw===null){if(j.phase==='committed')throw Error('Committed state missing: reconciliation required');return null;}
  const s=JSON.parse(raw);if(!O.validate(s)||s.migration.sourceHash!==j.sourceHash)throw Error('Invalid converted state; original backup retained');
  const expected=O.migrate(backup,s.migration.selected,j.sourceHash);if(JSON.stringify(expected.migration)!==JSON.stringify(s.migration))throw Error('Migration receipt mismatch');
  if(j.phase==='prepared'){if(await digest(raw)!==j.targetHash)throw Error('Interrupted conversion does not match journal');write(keys.journal,JSON.stringify({...j,phase:'committed'}));}
  return s;
 }
 return {keys,load:()=>lock(recover),async backup(){const b=storage.getItem(keys.backup),j=JSON.parse(storage.getItem(keys.journal)||'null');if(!j||b===null||await digest(b)!==j.sourceHash)throw Error('No verified backup');return b;},
  convert:({expectedRaw,selected,confirmed})=>lock(async()=>{
   if(!confirmed)throw Error('Explicit final confirmation required');const previous=await recover();if(previous)return previous;
   if(storage.getItem(sourceKey)!==expectedRaw)throw Error('Legacy save changed; review selection again');
   const sourceHash=await digest(expectedRaw),state=O.migrate(expectedRaw,selected,sourceHash),target=JSON.stringify(state),targetHash=await digest(target);
   const oldBackup=storage.getItem(keys.backup);if(oldBackup!==null&&oldBackup!==expectedRaw)throw Error('Another backup exists; reconciliation required');
   write(keys.backup,expectedRaw);if(await digest(storage.getItem(keys.backup))!==sourceHash)throw Error('Backup integrity failure');
   write(keys.journal,JSON.stringify({version:1,phase:'prepared',sourceHash,targetHash}));
   if(storage.getItem(sourceKey)!==expectedRaw)throw Error('Legacy writer changed the source; conversion blocked');
   write(keys.state,target);write(keys.journal,JSON.stringify({version:1,phase:'committed',sourceHash,targetHash}));return state;
  }),
  transact:(expectedRevision,change)=>lock(async()=>{
   const state=await recover();if(!state)throw Error('Convert first');if(state.revision!==expectedRevision)throw Error('Save changed in another tab; reload before retry');
   const next=change(JSON.parse(JSON.stringify(state)));if(!O.validate(next)||next.migration.sourceHash!==state.migration.sourceHash||next.revision<state.revision)throw Error('Invalid ownership transaction');
   write(keys.state,JSON.stringify(next));return next;
  })};
}
const api={create,digest};root.LoreOwnershipStorage=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
