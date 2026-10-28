import type {ReactNode} from 'react';
import {View} from 'react-native';

// Retain layout and chart state across tabs. EnergyVaultGate still unmounts
// protected content when the session/vault locks; this is not persistent storage.
export function RetainedScreen({visible,children}:{visible:boolean;children:ReactNode}){
 return <View pointerEvents={visible?'auto':'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible?'auto':'no-hide-descendants'} style={visible?{flex:1}:{position:'absolute',left:-10000,top:0,width:'100%',height:'100%'}}>{children}</View>;
}
