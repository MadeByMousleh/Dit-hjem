export type OpeningRect={x:number;y:number;width:number;height:number};
export type SceneEdits={openings:Record<string,OpeningRect|null>;plinth:{height:number;color:string}};
export const defaultSceneEdits=():SceneEdits=>({openings:{},plinth:{height:.3,color:'#777672'}});
export function validateSceneEdits(value:unknown):SceneEdits{
 const v=value as SceneEdits;if(!v||!v.openings||Object.keys(v.openings).length>500||!v.plinth||!Number.isFinite(v.plinth.height)||v.plinth.height<0||v.plinth.height>1.2||!/^#[0-9a-f]{6}$/i.test(v.plinth.color))throw Error('INVALID_EDITS');
 for(const [id,r] of Object.entries(v.openings)){if(id.length>240||r&&(![r.x,r.y,r.width,r.height].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||r.width<.015||r.height<.03||r.x+r.width>1.001||r.y+r.height>1.001))throw Error('INVALID_OPENING');}
 return v;
}
export function openingKey(model:{id:string;analysis:{openings:OpeningRect[]}},index:number){const o=model.analysis.openings[index]!;return `${model.id}:${index}:${[o.x,o.y,o.width,o.height].map(n=>n.toFixed(4)).join(':')}`;}
