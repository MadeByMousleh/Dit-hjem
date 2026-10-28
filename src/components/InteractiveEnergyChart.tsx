import {chartPalette} from '../styles/chartPalette';
import {AppText as Text} from './AppText';
﻿import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {PanResponder,Pressable,StyleSheet,View} from 'react-native';
import Svg,{Circle,Defs,LinearGradient,Line,Path,Rect,Stop,Text as SvgText} from 'react-native-svg';
import {tickSelection} from '../utils/barScrub';
import {colors} from '../styles/theme';
import type {ChartKind} from './ChartAppearance';
type Point={label:string;value:number|null};
type Props={points:Point[];selected:number;onSelect:(index:number)=>void;kind:ChartKind;compact?:boolean;hideYAxis?:boolean;highlight?:{start:number;end:number};onScrubChange?:(active:boolean)=>void};
const WIDTH=360;
const plotBounds=(wide?:boolean)=>wide?{left:10,right:350}:{left:48,right:340};
export function InteractiveEnergyChart(props:Props){
 const {left:LEFT,right:RIGHT}=plotBounds(props.hideYAxis),TOP=props.hideYAxis?12:26;
 const BOTTOM=props.compact?132:184,boxHeight=props.compact?174:226;
 const latest=useRef(props);latest.current=props;
 const gradient='energy'+useId().replace(/[^a-zA-Z0-9]/g,'');
 const viewport=useRef<View>(null),pageX=useRef(0),width=useRef(1),selected=useRef(props.selected);selected.current=props.selected;
 const [dragging,setDragging]=useState(false);
 const barDragging=useRef(false),suppressTapUntil=useRef(0);
 const select=(index:number)=>{const n=Math.max(0,Math.min(latest.current.points.length-1,index));if(n<0||n===selected.current)return;selected.current=n;tickSelection();latest.current.onSelect(n);};
 const at=(px:number)=>{const {left,right}=plotBounds(latest.current.hideYAxis);return Math.round(((px-pageX.current)/width.current*WIDTH-left)/(right-left)*Math.max(1,latest.current.points.length-1));};
 const selectAtPageX=(px:number)=>viewport.current?.measureInWindow(x=>{pageX.current=x;select(at(px));});
 const end=()=>{if(barDragging.current)suppressTapUntil.current=Date.now()+250;barDragging.current=false;setDragging(false);latest.current.onScrubChange?.(false);};
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:event=>{if(latest.current.kind==='bars')return false;const touch=event.nativeEvent.locationX/width.current*WIDTH;const {left,right}=plotBounds(latest.current.hideYAxis);const handle=left+latest.current.selected/Math.max(1,latest.current.points.length-1)*(right-left);return Math.abs(touch-handle)<24;},
  onMoveShouldSetPanResponder:(_,g)=>latest.current.kind==='bars'?barDragging.current:Math.abs(g.dx)>7&&Math.abs(g.dx)>Math.abs(g.dy)*1.3,
  onMoveShouldSetPanResponderCapture:()=>latest.current.kind==='bars'&&barDragging.current,
  onPanResponderGrant:event=>{const px=event.nativeEvent.pageX;setDragging(true);tickSelection();latest.current.onScrubChange?.(true);viewport.current?.measureInWindow(x=>{pageX.current=x;select(at(px));});},
  onPanResponderMove:event=>select(at(event.nativeEvent.pageX)),onPanResponderRelease:end,onPanResponderTerminate:end,onPanResponderTerminationRequest:()=>false,
 }),[]);
 useEffect(()=>()=>latest.current.onScrubChange?.(false),[]);
 const {ticks,x,y,zero,lines,fills,barStep,labelIndices}=useMemo(()=>{
 const values=props.points.map(p=>p.value).filter((v):v is number=>v!==null&&Number.isFinite(v));
 const rawMin=Math.min(0,...values),rawMax=Math.max(0,...values),rough=(rawMax-rawMin||1)/4;
 const magnitude=10**Math.floor(Math.log10(rough)),normalized=rough/magnitude;
 const step=(normalized<=1?1:normalized<=2?2:normalized<=5?5:10)*magnitude;
 const min=Math.floor(rawMin/step)*step,max=Math.max(min+step,Math.ceil(rawMax/step)*step),range=max-min;
 const ticks=Array.from({length:Math.round(range/step)+1},(_,i)=>min+i*step);
 const x=(i:number)=>LEFT+Math.max(0,Math.min(props.points.length-1,i))/Math.max(1,props.points.length-1)*(RIGHT-LEFT),y=(v:number)=>BOTTOM-(v-min)/range*(BOTTOM-TOP),zero=y(0);

 const lines:string[]=[],fills:string[]=[];let segment='',start=0,last=0,previous=0;
 const close=()=>{if(segment){lines.push(segment);fills.push(`${segment} L${x(last)} ${zero} L${x(start)} ${zero} Z`);segment='';}};
 if(props.kind!=='bars')props.points.forEach((p,i)=>{
  if(p.value===null){close();return;}
  if(!segment){start=i;segment=`M${x(i)} ${y(p.value)} `;}
  else segment+=props.kind==='area'?`L${x(i)} ${y(previous)} L${x(i)} ${y(p.value)} `:`L${x(i)} ${y(p.value)} `;
  previous=p.value;last=i;
 });close();
 const barStep=(RIGHT-LEFT)/Math.max(1,props.points.length);
 const labelIndices=new Set(Array.from({length:Math.min(5,props.points.length)},(_,i)=>Math.round(i*Math.max(0,props.points.length-1)/Math.max(1,Math.min(5,props.points.length)-1))));
 return {ticks,x,y,zero,lines,fills,barStep,labelIndices};
 },[props.points,props.kind,LEFT,RIGHT,TOP,BOTTOM]);
 const selectedValue=props.points[props.selected]?.value;
 return <View style={s.container}>
  <View ref={viewport} collapsable={false} style={[s.chart,{aspectRatio:360/boxHeight}]} onLayout={e=>{width.current=e.nativeEvent.layout.width;}} {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={props.selected<0?'Forbrugsgraf. Vælg et punkt.':`${props.points[props.selected]?.label??''}: ${props.points[props.selected]?.value==null?'Ingen data':props.points[props.selected]!.value!.toLocaleString('da-DK')+' kWh'}`}  accessibilityValue={{min:0,max:Math.max(0,props.points.length-1),now:Math.max(0,props.selected)}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={e=>select(props.selected+(e.nativeEvent.actionName==='increment'?1:-1))}>
   <Pressable accessible={false} style={{flex:1}} delayLongPress={25}
    onLongPress={props.kind==='bars'?event=>{barDragging.current=true;suppressTapUntil.current=Date.now()+1000;setDragging(true);latest.current.onScrubChange?.(true);selectAtPageX(event.nativeEvent.pageX);}:undefined}
    onPress={props.kind==='bars'?event=>{if(Date.now()>=suppressTapUntil.current)selectAtPageX(event.nativeEvent.pageX);}:undefined}
    onTouchEnd={props.kind==='bars'?end:undefined} onTouchCancel={props.kind==='bars'?end:undefined}>
   <Svg width="100%" height="100%" viewBox={`0 0 360 ${boxHeight}`}>
    <Defs><LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.primary} stopOpacity={0.3}/><Stop offset="1" stopColor={colors.primary} stopOpacity={0.025}/></LinearGradient></Defs>
    {!props.hideYAxis?<SvgText x={LEFT} y={12} fill={colors.muted} fontSize={10}>kWh</SvgText>:null}
    {ticks.map(v=><Line key={v} x1={LEFT} x2={RIGHT} y1={y(v)} y2={y(v)} stroke={colors.line} strokeOpacity={props.hideYAxis?0.45:1} strokeWidth={1}/>)}
    {!props.hideYAxis&&ticks.map(v=><SvgText key={v} x={LEFT-10} y={y(v)+4} textAnchor="end" fontSize={11} fill={colors.muted}>{v.toLocaleString('da-DK',{maximumFractionDigits:2})}</SvgText>)}
    {props.highlight?<><Rect x={x(props.highlight.start)} y={TOP} width={Math.max(0,x(props.highlight.end)-x(props.highlight.start))} height={BOTTOM-TOP} fill="#D89743" opacity={0.08}/>{[props.highlight.start,props.highlight.end].map(i=><Line key={i} x1={x(i)} x2={x(i)} y1={TOP} y2={BOTTOM} stroke="#A66B20" strokeWidth={1.5} strokeDasharray="2 4"/>)}</>:null}
    {props.kind==='area'?fills.map((d,i)=><Path key={i} d={d} fill={`url(#${gradient})`} stroke="none"/>):null}
    {props.kind==='bars'?props.points.map((p,i)=>p.value===null?null:<Rect key={i} x={x(i)-Math.min(14,barStep*.7)/2} y={Math.min(zero,y(p.value))} width={Math.min(14,barStep*.7)} height={Math.max(p.value!==0?1:0,Math.abs(y(p.value)-zero))} rx={3} fill={i===props.selected?chartPalette.selectedConsumption:chartPalette.consumption}/>):lines.map((d,i)=><Path key={i} d={d} fill="none" stroke={chartPalette.line} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"/>)}
    {props.kind==='line'&&props.points.length<=36?props.points.map((p,i)=>p.value===null?null:<Circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill={colors.white} stroke={colors.primary} strokeWidth={1.5}/>):null}
    {selectedValue!=null?<><Line x1={x(props.selected)} x2={x(props.selected)} y1={TOP} y2={BOTTOM} stroke={colors.primary} strokeOpacity={0.5} strokeDasharray="3 4"/><Circle cx={x(props.selected)} cy={y(selectedValue)} r={dragging?14:11} fill={colors.primary} opacity={0.12}/><Circle cx={x(props.selected)} cy={y(selectedValue)} r={dragging?8:6} fill={colors.primary} stroke={colors.white} strokeWidth={2.5}/></>:null}
    {props.points.map((p,i)=>labelIndices.has(i)?<SvgText key={i} x={x(i)} y={BOTTOM+25} fill={i===props.selected?colors.primary:colors.muted} fontSize={11} textAnchor={props.hideYAxis?(i===0?"start":i===props.points.length-1?"end":"middle"):"middle"}>{p.label}</SvgText>:null)}
    {props.kind!=='bars'?props.points.map((_,i)=><Rect key={i} x={x(i)-Math.max(6,barStep/2)} y={TOP-10} width={Math.max(12,barStep)} height={BOTTOM-TOP+10} fill="transparent" onPress={()=>select(i)}/>):null}
   </Svg>
   </Pressable>
  </View>
  {props.selected<0?<Text style={s.hint}>Tryk på grafen for at vælge</Text>:null}
 </View>;
}
const s=StyleSheet.create({container:{gap:4},chart:{width:'100%',aspectRatio:360/226},hint:{alignSelf:'center',fontFamily:'Nunito_400Regular',fontSize:11,color:colors.muted}});
