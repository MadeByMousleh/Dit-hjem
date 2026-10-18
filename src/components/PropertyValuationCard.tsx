import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../services/supabase';
import { colors } from '../styles/theme';
import { PropertyValueChart } from './PropertyValueChart';
type Assessment = { id: string; year: number; propertyValue: number | null; landValue: number | null; updatedAt: string | null };
type Result = { bfe: string; fetchedAt: string; source: string; notice: string; assessments: { id: string; latest: Assessment; history: Assessment[] }[] };
const memory = new Map<string, { at: number; result: Result }>();
const kroner = (value: number | null) => value === null ? 'Ikke oplyst' : `${value.toLocaleString('da-DK')} kr.`;
export function PropertyValuationCard({ bfe, showHistory=false }: { bfe: string; showHistory?: boolean }) {
  const [result,setResult]=useState<Result|null>(null), [loading,setLoading]=useState(true), [error,setError]=useState(''), [expanded,setExpanded]=useState(false), [refresh,setRefresh]=useState(0);
  useEffect(()=> {
    let active=true; const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),22000);
    const key=`${API_URL}:${bfe}`;
    setResult(null);setError('');setExpanded(showHistory);setLoading(true);
    void (async()=> {
      const cached=memory.get(key);
      if(refresh===0&&cached&&Date.now()-cached.at<3600000){setResult(cached.result);return;}
      const response=await fetch(`${API_URL}/api/address/search?${new URLSearchParams({mode:'valuation',bfe})}`,{signal:controller.signal,headers:{Accept:'application/json'}});
      const data=await response.json();
      if(!response.ok||data.bfe!==bfe||!Array.isArray(data.assessments)||data.assessments.some((group: Result['assessments'][number])=>!group.latest||!Array.isArray(group.history)||!Number.isInteger(group.latest.year)))throw new Error();
      if(active){setResult(data);if(memory.size>=16)memory.delete(memory.keys().next().value!);memory.set(key,{at:Date.now(),result:data});}
    })().catch(()=>{if(active)setError('Vurderingen kunne ikke hentes lige nu.');}).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
    return()=>{active=false;controller.abort();clearTimeout(timer);};
  },[bfe,refresh,showHistory]);
  return <View style={s.card}>
    <Text style={s.heading}>Offentlig vurdering</Text><Text style={s.note}>BFE {bfe} · Ejendommen</Text>
    {loading?<ActivityIndicator color={colors.primary}/>:null}
    {error?<><Text accessibilityRole="alert" style={s.note}>{error}</Text><Pressable accessibilityRole="button" style={s.link} onPress={()=>setRefresh(value=>value+1)}><Text style={s.action}>Prøv igen</Text></Pressable></>:null}
    {result&&!result.assessments.length?<Text style={s.note}>Der er ikke fundet en offentlig vurdering for denne ejendom i VUR.</Text>:null}
    {result?.assessments.map(group=><View key={group.id} style={s.group}>
      <Text style={s.year}>Vurderingsår {group.latest.year}</Text>
      {result.assessments.length>1?<Text style={s.note}>Vurderingsejendom {group.id} · Beløbene vises separat</Text>:null}
      <View style={s.values}><View style={s.amount}><Text style={s.note}>Ejendomsværdi</Text><Text selectable style={s.value}>{kroner(group.latest.propertyValue)}</Text></View><View style={s.amount}><Text style={s.note}>Grundværdi</Text><Text selectable style={s.value}>{kroner(group.latest.landValue)}</Text></View></View>
      {expanded?<><PropertyValueChart history={group.history}/>{group.history.slice(1).map(row=><View key={row.id} style={s.history}><Text style={s.historyYear}>{row.year}</Text><View style={s.historyValues}><Text style={s.note}>Ejendom {kroner(row.propertyValue)}</Text><Text style={s.note}>Grund {kroner(row.landValue)}</Text></View></View>)}</>:null}
    </View>)}
    {result?.assessments.some(group=>group.history.length>1)?<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={s.link}><Text style={s.action}>{expanded?'Skjul historik':'Se tidligere vurderinger'}</Text></Pressable>:null}
    {result?<><Text style={s.note}>{result.notice}</Text><Text style={s.note}>Vurderingen kan gælde flere boliger samlet. {result.source} · Hentet {new Date(result.fetchedAt).toLocaleDateString('da-DK')}</Text></>:null}
    <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL('https://www.vurderingsportalen.dk/').catch(()=>setError('Linket kunne ikke åbnes.'))} style={s.link}><Text style={s.action}>Kontrollér den aktuelle vurdering ↗</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({
  card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:10},heading:{fontFamily:'Nunito_700Bold',fontSize:18,color:colors.ink},
  note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},group:{gap:12,paddingVertical:8},
  year:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.primary},values:{flexDirection:'row',flexWrap:'wrap',gap:16},amount:{flexGrow:1,flexBasis:150,gap:4},
  value:{fontFamily:'Nunito_700Bold',fontSize:23,color:colors.ink},link:{minHeight:44,justifyContent:'center'},action:{fontFamily:'Nunito_700Bold',fontSize:13,color:colors.primary},
  history:{flexDirection:'row',flexWrap:'wrap',gap:12,paddingVertical:10,borderTopWidth:1,borderTopColor:colors.line},historyYear:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.ink},historyValues:{gap:4,flex:1},
});
