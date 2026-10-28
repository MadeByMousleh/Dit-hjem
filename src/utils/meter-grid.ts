import type {GridSupplier} from '../prices';
export type MeterGrid={meteringPointId:string;typeOfMP:string;gridOperatorName:string|null;gridOperatorId:string|null;gridArea:string|null;darReference:string|null};
export type MeterGridEvidence={version:1;checkedAt:string;meters:MeterGrid[]};
const company=(s:string)=>s.toLocaleLowerCase('da-DK').replace(/\s*-\s*\d+$/,'').replace(/\ba\s*\/\s*s\b|\baps\b|\ba\s*m\s*b\s*a\b/g,'').replace(/[^a-z0-9æøå]/g,'');
export function resolveMeterSupplier(meters:MeterGrid[],addressId:string|undefined,suppliers:GridSupplier[]):{supplier?:GridSupplier;reason?:string}{
 const points=meters.filter(m=>m.typeOfMP==='E17');
 if(!points.length)return {reason:'Eloverblik har ikke leveret et forbrugsmålepunkt.'};
 if(!addressId||points.some(m=>!m.darReference||m.darReference.toLowerCase()!==addressId.toLowerCase()))return {reason:'Målerne kan ikke matches entydigt til denne bolig.'};
 const resolved:GridSupplier[]=[];
 for(const m of points){
  const name=company(m.gridOperatorName??''),area=(m.gridArea??'').replace(/^0+(?=\d)/,'');
  let candidates=suppliers.filter(s=>name&&company(s.companyName??s.name)===name);
  const gln=/^\d{13}$/.test(m.gridOperatorId??'')?m.gridOperatorId:null;
  if(gln)candidates=suppliers.filter(s=>s.gln===gln);
  if(name==='n1'&&!gln){
   const id=area==='131'?'n1_c':area==='344'?'n1_344':area==='16'?'el-net_kongerslev':undefined;
   candidates=id?candidates.filter(s=>s.id===id):[];
  }
  if(name==='konstantnet'&&!gln){const id=area==='151'?'konstant_c':area==='245'?'konstant_c_245':undefined;candidates=id?candidates.filter(s=>s.id===id):[];}
  if(candidates.length!==1)return {reason:'Målerens netområde har ikke ét sikkert tarifmatch.'};
  resolved.push(candidates[0]!);
 }
 if(new Set(resolved.map(s=>s.id)).size!==1)return {reason:'Målerne bruger forskellige netselskaber eller tarifområder.'};
 return {supplier:resolved[0]};
}
