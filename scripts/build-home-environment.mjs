import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

const compiled=await build({entryPoints:['src/generated/lidar-models.ts'],bundle:true,write:false,format:'esm'});
const {lidarModels}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const addresses=[...new Set(Object.values(lidarModels).map(model=>model.addressId))];
assert.equal(addresses.length,1,'Expected exactly one bundled model address');
const request=async params=>{
 const response=await fetch('https://dit-hjem-five.vercel.app/api/address/search?'+new URLSearchParams(params),{signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200,params.mode+' response');return response;
};
const geometry=await(await request({mode:'geometry',id:addresses[0],surroundings:'1'})).json();
const heights=await(await request({mode:'height',id:addresses[0],surroundings:'1'})).json();
assert.equal(geometry.surroundings,true);assert.deepEqual(heights.bbox,geometry.bbox);
const response=await request({mode:'orthophoto',bbox:geometry.bbox.join(',')});
assert.match(response.headers.get('content-type'),/^image\/jpeg/);
const image=Buffer.from(await response.arrayBuffer());assert.ok(image.length>1000&&image.length<3000000);
const environment={geometry,heights,texture:'data:image/jpeg;base64,'+image.toString('base64'),textureSource:'KDS / GeoDanmark',status:'Viser medfølgende kortudsnit',retrievedAt:new Date().toISOString()};
await writeFile('src/generated/home-environment.ts','export const bundledEnvironment='+JSON.stringify(environment)+';\n');
console.log('Bundled verified environment: '+geometry.buildings.length+' buildings, '+heights.terrain.length+' height samples, '+image.length+' image bytes.');