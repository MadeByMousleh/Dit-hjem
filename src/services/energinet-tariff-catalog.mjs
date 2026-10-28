// Runtime catalogue derived from Energinet DatahubPricelist GLN/charge records.
// Stable legacy ids preserve existing profile choices; no Strømligning fetch.
const definitions=[
 ['aal_el-net_c','Aal El-Net','Aal El-Net A M B A','DK1','5790001095451',['AAL-NT-05','AAL-NT-12'],['AAL-NTR05','AAL-NTR12']],
 ['cerius_c','Cerius','Cerius A/S','DK2','5790000705184',['30TR_C_ET']],
 ['dinel_c','Dinel','Dinel A/S','DK1','5790000610099',['TCL<100_02']],
 ['el-net_kongerslev','N1 · område 016','N1 A/S - 016','DK1','5790002502699',['C-Tarif']],
 ['elektrus_c','Elektrus','Elektrus A/S','DK2','5790000836239',['6000091']],
 ['elinor','Elinord','Elinord A/S','DK1','5790001095277',['43300']],
 ['elnet_midt_c','Elnet Midt','Elnet Midt A/S','DK1','5790001100520',['T3001']],
 ['flow_elnet','FLOW Elnet','FLOW Elnet A/S','DK1','5790000392551',['FE1 NT-01']],
 ['forsyning_elnet','Forsyning Elnet','Forsyning Elnet A/S','DK1','5790001088309',['STR-NT-03','STR-NT-02']],
 ['gev_elnet_c','Grindsted Elnet','Grindsted Elnet A/S','DK1','5790000681105',['GEV-NT-01']],
 ['hammel_elforsyning_net_as','Hammel Elforsyning','Hammel Elforsyning Net A/S','DK1','5790001090166',['C-Tarif']],
 ['hjerting_transformatorforening','Hjerting Transformatorforening','Hjerting Transformatorforening','DK1','5790001095376',['C-Tarif']],
 ['hurup_elvrk_net_c','Hurup Elværk','Hurup Elværk Net A/S','DK1','5790000610839',['HEV-NT-01T']],
 ['ikast_el_net_as_c','Ikast El Net','Ikast El Net A/S','DK1','5790000682102',['IEV-NT-01']],
 ['kimbrer_c','Kimbrer Elnet','Kimbrer Elnet A/S','DK1','5790001095239',['C-Tarif']],
 ['konstant_c','Konstant · område 151','Konstant Net A/S - 151','DK1','5790000704842',['C_FBTNTR_B'],['C_FBTNTR_R']],
 ['konstant_c_245','Konstant · område 245','Konstant Net A/S - 245','DK1','5790000683345',['C_FBTNTR_B'],['C_FBTNTR_R']],
 ['l-net','L-Net','L-Net A/S','DK1','5790001090111',['3000']],
 ['laesoe_elnet_c','Læsø Elnet','Læsø Elnet A/S','DK1','5790001103460',['43100']],
 ['midtfyns_c','Midtfyns Elforsyning','Midtfyns Elforsyning A.m.b.A','DK1','5790001089023',['TNT15000']],
 ['n1_344','N1 · område 344','N1 A/S - 344','DK1','5790000611003',['T-C-F-F-TD']],
 ['n1_c','N1 · område 131','N1 A/S - 131','DK1','5790001089030',['CD']],
 ['netselskabet_elvaerk_331_c','Netselskabet Elværk','Netselskabet Elværk A/S','DK1','5790000681358',['5NCFF']],
 ['noe_net','NOE Net','NOE Net A/S','DK1','5790000395620',['30030']],
 ['nord_energi_net','Nord Energi Net','Nord Energi Net A/S','DK1','5790000610877',['TAC']],
 ['radius_c','Radius','Radius Elnet A/S','DK2','5790000705689',['DT_C_01']],
 ['rah_c','RAH Net','RAH Net A/S','DK1','5790000681327',['RAH-C']],
 ['ravdex','Ravdex','Ravdex A/S','DK1','5790000836727',['NT-C','NTB60']],
 ['sunds_net','Sunds Net','Sunds Net A.m.b.a','DK1','5790001095444',['SEF-NT-05'],['SEF-NT-05R']],
 ['tarm_elværk_net_as','Tarm Elværk','Tarm Elværk Net A/S','DK1','5790000706419',['TEV-NT-01T']],
 ['trefor_el-net_c','TREFOR El-net','TREFOR El-net A/S','DK1','5790000392261',['C']],
 ['trefor_el-net_oest_c','TREFOR El-net Øst','TREFOR El-net Øst A/S','DK2','5790000706686',['46']],
 ['veksel','Veksel','Veksel A/S','DK1','5790001088217',['NT-01']],
 ['vores_elnet','Vores Elnet','Vores Elnet A/S','DK1','5790000610976',['TNT1009']],
 ['zeanet','Zeanet','Zeanet A/S','DK2','5790001089375',['43110']],
];
const history={
 konstant_c:[{before:'2026-03-01',tariffCodes:['151-NT01T'],optionalCodes:['151-NRA04T']}],
 konstant_c_245:[{before:'2026-03-01',tariffCodes:['245-NT01T'],optionalCodes:['245-NRA04T']}],
 'l-net':[{before:'2025-04-01',tariffCodes:['4010'],optionalCodes:[]}],
};
export const ENERGINET_GRID_SUPPLIERS=definitions.map(([id,name,companyName,area,gln,tariffCodes,optionalCodes=[]])=>({id,name,companyName,area,gln,tariffCodes,optionalCodes,history:history[id]??[]}));
export function allSupplierTariffCodes(supplier){return [supplier,...supplier.history].flatMap(p=>[...p.tariffCodes,...p.optionalCodes]);}
export const ENERGINET_COMMON_CHARGES={gln:'5790000432752',tariffCodes:['40000','41000','EA-001']};
export function tariffSupplier(id){return ENERGINET_GRID_SUPPLIERS.find(s=>s.id===id);}
export const PRICE_SOURCE={id:'energinet-v1',name:'Energinet / Energi Data Service',license:'CC BY 4.0',url:'https://www.energidataservice.dk/terms-and-conditions',changes:'Omregnet til øre/kWh; moms og relevante C-tariffer er lagt til. Ingen prisprognoser.'};
