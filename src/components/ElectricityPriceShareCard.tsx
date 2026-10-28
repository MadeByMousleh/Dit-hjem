import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {LoadingState} from './LoadingState';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,Easing,StyleSheet,View} from 'react-native';
import type {GridSupplier} from '../prices';
import {useElectricityPriceShare} from '../hooks/useElectricityPriceShare';
import {colors} from '../styles/theme';
const number=(v:number)=>v.toLocaleString('da-DK',{maximumFractionDigits:1});
const date=(v:string)=>new Date(v+'T12:00:00Z').toLocaleDateString('da-DK');
function CollectingData({days,unavailable}:{days:number;unavailable:boolean}){
 return <View style={s.waiting}><View style={{flexDirection:'row',gap:8}} accessibilityLabel={days+' af 7 dage klar'}>{Array.from({length:7},(_,i)=><View key={i} style={{width:20,height:20,borderRadius:6,backgroundColor:i<days?colors.primary:colors.paper,borderWidth:1,borderColor:i<days?colors.primary:colors.line}}/>)}</View><Text style={s.waitTitle}>{unavailable?'Historiske priser mangler':'Klar med 7 dages data'}</Text><Text style={s.centerNote}>{unavailable?'Vi afventer priser til dine målinger.':days+' af 7 hele dage med forbrug og priser'}</Text></View>;
}
export function ElectricityPriceShareCard({supplier,now}:{supplier:GridSupplier;now:number}){
 const {result:r,loading,error,archiveUnavailable}=useElectricityPriceShare(supplier,now);
 const [details,setDetails]=useState(false),ready=!!r&&r.completeDays>=7;
 return <View style={s.card}><Text style={s.title}>Strøm i billige timer</Text>
  <Text style={s.note}>Hvor meget strøm bruger du, når spotprisen er lav?</Text>
  {loading&&!r?<LoadingState label="Henter forbrug og priser…"/>:null}
  {!loading&&error?<Text accessibilityRole="alert" style={s.note}>{error}</Text>:null}
  {!loading&&!error&&!ready?<CollectingData days={Math.min(r?.completeDays??0,7)} unavailable={archiveUnavailable}/>:null}
  {ready&&r?<>
   {r.shares?<>
    <Text style={s.headline}>{r.flatDays===r.completeDays?'Samme pris hele døgnet':`${number(r.shares.cheap*100)} %`}</Text>
    <Text style={s.note}>{r.flatDays===r.completeDays?'Ingen billigere timer i de målte døgn.':'af dit målte forbrug ligger i de billige timer'}</Text>
    {(['cheap','other','expensive'] as const).map((key,i)=><View key={key} style={s.row}><Text style={s.label}>{['Billige','Øvrige','Dyre'][i]}</Text><View style={s.track}><View style={{height:7,width:`${r.shares![key]*100}%`,backgroundColor:['#1b8864','#8b96a5','#c67c33'][i]}}/></View><Text style={s.value}>{number(r.shares![key]*100)} %</Text></View>)}
   </>:<Text style={s.note}>Intet målt forbrug i perioden.</Text>}
   <Text style={s.note}>{r.completeDays} af {r.expectedDays} dage · {date(r.firstDay!)} – {date(r.lastDay!)}</Text>
   <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(v=>!v)} style={s.infoButton}><Text style={s.link}>{details?'Skjul forklaring':'Sådan beregner vi det'}</Text></Pressable>
   {details?<Text style={s.note}>Billige timer er cirka døgnets billigste fjerdedel; ens priser behandles ens. Andelen beregnes ud fra kWh i hele døgn med både forbrug og priser. {r.totalKwh.toLocaleString('da-DK',{maximumFractionDigits:1})} kWh indgår. {r.expectedDays-r.completeDays} dage mangler data. Spotpris i {supplier.area}, uden nettarif, afgifter og abonnement.</Text>:null}
  </>:null}
 </View>;
}
const s=StyleSheet.create({card: {...cardStyles.card,gap:8},title: cardStyles.title,headline: cardStyles.metric,note: cardStyles.note,row:{flexDirection:'row',alignItems:'center',gap:10,minHeight:32},label:{width:46,fontSize:12,color:colors.ink},track:{flex:1,height:7,backgroundColor:colors.paper,borderRadius:4,overflow:'hidden'},value:{width:50,textAlign:'right',fontFamily:'Nunito_700Bold',fontSize:12,color:colors.ink},infoButton:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},link:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},waiting:{alignItems:'center',paddingVertical:18,gap:8},dots:{flexDirection:'row',gap:7,height:48,alignItems:'flex-end',marginBottom:8},dot:{width:12,borderRadius:6},waitTitle:{fontFamily:'Nunito_700Bold',fontSize:16,color:colors.ink},centerNote:{fontFamily:'Nunito_400Regular',fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center'}});
