import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleObjects,roofProfile} from './policy.mjs';
import {reviewKey,scopedReviews} from './review-scope.mjs';
const object=(id,kind,category='solar_panel',hash=id)=>({id,kind,viewId:id,category,sourceSha256:hash,score:.95});
const sale=object('sale','sale'),east=object('east','aerial'),west=object('west','aerial');
test('Automatic labels need EDC evidence and two distinct aerial photos',()=>{
 const house={teacherTargets:['solar_panel'],objects:[sale,east]};assert.equal(eligibleObjects(house).length,0);
 house.objects.push(west);assert.equal(eligibleObjects(house).length,0);
 house.objects=[east,west];assert.equal(eligibleObjects(house).length,0);
 house.objects=[sale,east,{...west,sourceSha256:east.sourceSha256}];assert.equal(eligibleObjects(house).length,0);
});
test('Unknown/rejected manual decisions override automatic consensus',()=>{
 const house={teacherTargets:['solar_panel'],objects:[sale,east,west]};
 assert.equal(eligibleObjects(house,{west:{category:'unknown'}}).length,0);
 assert.equal(eligibleObjects(house,{west:{category:'not_object'}}).length,0);
 const approved=eligibleObjects({...house,objects:[east]},{east:{category:'chimney'}});assert.equal(approved[0].category,'chimney');assert.equal(approved[0].humanVerified,true);
});
test('No unsupported chimney labels, inferred absence or confidence shortcuts',()=>{
 const house={teacherTargets:['solar_panel'],objects:[object('s','sale','chimney'),object('e','aerial','chimney'),object('w','aerial','chimney')]};assert.equal(eligibleObjects(house).length,0);assert.equal(roofProfile(house).chimney.status,'unknown');
 house.objects=[sale,east,{...west,score:.3}];assert.equal(eligibleObjects(house).length,0);
});
test('Review cannot spread to another house with the same detector ID',()=>{
 const a={id:'a',objects:[object('same','aerial','chimney')]},b={id:'b',objects:[object('same','aerial','chimney')]},report={houses:[a,b]};
 const reviews={[reviewKey('a','same','same')]:{category:'chimney'}};
 assert.equal(eligibleObjects(a,scopedReviews(report,reviews,a)).length,1);
 assert.equal(eligibleObjects(b,scopedReviews(report,reviews,b)).length,0);
 assert.deepEqual(scopedReviews(report,{same:{category:'chimney'}},b),{});
});
