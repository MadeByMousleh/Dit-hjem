import {StyleSheet} from 'react-native';
import {colors} from './theme';

// Shared spacing and type hierarchy for home and electricity cards.
export const cardStyles = StyleSheet.create({
  card: {padding:20,borderRadius:24,backgroundColor:colors.white,marginBottom:16},
  inset: {padding:20,borderRadius:24,backgroundColor:colors.white,gap:8},
  title: {fontFamily:'Nunito_700Bold',fontSize:18,lineHeight:24,color:colors.ink},
  body: {fontFamily:'Nunito_400Regular',fontSize:14,lineHeight:20,color:colors.ink},
  note: {fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted},
  label: {fontFamily:'Nunito_500Medium',fontSize:12,lineHeight:18,color:colors.muted},
  metric: {fontFamily:'Nunito_700Bold',fontSize:32,lineHeight:40,color:colors.ink},
});
