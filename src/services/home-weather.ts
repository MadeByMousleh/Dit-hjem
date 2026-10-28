export type ModelWeather={code:number;temperature:number;rain:number;snow:number;wind:number;windDirection:number;cloud:number;at:number};
export type HomeWeather={current:ModelWeather;hours:ModelWeather[];quarters?:ModelWeather[];fetchedAt:number};
export type WeatherMode='live'|'clear'|'rain'|'wind'|'snow';
export const weatherModes: {id:WeatherMode;label:string}[]=[{id:'live',label:'Lokalt'},{id:'clear',label:'Sol'},{id:'rain',label:'Regn'},{id:'wind',label:'Vind'},{id:'snow',label:'Sne'}];
export function windBearing(direction:number){const degrees=((Math.round(direction)%360)+360)%360;return `${['N','NØ','Ø','SØ','S','SV','V','NV'][Math.round(degrees/45)%8]} (${degrees}°)`;}
export function localClock(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const part=(name:string)=>parts.find(value=>value.type===name)!.value;
 return {day:`${part('year')}-${part('month')}-${part('day')}`,minute:Number(part('hour'))*60+Number(part('minute'))};
}
export function weatherAt(data:HomeWeather|null,at:number,live=false):ModelWeather|null{
 if(!data)return null;
 if(live){const quarter=data.quarters?.find((row,index,rows)=>at>=row.at&&at<Math.min(row.at+15*60000,rows[index+1]?.at??Infinity));if(quarter)return quarter;if(at>=data.current.at&&at<data.current.at+15*60000)return data.current;return data.hours.find(row=>at>=row.at&&at<row.at+3600000)??null;}
 return data.hours.find(hour=>at>=hour.at&&at<hour.at+3600000)??null;
}
export function previewWeather(mode:WeatherMode,weather:ModelWeather|null):ModelWeather|null{
 if(mode==='live')return weather;
 const base={at:weather?.at??0,code:0,temperature:weather?.temperature??15,rain:0,snow:0,wind:weather?.wind??0,windDirection:weather?.windDirection??270,cloud:0};
 if(mode==='rain')return {...base,code:63,rain:3,wind:weather?.wind??5,cloud:95};
 if(mode==='snow')return {...base,code:73,temperature:-1,snow:1,wind:weather?.wind??3,cloud:90};
 if(mode==='wind')return {...base,wind:weather?.wind??12,cloud:35};
 return base;
}
export function weatherLabel(weather:ModelWeather|null){
 if(!weather)return 'Vejr utilgængeligt';
 if(weather.snow>0||[71,73,75,77,85,86].includes(weather.code))return 'Sne';
 if(weather.rain>0||[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(weather.code))return 'Regn';
 if([45,48].includes(weather.code))return 'Tåge';
 return weather.cloud>65?'Overskyet':weather.cloud>20?'Let skyet':'Klart';
}
export async function loadHomeWeather(latitude:number,longitude:number,signal:AbortSignal):Promise<HomeWeather>{
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))throw Error('Invalid location');
 const fields=['temperature_2m','precipitation','snowfall','weather_code','wind_speed_10m','wind_direction_10m','cloud_cover'];
 const quarterFields=fields.filter(key=>key!=='cloud_cover');
 const params=new URLSearchParams({latitude:latitude.toFixed(2),longitude:longitude.toFixed(2),current:fields.join(','),hourly:fields.join(','),minutely_15:quarterFields.join(','),forecast_minutely_15:'96',past_minutely_15:'4',wind_speed_unit:'ms',timeformat:'unixtime',timezone:'GMT',forecast_days:'2',past_days:'1'});
 const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal});
 if(!response.ok)throw Error('Weather unavailable');
 const raw=await response.json();
 const parse=(row:Record<string,unknown>):ModelWeather=>{
  if(!['time',...fields].every(key=>typeof row[key]==='number'&&Number.isFinite(row[key])))throw Error('Invalid weather');
  const value=row as Record<string,number>;
  if(value.cloud_cover!<0||value.cloud_cover!>100||value.wind_speed_10m!<0||value.wind_speed_10m!>150||value.precipitation!<0||value.snowfall!<0)throw Error('Invalid weather');
  return {at:value.time!*1000,temperature:value.temperature_2m!,code:value.weather_code!,rain:value.precipitation!,snow:value.snowfall!,wind:value.wind_speed_10m!,windDirection:value.wind_direction_10m!,cloud:value.cloud_cover!};
 };
 if(!Array.isArray(raw.hourly?.time)||raw.hourly.time.length>100)throw Error('Invalid forecast');
 const hours:ModelWeather[]=raw.hourly.time.map((_at:number,index:number)=>parse(Object.fromEntries(['time',...fields].map(key=>[key,raw.hourly[key]?.[index]]))));
 const quarters:ModelWeather[]=[];
 if(Array.isArray(raw.minutely_15?.time)&&raw.minutely_15.time.length<=200)for(let i=0;i<raw.minutely_15.time.length;i++){const time=raw.minutely_15.time[i],hour=hours.find(row=>time*1000>=row.at&&time*1000<row.at+3600000);if(!hour)continue;try{quarters.push(parse({...Object.fromEntries(['time',...quarterFields].map(key=>[key,raw.minutely_15[key]?.[i]])),cloud_cover:hour.cloud}));}catch{/* Hourly fallback for missing regional quarter-hour fields. */}}
 return {current:parse(raw.current??{}),hours,quarters,fetchedAt:Date.now()};
}
