import {useEffect,useRef,useState} from 'react';
import {Modal,StyleSheet,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {HapticPressable as Pressable} from './HapticPressable';
import {AppIcon} from './AppIcon';
import {colors} from '../styles/theme';
export type ChartKind='line'|'bars'|'area';
export function useChartAppearance(key:string,initial:ChartKind='line'){
 const [kind,setKind]=useState<ChartKind>(initial),changed=useRef(false);
 useEffect(()=>{let alive=true;void AsyncStorage.getItem('chart-appearance-v1:'+key).then(value=>{if(alive&&!changed.current&&['line','bars','area'].includes(value??''))setKind(value as ChartKind);}).catch(()=>{});return()=>{alive=false;};},[key]);
 return {kind,setKind:(value:ChartKind)=>{changed.current=true;setKind(value);void AsyncStorage.setItem('chart-appearance-v1:'+key,value).catch(()=>{});}};
}
export function ChartAppearance({kind,onChange,label}:{kind:ChartKind;onChange:(kind:ChartKind)=>void;label:string}){
 const [open,setOpen]=useState(false);
 return <><Pressable accessibilityRole="button" accessibilityLabel={`Grafindstillinger: ${label}`} onPress={()=>setOpen(true)} style={s.settings}><AppIcon name="sliders" size={19} color={colors.primary}/></Pressable>
  <Modal transparent visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><View style={s.backdrop}><Pressable accessibilityLabel="Luk grafindstillinger" onPress={()=>setOpen(false)} style={StyleSheet.absoluteFill}/><View style={s.sheet} accessibilityViewIsModal><Text style={s.title}>{label}</Text><Text style={s.note}>Vælg din visning</Text>{([['line','Kurve','Se udviklingen og de tydelige toppe'],['bars','Søjler','Sammenlign hver time eller periode'],['area','Areal','Få overblik over forbrugets eller prisens niveau']] as const).map(([value,title,description])=><Pressable key={value} accessibilityRole="radio" aria-checked={kind===value} accessibilityState={{checked:kind===value}} onPress={()=>{onChange(value);setOpen(false);}} style={[s.option,kind===value&&s.selected]}><View style={{flex:1}}><Text style={s.optionTitle}>{title}</Text><Text style={s.note}>{description}</Text></View>{kind===value?<AppIcon name="check" size={18} color={colors.primary}/>:null}</Pressable>)}<Pressable onPress={()=>setOpen(false)} style={s.close}><Text style={s.optionTitle}>Luk</Text></Pressable></View></View></Modal></>;
}
const s=StyleSheet.create({settings:{width:44,height:44,alignItems:'center',justifyContent:'center'},backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'#0006'},sheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:36,gap:10},title:{fontFamily:'Nunito_700Bold',fontSize:20,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,color:colors.muted,lineHeight:18},option:{minHeight:70,flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:14,backgroundColor:colors.paper},selected:{backgroundColor:colors.primarySoft},optionTitle:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.ink},close:{minHeight:44,alignItems:'center',justifyContent:'center'}});
