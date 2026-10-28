import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Animated,Easing,StyleSheet,View,Text as NativeText,type TextProps,type ViewProps} from 'react-native';
import {useMotionPreference} from '../hooks/useMotionPreference';

export const motionEase=Easing.bezier(.16,1,.3,1);
/** Exact values change synchronously; animation only settles their presentation. */
const metricNumber=(text:string)=>Number((text.match(/[-−]?[0-9][0-9.,]*/)?.[0]??'').replaceAll('.','').replace(',','.').replace('−','-'));
const metricParts=(text:string)=>text.match(/^([^0-9−-]*)([−-]?[0-9][0-9.,]*)(.*)$/);
export function AnimatedMetric({value,fast=false,style,...props}:TextProps&{value:string;fast?:boolean}){
 const reduced=useMotionPreference(),progress=useRef(new Animated.Value(1)).current,previous=useRef(value);
 const [outgoing,setOutgoing]=useState<string|null>(null),[direction,setDirection]=useState(1);
 const parts=metricParts(value),font=StyleSheet.flatten(style),height=font?.lineHeight??Math.ceil((font?.fontSize??24)*1.35);
 useLayoutEffect(()=>{
  if(previous.current===value){progress.stopAnimation();progress.setValue(1);setOutgoing(null);return;}
  const old=previous.current;previous.current=value;progress.stopAnimation();
  if(reduced||!metricParts(old)||!metricParts(value)){setOutgoing(null);progress.setValue(1);return;}
  setOutgoing(old);setDirection(metricNumber(value)>=metricNumber(old)?1:-1);progress.setValue(0);
  const animation=Animated.timing(progress,{toValue:1,duration:fast?110:170,easing:motionEase,useNativeDriver:true});
  animation.start(({finished})=>{if(finished)setOutgoing(null);});return()=>animation.stop();
 },[value,fast,reduced,progress]);
 if(!parts)return <NativeText {...props} style={style}>{value}</NativeText>;
 const old=outgoing?metricParts(outgoing)?.[2]:null;
 return <View accessible accessibilityLabel={props.accessibilityLabel??value} style={{flexDirection:'row',alignItems:'baseline',maxWidth:'100%'}}>
 {parts[1]?<NativeText style={style}>{parts[1]}</NativeText>:null}
 <View style={{overflow:'hidden',height,flexShrink:1}}>
  <NativeText {...props} accessible={false} accessibilityElementsHidden style={[style,{opacity:0,lineHeight:height,fontVariant:['tabular-nums']}]}>{parts[2]}</NativeText>
  {old&&!reduced?<Animated.Text accessible={false} importantForAccessibility="no-hide-descendants" style={[style,{position:'absolute',top:0,left:0,lineHeight:height,fontVariant:['tabular-nums'],opacity:progress.interpolate({inputRange:[0,1],outputRange:[.7,0]}),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[0,-direction*height]})}]}]}>{old}</Animated.Text>:null}
  <Animated.Text {...props} accessible={false} style={[style,{position:'absolute',top:0,left:0,lineHeight:height,fontVariant:['tabular-nums'],opacity:reduced?1:progress.interpolate({inputRange:[0,1],outputRange:[.7,1]}),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[reduced?0:direction*height,0]})}]}]}>{parts[2]}</Animated.Text>
 </View>
 {parts[3]?<NativeText style={[style,{fontSize:Math.min(font?.fontSize??14,14),lineHeight:20}]}>{parts[3]}</NativeText>:null}
 </View>;
}
export function MotionView({children,style,variant='card',delay=0,...props}:ViewProps&{children?:ReactNode;variant?:'card'|'page'|'sheet'|'fade';delay?:number}){
 const reduced=useMotionPreference(),progress=useRef(new Animated.Value(1)).current,revealed=useRef(false);
 useEffect(()=>{
  if(reduced||revealed.current){progress.setValue(1);return;}
  revealed.current=true;progress.setValue(0);
  const animation=Animated.timing(progress,{toValue:1,duration:variant==='sheet'?280:variant==='page'||variant==='fade'?110:220,delay,easing:motionEase,useNativeDriver:true});
  animation.start();return()=>animation.stop();
 },[reduced,progress,variant,delay]);
 const travel=reduced||variant==='fade'||variant==='page'?0:variant==='sheet'?32:8;
 return <Animated.View {...props} style={[style,{opacity:progress,transform:[variant==='page'?{translateX:progress.interpolate({inputRange:[0,1],outputRange:[travel,0]})}:{translateY:progress.interpolate({inputRange:[0,1],outputRange:[travel,0]})}]}]}>{children}</Animated.View>;
}
