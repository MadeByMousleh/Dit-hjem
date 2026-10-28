import {chartPalette} from '../styles/chartPalette';
import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {LoadingState} from './LoadingState';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {useElectricityPatterns} from '../hooks/useElectricityPatterns';
import {WEEKDAYS} from '../services/electricity-patterns.mjs';
import {colors} from '../styles/theme';
import {ElectricityDailyCurve} from './ElectricityDailyCurve';
import {ElectricityBaselineCard} from './ElectricityBaselineCard';
const number=(value:number)=>value.toLocaleString('da-DK',{maximumFractionDigits:2});
const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('da-DK');
const hour=(value:number)=>String(value).padStart(2,'0');
const span=(value:number)=>`${hour(value)}–${hour((value+1)%24)}`;
export function ElectricityPatternsCard({now=Date.now(),onScrubChange}:{now?:number;onScrubChange?:(active:boolean)=>void}){
 const {result,loading,error,progress,refresh}=useElectricityPatterns(now);
 const [selectedDay,setSelectedDay]=useState<number|null>(null),[details,setDetails]=useState(false);
 useEffect(()=>{setSelectedDay(null);},[result?.from,result?.to]);
 const maxDay=Math.max(0,...result?.weekdays.map(row=>row.averageKwh??0)??[]);
 const hours=result?.peakHours??[],days=result?.peakWeekdays??[];
 const dayRow=selectedDay===null?null:result?.weekdays[selectedDay];
 const hourRanges=hours.reduce<number[][]>((ranges,h)=>{const last=ranges[ranges.length-1];if(last&&last[last.length-1]===h-1)last.push(h);else ranges.push([h]);return ranges;},[]).map(rows=>hour(rows[0]!)+String.fromCharCode(8211)+hour((rows[rows.length-1]!+1)%24));
 const hourlyInsight=result?.status!=='ready'?'Foreløbigt mønster':hours.length===24?'Jævnt fordelt over døgnet':hours.length?`Mest forbrug kl. ${hourRanges.slice(0,2).join(', ')+(hourRanges.length>2?' + flere':'')}`:'Intet målt forbrug';
 const dailyInsight=result?.status!=='ready'?'Foreløbigt mønster':days.length===7?'Samme gennemsnit alle ugedage':days.length?`Mest forbrug: ${days.map(d=>WEEKDAYS[d]!.toLocaleLowerCase('da-DK')).join(', ')}`:'Intet målt forbrug';
 return <View style={s.group}>
  <View style={s.header}><View style={s.headerCopy}><Text style={s.section}>Dit forbrugsmønster</Text><Text style={s.note}>Historik fra Eloverblik · ikke live</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Opdater forbrugsmønster" disabled={loading} onPress={refresh} style={s.actionButton}><Text style={s.action}>{loading?'Indlæser…':'Opdater'}</Text></Pressable></View>
  {loading&&!result?<><LoadingState label={`Henter forbrugsmønster, ${progress} procent…`}/><LoadingState label="Henter forbrugskurve…" variant="line-chart"/></>:null}
  {loading&&result?<View style={s.loading}><ActivityIndicator color={colors.primary}/><Text style={s.note}>Læser historik · {progress}%</Text></View>:null}
  {!loading||result?<ElectricityBaselineCard baseline={result?.baseline}/>:null}
  {result?.completeDays?<>
   <View style={s.card}>
    <Text style={s.title}>Timer på dagen</Text><Text style={s.insight}>{hourlyInsight}</Text>
    <ElectricityDailyCurve hours={result.hours} onScrubChange={onScrubChange}/>
   </View>
   <View style={s.card}>
    <Text style={s.title}>Ugens rytme</Text><Text style={s.insight}>{dailyInsight}</Text><Text style={s.note}>Gennemsnit pr. komplet dag · tryk på en ugedag.</Text>
    {result.weekdays.map(row=><Pressable key={row.index} accessibilityRole="button" accessibilityState={{selected:selectedDay===row.index}} accessibilityLabel={`${WEEKDAYS[row.index]}: ${row.averageKwh===null?'ingen data':number(row.averageKwh)+' kWh i gennemsnit'}, ${row.samples} dage`} onPress={()=>setSelectedDay(row.index)} style={[s.dayRow,selectedDay===row.index&&s.selectedDay]}><Text style={s.dayLabel}>{WEEKDAYS[row.index]}</Text><View style={s.dayTrack}><View style={[s.dayBar,{width:maxDay&&row.averageKwh!==null?`${row.averageKwh/maxDay*100}%`:'0%',backgroundColor:selectedDay===row.index?colors.primary:chartPalette.consumption}]}/></View><Text style={s.dayValue}>{row.averageKwh===null?'—':number(row.averageKwh)+' kWh'}</Text></Pressable>)}
    <Text accessibilityLiveRegion="polite" style={s.note}>{dayRow?`${WEEKDAYS[dayRow.index]} · ${dayRow.samples} komplette dage i gennemsnittet.`:'Ugedage sammenlignes efter gennemsnit, så flere målinger ikke giver højere forbrug.'}</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(value=>!value)} style={s.dataButton}><Text style={s.note}>{result.completeDays} af {result.expectedDays} dage · {details?'Skjul datagrundlag':'Se datagrundlag'}</Text></Pressable>
   {details?<View style={s.dataDetails}><Text style={s.note}>{result.firstDay&&date(result.firstDay)} – {result.lastDay&&date(result.lastDay)}. {result.missingDays+result.incompleteDays} dage mangler eller er ufuldstændige og indgår ikke. Dansk tid, inklusive sommer- og vintertid.</Text>{result.status!=='ready'?<Text style={s.note}>Et stabilt mønster kræver mindst 28 hele dage, tre af hver ugedag og komplette data for 70 % af perioden.</Text>:null}</View>:null}
  </>:!loading&&!error?<View style={s.card}><Text style={s.note}>Dit mønster vises automatisk, når der er gemt komplette timedata.</Text></View>:null}
  {result?.loadFailed?<Text style={s.note}>Noget historik kunne ikke hentes. Kun data, der kunne læses, indgår.</Text>:null}
  {error?<Text accessibilityRole="alert" style={s.note}>{error}</Text>:null}
 </View>;
}
const s=StyleSheet.create({
 group: {gap:16,marginBottom:16},header:{flexDirection:'row',alignItems:'center',gap:8},headerCopy:{flex:1},section: cardStyles.title,card: cardStyles.inset,title: cardStyles.title,insight: {...cardStyles.body,color:colors.primary},note: cardStyles.note,actionButton:{minHeight:48,justifyContent:'center',paddingHorizontal:10},action:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},loading:{flexDirection:'row',alignItems:'center',gap:10},selection:{paddingVertical:6,gap:2},selectionLabel:{fontFamily:'Nunito_600SemiBold',fontSize:12,color:colors.muted},selectionValue:{fontFamily:'Nunito_700Bold',fontSize:24,color:colors.ink},hourChart:{height:126,gap:2},hourCell:{width:30,alignItems:'center',justifyContent:'flex-end'},hourTrack:{height:100,width:20,justifyContent:'flex-end'},hourBar:{width:'100%',borderRadius:4},hourLabel:{fontSize:10,color:colors.muted,marginTop:8},selectedText:{color:colors.primary,fontFamily:'Nunito_700Bold'},dayRow:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,borderRadius:10,paddingHorizontal:6},selectedDay:{backgroundColor:colors.primarySoft},dayLabel: {width:60,...cardStyles.label,color:colors.ink},dayTrack:{flex:1,height:8,borderRadius:4,backgroundColor:colors.paper,overflow:'hidden'},dayBar:{height:'100%',borderRadius:4},dayValue: {width:76,textAlign:'right',...cardStyles.label,fontFamily:'Nunito_700Bold',color:colors.ink},dataButton:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},dataDetails:{gap:6,paddingHorizontal:2},
});
