import {Store} from './store.mjs';
import {needsColorConfirmation,colorConfirmed} from './color-confirmation.mjs';
import {facadeFeatures,train,predict,rgb,split} from '../color-trainer/model.mjs';
export function evaluateModel(model,rows){
 if(!model||!rows.length)return null;
 return {houses:new Set(rows.map(r=>r.buildingId)).size,facades:rows.length,rgbMAE:rows.reduce((sum,r)=>sum+rgb(predict(model,r.feature)).reduce((n,v,i)=>n+Math.abs(v-rgb(r.hex)[i]),0)/3,0)/rows.length};
}
export async function trainCandidate(files,pilot,patches,{manualRoot='side-projects/color-trainer/data'}={}){
 if(needsColorConfirmation(pilot)&&!colorConfirmed(pilot,await files.read('review.json')))throw Error('Afventer din bekræftelse af AI-farven.');
 if(pilot.verification?.accepted!==true||pilot.imageReview?.rejectedImageIds?.length)throw Error('Facadebillederne har ikke bestået fuld billedkontrol.');
 if(!pilot.teacher?.accepted||pilot.labelProvenance?.humanApproved!==false)throw Error('Der mangler en godkendt AI-pseudolabel.');
 const evidence=facadeFeatures(patches);if(!evidence.faces.length)throw Error('Ingen facadeområder passerede pixelkontrollen.');
 const manual=new Store(manualRoot),humanRows=await manual.rows(),baseline=await manual.read('model.json');
 const holdout=humanRows.filter(r=>split(r.buildingId)==='test'),holdoutIds=new Set(holdout.map(r=>r.buildingId));
 const admitted=split(pilot.buildingId)==='train'&&!holdoutIds.has(pilot.buildingId);
 const pseudoRows=admitted?evidence.faces.map(face=>({...face,buildingId:pilot.buildingId,hex:pilot.teacher.result.facadeHex,status:'approved',labelOrigin:'gemini-pseudo-label'})):[];
 const model=train([...humanRows.filter(r=>split(r.buildingId)==='train'),...pseudoRows]);
 const baselineEvaluation=evaluateModel(baseline,holdout),candidateEvaluation=evaluateModel(model,holdout);
 const candidate={...model,labelOrigin:'human-labels-plus-gemini-pseudo-label',automaticPromotion:false,pilotId:pilot.id,aiTrainingHouses:admitted?1:0,pseudoLabels:pseudoRows.length,manualTrainingHouses:new Set(humanRows.filter(r=>split(r.buildingId)==='train').map(r=>r.buildingId)).size,evaluation:{basis:'Human-confirmed HEX on physically separate houses, not Gemini labels',baseline:baselineEvaluation,candidate:candidateEvaluation,deltaRgbMAE:baselineEvaluation&&candidateEvaluation?candidateEvaluation.rgbMAE-baselineEvaluation.rgbMAE:null,notice:'Én pilot dokumenterer ikke en generel forbedring. Ingen automatisk modeludskiftning.'}};
 await files.write(`candidate-${pilot.id}.json`,candidate);await files.write(`evidence-${pilot.id}.json`,{patches,faces:evidence.faces,rejectedFaces:evidence.rejectedFaces,teacher:pilot.teacher.result,labelOrigin:'gemini-pseudo-label'});
 return {file:`candidate-${pilot.id}.json`,version:candidate.version,aiTrainingHouses:candidate.aiTrainingHouses,pseudoLabels:candidate.pseudoLabels,manualTrainingHouses:candidate.manualTrainingHouses,facades:evidence.faces.length,excludedFacades:evidence.rejectedFaces.length,split:split(pilot.buildingId),evaluation:candidate.evaluation,productionModelChanged:false};
}
