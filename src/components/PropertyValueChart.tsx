import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../styles/theme';
type Entry={year:number;propertyValue:number|null;landValue:number|null};
export function PropertyValueChart({history}:{history:Entry[]}){
  const [metric,setMetric]=useState<'propertyValue'|'landValue'>('propertyValue'),[period,setPeriod]=useState(0),[selected,setSelected]=useState<number|null>(null),[width,setWidth]=useState(300);
  const maxYear=Math.max(...history.map(row=>row.year));
  const rows=history.filter(row=>(!period||row.year>maxYear-period)&&row[metric]!==null).slice().sort((a,b)=>a.year-b.year);
  const first=rows[0],last=rows[rows.length-1];if(!first||!last)return <View><Text style={s.note}>Ingen beløb registreret for denne visning.</Text><Pressable accessibilityRole="button" style={s.chip} onPress={()=>{setMetric(metric==='propertyValue'?'landValue':'propertyValue');setPeriod(0);}}><Text style={s.action}>Skift visning</Text></Pressable></View>;
  const maximum=Math.max(1,...rows.map(row=>row[metric]!));
  const point=(row:Entry)=>({x:16+(row.year-first.year)/Math.max(1,last.year-first.year)*(width-32),y:142-row[metric]!/maximum*120});
  const active=rows.find(row=>row.year===selected)??last, dot=point(active);
  const choose=(year:number)=>setSelected(year);
  return <View style={s.chart} onLayout={event=>setWidth(Math.max(120,event.nativeEvent.layout.width))}>
    <View style={s.options}>{([['propertyValue','Ejendom'],['landValue','Grund']] as const).map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:metric===id}} onPress={()=>{setMetric(id);setSelected(null);}} style={[s.chip,metric===id&&s.active]}><Text style={[s.action,metric===id&&{color:colors.white}]}>{label}</Text></Pressable>)}{[[0,'Alle'],[10,'10 år'],[5,'5 år']].map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:period===id}} onPress={()=>{setPeriod(Number(id));setSelected(null);}} style={[s.chip,period===id&&s.active]}><Text style={[s.action,period===id&&{color:colors.white}]}>{label}</Text></Pressable>)}</View>
    <Text style={s.value}>{active[metric]!.toLocaleString('da-DK')} kr. · {active.year}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Vælg vurderingsår på grafen" onPress={event=>{const year=first.year+Math.max(0,Math.min(1,(event.nativeEvent.locationX-16)/(width-32)))*(last.year-first.year);const nearest=rows.reduce((best,row)=>Math.abs(row.year-year)<Math.abs(best.year-year)?row:best,first);choose(nearest.year);}}>
      <Svg width={width} height={160}><Line x1={16} y1={142} x2={width-16} y2={142} stroke={colors.line}/><Polyline points={rows.map(row=>{const p=point(row);return`${p.x},${p.y}`;}).join(' ')} fill="none" stroke={colors.primary} strokeWidth={3}/><Circle cx={dot.x} cy={dot.y} r={6} fill={colors.primary} stroke={colors.white} strokeWidth={2}/></Svg>
    </Pressable><View style={s.axis}><Text style={s.note}>{first.year}</Text><Text style={s.note}>{last.year}</Text></View>
    <Text style={s.note}>Registrerede vurderinger frem til {maxYear}. Tryk på grafen eller vælg et år.</Text>
    <View style={s.options}>{rows.map(row=><Pressable key={row.year} accessibilityRole="button" accessibilityState={{selected:active.year===row.year}} accessibilityLabel={`${row.year}, ${row[metric]!.toLocaleString('da-DK')} kroner`} onPress={()=>choose(row.year)} style={[s.yearChip,active.year===row.year&&s.selected]}><Text style={s.action}>{row.year}</Text></Pressable>)}</View>
  </View>;
}
const s=StyleSheet.create({chart:{gap:8},options:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{minHeight:44,paddingHorizontal:12,borderRadius:14,justifyContent:'center',backgroundColor:colors.paper},active:{backgroundColor:colors.primary},action:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},value:{fontFamily:'Nunito_700Bold',fontSize:17,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:11,lineHeight:17,color:colors.muted},axis:{flexDirection:'row',justifyContent:'space-between'},yearChip:{minHeight:44,paddingHorizontal:10,borderRadius:12,justifyContent:'center'},selected:{backgroundColor:colors.paper}});
