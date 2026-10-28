import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Platform,ScrollView,TextInput,View} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {AppModal} from './AppModal';
import {useEnergyVault} from './EnergyVaultGate';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import {accountPrivacy,type DeletionHome} from '../services/account-privacy';
import {eraseAccountDeviceData} from '../services/account-device-cleanup';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';

export function AccountPrivacyControls(){
 const auth=useHouseholdSession(),vault=useEnergyVault();
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[homes,setHomes]=useState<DeletionHome[]|null>(null),[successors,setSuccessors]=useState<Record<string,string>>({}),[confirmation,setConfirmation]=useState(''),[deleted,setDeleted]=useState(false);
 const current=useRef(auth.session?.user.id);current.current=auth.session?.user.id;
 const mounted=useRef(true);useEffect(()=>()=>{mounted.current=false;},[]);
 async function exportEnergy(){
  if(busy)return;setBusy(true);setError('');let path:string|undefined;
  const actor=current.current;
  try{
   const data=await vault.exportCurrentData();
   if(current.current!==actor||!mounted.current)throw Error('Eksporten blev stoppet efter kontoskift.');
   const text=JSON.stringify({...data,explanation:'Personlige energidata for den valgte husstand. kWh er energi; tidsstempler angiver den gemte periode. Kvalitetsflag og null angiver datamangler. Indeholder ikke passwords, sessions- eller gendannelsesnøgler.'},null,2);
   if(Platform.OS==='web'){
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='huslyg-energidata.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   }else{
    if(!FileSystem.cacheDirectory||!await Sharing.isAvailableAsync())throw Error('Filen kan ikke deles på denne enhed.');
    if(current.current!==actor||!mounted.current)throw Error('Eksporten blev stoppet efter kontoskift.');
    path=FileSystem.cacheDirectory+'huslyg-energidata-'+Date.now()+'.json';await FileSystem.writeAsStringAsync(path,text,{encoding:FileSystem.EncodingType.UTF8});
    if(current.current!==actor||!mounted.current)throw Error('Eksporten blev stoppet efter kontoskift.');
    await Sharing.shareAsync(path,{mimeType:'application/json',UTI:'public.json',dialogTitle:'Gem dine energidata'});
   }
  }catch(e){if(mounted.current&&current.current===actor)setError(e instanceof Error?e.message:'Eksporten kunne ikke gennemføres.');}
  finally{if(path)await FileSystem.deleteAsync(path,{idempotent:true}).catch(()=>{});if(mounted.current)setBusy(false);}
 }
 async function preview(){
  setVisible(true);setBusy(true);setError('');setHomes(null);setConfirmation('');setSuccessors({});const actor=current.current;
  try{const result=await accountPrivacy('preview');if(mounted.current&&current.current===actor)setHomes(result.homes??[]);}catch(e){if(mounted.current&&current.current===actor)setError(e instanceof Error?e.message:'Kontrollen kunne ikke gennemføres.');}finally{if(mounted.current)setBusy(false);}
 }
 async function remove(){
  if(busy||confirmation!=='SLET MIN KONTO'||!homes||homes.some(home=>home.needsSuccessor&&!successors[home.householdId]))return;
  const actor=current.current;setBusy(true);setError('');
  try{
   const result=await accountPrivacy('delete',{confirmation,successors});if(!result.deleted)throw Error('Sletningen er ikke bekræftet.');
   vault.close();
   if(mounted.current&&current.current===actor)setDeleted(true);
   await eraseAccountDeviceData(actor!,homes.map(home=>home.householdId),auth.session?.user.email);
   if(mounted.current&&current.current===actor){setHomes(null);await auth.signOut();}
  }catch(e){if(mounted.current&&current.current===actor)setError(e instanceof Error?e.message:'Kontosletningen kunne ikke gennemføres.');}finally{if(mounted.current)setBusy(false);}
 }
 const button={minHeight:48,justifyContent:'center' as const,paddingVertical:12};
 return <View style={[cardStyles.card,{gap:12}]}>
  <Text style={cardStyles.title}>Dine data</Text>
  <Text style={cardStyles.note}>Hent energidata for det valgte hjem. Filen indeholder private målinger – gem og del den med omtanke. For en fuld indsigtskopi, herunder profil og filer: info@huslyg.dk.</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void exportEnergy()} style={button}><Text style={{...cardStyles.body,color:colors.primary}}>Hent energidata · JSON</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void preview()} style={button}><Text style={{...cardStyles.body,color:colors.error}}>Slet min konto</Text></Pressable>
  {!visible&&error?<Text accessibilityRole="alert" style={cardStyles.note}>{error}</Text>:null}
  {busy&&!visible?<ActivityIndicator color={colors.primary}/>:null}
  <AppModal visible={visible} onRequestClose={()=>{if(!busy)setVisible(false);}}>
   <ScrollView contentContainerStyle={{padding:24,paddingTop:56,gap:16,backgroundColor:colors.paper,flexGrow:1}} keyboardShouldPersistTaps="handled">
    <Text style={cardStyles.title}>{deleted?'Kontoen er slettet':'Slet din konto'}</Text>
    {deleted?<Text style={cardStyles.body}>Din konto er slettet på serveren. Hvis du stadig ser denne side, skal lokal oprydning eller logout afsluttes. Du skal ikke slette kontoen igen.</Text>:null}
    <Text style={cardStyles.body}>Din konto og dine forbindelser fjernes. Er du sidste medlem, slettes også hjemmets gemte data. Andre medlemmers fælles arkiv bevares. Hent en kopi først, hvis du ønsker det.</Text>
    <Text style={cardStyles.note}>Allerede hentede kopier kan ikke trækkes tilbage. Leverandørlogs og backups har særskilte frister. Sletning kræver, at du har logget ind med en ny kode inden for 10 minutter.</Text>
    {busy?<ActivityIndicator color={colors.primary}/>:null}
    {homes?.map(home=><View key={home.householdId} style={{gap:8}}><Text style={cardStyles.body}>{home.name}: {home.lastMember?'Hjemmets gemte data slettes':'Fælles data bevares for de øvrige medlemmer'}</Text>{home.needsSuccessor?<><Text style={cardStyles.note}>Vælg en ny administrator for hjemmet:</Text>{home.members.map(member=><Pressable key={member.id} accessibilityRole="radio" accessibilityState={{checked:successors[home.householdId]===member.id}} disabled={busy} onPress={()=>setSuccessors(values=>({...values,[home.householdId]:member.id}))} style={button}><Text style={{...cardStyles.body,color:successors[home.householdId]===member.id?colors.primary:colors.ink}}>{successors[home.householdId]===member.id?'✓ ':''}{member.name}</Text></Pressable>)}</>:null}</View>)}
    {homes&&!deleted?<><Text style={cardStyles.note}>Skriv SLET MIN KONTO for at bekræfte.</Text><TextInput accessibilityLabel="Bekræft kontosletning" value={confirmation} onChangeText={setConfirmation} editable={!busy} autoCorrect={false} autoCapitalize="characters" style={{minHeight:48,borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,color:colors.ink}}/><Pressable accessibilityRole="button" disabled={busy||confirmation!=='SLET MIN KONTO'||homes.some(home=>home.needsSuccessor&&!successors[home.householdId])} onPress={()=>void remove()} style={button}><Text style={{...cardStyles.body,color:colors.error}}>Slet kontoen permanent</Text></Pressable></>:null}
    {deleted?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void auth.signOut()} style={button}><Text style={cardStyles.body}>Afslut og log ud</Text></Pressable>:null}
    {error?<Text accessibilityRole="alert" style={cardStyles.body}>{error}</Text>:null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setVisible(false)} style={button}><Text style={cardStyles.body}>Annuller</Text></Pressable>
   </ScrollView>
  </AppModal>
 </View>;
}
