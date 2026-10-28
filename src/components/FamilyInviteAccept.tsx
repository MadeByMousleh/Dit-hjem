import {View,ActivityIndicator} from 'react-native';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import {colors} from '../styles/theme';
import {cardStyles} from '../styles/cards';
export function FamilyInviteAccept(){
 const auth=useHouseholdSession();
 return <View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:colors.paper}}><View style={[cardStyles.card,{gap:16}]}>
  <Text style={cardStyles.title}>Du er inviteret</Text><Text style={cardStyles.body}>I deler boligoplysninger, el- og varmeforbrug samt fælles plantegninger. Du beholder din egen konto. Dit navn og din e-mail vises i familiens medlemsoversigt.</Text>
  <Text style={cardStyles.note}>Du får først adgang, når du accepterer. Hentede eller delte kopier kan ikke trækkes tilbage senere.</Text>
  <Text style={cardStyles.note}>{auth.session?.user.email}</Text>
  {auth.pendingInvitations.map(invitation=><Pressable key={invitation.householdId} accessibilityRole="button" disabled={auth.authLoading} onPress={()=>void auth.acceptInvitation(invitation.householdId)} style={{minHeight:48,backgroundColor:colors.primary,padding:14,borderRadius:14}}><Text style={{color:colors.white,fontFamily:'Nunito_700Bold'}}>Accepter invitation til {invitation.name}</Text></Pressable>)}
  {auth.authLoading?<ActivityIndicator color={colors.primary}/>:null}
  {auth.authError?<Text accessibilityRole="alert" style={{color:colors.error}}>{auth.authError}</Text>:null}
  <Pressable accessibilityRole="button" disabled={auth.authLoading} onPress={auth.skipInvitations} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.muted}}>Ikke nu</Text></Pressable>
 </View></View>;
}
