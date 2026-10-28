import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {LoadingState} from './LoadingState';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {AppIcon} from './AppIcon';
import {useElectricityPatterns} from '../hooks/useElectricityPatterns';
import {colors} from '../styles/theme';
export function HomeElectricityCard({supplierName,supplierSource,now=Date.now()}:{supplierName?:string;supplierSource?:string;now?:number}){
 const {result,loading,error}=useElectricityPatterns(now);
 const baseline=result?.baseline,hasBaseline=baseline&&baseline.status!=='insufficient_data'&&baseline.watts!==null;
 const annual=result?.annual;
 return <View style={s.card}>
  <View style={s.heading}><AppIcon name="zap" size={20} color={colors.primary}/><Text style={s.title}>El</Text>{loading&&result?<ActivityIndicator size="small" color={colors.primary}/>:null}</View>
  {loading&&!result?<LoadingState label="Henter boligens eloplysninger…"/>:<View style={s.stats}>
   <View style={s.stat}><Text style={s.label}>Årsforbrug{annual?' · '+annual.year:''}</Text><Text style={s.value}>{annual?.completeDays?annual.kwh.toLocaleString('da-DK',{maximumFractionDigits:0})+' kWh':'—'}</Text><Text style={s.note}>{annual?.completeDays?`Til dato · ${annual.completeDays} af ${annual.expectedDays} hele dage`:'Afventer måledata'}</Text></View>
   <View style={s.stat}><Text style={s.label}>Grundforbrug</Text><Text style={s.value}>{hasBaseline?'Ca. '+baseline.kwhPerDay!.toLocaleString('da-DK',{maximumFractionDigits:1})+' kWh/døgn':'—'}</Text><Text style={s.note}>{hasBaseline?(baseline.status==='preliminary'?'Foreløbigt estimat':'Estimeret i rolige perioder'):'Afventer nok nyere målinger'}</Text></View>
   <View style={[s.stat,{flexBasis:'100%'}]}><Text style={s.label}>Netselskab</Text><Text style={s.supplierName}>{supplierName||'Ikke identificeret'}</Text><Text style={s.note}>{supplierSource??'Kontrollér netselskabet på din elregning'}</Text></View>
  </View>}
  {result?.loadFailed||error?<Text style={s.note}>Noget historik kunne ikke hentes. Kun læsbare målinger vises.</Text>:null}
 </View>;
}
const s=StyleSheet.create({card: {...cardStyles.inset,gap:16},heading:{flexDirection:'row',alignItems:'center',gap:8},title: cardStyles.title,stats:{flexDirection:'row',flexWrap:'wrap',gap:12},stat:{flexBasis:'45%',flexGrow:1,padding:14,borderRadius:16,backgroundColor:colors.paper,gap:6},label: cardStyles.label,value:{fontFamily:'Nunito_700Bold',fontSize:22,color:colors.ink},note: cardStyles.note,supplier:{gap:4},supplierName:{fontFamily:'Nunito_700Bold',fontSize:15,color:colors.ink}});
