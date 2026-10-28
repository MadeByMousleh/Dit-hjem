import {AppText as Text} from './AppText';
import {} from 'react-native';
import {MotionView} from './Motion';
import {HapticPressable} from './HapticPressable';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
export function InlineStatus({message,error=false,onRetry}:{message:string;error?:boolean;onRetry?:()=>void}){
 return <MotionView style={{gap:8,paddingVertical:8}}><Text accessibilityRole={error?'alert':undefined} style={[cardStyles.note,error&&{color:colors.error}]}>{message}</Text>{onRetry?<HapticPressable accessibilityRole="button" onPress={onRetry} style={{minHeight:48,justifyContent:'center'}}><Text style={[cardStyles.body,{color:colors.primary}]}>Prøv igen</Text></HapticPressable>:null}</MotionView>;
}
