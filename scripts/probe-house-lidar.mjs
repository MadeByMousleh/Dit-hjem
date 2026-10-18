import dotenv from 'dotenv';
import {mkdir,writeFile,stat,open} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {getHomeLidarFiles,lidarDownloadUrl} from '../src/services/home-lidar-server.mjs';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const id=process.argv.find(a=>/^--id=/.test(a))?.slice(5)||'0a3f50b7-b15d-32b8-e044-0003ba298018';
const dir='.tmp/lidar-reference';await mkdir(dir,{recursive:true});
const result=await getHomeLidarFiles({id});await writeFile(`${dir}/catalog.json`,JSON.stringify(result,null,2));
await writeFile(`${dir}/roofprints.geojson`,JSON.stringify({type:'FeatureCollection',crs:{type:'name',properties:{name:'urn:ogc:def:crs:EPSG::25832'}},features:result.buildings.map(b=>({type:'Feature',properties:{id:b.id},geometry:{type:'Polygon',coordinates:b.rings}}))}));
console.log(JSON.stringify({selected:result.selected,alternatives:result.files.length,acquisitionDateVerified:false}));
if(process.argv.includes('--download')){
 const file=result.selected,target=`${dir}/${file.id}.laz`;
 if(file.bytes>600*1024*1024)throw Error('Tile exceeds the trial download limit');
 const existing=await stat(target).catch(()=>null);
 if(existing?.size!==file.bytes){
  const r=await fetch(lidarDownloadUrl(file.id,process.env.DATAFORDELER_API_KEY),{signal:AbortSignal.timeout(180000),redirect:'error'});if(!r.ok)throw Error(`LiDAR download HTTP ${r.status}`);
  let total=0,last=0;await pipeline(Readable.fromWeb(r.body),new Transform({transform(chunk,encoding,done){total+=chunk.length;if(total>file.bytes+1024)return done(Error('Unexpected download size'));if(total-last>50*1024*1024){console.log(JSON.stringify({downloadedMiB:Math.floor(total/1048576)}));last=total;}done(null,chunk);}}),createWriteStream(target));if(total!==file.bytes)throw Error('LiDAR download incomplete');
 }
 const handle=await open(target,'r'),header=Buffer.alloc(375);await handle.read(header,0,375,0);await handle.close();if(header.toString('ascii',0,4)!=='LASF')throw Error('Not a LAS/LAZ file');
 const version=`${header[24]}.${header[25]}`,pointCount=header.readUInt32LE(107)||Number(header.readBigUInt64LE(247));
 const metadata={file:target,bytes:file.bytes,version,pointFormat:header[104]&63,compressed:!!(header[104]&128),pointCount,pointRecordLength:header.readUInt16LE(105),pointOffset:header.readUInt32LE(96),vlrCount:header.readUInt32LE(100),scale:[131,139,147].map(p=>header.readDoubleLE(p)),bbox:[187,203,219,179,195,211].map(p=>header.readDoubleLE(p)),creationYear:header.readUInt16LE(92),creationDay:header.readUInt16LE(90),notice:'LAS creation date is not independently verified acquisition date.'};
 await writeFile(`${dir}/las-header.json`,JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata));
}
