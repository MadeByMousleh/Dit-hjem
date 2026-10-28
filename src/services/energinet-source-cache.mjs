import {randomUUID,createHash} from 'node:crypto';
const pending=new Map();
// Distributed lease prevents cold instances from repeating the same upstream call.
// A failed fetch retains the previous archive and the lease cooldown; no fake prices.
export async function cachedEnergySource({admin,key,after,load,now=Date.now()}){
 const existing=pending.get(key);if(existing)return existing;
 const task=(async()=>{
  const read=async()=>{const r=await admin.from('public_energy_source_cache').select('payload,fetched_at').eq('cache_key',key).maybeSingle();if(r.error)throw Error('Prisdatabasen er ikke klargjort.');return r.data;};
  let row=await read();if(row?.payload&&Date.parse(row.fetched_at)>=after)return row.payload;
  const lease=randomUUID(),claim=await admin.rpc('claim_public_energy_refresh',{p_key:key,p_lease:lease,p_after:new Date(Math.min(after,now)).toISOString()});
  if(claim.error)throw Error('Prisdata kunne ikke låses til opdatering.');
  if(!claim.data){
   // Bound the wait inside this request; clients can retry after the other refresh.
   for(let i=0;i<8;i++){await new Promise(resolve=>setTimeout(resolve,250));row=await read();if(row?.payload&&Date.parse(row.fetched_at)>=after)return row.payload;}
   throw Object.assign(Error('Priserne opdateres. Prøv igen om lidt.'),{status:503});
  }
  const payload=await load();
  const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const saved=await admin.rpc('finish_public_energy_refresh',{p_key:key,p_lease:lease,p_hash:hash,p_payload:payload});
  if(saved.error||saved.data!==true)throw Error('Prisdata kunne ikke gemmes.');return payload;
 })().finally(()=>pending.delete(key));pending.set(key,task);return task;
}
