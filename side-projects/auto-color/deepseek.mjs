import {GeminiRequestError,retryAfterMs} from './gemini-queue.mjs';

// JSON mode guarantees JSON, not our schema. Reject malformed labels locally.
export function validateTeacherJSON(value,schema,path='result'){
 const type=schema.type?.toLowerCase();
 if(type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`Invalid teacher JSON: ${path}`);
  for(const name of schema.required??[])if(!Object.hasOwn(value,name))throw Error(`Missing teacher field: ${path}.${name}`);
  for(const [name,child]of Object.entries(schema.properties??{}))if(Object.hasOwn(value,name))validateTeacherJSON(value[name],child,`${path}.${name}`);
 }else if(type==='array'){
  if(!Array.isArray(value))throw Error(`Invalid teacher array: ${path}`);
  for(const item of value)validateTeacherJSON(item,schema.items,path+'[]');
 }else if(type==='number'?!Number.isFinite(value):type&&typeof value!==type)throw Error(`Invalid teacher value: ${path}`);
 if(schema.enum&&!schema.enum.includes(value))throw Error(`Invalid teacher enum: ${path}`);
 return value;
}
function example(schema){
 switch(schema.type?.toLowerCase()){
  case 'object':return Object.fromEntries(Object.entries(schema.properties??{}).map(([k,v])=>[k,example(v)]));
  case 'array':return [example(schema.items)];
  case 'boolean':return false;
  case 'number':return 0;
  default:return schema.enum?.[0]??'';
 }
}
export async function askDeepSeek(prompt,images,schema,{fetcher=fetch,key=process.env.DEEP_SEEK,onUsage=async()=>{},maxOutputTokens=2000,model='deepseek-flash',thinking=false}={}){
 if(!key)throw Error('DEEP_SEEK is not configured.');
 const response=await fetcher('https://api.deepseek.com/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(thinking?180000:60000),
  body:JSON.stringify({model,thinking:{type:thinking?'enabled':'disabled'},...(thinking?{reasoning_effort:'high'}:{}),response_format:{type:'json_object'},max_tokens:thinking?Math.max(14000,maxOutputTokens):maxOutputTokens,
   messages:[{role:'system',content:`Return only JSON matching this schema: ${JSON.stringify(schema)}. Example structure (not factual labels): ${JSON.stringify(example(schema))}. Never copy example values as evidence.`},
    {role:'user',content:[{type:'text',text:prompt},...images.flatMap(p=>[{type:'text',text:`IMAGE ID: ${p.id}${p.capturedAt?'; captured '+p.capturedAt:''}`},{type:'image_url',image_url:{url:p.image}}])]}]})});
 if(!response.ok){
  // Never echo provider response bodies: they may contain credentials or input.
  const error=new GeminiRequestError(response.status,'Image analysis request failed',null,retryAfterMs(response.headers.get('retry-after')));
  error.message=`DeepSeek ${response.status}: Image analysis request failed`;throw error;
 }
 const data=await response.json(),usage=data.usage??{};
 // Peak uncached rates are a conservative upper bound; off-peak/cache can cost less.
 const estimatedUsd=((usage.prompt_cache_hit_tokens??0)*.006+(usage.prompt_cache_miss_tokens??Math.max(0,(usage.prompt_tokens??0)-(usage.prompt_cache_hit_tokens??0)))*.30+(usage.completion_tokens??0)*1.20)/1e6;
 await onUsage({provider:'deepseek',model,thinking,usage,estimatedUsd,costBasis:'peak-rate upper bound; actual off-peak/cache charges may be lower'});
 const choice=data.choices?.[0];if(choice?.finish_reason!=='stop')throw Error('DeepSeek response incomplete; no labels accepted.');
 let result;
 try{result=validateTeacherJSON(JSON.parse(choice.message.content),schema);}
 catch(cause){const error=new Error('DeepSeek JSON does not match required schema.');error.schemaField=cause.message.startsWith('Invalid teacher')||cause.message.startsWith('Missing teacher')?cause.message:'Invalid JSON syntax';error.invalidTeacherJSON=true;error.retryable=true;throw error;}
 return {provider:'deepseek',model,thinking,result,usage};
}
