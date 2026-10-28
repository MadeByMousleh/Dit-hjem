// Download pinned public model data only; no property photos leave this machine.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const HOUSE_MODELS=[
  {repo:'facebook/sam2.1-hiera-tiny',revision:'de431c4043854a71d8101e17995dfe596bf101a5',directory:'house-sam2',files:['README.md','config.json','preprocessor_config.json','processor_config.json','model.safetensors']},
  {repo:'IDEA-Research/grounding-dino-tiny',revision:'a2bb814dd30d776dcf7e30523b00659f4f141c71',directory:'house-dino',files:['README.md','config.json','preprocessor_config.json','added_tokens.json','special_tokens_map.json','tokenizer.json','tokenizer_config.json','vocab.txt','model.safetensors']},
];
for(const model of HOUSE_MODELS){
  const root=new URL(`./data/${model.directory}/`,import.meta.url);await mkdir(root,{recursive:true});
  const response=await fetch(`https://huggingface.co/api/models/${model.repo}/revision/${model.revision}?blobs=true`);
  if(!response.ok)throw Error(`Model metadata ${response.status}`);
  const metadata=await response.json(),files=[];
  for(const name of model.files){
    const entry=metadata.siblings.find(s=>s.rfilename===name);if(!entry)throw Error('Missing model file '+name);
    let bytes;try{bytes=await readFile(new URL(name,root));}catch{}
    const valid=data=>data&&(entry.lfs?.sha256?createHash('sha256').update(data).digest('hex')===entry.lfs.sha256:createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')===entry.blobId);
    if(!valid(bytes)){
      console.log(`Downloading ${model.repo}/${name}`);
      const result=await fetch(`https://huggingface.co/${model.repo}/resolve/${model.revision}/${name}`);if(!result.ok)throw Error(`${name}: ${result.status}`);
      bytes=Buffer.from(await result.arrayBuffer());if(!valid(bytes))throw Error('Model file hash mismatch: '+name);
      await writeFile(new URL(name,root),bytes);
    }
    files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await writeFile(new URL('provenance.json',root),JSON.stringify({...model,declaredLicense:metadata.cardData?.license,files},null,2));
  console.log(`Ready: ${model.repo}`);
}
