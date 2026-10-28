import {useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,TextInput,View} from 'react-native';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import {getSupabase} from '../services/supabase';
import {loadProfile,saveProfile} from '../services/storage';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';
export function FamilyWelcome({onFinish}:{onFinish:()=>void}){
 const auth=useHouseholdSession(),metadata=auth.session!.user.user_metadata;
 const [first,setFirst]=useState(metadata.given_name??''),[last,setLast]=useState(metadata.family_name??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function finish(){if(!first.trim()||!last.trim()||busy)return;setBusy(true);setError('');try{
  const client=await getSupabase(),profile={...await loadProfile(auth.session!.user.id),firstName:first.trim(),lastName:last.trim(),name:first.trim()+' '+last.trim(),email:auth.session!.user.email};
  const result=await client.auth.updateUser({data:{given_name:profile.firstName,family_name:profile.lastName,full_name:profile.name,home_profile:profile,onboarding_pending:false,onboarding_version:2}});
  if(result.error)throw Error('Profilen kunne ikke gemmes. Prøv igen.');await saveProfile(profile,auth.session!.user.id);onFinish();
 }catch(e){setError(e instanceof Error?e.message:'Prøv igen.');}finally{setBusy(false);}}
 return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'center',padding:24,backgroundColor:colors.paper}}><View style={[cardStyles.card,{gap:16}]}>
  <Text style={cardStyles.title}>Velkommen til familiens hjem</Text><Text style={cardStyles.body}>Boligen og hjemmets data er allerede delt med dig. Opret din egen profil for at fortsætte.</Text>
  <TextInput accessibilityLabel="Dit fornavn" placeholder="Fornavn" placeholderTextColor={colors.muted} value={first} onChangeText={setFirst} style={{minHeight:48,paddingHorizontal:14,borderWidth:1,borderColor:colors.line,borderRadius:12,color:colors.ink}}/>
  <TextInput accessibilityLabel="Dit efternavn" placeholder="Efternavn" placeholderTextColor={colors.muted} value={last} onChangeText={setLast} style={{minHeight:48,paddingHorizontal:14,borderWidth:1,borderColor:colors.line,borderRadius:12,color:colors.ink}}/>
  <Text style={cardStyles.note}>{auth.session!.user.email}</Text>
  {error?<Text accessibilityRole="alert" style={{color:colors.error}}>{error}</Text>:null}
  <Pressable accessibilityRole="button" disabled={busy||!first.trim()||!last.trim()} onPress={()=>void finish()} style={{minHeight:48,backgroundColor:colors.primary,borderRadius:14,justifyContent:'center',alignItems:'center',opacity:busy||!first.trim()||!last.trim()?0.5:1}}>{busy?<ActivityIndicator color={colors.white}/>:<Text style={{color:colors.white,fontFamily:'Nunito_700Bold'}}>Åbn mit hjem</Text>}</Pressable>
 </View></KeyboardAvoidingView>;
}
