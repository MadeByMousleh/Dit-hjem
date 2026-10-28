import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hexValid} from './model.mjs';
import {manualAnalysis,evidenceSnapshot} from './manual-analysis.mjs';

export class Store {
  constructor(root){this.root=root;this.queue=Promise.resolve();}
  async init(){await mkdir(this.root,{recursive:true});}
  async read(name,fallback=null){try{return JSON.parse(await readFile(join(this.root,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
  async write(name,value){const tmp=join(this.root,`${name}.${randomUUID()}.tmp`);await writeFile(tmp,JSON.stringify(value));await rename(tmp,join(this.root,name));}
  async tasks(){return (await readdir(this.root)).filter(n=>/^task-.*\.json$/.test(n)).sort();}
  serial(fn){const result=this.queue.then(fn);this.queue=result.catch(()=>{});return result;}
  async save(id,revision,labels,status,houseColor=undefined,manualSelections=undefined,analysisOverride=undefined){
    return this.serial(async()=>{
      if(!/^[\da-f-]{36}$/i.test(id))throw Error('Ugyldigt opgave-id.');
      let task=await this.read(`task-${id}.json`);
      if(!task)throw Error('Opgaven findes ikke.');
      if(task.revision!==revision)throw Error('Opgaven er ændret. Genindlæs siden før du gemmer.');
      if(manualSelections!==undefined||analysisOverride!==undefined){
        if(status!=='draft')throw Error('Gem området som kladde og godkend derefter husets farve.');
        if(manualSelections!==undefined&&analysisOverride!==undefined)throw Error('Vælg enten tegnede områder eller AI-områder.');
        const before=evidenceSnapshot(task),analysis=analysisOverride??manualAnalysis(task,manualSelections,await this.read('model.json'));
        task={...task,...analysis,automaticAnalysis:task.automaticAnalysis??before,analysisHistory:[...(task.analysisHistory??[]),{revision,at:new Date().toISOString(),...before}]};
      }
      if(houseColor!==undefined){
        if(houseColor!==null&&(!['known','unknown'].includes(houseColor.visibility)||(houseColor.visibility==='known'&&!hexValid(houseColor.hex))))throw Error('Ugyldig husfarve.');
        houseColor=houseColor===null?null:{visibility:houseColor.visibility,hex:houseColor.visibility==='known'?houseColor.hex.toLowerCase():null};
        labels=houseColor?task.faces.map(f=>({faceId:f.faceId,...houseColor})):[];
      }
      if(!['draft','approved','skipped'].includes(status)||!Array.isArray(labels))throw Error('Ugyldig godkendelse.');
      const allowed=new Map(task.faces.map(f=>[f.faceId,f]));
      if(new Set(labels.map(l=>l.faceId)).size!==labels.length)throw Error('Dubleret facade.');
      const clean=labels.map(l=>{
        const face=allowed.get(l.faceId);
        if(!face||!['known','unknown'].includes(l.visibility)||(l.visibility==='known'&&!hexValid(l.hex)))throw Error('Ugyldig facade eller HEX-kode.');
        return {faceId:l.faceId,visibility:l.visibility,hex:l.visibility==='known'?l.hex.toLowerCase():null};
      });
      if(status==='approved'&&(clean.length!==task.faces.length||!clean.length))throw Error('Vurder alle synlige facader først.');
      const scope=houseColor===undefined?{}:{houseColor,annotationScope:'whole-house'};
      const event={revision:revision+1,at:new Date().toISOString(),status,labels:clean,...scope,...(manualSelections!==undefined||analysisOverride!==undefined?{manualSelections:task.manualSelections,semanticSampling:task.semanticSampling??null}: {})};
      const next={...task,revision:revision+1,status,labels:clean,...scope,history:[...task.history,event]};
      await this.write(`task-${id}.json`,next);return next;
    });
  }
  async rows(){
    const rows=[];
    for(const name of await this.tasks()){
      const t=await this.read(name);
      if(t.status!=='approved')continue;
      for(const label of t.labels){
        if(label.visibility!=='known')continue;
        const face=t.faces.find(f=>f.faceId===label.faceId);
        rows.push({...face,...label,annotationScope:t.annotationScope??'facade',taskId:t.id,status:t.status,revision:t.revision,addressId:t.address.id,source:t.source,approvedAt:t.history.at(-1).at});
      }
    }
    // File names contain random UUIDs, so their order says nothing about review
    // time. Keep the most recently approved observation for each building face.
    const latest=new Map();
    for(const row of rows){
      const key=`${row.buildingId}:${row.faceId}`,previous=latest.get(key);
      if(!previous||Date.parse(row.approvedAt)>Date.parse(previous.approvedAt))latest.set(key,row);
    }
    return [...latest.values()];
  }
}
