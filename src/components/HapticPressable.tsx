import {useRef,useState} from 'react';
import {Animated,Pressable,type PressableProps} from 'react-native';
import {tickSelection} from '../utils/barScrub';
import {useMotionPreference} from '../hooks/useMotionPreference';
const AnimatedPressable=Animated.createAnimatedComponent(Pressable);
export function HapticPressable({onPress,onPressIn,onPressOut,style,disabled,...props}:PressableProps){
 const scale=useRef(new Animated.Value(1)).current,reduced=useMotionPreference();
 const [pressed,setPressed]=useState(false);
 const animate=(toValue:number,duration:number)=>{scale.stopAnimation();if(reduced){scale.setValue(1);return;}Animated.timing(scale,{toValue,duration,useNativeDriver:true}).start();};
 return <AnimatedPressable {...props} disabled={disabled}
  style={[typeof style==='function'?style({pressed}):style,{transform:[{scale}]}]}
  onPress={event=>{if(!disabled){tickSelection();onPress?.(event);}}}
  onPressIn={event=>{if(typeof style==='function')setPressed(true);if(!disabled)animate(.985,80);onPressIn?.(event);}}
  onPressOut={event=>{if(typeof style==='function')setPressed(false);animate(1,140);onPressOut?.(event);}}/>;
}
