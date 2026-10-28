import {readFile} from 'node:fs/promises';
import {ENERGINET_GRID_SUPPLIERS} from './energinet-tariff-catalog.mjs';
import {dayPrices,localDate,nextDate,summarize,chartGeometry} from '../../public/landing/prices.mjs';

const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const formatTime=at=>new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at));
const interval=at=>new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset',hourCycle:'h23'}).format(new Date(at))+' – '+formatTime(at+900000);
const money=value=>new Intl.NumberFormat('da-DK',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);
const dateTime=at=>new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',dateStyle:'long',timeStyle:'short'}).format(new Date(at));
const setText=(html,id,text)=>html.replace(new RegExp('(<[^>]+id="'+id+'"[^>]*>)[\\s\\S]*?(</[^>]+>)'),(_,open,close)=>open+escape(text)+close);
export function pricePageSelection(query={}){
 for(const key of ['priceArea','supplierId','day'])if(query[key]!==undefined&&typeof query[key]!=='string')throw Object.assign(Error('Ugyldigt prisvalg.'),{status:400});
 const area=query.priceArea??'DK1',day=query.day??'today';
 if(!['DK1','DK2'].includes(area)||!['today','tomorrow'].includes(day))throw Object.assign(Error('Ugyldigt prisområde eller dag.'),{status:400});
 const supplier=ENERGINET_GRID_SUPPLIERS.find(s=>s.id===(query.supplierId??(area==='DK1'?'n1_c':'radius_c')));
 if(!supplier||supplier.area!==area)throw Object.assign(Error('Vælg et netselskab i det valgte prisområde.'),{status:400});
 return {area,day,supplier};
}
export function renderPricePage(template,{selection,payload,now=Date.now(),error}={}){
 let html=template;
 if(!selection){return setText(html,'price-status',error??'Priserne er midlertidigt utilgængelige. Prøv igen senere.');}
 const {area,day,supplier}=selection;
 html=html.replace('data-price-page>','data-price-page data-price-day="'+day+'">');
 html=html.replace(/<option value="(DK[12])"[^>]*>/g,(_,value)=>'<option value="'+value+'"'+(value===area?' selected':'')+'>');
 html=html.replace(/(<select id="price-supplier"[^>]*>)[\s\S]*?<\/select>/,(_,open)=>open+ENERGINET_GRID_SUPPLIERS.map(s=>'<option value="'+escape(s.id)+'"'+(s.id===supplier.id?' selected':'')+'>'+escape(s.name+' · '+s.area)+'</option>').join('')+'</select>');
 html=html.replace(/(data-price-day="(today|tomorrow)" aria-pressed=")[^"]*/g,(_,open,value)=>open+String(value===day));
 if(error)return setText(html,'price-status',error);
 const today=localDate(now),date=day==='today'?today:nextDate(today);
 if(payload?.supplier?.id!==supplier.id)throw Error('Prisdata matcher ikke det valgte netselskab.');
 const points=dayPrices(payload,date);
 if(!points.length)return setText(html,'price-status',day==='tomorrow'?'Morgendagens priser er endnu ikke tilgængelige. Der vises ingen prognose.':'Dagens priser er endnu ikke tilgængelige. Prøv igen senere.');
 const summary=summarize(points,now),geometry=chartGeometry(points);
 html=html.replace('id="price-results" class="price-results" hidden','id="price-results" class="price-results"');
 html=setText(html,'price-date',new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(points[0].at)));
 html=setText(html,'price-status',supplier.name+' · '+area+' · Hentet '+dateTime(now)+'.');
 html=setText(html,'price-current',summary.current?money(summary.current.value):'—');
 html=setText(html,'price-current-time',summary.current?interval(summary.current.at):'Intet aktuelt interval på den valgte dag');
 html=setText(html,'price-average',money(summary.average));html=setText(html,'price-cheapest',money(summary.cheapest.value));
 html=setText(html,'price-cheapest-time',interval(summary.cheapest.at).split(' – ')[0]+' – '+formatTime(summary.cheapest.end));
 html=html.replace(/(<tbody id="price-table-body">)[\s\S]*?<\/tbody>/,(_,open)=>open+points.map(p=>'<tr><td>'+escape(interval(p.at))+'</td><td>'+escape(money(p.value))+'</td></tr>').join('')+'</tbody>');
 html=html.replace(/<div id="price-chart"[^>]*>[\s\S]*?<\/div>/,'<div id="price-chart" class="price-chart" aria-hidden="true" style="--points:'+points.length+';--zero:'+geometry.zero+'%">'+geometry.bars.map((g,i)=>'<span class="price-bar" data-negative="'+g.negative+'" style="--bar-top:'+g.top+'%;--bar-height:'+g.height+'%" title="'+escape(interval(points[i].at)+': '+money(points[i].value)+' kr./kWh')+'"><i></i></span>').join('')+'</div>');
 html=html.replace(/<div class="price-axis"[^>]*>[\s\S]*?<\/div>/,'<div class="price-axis" aria-hidden="true">'+[0,.25,.5,.75,1].map(f=>'<span>'+escape(f===1?'24.00':formatTime(points[Math.floor(f*points.length)].at))+'</span>').join('')+'</div>');
 html=html.replace(/<noscript>[\s\S]*?<\/noscript>/,'<noscript><p>Priserne nedenfor blev hentet '+escape(dateTime(now))+'. Genindlæs siden for at hente igen. Du kan vælge område, netselskab og dag i formularen uden JavaScript.</p></noscript>');
 return html;
}
const defaultGetPrices=async query=>{const {getEnerginetPrices}=await import('./energinet-prices-server.mjs');return getEnerginetPrices(query);};
export async function publicPricePage(request,response,{getPrices=defaultGetPrices,now=()=>Date.now(),readTemplate=()=>readFile(new URL('../../public/elpriser.html',import.meta.url),'utf8')}={}){
 // Query choices are public and bounded. This route never reads account/session data.
 response.setHeader('Content-Type','text/html; charset=utf-8');
 let template;try{template=await readTemplate();}catch{response.setHeader('Cache-Control','no-store');return response.status(503).send('<!doctype html><html lang="da"><meta charset="utf-8"><title>Priser midlertidigt utilgængelige · Huslyg</title><h1>Priserne er midlertidigt utilgængelige</h1><p>Prøv igen senere.</p><a href="/">Til forsiden</a></html>');}
 let selection;
 try{
  selection=pricePageSelection(request.query);
  const payload=await getPrices({supplierId:selection.supplier.id,priceArea:selection.area});
  const html=renderPricePage(template,{selection,payload,now:now()});
  response.setHeader('Cache-Control','public, max-age=0, s-maxage=60, must-revalidate');
  return response.status(200).send(html);
 }catch(error){
  response.setHeader('Cache-Control','no-store');response.setHeader('Retry-After','60');
  const status=error?.status===400?400:503;
  const message=status===400?'Vælg et gyldigt prisområde, netselskab og dag.':'Priserne er midlertidigt utilgængelige. Prøv igen senere; der vises ingen eksempelpriser.';
  return response.status(status).send(renderPricePage(template,{selection,error:message}));
 }
}
