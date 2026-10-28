import {useState} from 'react';
import {ScrollView,View} from 'react-native';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {AppModal} from './AppModal';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
import notices from '../generated/open-source-notices.json';
export function OpenSourceNotices(){
 const[visible,setVisible]=useState(false),[chosen,setChosen]=useState<number|null>(null);
 const item=chosen===null?null:notices[chosen];
 return <>
  <Pressable accessibilityRole="button" onPress={()=>setVisible(true)} style={{minHeight:48,justifyContent:'center'}}><Text style={{...cardStyles.body,color:colors.primary}}>Open source og licenser</Text></Pressable>
  <AppModal visible={visible} onRequestClose={()=>{if(chosen!==null)setChosen(null);else setVisible(false);}}>
   <ScrollView contentContainerStyle={{padding:24,paddingTop:56,gap:16,backgroundColor:colors.paper}}>
    <Pressable accessibilityRole="button" onPress={()=>{if(chosen!==null)setChosen(null);else setVisible(false);}} style={{minHeight:48,justifyContent:'center'}}><Text style={{...cardStyles.body,color:colors.primary}}>{item?'Til licensoversigten':'Luk'}</Text></Pressable>
    <Text style={cardStyles.title}>{item?item.name:'Open source og licenser'}</Text>
    {item?item.notices.map((notice,index)=><View key={index} style={{gap:8}}><Text style={cardStyles.body}>{notice.file}</Text><Text selectable style={cardStyles.note}>{notice.text}</Text></View>):notices.map((notice,index)=><Pressable key={index} accessibilityRole="button" onPress={()=>setChosen(index)} style={{minHeight:48,justifyContent:'center'}}><Text style={cardStyles.body}>{notice.name} · {notice.version}</Text></Pressable>)}
   </ScrollView>
  </AppModal>
 </>;
}
