import {useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Image,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import Svg,{Line,Polygon,Image as SvgImage,Rect} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import {manipulateAsync,SaveFormat} from 'expo-image-manipulator';
import {housePhotoFaces,type HousePhotoFace} from '../utils/house-photo-guide';
import {addHouseCapture,readHouseCaptures,removeHouseCapture,type HouseCapture,type CaptureScope} from '../services/house-capture-store';
import {analyzeHouseFacade,loadFacades,saveFacades,type FacadeModel} from '../services/house-facade';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import type {HomeGeometry} from '../services/home-insights';
import {colors} from '../styles/theme';
import {facadePlacement,lidarFacadeAnchor,type FacadePlacement} from '../utils/facade-placement';
import {getHouseLidarModel} from '../utils/homeLidarModel';

export function HousePhotoGuide({data,onHighlight,onModels,initialModels,onSaved}:{data:HomeGeometry;onHighlight:(face:HousePhotoFace|null)=>void;onModels:(models:FacadeModel[])=>void;initialModels?:FacadeModel[];onSaved?:(models:FacadeModel[])=>void}){
 const auth=useHouseholdSession(),faces=useMemo(()=>housePhotoFaces(data),[data]);
 const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[photos,setPhotos]=useState<HouseCapture[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[models,setModels]=useState<FacadeModel[]>(initialModels??[]),[candidate,setCandidate]=useState<FacadeModel|null>(null),[working,setWorking]=useState('');
 const scope=useMemo<CaptureScope|null>(()=>auth.session?.user.id&&auth.householdId?{userId:auth.session.user.id,householdId:auth.householdId,addressId:data.addressId}:null,[auth.session?.user.id,auth.householdId,data.addressId]);
 const generation=useRef(0),face=faces[index];
 const [comparison,setComparison]=useState<'photo'|'drawing'>('photo');
 const [openingIndex,setOpeningIndex]=useState<number|null>(null);
 const candidatePhoto=candidate?photos.find(p=>p.id===candidate.id):null;
 const candidateBuilding=candidate?data.buildings.find(b=>b.id===candidate.face.buildingId):undefined;
 const candidateHeight=candidate&&candidateBuilding?lidarFacadeAnchor(candidate.face,getHouseLidarModel(data,candidateBuilding))?.height??candidate.face.height:3;
 const candidatePlacement=candidate?facadePlacement(candidate,candidateHeight):null;
 function adjustPlacement(key:Exclude<keyof FacadePlacement,'mirror'>,delta:number){setCandidate(c=>{if(!c)return c;const p=facadePlacement(c,candidateHeight),next={...p,[key]:Math.max(key==='width'?.05:key==='height'?.1:0,Math.min(1,p[key]+delta))};next.left=Math.min(next.left,1-next.width);next.bottom=Math.min(next.bottom,1-next.height);return {...c,placement:next};});}
 function adjustOpening(key:'x'|'y'|'width'|'height',delta:number){if(openingIndex===null)return;setComparison('drawing');setCandidate(c=>{if(!c)return c;return {...c,analysis:{...c.analysis,openings:c.analysis.openings.map((o,i)=>{if(i!==openingIndex)return o;const next={...o,[key]:Math.max(key==='width'?.015:key==='height'?.03:0,Math.min(1,o[key]+delta))};next.x=Math.min(next.x,1-next.width);next.y=Math.min(next.y,1-next.height);return next;})}};});}
 const drawingHeight=candidate?candidate.analysis.coverage==='partial'?1000/candidate.analysis.aspect!:1000*candidate.face.height/candidate.face.length:300;
 useEffect(()=>{onModels(candidate?[...models.filter(m=>m.face.id!==candidate.face.id),candidate]:models);},[models,candidate,onModels]);
 useEffect(()=>{const version=++generation.current;setOpen(false);setIndex(0);setPhotos([]);setModels(initialModels??[]);setCandidate(null);setError('');setBusy(false);
  if(scope)void Promise.all([readHouseCaptures(scope),initialModels?Promise.resolve(initialModels):loadFacades(scope,faces)]).then(([items,saved])=>{if(version===generation.current){setPhotos(items);setModels(saved);if(!initialModels)onSaved?.(saved);}}).catch(()=>{if(version===generation.current)setError('Gemte billeder kunne ikke læses. Prøv at åbne siden igen.');});
  return()=>{generation.current++;onModels([]);};
 },[scope,faces,onModels,initialModels,onSaved]);
 useEffect(()=>{onHighlight(candidate?.face??(open&&face?face:null));return()=>onHighlight(null);},[open,face,candidate,onHighlight]);
 const current=photos.filter(p=>p.faceId===face?.id);
 async function analyze(photo:HouseCapture){
  const target=faces.find(f=>f.id===photo.faceId);if(!scope||!target||busy)return;const version=generation.current;setBusy(true);setError('');setWorking('Aflæser vinduer, døre og materialer…');setCandidate(null);setOpeningIndex(null);
  try{const output=await manipulateAsync(photo.uri,[{resize:photo.width>=photo.height?{width:Math.min(1600,photo.width)}:{height:Math.min(1600,photo.height)}}],{format:SaveFormat.JPEG,compress:0.85,base64:true});
   if(version!==generation.current)return;if(!output.base64||output.base64.length>2800000)throw Error('Billedet er for stort. Prøv et nyt foto.');
   const analysis=await analyzeHouseFacade(output.base64,scope.householdId);if(version!==generation.current)return;
   if(analysis.version!==2)throw Error('Den nye facadeanalyse er ikke klar på serveren endnu. Prøv igen om lidt.');
   if(!analysis.openings.length)throw Error('Der blev ikke fundet tydelige vinduer eller døre. Prøv et skarpere foto lige mod væggen.');
   setComparison('photo');
   setCandidate({id:photo.id,face:target,analysis});setOpen(false);onHighlight(target);
  }catch(cause){if(version===generation.current)setError(cause instanceof Error&&cause.name!=='AbortError'?cause.message:'Analysen tog for lang tid. Prøv igen.');}finally{if(version===generation.current){setBusy(false);setWorking('');}}
 }
 async function accept(){if(!candidate||!scope||busy)return;const version=generation.current;setBusy(true);setError('');const next=[...models.filter(m=>m.face.id!==candidate.face.id&&m.id!==candidate.id),candidate];
  try{await saveFacades(scope,next);if(version===generation.current){setModels(next);onSaved?.(next);setCandidate(null);onHighlight(null);}}catch{if(version===generation.current)setError('Modellen kunne ikke gemmes. Prøv igen.');}finally{if(version===generation.current)setBusy(false);}
 }
 async function resetModel(){if(!scope||busy)return;const version=generation.current;setBusy(true);setError('');try{await saveFacades(scope,[]);if(version===generation.current){setModels([]);onSaved?.([]);setCandidate(null);onHighlight(null);}}catch{if(version===generation.current)setError('Modellen kunne ikke nulstilles.');}finally{if(version===generation.current)setBusy(false);}}
 async function pick(camera:boolean){
  if(!scope||!face||busy)return;const version=generation.current;setBusy(true);setError('');
  try{if(camera){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw Error('Giv adgang til kameraet, eller vælg et billede fra galleriet.');}
   const result=camera?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:1,exif:false}):await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:1,allowsMultipleSelection:false,exif:false});
   if(result.canceled||version!==generation.current)return;
   for(const asset of result.assets){if(version!==generation.current)break;const updated=await addHouseCapture(scope,face.id,asset);if(version===generation.current)setPhotos(updated);}
  }catch(cause){if(version===generation.current)setError(cause instanceof Error?cause.message:'Billedet kunne ikke gemmes.');}finally{if(version===generation.current)setBusy(false);}
 }
 function remove(photo:HouseCapture){if(!scope||busy)return;const version=generation.current;const action=async()=>{setBusy(true);try{const updated=await removeHouseCapture(scope,photo.id);if(version===generation.current)setPhotos(updated);}catch{if(version===generation.current)setError('Billedet kunne ikke fjernes.');}finally{if(version===generation.current)setBusy(false);}};
  if(Platform.OS==='web'){if(window.confirm('Fjern denne gemte kopi? Originalen bevares.'))void action();}else Alert.alert('Fjern billede?','Kun appens kopi fjernes. Originalen bevares.',[{text:'Annuller',style:'cancel'},{text:'Fjern',style:'destructive',onPress:()=>void action()}]);
 }
 const points=data.buildings.filter(b=>b.main||b.associated).flatMap(b=>b.rings[0]??[]),minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),span=Math.max(Math.max(...points.map(p=>p[0]))-minX,Math.max(...points.map(p=>p[1]))-minY,1);
 const xy=(p:[number,number])=>`${15+(p[0]-minX)/span*170},${185-(p[1]-minY)/span*170}`;
 if(!faces.length)return null;
 return <View style={s.panel}>
  <Pressable accessibilityRole="button" disabled={!scope||busy} onPress={()=>{setCandidate(null);setOpen(v=>!v);}} style={s.primary}><Text style={s.primaryText}>{open?'Luk billedguide':'Forbedr huset med ét foto'}</Text></Pressable>
  {!!photos.length&&!candidate&&!open&&<Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={()=>void analyze(photos[photos.length-1]!)}><Text style={s.action}>Find vinduer og døre i mit gemte foto</Text></Pressable>}
  {!candidate&&models.map(model=><Pressable key={model.face.id} style={s.button} disabled={busy} onPress={()=>{setCandidate(model);setOpeningIndex(null);setComparison('drawing');setOpen(false);}}><Text style={s.action}>Ret vinduer og døre · {model.face.label}</Text></Pressable>)}
  {busy?<View style={s.row}><ActivityIndicator color={colors.primary}/><Text style={s.note}>{working||'Gemmer…'}</Text></View>:null}
  {candidate?<View style={s.panel}>
   <Text style={s.title}>Sammenlign med dit billede</Text>
   <View style={s.row}><Pressable style={s.button} onPress={()=>setComparison('photo')}><Text style={s.action}>Billedets konturer</Text></Pressable><Pressable style={s.button} onPress={()=>setComparison('drawing')}><Text style={s.action}>Facadetegning</Text></Pressable></View>
   {comparison==='photo'&&candidatePhoto?<View style={{width:'100%',aspectRatio:candidatePhoto.width/candidatePhoto.height}}><Svg width="100%" height="100%" viewBox="0 0 1000 1000">
    <SvgImage href={{uri:candidatePhoto.uri}} x={0} y={0} width={1000} height={1000} preserveAspectRatio="none"/>
    {candidate.analysis.facadeQuad?<Polygon points={candidate.analysis.facadeQuad.map(([x,y])=>`${x*1000},${y*1000}`).join(' ')} fill="none" stroke="#ffce45" strokeWidth={6}/>:null}
    {candidate.analysis.openings.map((o,i)=>o.imageQuad?<Polygon key={i} points={o.imageQuad.map(([x,y])=>`${x*1000},${y*1000}`).join(' ')} fill="#2583ff22" stroke="#2583ff" strokeWidth={5}/>:null)}
   </Svg></View>:null}
   {comparison==='drawing'?<Svg width="100%" height={180} viewBox={`0 0 1000 ${drawingHeight}`}><Rect x={0} y={0} width={1000} height={drawingHeight} fill="#e8eef6"/>{candidate.analysis.openings.map((o,i)=><Rect key={i} x={o.x*1000} y={o.y*drawingHeight} width={o.width*1000} height={o.height*drawingHeight} fill={o.panelColor??'#344e60'} stroke={o.frameColor??candidate.analysis.frameColor} strokeWidth={5}/>)}</Svg>:null}
   <Text style={s.note}>Gul: synlig væg · blå: vinduer og døre. Konturerne skal følge billedet. {candidate.analysis.coverage==='partial'?'Billedet viser en del af facaden. Bredden og placeringen på huset er estimeret; resten bevares.':'Tegningen er perspektivkorrigeret; mål og dybder er stadig estimater.'}</Text>
   <View style={s.row}><Text style={s.note}>{candidate.face.label}</Text><Pressable style={s.button} onPress={()=>setCandidate(c=>{if(!c)return c;const next=faces[(faces.findIndex(f=>f.id===c.face.id)+1)%faces.length]!;return {...c,face:next};})}><Text style={s.action}>Skift side på huset</Text></Pressable></View>
   <Text style={s.note}>Kun vinduer, døre og port tilføjes. Murfarve og tag bevares. Kontroller den markerede væg og placeringen i 3D, før du gemmer.</Text>
   {candidatePlacement?<View style={s.panel}>
    {([['left','Vandret'],['bottom','Løft'],['width','Bredde'],['height','Højde']] as const).map(([key,label])=><View key={key} style={s.row}><Text style={s.note}>{label} · {Math.round(candidatePlacement[key]*100)}%</Text><Pressable accessibilityLabel={`Formindsk ${label}`} style={s.button} onPress={()=>adjustPlacement(key,-.025)}><Text style={s.action}>−</Text></Pressable><Pressable accessibilityLabel={`Forøg ${label}`} style={s.button} onPress={()=>adjustPlacement(key,.025)}><Text style={s.action}>+</Text></Pressable></View>)}
    <View style={s.row}><Pressable style={s.button} onPress={()=>setCandidate(c=>c?{...c,placement:{...facadePlacement(c,candidateHeight),mirror:!facadePlacement(c,candidateHeight).mirror}}:c)}><Text style={s.action}>{candidatePlacement.mirror?'Ophæv spejling':'Spejl placering'}</Text></Pressable><Pressable style={s.button} onPress={()=>setCandidate(c=>c?{...c,placement:undefined}:c)}><Text style={s.action}>Nulstil placering</Text></Pressable></View>
   </View>:null}
   <View style={s.row}>{candidate.analysis.openings.map((o,i)=><Pressable key={i} style={s.button} onPress={()=>{setOpeningIndex(i);setComparison('drawing');}}><Text style={s.action}>Ret {o.kind==='window'?'vindue':o.kind==='garage'?'port':'dør'} {i+1}</Text></Pressable>)}</View>
   {openingIndex!==null&&candidate.analysis.openings[openingIndex]?<View style={s.panel}><Text style={s.note}>Finjuster åbning {openingIndex+1}. Ændringer ses i tegningen og 3D; billedets blå konturer viser den oprindelige analyse.</Text>
    {([['x','Venstre/højre'],['y','Op/ned'],['width','Bredde'],['height','Højde']] as const).map(([key,label])=><View key={key} style={s.row}><Text style={s.note}>{label}</Text><Pressable style={s.button} accessibilityLabel={`Formindsk åbningens ${label}`} onPress={()=>adjustOpening(key,-.005)}><Text style={s.action}>−</Text></Pressable><Pressable style={s.button} accessibilityLabel={`Forøg åbningens ${label}`} onPress={()=>adjustOpening(key,.005)}><Text style={s.action}>+</Text></Pressable></View>)}
    <Pressable style={s.button} onPress={()=>{setCandidate(c=>c?{...c,analysis:{...c.analysis,openings:c.analysis.openings.filter((_,j)=>j!==openingIndex)}}:c);setOpeningIndex(null);}}><Text style={s.action}>Fjern forkert registreret åbning</Text></Pressable>
   </View>:null}
   <View style={s.row}><Pressable disabled={busy} style={s.primary} onPress={()=>void accept()}><Text style={s.primaryText}>Gem vinduer og døre</Text></Pressable><Pressable disabled={busy} style={s.button} onPress={()=>{setCandidate(null);onHighlight(null);}}><Text style={s.action}>Fortryd</Text></Pressable></View>
  </View>:null}
  {open&&face?<>
   <Text style={s.title}>{face.label}</Text><Text style={s.note}>Tag ét billede af den blå facade, helst lige forfra og med hele væggen synlig.</Text>
   <Svg width="100%" height={140} viewBox="0 0 200 200" accessibilityLabel={`Bygningsomrids med ${face.label} markeret`}>
    {data.buildings.filter(b=>b.main||b.associated).map(b=><Polygon key={b.id} points={(b.rings[0]??[]).map(xy).join(' ')} fill="#e8eef6" stroke="#8595aa" strokeWidth={2}/>)}
    <Line x1={Number(xy(face.a).split(',')[0])} y1={Number(xy(face.a).split(',')[1])} x2={Number(xy(face.b).split(',')[0])} y2={Number(xy(face.b).split(',')[1])} stroke={colors.primary} strokeWidth={7} strokeLinecap="round"/>
   </Svg>
   <View style={s.row}><Pressable style={s.button} disabled={busy||index===0} onPress={()=>setIndex(v=>v-1)}><Text style={s.action}>Forrige facade</Text></Pressable><Pressable style={s.button} disabled={busy||index===faces.length-1} onPress={()=>setIndex(v=>v+1)}><Text style={s.action}>Næste facade</Text></Pressable></View>
   <View style={s.row}><Pressable style={s.button} disabled={busy||current.length>=6} onPress={()=>void pick(true)}><Text style={s.action}>Tag foto</Text></Pressable><Pressable style={s.button} disabled={busy||current.length>=6} onPress={()=>void pick(false)}><Text style={s.action}>Vælg foto</Text></Pressable></View>
   <View style={s.images}>{current.map(photo=><View key={photo.id} style={s.photo}><Image source={{uri:photo.uri}} style={s.image}/><Pressable disabled={busy} onPress={()=>void analyze(photo)} style={s.button}><Text style={s.action}>Forbedr facaden</Text></Pressable><Pressable accessibilityLabel="Fjern dette billede" disabled={busy} onPress={()=>remove(photo)} style={s.button}><Text style={s.action}>Fjern</Text></Pressable></View>)}</View>
   <Text style={s.note}>Når du vælger “Forbedr facaden”, sendes billedet til Google til analyse. Den forbedrede facade gemmes på denne enhed.</Text>
  </>:null}
  {!!photos.length&&!open&&!candidate&&<Text style={s.note}>Billedanalysen udføres hos Google. Husets mål og skyggegrundlag kommer fortsat fra kort- og højdedata.</Text>}
  {models.length&&!candidate?<Pressable disabled={busy} style={s.button} onPress={()=>void resetModel()}><Text style={s.action}>Gendan den oprindelige model</Text></Pressable>:null}
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
 </View>;
}
const s=StyleSheet.create({panel:{gap:10},primary:{backgroundColor:colors.primary,borderRadius:14,padding:14,minHeight:48,alignItems:'center'},primaryText:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.white},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},title:{fontFamily:'Nunito_700Bold',fontSize:15,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},button:{backgroundColor:colors.paper,borderRadius:12,padding:12,minHeight:44,justifyContent:'center'},action:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},images:{flexDirection:'row',flexWrap:'wrap',gap:8},photo:{width:'46%',gap:4},image:{width:'100%',aspectRatio:1,borderRadius:10},error:{fontFamily:'Nunito_400Regular',fontSize:12,color:'#b42318'}});
