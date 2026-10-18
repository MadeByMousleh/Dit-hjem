import {fromArrayBuffer} from 'geotiff';
import {getHomeGeometry} from './home-geometry-server.mjs';
const cache=new Map();
const unavailable=()=>Object.assign(new Error('Højdedata kunne ikke hentes.'),{status:502});
export async function getHomeHeights({id},{apiKey=process.env.DATAFORDELER_API_KEY,fetcher=fetch}={}){
  if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw Object.assign(new Error('Ugyldig adresse.'),{status:400});
  if(!apiKey?.trim())throw Object.assign(new Error('Højdedata er ikke konfigureret.'),{status:503});
  const cached=cache.get(id);if(cached&&Date.now()-cached.at<86400000)return cached.value;
  const geometry=await getHomeGeometry({id},{apiKey,fetcher});
  const bbox=geometry.bbox;
  const width=Math.min(256,Math.max(32,Math.ceil((bbox[2]-bbox[0])/0.4)));
  const height=Math.min(256,Math.max(32,Math.ceil((bbox[3]-bbox[1])/0.4)));
  async function raster(coverage){
    const url=new URL('https://wcs.datafordeler.dk/DHMNedboer/dhm_wcs/1.0.0/WCS');
    url.search=new URLSearchParams({apikey:apiKey.trim(),COVERAGE:coverage,SERVICE:'WCS',REQUEST:'GetCoverage',VERSION:'1.0.0',FORMAT:'GTiff',BBOX:bbox.join(','),CRS:'EPSG:25832',RESPONSE_CRS:'EPSG:25832',WIDTH:String(width),HEIGHT:String(height)});
    const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!r.ok||!r.headers.get('content-type')?.includes('tiff'))throw unavailable();
    // Bound bytes before decoding untrusted provider imagery.
    const reader=r.body.getReader();let total=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>3000000){await reader.cancel();throw unavailable();}chunks.push(value);}
    const bytes=Buffer.concat(chunks);const tiff=await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const image=await tiff.getImage();
    if(image.getWidth()!==width||image.getHeight()!==height||image.getSamplesPerPixel()!==1)throw unavailable();
    const actual=image.getBoundingBox();if(actual.some((v,i)=>Math.abs(v-bbox[i])>0.1))throw unavailable();
    const nodata=image.getGDALNoData();const values=await image.readRasters({interleave:true});
    return Array.from(values,v=>Number.isFinite(v)&&v!==nodata&&v>=-20&&v<=400?Math.round(v*100)/100:null);
  }
  const [terrain,surface]=await Promise.all([raster('dhm_terraen'),raster('dhm_overflade')]);
  const value={addressId:id,bbox,width,height,terrain,surface,resolution:[(bbox[2]-bbox[0])/width,(bbox[3]-bbox[1])/height],source:'Danmarks Højdemodel · DHM/Terræn og DHM/Overflade · KDS · CC BY 4.0',notice:'Rasterhøjder, ikke en arkitektmodel. Træer og andre objekter kan påvirke tagformen. Optagelsesår er ikke oplyst i dette opslag.',fetchedAt:new Date().toISOString()};
  if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(id,{at:Date.now(),value});return value;
}
