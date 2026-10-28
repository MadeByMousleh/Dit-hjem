import {useCallback,useEffect,useRef,useState} from 'react';
import {loadNeighborhoodPhotoPlan,loadNeighborhoodPhotoTile,type NeighborhoodPhotoBatch} from '../services/neighborhood-photos';
import type {Home3DMessage} from '../services/home-3d-document';

// Backpressure keeps only one tile's images in memory and waits for the renderer
// before fetching the next. The final ACK follows the final prepared-model event.
export function useNeighborhoodColors(addressId:string,enabled:boolean,saved:boolean){
 const [batch,setBatch]=useState<NeighborhoodPhotoBatch|null>(null),[ready,setReady]=useState(saved),[status,setStatus]=useState('');
 const pending=useRef<{id:string;finish:(error?:string)=>void}|null>(null);
 const receive=useCallback((message:Home3DMessage)=>{const wait=pending.current;if(message.type==='neighbor-colors-ready'&&wait&&wait.id===message.requestId)wait.finish(message.error);},[]);
 useEffect(()=>{
  if(saved||!enabled)return;
  let alive=true;const controller=new AbortController();setReady(false);
  const deliver=(value:NeighborhoodPhotoBatch)=>new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>finish('Naboanalysen tog for lang tid.'),90000);
   const finish=(error?:string)=>{clearTimeout(timer);pending.current=null;error?reject(Error(error)):resolve();};
   pending.current={id:value.requestId,finish};setBatch(value);
  });
  void(async()=>{
   try{
    setStatus('Finder facadefotos af nabohusene…');
    const plan=await loadNeighborhoodPhotoPlan(addressId,controller.signal);if(!alive)return;
    let completedTiles=0,failedTiles=0;
    for(const [index,tile]of plan.tiles.entries()){
     if(!alive)return;setStatus(`Analyserer nabofacader · område ${index+1} af ${plan.tiles.length}`);
     try{
      const photos=await loadNeighborhoodPhotoTile(addressId,tile.id,controller.signal);if(!alive)return;
      if(photos.length<2)throw Error('For få facadefotos.');
      await deliver({addressId,requestId:`neighbors-${Date.now()}-${index}`,photos,buildingIds:tile.buildingIds});completedTiles++;
     }catch(error){if(!alive)return;failedTiles++;}
    }
    if(plan.tiles.length)await deliver({addressId,requestId:`neighbors-${Date.now()}-complete`,photos:[],buildingIds:[],complete:true,coverage:{version:1,totalTiles:plan.tiles.length,completedTiles,failedTiles}});
    if(alive)setStatus(failedTiles?`Nabofacader: ${failedTiles} af ${plan.tiles.length} områder mangler brugbare billeder.`:'');
   }catch(error){if(alive)setStatus(error instanceof Error?error.message:'Nabofacader kunne ikke analyseres.');}
   finally{if(alive){setBatch(null);setReady(true);}}
  })();
  return()=>{alive=false;controller.abort();pending.current?.finish('Analysen blev afbrudt.');};
 },[addressId,enabled,saved]);
 return {batch,ready,status,receive};
}
