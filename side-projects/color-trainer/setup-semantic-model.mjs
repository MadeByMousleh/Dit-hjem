import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const clip=process.argv.includes('--clipseg');
const repo=clip?'CIDAS/clipseg-rd64-refined':'Marco333/segformer-b0-facade-cmp',revision=clip?'999e0328d9e10b484360c477313983f9afdd7050':'f95d623ab89d1179d9f59b8d390cc7a2818d255a';
const root=new URL(clip?'./data/facade-clipseg/':'./data/facade-segformer/',import.meta.url);await mkdir(root,{recursive:true});
const response=await fetch(`https://huggingface.co/api/models/${repo}/revision/${revision}?blobs=true`);
if(!response.ok)throw Error(`Model metadata: ${response.status}`);
const metadata=await response.json(),files=[];
for(const name of ['config.json','preprocessor_config.json','model.safetensors','README.md',...(clip?['merges.txt','vocab.json','tokenizer_config.json','special_tokens_map.json']:[])]){
  const r=await fetch(`https://huggingface.co/${repo}/resolve/${revision}/${name}`);if(!r.ok)throw Error(`${name}: ${r.status}`);
  const bytes=Buffer.from(await r.arrayBuffer()),entry=metadata.siblings.find(s=>s.rfilename===name);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(entry?.lfs?.sha256&&sha256!==entry.lfs.sha256)throw Error('Model hash mismatch.');
  if(!entry?.lfs&&entry?.blobId&&createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==entry.blobId)throw Error('Metadata hash mismatch.');
  await writeFile(new URL(name,root),bytes);files.push({name,bytes:bytes.length,sha256});
}
await writeFile(new URL('provenance.json',root),JSON.stringify({repo,revision,declaredLicense:metadata.cardData?.license,files},null,2));
console.log(JSON.stringify({model:repo,revision,files:files.map(f=>({name:f.name,bytes:f.bytes})),path:fileURLToPath(root)}));
