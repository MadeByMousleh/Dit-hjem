export function matchAddressSupplier<T extends {id:string;name:string;companyName?:string}>(grid:{cvr:string;name:string},suppliers:T[]):T|undefined;
