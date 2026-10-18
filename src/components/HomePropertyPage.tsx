import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { HomeSurroundings } from './HomeSurroundings';
import { HomePropertyOverview } from './HomePropertyOverview';
import { HomeBuildingTimeline } from './HomeBuildingTimeline';
import { HomePropertyInsights, HomeEnergyLabel } from './HomePropertyInsights';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { loadProfile } from '../services/storage';
import { API_URL } from '../services/supabase';
import { colors } from '../styles/theme';
import {HouseSceneInteraction} from './HouseSceneInteraction';

type Field = { key: string; label: string; value: string };
type RecordInfo = { id: string; fields: Field[] };
type Property = { addressId: string; address: string; fetchedAt: string; source: string; valuationBfeNumbers?: string[]; sections: { title: string; records: RecordInfo[] }[]; warnings: string[] };
const heating: Record<string, string> = { '1': 'Fjernvarme / blokvarme', '2': 'Centralvarme med ét fyr', '3': 'Ovn til fast eller flydende brændsel', '5': 'Varmepumpe', '6': 'Centralvarme med to fyr', '7': 'Elvarme', '8': 'Gasradiator', '9': 'Ingen varmeinstallation', '99': 'Blandet' };
const buildingUse: Record<string, string> = { '110': 'Stuehus', '120': 'Fritliggende enfamiliehus', '121': 'Sammenbygget enfamiliehus', '122': 'Enfamiliehus i tæt-lav bebyggelse', '130': 'Rækkehus, kædehus eller dobbelthus', '131': 'Rækkehus, kædehus eller klyngehus', '132': 'Dobbelthus', '140': 'Etageboligbygning', '150': 'Kollegium', '160': 'Boligbygning til døgninstitution', '185': 'Anneks til helårsbolig', '190': 'Anden helårsbeboelse', '510': 'Sommerhus', '540': 'Kolonihavehus', '910': 'Garage', '920': 'Carport', '930': 'Udhus', '940': 'Drivhus', '950': 'Overdækning', '960': 'Udestue', '990': 'Faldefærdig bygning', '999': 'Ukendt anvendelse' };
const codes: Record<string, Record<string, string>> = {
  byg021: buildingUse,
  enh020: { ...buildingUse, '140': 'Bolig i etageejendom eller flerfamiliehus', '150': 'Kollegiebolig', '160': 'Bolig i døgninstitution' },
  byg056: heating,
  byg032: { '1': 'Mursten', '2': 'Letbetonsten', '3': 'Fibercement, herunder asbest', '4': 'Bindingsværk', '5': 'Træ', '6': 'Betonelementer', '8': 'Metal', '10': 'Fibercement uden asbest', '11': 'Plast', '12': 'Glas', '80': 'Ingen', '90': 'Andet materiale' },
  byg033: { '1': 'Tagpap, lille hældning', '2': 'Tagpap, stor hældning', '3': 'Fibercement, herunder asbest', '4': 'Betontagsten', '5': 'Tegl', '6': 'Metal', '7': 'Stråtag', '10': 'Fibercement uden asbest', '11': 'Plast', '12': 'Glas', '20': 'Grønt tag', '80': 'Ingen', '90': 'Andet materiale' },
  byg057: { '1': 'Elektricitet', '2': 'Gasværksgas', '3': 'Flydende brændsel', '4': 'Fast brændsel', '6': 'Halm', '7': 'Naturgas', '9': 'Andet' },
  enh032: { A: 'Toilet uden for boligen', B: 'Intet vandskyllende toilet', T: 'Toilet i boligen' },
  enh033: { C: 'Adgang til badeværelse', D: 'Ingen adgang til badeværelse', V: 'Badeværelse i boligen' },
};
function formatted(field: Field) {
  const mapping = codes[field.key.toLowerCase().slice(0, 6)];
  if (mapping) return mapping[field.value] ?? `BBR-kode ${field.value}`;
  if (/areal/i.test(field.label) && /^\d+(\.\d+)?$/.test(field.value)) return `${Number(field.value).toLocaleString('da-DK')} m²`;
  if (field.value === 'true') return 'Ja';
  if (field.value === 'false') return 'Nej';
  return field.value;
}
function fieldLabel(field:Field){
  const names:Record<string,string>={bfenummer:'BFE-nummer',ejendomsnummer:'Ejendomsnummer',kommunekode:'Kommunekode',ejendomstype:'Ejendomstype · registerkode',status:'Status · registerkode',samletfastejendom:'Samlet fast ejendom',ejendommensejerforholdskode:'Ejerforhold · registerkode'};
  return names[field.key.toLowerCase()]??field.label.match(/prefLabel\s*\(da\):\s*(.*?)(?:\s+(?:altLabel|definition|comment|note)\b|$)/i)?.[1]??field.label;
}
function RecordDetails({ record }: { record: RecordInfo }) {
  const [expanded, setExpanded] = useState(false);
  const important = /^(byg(007|021|026|027|032|033|038|039|040|041|054|056|057)|enh(020|026|027|028|031|032|033|034|065|066)|gru(009|010)|tek(007|020|024|028))/i;
  const main = record.fields.filter(field => important.test(field.key));
  const rest = record.fields.filter(field => !important.test(field.key));
  const shown = main.length ? main : record.fields;
  return <View style={s.record}>
    {shown.map(field => <View key={field.key} style={s.row}><Text style={s.label}>{fieldLabel(field)}</Text><Text selectable style={s.value}>{formatted(field)}</Text></View>)}
    {main.length && rest.length ? <><Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={s.more}><Text style={s.action}>{expanded ? 'Vis færre oplysninger' : `Alle registrerede oplysninger (${rest.length} flere)`}</Text><AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.primary} /></Pressable>{expanded ? rest.map(field => <View key={field.key} style={s.row}><Text style={s.label}>{fieldLabel(field)}</Text><Text selectable style={s.value}>{formatted(field)}</Text></View>) : null}</> : null}
    {!record.fields.length ? <Text style={s.note}>Ingen yderligere oplysninger registreret.</Text> : null}
  </View>;
}
export function HomePropertyPage({ address, selected, onBack, navigation }: { address: string; selected: boolean; onBack: () => void; navigation: ReactNode }) {
  const auth = useHouseholdSession();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [tab,setTab]=useState('overview');
  const scroll=useRef<ScrollView>(null);
  const [sceneActive,setSceneActive]=useState(false);
  const sceneInteraction=useCallback((active:boolean)=>{scroll.current?.setNativeProps({scrollEnabled:!active});setSceneActive(active);},[]);
  useEffect(()=>{sceneInteraction(false);},[tab,selected,address,sceneInteraction]);
  const tabs=[['overview','Overblik'],['unit','Bolig'],['building','Bygning'],['plot','Grund'],['sun','Hus & sol'],['plans','Planer'],['history','Historik'],['area','Område']];
  useEffect(()=>setTab('overview'),[address,auth.session?.user.id]);
  useEffect(() => { const back = BackHandler.addEventListener('hardwareBackPress', () => { if(tab!=='overview'){setTab('overview');scroll.current?.scrollTo({y:0,animated:false});}else onBack(); return true; }); return () => back.remove(); }, [onBack,tab]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setProperty(null); setError(''); setLoading(false);
    if (!selected || !address || !auth.session?.user.id) return () => { active = false; controller.abort(); };
    setLoading(true);
    void (async () => {
      const saved = await loadProfile(auth.session!.user.id, auth.session!.user.email ?? '');
      const params = new URLSearchParams({ mode: 'bbr', q: address });
      if (saved?.address === address && saved.addressId) params.set('id', saved.addressId);
      const response = await fetch(`${API_URL}/api/address/search?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Boligens BBR-oplysninger kunne ikke hentes.');
      if (!Array.isArray(result.sections) || !result.fetchedAt) throw new Error('Boligopslaget er endnu ikke tilgængeligt. Prøv igen senere.');
      if (active) setProperty(result);
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'BBR kunne ikke hentes.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [address, selected, auth.session?.user.id, auth.householdId, refresh]);
  const sectionTitles:Record<string,string[]>={unit:['Din bolig / enhed'],building:['Bygningen','Etager','Opgange','Tekniske anlæg'],plot:['Grunden','Øvrige bygninger på grunden','Ejendomsoplysninger']};
  const visibleSections=property?.sections.filter(section=>sectionTitles[tab]?.includes(section.title))??[];
  return <SafeAreaView style={s.page} edges={['top']}><ScrollView ref={scroll} scrollEnabled={!sceneActive} stickyHeaderIndices={[2]} contentContainerStyle={s.content}>
    <View style={s.heading}><Pressable accessibilityRole="button" accessibilityLabel="Tilbage til Profil" onPress={onBack} style={s.back}><AppIcon name="chevron-left" size={23} color={colors.ink} /></Pressable><Text style={s.title}>Mit hjem</Text></View>
    <View style={s.hero}><Text style={s.address}>{address || 'Ingen adresse valgt'}</Text><Text style={s.note}>Din bolig · ejendom · område</Text></View>
    <View style={s.tabsBar}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{tabs.map(([id,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id,disabled:!selected}} disabled={!selected} onPress={()=>{setTab(id!);scroll.current?.scrollTo({y:0,animated:false});}} style={[s.tab,tab===id&&s.activeTab]}><Text style={[s.action,tab===id&&{color:colors.white}]}>{label}</Text></Pressable>)}</ScrollView></View>
    {selected && address && (tab==='overview'||tab==='history'||tab==='area') ? <HomePropertyOverview key={tab} section={tab==='history'?'valuation':tab==='area'?'address':'overview'} property={property} address={address} userId={auth.session?.user.id} email={auth.session?.user.email ?? ''} /> : null}
    {tab==='history'?<HomeBuildingTimeline property={property}/>:null}
    {property?.addressId&&['overview','plot','sun','area'].includes(tab)?<HouseSceneInteraction.Provider value={sceneInteraction}><HomePropertyInsights key={`${property.addressId}:${tab}`} addressId={property.addressId} view={tab==='sun'?'sun':tab==='area'?'air':'map'}/></HouseSceneInteraction.Provider>:null}
    {property&&['overview','building'].includes(tab)?property.sections.find(section=>section.title==='Bygningen')?.records.map(record=><HomeEnergyLabel key={record.id} buildingId={record.id}/>):null}
    {!selected || !address ? <View style={s.card}><Text style={s.section}>Vælg din adresse</Text><Text style={s.note}>Vælg en præcis adresse under Profil, så oplysningerne matcher din bolig.</Text><Pressable onPress={onBack} style={s.more}><Text style={s.action}>Tilbage til Profil</Text></Pressable></View> : null}
    {loading ? <View style={s.card}><ActivityIndicator color={colors.primary} /><Text style={s.note}>Henter oplysninger om din bolig…</Text></View> : null}
    {error ? <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRefresh(value => value + 1)} style={s.more}><Text style={s.action}>Prøv igen</Text></Pressable></View> : null}
    {visibleSections.map((section, index) => <View key={`${section.title}:${index}`} style={s.card}><Text style={s.section}>{section.title === 'Grunden' ? 'Ejendom og grund' : section.title === 'Din bolig / enhed' ? 'Din bolig' : section.title}</Text>{section.title === 'Bygningen' ? <Text style={s.note}>Oplysninger om hele bygningen, som kan indeholde flere boliger.</Text> : null}{section.records.map((record, recordIndex) => <RecordDetails key={`${record.id}:${recordIndex}`} record={record} />)}</View>)}
    {property&&sectionTitles[tab]&&!visibleSections.length?<View style={s.card}><Text style={s.note}>Ingen oplysninger fundet i BBR for denne del af adressen.</Text></View>:null}
    {tab==='plot'?<Text style={s.note}>Matrikelareal og skel stammer fra Matriklen. Resterende byggeret er ikke beregnet.</Text>:null}
    {property && !property.sections.length ? <View style={s.card}><Text style={s.note}>Der er ikke fundet BBR-oplysninger for denne adresse.</Text></View> : null}
    {property?.warnings.map(warning => <Text key={warning} style={s.note}>{warning}</Text>)}
    {property ? <Text style={s.note}>{property.source} · Hentet {new Date(property.fetchedAt).toLocaleDateString('da-DK')}. Oplysningerne er registrerede forhold og kan afvige fra boligens aktuelle indretning.</Text> : null}
    {sectionTitles[tab]?<Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://bbr.dk/ret')} style={s.more}><Text style={s.action}>Se eller ret oplysninger hos BBR</Text><AppIcon name="external-link" size={16} color={colors.primary} /></Pressable>:null}
    {selected && address && auth.session?.user.id && (tab==='area'||tab==='plans') ? <HomeSurroundings key={tab} mode={tab==='plans'?'plans':'nearby'} address={address} userId={auth.session.user.id} email={auth.session.user.email ?? ''} /> : null}
  </ScrollView>{navigation}</SafeAreaView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 32 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: colors.ink }, hero: { gap: 8, paddingVertical: 12 }, address: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 12 }, section: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: colors.ink }, record: { gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, color: colors.muted, flexGrow: 1, flexShrink: 1, flexBasis: '48%' },
  value: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: colors.ink, flexGrow: 1, flexShrink: 1, flexBasis: '40%' },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted }, more: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  action: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.primary, flexShrink: 1 }, error: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.error },
  tabsBar:{backgroundColor:colors.paper,paddingVertical:8},tabs:{gap:6},tab:{minHeight:44,paddingHorizontal:14,borderRadius:14,justifyContent:'center',backgroundColor:colors.white},activeTab:{backgroundColor:colors.primary},
});
