const zone='Europe/Copenhagen';
const localParts=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export const localDate=at=>localParts.format(new Date(at)).slice(0,10);
export function nextDate(day){return new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
export function midnight(day){
 const target=Date.parse(day+'T00:00:00Z');let at=target;
 for(let i=0;i<3;i++)at+=target-Date.parse(localParts.format(new Date(at)).replace(' ','T')+'Z');
 return at;
}
export function dayPrices(payload,day){
 if(!Array.isArray(payload?.points))throw Error('Ugyldigt prissvar.');
 const start=midnight(day),end=midnight(nextDate(day));
 const rows=payload.points.map(p=>({at:Date.parse(p.startsAt),value:p.totalOrePerKwh}));
 if(rows.some(p=>!Number.isFinite(p.at)||typeof p.value!=='number'||!Number.isFinite(p.value)))throw Error('Ugyldige prisdata.');
 const points=rows.filter(p=>p.at>=start&&p.at<end).sort((a,b)=>a.at-b.at);
 if(!points.length)return [];
 // Public current prices use quarter-hour intervals. Do not fill gaps or invent prices.
 if(points.length!==(end-start)/900000||points.some((p,i)=>p.at!==start+i*900000))throw Error('Dagens priser er ufuldstændige. Prøv igen senere.');
 return points;
}
export function summarize(points,now=Date.now()){
 if(!points.length)return null;
 let cheapest=null;
 for(let i=0;i+3<points.length;i++){
  const window=points.slice(i,i+4);
  if(window.some((p,j)=>p.at!==window[0].at+j*900000))continue;
  const value=window.reduce((sum,p)=>sum+p.value,0)/4;
  if(!cheapest||value<cheapest.value)cheapest={at:window[0].at,end:window[3].at+900000,value};
 }
 return {current:points.find(p=>p.at<=now&&now<p.at+900000)??null,average:points.reduce((sum,p)=>sum+p.value,0)/points.length,cheapest};
}
export function chartGeometry(points){
 const values=points.map(p=>p.value),min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1;
 return {zero:max/span*100,bars:values.map(v=>({top:(max-Math.max(0,v))/span*100,height:Math.abs(v)/span*100,negative:v<0}))};
}
export async function startPricePage(doc=document){
 const root=doc.querySelector('[data-price-page]');if(!root)return;
 const area=root.querySelector('#price-area'),supplier=root.querySelector('#price-supplier'),status=root.querySelector('#price-status'),results=root.querySelector('#price-results'),retry=root.querySelector('#price-retry');
 const days=[...root.querySelectorAll('button[data-price-day]')];let selectedDay=root.dataset.priceDay??'today',suppliers=[],controller,revision=0,loadedDate='',lastFetch=0;
 const money=v=>new Intl.NumberFormat('da-DK',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v/100);
 const time=at=>new Intl.DateTimeFormat('da-DK',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at));
 const dated=at=>new Intl.DateTimeFormat('da-DK',{timeZone:zone,day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
 // Include UTC offset so the repeated autumn hour is unambiguous.
 const interval=at=>new Intl.DateTimeFormat('da-DK',{timeZone:zone,hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset',hourCycle:'h23'}).format(new Date(at))+' – '+time(at+900000);
 const setText=(selector,text)=>{root.querySelector(selector).textContent=text;};
 const request=async(url,signal)=>{const response=await fetch(url,{signal,credentials:'omit',headers:{Accept:'application/json'}});if(!response.ok)throw Error('Prisdata er midlertidigt utilgængelige. Prøv igen senere.');return response.json();};
 function populate(){const previous=supplier.value,choices=suppliers.filter(s=>s.area===area.value);supplier.replaceChildren(...choices.map(s=>{const o=doc.createElement('option');o.value=s.id;o.textContent=s.name;return o;}));const preferred=choices.some(s=>s.id===previous)?previous:area.value==='DK1'?'n1_c':'radius_c';if(choices.some(s=>s.id===preferred))supplier.value=preferred;}
 async function load(){
  const currentRevision=++revision;controller?.abort();controller=new AbortController();const abort=controller;
  const timeout=setTimeout(()=>abort.abort(),30000);results.hidden=true;retry.hidden=true;root.setAttribute('aria-busy','true');status.textContent='Henter offentliggjorte elpriser…';
  try{
   if(!suppliers.length){const body=await request('/api/grid/lookup?operation=suppliers',abort.signal);if(!Array.isArray(body.suppliers)||!body.suppliers.length||body.suppliers.some(s=>typeof s.id!=='string'||typeof s.name!=='string'||!['DK1','DK2'].includes(s.area)))throw Error('Listen over netselskaber kunne ikke hentes.');suppliers=body.suppliers;populate();}
   const chosen=suppliers.find(s=>s.id===supplier.value&&s.area===area.value);if(!chosen)throw Error('Vælg et netselskab for at se priser.');
   const today=localDate(Date.now()),day=selectedDay==='today'?today:nextDate(today);
   const query=new URLSearchParams({operation:'prices',supplierId:chosen.id,priceArea:chosen.area});
   const payload=await request('/api/grid/lookup?'+query,abort.signal);if(currentRevision!==revision)return;
   if(payload.supplier?.id!==chosen.id)throw Error('Prisdata matcher ikke det valgte netselskab.');
   const points=dayPrices(payload,day);loadedDate=today;lastFetch=Date.now();
   if(!points.length){status.textContent=selectedDay==='tomorrow'?'Morgendagens priser er endnu ikke tilgængelige. Der vises ingen prognose.':'Dagens priser er ikke tilgængelige. Prøv igen senere.';retry.hidden=false;return;}
   const summary=summarize(points),date=new Intl.DateTimeFormat('da-DK',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(points[0].at));
   setText('#price-date',date);setText('#price-current',summary.current?money(summary.current.value):'—');setText('#price-current-time',summary.current?interval(summary.current.at):'Intet aktuelt interval på den valgte dag');
   setText('#price-average',money(summary.average));setText('#price-cheapest',money(summary.cheapest.value));setText('#price-cheapest-time',interval(summary.cheapest.at).split(' – ')[0]+' – '+time(summary.cheapest.end));
   const geometry=chartGeometry(points),chart=root.querySelector('#price-chart');chart.style.setProperty('--points',points.length);chart.style.setProperty('--zero',geometry.zero+'%');
   chart.replaceChildren(...points.map((p,i)=>{const bar=doc.createElement('span'),fill=doc.createElement('i'),g=geometry.bars[i];bar.className='price-bar';bar.dataset.negative=String(g.negative);bar.style.setProperty('--bar-top',g.top+'%');bar.style.setProperty('--bar-height',g.height+'%');bar.title=interval(p.at)+': '+money(p.value)+' kr./kWh';bar.append(fill);return bar;}));
   const axis=root.querySelector('.price-axis');axis.replaceChildren(...[0,.25,.5,.75,1].map(fraction=>{const label=doc.createElement('span');label.textContent=fraction===1?'24.00':time(points[Math.floor(fraction*points.length)].at);return label;}));
   const tbody=root.querySelector('#price-table-body');tbody.replaceChildren(...points.map(p=>{const row=doc.createElement('tr');for(const text of [interval(p.at),money(p.value)]){const cell=doc.createElement('td');cell.textContent=text;row.append(cell);}return row;}));
   status.textContent=chosen.name+' · '+chosen.area+' · Hentet '+dated(lastFetch)+'.';results.hidden=false;
  }catch(error){if(currentRevision!==revision)return;status.textContent=error.name==='AbortError'?'Det tog for lang tid at hente priserne. Prøv igen.':error.message;retry.hidden=false;}
  finally{clearTimeout(timeout);if(currentRevision===revision)root.setAttribute('aria-busy','false');}
 }
 area.addEventListener('change',()=>{populate();load();});supplier.addEventListener('change',()=>load());retry.addEventListener('click',()=>load());
 for(const button of days)button.addEventListener('click',event=>{event.preventDefault();selectedDay=button.dataset.priceDay;for(const b of days)b.setAttribute('aria-pressed',String(b===button));load();});
 const refresh=()=>{if(!doc.hidden&&(localDate(Date.now())!==loadedDate||Date.now()-lastFetch>=300000))load();};
 const timer=setInterval(refresh,300000);doc.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>{clearInterval(timer);controller?.abort();},{once:true});
 await load();
}
if(typeof document!=='undefined')startPricePage();
