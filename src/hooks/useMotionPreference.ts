import {useSyncExternalStore} from 'react';
import {AccessibilityInfo,AppState} from 'react-native';

let reduced=true, foreground=AppState.currentState==='active';
const listeners=new Set<()=>void>();
let release:(()=>void)|undefined;
function subscribe(listener:()=>void){
 listeners.add(listener);
 if(!release){
  let alive=true;
  const emit=()=>listeners.forEach(fn=>fn());
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive){reduced=value;emit();}}).catch(()=>{});
  const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduced=value;emit();});
  const app=AppState.addEventListener('change',value=>{foreground=value==='active';emit();});
  release=()=>{alive=false;motion.remove();app.remove();release=undefined;};
 }
 return()=>{listeners.delete(listener);if(!listeners.size)release?.();};
}
export const useMotionPreference=()=>useSyncExternalStore(subscribe,()=>reduced||!foreground,()=>true);
