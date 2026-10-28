import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateHoldout} from './evaluate.mjs';import {split} from '../color-trainer/model.mjs';
test('Accuracy evaluation uses separate houses and reports paired RGB errors',()=>{
 const ids=Array.from({length:100},(_,i)=>String(i)),trainId=ids.find(id=>split(id)==='train'),held=ids.filter(id=>split(id)==='test').slice(0,2),feature=Array(9).fill(.5);
 const old={samples:[{buildingId:trainId,feature,hex:'#808080'}]},model={samples:[{buildingId:trainId,feature,hex:'#787878'}]};
 const rows=[0,0,0,1].map((n,i)=>({buildingId:held[n],faceId:String(i),feature,hex:'#787878'}));
 const result=evaluateHoldout(model,old,rows);assert.equal(result.houseCount,2);assert.equal(result.faceCount,4);assert.equal(result.faceMAE,0);assert.equal(result.previousFaceMAE,8);assert.equal(result.improved,2);assert.equal(result.within[0].count,2);assert.deepEqual(result.pairedHouseDelta95Bootstrap,[-8,-8]);
 assert.throws(()=>evaluateHoldout({...model,samples:[...model.samples,{buildingId:held[0]}]},old,rows),/overlapper/);
 assert.equal(evaluateHoldout(model,old,[]),null);
});
