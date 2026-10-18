import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { type HomeGeometry, type XY } from '../services/home-insights';
import { API_URL } from '../services/supabase';
import { getCachedPhoto, photoCacheKey } from '../services/home-photo-cache';
import { colors } from '../styles/theme';

export function useOrthophoto(data:HomeGeometry){
  const remote=`${API_URL}/api/address/search?${new URLSearchParams({mode:'orthophoto',bbox:data.bbox.join(',')})}`;
  const [uri,setUri]=useState(remote);
  useEffect(()=>{let active=true;setUri(remote);const key=`ortho-${photoCacheKey(API_URL,data.bbox[0],data.bbox[1])}-${Math.round((data.bbox[2]-data.bbox[0])*100)}`;void getCachedPhoto(key,{direction:'nadir',capturedAt:new Date().toISOString().slice(0,7)},remote).then(value=>{if(active)setUri(value);});return()=>{active=false;};},[remote]);
  return uri;
}
export function HomeParcelMap({data}:{data:HomeGeometry}){
  const [layer,setLayer]=useState('aerial'),[failed,setFailed]=useState(false);
  const uri=useOrthophoto(data);useEffect(()=>setFailed(false),[uri]);
  const [left,bottom,right,top]=data.bbox;
  const screen=([x,y]:XY):XY=>[(x-left)/(right-left)*400,(top-y)/(top-bottom)*300];
  const path=(rings:XY[][])=>rings.map(ring=>ring.map((point,i)=>`${i?'L':'M'}${screen(point).join(' ')}`).join(' ')+'Z').join(' ');
  const areas=data.parcels.map(p=>p.registeredArea);const area=areas.length&&areas.every(a=>a!==null)?areas.reduce<number>((a,b)=>a+(b??0),0):null;
  const marker=screen(data.point);
  return <View style={s.card}><View style={s.header}><Text style={s.heading}>Din grund og bygning</Text>{area!==null?<Text style={s.area}>{area.toLocaleString('da-DK')} m²</Text>:null}</View>
    <View style={s.map}>{layer==='aerial'&&!failed?<Image source={{uri}} resizeMode="stretch" style={StyleSheet.absoluteFill} onError={()=>setFailed(true)}/>:null}
      <Svg width="100%" height="100%" viewBox="0 0 400 300">
        {data.parcels.flatMap(parcel=>parcel.polygons.map((rings,i)=><Path key={`${parcel.id}:${i}`} d={path(rings)} fill={layer==='aerial'?'rgba(255,255,255,0.07)':'#e9f1e6'} fillRule="evenodd" stroke={layer==='aerial'?'white':colors.primary} strokeWidth={2} strokeDasharray="5 4"/>))}
        {data.buildings.map(building=><Path key={building.id} d={path(building.rings)} fill={building.main?'rgba(232,81,53,0.48)':building.associated?'rgba(90,119,147,0.35)':'rgba(120,135,145,0.24)'} stroke={building.main?'#e34e35':'#8796a2'} strokeWidth={building.main?2:1} fillRule="evenodd"/>)}
        <Circle cx={marker[0]} cy={marker[1]} r={5} fill="#e34e35" stroke="white" strokeWidth={2}/><SvgText x={378} y={25} fill={layer==='aerial'&&!failed?'white':colors.ink} fontSize={14} fontWeight="bold">N ↑</SvgText>
      </Svg>
    </View>
    <View style={s.options}>{[['aerial','Luftfoto'],['parcel','Matrikel']].map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:layer===id}} onPress={()=>setLayer(id!)} style={[s.chip,layer===id&&s.active]}><Text style={[s.action,layer===id&&{color:colors.white}]}>{label}</Text></Pressable>)}</View>
    {failed&&layer==='aerial'?<Text style={s.note}>Luftfoto kunne ikke indlæses. Registrerede omrids vises stadig.</Text>:null}
    <Text style={s.note}>Rød: boligens bygning · stiplet: matrikelskel</Text>
    {data.parcels.map(parcel=><View key={parcel.id} style={s.header}><Text style={s.note}>Matrikel {parcel.number} · jordstykke {parcel.id}</Text><Text style={s.action}>{parcel.registeredArea?.toLocaleString('da-DK')??'—'} m²</Text></View>)}
    <Text style={s.note}>{data.notice}</Text><Text style={s.source}>{data.source}{layer==='aerial'?' · Ortofoto © GeoDanmark/KDS':''}</Text>
  </View>;
}
const s=StyleSheet.create({card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:12},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8},heading:{fontFamily:'Nunito_700Bold',fontSize:18,color:colors.ink},area:{fontFamily:'Nunito_700Bold',fontSize:22,color:colors.ink},map:{width:'100%',aspectRatio:4/3,overflow:'hidden',borderRadius:18,backgroundColor:'#edf1ed'},options:{flexDirection:'row',gap:8},chip:{minHeight:44,paddingHorizontal:16,borderRadius:14,justifyContent:'center',backgroundColor:colors.paper},active:{backgroundColor:colors.primary},action:{fontFamily:'Nunito_700Bold',fontSize:13,color:colors.primary},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},source:{fontFamily:'Nunito_400Regular',fontSize:10,lineHeight:15,color:colors.muted}});
