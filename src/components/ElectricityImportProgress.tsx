import {cardStyles} from '../styles/cards';
import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import {useEnergyVault} from './EnergyVaultGate';
import {privateImportStatus,subscribePrivateElectricity} from '../services/private-electricity';
import {colors} from '../styles/theme';
export function ElectricityImportProgress(){
 const vault=useEnergyVault(),[status,setStatus]=useState(()=>privateImportStatus(vault));
 useEffect(()=>{setStatus(privateImportStatus(vault));return subscribePrivateElectricity(vault,()=>{try{setStatus(privateImportStatus(vault));}catch{/* Session closed. */}});},[vault]);
 return <View style={s.panel}><View style={s.heading}>{status.running?<ActivityIndicator color={colors.primary}/>:null}<Text style={s.title}>{status.initialComplete?'Elhistorikken er gennemgået':'Gemmer din elhistorik'}</Text></View>
  <Text accessibilityLiveRegion="polite" style={s.note}>{status.totalDays?`${status.processedDays} af ${status.totalDays} målerdage gennemgået · ${status.percent}%`:'Finder hele den tilgængelige periode…'}</Text>
  <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:status.percent}} style={s.track}><View style={[s.bar,{width:`${status.percent}%`}]}/></View>
  {status.lastFrom?<Text style={s.note}>Senest gemt: {new Date(status.lastFrom+'T12:00:00Z').toLocaleDateString('da-DK',{month:'long',year:'numeric'})}.</Text>:null}
  <Text style={s.note}>Vi henter hele den tilgængelige historik måned for måned og gemmer målingerne sikkert på din konto. Du kan fortsætte i appen imens. Hvis appen lukkes, genoptages importen, når du åbner den og forbindelsen er klar.</Text>
  {status.missingDays>0?<Text style={s.note}>{status.missingDays} dage har manglende målinger. Vi gemmer de data, der findes, og forsøger at hente hullerne igen.</Text>:null}
  {status.error?<Text accessibilityRole="alert" style={s.error}>{status.error} Allerede gemt historik bevares.</Text>:null}
 </View>;
}
const s=StyleSheet.create({panel: {...cardStyles.card,gap:12},heading:{flexDirection:'row',gap:10,alignItems:'center'},title: cardStyles.title,note: cardStyles.note,track:{height:8,borderRadius:4,backgroundColor:colors.white,overflow:'hidden'},bar:{height:'100%',backgroundColor:colors.primary},error:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.coral}});
