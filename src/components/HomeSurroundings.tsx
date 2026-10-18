import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { loadProfile } from '../services/storage';
import { loadHomeContext, safeHomeLink, type HomeSource } from '../services/home-context';
import { colors } from '../styles/theme';

const lookups = [
  { title: 'Støj omkring boligen', source: 'Miljøstyrelsen', url: 'https://miljoegis.mim.dk/cbkort?profile=noise' },
  { title: 'Jordforurening og beskyttet natur', source: 'Danmarks Miljøportal · regionerne', url: 'https://danmarksarealinformation.miljoeportal.dk/' },
  { title: 'Fredning og bevaringsværdi', source: 'Slots- og Kulturstyrelsen', url: 'https://www.kulturarv.dk/fbb/' },
  { title: 'Energimærke og forbedringsforslag', source: 'Energistyrelsen', url: 'https://sparenergi.dk/energimaerke' },
  { title: 'Oversvømmelseskort', source: 'Kystdirektoratet', url: 'https://oversvommelse.kyst.dk/' },
];
export function HomeSurroundings({ address, userId, email, mode = 'all' }: { address: string; userId: string; email: string; mode?: 'all' | 'plans' | 'nearby' }) {
  const [sources, setSources] = useState<HomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [category,setCategory]=useState('all');
  const categories=[['all','Alle'],['transport','Transport'],['schools','Skoler'],['shopping','Indkøb'],['health','Sundhed'],['institutions','Dagtilbud'],['nature','Natur']];
  useEffect(() => {
    const controller = new AbortController();
    setSources([]); setError(''); setLoading(true);
    void (async () => {
      const saved = await loadProfile(userId, email);
      if (controller.signal.aborted) return;
      if (saved?.address !== address || saved.addressX === undefined || saved.addressY === undefined) throw new Error('Vælg adressen igen i Profil for at hente områdedata.');
      await loadHomeContext(saved.addressX, saved.addressY, controller.signal, source => setSources(current => [...current.filter(item => item.id !== source.id), source]), refresh > 0,mode);
    })().catch(() => { if (!controller.signal.aborted) setError('Områdedata kunne ikke hentes. Kontrollér adressen i Profil og prøv igen.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [address, userId, email, refresh,mode]);
  const open = (value: string) => { const url = safeHomeLink(value); if (url) void Linking.openURL(url).catch(() => setError('Linket kunne ikke åbnes.')); };
  const order = ['zone', 'local', 'proposed', 'municipal', 'nearby'];
  return <>
    <Text style={s.heading}>{mode==='plans'?'Planer og rammer':mode==='nearby'?'I nærheden':'Boligen og området'}</Text>
    <Text style={s.note}>Områdedata hentes fra offentlige kilder med din gemte adresses placering — ikke telefonens GPS.</Text>
    {loading ? <View style={s.card}><ActivityIndicator color={colors.primary} /><Text style={s.note}>Henter planer og steder i nærheden…</Text></View> : null}
    {sources.slice().sort((a, b) => order.indexOf(a.id)-order.indexOf(b.id)).map(source => <View key={source.id} style={s.card}>
      <Text style={s.title}>{source.title}</Text>
      {source.id==='nearby'?<View style={s.filters}>{categories.map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:category===id}} onPress={()=>setCategory(id!)} style={[s.filter,category===id&&s.activeFilter]}><Text style={[s.action,category===id&&{color:colors.white}]}>{label}</Text></Pressable>)}</View>:null}
      {source.status === 'unavailable' ? <Text style={s.note}>Kilden kunne ikke hentes. Det betyder ikke, at der ingen registreringer er.</Text> : !source.items.filter(item=>source.id!=='nearby'||category==='all'||item.category===category).length ? <Text style={s.note}>Ingen registreringer fundet i dette opslag{category!=='all'&&source.id==='nearby'?' i kategorien':''}.</Text> : source.items.filter(item=>source.id!=='nearby'||category==='all'||item.category===category).map((item, index) => <View key={`${item.title}:${index}`} style={s.item}>
        <Text selectable style={s.value}>{item.title}</Text>
        {item.detail ? <Text style={s.note}>{item.detail}</Text> : null}
        {item.facts?.map(fact=><View key={fact.label} style={s.fact}><Text style={s.note}>{fact.label}</Text><Text selectable style={s.value}>{fact.value}</Text></View>)}
        {item.url ? <Pressable accessibilityRole="link" onPress={() => open(item.url!)} style={s.link}><Text style={s.action}>{source.id === 'nearby' ? 'Se på kort' : 'Åbn plandokument'}</Text></Pressable> : null}
      </View>)}
      <Text style={s.note}>{source.note}</Text>
      <Pressable accessibilityRole="link" onPress={() => open(source.sourceUrl)} style={s.link}><Text style={s.action}>{source.source}</Text></Pressable>
      <Text style={s.note}>{source.status === 'ready' ? 'Hentet' : 'Forsøgt hentet'} {new Date(source.fetchedAt).toLocaleDateString('da-DK')}</Text>
    </View>)}
    {error ? <Text accessibilityRole="alert" style={s.note}>{error}</Text> : null}
    {!loading ? <Pressable accessibilityRole="button" onPress={() => setRefresh(value => value+1)} style={s.link}><Text style={s.action}>Opdater områdedata</Text></Pressable> : null}
    {mode!=='plans'?<View style={s.card}><Text style={s.title}>Miljø og energimærke</Text><Text style={s.note}>Åbner kildens hjemmeside. Disse oplysninger er ikke hentet eller vurderet automatisk i appen.</Text>
      {lookups.map(item => <Pressable key={item.title} accessibilityRole="link" onPress={() => open(item.url)} style={s.item}><Text style={s.action}>{item.title} ↗</Text><Text style={s.note}>{item.source}</Text></Pressable>)}
    </View>:<Text style={s.note}>Planoplysninger og uddrag kan have undtagelser. Se hele plandokumentet; tallene er ikke en byggetilladelse eller en beregning af resterende byggeret.</Text>}
  </>;
}
const s = StyleSheet.create({
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 10 },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: colors.ink },
  value: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.ink },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted },
  item: { gap: 4, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  link: { minHeight: 44, justifyContent: 'center' },
  action: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.primary },
  filters:{flexDirection:'row',flexWrap:'wrap',gap:6},filter:{minHeight:44,paddingHorizontal:12,borderRadius:14,justifyContent:'center',backgroundColor:colors.paper},activeFilter:{backgroundColor:colors.primary},fact:{gap:4,paddingVertical:8},
});
