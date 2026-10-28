import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import {Animated,Easing,View,type StyleProp,type ViewStyle} from 'react-native';
import {useMotionPreference} from '../hooks/useMotionPreference';
export const negativePriceGold='#967018';
const goldClock=createContext<Animated.Value|null>(null);
export function GoldMotionProvider({children}:{children:ReactNode}){
 const phase=useRef(new Animated.Value(.65)).current,reduced=useMotionPreference();
 useEffect(()=>{phase.stopAnimation();phase.setValue(.65);if(reduced)return;const loop=Animated.loop(Animated.sequence([Animated.timing(phase,{toValue:.85,duration:1400,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(phase,{toValue:.45,duration:1400,easing:Easing.inOut(Easing.sin),useNativeDriver:true})]),{iterations:2});loop.start(()=>phase.setValue(.65));return()=>loop.stop();},[phase,reduced]);
 return <goldClock.Provider value={phase}>{children}</goldClock.Provider>;
}
export function NegativePriceSpark({top,width,index}:{top:number;width:number;index:number}){
 const fallback=useRef(new Animated.Value(.65)).current,phase=useContext(goldClock)??fallback;
 return <Animated.View testID="negative-price-spark" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',top,left:(width-10)/2,width:10,height:10,alignItems:'center',justifyContent:'center',opacity:phase,transform:[{translateY:phase.interpolate({inputRange:[.45,.85],outputRange:[0,-1.5],extrapolate:'clamp'})}]}}><View style={{width:5,height:5,borderRadius:1,backgroundColor:negativePriceGold,transform:[{rotate:'45deg'}]}}/></Animated.View>;
}
export function NegativePriceBar({height,style}:{height:number;style:StyleProp<ViewStyle>}){
 const growth=useRef(new Animated.Value(height)).current,reduced=useMotionPreference();
 useEffect(()=>{growth.stopAnimation();if(reduced){growth.setValue(height);return;}const animation=Animated.timing(growth,{toValue:height,duration:320,easing:Easing.bezier(.16,1,.3,1),useNativeDriver:false});animation.start();return()=>animation.stop();},[height,growth,reduced]);
 return <Animated.View testID="negative-price-bar" style={[style,{height:growth}]}/>;
}
