import{memo,useId}from'react';
import{View}from'react-native';
import Svg,{Defs,Path,Pattern,Rect}from'react-native-svg';

// Forecasts share the published bars' zero baseline; diagonal stripes distinguish estimates.
export const ForecastPriceBar=memo(function ForecastPriceBar({valueY,zeroY,width,color,selected}:{valueY:number;zeroY:number;width:number;color:string;selected:boolean}){
 const id='forecastStripes'+useId().replace(/[^a-zA-Z0-9]/g,'');
 const top=Math.min(valueY,zeroY),height=Math.max(1,Math.abs(zeroY-valueY));
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',top,left:0,width,height}}>
  <Svg testID="forecast-price-bar" width={width} height={height}>
   <Defs><Pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse"><Path d="M-1 1 L1 -1 M0 6 L6 0 M5 7 L7 5" stroke={color} strokeWidth={1.5}/></Pattern></Defs>
   <Rect x={.5} y={.5} width={Math.max(0,width-1)} height={Math.max(0,height-1)} rx={3} fill={color} opacity={.14}/>
   <Rect x={.5} y={.5} width={Math.max(0,width-1)} height={Math.max(0,height-1)} rx={3} fill={`url(#${id})`} stroke={color} strokeWidth={selected?1.5:1}/>
  </Svg>
 </View>;
});
