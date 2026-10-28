import {AppText as Text} from './AppText';
import {useEffect,useRef} from 'react';
import {ActivityIndicator,type StyleProp,type ViewStyle} from 'react-native';
import * as Haptics from 'expo-haptics';
import {HapticPressable} from './HapticPressable';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
export function ActionButton({label,busy=false,saved=false,disabled=false,onPress,style}:{label:string;busy?:boolean;saved?:boolean;disabled?:boolean;onPress:()=>void;style?:StyleProp<ViewStyle>}){
 const wasSaved=useRef(saved);
 useEffect(()=>{if(saved&&!wasSaved.current)void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});wasSaved.current=saved;},[saved]);
 return <HapticPressable accessibilityRole="button" accessibilityState={{busy,disabled:busy||disabled}} disabled={busy||disabled} onPress={onPress} style={[{minHeight:48,borderRadius:14,paddingHorizontal:16,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,opacity:disabled?.5:1},style]}>{busy?<ActivityIndicator color={colors.white}/>:null}<Text style={[cardStyles.body,{fontFamily:'Nunito_600SemiBold',color:colors.white}]}>{busy?'Gemmer…':saved?'✓ Gemt':label}</Text></HapticPressable>;
}
