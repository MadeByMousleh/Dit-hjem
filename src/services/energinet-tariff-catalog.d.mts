export type TariffPlan={tariffCodes:string[];optionalCodes:string[]};
export type TariffSupplier=TariffPlan&{id:string;name:string;companyName:string;area:'DK1'|'DK2';gln:string;history:(TariffPlan&{before:string})[]};
export function allSupplierTariffCodes(supplier:TariffSupplier):string[];
export const ENERGINET_GRID_SUPPLIERS:TariffSupplier[];
export const ENERGINET_COMMON_CHARGES:{gln:string;tariffCodes:string[]};
export function tariffSupplier(id:string):TariffSupplier|undefined;
export const PRICE_SOURCE:{id:string;name:string;license:string;url:string;changes:string};
