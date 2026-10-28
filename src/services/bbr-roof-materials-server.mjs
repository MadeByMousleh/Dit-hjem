import {roofMaterial} from './roof-materials.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const cache=new Map();
export async function getBbrRoofMaterials(ids,{apiKey=process.env.DATAFORDELER_API_KEY,fetcher=fetch,now=new Date().toISOString()}={}){
 if(!apiKey?.trim())throw Error('BBR roof access unavailable');
 const wanted=[...new Set(ids.filter(uuid).map(id=>id.toLowerCase()))];if(wanted.length>600)throw Error('Too many roof records');
 const result={},missing=[];for(const id of wanted){const entry=cache.get(id);if(entry&&Date.now()-entry.at<3600000)result[id]=entry.value;else missing.push(id);}
 const chunks=[];for(let i=0;i<missing.length;i+=50)chunks.push(missing.slice(i,i+50));
 let partial=false;
 for(let offset=0;offset<chunks.length;offset+=3)await Promise.all(chunks.slice(offset,offset+3).map(async chunk=>{
  try{
   const url=new URL('https://graphql.datafordeler.dk/BBR/v3');url.searchParams.set('apiKey',apiKey.trim());
   const query=`{BBR_Bygning(first:100,registreringstid:${JSON.stringify(now)},virkningstid:${JSON.stringify(now)},where:{id_lokalId:{in:${JSON.stringify(chunk)}}}){nodes{id_lokalId status byg033Tagdaekningsmateriale byg035SupplerendeTagdaekningsMateriale} pageInfo{hasNextPage}}}`;
   const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(12000),redirect:'error'}),data=await response.json(),connection=data.data?.BBR_Bygning;
   if(!response.ok||data.errors?.length||!Array.isArray(connection?.nodes)||connection.pageInfo?.hasNextPage)throw Error('Invalid roof response');
   for(const id of chunk){
    const rows=connection.nodes.filter(r=>r.id_lokalId?.toLowerCase()===id&&String(r.status)==='6');
    // Ambiguous or inactive records never borrow a different building's roof.
    const value=rows.length===1?roofMaterial(rows[0].byg033Tagdaekningsmateriale,rows[0].byg035SupplerendeTagdaekningsMateriale):null;
    result[id]=value;if(cache.size>=2000)cache.delete(cache.keys().next().value);cache.set(id,{at:Date.now(),value});
   }
  }catch{partial=true;}
 }));
 return {materials:result,partial};
}
