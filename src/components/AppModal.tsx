import {Modal,type ModalProps,View} from 'react-native';
import {useMotionPreference} from '../hooks/useMotionPreference';
import {MotionView} from './Motion';
export function AppModal({children,animationType,...props}:ModalProps){
 const reduced=useMotionPreference();
 return <Modal {...props} animationType={reduced?'none':animationType??'fade'}><MotionView variant="sheet" style={{flex:1}}><View style={{flex:1}}>{children}</View></MotionView></Modal>;
}
