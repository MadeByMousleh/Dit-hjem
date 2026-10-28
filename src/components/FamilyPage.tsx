import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,TextInput,View} from 'react-native';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import {familyRequest,syncFamilyHome,type FamilyState} from '../services/family';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';

export function FamilyPage(){
 const auth=useHouseholdSession(),[data,setData]=useState<FamilyState|null>(null),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){setError('');try{setData(await familyRequest(auth.householdId,'list'));}catch(e){setError(e instanceof Error?e.message:'Familien kunne ikke hentes.');}}
 useEffect(()=>{void load();},[auth.householdId]);
 async function action(kind:string,extra:Record<string,string>={}){if(busy)return;setBusy(true);setError('');setNotice('');try{
  if(kind==='invite')await syncFamilyHome(auth.householdId,auth.session!.user.id);
  setData(await familyRequest(auth.householdId,kind,extra));if(kind==='invite'){setEmail('');setNotice('Invitationen er sendt. Modtageren logger ind med sin egen e-mail.');}
 }catch(e){setError(e instanceof Error?e.message:'Handlingen kunne ikke gennemføres.');}finally{setBusy(false);}}
 return <View style={{gap:16}}>
  <Text style={{...cardStyles.title,fontSize:30,lineHeight:36}}>Familie</Text>
  <Text style={cardStyles.body}>Samme hjem. Hver jeres profil.</Text>
  {!data&&!error?<ActivityIndicator color={colors.primary}/>:null}
  {data?.canManage?<View style={[cardStyles.card,{marginBottom:0,gap:12}]}>
   <Text style={cardStyles.title}>Inviter et familiemedlem</Text>
   <Text style={cardStyles.note}>I deler boligoplysninger, el- og varmeforbrug samt fælles plantegninger. Hver person har sin egen konto; navn og e-mail vises i medlemsoversigten. Adgang kræver accept.</Text>
   <TextInput accessibilityLabel="Familiemedlemmets e-mail" value={email} onChangeText={setEmail} placeholder="E-mailadresse" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} style={{minHeight:48,paddingHorizontal:14,borderWidth:1,borderColor:colors.line,borderRadius:12,color:colors.ink,fontFamily:'Nunito_400Regular',backgroundColor:colors.white}}/>
   <Pressable accessibilityRole="button" disabled={busy||!email.trim()} onPress={()=>void action('invite',{email})} style={{minHeight:48,justifyContent:'center',alignItems:'center',borderRadius:14,backgroundColor:colors.primary,opacity:busy||!email.trim()?0.5:1}}><Text style={{fontFamily:'Nunito_700Bold',color:colors.white}}>Send invitation</Text></Pressable>
  </View>:null}
  {data?.members.map(member=><View key={member.id} style={[cardStyles.card,{marginBottom:0,gap:4}]}><Text style={cardStyles.title}>{member.name}{member.id===auth.session?.user.id?' (dig)':''}</Text><Text style={cardStyles.note}>{member.email}</Text><Text style={cardStyles.note}>{member.role==='owner'?'Administrator':'Familiemedlem'}</Text>{data.canManage&&member.role==='member'?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>Alert.alert('Fjern familiemedlem?',`${member.name} mister adgang til hjemmet.`,[{text:'Annuller',style:'cancel'},{text:'Fjern adgang',style:'destructive',onPress:()=>void action('remove',{userId:member.id})}])} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.error}}>Fjern adgang</Text></Pressable>:null}</View>)}
  {data?.invitations.map(invite=><View key={invite.email} style={[cardStyles.card,{marginBottom:0,gap:8}]}><Text style={cardStyles.body}>{invite.email}</Text><Text style={cardStyles.note}>{invite.delivery==='failed'?'Mailen blev ikke sendt':new Date(invite.expiresAt)<new Date()?'Invitation udløbet':'Afventer accept'}</Text><View style={{flexDirection:'row',gap:20}}><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void action('invite',{email:invite.email})} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.primary}}>Send igen</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void action('revoke',{email:invite.email})} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.muted}}>Annuller invitation</Text></Pressable></View></View>)}
  {busy?<ActivityIndicator color={colors.primary}/>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={cardStyles.body}>{notice}</Text>:null}
  {error?<View style={{gap:8}}><Text accessibilityRole="alert" style={{...cardStyles.body,color:colors.error}}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>void load()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.primary}}>Prøv igen</Text></Pressable></View>:null}
 </View>;
}
