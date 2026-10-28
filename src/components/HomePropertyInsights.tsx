import { useEffect, useState, useRef } from 'react';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import {loadPropertyModel} from '../services/property-model';
import type {PropertyModel} from '../services/property-model-format';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { homeInsight, type AirQuality, type EnergyLabel, type HomeGeometry } from '../services/home-insights';
import { HomeParcelMap } from './HomeParcelMap';
import { HomeSunSimulation } from './HomeSunSimulation3D';
import { colors } from '../styles/theme';

export function HomePropertyInsights({addressId,view,visible=true}:{addressId:string;view:'map'|'sun'|'air';visible?:boolean}){
  const auth=useHouseholdSession(),modelRevision=useRef(0),[savedModel,setSavedModel]=useState<PropertyModel|null>(null);
  const rebuildRequested=useRef(false);
  const previousModel=useRef<PropertyModel|null>(null);
  const [geometry,setGeometry]=useState<HomeGeometry|null>(null),[air,setAir]=useState<AirQuality|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;const controller=new AbortController();setGeometry(null);setAir(null);setError('');
   if(view==='sun'&&!auth.householdId)return;
   const work=(async()=>{if(view==='air'){const value=await homeInsight<AirQuality>('air',{id:addressId},revision>0);if(active)setAir(value);return;}
    if(view==='sun'){const saved=await loadPropertyModel(auth.householdId,addressId,controller.signal);if(!active)return;previousModel.current=saved?.model??null;setSavedModel(saved?.model??null);modelRevision.current=saved?.revision??0;const rebuild=rebuildRequested.current;rebuildRequested.current=false;if(saved&&!rebuild){setGeometry(saved.model.geometry);return;}}
    if(view==='sun')setSavedModel(null);const value=await homeInsight<HomeGeometry>('geometry',{id:addressId},revision>0);if(active)setGeometry(value);
   })();void work.catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Oplysningerne kunne ikke hentes lige nu.');});return()=>{active=false;controller.abort();};},[addressId,view,revision,auth.householdId,auth.session?.user.id]);
  if(error)return <View style={s.card}><Text style={s.heading}>{view==='air'?'Luftkvalitet':view==='sun'?'Huset og solen':'Din grund og bygning'}</Text><Text style={s.note}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)} style={s.button}><Text style={s.action}>Prøv igen</Text></Pressable></View>;
  if(view==='air'?!air:!geometry)return <View style={s.card}><ActivityIndicator color={colors.primary}/><Text style={s.note}>{view==='air'?'Henter luftkvalitet…':view==='sun'?'Henter husets omrids…':'Henter matrikelskel og bygningsomrids…'}</Text></View>;
  if(view==='map')return <><HomeParcelMap data={geometry!}/>{geometry!.warnings.map(w=><Text key={w} style={s.note}>{w}</Text>)}</>;
  if(view==='sun')return <><HomeSunSimulation key={`${auth.session?.user.id}:${auth.householdId}:${addressId}:${revision}`} data={geometry!} savedModel={savedModel} previousModel={previousModel.current} initialRevision={modelRevision.current} visible={visible}/><Pressable accessibilityRole="button" onPress={()=>{rebuildRequested.current=true;setGeometry(null);setRevision(v=>v+1);}} style={s.button}><Text style={s.action}>Opdater husmodel</Text></Pressable></>;
  return <View style={s.card}><Text style={s.heading}>Luftkvalitet i området</Text><View style={s.grid}>{air!.readings.map(reading=><View key={reading.pollutant} style={s.stat}><Text style={s.note}>{reading.pollutant} {reading.year?`· ${reading.year}`:''}</Text><Text style={s.number}>{reading.status==='available'?reading.value?.toLocaleString('da-DK',{maximumFractionDigits:1}):'—'}</Text><Text style={s.note}>{reading.status==='available'?'µg/m³ · årsmiddel':'Ikke tilgængelig'}</Text></View>)}</View><Text style={s.note}>{air!.notice}</Text><Text style={s.source}>{air!.source}</Text></View>;
}
const grades=['A2020','A2015','A2010','B','C','D','E','F','G'];
const gradeColors=['#37996b','#50a66e','#75b96b','#99bf69','#d5bc4c','#df9b53','#db6559','#b66e7d','#9c769a'];
export function HomeEnergyLabel({buildingId}:{buildingId:string}){
  const [data,setData]=useState<EnergyLabel|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;setData(null);setError(false);void homeInsight<EnergyLabel>('energy-label',{buildingId},revision>0).then(result=>{if(active)setData(result);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[buildingId,revision]);
  const date=(value:string|null)=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString('da-DK'):'Ikke oplyst';
  return <View style={s.card}><Text style={s.heading}>Energimærke</Text>{!data&&!error?<ActivityIndicator color={colors.primary}/>:null}
    {data?.status==='available'?data.labels.map(label=>{const grade=label.grade.replace(/[\s()]/g,'').toUpperCase();const expired=label.validUntil?label.validUntil<new Date().toISOString().slice(0,10):null;return <View key={label.id} style={s.label}><View style={s.scale}>{grades.map((g,i)=><View key={g} style={[s.grade,{backgroundColor:gradeColors[i],opacity:grade===g?1:0.32},grade===g&&s.selectedGrade]}><Text style={s.gradeLetter}>{g[0]}</Text>{g.length>1?<Text style={s.gradeYear}>{g.slice(1)}</Text>:null}</View>)}</View><View style={s.row}><Text style={s.number}>{label.grade}</Text><Text style={s.action}>{expired?'Udløbet energimærke':expired===null?'Gyldighed ikke oplyst':label.providerStatus||'Registreret energimærke'}</Text></View><Text style={s.note}>Gyldigt fra {date(label.validFrom)} til {date(label.validUntil)}</Text><Text style={s.note}>Rapport {label.id}{label.buildingNumber?` · bygning ${label.buildingNumber}`:''}{label.company?` · ${label.company}`:''}</Text>{label.heating?<Text style={s.note}>{label.heating}</Text>:null}</View>;}):null}
    {data?.status==='access_not_configured'?<Text style={s.note}>Automatisk opslag afventer særskilt adgang til Energistyrelsens EMOData. Energiklasse og gyldighed vises først, når de kan hentes fra registret.</Text>:null}
    {data?.status==='not_found'?<Text style={s.note}>EMOData returnerede ikke et energimærke for denne bygning.</Text>:null}
    {error||data&&['access_denied','unavailable'].includes(data.status)?<><Text style={s.note}>Energimærket kunne ikke hentes. Det betyder ikke, at bygningen mangler et mærke.</Text><Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)} style={s.button}><Text style={s.action}>Prøv igen</Text></Pressable></>:null}
    <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL('https://sparenergi.dk/privat/energimaerkning')} style={s.button}><Text style={s.action}>Se Energistyrelsens energimærker ↗</Text></Pressable><Text style={s.source}>Energistyrelsen · EMOData · mærket gælder bygningen, ikke en vurdering lavet af appen.</Text>
  </View>;
}
const s=StyleSheet.create({card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:12},heading:{fontFamily:'Nunito_700Bold',fontSize:18,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},source:{fontFamily:'Nunito_400Regular',fontSize:10,lineHeight:15,color:colors.muted},button:{minHeight:44,justifyContent:'center'},action:{fontFamily:'Nunito_700Bold',fontSize:13,color:colors.primary},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},stat:{width:'47%',flexGrow:1,backgroundColor:colors.paper,borderRadius:16,padding:14,gap:4},number:{fontFamily:'Nunito_700Bold',fontSize:28,color:colors.ink},label:{gap:10},row:{flexDirection:'row',alignItems:'center',gap:12,flexWrap:'wrap'},scale:{flexDirection:'row',gap:3},grade:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:7},selectedGrade:{borderColor:colors.ink,borderWidth:2,opacity:1},gradeLetter:{fontFamily:'Nunito_700Bold',fontSize:18,color:'white'},gradeYear:{fontFamily:'Nunito_700Bold',fontSize:8,color:'white'}});
