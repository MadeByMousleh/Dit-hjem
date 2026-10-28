import {useEffect,useMemo,useRef,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {WebView} from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import {home3dDocument,type Home3DMessage,type HomeSunState} from '../services/home-3d-document';
import type {HomeEnvironment,HomeGeometry,HomeHeights,HomeModelPhotos} from '../services/home-insights';
import {useHouseSceneInteraction} from './HouseSceneInteraction';
import type {PropertyModel} from '../services/property-model-format';
import {base64} from '../services/property-model-format';
import {gzipSync,strToU8} from 'fflate';
import type {NeighborhoodPhotoBatch} from '../services/neighborhood-photos';

export type Home3DProps={geometry:HomeGeometry;heights:HomeHeights|null;photos:HomeModelPhotos|null;neighborhoodBatch?:NeighborhoodPhotoBatch|null;imageUri:string;environment?:HomeEnvironment|null;model?:PropertyModel|null;sun:HomeSunState;onMessage:(data:Home3DMessage)=>void};
export function Home3DView({geometry,heights,photos,neighborhoodBatch=null,imageUri,environment=null,model=null,sun,onMessage}:Home3DProps){
 const interaction=useHouseSceneInteraction();
 useEffect(()=>()=>interaction(false),[interaction]);
 const ref=useRef<WebView>(null),latest=useRef(sun);latest.current=sun;
 const latestPhotos=useRef(photos);latestPhotos.current=photos;
 const batchScript=useMemo(()=>neighborhoodBatch?`window.home3d&&window.home3d.analyzeNeighborhood('${base64(gzipSync(strToU8(JSON.stringify(neighborhoodBatch)),{level:1}))}');true;`:'true;',[neighborhoodBatch]);
 const latestBatchScript=useRef(batchScript);latestBatchScript.current=batchScript;
 useEffect(()=>{ref.current?.injectJavaScript(batchScript);},[batchScript]);
 const photoScript=()=>`window.home3d&&window.home3d.setPhotos(${JSON.stringify(latestPhotos.current).replace(/</g,'\\u003c')});true;`;
 const [texture,setTexture]=useState<string|null>(model?.texture??null),[loaded,setLoaded]=useState(!!model);
 useEffect(()=>{if(model){setTexture(model.texture);setLoaded(true);return;}let active=true;setTexture(null);setLoaded(false);void(async()=>{try{if(imageUri.startsWith('file:')){const data=await FileSystem.readAsStringAsync(imageUri,{encoding:FileSystem.EncodingType.Base64});if(active)setTexture(`data:image/jpeg;base64,${data}`);}else{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(imageUri,{signal:controller.signal});if(!r.ok)throw Error();const blob=await r.blob();const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});if(active)setTexture(encoded);}finally{clearTimeout(timer);}}}catch{}finally{if(active)setLoaded(true);}})();return()=>{active=false;};},[imageUri,model]);
 const html=useMemo(()=>loaded?home3dDocument(geometry,heights,texture,latest.current,latestPhotos.current,environment,model?.scene):'', [geometry,heights,texture,loaded,environment,model]);
 const source=useMemo(()=>({html,baseUrl:'https://house-model.local/'}),[html]);
 useEffect(()=>{ref.current?.injectJavaScript(`window.home3d&&window.home3d.update(${JSON.stringify(sun)});true;`);},[sun]);
 useEffect(()=>{ref.current?.injectJavaScript(photoScript());},[photos]);
 // On Android this prop calls requestDisallowInterceptTouchEvent natively on
 // DOWN, before JS can disable the parent ScrollView. The page cannot steal a
 // vertical orbit gesture; its own scroll lock is released on UP/CANCEL.
 return <View style={s.frame} onTouchStart={()=>interaction(true)} onTouchEnd={event=>{if(!event.nativeEvent.touches.length)interaction(false);}} onTouchCancel={()=>interaction(false)}>
  {html?<WebView ref={ref} source={source} originWhitelist={['https://house-model.local']}
   javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} allowUniversalAccessFromFileURLs={false}
   mixedContentMode="never" setSupportMultipleWindows={false} scrollEnabled={false} nestedScrollEnabled overScrollMode="never" androidLayerType="hardware"
   onShouldStartLoadWithRequest={request=>request.url==='about:blank'||request.url==='https://house-model.local/'}
  onMessage={event=>{try{const data=JSON.parse(event.nativeEvent.data);if(['neighbor-colors-ready','prepared-model','ready','photo-ready','material-colors','wall-color-request','openings-ready','scene-edits','error','time','texture-unavailable','environment-unavailable','camera-mode'].includes(data.type)){if(data.type==='ready'){ref.current?.injectJavaScript(latestBatchScript.current);ref.current?.injectJavaScript(`window.home3d.update(${JSON.stringify(latest.current)});true;`);ref.current?.injectJavaScript(photoScript());}onMessage(data);}}catch{}}}
   onError={()=>{interaction(false);onMessage({type:'error'});}} onContentProcessDidTerminate={()=>{interaction(false);onMessage({type:'error'});}} onRenderProcessGone={()=>{interaction(false);onMessage({type:'error'});}} style={s.web}/>:null}
 </View>;
}
const s=StyleSheet.create({frame:{width:'100%',height:'100%',backgroundColor:'#eaf0f5'},web:{backgroundColor:'#eaf0f5'}});
