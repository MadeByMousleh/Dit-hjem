import assert from 'node:assert/strict';import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/neighborhood-photos.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const API_URL='https://synthetic.invalid'"}));}}]});
const {loadNeighborhoodPhotoPlan,loadNeighborhoodPhotoTile}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const original=globalThis.fetch,id='fixture',signal=new AbortController().signal;let body;
try{
 globalThis.fetch=async url=>{assert.ok(url.includes('neighbors=1'));return {ok:true,json:async()=>body};};
 body={addressId:id,photos:[]};await assert.rejects(loadNeighborhoodPhotoPlan(id,signal),/serveren/);
 body={addressId:id,photos:[],neighborhood:{version:1,bbox:[0,0,320,320],tiles:[{id:'0-0',buildingIds:['neighbor']}]}};assert.equal((await loadNeighborhoodPhotoPlan(id,signal)).tiles.length,1);
 body.neighborhood.tiles[0].id='invalid';await assert.rejects(loadNeighborhoodPhotoPlan(id,signal),/Ugyldig/);
 body={addressId:id,photos:[],neighborhood:{version:1,tile:'0-0'}};assert.deepEqual(await loadNeighborhoodPhotoTile(id,'0-0',signal),[]);
 body.photos=[{direction:'south',image:'https://untrusted.invalid/image'}];await assert.rejects(loadNeighborhoodPhotoTile(id,'0-0',signal),/Ugyldige/);
 console.log('PASS old-backend rejection, bounded tile plan, tile identity, no remote image URLs');
}finally{globalThis.fetch=original;}
