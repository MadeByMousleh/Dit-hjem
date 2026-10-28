const boundaryIds={'3159':'n1_c','3220':'n1_344','3167':'trefor_el-net_c','3596':'trefor_el-net_oest_c','3100':'radius_c','3592':'radius_c','3143':'cerius_c','3544':'cerius_c','3558':'cerius_c','3559':'cerius_c'};
const normalize=s=>s.toLocaleLowerCase('da-DK').replace(/\ba\s*\/\s*s\b|\baps\b|\ba\s*\.?\s*m\s*\.?\s*b\s*\.?\s*a\b/g,'').replace(/[^a-z0-9æøå]/g,'');
export function matchAddressSupplier(grid,suppliers){
 const id=boundaryIds[grid.cvr];
 const matches=suppliers.filter(s=>id?s.id===id:normalize(s.companyName??s.name)===normalize(grid.name));
 return matches.length===1?matches[0]:undefined;
}
