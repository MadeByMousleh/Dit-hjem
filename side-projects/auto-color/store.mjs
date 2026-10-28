import {writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store as OriginalStore} from '../color-trainer/store.mjs';

export class Store extends OriginalStore {
 async write(name,value){
  const temporary=join(this.root,`${name}.${randomUUID()}.tmp`),destination=join(this.root,name);
  try{
   await writeFile(temporary,JSON.stringify(value));
   for(let attempt=0;;attempt++){
    try{await rename(temporary,destination);return;}
    catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=7)throw error;await new Promise(resolve=>setTimeout(resolve,Math.min(500,25*2**attempt)));}
   }
  }finally{await rm(temporary,{force:true}).catch(()=>{});}
 }
}
