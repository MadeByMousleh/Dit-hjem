import {useEffect,useRef} from 'react';
import {ActivityIndicator,Animated,View} from 'react-native';
import {useMotionPreference} from '../hooks/useMotionPreference';
import {colors} from '../styles/theme';
export function SettingSwitch({checked,busy=false}:{checked:boolean;busy?:boolean}){
 const value=useRef(new Animated.Value(checked?1:0)).current,reduced=useMotionPreference();
 useEffect(()=>{value.stopAnimation();if(reduced){value.setValue(checked?1:0);return;}const animation=Animated.timing(value,{toValue:checked?1:0,duration:160,useNativeDriver:false});animation.start();return()=>animation.stop();},[checked,reduced,value]);
 return <View style={{flexDirection:'row',alignItems:'center',gap:8}}>{busy?<ActivityIndicator size="small" color={colors.primary}/>:null}<Animated.View style={{width:52,height:32,padding:3,borderRadius:16,backgroundColor:value.interpolate({inputRange:[0,1],outputRange:[colors.line,colors.primary]})}}><Animated.View style={{width:26,height:26,borderRadius:13,backgroundColor:colors.white,transform:[{translateX:value.interpolate({inputRange:[0,1],outputRange:[0,20]})}]}}/></Animated.View></View>;
}
