import {useRef,useState} from 'react';
import {Image,PanResponder,View} from 'react-native';
export function ZoomImage({uri,label}:{uri:string;label:string}){
 const [transform,setTransform]=useState({scale:1,x:0,y:0});
 const current=useRef(transform);current.current=transform;
 const start=useRef({scale:1,x:0,y:0,distance:0}),bounds=useRef({width:1,height:1});
 const responder=useRef(PanResponder.create({onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,onPanResponderGrant:e=>{const t=e.nativeEvent.touches;start.current={...current.current,distance:t.length>1?Math.hypot(t[1]!.pageX-t[0]!.pageX,t[1]!.pageY-t[0]!.pageY):0};},onPanResponderMove:(e,g)=>{const t=e.nativeEvent.touches;let scale=start.current.scale;if(t.length>1){const distance=Math.hypot(t[1]!.pageX-t[0]!.pageX,t[1]!.pageY-t[0]!.pageY);if(!start.current.distance){start.current={...current.current,distance};return;}scale=Math.max(1,Math.min(4,start.current.scale*distance/start.current.distance));}const mx=(scale-1)*bounds.current.width/2,my=(scale-1)*bounds.current.height/2;setTransform({scale,x:Math.max(-mx,Math.min(mx,start.current.x+(t.length>1?0:g.dx))),y:Math.max(-my,Math.min(my,start.current.y+(t.length>1?0:g.dy)))});},onPanResponderRelease:()=>{start.current.distance=0;},onPanResponderTerminationRequest:()=>false})).current;
 return <View onLayout={e=>{bounds.current=e.nativeEvent.layout;}} style={{flex:1,overflow:'hidden'}} {...responder.panHandlers}><Image accessibilityLabel={label} source={{uri}} resizeMode="contain" style={{width:'100%',height:'100%',transform:[{translateX:transform.x},{translateY:transform.y},{scale:transform.scale}]}}/></View>;
}
