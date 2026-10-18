import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Vector3} from 'three';
import {projectPhoto,photoCrop,photoCalibration} from '../src/services/home-photo-projection.mjs';
const compiled=await build({entryPoints:['src/web/projected-photos.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {calibratedPhotoCamera}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const angle=0.6,c=Math.cos(angle),s=Math.sin(angle);
const source={center:[552900,6086900,1000],rotation:[1,0,0,0,c,s,0,-s,c],sensor:[10000,8000],focal:[11000,11080],principal:[5012,3991],crop:[2000,1000,8000,7000]};
const camera=calibratedPhotoCamera({camera:source},552870,6086870,7.6);camera.updateMatrixWorld(true);
let checked=0;
for(const x of [552860,552870,552880])for(const y of [6086860,6086870,6086880])for(const z of [7.6,11,14]){
 const actual=projectPhoto(source,[x,y,z]);assert.ok(actual);
 const clip=new Vector3(x-552870,z-7.6,6086870-y).project(camera);
 const [l,t,r,b]=source.crop;const px=l+(clip.x+1)/2*(r-l),py=t+(1-clip.y)/2*(b-t);
 assert.ok(Math.abs(px-actual[0])<1e-6&&Math.abs(py-actual[1])<1e-6);checked++;
}
assert.equal(projectPhoto(source,[552900,6086900,1100]),null);
assert.throws(()=>photoCalibration({}));assert.equal(photoCrop(source,[[552900,6086900,1100]]),null);
console.log(`PASS: calibrated WebGL camera matches original sensor projection at ${checked} 3D points; invalid/behind-camera inputs rejected.`);
