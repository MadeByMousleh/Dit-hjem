import {AppText as Text} from './AppText';
import {Disclosure} from './Disclosure';
import {AnimatedMetric} from './Motion';
import {cardStyles} from '../styles/cards';
import {StyleSheet,View} from 'react-native';
import type {ElectricityBaseline} from '../services/electricity-patterns.mjs';
import {colors} from '../styles/theme';
export function ElectricityBaselineCard({baseline}:{baseline?:ElectricityBaseline}){
 const enough=baseline&&baseline.status!=='insufficient_data'&&baseline.watts!==null;
 return <View style={s.card}>
  <Text style={s.title}>Hjemmets grundforbrug</Text>
  {enough?<>
   <Text style={s.value}>Ca. {baseline.kwhPerDay!.toLocaleString('da-DK',{maximumFractionDigits:1})} <Text style={s.unit}>kWh pr. døgn</Text></Text>
   <Text style={s.note}>Rolige perioder · {baseline.completeDays} hele dage · til {new Date(baseline.lastDay!+'T12:00:00Z').toLocaleDateString('da-DK')}</Text>
   {baseline.status==='preliminary'?<Text style={s.note}>Foreløbigt estimat</Text>:null}
   {baseline.changed?<Text style={s.change}>Tilpasset et nyt niveau i den seneste uge</Text>:null}
   <Disclosure title="Om grundforbrug"><Text style={s.note}>Lavt målt netforbrug. Solceller og batteri kan påvirke estimatet.</Text></Disclosure>
  </>:<Text style={s.note}>Vises, når vi har mindst 7 hele måledage og nok nyere data.</Text>}
 </View>;
}
const s=StyleSheet.create({card: cardStyles.inset,title: cardStyles.title,value: cardStyles.metric,unit:{fontSize:17,color:colors.muted},detail:{fontFamily:'Nunito_600SemiBold',fontSize:13,color:colors.primary},note: cardStyles.note,change:{fontFamily:'Nunito_600SemiBold',fontSize:12,color:colors.primary}});
