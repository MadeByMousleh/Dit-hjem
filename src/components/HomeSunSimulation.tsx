import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Path, Text as SvgText } from 'react-native-svg';
import * as SunCalc from 'suncalc';
import { type HomeGeometry, type XY } from '../services/home-insights';
import { useOrthophoto } from './HomeParcelMap';
import { colors } from '../styles/theme';

const zone='Europe/Copenhagen';
export {today,instant,TimeSlider};
function today(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(t=>p.find(p=>p.type===t)?.value).join('-');}
function instant(day:string,minute:number){
  const target=new Date(`${day}T00:00:00Z`).getTime()+minute*60000;
  let value=target;
  for(let i=0;i<2;i++){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const part=(t:string)=>p.find(p=>p.type===t)?.value;const local=Date.parse(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00Z`);value=target-(local-value);}
  return new Date(value);
}
function TimeSlider({value,onChange}:{value:number;onChange:(v:number)=>void}){
  const width=useRef(1);const set=(x:number)=>onChange(Math.round(Math.max(0,Math.min(1,x/width.current))*1439/5)*5);
  return <View accessibilityRole="adjustable" accessibilityLabel="Tidspunkt for solvisning" accessibilityValue={{min:0,max:1439,now:value,text:`${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>onChange(Math.max(0,Math.min(1439,value+(event.nativeEvent.actionName==='increment'?15:-15))))} onLayout={event=>{width.current=event.nativeEvent.layout.width;}} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={event=>set(event.nativeEvent.locationX)} onResponderMove={event=>set(event.nativeEvent.locationX)} style={s.slider}><View style={s.track}/><View pointerEvents="none" style={[s.progress,{width:`${value/1439*100}%`}]}/><View pointerEvents="none" style={[s.thumb,{left:`${Math.min(100,value/1439*100)}%`}]}/></View>;
}
export function HomeSunSimulation({data}:{data:HomeGeometry}){
  const [season,setSeason]=useState('today'),[minute,setMinute]=useState(720),[angle,setAngle]=useState(-35),[playing,setPlaying]=useState(false),[imageFailed,setImageFailed]=useState(false);
  const uri=useOrthophoto(data);useEffect(()=>{let active=true;setImageFailed(false);Image.getSize(uri,()=>{},()=>{if(active)setImageFailed(true);});return()=>{active=false;};},[uri]);
  const base=today(),day=season==='today'?base:`${base.slice(0,4)}-${season}`;
  const date=instant(day,minute),sun=SunCalc.getPosition(date,data.latitude,data.longitude),times=SunCalc.getTimes(instant(day,720),data.latitude,data.longitude);
  const displayTime=(date:Date)=>Number.isFinite(date.getTime())?date.toLocaleTimeString('da-DK',{timeZone:zone,hour:'2-digit',minute:'2-digit'}):'—';
  const dragStart=useRef(angle),angleRef=useRef(angle);angleRef.current=angle;
  const pan=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>8&&Math.abs(g.dx)>Math.abs(g.dy)*1.3,onPanResponderGrant:()=>{dragStart.current=angleRef.current;},onPanResponderMove:(_,g)=>setAngle(dragStart.current+g.dx*0.5)}),[]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setMinute(v=>(v+15)%1440),100);return()=>clearInterval(timer);},[playing]);
  const [left,bottom,right,top]=data.bbox,cx=(left+right)/2,cy=(top+bottom)/2;
  const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  const scale=330/Math.hypot(right-left,top-bottom),pitch=0.64;
  const project=([x,y]:XY,z=0):XY=>{const east=x-cx,north=y-cy;return [200+(east*cos-north*sin)*scale,160+(east*sin+north*cos)*scale*pitch-z*scale*0.9];};
  const depth=([x,y]:XY)=>(x-cx)*sin+(y-cy)*cos;
  const path=(rings:XY[][],z=0)=>rings.map(r=>r.map((p,i)=>`${i?'L':'M'}${project(p,z).join(' ')}`).join(' ')+'Z').join(' ');
  const corners:[XY,XY,XY]=[[left,top],[right,top],[left,bottom]],p=corners.map(c=>project(c));
  const matrix=[(p[1]![0]-p[0]![0])/900,(p[1]![1]-p[0]![1])/900,(p[2]![0]-p[0]![0])/675,(p[2]![1]-p[0]![1])/675,p[0]![0],p[0]![1]];
  const buildings=[...data.buildings].sort((a,b)=>depth(a.rings[0]![0]!)-depth(b.rings[0]![0]!));
  const sunUp=sun.altitude>0,altitude=Math.round(sun.altitude*180/Math.PI),bearing=(sun.azimuth*180/Math.PI+180+360)%360;
  const directions=['N','NØ','Ø','SØ','S','SV','V','NV'],direction=directions[Math.round(bearing/45)%8];
  const anyMain=buildings.some(b=>b.main);
  if(!anyMain)return <View style={s.card}><Text style={s.heading}>Huset og solen</Text><Text style={s.note}>Bygningens omrids mangler i GeoDanmark. Der vises ikke en opdigtet husmodel.</Text></View>;
  return <View style={s.card}><View style={s.row}><Text style={s.heading}>Huset og solen</Text><Pressable accessibilityRole="button" onPress={()=>{setAngle(-35);setMinute(720);setPlaying(false);setSeason('today');}} style={s.chip}><Text style={s.action}>Nulstil</Text></Pressable></View>
    <View {...pan.panHandlers} style={s.scene} accessibilityLabel="Forenklet husmodel. Træk vandret for at dreje visningen."><Svg width="100%" height="100%" viewBox="0 0 400 300">
      <Path d={path([[corners[0],corners[1],[right,bottom],corners[2]]])} fill="#dce8d7"/>{!imageFailed?<SvgImage href={{uri}} width={900} height={675} transform={`matrix(${matrix.join(' ')})`}/>:null}
      {data.parcels.flatMap(parcel=>parcel.polygons.map((rings,i)=><Path key={`${parcel.id}:${i}`} d={path(rings)} fill="rgba(255,255,255,0.06)" stroke="white" strokeWidth={1.4} strokeDasharray="4 3" fillRule="evenodd"/>))}
      {sunUp?buildings.flatMap(b=>{const length=Math.min(300,b.height/Math.max(0.01,Math.tan(sun.altitude))),dx=Math.sin(sun.azimuth)*length,dy=Math.cos(sun.azimuth)*length;return b.rings.flatMap((ring,ri)=>ring.slice(0,-1).map((a,i)=>{const next=ring[i+1]!;return <Path key={`${b.id}:${ri}:${i}`} d={path([[a,next,[next[0]+dx,next[1]+dy],[a[0]+dx,a[1]+dy]]])} fill="rgba(15,25,40,0.18)"/>;}));}):null}
      {buildings.map(b=>{const faces=b.rings.flatMap(ring=>ring.slice(0,-1).map((a,i)=>({a,next:ring[i+1]!,d:(depth(a)+depth(ring[i+1]!))/2}))).sort((a,b)=>a.d-b.d);return <G key={b.id}>{faces.map((f,i)=>{const points=[project(f.a),project(f.next),project(f.next,b.height),project(f.a,b.height)];return <Path key={i} d={points.map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' ')+'Z'} fill={b.main?i%2?'#b96c52':'#d18869':b.associated?'#a8b7be':'#b5bfc6'} stroke={b.main?'#a56650':'#9baab3'} strokeWidth={0.6}/>;})}<Path d={path(b.rings,b.height)} fill={b.main?'#65717d':'#b8c2ca'} stroke={b.main?'#4d5966':'#9aa9b4'} strokeWidth={1} fillRule="evenodd"/></G>;})}
      <Circle cx={365} cy={29} r={11} fill={sunUp?'#f2bd4b':'#b1bccd'}/><SvgText x={18} y={27} fontSize={12} fill="#334155">{sunUp?`${direction} · ${altitude}°`:'Solen er under horisonten'}</SvgText>
      <SvgText x={18} y={282} fontSize={11} fill="#334155">Træk for at dreje · forenklet 3D-model</SvgText>
    </Svg></View>
    <View style={s.options}>{[['today','I dag'],['03-20','Forår'],['06-21','Sommer'],['09-22','Efterår'],['12-21','Vinter']].map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:season===id}} onPress={()=>setSeason(id!)} style={[s.chip,season===id&&s.active]}><Text style={[s.action,season===id&&{color:colors.white}]}>{label}</Text></Pressable>)}</View>
    <View style={s.row}><Text style={s.time}>{displayTime(date)}</Text><Text style={s.note}>{date.toLocaleDateString('da-DK',{timeZone:zone,day:'numeric',month:'long'})} · dansk tid</Text><Pressable accessibilityRole="button" accessibilityLabel={playing?'Pause solsimulation':'Afspil solsimulation'} onPress={()=>setPlaying(v=>!v)} style={s.chip}><Text style={s.action}>{playing?'Pause':'Afspil'}</Text></Pressable></View>
    <TimeSlider value={minute} onChange={v=>{setPlaying(false);setMinute(Math.min(1439,v));}}/>
    <View style={s.row}><Text style={s.note}>Solopgang {displayTime(times.sunrise)}</Text><Text style={s.note}>Solnedgang {displayTime(times.sunset)}</Text></View>
    <Text style={s.note}>Faktiske GeoDanmark-omrids. Højder er estimeret fra BBR-etager (3 m/etage), ellers 3 m. Flade modeltage, ikke en opmåling af tagets form. Skygger vises på plant terræn uden træer; ikke en præcis skyggeanalyse.</Text>
    <Text style={s.source}>Solposition: SunCalc · Kort og bygningsomrids © KDS/GeoDanmark · CC BY 4.0</Text>
  </View>;
}
const s=StyleSheet.create({card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:12},heading:{fontFamily:'Nunito_700Bold',fontSize:18,color:colors.ink},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8},scene:{width:'100%',aspectRatio:4/3,borderRadius:18,overflow:'hidden',backgroundColor:'#edf2f6'},options:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{minHeight:44,paddingHorizontal:11,borderRadius:14,justifyContent:'center',backgroundColor:colors.paper},active:{backgroundColor:colors.primary},action:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},time:{fontFamily:'Nunito_700Bold',fontSize:24,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},source:{fontFamily:'Nunito_400Regular',fontSize:10,lineHeight:15,color:colors.muted},slider:{height:44,justifyContent:'center',marginHorizontal:8},track:{height:5,borderRadius:3,backgroundColor:'#dce2e9'},progress:{position:'absolute',height:5,borderRadius:3,backgroundColor:colors.primary},thumb:{position:'absolute',width:22,height:22,marginLeft:-11,borderRadius:11,backgroundColor:colors.primary,borderWidth:3,borderColor:colors.white}});
