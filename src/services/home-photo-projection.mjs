// Same calibrated collinearity equations used by the official perspective
// imagery: EPSG:25832 east/north/DVR90 height -> original sensor pixels.
export function photoCalibration(properties){
 const io=properties?.['pers:interior_orientation'],rotation=properties?.['pers:rotation_matrix'],center=properties?.['pers:perspective_center'];
 const sensor=io?.sensor_array_dimensions,spacing=io?.pixel_spacing,offset=io?.principal_point_offset;
 if(properties?.['pers:crs']!==25832||rotation?.length!==9||center?.length!==3||sensor?.length!==2||spacing?.length!==2||offset?.length!==2||![...rotation,...center,...sensor,...spacing,...offset,io?.focal_length].every(Number.isFinite)||sensor.some(v=>v<1||v>32768)||spacing.some(v=>v<=0)||io.focal_length<=0)throw Error('Invalid camera calibration');
 return {rotation,center,sensor,focal:[io.focal_length/spacing[0],io.focal_length/spacing[1]],principal:[sensor[0]/2+offset[0]/spacing[0],sensor[1]/2-offset[1]/spacing[1]]};
}
export function projectPhoto(camera,point){
 const d=point.map((v,i)=>v-camera.center[i]);const dot=start=>camera.rotation.slice(start,start+3).reduce((sum,v,i)=>sum+v*d[i],0);const z=dot(6);
 if(z>=-1)return null;
 return [camera.principal[0]-camera.focal[0]*dot(0)/z,camera.principal[1]+camera.focal[1]*dot(3)/z];
}
export function photoCrop(camera,points){
 const pixels=points.map(p=>projectPhoto(camera,p)).filter(p=>p?.every(Number.isFinite));if(pixels.length!==points.length)return null;
 const left=Math.max(0,Math.floor(Math.min(...pixels.map(p=>p[0]))-20)),top=Math.max(0,Math.floor(Math.min(...pixels.map(p=>p[1]))-20));
 const right=Math.min(camera.sensor[0],Math.ceil(Math.max(...pixels.map(p=>p[0]))+20)),bottom=Math.min(camera.sensor[1],Math.ceil(Math.max(...pixels.map(p=>p[1]))+20));
 if(right-left<20||bottom-top<20||right-left>1800||bottom-top>1800)return null;
 return [left,top,right,bottom];
}
