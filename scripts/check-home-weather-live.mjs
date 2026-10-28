import {build} from 'esbuild';
import assert from 'node:assert/strict';
const built=await build({entryPoints:['src/services/home-weather.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {loadHomeWeather,weatherAt}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
try{const data=await loadHomeWeather(55.68,12.57,controller.signal);assert.ok(data.hours.length>=24);assert.ok(data.quarters.length>0);assert.ok(weatherAt(data,Date.now(),true));console.log(JSON.stringify({publicLocation:'Copenhagen',hourSamples:data.hours.length,quarterHourSamples:data.quarters.length,liveSampleAvailable:true}));}finally{clearTimeout(timer);}
