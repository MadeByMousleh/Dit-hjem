import {getHomeGeometry} from './home-geometry-server.mjs';
const base='https://api.datafordeler.dk/FileDownloads/v1.0/';
const fail=(code,status=502)=>Object.assign(Error(code),{code,status});
export async function getHomeLidarFiles({id},{apiKey=process.env.DATAFORDELER_API_KEY,fetcher=fetch}={}){
 if(!apiKey?.trim())throw fail('LIDAR_NOT_CONFIGURED',503);
 const geometry=await getHomeGeometry({id},{apiKey,fetcher}),bbox=geometry.bbox,files=[];let pages=1;
 for(let page=1;page<=pages;page++){
  const url=new URL('GetAvailablePointCloudFileDownloads',base);url.search=new URLSearchParams({apiKey:apiKey.trim(),Register:'DHM',Version:'1',MinX:String(bbox[0]),MinY:String(bbox[1]),MaxX:String(bbox[2]),MaxY:String(bbox[3]),PageNumber:String(page)});
  const r=await fetcher(url,{signal:AbortSignal.timeout(25000),redirect:'error'});if(!r.ok)throw fail('LIDAR_CATALOG_UNAVAILABLE',r.status===403?403:502);
  const data=await r.json();pages=data.paginationMetadata?.totalPages;
  if(!Number.isInteger(pages)||pages<1||pages>10||!Array.isArray(data.availableFileDownloads))throw fail('LIDAR_CATALOG_INVALID');
  for(const f of data.availableFileDownloads){const b=f.boundingBox;
   if(!/^[a-f0-9-]{36}$/i.test(f.id??'')||!['laz','las'].includes(f.fileFormat)||!Number.isSafeInteger(f.fileSizeInBytes)||f.fileSizeInBytes<=0||![b?.minX,b?.minY,b?.maxX,b?.maxY].every(Number.isFinite))throw fail('LIDAR_FILE_INVALID');
   files.push({id:f.id,format:f.fileFormat,dataset:f.dataSetName,delivery:f.dataDeliveryNumber,bytes:f.fileSizeInBytes,generationTime:f.generationTime,bbox:[b.minX,b.minY,b.maxX,b.maxY]});
  }
 }
 const candidates=files.filter(f=>f.dataset==='Punktsky'&&f.format==='laz').sort((a,b)=>b.delivery-a.delivery);
 if(!candidates.length)throw fail('LIDAR_CURRENT_DATA_MISSING',404);
 return {addressId:id,bbox,buildings:geometry.buildings.filter(b=>b.main||b.associated),files,selected:candidates[0],acquisitionDate:null,notice:'Dataleverance og filgenerering er ikke opmålingsdato. Tagomrids og punkternes koordinatsystem skal kontrolleres før rekonstruktion.'};
}
export function lidarDownloadUrl(fileId,apiKey){
 if(!/^[a-f0-9-]{36}$/i.test(fileId??'')||!apiKey?.trim())throw fail('LIDAR_DOWNLOAD_INVALID',400);
 const url=new URL('GetPointCloudFile',base);url.search=new URLSearchParams({Id:fileId,apiKey:apiKey.trim()});return url;
}
