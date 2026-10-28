import {PublisherInformation} from '../components/PublisherInformation';
import {AppText as Text} from '../components/AppText';
import {cardStyles} from '../styles/cards';
import {HapticPressable as Pressable} from '../components/HapticPressable';
import { useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { colors } from '../styles/theme';
import {resetSavedLogin} from '../services/supabase';

export function LoginScreen() {
  const auth = useHouseholdSession();
  // Enable only after the hosted OTP mail templates have been applied successfully.
  const codeEmails = process.env.EXPO_PUBLIC_AUTH_EMAIL_OTP_ENABLED === 'true';
  const [privacy, setPrivacy] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  return <SafeAreaView style={s.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
      <View style={s.card}>
        <AppIcon name="home" size={30} color={colors.primary} />
        <Text style={s.brand}>HUSLYG</Text>
        <Text style={s.title}>{auth.session ? 'Dit hjem er snart klar' : auth.codeSent ? 'Tjek din e-mail' : 'Dit hjem. Dit overblik.'}</Text>
        <Text style={s.copy}>{auth.session ? 'Vi henter dit hjem og dine gemte elaftaler.' : auth.codeSent ? codeEmails ? `Indtast koden, vi har sendt til ${auth.email.trim()}. Du bliver i appen, når du logger ind.` : `Vi har sendt en mail til ${auth.email.trim()}. Åbn linket for at logge ind. Hvis mailen indeholder en kode, kan du også indtaste den her.` : createAccount ? 'Opret en konto med din e-mail. Vi sender en bekræftelsesmail og opretter derefter dit hjem automatisk.' : 'Log ind med e-mailen til din eksisterende konto.'}</Text>
        {!auth.session ? <>
          {!auth.codeSent ? <><View style={s.choiceRow}><Pressable accessibilityRole="button" accessibilityState={{ selected: createAccount }} disabled={auth.authLoading} onPress={() => setCreateAccount(true)} style={[s.choice, createAccount && s.choiceActive]}><Text style={s.choiceText}>Opret konto</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: !createAccount }} disabled={auth.authLoading} onPress={() => setCreateAccount(false)} style={[s.choice, !createAccount && s.choiceActive]}><Text style={s.choiceText}>Log ind</Text></Pressable></View><Text style={[cardStyles.label,{marginTop:16}]}>E-mail</Text><TextInput accessibilityLabel="E-mail" autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!auth.authLoading} value={auth.email} onChangeText={auth.setEmail} placeholder="Din e-mail" placeholderTextColor={colors.muted} style={s.input} onSubmitEditing={() => void auth.authenticate(createAccount)} /></> : <><Text style={[cardStyles.label,{marginTop:16}]}>Engangskode</Text><TextInput accessibilityLabel="Engangskode" autoComplete="one-time-code" keyboardType="number-pad" editable={!auth.authLoading} value={auth.code} onChangeText={value => auth.setCode(value.replace(/\D/g, ''))} placeholder="Koden fra din e-mail" placeholderTextColor={colors.muted} style={s.input} onSubmitEditing={() => void auth.authenticate()} /></>}
          <Pressable accessibilityRole="button" disabled={auth.authLoading || !(auth.codeSent ? auth.code.trim() : auth.email.trim())} onPress={() => void auth.authenticate(createAccount)} style={[s.button, auth.authLoading && { opacity: 0.5 }]}><Text style={s.buttonText}>{auth.authLoading ? 'Vent lidt…' : auth.codeSent ? 'Bekræft og fortsæt' : createAccount ? 'Opret konto og send mail' : codeEmails ? 'Send engangskode' : 'Send login-mail'}</Text></Pressable>
          {auth.codeSent ? <Pressable accessibilityRole="button" disabled={auth.authLoading} onPress={() => { auth.setCodeSent(false); auth.setCode(''); }} style={s.link}><Text style={s.linkText}>Skift e-mail eller send en ny kode</Text></Pressable> : <Text style={s.note}>Du behøver ikke en adgangskode. Kontoen aktiveres først, når e-mailen er bekræftet.</Text>}
        </> : auth.authLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : null}
        {auth.authError ? <><Text accessibilityRole="alert" style={[s.copy, { color: colors.coral }]}>{auth.authError}</Text><Pressable onPress={auth.retry} style={s.link}><Text style={s.linkText}>Prøv forbindelsen igen</Text></Pressable></> : null}
        {auth.session ? <Pressable onPress={() => void auth.signOut()} style={s.link}><Text style={s.linkText}>Log ud</Text></Pressable> : null}
        {auth.authError&&!auth.session?<Pressable accessibilityRole="button" onPress={()=>{void resetSavedLogin().then(auth.retry).catch(()=>auth.retry());}} style={s.link}><Text style={s.linkText}>Nulstil gemt login på denne enhed</Text></Pressable>:null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: privacy }} onPress={() => setPrivacy(value => !value)} style={s.privacy}><AppIcon name="lock" size={15} color={colors.primary} /><Text style={s.linkText}>Sådan adskiller vi konto og eldata</Text></Pressable>
        {privacy ? <Text style={s.note}>Dine målinger og elaftaler gemmes under et tilfældigt husstands-id, uden navn eller e-mail på målingerne. En separat adgangstabel forbinder din konto med dit hjem. Data er derfor ikke anonyme. Nye konti får ingen adgang til eksisterende elmålere.</Text> : null}
        <PublisherInformation />
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', padding:20, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  brand: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: colors.primary, marginTop: 12 }, title: { fontFamily: 'Nunito_600SemiBold', fontSize: 30, color: colors.ink, marginTop: 14 },
  copy: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 12 },
  input: {fontFamily:'Nunito_500Medium',fontSize:16, minHeight: 50, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, color: colors.ink, marginTop: 22 },
  button: { minHeight: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, buttonText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.white },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 20 }, choice: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 }, choiceActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, choiceText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: colors.primary },
  link: { minHeight:48, justifyContent: 'center', marginTop: 8 }, linkText: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: colors.primary }, note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 12 }, privacy: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 20, marginTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
});
