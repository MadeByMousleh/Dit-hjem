import {useEffect,useState} from 'react';
import {Animated,StyleSheet,View} from 'react-native';
import Svg,{Line,Path,Rect} from 'react-native-svg';
import {useMotionPreference} from '../hooks/useMotionPreference';

type Variant = 'card' | 'chart' | 'line-chart' | 'map';
type Props = {label?:string;rows?:number;variant?:Variant;compact?:boolean};
const shade='#E3E3EB', soft='#F1F1F5';
const bars=[.38,.55,.46,.72,.61,.86,.66,.49,.74,.58,.42,.64];

// A single native opacity animation, shared by all shapes in this placeholder.
export function LoadingState({label='Henter oplysninger…',rows=2,variant='card',compact=false}:Props){
 const [opacity]=useState(()=>new Animated.Value(1)),reduced=useMotionPreference();
 useEffect(()=>{
  opacity.stopAnimation();opacity.setValue(1);
  if(reduced)return;
  const animation=Animated.loop(Animated.sequence([
   Animated.timing(opacity,{toValue:.5,duration:850,useNativeDriver:true}),
   Animated.timing(opacity,{toValue:1,duration:850,useNativeDriver:true}),
  ]),{iterations:3});
  animation.start();return()=>animation.stop();
 },[opacity,reduced]);
 const chart=variant==='chart'||variant==='line-chart';
 return <View testID={`skeleton-${variant}`} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{busy:true}} aria-busy={true} style={s.root}>
  <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.shapes,{opacity}]}>
   <View style={[s.block,{width:'38%',height:compact?12:14}]}/>
   <View style={[s.block,{width:chart?'46%':'60%',height:compact?26:36,marginBottom:compact?2:6}]}/>
   {chart?<>
    <View style={{height:compact?130:180,width:'100%'}}>
     <Svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="none">
      {[24,82,140].map(y=><Line key={y} x1={0} x2={360} y1={y} y2={y} stroke={soft} strokeWidth={2}/>)}
      {variant==='chart'?bars.map((value,i)=><Rect key={i} x={i*30+4} y={160-value*140} width={20} height={value*140} rx={5} fill={shade}/>):<>
       <Path d="M4 116 C32 116 36 64 64 72 S112 128 142 94 S186 36 214 58 S254 108 284 66 S326 50 356 30" stroke={shade} strokeWidth={7} fill="none" strokeLinecap="round"/>
       <Path d="M4 152 C42 142 42 112 78 122 S126 156 162 132 S214 100 246 114 S306 130 356 98" stroke={shade} strokeOpacity={.55} strokeWidth={5} fill="none" strokeLinecap="round"/>
      </>}
     </Svg>
    </View>
    <View style={s.row}>{[0,1,2,3].map(i=><View key={i} style={[s.block,{height:8,width:'12%'}]}/>)}</View>
   </>:variant==='map'?<View style={s.map}>
    <View style={[s.road,{transform:[{rotate:'-24deg'}]}]}/><View style={[s.road,{transform:[{rotate:'36deg'}]}]}/>
    <View style={s.parcel}><View style={s.house}/></View>
   </View>:<>
    {!compact?<View style={s.row}>{[0,1].map(i=><View key={i} style={s.metric}><View style={[s.block,{width:'65%',height:10}]}/><View style={[s.block,{width:'85%',height:22}]}/></View>)}</View>:null}
    {Array.from({length:compact?1:Math.max(0,Math.min(6,rows))},(_,i)=><View key={i} style={[s.block,{height:compact?10:12,width:i%2?'58%':'86%'}]}/>)}
   </>}
  </Animated.View>
 </View>;
}
const s=StyleSheet.create({
 root:{width:'100%',paddingVertical:12},shapes:{gap:12},block:{backgroundColor:shade,borderRadius:7},
 row:{flexDirection:'row',justifyContent:'space-between',gap:18},metric:{flex:1,gap:10,paddingVertical:6},
 map:{height:220,borderRadius:18,backgroundColor:soft,overflow:'hidden',alignItems:'center',justifyContent:'center'},
 road:{position:'absolute',width:'130%',height:20,backgroundColor:'#FFFFFF'},
 parcel:{width:116,height:130,borderRadius:12,borderWidth:3,borderColor:shade,alignItems:'center',justifyContent:'center',transform:[{rotate:'-12deg'}]},
 house:{width:62,height:74,borderRadius:6,backgroundColor:shade},
});
