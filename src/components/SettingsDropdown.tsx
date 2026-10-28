import {useState} from 'react';
import {ActivityIndicator,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {AppText as Text} from './AppText';
import {AppIcon} from './AppIcon';
import {HapticPressable as Pressable} from './HapticPressable';
import {colors} from '../styles/theme';

export function SettingsDropdown({label,value,valueLabel,options,onChange,disabled=false,loading=false,searchable=false}:{label:string;value?:string;valueLabel?:string;options:readonly {value:string;label:string;detail?:string}[];onChange:(value:string)=>void;disabled?:boolean;loading?:boolean;searchable?:boolean}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const selected=options.find(option=>option.value===value);
 const matches=options.filter(option=>(option.label+' '+(option.detail??'')).toLocaleLowerCase('da').includes(query.toLocaleLowerCase('da')));
 return <View style={s.group}>
  <Text style={s.label}>{label}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${valueLabel??selected?.label??'Vælg'}`} accessibilityState={{expanded:open,disabled:disabled||loading}} disabled={disabled||loading} onPress={()=>{setOpen(v=>!v);setQuery('');}} style={[s.field,open&&s.focused]}>
   <Text style={s.value}>{valueLabel??selected?.label??'Vælg'}</Text>
   {loading?<ActivityIndicator size="small" color={colors.primary}/>:<AppIcon name={open?'chevron-up':'chevron-down'} size={20} color={colors.muted}/>}
  </Pressable>
  {open?<View style={s.menu}>
   {searchable?<View style={s.search}><AppIcon name="search" size={18} color={colors.muted}/><TextInput accessibilityLabel={`Søg ${label.toLocaleLowerCase('da')}`} placeholder="Søg netselskab" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.searchInput}/></View>:null}
   <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:216}}>
    {matches.map(option=><Pressable key={option.value} accessibilityRole="radio" accessibilityState={{checked:value===option.value}} onPress={()=>{setOpen(false);setQuery('');onChange(option.value);}} style={[s.option,value===option.value&&s.selected]}>
     <View style={{flex:1,gap:2}}><Text style={s.optionText}>{option.label}</Text>{option.detail?<Text style={s.detail}>{option.detail}</Text>:null}</View>
     {value===option.value?<AppIcon name="check" size={18} color={colors.primary}/>:null}
    </Pressable>)}
    {!matches.length?<Text style={[s.detail,{padding:14}]}>Ingen resultater</Text>:null}
   </ScrollView>
  </View>:null}
 </View>;
}
const s=StyleSheet.create({
 group:{gap:8},label:{fontFamily:'Nunito_700Bold',fontSize:13,lineHeight:18,color:colors.ink},
 field:{minHeight:48,paddingHorizontal:14,paddingVertical:12,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.white,flexDirection:'row',alignItems:'center',gap:12},
 focused:{borderColor:colors.primary},value:{flex:1,fontFamily:'Nunito_600SemiBold',fontSize:14,lineHeight:20,color:colors.ink},
 menu:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:12,overflow:'hidden'},
 search:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:colors.line},searchInput:{flex:1,minHeight:44,fontFamily:'Nunito_400Regular',fontSize:14,color:colors.ink},
 option:{minHeight:48,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12},selected:{backgroundColor:colors.primarySoft},
 optionText:{fontFamily:'Nunito_600SemiBold',fontSize:14,lineHeight:20,color:colors.ink},detail:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},
});
