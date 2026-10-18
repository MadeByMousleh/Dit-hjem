import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';
type Property={sections:{title:string;records:{id:string;fields:{key:string;label:string;value:string}[]}[]}[]};
export function HomeBuildingTimeline({property}:{property:Property|null}){
  const events=property?.sections.flatMap(section=>section.records.flatMap((record,index)=>record.fields.flatMap(field=>{
    const key=field.key.toLowerCase();let title='';
    if(key.startsWith('byg026'))title='Bygningen opført';
    if(key.startsWith('byg027'))title='Registreret ombygning / tilbygning';
    if(key.startsWith('tek024'))title='Teknisk anlæg etableret';
    if(key.startsWith('tek025'))title='Teknisk anlæg ombygget';
    const year=Number(field.value);
    if(!title||!Number.isInteger(year)||year<1700||year>new Date().getFullYear())return[];
    return[{id:`${section.title}:${record.id}:${index}:${key}`,title,year,scope:section.title==='Øvrige bygninger på grunden'?'Øvrig bygning på grunden':section.title}];
  })))??[];
  events.sort((a,b)=>b.year-a.year||a.title.localeCompare(b.title));
  return <View style={s.card}><Text style={s.heading}>Bygningens historie</Text>
    {!events.length?<Text style={s.note}>{property?'Ingen årstal registreret i de hentede BBR-oplysninger.':'Henter BBR-oplysninger…'}</Text>:events.map(event=><View key={event.id} style={s.row}><View style={s.track}><View style={s.dot}/></View><View style={s.detail}><Text style={s.year}>{event.year}</Text><Text style={s.title}>{event.title}</Text><Text style={s.note}>{event.scope}</Text></View></View>)}
    <Text style={s.note}>Registrerede årstal fra BBR — ikke en komplet historik over renoveringer eller en vurdering af boligens stand.</Text>
  </View>;
}
const s=StyleSheet.create({card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:12},heading:{fontFamily:'Nunito_700Bold',fontSize:18,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},row:{flexDirection:'row',gap:12},track:{width:14,alignItems:'center',paddingTop:6},dot:{width:10,height:10,borderRadius:5,backgroundColor:colors.primary},detail:{flex:1,gap:4,paddingBottom:12},year:{fontFamily:'Nunito_700Bold',fontSize:20,color:colors.primary},title:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.ink}});
