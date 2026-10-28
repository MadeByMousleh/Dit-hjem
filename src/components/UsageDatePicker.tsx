import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {AppModal as Modal} from './AppModal';
import {HapticPressable as Pressable} from './HapticPressable';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { UsageAggregation } from '../services/eloverblik';
import { colors } from '../styles/theme';
import { usageToday } from '../utils/usagePeriods';

type Props = { aggregation: UsageAggregation; anchor: string; years: number[]; maxDate?: string; onSelect: (date: string) => void; onClose: () => void };
export function UsageDatePicker({ aggregation, anchor, years, maxDate, onSelect, onClose }: Props) {
  const [year, setYear] = useState(Number(anchor.slice(0,4)));
  const [month, setMonth] = useState(Number(anchor.slice(5,7)));
  const today = maxDate ?? usageToday();
  const prefix = `${year}-${String(month).padStart(2,'0')}`;
  const days = new Date(Date.UTC(year,month,0)).getUTCDate();
  const offset = (new Date(`${prefix}-01T12:00:00Z`).getUTCDay()+6)%7;
  const chooseMonth = (value: number) => {
    if (aggregation === 'Day') onSelect(`${year}-${String(value).padStart(2,'0')}-01`);
    else setMonth(value);
  };
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
      <View style={s.heading}><Text style={s.title}>{aggregation === 'Hour' ? 'Vælg dato' : aggregation === 'Day' ? 'Vælg måned' : 'Vælg år'}</Text><Pressable accessibilityLabel="Luk datovælger" onPress={onClose} style={s.cell}><Text style={s.text}>Luk</Text></Pressable></View>
      <ScrollView style={{ maxHeight: 480 }}>
        <View style={s.grid}>{years.filter(value => value <= Number(today.slice(0,4))).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: year === value }} onPress={() => { if (aggregation === 'Year' || aggregation === 'Month') onSelect(`${value}-01-01`); else { setYear(value); if (`${value}-${String(month).padStart(2,'0')}-01` > today) setMonth(Number(today.slice(5,7))); } }} style={[s.cell, year === value && s.active]}><Text style={s.text}>{value}</Text></Pressable>)}</View>
        {aggregation !== 'Month' ? <View style={s.grid}>{Array.from({length:12},(_,i)=>i+1).map(value => {
          const date = `${year}-${String(value).padStart(2,'0')}-01`;
          return <Pressable key={value} accessibilityRole="button" disabled={date > today} onPress={() => chooseMonth(value)} style={[s.month, month === value && s.active, date > today && s.disabled]}><Text style={s.text}>{new Intl.DateTimeFormat('da-DK',{month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}</Text></Pressable>;
        })}</View> : null}
        {aggregation === 'Hour' ? <View style={s.grid}>
          {['Ma','Ti','On','To','Fr','Lø','Sø'].map(day => <View key={day} style={s.day}><Text style={s.text}>{day}</Text></View>)}
          {Array.from({length: offset},(_,i)=><View key={`blank-${i}`} style={s.day}/>)}
          {Array.from({length:days},(_,i)=>i+1).map(day => {
            const date = `${prefix}-${String(day).padStart(2,'0')}`;
            return <Pressable key={day} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{selected: date === anchor}} disabled={date > today} onPress={() => onSelect(date)} style={[s.day, date === anchor && s.active, date > today && s.disabled]}><Text style={s.text}>{day}</Text></Pressable>;
          })}
        </View> : null}
      </ScrollView>
    </View></View>
  </Modal>;
}
const s=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.35)',alignItems:'center',justifyContent:'center',padding:20},
  dialog:{width:'100%',maxWidth:420,padding:20,borderRadius:20,backgroundColor:colors.white},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:18,fontFamily:'Nunito_700Bold',color:colors.ink},
  grid:{flexDirection:'row',flexWrap:'wrap',marginTop:16},cell:{padding:12,borderRadius:10,minWidth:60,alignItems:'center'},
  month:{width:'25%',paddingVertical:12,alignItems:'center',borderRadius:10},day:{width:'14.2857%',height:48,alignItems:'center',justifyContent:'center',borderRadius:10},
  text:{fontFamily:'Nunito_500Medium',color:colors.ink},active:{backgroundColor:colors.primarySoft},disabled:{opacity:0.3},
});
