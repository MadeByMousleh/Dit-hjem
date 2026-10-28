import {useEffect,useRef,type ReactNode} from 'react';
import {Animated,StyleSheet,View,type ViewProps} from 'react-native';
import {useMotionPreference} from '../hooks/useMotionPreference';
import {colors} from '../styles/theme';
export function SelectionSurface({selected,children,style,...props}:ViewProps&{selected:boolean;children:ReactNode}){
 const opacity=useRef(new Animated.Value(selected?1:0)).current,reduced=useMotionPreference();
 useEffect(()=>{opacity.stopAnimation();if(reduced){opacity.setValue(selected?1:0);return;}const animation=Animated.timing(opacity,{toValue:selected?1:0,duration:180,useNativeDriver:true});animation.start();return()=>animation.stop();},[opacity,selected,reduced]);
 return <View {...props} style={style}><Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderRadius:18,backgroundColor:colors.primarySoft,opacity}]}/>{children}</View>;
}
