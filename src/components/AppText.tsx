import {forwardRef} from 'react';
import {Text,type TextProps} from 'react-native';
import {colors} from '../styles/theme';
export const AppText=forwardRef<Text,TextProps>(function AppText({style,...props},ref){
 return <Text {...props} ref={ref} style={[{fontFamily:'Nunito_400Regular',color:colors.ink},style]}/>;
});
