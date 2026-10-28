import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';

/** Explicit account-deletion cleanup; never clears the app's whole database. */
export async function eraseAccountDeviceData(userId:string, householdIds:string[], email?:string) {
  if(!/^[0-9a-f-]{36}$/i.test(userId)||householdIds.some(id=>!/^[0-9a-f-]{36}$/i.test(id)))throw Error('Ugyldig lokal konto.');
  const exact=new Set(['stromblik.profile.v1.'+userId,'stromblik.active-home.'+userId,'stromblik.waste-reminder.v1.'+userId]);
  const prefixes=['stromblik.vault.'+userId+'.','stromblik.waste-reminder.v2.'+userId+'.'];
  const keys=await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(key=>exact.has(key)||prefixes.some(prefix=>key.startsWith(prefix))));
  if(email){
    const legacy=await AsyncStorage.getItem('stromblik.profile.v1');
    if(legacy){
      let owner:unknown;try{owner=JSON.parse(legacy)?.email;}catch{}
      if(typeof owner==='string'&&owner.trim().toLowerCase()===email.trim().toLowerCase())await AsyncStorage.removeItem('stromblik.profile.v1');
    }
  }
  for(const home of householdIds){
    const key=`stromblik.vault.${userId}.${home}`;
    if(Platform.OS==='web')globalThis.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  }
}
