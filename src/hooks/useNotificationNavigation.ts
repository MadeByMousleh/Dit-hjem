import {useEffect} from 'react';
import {Platform} from 'react-native';
import {useNotificationOwner} from './useNotificationOwner';
import {getNotificationSession, isPrivateNotification, notificationBelongsTo} from '../services/notification-session';
import {useDashboardViewState} from './useDashboardViewState';
export function useNotificationNavigation(){
 const owner=useNotificationOwner(),{setActiveTab}=useDashboardViewState();
 useEffect(()=>{
  if(Platform.OS==='web'||!owner)return;
  let alive=true,remove:(()=>void)|undefined;
  void import('expo-notifications').then(async notifications=>{
   if(!alive)return;
   const accept=(response:import('expo-notifications').NotificationResponse|null)=>{
    const data=response?.notification.request.content.data;
    if(alive&&getNotificationSession()===owner&&isPrivateNotification(data)&&notificationBelongsTo(data,owner)){
      setActiveTab(data?.kind==='waste-reminder'?'waste':data?.kind==='charging-window-alert'?'car':'electricity');
      void notifications.clearLastNotificationResponseAsync();
    }
   };
   const sub=notifications.addNotificationResponseReceivedListener(accept);remove=()=>sub.remove();
   accept(await notifications.getLastNotificationResponseAsync());
  }).catch(()=>{});
  return()=>{alive=false;remove?.();};
 },[owner,setActiveTab]);
}
