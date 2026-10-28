import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Svg,{Path,Text as SvgText} from 'react-native-svg';
import type {PatternBucket} from '../services/electricity-patterns.mjs';
import {colors} from '../styles/theme';
const hour=(n:number)=>String(n).padStart(2,'0');
const point=(radius:number,angle:number)=>{const a=(angle-90)*Math.PI/180;return {x:140+radius*Math.cos(a),y:140+radius*Math.sin(a)};};
function sector(index:number){
 const start=index*15+1,end=(index+1)*15-1,a=point(110,start),b=point(110,end),c=point(78,end),d=point(78,start);
 return `M ${a.x} ${a.y} A 110 110 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A 78 78 0 0 0 ${d.x} ${d.y} Z`;
}
const shades=['#E9F2EB','#C5DFCA','#92BC9B','#5A9568','#28613A'];
const format=(n:number)=>n.toLocaleString('da-DK',{maximumFractionDigits:2});
export function ElectricityDayClock({hours}:{hours:PatternBucket[]}){
 const [chosen,setChosen]=useState<number|null>(null);
 const max=Math.max(0,...hours.map(h=>h.averageKwh??0));
 const peak=hours.find(h=>h.averageKwh===max&&max>0)?.index??0;
 const index=chosen??peak,row=hours.find(h=>h.index===index);
 const change=(step:number)=>setChosen((index+step+24)%24);
 const description=`Klokken ${hour(index)}–${hour((index+1)%24)}: ${row?.averageKwh==null?'ingen data':format(row.averageKwh)+' kWh i gennemsnit'}`;
 return <View style={s.container}>
  <View style={s.clock} accessible accessibilityRole="adjustable" accessibilityLabel={description} accessibilityHint="Stryg op eller ned for at vælge en time" accessibilityActions={[{name:'increment',label:'Næste time'},{name:'decrement',label:'Forrige time'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='increment')change(1);if(event.nativeEvent.actionName==='decrement')change(-1);}}>
   <Svg width="100%" height="100%" viewBox="0 0 280 280">
    {hours.map(h=><Path key={h.index} d={sector(h.index)} fill={h.averageKwh===null?'#E5E7EB':shades[max?Math.min(4,Math.floor(h.averageKwh/max*4)):0]} stroke={index===h.index?colors.ink:'transparent'} strokeWidth={index===h.index?2:0} onPress={()=>setChosen(h.index)}/>)}
    {[0,6,12,18].map(h=>{const p=point(125,h*15);return <SvgText key={h} x={p.x} y={p.y+4} fill={colors.muted} fontSize={11} textAnchor="middle">{hour(h)}</SvgText>;})}
   </Svg>
   <View pointerEvents="none" style={s.center}><Text style={s.time}>Kl. {hour(index)}–{hour((index+1)%24)}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.value}>{row?.averageKwh==null?'—':format(row.averageKwh)}</Text><Text style={s.unit}>kWh i gennemsnit</Text></View>
  </View>
  <View style={s.controls}><Pressable accessibilityRole="button" accessibilityLabel="Forrige time" onPress={()=>change(-1)} style={s.arrow}><Text style={s.arrowText}>‹</Text></Pressable><Text style={s.samples}>{row?.samples??0} målte timer</Text><Pressable accessibilityRole="button" accessibilityLabel="Næste time" onPress={()=>change(1)} style={s.arrow}><Text style={s.arrowText}>›</Text></Pressable></View>
  <View style={s.legend}><Text style={s.note}>Lavere</Text>{shades.map(color=><View key={color} style={[s.swatch,{backgroundColor:color}]}/>)}<Text style={s.note}>Højere forbrug</Text></View>
  <Text style={s.note}>Tryk på en time i døgnuret</Text>
 </View>;
}
const s=StyleSheet.create({container:{alignItems:'center',gap:4},clock:{width:'100%',maxWidth:280,aspectRatio:1},center:{position:'absolute',top:'32%',left:'24%',right:'24%',bottom:'30%',alignItems:'center',justifyContent:'center',gap:3},time:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},value:{fontFamily:'Nunito_700Bold',fontSize:34,color:colors.ink},unit:{fontFamily:'Nunito_400Regular',fontSize:10,color:colors.muted},controls:{flexDirection:'row',alignItems:'center',gap:10},arrow:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:colors.paper},arrowText:{fontSize:25,color:colors.primary},samples:{fontFamily:'Nunito_500Medium',fontSize:11,color:colors.muted},legend:{flexDirection:'row',gap:4,alignItems:'center',marginTop:6},swatch:{width:13,height:7,borderRadius:3},note:{fontFamily:'Nunito_400Regular',fontSize:10,color:colors.muted}});
