import {useState} from 'react';
import {Linking,View} from 'react-native';
import {AppText as Text} from './AppText';
import {Disclosure} from './Disclosure';
import {HapticPressable as Pressable} from './HapticPressable';
import {cardStyles} from '../styles/cards';
import {colors} from '../styles/theme';

export function EloverblikDataInformation({meterIds=[]}:{meterIds?:string[]}){
 const [error,setError]=useState('');
 const meters=[...new Set(meterIds.filter(id=>typeof id==='string'&&/^\d{18}$/.test(id)))];
 async function manage(){setError('');try{await Linking.openURL('https://eloverblik.dk');}catch{setError('Eloverblik kunne ikke åbnes. Gå til eloverblik.dk i din browser.');}}
 return <Disclosure title="Dine eldata og din adgang">
  <Text style={cardStyles.note}>Vi henter historiske målinger og måleroplysninger for de elmålere, din fuldmagt hos Eloverblik giver adgang til. Målingerne kan være forsinkede eller mangle perioder.</Text>
  {meters.length?<View style={{gap:4}}><Text style={cardStyles.label}>Gemte målepunkter</Text>{meters.map(id=><Text key={id} style={cardStyles.note}>{id}</Text>)}</View>:null}
  <Text style={cardStyles.note}>Vil du stoppe adgangen, skal du logge ind hos Eloverblik og fjerne fuldmagten til BluePeach/Huslyg. Bevar dine øvrige fuldmagter. At åbne siden her fjerner ikke i sig selv adgangen.</Text>
  <Pressable accessibilityRole="link" onPress={()=>void manage()} style={{minHeight:48,justifyContent:'center'}}><Text style={[cardStyles.body,{color:colors.primary}]}>Administrer adgang hos Eloverblik ↗</Text></Pressable>
  <Text style={cardStyles.note}>Allerede gemt historik bevares i dit hjem. Hvis du også vil slette den, kan du bruge kontosletning under Profil → Dine data eller skrive til info@huslyg.dk. Frakobling ændrer ikke din elaftale.</Text>
  {error?<Text accessibilityRole="alert" style={[cardStyles.note,{color:colors.error}]}>{error}</Text>:null}
 </Disclosure>;
}
