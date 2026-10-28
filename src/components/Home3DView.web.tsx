import {createElement,useEffect,useMemo,useRef,useState} from 'react';
import {home3dDocument} from '../services/home-3d-document';
import type {Home3DProps} from './Home3DView';
export function Home3DView({geometry,heights,photos,neighborhoodBatch=null,imageUri,environment=null,model=null,sun,onMessage}:Home3DProps){
 const ref=useRef<HTMLIFrameElement>(null),latest=useRef(sun);latest.current=sun;
 const latestBatch=useRef(neighborhoodBatch);latestBatch.current=neighborhoodBatch;
 useEffect(()=>{if(neighborhoodBatch)ref.current?.contentWindow?.postMessage({type:'home3d-neighborhood',batch:neighborhoodBatch},'*');},[neighborhoodBatch]);
 const latestPhotos=useRef(photos);latestPhotos.current=photos;
 const [texture,setTexture]=useState<string|null>(model?.texture??null),[loaded,setLoaded]=useState(!!model);
 useEffect(()=>{if(model){setTexture(model.texture);setLoaded(true);return;}let active=true;const controller=new AbortController();setLoaded(false);void(async()=>{try{const r=await fetch(imageUri,{signal:controller.signal});if(!r.ok)throw Error();const blob=await r.blob();const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});if(active)setTexture(encoded);}catch{if(active)setTexture(null);}finally{if(active)setLoaded(true);}})();return()=>{active=false;controller.abort();};},[imageUri,model]);
 // Sandboxed local engine; all imagery is passed as data, no remote scripts.
 const html=useMemo(()=>loaded?home3dDocument(geometry,heights,texture,latest.current,latestPhotos.current,environment,model?.scene):'', [geometry,heights,texture,loaded,environment,model]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==ref.current?.contentWindow||!event.data?.home3d)return;const data=event.data.home3d;if(['neighbor-colors-ready','prepared-model','ready','photo-ready','material-colors','wall-color-request','openings-ready','scene-edits','error','time','texture-unavailable','environment-unavailable','camera-mode'].includes(data.type)){if(data.type==='ready'){if(latestBatch.current)ref.current?.contentWindow?.postMessage({type:'home3d-neighborhood',batch:latestBatch.current},'*');ref.current?.contentWindow?.postMessage({type:'home3d-state',state:latest.current},'*');ref.current?.contentWindow?.postMessage({type:'home3d-photos',photos:latestPhotos.current},'*');}onMessage(data);}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[onMessage]);
 useEffect(()=>{ref.current?.contentWindow?.postMessage({type:'home3d-state',state:sun},'*');},[sun]);
 useEffect(()=>{ref.current?.contentWindow?.postMessage({type:'home3d-photos',photos},'*');},[photos]);
 return createElement('iframe',{ref,srcDoc:html,title:'Interaktiv 3D-model af huset og solen',sandbox:'allow-scripts',style:{border:0,width:'100%',height:'100%',display:'block',touchAction:'none',overscrollBehavior:'none'}});
}
