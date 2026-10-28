import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {AnimatedMetric} from './Motion';
import {useMemo,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import type {PatternBucket} from '../services/electricity-patterns.mjs';
import {colors} from '../styles/theme';
import {InteractiveEnergyChart} from './InteractiveEnergyChart';
const hour=(n:number)=>String(n%24).padStart(2,'0');
export function ElectricityDailyCurve({hours,onScrubChange}:{hours:PatternBucket[];onScrubChange?:(active:boolean)=>void}){
 const [chosen,setChosen]=useState<number|null>(null);
 const {best,ties,highlight,peak,chartPoints}=useMemo(()=>{
 const windows=Array.from({length:22},(_,start)=>{const rows=hours.slice(start,start+3);return {start,total:rows.length===3&&rows.every(h=>h.averageKwh!==null)?rows.reduce((n,h)=>n+h.averageKwh!,0):null};}).filter(w=>w.total!==null);
 const sorted=[...windows].sort((a,b)=>b.total!-a.total!);
 const best=sorted[0],ties=best?sorted.filter(w=>Math.abs(w.total!-best.total!)<1e-9).length:0;
 const highlight=best&&best.total!>0&&ties<windows.length?{start:best.start,end:best.start+3}:undefined;
 const peak=[...hours].sort((a,b)=>(b.averageKwh??-1)-(a.averageKwh??-1))[0];
 const chartPoints=hours.map(h=>({label:hour(h.index),value:h.averageKwh}));
 return {best,ties,highlight,peak,chartPoints};
 },[hours]);
 const index=chosen??peak?.index??0,row=hours[index];
 return <View style={s.container}>
  <View style={s.header}><View style={{flex:1}}><Text style={s.label}>Kl. {hour(index)}–{hour(index+1)}</Text><AnimatedMetric fast style={s.value} value={row?.averageKwh==null?'Ingen data':`${row.averageKwh.toLocaleString('da-DK',{maximumFractionDigits:2})} kWh`}/></View></View>
  {highlight?<Text style={s.peak}>{ties>1?'En af de højeste 3-timersperioder':'Højeste 3-timersperiode'}: {hour(best!.start)}–{hour(best!.start+3)}</Text>:null}
  <InteractiveEnergyChart points={chartPoints} selected={index} onSelect={setChosen} kind="line" highlight={highlight} onScrubChange={onScrubChange}/>
  <Text style={s.note}>Gennemsnit pr. time · {row?.samples??0} målte timer{highlight?' · stiplet felt viser 3-timersperioden':''}</Text>
 </View>;
}
const s=StyleSheet.create({container:{gap:8},header:{flexDirection:'row',alignItems:'center'},label:{fontFamily:'Nunito_500Medium',fontSize:12,color:colors.muted},value:{fontFamily:'Nunito_700Bold',fontSize:24,color:colors.ink},peak:{fontFamily:'Nunito_700Bold',fontSize:12,color:'#986322'},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted}});
