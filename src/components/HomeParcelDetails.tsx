import {AppText as Text} from './AppText';
import {InlineStatus} from './InlineStatus';
import {LoadingState} from './LoadingState';
import {cardStyles} from '../styles/cards';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEffect,useState} from 'react';
import {ActivityIndicator,View} from 'react-native';
import {homeInsight,type HomeGeometry} from '../services/home-insights';
import {HomeParcelMap} from './HomeParcelMap';
import {colors} from '../styles/theme';
export function HomeParcelDetails({addressId}:{addressId:string}){
 const [data,setData]=useState<HomeGeometry|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let alive=true;setData(null);setError('');void homeInsight<HomeGeometry>('geometry',{id:addressId},revision>0).then(value=>{if(alive)setData(value);}).catch(()=>{if(alive)setError('Matriklen kunne ikke hentes.');});return()=>{alive=false;};},[addressId,revision]);
 if(data)return <HomeParcelMap data={data} simple/>;
 return <View style={cardStyles.inset}>{error?<InlineStatus error message={error} onRetry={()=>setRevision(v=>v+1)}/>:<LoadingState label="Henter matrikelkort…" variant="map"/>}</View>;
}
