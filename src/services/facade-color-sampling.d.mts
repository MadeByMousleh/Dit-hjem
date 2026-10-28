export const SAMPLING_VERSION:2;
export type MaskAssessment={accepted:boolean;reason:string|null;pixels?:number;coverage?:number;span?:[number,number]};
export function runsFor(indices:number[]):number[][];
export function maskFromRuns(runs:number[][],width:number,height:number):Uint8Array;
export function assessMask(indices:number[],width:number):MaskAssessment;
export function conservativeInterior(indices:number[],width:number,height:number):MaskAssessment&{margin:number;indices:number[]};
export function photoKey(photo:{direction?:string;capturedAt?:string;camera?:{crop?:unknown}}):string;
