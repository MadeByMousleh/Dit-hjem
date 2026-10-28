import {SettingsDropdown} from './SettingsDropdown';
export type PriceDisplayMode='total'|'spot';
export const priceModeNote=(mode:PriceDisplayMode)=>mode==='spot'?'Spotpris uden moms, elafgift og nettariffer.':'Inkl. moms, elafgift og nettariffer. Uden elaftalens tillæg og abonnement.';
export function PriceModeFields({value,onChange,disabled=false}:{value:PriceDisplayMode;onChange:(value:PriceDisplayMode)=>void;disabled?:boolean}){
 return <SettingsDropdown label="Prisvisning" value={value} options={[{value:'total',label:'Med moms og afgifter',detail:'Inkl. nettariffer'},{value:'spot',label:'Kun spotpris',detail:'Uden moms, afgifter og net'}]} disabled={disabled} onChange={mode=>onChange(mode as PriceDisplayMode)}/>;
}
