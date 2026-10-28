// Read-only imagery/geometry fixture; writes only ignored .tmp data, never labels.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {getHomeGeometry} from '../src/services/home-geometry-server.mjs';
import {getHomeHeights} from '../src/services/home-height-server.mjs';
import {getHomeModelPhotos} from '../src/services/home-model-photos-server.mjs';
import {getNeighborhoodModelPhotos} from '../src/services/home-neighborhood-photos-server.mjs';
const bundled=await readFile('src/generated/home-environment.ts','utf8');
const id=process.argv[2]??JSON.parse(bundled.slice(bundled.indexOf('=')+1).trim().replace(/;$/,'')).geometry.addressId;
const dir='.tmp/neighborhood-color';await mkdir(dir,{recursive:true});
const [geometry,heights,photos,wide,wideHeights,plan]=await Promise.all([
 getHomeGeometry({id}),getHomeHeights({id}),getHomeModelPhotos({id}),getHomeGeometry({id,surroundings:'1'}),getHomeHeights({id,surroundings:'1'}),getNeighborhoodModelPhotos({id}),
]);
const config={geometry,heights,photos,environment:{geometry:wide,heights:wideHeights,texture:null},sun:{minute:720,active:true,playing:false,live:false,vectors:Array.from({length:97},()=>[0,1,0]),photoColors:true,photographic:false}};
await writeFile(dir+'/config.json',JSON.stringify(config));await writeFile(dir+'/plan.json',JSON.stringify(plan));
const cx=(geometry.bbox[0]+geometry.bbox[2])/2,cy=(geometry.bbox[1]+geometry.bbox[3])/2;
const distance=tile=>{const [x,y]=tile.id.split('-').map(Number);return Math.hypot(plan.neighborhood.bbox[0]+x*70+35-cx,plan.neighborhood.bbox[1]+y*70+35-cy);};
for(const tile of [...plan.neighborhood.tiles].sort((a,b)=>distance(a)-distance(b)).slice(0,2)){
 const value=await getNeighborhoodModelPhotos({id,tile:tile.id});await writeFile(`${dir}/tile-${tile.id}.json`,JSON.stringify(value));
 console.log(JSON.stringify({tile:tile.id,buildings:tile.buildingIds.length,photos:value.photos.length,status:value.status}));
}
