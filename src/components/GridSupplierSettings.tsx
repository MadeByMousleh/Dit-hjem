import {useEffect,useState} from 'react';
import {View} from 'react-native';
import {AppText as Text} from './AppText';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEnergyVault} from './EnergyVaultGate';
import {fetchGridSuppliers,type GridSupplier} from '../prices';
import {loadProfile,saveProfile} from '../services/storage';
import {getSupabase} from '../services/supabase';
import {resetGridSupplierResolution} from '../hooks/useResolvedGridSupplier';
import {SettingsDropdown} from './SettingsDropdown';
import {colors} from '../styles/theme';

export function GridSupplierSettings({current}:{current?:GridSupplier}){
 const vault=useEnergyVault();
 const [suppliers,setSuppliers]=useState<GridSupplier[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;fetchGridSuppliers().then(value=>{if(alive)setSuppliers(value);}).catch(()=>{if(alive)setError('Netselskaber kunne ikke hentes. Luk og prøv igen.');});return()=>{alive=false;};},[]);
 async function choose(id?:string){
  if(busy)return;setBusy(true);setError('');
  try{
   const client=await getSupabase();const {data:{session}}=await client.auth.getSession();
   if(session?.user.id!==vault.userId)throw Error('Log ind igen for at gemme.');
   const profile={...await loadProfile(vault.userId),gridSupplierOverrideId:id??null};
   const result=await client.auth.updateUser({data:{home_profile:profile}});
   if(result.error)throw Error('Valget kunne ikke gemmes. Prøv igen.');
   if(!id)resetGridSupplierResolution(vault);
   await saveProfile({...profile,gridSupplierOverrideId:id},vault.userId);
  }catch(e){setError(e instanceof Error?e.message:'Valget kunne ikke gemmes.');}finally{setBusy(false);}
 }
 return <View style={{gap:8}}>
  <SettingsDropdown label="Netselskab" value={current?.id} valueLabel={current?.companyName||current?.name} options={suppliers.map(s=>({value:s.id,label:s.companyName||s.name,detail:s.name+' \u00b7 '+s.area}))} searchable loading={busy||(!suppliers.length&&!error)} onChange={id=>void choose(id)}/>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void choose()} style={{minHeight:44,justifyContent:'center',alignSelf:'flex-start'}}><Text style={{fontFamily:'Nunito_600SemiBold',fontSize:13,color:colors.primary}}>Gendan mit netselskab</Text></Pressable>
  {error?<Text accessibilityRole="alert" style={{color:colors.ink}}>{error}</Text>:null}
 </View>;
}
