import {useState} from 'react';
import {ActivityIndicator,View} from 'react-native';
import {AppModal} from './AppModal';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {SettingsDropdown} from './SettingsDropdown';
import {AppIcon} from './AppIcon';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
import type {useWasteReminder} from '../hooks/useWasteReminder';

export function WasteReminderCard({reminder}:{reminder:ReturnType<typeof useWasteReminder>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const {preference,ready,status}=reminder;
 const value=preference.enabled?`${preference.unit}:${preference.amount}`:'off';
 async function change(value:string){setBusy(true);try{const [unit,amount]=value.split(':');await reminder.update({enabled:value!=='off',amount:Number(amount)||1,unit:unit==='hours'?'hours':'days'});}finally{setBusy(false);}}
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel="Indstil affaldspåmindelse" onPress={()=>setOpen(true)} style={[cardStyles.card,{flexDirection:'row',alignItems:'center',gap:12}]}>
   <AppIcon name="bell" size={22} color={colors.primary}/><View style={{flex:1,gap:4}}><Text style={cardStyles.title}>Husk affaldet</Text><Text style={cardStyles.note}>{preference.enabled?`${preference.amount} ${preference.unit==='days'?'dag før':'time før'}`:'Få en påmindelse på telefonen'}</Text></View><AppIcon name="chevron-right" size={20} color={colors.muted}/>
  </Pressable>
  <AppModal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={{flex:1,justifyContent:'center',padding:20,backgroundColor:'rgba(0,0,0,0.35)'}}><View style={[cardStyles.card,{gap:16,marginBottom:0}]}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={cardStyles.title}>Affaldspåmindelse</Text><Pressable accessibilityRole="button" accessibilityLabel="Luk påmindelse" onPress={()=>setOpen(false)} style={{padding:12}}><AppIcon name="x" size={20} color={colors.ink}/></Pressable></View>
   <SettingsDropdown label="Giv mig besked" value={value} valueLabel={preference.enabled?`${preference.amount} ${preference.unit==='days'?(preference.amount===1?'dag':'dage'):(preference.amount===1?'time':'timer')} f\u00f8r`:'Ingen p\u00e5mindelse'} disabled={!ready||busy} options={[{value:'off',label:'Ingen påmindelse'},{value:'days:1',label:'1 dag før'},{value:'hours:1',label:'1 time før'},{value:'hours:3',label:'3 timer før'},{value:'days:2',label:'2 dage før'}]} onChange={v=>void change(v)}/>
   <Text style={cardStyles.note}>Vi regner fra kl. 07 på tømningsdagen. Kommunen oplyser ikke et præcist afhentningstidspunkt.</Text>
   {busy?<ActivityIndicator color={colors.primary}/>:null}<Text accessibilityLiveRegion="polite" style={cardStyles.note}>{status}</Text>
  </View></View></AppModal>
 </>;
}
