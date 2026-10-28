// Human estimates stay separate from the immutable LiDAR proposal.
export const adjustmentLimits={height:[.2,12],width:[.1,10],length:[.3,160],along:[-20,20],side:[-20,20],angle:[-90,90],baseOffset:[-3,3]};
export function validateAdjustment(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(adjustmentLimits,k)))throw Error('Ugyldige mål');
 for(const [key,[min,max]]of Object.entries(adjustmentLimits))if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw Error('Ugyldigt mål: '+key);
 return Object.fromEntries(Object.keys(adjustmentLimits).map(k=>[k,value[k]]));
}
export function initialAdjustment(candidate){return {height:candidate.height,width:candidate.width,length:candidate.length,along:0,side:0,angle:0,baseOffset:0};}
export function boxSegments(candidate,adjustment){
 const c=adjustment??initialAdjustment(candidate),dx=candidate.end[0]-candidate.start[0],dy=candidate.end[1]-candidate.start[1],size=Math.hypot(dx,dy),ux=dx/size,uy=dy/size,r=c.angle*Math.PI/180;
 const ax=ux*Math.cos(r)-uy*Math.sin(r),ay=ux*Math.sin(r)+uy*Math.cos(r),cx=(candidate.start[0]+candidate.end[0])/2+ux*c.along-uy*c.side,cy=(candidate.start[1]+candidate.end[1])/2+uy*c.along+ux*c.side,z=(candidate.start[2]+candidate.end[2])/2+c.baseOffset;
 const vertices=[];for(const h of [0,c.height])for(const [a,b]of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push([cx+ax*a*c.length/2-ay*b*c.width/2,cy+ay*a*c.length/2+ax*b*c.width/2,z+h]);
 return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(([a,b])=>[vertices[a],vertices[b]]);
}
