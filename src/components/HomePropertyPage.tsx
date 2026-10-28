import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {LoadingState} from './LoadingState';
import {HapticPressable as Pressable} from './HapticPressable';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {BackHandler,ScrollView,StyleSheet,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppIcon} from './AppIcon';
import {HomePhotoGallery} from './HomePhotoGallery';
import {HomeParcelDetails} from './HomeParcelDetails';
import {HomeRoofDetails} from './HomeRoofDetails';
import {HomeFloorPlans} from './HomeFloorPlans';
import {homeOverviewKey,peekHomeOverview,readHomeOverview,saveHomeOverview,gridCompanyName} from '../services/home-overview-cache';
import {HomeElectricityCard} from './HomeElectricityCard';
import {useHouseholdSession} from '../hooks/useHouseholdSession';
import {loadProfile} from '../services/storage';
import {API_URL} from '../services/supabase';
import {colors} from '../styles/theme';

type Field={key:string;label:string;value:string};
type Property={addressId:string;address:string;fetchedAt:string;source:string;sections:{title:string;records:{id:string;fields:Field[]}[]}[]};
const tabs=[['overview','Overblik'],['house','Boligen'],['roof','Tag'],['parcel','Matrikel'],['floorplan','Plantegning']] as const;
const heating:Record<string,string>={'1':'Fjernvarme','2':'Centralvarme','3':'Ovn','5':'Varmepumpe','6':'Centralvarme','7':'Elvarme','8':'Gasradiator','9':'Ingen varmeinstallation'};
const walls:Record<string,string>={'1':'Mursten','2':'Letbeton','3':'Fibercement','4':'Bindingsværk','5':'Træ','6':'Betonelementer','8':'Metal','10':'Fibercement uden asbest','11':'Plast','12':'Glas','80':'Ingen','90':'Andet materiale'};
function value(property:Property|null,section:string,prefix:string){const records=property?.sections.find(s=>s.title===section)?.records;if(records?.length!==1)return undefined;return records[0]?.fields.find(f=>f.key.toLowerCase().startsWith(prefix))?.value;}
function area(text:string|undefined){const n=Number(text);return text!==undefined&&Number.isFinite(n)&&n>=0?n.toLocaleString('da-DK')+' m²':'Ikke oplyst';}
export function HomePropertyPage({address,selected,onBack,navigation,gridSupplier}:{address:string;selected:boolean;onBack:()=>void;navigation:ReactNode;gridSupplier?:import('../prices').GridSupplier}){
 const auth=useHouseholdSession(),scroll=useRef<ScrollView>(null);
 const cacheKey=homeOverviewKey(auth.session?.user.id??'',auth.householdId??'',address);
 const initial=peekHomeOverview(cacheKey);
 const [supplierName,setSupplierName]=useState<string|undefined>(initial?.supplierName),[supplierSource,setSupplierSource]=useState<string|undefined>(initial?.supplierSource);
 const [property,setProperty]=useState<Property|null>(initial?.property??null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[tab,setTab]=useState<string>('overview'),[location,setLocation]=useState<{x:number;y:number}|null>(initial?.location??null);
 useEffect(()=>{setTab('overview');},[address,auth.session?.user.id,auth.householdId]);
 useEffect(()=>{const back=BackHandler.addEventListener('hardwareBackPress',()=>{if(tab!=='overview'){setTab('overview');scroll.current?.scrollTo({y:0,animated:false});}else onBack();return true;});return()=>back.remove();},[selected,onBack,tab]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);let cached=peekHomeOverview(cacheKey);
  setProperty(cached?.property??null);setLocation(cached?.location??null);setSupplierName(cached?.supplierName);setSupplierSource(cached?.supplierSource);setError('');setLoading(!cached);
  if(!selected||!address||!auth.session?.user.id)return()=>{active=false;clearTimeout(timer);controller.abort();};
  void(async()=>{
   cached=await readHomeOverview(cacheKey,address)??undefined;
   if(!active)return;
   if(cached){setProperty(cached.property);setLocation(cached.location);setSupplierName(cached.supplierName);setSupplierSource(cached.supplierSource);setLoading(false);if(revision===0&&Date.now()-cached.fetchedAt<86400000)return;}
   const saved=await loadProfile(auth.session!.user.id,auth.session!.user.email??'');if(!active)return;
   let name=saved?.address===address?gridCompanyName(saved.gridSupplierId,saved.gridSupplierName??(saved.gridSupplierId===gridSupplier?.id?gridSupplier?.name:undefined)):undefined;
   let source=name?'Valgt i profil':undefined;
   const loc=saved?.address===address&&Number.isFinite(saved.addressX)&&Number.isFinite(saved.addressY)?{x:saved.addressX!,y:saved.addressY!}:null;
   setLocation(loc);setSupplierName(name);setSupplierSource(source);
   const params=new URLSearchParams({mode:'bbr',q:address});if(saved?.address===address&&saved.addressId)params.set('id',saved.addressId);
   const gridTask=loc?fetch(API_URL+'/api/grid/lookup?'+new URLSearchParams({x:String(loc.x),y:String(loc.y)}),{signal:controller.signal}).then(async response=>{if(!response.ok)return;const grid=await response.json();if(typeof grid.name==='string'&&grid.name.trim()){name=grid.name;source='Adresseopslag \u00b7 ikke m\u00e5lerbekr\u00e6ftet';if(active){setSupplierName(name);setSupplierSource(source);}}}).catch(()=>{}):Promise.resolve();
   const response=await fetch(API_URL+'/api/address/search?'+params,{signal:controller.signal,headers:{Accept:'application/json'}}),result=await response.json();
   if(!response.ok)throw Error(result.error??'Boligoplysninger kunne ikke hentes.');
   if(!Array.isArray(result.sections)||!result.addressId||!result.fetchedAt)throw Error('Boligoplysningerne er endnu ikke tilg\u00e6ngelige.');
   if(active){setProperty(result);setLoading(false);void saveHomeOverview(cacheKey,{v:1,address,property:result,location:loc,supplierName:name,supplierSource:source,fetchedAt:Date.now()});}
   await gridTask;
   if(active)await saveHomeOverview(cacheKey,{v:1,address,property:result,location:loc,supplierName:name,supplierSource:source,fetchedAt:Date.now()});
  })().catch(e=>{if(active)setError(cached?'Kunne ikke opdatere. Viser gemte oplysninger.':e instanceof Error?e.message:'Boligoplysninger kunne ikke hentes.');}).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[selected,address,auth.session?.user.id,auth.householdId,revision,gridSupplier?.id,gridSupplier?.name,cacheKey]);
 const find=(section:string,prefix:string)=>value(property,section,prefix),unit=(prefix:string)=>find('Din bolig / enhed',prefix),building=(prefix:string)=>find('Bygningen',prefix);
 const stats=[[unit('enh027')!==undefined?'Boligareal':'Boligareal i bygningen',area(unit('enh027')??building('byg039'))],['Værelser',unit('enh031')??'Ikke oplyst'],['Byggeår',building('byg026')??'Ikke oplyst'],['Etager',building('byg054')??'Ikke oplyst']];
 const details=[...stats,['Varme',heating[building('byg056')??'']??'Ikke oplyst'],['Ydervægge',walls[building('byg032')??'']??'Ikke oplyst'],['Badeværelser',unit('enh066')??'Ikke oplyst'],['Toiletter',unit('enh065')??'Ikke oplyst'],...(building('byg027')&&building('byg027')!=='0'?[['Ombygget',building('byg027')!]]:[])];
 const identity=auth.session?.user.id+':'+auth.householdId+':'+property?.addressId;
 return <SafeAreaView style={s.page} edges={['top']}><ScrollView ref={scroll} stickyHeaderIndices={[2]} contentContainerStyle={s.content}>
  <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Tilbage til Mit hjem" onPress={onBack} style={s.back}><AppIcon name="chevron-left" size={23} color={colors.ink}/></Pressable><Text style={s.title}>Boligen</Text></View>
  <View style={s.hero}><Text style={s.address}>{address||'Ingen adresse valgt'}</Text></View>
  <View style={s.tabsBar}><ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={s.tabs}>{tabs.map(([id,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id,disabled:!selected}} disabled={!selected} onPress={()=>{setTab(id);}} style={[s.tab,tab===id&&s.activeTab]}><Text style={[s.action,tab===id&&s.white]}>{label}</Text></Pressable>)}</ScrollView></View>
  {!selected||!address?<View style={s.card}><Text style={s.heading}>Vælg din adresse</Text><Text style={s.note}>Vælg boligens adresse under Profil.</Text></View>:null}
  {loading&&!property?<View style={s.card}><LoadingState label="Henter oplysninger om din bolig…" rows={3}/></View>:null}
  {error?<View style={s.card}><Text accessibilityRole="alert" style={s.note}>{error}</Text><Pressable onPress={()=>setRevision(v=>v+1)}><Text style={s.action}>Prøv igen</Text></Pressable></View>:null}
  {selected&&tab==='overview'?<>{location?<HomePhotoGallery key={identity} x={location.x} y={location.y} viewerUrl="https://skraafoto.dataforsyningen.dk/"/>:null}{property?<View style={s.card}><Text style={s.heading}>Overblik over boligen</Text><View style={s.stats}>{stats.map(([label,text])=><View key={label} style={s.stat}><Text style={s.number}>{text}</Text><Text style={s.note}>{label}</Text></View>)}</View><Text style={s.note}>Oplysninger fra BBR</Text></View>:null}{auth.householdId?<HomeElectricityCard key={auth.session?.user.id+':'+auth.householdId} supplierName={gridSupplier?.meterVerified||gridSupplier?.resolutionIssue?(gridSupplier.companyName??gridSupplier.name):supplierName} supplierSource={gridSupplier?.resolutionIssue??(gridSupplier?.meterVerified?gridSupplier.evidenceSource:supplierSource)}/>:null}</>:null}
  {selected&&property&&tab==='house'?<View style={s.card}><Text style={s.heading}>Generel information</Text>{details.map(([label,text])=><View key={label} style={s.row}><Text style={s.note}>{label}</Text><Text style={s.value}>{text}</Text></View>)}<Text style={s.note}>Oplysninger fra BBR. Ikke oplyst betyder, at vi mangler et entydigt svar for boligen.</Text></View>:null}
  {selected&&property&&tab==='roof'?<HomeRoofDetails key={identity} addressId={property.addressId}/>:null}
  {selected&&property&&tab==='parcel'?<HomeParcelDetails key={identity} addressId={property.addressId}/>:null}
  {selected&&property&&tab==='floorplan'&&auth.householdId?<HomeFloorPlans key={identity} householdId={auth.householdId} addressId={property.addressId}/>:null}
 </ScrollView>{navigation}</SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.paper},content:{padding:20,gap:16,width:'100%',maxWidth:760,alignSelf:'center',paddingBottom:32},header:{flexDirection:'row',alignItems:'center',gap:12},back:{padding:8},title:{fontFamily:'Nunito_700Bold',fontSize:26,color:colors.ink},hero:{gap:6,paddingVertical:8},address:{fontFamily:'Nunito_700Bold',fontSize:21,color:colors.ink},note:{fontFamily:'Nunito_400Regular',fontSize:13,lineHeight:20,color:colors.muted},tabsBar:{backgroundColor:colors.paper,paddingVertical:8},tabs:{gap:8},tab:{paddingHorizontal:16,paddingVertical:12,borderRadius:16,backgroundColor:colors.white},activeTab:{backgroundColor:colors.primary},action:{fontFamily:'Nunito_700Bold',fontSize:14,color:colors.primary},white:{color:colors.white},card:{backgroundColor:colors.white,borderRadius:24,padding:20,gap:16},heading:cardStyles.title,stats:{flexDirection:'row',flexWrap:'wrap',gap:12},stat:{width:'45%',flexGrow:1,padding:14,borderRadius:16,backgroundColor:colors.paper,gap:6},number:{fontFamily:'Nunito_700Bold',fontSize:24,color:colors.ink},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16,paddingVertical:8},value:{fontFamily:'Nunito_700Bold',fontSize:15,color:colors.ink,flexShrink:1,textAlign:'right'}});
