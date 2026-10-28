import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {StyleSheet,TextInput,View} from 'react-native';
import {colors} from '../styles/theme';
export function PriceLimitFields({cheap,expensive,onCheap,onExpensive,disabled}:{cheap:string;expensive:string;onCheap:(v:string)=>void;onExpensive:(v:string)=>void;disabled:boolean}){
 return <View style={s.group}><Text style={s.title}>Dine prisgrænser</Text><Text style={s.note}>Farverne følger altid pris inkl. net og afgifter. Kr./kWh.</Text>
  <Text style={s.label}>Billig strøm under</Text><TextInput accessibilityLabel="Billig strøm under, kr. pr. kWh" keyboardType="decimal-pad" value={cheap} onChangeText={onCheap} editable={!disabled} style={s.input}/>
  <Text style={s.note}>Normalpris ligger mellem de to grænser.</Text>
  <Text style={s.label}>Dyr strøm fra</Text><TextInput accessibilityLabel="Dyr strøm fra, kr. pr. kWh" keyboardType="decimal-pad" value={expensive} onChangeText={onExpensive} editable={!disabled} style={s.input}/>
 </View>;
}
const s=StyleSheet.create({group:{gap:8},title:{fontFamily:'Nunito_700Bold',fontSize:16,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},label:{fontFamily:'Nunito_700Bold',fontSize:13,color:colors.ink},input:{borderWidth:1,borderColor:colors.line,borderRadius:12,paddingHorizontal:14,minHeight:48,fontFamily:'Nunito_600SemiBold',fontSize:17,color:colors.ink,backgroundColor:colors.white}});
