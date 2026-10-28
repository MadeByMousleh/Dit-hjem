import {AppText as Text} from './AppText';
import {useState,type ReactNode} from 'react';
import {LayoutAnimation,View} from 'react-native';
import {HapticPressable} from './HapticPressable';
import {AppIcon} from './AppIcon';
import {MotionView} from './Motion';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
export function Disclosure({title,children}:{title:string;children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <View><HapticPressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>{LayoutAnimation.configureNext({duration:220,update:{type:'easeInEaseOut'}});setOpen(!open);}} style={{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><Text style={[cardStyles.body,{color:colors.primary,flex:1}]}>{title}</Text><AppIcon name={open?'chevron-up':'chevron-down'} size={20} color={colors.primary}/></HapticPressable>{open?<MotionView style={{gap:8,paddingBottom:8}}>{children}</MotionView>:null}</View>;
}
