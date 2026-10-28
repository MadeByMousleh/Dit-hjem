const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const transientStatus=status=>[408,429,500,502,503,504].includes(status);
export function retryAfterMs(value,now=Date.now()){
 if(!value)return 0;const seconds=Number(value);return Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,(Date.parse(value)||now)-now);
}
export class GeminiRequestError extends Error {
 constructor(status,message,providerStatus,retryAfter=0){super(`Gemini ${status}: ${message}`);Object.assign(this,{httpStatus:status,providerStatus,retryAfter,retryable:transientStatus(status),blocking:[401,402,403].includes(status)});}
}
export function errorInfo(error){return {message:error.message,httpStatus:error.httpStatus??null,providerStatus:error.providerStatus??null,retryable:!!error.retryable,blocking:!!error.blocking,attempts:error.attempts??null,retryAfter:error.retryAfter??0,causeCode:error.cause?.code??null};}
export class GeminiQueue {
 constructor({now=Date.now,sleep=delay,random=Math.random,minGapMs=0,baseDelayMs=1000,maxDelayMs=60000,maxAttempts=4}={}){Object.assign(this,{now,sleep,random,minGapMs,baseDelayMs,maxDelayMs,maxAttempts});this.tail=Promise.resolve();this.nextAllowed=0;this.blocked=null;this.state={phase:'idle',queued:0,retryPolicy:'short-v1'};}
 async publish(values){this.state={...this.state,...values,updatedAt:new Date(this.now()).toISOString()};await this.onState?.({...this.state});}
 restore(state,{model}={}){
  // A different model need not inherit the old model's capacity cooldown.
  // Account/quota blocks and cooldowns for the same model remain intact.
  if(model&&state?.phase!=='blocked'&&state?.error?.httpStatus===503&&(state.context?.model??'gemini-3-flash-preview')!==model)state={...state,error:null,nextAttemptAt:null,phase:'idle'};
  // Migrate the previous local 30/60/120-second overload schedule once.
  if(state?.phase==='cooldown'&&state.retryPolicy!=='short-v1'&&(state.error?.httpStatus===503||state.error?.retryable&&state.error.httpStatus==null)&&!state.error.retryAfter){
   const attempt=Math.max(1,state.error.attempts??state.attempt??1),updated=Date.parse(state.updatedAt)||this.now();
   const until=updated+Math.min(this.maxDelayMs,this.baseDelayMs*2**(attempt-1))*1.2;
   state={...state,nextAttemptAt:new Date(Math.min(Date.parse(state.nextAttemptAt)||until,until)).toISOString()};
  }
  if(state?.nextAttemptAt)this.nextAllowed=Math.max(0,Date.parse(state.nextAttemptAt)||0);if(state?.phase==='blocked')this.blocked=state.error;if(state)this.state={...state,retryPolicy:'short-v1',queued:0,phase:this.blocked?'blocked':this.nextAllowed>this.now()?'cooldown':'idle'};
 }
 run(operation,context={},{maxAttempts=this.maxAttempts}={}){
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>this.maxAttempts)throw Error('Invalid per-request attempt limit.');
  this.state.queued++;const job=this.tail.then(()=>this.execute(operation,context,maxAttempts));this.tail=job.catch(()=>{});return job;
 }
 async execute(operation,context,maxAttempts=this.maxAttempts){
  this.state.queued=Math.max(0,this.state.queued-1);
  if(this.blocked){const error=new GeminiRequestError(this.blocked.httpStatus,this.blocked.message,this.blocked.providerStatus);error.blocking=true;throw error;}
  for(let attempt=1;attempt<=maxAttempts;attempt++){
   const wait=Math.max(0,this.nextAllowed-this.now());
   if(wait){await this.publish({phase:'cooldown',context,attempt,nextAttemptAt:new Date(this.nextAllowed).toISOString()});await this.sleep(wait);}
   await this.publish({phase:'requesting',context,attempt,nextAttemptAt:null});this.nextAllowed=this.now()+this.minGapMs;
   try{const result=await operation();this.nextAllowed=this.now()+this.minGapMs;await this.publish({phase:'idle',error:null,nextAttemptAt:new Date(this.nextAllowed).toISOString()});return result;}
   catch(error){
    if(error.retryable===undefined)error.retryable=['TimeoutError','AbortError'].includes(error.name)||(error.name==='TypeError'&&/fetch|network/i.test(error.message));
    error.attempts=attempt;
    if(error.blocking){this.blocked=errorInfo(error);await this.publish({phase:'blocked',error:this.blocked,nextAttemptAt:null});throw error;}
    if(!error.retryable){await this.publish({phase:'idle',error:errorInfo(error),nextAttemptAt:null});throw error;}
    const backoff=Math.min(this.maxDelayMs,this.baseDelayMs*2**(attempt-1));
    const milliseconds=Math.max(this.minGapMs,error.retryAfter??0,backoff+backoff*.2*this.random());
    this.nextAllowed=this.now()+milliseconds;
    await this.publish({phase:'cooldown',error:errorInfo(error),context,attempt,nextAttemptAt:new Date(this.nextAllowed).toISOString()});
    if(attempt===maxAttempts)throw error;
   }
  }
 }
}
export const geminiQueue=new GeminiQueue();
