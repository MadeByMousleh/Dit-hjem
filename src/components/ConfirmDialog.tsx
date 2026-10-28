import {AppText as Text} from './AppText';
import {View} from 'react-native';
import {AppModal} from './AppModal';
import {HapticPressable} from './HapticPressable';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
export function ConfirmDialog({visible,title,message,busy,onCancel,onConfirm}:{visible:boolean;title:string;message:string;busy:boolean;onCancel:()=>void;onConfirm:()=>void}){
 return <AppModal visible={visible} transparent onRequestClose={()=>{if(!busy)onCancel();}}><View style={{flex:1,justifyContent:'center',padding:20,backgroundColor:'rgba(60,50,70,.28)'}}><View accessibilityViewIsModal style={[cardStyles.inset,{width:'100%',maxWidth:420,alignSelf:'center',gap:16}]}><Text style={cardStyles.title}>{title}</Text><Text style={cardStyles.body}>{message}</Text><View style={{flexDirection:'row',gap:12}}><HapticPressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:colors.paper}}><Text style={cardStyles.body}>Fortryd</Text></HapticPressable><HapticPressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:colors.error}}><Text style={[cardStyles.body,{color:colors.white}]}>{busy?'Sletter…':'Slet'}</Text></HapticPressable></View></View></View></AppModal>;
}
