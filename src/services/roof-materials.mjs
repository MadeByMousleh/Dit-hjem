// Official BBR BYG.033 families. The register does not identify tile profile,
// precise color, or which roof plane uses a supplementary material.
// https://teknik.bbr.dk/kodelister/0/1/0/Tagdaekningsmateriale
const materials={
 '1':['Tagpap med lille hældning','felt'], '2':['Tagpap med stor hældning','felt'],
 '3':['Fibercement, herunder asbest','fiber-cement'], '4':['Cementsten','concrete-tile'],
 '5':['Tegl','clay-tile'], '6':['Metal','metal'], '7':['Stråtag','thatch'],
 '10':['Fibercement uden asbest','fiber-cement'], '11':['Plast','plastic'],
 '12':['Glas','glass'], '80':['Ingen tagdækning','none'], '90':['Andet materiale','unknown'],
};
export function roofMaterial(code,supplementaryCode){
 const normalized=typeof code==='string'||typeof code==='number'?String(Number(code)):'';
 const entry=materials[normalized];if(!entry)return null;
 const supplemental=materials[String(Number(supplementaryCode))]?String(Number(supplementaryCode)):undefined;
 return {code:normalized,label:entry[0],kind:entry[1],source:'BBR',...(supplemental&&supplemental!==normalized?{supplementaryCode:supplemental}:{})};
}
