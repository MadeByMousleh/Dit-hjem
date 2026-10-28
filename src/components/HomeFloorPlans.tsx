import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {ConfirmDialog} from './ConfirmDialog';
import {AppModal} from './AppModal';
import {ZoomImage} from './ZoomImage';
import {LoadingState} from './LoadingState';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEffect,useState} from 'react';
import {ActivityIndicator,Image,Platform,StyleSheet,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {randomUUID} from 'expo-crypto';
import {base64,unbase64} from '../services/property-model-format';
import {propertyDocuments,type PropertyDocument} from '../services/property-documents';
import {colors} from '../styles/theme';

export function HomeFloorPlans({householdId,addressId}:{householdId:string;addressId:string}){
 const insets=useSafeAreaInsets();
 const [operation,setOperation]=useState<'upload'|'open'|'delete'|null>(null),[activeDocument,setActiveDocument]=useState('');
 const [documents,setDocuments]=useState<PropertyDocument[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[preview,setPreview]=useState<PropertyDocument|null>(null),[deleting,setDeleting]=useState<string|null>(null),[available,setAvailable]=useState(false);
 useEffect(()=>{let alive=true;const controller=new AbortController();setLoading(true);setError('');setAvailable(false);void propertyDocuments(householdId,addressId,'list',{},controller.signal).then(value=>{if(alive){setDocuments(value.documents??[]);setAvailable(true);}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;controller.abort();};},[householdId,addressId,revision]);
 async function upload(){
  if(busy)return;setBusy(true);setOperation('upload');setError('');let temporary:string|undefined,webUri:string|undefined;
  try{
   const result=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/jpeg','image/png'],copyToCacheDirectory:true,multiple:false,base64:false});if(result.canceled)return;
   const asset=result.assets[0];if(!asset)throw Error('Ingen fil valgt.');
   if(Platform.OS==='web'&&asset.uri.startsWith('blob:'))webUri=asset.uri;
   if(Platform.OS!=='web'&&FileSystem.cacheDirectory&&asset.uri.startsWith(FileSystem.cacheDirectory))temporary=asset.uri;
   const info=asset.size===undefined&&Platform.OS!=='web'?await FileSystem.getInfoAsync(asset.uri):null,size=asset.size??(info?.exists?info.size:undefined);
   if(!size||size>2097152)throw Error('Vælg en PDF, JPG eller PNG på højst 2 MB.');
   const mime=asset.mimeType&&['application/pdf','image/jpeg','image/png'].includes(asset.mimeType)?asset.mimeType:/\.pdf$/i.test(asset.name)?'application/pdf':/\.png$/i.test(asset.name)?'image/png':/\.jpe?g$/i.test(asset.name)?'image/jpeg':'';
   if(!['application/pdf','image/jpeg','image/png'].includes(mime))throw Error('Vælg en PDF, JPG eller PNG.');
   let payload:string;
   if(Platform.OS==='web'){const blob=asset.file??await fetch(asset.uri).then(r=>r.blob());if(!blob)throw Error('Filen kunne ikke læses.');payload=base64(new Uint8Array(await blob.arrayBuffer()));}
   else payload=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.Base64});
   const id=randomUUID(),name=(asset.name??'Plantegning').replace(/[\x00-\x1f/\\]/g,'_').slice(0,120)||'Plantegning';
   await propertyDocuments(householdId,addressId,'save',{id,name,mime,payload,expectedRevision:0});setRevision(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:'Plantegningen kunne ikke gemmes.');}
  finally{if(temporary)await FileSystem.deleteAsync(temporary,{idempotent:true}).catch(()=>{});if(webUri)URL.revokeObjectURL(webUri);setBusy(false);setOperation(null);}
 }
 async function open(document:PropertyDocument){
  setBusy(true);setOperation('open');setActiveDocument(document.id);setError('');let uri:string|undefined;
  try{
   const result=await propertyDocuments(householdId,addressId,'read',{id:document.id}),file=result.document;if(!file?.payload)throw Error('Plantegningen kunne ikke åbnes.');
   if(file.mime!=='application/pdf'){setPreview(file);return;}
   if(Platform.OS==='web'){
    const bytes=unbase64(file.payload),blob=new Blob([bytes.buffer as ArrayBuffer],{type:file.mime}),url=URL.createObjectURL(blob),link=globalThis.document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   }else{
    if(!await Sharing.isAvailableAsync()||!FileSystem.cacheDirectory)throw Error('PDF kan ikke åbnes på denne enhed.');
    uri=FileSystem.cacheDirectory+file.id+'.pdf';await FileSystem.writeAsStringAsync(uri,file.payload,{encoding:FileSystem.EncodingType.Base64});await Sharing.shareAsync(uri,{mimeType:file.mime,UTI:'com.adobe.pdf',dialogTitle:'Åbn plantegning'});
   }
  }catch(e){setError(e instanceof Error?e.message:'Plantegningen kunne ikke åbnes.');}
  finally{if(uri)await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});setBusy(false);setOperation(null);setActiveDocument('');}
 }
 async function remove(document:PropertyDocument){setBusy(true);setOperation('delete');setError('');try{await propertyDocuments(householdId,addressId,'delete',{id:document.id,expectedRevision:document.revision});setDocuments(items=>items.filter(item=>item.id!==document.id));if(preview?.id===document.id)setPreview(null);setDeleting(null);}catch(e){setError(e instanceof Error?e.message:'Plantegningen kunne ikke slettes.');}finally{setBusy(false);setOperation(null);}}
 return <View style={s.card}><Text style={s.heading}>Plantegning</Text><Text style={s.note}>Gem dine plantegninger her, så din husstand har dem samlet. PDF, JPG eller PNG · højst 2 MB pr. fil.</Text>
  <Text style={s.note}>Upload kun filer, du har ret til at dele med din husstand. Undgå unødvendige personoplysninger. Vi bruger dem til privat opbevaring og visning, ikke generel AI-træning. Spørgsmål eller indsigelser: info@huslyg.dk.</Text>
  <Pressable accessibilityRole="button" disabled={busy||loading||!available} onPress={()=>void upload()} style={s.button}><Text style={s.action}>{busy?'Arbejder…':'Upload plantegning'}</Text></Pressable>
  {loading?<LoadingState label="Henter plantegninger?"/>:null}
  {!loading&&!error&&!documents.length?<Text style={s.note}>Du har endnu ikke gemt en plantegning.</Text>:null}
  {documents.map(item=><View key={item.id} style={s.file}><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void open(item)}><Text style={s.action}>{operation==='open'&&activeDocument===item.id?'?bner?':item.name}</Text><Text style={s.note}>{new Date(item.updated_at).toLocaleDateString('da-DK')} · {item.mime==='application/pdf'?'Åbn / hent PDF':'Vis billede'}</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setDeleting(item.id)} style={{minHeight:48,justifyContent:'center'}}><Text style={[s.note,{color:colors.error}]}>Slet</Text></Pressable></View>)}
  <ConfirmDialog visible={!!deleting} title="Slet plantegning?" message={'Vil du slette '+(documents.find(d=>d.id===deleting)?.name??'plantegningen')+'?'} busy={busy} onCancel={()=>setDeleting(null)} onConfirm={()=>{const item=documents.find(d=>d.id===deleting);if(item)void remove(item);}}/>
  <AppModal visible={!!preview} onRequestClose={()=>setPreview(null)}><View style={{flex:1,backgroundColor:colors.paper,paddingTop:Math.max(insets.top,16),paddingBottom:Math.max(insets.bottom,16)}}><Pressable accessibilityRole="button" onPress={()=>setPreview(null)} style={{minHeight:48,alignItems:'flex-end',justifyContent:'center',paddingHorizontal:20}}><Text style={s.action}>Luk visning</Text></Pressable>{preview?<ZoomImage uri={`data:${preview.mime};base64,${preview.payload}`} label={preview.name}/>:null}<Text style={[s.note,{padding:20}]}>Brug to fingre for at zoome</Text></View></AppModal>
  {error?<View><Text accessibilityRole="alert" style={s.note}>{error}</Text><Pressable disabled={busy} onPress={()=>setRevision(v=>v+1)}><Text style={s.action}>Prøv igen</Text></Pressable></View>:null}
 </View>;
}
const s=StyleSheet.create({card:{...cardStyles.inset,gap:16},heading:cardStyles.title,note:cardStyles.note,action:{...cardStyles.body,fontFamily:'Nunito_600SemiBold',color:colors.primary},button:{padding:14,borderRadius:12,backgroundColor:colors.paper},file:{paddingVertical:12,gap:12,borderTopWidth:1,borderColor:colors.paper},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:18},preview:{width:'100%',height:420}});
