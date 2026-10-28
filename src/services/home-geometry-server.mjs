import proj4 from 'proj4';
import { getBbrProperty } from './bbr-property-server.mjs';
import { findAddressSuggestionById } from './address-search.mjs';
import {getBbrRoofMaterials} from './bbr-roof-materials-server.mjs';

const utm = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
const cache = new Map();
const problem = (status=502) => Object.assign(new Error('Kortoplysninger kunne ikke hentes lige nu.'),{status});
const quote = JSON.stringify;
// Preserve interior rings (courtyards). Z is absolute survey elevation, NOT wall height.
function polygon(wkt) {
  if (typeof wkt!=='string'||wkt.length>200000||!/^POLYGON\s*(Z\s*)?\(/i.test(wkt)) return null;
  const rings=[...wkt.matchAll(/\(([^()]+)\)/g)].map(match=>match[1].split(',').map(pair=>pair.trim().split(/\s+/).map(Number).slice(0,2)));
  return rings.length&&rings.every(ring=>ring.length>=4&&ring.length<=2000&&ring.every(p=>p.length===2&&p.every(Number.isFinite)))?rings:null;
}
export async function getHomeGeometry({id,surroundings},{apiKey=process.env.DATAFORDELER_API_KEY,fetcher=fetch}={}) {
  if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw problem(400);
  if(surroundings!==undefined&&surroundings!=='1')throw problem(400);
  if(!apiKey?.trim())throw problem(503);
  const key=`${id}:${surroundings??'home'}`,saved=cache.get(key);if(saved&&Date.now()-saved.at<(saved.value.warnings.length?60000:3600000))return saved.value;
  const signal=AbortSignal.timeout(26000);
  const [property,address]=await Promise.all([getBbrProperty({id},{apiKey,fetcher}),findAddressSuggestionById(id,fetcher)]);
  const now=new Date().toISOString(),warnings=[];
  async function query(register,root,where,fields){
    const url=new URL(`https://graphql.datafordeler.dk/${register}/${register==='GEODKV'?'v2':'v3'}`);url.searchParams.set('apiKey',apiKey.trim());
    const query=`{${root}(first:100,registreringstid:${quote(now)},virkningstid:${quote(now)},where:${where}){nodes{${fields}} pageInfo{hasNextPage}}}`;
    const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query}),signal,redirect:'error'});
    const data=await response.json();if(!response.ok||data.errors?.length||!Array.isArray(data.data?.[root]?.nodes)||data.data[root].pageInfo?.hasNextPage)throw problem();
    return data.data[root].nodes;
  }
  const main=property.sections.find(s=>s.title==='Bygningen')?.records??[];
  const associated=property.sections.filter(s=>['Bygningen','Øvrige bygninger på grunden'].includes(s.title)).flatMap(s=>s.records);
  const field=(record,prefix)=>record?.fields.find(f=>f.key.startsWith(prefix))?.value;
  // Match parcel directly through the BBR building relation, including apartments.
  const parcelIds=[...new Set(main.map(r=>field(r,'jordstykke')).filter(v=>/^\d+$/.test(v??'')))];
  let parcels=[];
  if(parcelIds.length){
    const rows=await query('MAT','MAT_Jordstykke',`{id_lokalId:{in:${quote(parcelIds)}}}`,'id_lokalId registreretAreal matrikelnummer ejerlavLokalId samletFastEjendomLokalId status');
    const surfaces=await query('MAT','MAT_Lodflade',`{jordstykkeLokalId:{in:${quote(parcelIds)}}}`,'id_lokalId jordstykkeLokalId status geometri{wkt}');
    parcels=rows.filter(r=>r.status==='Gældende').map(row=>({id:row.id_lokalId,number:row.matrikelnummer,landRegistryDistrict:row.ejerlavLokalId,bfe:row.samletFastEjendomLokalId,registeredArea:Number.isSafeInteger(row.registreretAreal)?row.registreretAreal:null,polygons:surfaces.filter(s=>s.jordstykkeLokalId===row.id_lokalId&&s.status==='Gældende').map(s=>polygon(s.geometri?.wkt)).filter(Boolean)}));
  }
  const point=proj4('EPSG:4326',utm,[address.x,address.y]);
  const vertices=parcels.flatMap(p=>p.polygons.flatMap(p=>p.flat()));
  const near=vertices.filter(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<=180);
  const extent=near.length?near:[point];
  const cx=(Math.min(...extent.map(p=>p[0]))+Math.max(...extent.map(p=>p[0])))/2;
  const cy=(Math.min(...extent.map(p=>p[1]))+Math.max(...extent.map(p=>p[1])))/2;
  const homeWidth=Math.max(52,Math.max(...extent.map(p=>p[0]))-Math.min(...extent.map(p=>p[0]))+12,(Math.max(...extent.map(p=>p[1]))-Math.min(...extent.map(p=>p[1]))+12)*4/3);
  const width=surroundings==='1'?Math.min(500,Math.max(320,homeWidth*6)):homeWidth;
  const bbox=[cx-width/2,cy-width*3/8,cx+width/2,cy+width*3/8];
  const boxes=surroundings==='1'?[[bbox[0],bbox[1],cx,cy],[cx,bbox[1],bbox[2],cy],[bbox[0],cy,cx,bbox[3]],[cx,cy,bbox[2],bbox[3]]]:[bbox];
  let buildings=[];
  try{
    const ids=[...new Set(associated.flatMap(r=>[r.id.toUpperCase(),r.id.toLowerCase()]))];
    const fields='id_lokalId BBRUUID status geometri{wkt} maalestedBygning';
    const sets=await Promise.allSettled([query('GEODKV','GEODKV_Bygning',`{BBRUUID:{in:${quote(ids)}}}`,fields),...boxes.map(bounds=>{const box=`POLYGON((${bounds[0]} ${bounds[1]},${bounds[2]} ${bounds[1]},${bounds[2]} ${bounds[3]},${bounds[0]} ${bounds[3]},${bounds[0]} ${bounds[1]}))`;return query('GEODKV','GEODKV_Bygning',`{geometri:{intersects:{wkt:${quote(box)},crs:25832}}}`,fields);})]);
    if(sets.some(s=>s.status==='rejected'))warnings.push('Nogle bygningsomrids kunne ikke hentes.');
    const rows=[...new Map(sets.flatMap(s=>s.status==='fulfilled'?s.value:[]).map(r=>[r.id_lokalId,r])).values()];
    buildings=rows.filter(r=>r.status==='Anlagt').map(r=>{
      const bbr=associated.find(b=>b.id.toLowerCase()===r.BBRUUID?.toLowerCase());
      const floors=Number(field(bbr,'byg054'));
      return {id:r.id_lokalId,bbrId:r.BBRUUID,main:main.some(b=>b.id.toLowerCase()===r.BBRUUID?.toLowerCase()),associated:!!bbr,rings:polygon(r.geometri?.wkt),height:Math.max(2.5,Math.min(60,Number.isFinite(floors)&&floors>0?floors*3:3)),heightSource:bbr&&floors>0?'BBR-etager × 3 m':'Antaget 3 m',outlineSource:r.maalestedBygning};
    }).filter(b=>b.rings);
  }catch{warnings.push('Bygningsomrids kunne ikke hentes.');}
  const roofs=await getBbrRoofMaterials(buildings.map(b=>b.bbrId),{apiKey,fetcher,now}).catch(()=>({materials:{},partial:true}));
  for(const building of buildings)building.roofMaterial=roofs.materials[building.bbrId?.toLowerCase()]??null;
  if(roofs.partial)warnings.push('Nogle BBR-tagmaterialer kunne ikke hentes.');
  if(!parcels.length)warnings.push('Ingen gældende matrikelrelation fundet for bygningen.');
  if(!buildings.some(b=>b.main))warnings.push('Boligens bygning kunne ikke matches til GeoDanmark.');
  const value={roofMaterialVersion:1,addressId:id,point,bbox,longitude:address.x,latitude:address.y,parcels,buildings,fetchedAt:now,source:'Matriklen · GeoDanmark · KDS via Datafordeleren · CC BY 4.0',warnings,notice:'Registreret areal for bygningens jordstykke(r), ikke nødvendigvis hele ejendommen eller din private have. Kortets skel er vejledende. Bygningsomrids kan være målt ved taget.'};
  if(surroundings==='1')value.surroundings=true;
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),value});return value;
}

export async function getHomeOrthophoto({bbox},{token=process.env.DATAFORSYNINGEN_TOKEN||process.env.DATAFORSYNING_API_KEY,fetcher=fetch}={}) {
  const bounds=typeof bbox==='string'?bbox.split(',').map(Number):[];
  if(bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]<400000||bounds[2]>900000||bounds[1]<6000000||bounds[3]>6500000||bounds[2]-bounds[0]<10||bounds[2]-bounds[0]>500||bounds[3]-bounds[1]<10||bounds[3]-bounds[1]>500)throw problem(400);
  if(!token?.trim())throw problem(503);
  const url=new URL('https://api.dataforsyningen.dk/orto_foraar_DAF');
  url.search=new URLSearchParams({token:token.trim(),SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:'orto_foraar',STYLES:'',FORMAT:'image/jpeg',SRS:'EPSG:25832',WIDTH:'900',HEIGHT:'675',BBOX:bounds.join(',')});
  const r=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw problem();
  const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>3000000||bytes[0]!==255||bytes[1]!==216)throw problem();return bytes;
}
