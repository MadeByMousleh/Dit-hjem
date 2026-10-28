export function validatePointSelection(value,house){
 if(!house?.ready||value.sourceHash!==house.sourceHash||!['hedge','not_hedge'].includes(value.kind)||!Array.isArray(value.indices)||value.indices.length<8||value.indices.length>50000)throw Error('Vælg mindst 8 vegetationspunkter på dette hus');
 if(value.id!==undefined&&!/^selection-[a-f0-9-]{36}$/i.test(value.id))throw Error('Ugyldig markering');
 const seen=new Set();
 for(const index of value.indices){if(!Number.isInteger(index)||index<0||index>=house.source.points.length||seen.has(index)||![3,4,5].includes(house.source.points[index][3]))throw Error('Markeringen indeholder ugyldige punkter');seen.add(index);}
 return [...seen].sort((a,b)=>a-b);
}
// A later explicit brush save wins on overlapping points. Points that nobody
// painted have no class. Old candidate boxes never participate in this mask.
export function resolvePointSelections(records=[]){
 const ordered=records.filter(r=>['hedge','not_hedge'].includes(r.kind)).map((r,i)=>({r,i})).sort((a,b)=>String(a.r.at??'').localeCompare(String(b.r.at??''))||a.i-b.i),owner=new Map();
 for(const {r}of ordered)for(const index of r.indices)owner.set(index,r.id);
 return ordered.map(({r})=>({...r,indices:r.indices.filter(index=>owner.get(index)===r.id)}));
}
