import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as SunCalc from 'suncalc';
import { loadProfile } from '../services/storage';
import { colors } from '../styles/theme';
export function HomeSunCard({address,userId,email}:{address:string;userId:string;email:string}){
  const [point,setPoint]=useState<{x:number;y:number}|null>(null),[tick,setTick]=useState(0),[season,setSeason]=useState('today');
  useEffect(()=>{let active=true;setPoint(null);void loadProfile(userId,email).then(saved=>{if(active&&saved?.address===address&&Number.isFinite(saved.addressX)&&Number.isFinite(saved.addressY))setPoint({x:saved.addressX!,y:saved.addressY!});}).catch(()=>{});return()=>{active=false;};},[address,userId,email]);
  useEffect(()=>{const timer=setInterval(()=>setTick(value=>value+1),60000);const sub=AppState.addEventListener('change',state=>{if(state==='active')setTick(value=>value+1);});return()=>{clearInterval(timer);sub.remove();};},[]);
  if(!point)return null;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const datePart=(type:string)=>parts.find(part=>part.type===type)?.value??'';
  const day=season==='today'?`${datePart('year')}-${datePart('month')}-${datePart('day')}`:`${datePart('year')}-${season}`;
  const times=SunCalc.getTimes(new Date(`${day}T12:00:00Z`),point.y,point.x);
  const valid=(date:Date)=>Number.isFinite(date?.getTime());
  const time=(date:Date)=>valid(date)?date.toLocaleTimeString('da-DK',{timeZone:'Europe/Copenhagen',hour:'2-digit',minute:'2-digit'}):'—';
  const minutes=valid(times.sunrise)&&valid(times.sunset)?Math.round((times.sunset.getTime()-times.sunrise.getTime())/60000):null;
  const stats=[['Solopgang',time(times.sunrise)],['Solnedgang',time(times.sunset)],['Dagslængde',minutes===null?'—':`${Math.floor(minutes/60)} t ${minutes%60} min`]];
  return <View style={s.card}><Text style={s.heading}>Solen ved din bolig</Text><View style={s.options}>{[['today','I dag'],['03-20','Forår'],['06-21','Sommer'],['09-22','Efterår'],['12-21','Vinter']].map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:season===id}} onPress={()=>setSeason(id!)} style={[s.chip,season===id&&s.active]}><Text style={[s.action,season===id&&{color:colors.white}]}>{label}</Text></Pressable>)}</View><Text style={s.note}>{new Date(`${day}T12:00:00Z`).toLocaleDateString('da-DK',{timeZone:'Europe/Copenhagen',day:'numeric',month:'long',year:'numeric'})} · dansk tid</Text><View style={s.stats}>{stats.map(([label,value])=><View key={label} style={s.stat}><Text style={s.value}>{value}</Text><Text style={s.note}>{label}</Text></View>)}</View><Text style={s.note}>Astronomisk beregning med SunCalc. Ikke en beregning af sol på taget, skygger, vejr eller solcelleproduktion.</Text></View>;
}
const s=StyleSheet.create({card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:12},heading:{fontFamily:'Nunito_700Bold',fontSize:18,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},options:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{minHeight:44,paddingHorizontal:12,borderRadius:14,justifyContent:'center',backgroundColor:colors.paper},active:{backgroundColor:colors.primary},action:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},stats:{flexDirection:'row',flexWrap:'wrap',gap:16},stat:{flexGrow:1,gap:4},value:{fontFamily:'Nunito_700Bold',fontSize:20,color:colors.ink}});
