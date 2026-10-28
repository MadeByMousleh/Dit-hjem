import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const references=aerial=>aerial.filter(p=>p.direction!=='nadir').slice(0,2);

// Group thumbnails in sixes and full-size audits in pairs. Reuse all
// existing cached results; leaf calls retain bounded error retries/Retry-After.
export async function adaptiveImageChecks(files,images,aerial,{kind,call,options={}}){
 const minimum=kind==='audit'?2:6,canSplit=images.length>minimum||kind==='audit'&&aerial.length>2;
 const key=digest({version:'capacity-split-v1',kind,images:images.map(p=>[p.id,p.sha256??digest(p.image)]),aerial:aerial.map(p=>[p.id,digest(p.image)])});
 const file=`adaptive-${kind}-${key.slice(0,24)}.json`,saved=await files.read(file);if(saved)return saved;
 let answer;
 if(canSplit){
  const refs=kind==='audit'?references(aerial):[],size=minimum,parts=[];
  for(let start=0;start<images.length;start+=size)parts.push(await adaptiveImageChecks(files,images.slice(start,start+size),refs,{kind,call,options:{...options,smallerBatch:true}}));
  answer={model:parts[0]?.model,result:{checks:parts.flatMap(p=>p.result.checks)},capacitySplit:true,parts};
 }else answer=await call(images,aerial,{...options,context:{...options.context,imageCount:images.length+aerial.length,smallerBatch:true}});
 await files.write(file,answer);return answer;
}

export async function adaptiveAppearance(files,sales,aerial,{labeler,options={},leaf=false}={}){
 const key=digest({version:'capacity-split-v1',sales:sales.map(p=>[p.id,p.sha256??digest(p.image)]),aerial:aerial.map(p=>[p.id,digest(p.image)])}),file=`adaptive-label-${key.slice(0,24)}.json`,saved=await files.read(file);if(saved)return saved;
 const canSplit=!leaf&&sales.length+aerial.length>4;
 let answers;
 if(canSplit){
  const refs=references(aerial),anchor=sales.find(p=>p.audit?.facadeAccepted)??sales[0];
  if(!anchor||refs.length<2)throw Error('Small appearance requests require a facade anchor and two oblique references.');
  answers=[];
  // Every sale view is examined, with a wall reference for roof-only closeups.
  for(const sale of sales){const images=sale.audit?.facadeAccepted||sale.id===anchor.id?[sale]:[anchor,sale];answers.push(...await adaptiveAppearance(files,images,refs,{labeler,options,leaf:true}));}
  // Additional aerial views are also examined, not silently dropped as context.
  for(const extra of aerial.filter(p=>!refs.some(r=>r.id===p.id))){
   const views=extra.direction==='nadir'?[...refs,extra]:[refs[0],extra];
   answers.push(...await adaptiveAppearance(files,[anchor],views,{labeler,options,leaf:true}));
  }
 }else answers=[await labeler(sales,aerial,{...options,context:{...options.context,imageCount:sales.length+aerial.length,smallerBatch:true}})];
 await files.write(file,answers);return answers;
}
