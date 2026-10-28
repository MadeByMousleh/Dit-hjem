export type PriceLimits={cheapBelow:number;expensiveFrom:number};
export const defaultPriceLimits:PriceLimits={cheapBelow:1.5,expensiveFrom:2};
export function parsePriceLimit(text:string){const value=text.trim();return /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)?Number(value.replace(',','.')):NaN;}
export function validPriceLimits(value:unknown):value is PriceLimits{
 const v=value as PriceLimits|undefined;
 return !!v&&Number.isFinite(v.cheapBelow)&&Number.isFinite(v.expensiveFrom)&&v.cheapBelow>=-1000&&v.expensiveFrom<=1000&&v.cheapBelow<v.expensiveFrom;
}
export const priceLevel=(price:number,limits:PriceLimits)=>price<limits.cheapBelow?'low':price>=limits.expensiveFrom?'high':'medium';
export const priceLevelColor=(price:number,limits:PriceLimits)=>({low:'#238454',medium:'#B07900',high:'#B42318'})[priceLevel(price,limits)];
export function priceWidgetHours(points:{startsAt:Date;totalOrePerKwh:number}[]){
 const groups=new Map<number,{sum:number;count:number}>();
 for(const p of points){if(!Number.isFinite(+p.startsAt)||!Number.isFinite(p.totalOrePerKwh))continue;const at=Math.floor(+p.startsAt/3600000)*3600000,group=groups.get(at)??{sum:0,count:0};group.sum+=p.totalOrePerKwh;group.count++;groups.set(at,group);}
 return [...groups].sort((a,b)=>a[0]-b[0]).map(([at,g])=>({at,price:g.sum/g.count/100}));
}
