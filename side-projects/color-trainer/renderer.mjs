import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

// Build a local adapter around the existing renderer. No production renderer edits.
export async function buildRenderer(){
  const result=await build({entryPoints:['src/web/home3d.ts'],bundle:true,format:'iife',write:false,plugins:[{name:'local-color-trainer',setup(builder){
    builder.onLoad({filter:/web[/\\]facade-wall-masks\.ts$/},async args=>{
      let contents=await readFile(args.path,'utf8');
      // Production now uses the same strict masks. Keep the trainer payload
      // compact without eroding those masks a second time.
      if(contents.includes('samplingVersion:2'))return {contents:contents.replace("contextImage:photo.image.split(',')[1]!,",'').replace('retained=quality.indices;if(!quality.accepted)continue;','retained=quality.accepted?quality.indices:rawRetained;if(!retained.length)continue;').replace('quality:{accepted:true,margin:quality.margin}','quality:{accepted:quality.accepted,reason:quality.reason,margin:quality.margin}'),loader:'ts'};
      const replace=(needle,value)=>{if(!contents.includes(needle))throw Error('Facadeadapteren skal opdateres.');contents=contents.replace(needle,value);};
      contents=`import {conservativeInterior,runsFor,photoKey} from '../../side-projects/color-trainer/sampling.mjs';\n`+contents;
      replace('min.y+.35;high=geometry.boundingBox!.max.y-.6','min.y+.45;high=geometry.boundingBox!.max.y-.8');
      replace('normalize()))<.3','normalize()))<.45');
      replace('for(const [id,retained]of buckets){if(retained.length<45)continue;',`for(const [id,rawRetained]of buckets){
        const quality=conservativeInterior(rawRetained,w,h);
        const retained=quality.accepted?quality.indices:rawRetained;
        if(!retained.length)continue;`);
      replace('pixels:retained.length,width,height,image:',`samplingVersion:2,quality:{accepted:quality.accepted,reason:quality.reason,margin:quality.margin},photoKey:photoKey(photo),maskRuns:runsFor(retained.map(i=>(Math.floor(i/w)-top)*width+i%w-left)),pixels:retained.length,width,height,image:`);
      replace("contextImage:photo.image.split(',')[1]!,",'');
      return {contents,loader:'ts'};
    });
    builder.onLoad({filter:/web[/\\]projected-photos\.ts$/},async args=>{
      const contents=(await readFile(args.path,'utf8')).replace('void setPhotos(data).catch(()=>{','void setPhotos(data).catch((error)=>{console.error("Trainer photo analysis",error);window.parent.postMessage({home3d:{type:"error",reason:"photo-analysis"}},location.origin);');
      return {contents,loader:'ts'};
    });
    builder.onLoad({filter:/web[/\\]home3d\.ts$/},async args=>{
      let contents=await readFile(args.path,'utf8');
      const replace=(needle,value)=>{if(!contents.includes(needle))throw Error('3D-adapteren skal opdateres til den nye renderer.');contents=contents.replace(needle,value);};
      // The trainer uses the GPU wall masks below. The general roof/facade
      // estimator raycasts every neighbouring roof and is unnecessary here.
      replace('result=await estimatePhotoColors(items,buildingRenderMeshes,allMeshes,cx,cy,origin,alive);','result={};');
      replace('analysisFinished=true;exportPrepared();',`analysisFinished=true;
        send({type:'trainer-patches',patches:wallPatches.filter(p=>g.buildings.some(b=>b.main&&b.id===p.buildingId)).slice(0,18),colors:materialColors});
        exportPrepared();`);
      replace('const openingPixels=new Map',`
        window.addEventListener('message',event=>{
          if(event.source!==window.parent||event.data?.type!=='trainer-colors')return;
          if(/^#[0-9a-f]{6}$/i.test(event.data.houseColor)){
            for(const main of g.buildings.filter(b=>b.main)){
              const building=materialColors[main.id]??={};
              building.walls={...(building.walls??{samples:0,views:1,confidence:'low',years:[]}),color:event.data.houseColor,uniform:true,faces:undefined};
            }
            // A labeling preview must show the chosen sRGB value rather than
            // darken it through the production scene's simulated illumination.
            // Keep the roof, neighbours and photo-analysis passes unchanged.
            const mainIds=new Set(g.buildings.filter(b=>b.main).map(b=>b.id));
            for(const mesh of buildingRenderMeshes){
              const surface=mesh.userData.houseSurface;
              if(surface?.kind!=='walls'||!mainIds.has(surface.id)||mesh.material instanceof THREE.MeshBasicMaterial)continue;
              const previous=mesh.material as THREE.MeshStandardMaterial;
              mesh.material=new THREE.MeshBasicMaterial({color:previous.color,vertexColors:previous.vertexColors,side:previous.side,toneMapped:false});
              previous.dispose();
            }
          }
          for(const item of event.data.colors??[]){
            if(!/^#[0-9a-f]{6}$/i.test(item.hex))continue;
            const patch=wallPatches.find(p=>p.faceId===item.faceId);
            if(!patch)continue;
            const building=materialColors[patch.buildingId]??={};
            const walls=building.walls??{color:item.hex,uniform:false,faces:{},samples:0,views:1,confidence:'low',years:[]};
            building.walls={...walls,uniform:false,faces:{...walls.faces,[item.faceId]:item.hex}};
          }
          dirty=true;
        });
        let clickStart=[0,0];
        renderer.domElement.addEventListener('pointerdown',e=>{clickStart=[e.clientX,e.clientY];});
        renderer.domElement.addEventListener('pointerup',e=>{
          if(Math.hypot(e.clientX-clickStart[0],e.clientY-clickStart[1])>5)return;
          const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
          ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
          const hit=ray.intersectObjects(buildingRenderMeshes,false)[0];
          if(hit&&hit.object.userData.houseSurface?.kind==='walls'&&hit.faceIndex!=null)
            send({type:'trainer-select',faceId:wallFaceKey(hit.object as THREE.Mesh,hit.faceIndex)});
        });
        const openingPixels=new Map`);
      return {contents,loader:'ts'};
    });
  }}]});
  return result.outputFiles[0].text;
}
