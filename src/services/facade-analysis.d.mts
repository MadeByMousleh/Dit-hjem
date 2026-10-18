export type ImagePoint=[number,number];
export type FacadeAnalysis={version:1|2;confidence:number;material:'brick'|'plaster'|'wood'|'other';wallColor:string;frameColor:string;facadeQuad?:ImagePoint[];coverage?:'full'|'partial';aspect?:number;openings:{kind:'window'|'door'|'garage';x:number;y:number;width:number;height:number;confidence:number;columns:number;imageQuad?:ImagePoint[];verticalBars?:number[];horizontalBars?:number[];frameColor?:string;panelColor?:string}[]};
export function validateFacadeAnalysis(value:unknown):FacadeAnalysis;
export function validateQuad(value:unknown):ImagePoint[];
export function facadeProjection(quad:ImagePoint[]):(point:ImagePoint)=>ImagePoint;
export function rectifyFacadeAnalysis(raw:unknown,imageWidth?:number,imageHeight?:number):FacadeAnalysis;
