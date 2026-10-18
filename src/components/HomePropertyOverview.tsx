import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import proj4 from 'proj4';
import { AppIcon } from './AppIcon';
import { loadProfile } from '../services/storage';
import { colors } from '../styles/theme';
import { HomePhotoGallery } from './HomePhotoGallery';
import { PropertyValuationCard } from './PropertyValuationCard';

type Field = { key: string; label: string; value: string };
type Property = { valuationBfeNumbers?: string[]; sections: { title: string; records: { fields: Field[] }[] }[] };
export function HomePropertyOverview({ property, address, userId, email, section='overview' }: { property: Property | null; address: string; userId?: string; email?: string; section?: 'overview'|'address'|'valuation' }) {
  const [location, setLocation] = useState<{ x: number; y: number; municipality?: string; postcode?: string } | null>(null);
  const [linkError, setLinkError] = useState('');
  const legacyBfes=[...new Set(property?.sections.filter(section=>section.title==='Ejendomsoplysninger').flatMap(section=>section.records).flatMap(record=>record.fields.filter(field=>field.key.toLowerCase()==='bfenummer').map(field=>field.value))??[])];
  const bfes=(property?.valuationBfeNumbers??(legacyBfes.length===1?legacyBfes:[])).filter(value=>/^[1-9]\d{0,14}$/.test(value)).slice(0,10);
  useEffect(() => {
    let active = true;
    setLocation(null); setLinkError('');
    if (userId && section!=='valuation') void loadProfile(userId, email).then(saved => {
      if (active && saved?.address === address && Number.isFinite(saved.addressX) && Number.isFinite(saved.addressY)) setLocation({ x: saved.addressX!, y: saved.addressY!, municipality: saved.municipalityCode, postcode: saved.postcode });
    }).catch(() => {});
    return () => { active = false; };
  }, [address, userId, email,section]);
  const find = (section: string, prefix: string) => {
    const records = property?.sections.filter(item => item.title === section).flatMap(item => item.records) ?? [];
    // Never pick one arbitrary dwelling/building when the address has multiple matches.
    if (records.length !== 1) return undefined;
    return records[0]?.fields.find(field => field.key.toLowerCase().startsWith(prefix))?.value;
  };
  const unitArea = find('Din bolig / enhed', 'enh027');
  const buildingArea = find('Bygningen', 'byg039');
  const area = unitArea ?? buildingArea;
  const rooms = find('Din bolig / enhed', 'enh031');
  const year = find('Bygningen', 'byg026');
  const floors = find('Bygningen', 'byg054');
  const heat = find('Bygningen', 'byg056');
  const heating: Record<string, string> = { '1': 'Fjernvarme', '2': 'Centralvarme', '5': 'Varmepumpe', '6': 'Centralvarme', '7': 'Elvarme', '9': 'Ingen varmeinstallation' };
  const stats = [
    { label: unitArea ? 'Boligareal' : 'Bygningens boligareal', value: area === undefined ? '—' : `${Number(area).toLocaleString('da-DK')} m²` },
    { label: 'Værelser i boligen', value: rooms ?? '—' },
    { label: 'Byggeår', value: year ?? '—' },
    { label: 'Etager i bygningen', value: floors ?? '—' },
    ...(find('Din bolig / enhed','enh066')!==undefined?[{label:'Badeværelser',value:find('Din bolig / enhed','enh066')!}]:[]),
    ...(find('Din bolig / enhed','enh065')!==undefined?[{label:'Toiletter',value:find('Din bolig / enhed','enh065')!}]:[]),
  ];
  const open = (url: string) => void Linking.openURL(url).catch(() => setLinkError('Linket kunne ikke åbnes.'));
  let photoUrl = 'https://skraafoto.dataforsyningen.dk/';
  if (location) {
    const [east, north] = proj4('EPSG:4326', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs', [location.x, location.y]);
    photoUrl += `?center=${east.toFixed(2)},${north.toFixed(2)}`;
  }
  return <>
    {section==='overview'?<>
    {location ? <HomePhotoGallery key={`${address}:${userId}`} x={location.x} y={location.y} viewerUrl={photoUrl} /> : <View style={s.photo}>
      <View style={s.photoIcon}><AppIcon name="home" size={38} color={colors.primary} /></View>
      <Text style={s.photoTitle}>Se boligen fra oven</Text>
      <Text style={s.note}>Vælg en præcis adresse i Profil for at hente billeder.</Text>
      <Pressable accessibilityRole="link" onPress={() => open(photoUrl)} style={s.button}><Text style={s.buttonText}>Åbn officielle skråfotos</Text><AppIcon name="external-link" size={17} color={colors.white} /></Pressable>
    </View>}
    {property ? <>
      <View style={s.stats}>{stats.map(item => <View key={item.label} style={s.stat}><Text selectable style={s.statValue}>{item.value}</Text><Text style={s.note}>{item.label}</Text></View>)}</View>
      {heat ? <View style={s.inline}><AppIcon name="home" size={19} color={colors.primary} /><Text style={s.strong}>{heating[heat] ?? 'Varmeinstallation'}</Text><Text style={s.note}>Registreret i BBR</Text></View> : null}
    </> : null}
    </>:null}
    {section!=='valuation'?<View style={s.card}>
      <Text style={s.heading}>Adressen</Text>
      <Text selectable style={s.strong}>{address}</Text>
      {location?.postcode ? <View style={s.row}><Text style={s.note}>Postnummer</Text><Text style={s.strong}>{location.postcode}</Text></View> : null}
      {location?.municipality ? <View style={s.row}><Text style={s.note}>Kommunekode</Text><Text style={s.strong}>{location.municipality}</Text></View> : null}
      {location ? <><View style={s.row}><Text style={s.note}>Koordinater · WGS84</Text><Text selectable style={s.strong}>{location.y.toFixed(5)}, {location.x.toFixed(5)}</Text></View><Pressable accessibilityRole="link" style={s.link} onPress={() => open(`https://www.openstreetmap.org/?mlat=${location.y}&mlon=${location.x}#map=18/${location.y}/${location.x}`)}><Text style={s.action}>Se adressen på kort ↗</Text></Pressable></> : null}
    </View>:null}
    {section!=='address'?bfes.map(bfe=><PropertyValuationCard key={bfe} bfe={bfe} showHistory={section==='valuation'}/>):null}
    {section!=='address'&&!bfes.length?<View style={s.card}>
      <Text style={s.heading}>Offentlig vurdering</Text>
      <Text style={s.note}>{property?'Ejendommens BFE-nummer kunne ikke matches entydigt. Vi viser ikke en anden ejendoms vurdering.':'Vurderingen hentes, når ejendommen er fundet i BBR.'}</Text>
      <Pressable accessibilityRole="link" onPress={() => open('https://www.vurderingsportalen.dk/')} style={s.link}><Text style={s.action}>Se hos Vurderingsportalen ↗</Text></Pressable>
    </View>:null}
    {linkError ? <Text accessibilityRole="alert" style={s.note}>{linkError}</Text> : null}
  </>;
}
const s = StyleSheet.create({
  photo: { borderRadius: 24, padding: 24, gap: 12, backgroundColor: colors.white, alignItems: 'flex-start' },
  photoIcon: { width: 76, height: 76, backgroundColor: colors.paper, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  photoTitle: { fontFamily: 'Nunito_700Bold', fontSize: 24, color: colors.ink },
  button: { minHeight: 48, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.white, flexShrink: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.white, borderRadius: 20, padding: 18, gap: 4 },
  statValue: { fontFamily: 'Nunito_700Bold', fontSize: 26, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 12 },
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: colors.ink },
  strong: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.ink, flexShrink: 1 },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 16 },
  link: { minHeight: 44, justifyContent: 'center' }, action: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.primary },
});
