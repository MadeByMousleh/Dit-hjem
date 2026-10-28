import {useState} from 'react';
import {Linking, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import * as Haptics from 'expo-haptics';
import {OpenSourceNotices} from './OpenSourceNotices';

/** Public business details, also available before login. No account data is read. */
export function PublisherInformation() {
  const [expanded, setExpanded] = useState(false);
  const [mailError, setMailError] = useState(false);
  const feedback = () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
  };
  const contact = async () => {
    feedback();
    setMailError(false);
    try { await Linking.openURL('mailto:info@huslyg.dk'); }
    catch { setMailError(true); }
  };
  return <View style={s.card}>
    <Pressable accessibilityRole="button" accessibilityLabel="Om Huslyg og kontakt" accessibilityState={{expanded}} aria-expanded={expanded}
      onPress={() => { feedback(); setExpanded(value => !value); }} style={s.heading}>
      <View style={s.headingCopy}><Text style={s.title}>Om Huslyg</Text><Text style={s.subtitle}>Udgiver og kontakt</Text></View>
      <Text style={s.toggle}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded ? <View style={s.details}>
      <Text style={s.label}>UDGIVER</Text>
      <Text selectable style={s.value}>BluePeach · CVR 40876375</Text>
      <Text selectable style={s.copy}>c/o Mohammed Mousleh{'\n'}Krog-Meyers Vej 28{'\n'}6400 Sønderborg, Danmark</Text>
      <Text style={s.label}>KONTAKT</Text>
      <Text style={s.value}>Huslyg-teamet</Text>
      <Text style={s.copy}>Spørgsmål om appen eller dine personoplysninger?</Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Skriv til info@huslyg.dk" onPress={() => void contact()} style={s.mail}>
        <Text selectable style={s.mailText}>info@huslyg.dk</Text>
      </Pressable>
      {mailError ? <Text accessibilityRole="alert" style={s.error}>Mailappen kunne ikke åbnes. Skriv til info@huslyg.dk fra din mail.</Text> : null}
      <OpenSourceNotices />
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  card: {backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E8EE', borderRadius: 24, marginTop: 20, overflow: 'hidden'},
  heading: {minHeight: 72, flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16},
  headingCopy: {flex: 1},
  title: {fontFamily: 'Nunito_700Bold', fontSize: 16, lineHeight: 23, color: '#3C3246'},
  subtitle: {fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, color: '#6158A4', marginTop: 2},
  toggle: {fontSize: 24, color: '#4158D8'},
  details: {paddingHorizontal: 20, paddingBottom: 20, gap: 8},
  label: {fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 1, color: '#6158A4', marginTop: 8},
  value: {fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 21, color: '#3C3246'},
  copy: {fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: '#3C3246'},
  mail: {minHeight: 48, justifyContent: 'center', alignItems: 'flex-start'},
  mailText: {fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 21, color: '#4158D8', textDecorationLine: 'underline'},
  error: {fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, color: '#B42318'},
});
