import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
// stdout is generated module source; run through the repo edit workflow to save.
const built=await build({stdin:{contents:"export {vegetationCandidates} from './src/services/home-vegetation';export {getParcelLidarModel,sampleParcelGround} from './src/utils/homeLidarModel';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {vegetationCandidates,getParcelLidarModel,sampleParcelGround}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const g=JSON.parse(await readFile('.tmp/lidar-parcel/geometry.json','utf8')),parcel=getParcelLidarModel(g);if(!parcel)throw Error('Parcel source does not match current geometry');
const candidates=vegetationCandidates(parcel.points,(x,y)=>sampleParcelGround(parcel,x,y)),sourceHash=createHash('sha256').update(JSON.stringify({points:parcel.points,polygons:parcel.polygons})).digest('hex');
console.log(JSON.stringify({addressId:g.addressId,bbox:g.bbox,sourceHash,crs:'EPSG:7416',candidates}));
