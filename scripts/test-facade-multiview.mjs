import assert from 'node:assert/strict';
import {wallSegments,wallLevels,wallGrid,sweepWallPlane,registerPhotos,fuseWall,rankPhotosForWall,wallOcclusion} from '../src/services/facade-multiview.mjs';
import {GROUND,EAVES,TRUE_INSET,building,heights,windows,cameraSet} from './lib/synthetic-facade.mjs';

const segments=wallSegments([building]);
assert.equal(segments.length,4);
const south=segments.find(s=>Math.abs(s.ny+1)<1e-9);assert.ok(south,'south wall has outward normal (0,-1)');
const levels=wallLevels(south,heights);assert.ok(levels.measured);assert.ok(Math.abs(levels.ground-GROUND)<1e-6&&Math.abs(levels.eaves-EAVES)<1e-6);
const tops=new Map(segments.map(s=>[s.id,levels]));
const prepare=photos=>{for(const p of photos)p.blocked=wallOcclusion(wallGrid(south,levels,0.05),p.camera,segments,tops);return photos;};
// Dark window regions of the fused wall, compared with ground truth (inner edge of the 7 cm frame).
function windowErrors(fused,grid){
 const dark=(x,y)=>x>=0&&y>=0&&x<grid.width&&y<grid.height&&fused.rgb[(y*grid.width+x)*3]<100,errors=[];
 for(const w of windows){
  const cx=Math.round(((w.u0+w.u1)/2)/grid.res),cy=Math.round((grid.zTop-(w.z0+w.z1)/2)/grid.res);assert.ok(dark(cx,cy),'window found in fused wall');
  let minX=1e9,maxX=-1,minY=1e9,maxY=-1;const queue=[[cx,cy]],seen=new Set([cy*grid.width+cx]);
  while(queue.length){const [x,y]=queue.pop();minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=ny*grid.width+nx;if(!seen.has(key)&&dark(nx,ny)){seen.add(key);queue.push([nx,ny]);}}}
  const f={u0:minX*grid.res,u1:(maxX+1)*grid.res,z1:grid.zTop-minY*grid.res,z0:grid.zTop-(maxY+1)*grid.res},inner=0.07;
  for(const [k,exp] of [['u0',w.u0+inner],['u1',w.u1-inner],['z0',w.z0+inner],['z1',w.z1-inner]])errors.push(Math.abs(f[k]-exp));
 }
 return {max:Math.max(...errors),mean:errors.reduce((a,b)=>a+b,0)/errors.length};
}
const grid=wallGrid(south,levels,0.025);

// 1) Perfectly calibrated cameras: plane sweep recovers the real wall plane and windows land within a few cm.
{
 const photos=prepare(cameraSet(0)),ranked=rankPhotosForWall(south,levels,photos);assert.equal(ranked.length,photos.length);
 const sweep=sweepWallPlane(south,levels,photos);
 assert.ok(Math.abs(sweep.d-TRUE_INSET)<0.1,`plane sweep found ${sweep.d}, expected ${TRUE_INSET}`);assert.ok(sweep.confidence>0.2);
 const e=windowErrors(fuseWall(grid,photos,sweep.d,registerPhotos(wallGrid(south,levels,0.05),photos,sweep.d)),grid);
 console.log(JSON.stringify({case:'exact',d:+sweep.d.toFixed(3),meanErrorM:+e.mean.toFixed(3),maxErrorM:+e.max.toFixed(3)}));
 assert.ok(e.max<0.08,`exact cameras: max error ${e.max}`);
}
// 2) Realistic calibration error (10-20 cm): the sweep is not trusted, but fusion at the overhang prior still finds every window.
{
 const photos=prepare(cameraSet(1)),prior=0.4;
 const e=windowErrors(fuseWall(grid,photos,prior,registerPhotos(wallGrid(south,levels,0.05),photos,prior)),grid);
 console.log(JSON.stringify({case:'calibration error',d:prior,meanErrorM:+e.mean.toFixed(3),maxErrorM:+e.max.toFixed(3)}));
 assert.ok(e.max<0.4,`calibration error case: max error ${e.max}`);
}
console.log('facade multiview synthetic checks passed');
