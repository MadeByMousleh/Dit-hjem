import {AppText as Text} from './AppText';
import {Disclosure} from './Disclosure';
import {cardStyles} from '../styles/cards';
import { AppIcon } from './AppIcon';
import { StyleSheet, View } from 'react-native';
import type { ElectricityMeter } from '../services/energy-vault';
import { colors } from '../styles/theme';

const readable = (value: string | null | undefined) => {
  const names: Record<string, string> = { PT15M: 'Hver 15. minut', PT1H: 'Timeaflæst', P1M: 'Månedsaflæst', D01: 'Flexafregnet', E01: 'Skabelonafregnet', E02: 'Timeafregnet' };
  return value ? names[value] ?? value : null;
};
const date = (value: string | null | undefined) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('da-DK', { timeZone: 'UTC' }) : null;

export function ElectricityDetailsCard({ meters }: { meters: ElectricityMeter[] }) {
  if (!meters.length) return null;
  return <View style={s.card}>
    <View style={s.heading}><View><Text style={s.title}>Eloplysninger</Text><Text style={s.subtitle}>Data fra ElOverblik</Text></View><AppIcon name="zap" size={20} color={colors.primary} /></View>
    {meters.map((meter, index) => {
      const details = meter.details;
      const values = [
        ['Målepunkt', meter.metering_point_id],
        ['Målernummer', details?.meterNumber],
        ['Netselskab', details?.gridOperatorName],
        ['Netområde', details?.gridArea],
        ['Balanceansvarlig', details?.balanceSupplierName],
        ['Start hos balanceansvarlig', date(details?.balanceSupplierStartDate)],
        ['Indflyttet', date(details?.consumerStartDate)],
        ['Aflæsning', readable(details?.meterReadingOccurrence)],
      ].filter((item): item is [string, string] => !!item[1]);
      return <View key={meter.id} style={[s.meter, index > 0 && s.meterDivider]}>
        {details?.address ? <View style={s.addressRow}><AppIcon name="map-pin" size={14} color={colors.primary} /><Text style={s.address}>{details.address}</Text></View> : null}
        <View style={s.grid}>{values.filter(([label])=>['Målepunkt','Netselskab'].includes(label)).map(([label, value]) => <View key={label} style={s.metric}><Text style={s.label}>{label}</Text><Text selectable style={s.value}>{value}</Text></View>)}</View>
        <Disclosure title="Tekniske måleroplysninger"><View style={s.grid}>{values.filter(([label])=>!['Målepunkt','Netselskab'].includes(label)).map(([label,value])=><View key={label} style={{width:'100%',paddingVertical:8}}><Text style={s.label}>{label}</Text><Text selectable style={s.value}>{value}</Text></View>)}</View></Disclosure>
        {!details ? <Text style={s.hint}>Stamdata hentes ved næste opdatering i mobilappen.</Text> : null}
      </View>;
    })}
  </View>;
}

const s = StyleSheet.create({
  card: cardStyles.card,
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: cardStyles.title,
  subtitle: {...cardStyles.note,marginTop:4},
  meter: { marginTop: 15 }, meterDivider: { paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 12 },
  address: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 13, color: colors.ink, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '47%', paddingVertical: 7 },
  label: cardStyles.label,
  value: {...cardStyles.body,fontFamily:'Nunito_700Bold',marginTop:4},
  hint: { fontFamily: 'Nunito_400Regular', fontSize:12, color: colors.muted, marginTop: 12 },
});
