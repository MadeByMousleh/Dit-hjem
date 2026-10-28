import {AppText as Text} from './AppText';
import {LoadingState} from './LoadingState';
import {cardStyles} from '../styles/cards';
import {readHomeDetail,saveHomeDetail} from '../services/home-overview-cache';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {homeInsight,type HomeGeometry,type HomeHeights} from '../services/home-insights';
import {getHouseLidarModel} from '../utils/homeLidarModel';
import {estimateRasterRoof,triangleRoofEstimate,type RoofEstimate} from '../utils/roof-area';
import {colors} from '../styles/theme';
type Roof={id:string;material:string;estimate:RoofEstimate|null};
export function HomeRoofDetails({addressId}:{addressId:string}){
 const [roofs,setRoofs]=useState<Roof[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');setRoofs([]);
  void (async()=>{
   if(revision===0){const cached=await readHomeDetail<Roof[]>('roof-v1:'+addressId);if(cached&&active){setRoofs(cached);return;}}
   const g=await homeInsight<HomeGeometry>('geometry',{id:addressId},revision>0),main=g.buildings.filter(b=>b.main);
   const measured=new Map(main.map(b=>{const model=getHouseLidarModel(g,b);return [b.id,model&&model.fitRmse<=.3?triangleRoofEstimate(model.roof):null] as const;}));
   const heights=main.some(b=>!measured.get(b.id))?await homeInsight<HomeHeights>('height',{id:addressId},revision>0).catch(()=>null):null;
   const result=main.map(b=>({id:b.id,material:b.roofMaterial?.label??'Ikke oplyst',estimate:measured.get(b.id)??(heights?estimateRasterRoof(g,b,heights):null)}));
   if(active){setRoofs(result);if(result.length&&result.every(r=>r.estimate))void saveHomeDetail('roof-v1:'+addressId,result);}
  })().catch(e=>{if(active)setError(e instanceof Error?e.message:'Tagoplysninger kunne ikke hentes.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[addressId,revision]);
 return <View style={s.card}><Text style={s.heading}>Taget</Text><Text style={s.note}>Tagmateriale, cirka-areal og hældning på boligens tag.</Text>
  {loading?<LoadingState label="Henter tagoplysninger..." rows={3}/>:null}
  {!loading&&!error&&!roofs.length?<Text style={s.note}>Vi kunne ikke finde et sikkert match til boligens tag.</Text>:null}
  {roofs.map((roof,i)=><View key={roof.id} style={s.details}>{roofs.length>1?<Text style={s.heading}>Bygning {i+1}</Text>:null}<Text style={s.note}>Tagmateriale</Text><Text style={s.value}>{roof.material}</Text><Text style={s.note}>Tagareal</Text><Text style={s.value}>{roof.estimate?`Ca. ${Math.round(roof.estimate.area/5)*5} m²`:'Kan ikke beregnes sikkert endnu'}</Text><Text style={s.note}>Taghældning</Text><Text style={s.value}>{roof.estimate?.slopeDegrees==null?'Kan ikke beregnes sikkert endnu':roof.estimate.slopeDegrees<5?'Under 5°':`Ca. ${Math.round(roof.estimate.slopeDegrees/5)*5}°`}</Text>{roof.estimate?.slopeDegrees!=null?<Text style={s.note}>Gennemsnit for tagfladerne.</Text>:null}</View>)}
  {error?<Text accessibilityRole="alert" style={s.note}>{error}</Text>:null}
  {!loading?<Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)}><Text style={s.action}>Hent tagoplysninger igen</Text></Pressable>:null}
 </View>;
}
const s=StyleSheet.create({card:{...cardStyles.inset,gap:16},details:{gap:16},heading:cardStyles.title,value:{...cardStyles.metric,fontSize:24,lineHeight:32},note:cardStyles.note,action:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.primary}});
