import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackgroundUsage } from '../services/eloverblik';
import { colors } from '../styles/theme';

type Props = { data: BackgroundUsage | null; loading: boolean; error: string; onRefresh: () => void };
const number = (value: number, digits = 2) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits }).format(value);
export function BackgroundUsageCard({ data, loading, error, onRefresh }: Props) {
  const [rate, setRate] = useState('');
  const price = rate.trim() === '' ? NaN : Number(rate.replace(',', '.'));
  const validPrice = Number.isFinite(price) && price >= 0;
  const ready = data?.status === 'ready' && data.dailyKwh !== null;
  const endDate = data ? new Date(Date.parse(data.to+'T12:00:00Z')-86400000).toISOString().slice(0,10) : '';
  return <View style={s.card}>
    <View style={s.heading}><Text style={s.title}>I går</Text></View>
    {loading ? <ActivityIndicator accessibilityLabel="Beregner baggrundsforbrug" color={colors.primary} style={{marginVertical:12}} /> : null}
    {ready ? <>
      <Text style={s.value}>{number(data.dailyKwh!)} kWh{validPrice ? ` · ${number(data.dailyKwh! * price)} kr.` : ''}</Text>
      <TextInput accessibilityLabel="Samlet elpris i kroner pr. kWh" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="Din samlede elpris, kr./kWh" placeholderTextColor={colors.muted} style={s.input} />
      {rate.trim() && !validPrice ? <Text style={s.note}>Indtast en gyldig pris på mindst 0 kr./kWh.</Text> : null}
    </> : data && !loading ? <Text style={s.detail}>Gårsdagens forbrug er ikke tilgængeligt endnu.</Text> : null}
    {data ? <>
      <Text style={s.note}>{data.from} – {endDate} · kl. 02–04 dansk tid. {data.validIntervals} af {data.expectedIntervals} kvartersmålinger er brugbare.</Text>
      {data.syncFailed ? <Text style={s.warning}>Nye målinger kunne ikke hentes. Vurderingen bruger de gemte data.</Text> : null}
    </> : null}
    {error ? <Text style={s.warning}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={onRefresh} disabled={loading} style={s.button}><Text style={s.buttonText}>{loading ? 'Henter målinger…' : 'Opdater'}</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({
  card:{backgroundColor:colors.paper,borderRadius:16,padding:16,marginTop:16},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'},
  title:{fontFamily:'DMSans_700Bold',fontSize:15,color:colors.ink},badge:{fontFamily:'DMSans_700Bold',fontSize:10,color:colors.primary},
  value:{fontFamily:'Fraunces_600SemiBold',fontSize:30,color:colors.ink,marginVertical:8},detail:{fontFamily:'DMSans_500Medium',fontSize:13,color:colors.ink,lineHeight:20,marginVertical:5},
  note:{fontFamily:'DMSans_400Regular',fontSize:12,lineHeight:18,color:colors.muted,marginTop:7},label:{fontFamily:'DMSans_700Bold',fontSize:13,color:colors.ink,marginTop:15},
  input:{minHeight:44,borderWidth:1,borderColor:colors.line,borderRadius:10,paddingHorizontal:12,marginTop:8,color:colors.ink,backgroundColor:colors.white},
  button:{alignSelf:'flex-start',paddingVertical:10,marginTop:8},buttonText:{fontFamily:'DMSans_700Bold',fontSize:12,color:colors.primary},warning:{fontSize:12,color:colors.coral,lineHeight:18,marginTop:8},
});
