// Shared, strict boundary for model output and saved facade data.
export function validateFacadeAnalysis(value) {
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  const color = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  if (!value || !number(value.confidence) || value.confidence < 0.6 ||
      !['brick','plaster','wood','other'].includes(value.material) || !color(value.wallColor) || !color(value.frameColor) ||
      !Array.isArray(value.openings) || value.openings.length > 40) throw Error('INVALID_FACADE');
  const openings = value.openings.filter(o=>!(number(o?.confidence)&&o.confidence<0.65)).map(o => {
    if (!o || !['window','door','garage'].includes(o.kind) ||
        ![o.x,o.y,o.width,o.height,o.confidence].every(number) || o.width < 0.015 || o.height < 0.03 ||
        o.x + o.width > 1.001 || o.y + o.height > 1.001 || !Number.isInteger(o.columns) || o.columns < 1 || o.columns > 6) throw Error('INVALID_FACADE');
    const bars=values=>{if(!Array.isArray(values)||values.length>8||!values.every(v=>number(v)&&v>0.03&&v<0.97))throw Error('INVALID_FACADE');return [...new Set(values)].sort((a,b)=>a-b);};
    return {kind:o.kind,x:o.x,y:o.y,width:o.width,height:o.height,confidence:o.confidence,columns:o.columns,...(value.version===2?{imageQuad:validateQuad(o.imageQuad),verticalBars:bars(o.verticalBars),horizontalBars:bars(o.horizontalBars),frameColor:color(o.frameColor)?o.frameColor:value.frameColor,panelColor:color(o.panelColor)?o.panelColor:'#344e60'}:{})};
  }).filter(o => o.confidence >= 0.65);
  const partial=value.coverage==='partial';
  if(partial&&(!Number.isFinite(value.aspect)||value.aspect<0.2||value.aspect>30))throw Error('INVALID_FACADE');
  return {version:value.version===2?2:1,confidence:value.confidence,material:value.material,wallColor:value.wallColor,frameColor:value.frameColor,openings,...(value.version===2?{facadeQuad:validateQuad(value.facadeQuad),coverage:partial?'partial':'full',...(partial?{aspect:value.aspect}:{})}:{})};
}

export function validateQuad(points){
 if(!Array.isArray(points)||points.length!==4||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw Error('INVALID_QUAD');
 const crosses=points.map((a,i)=>{const b=points[(i+1)%4],c=points[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
 if(crosses.some(v=>v<=0.00001))throw Error('INVALID_QUAD');
 return points.map(p=>[...p]);
}
// Projective mapping of actual image coordinates, rather than a model's guessed elevation.
export function facadeProjection(quad){
 validateQuad(quad);const target=[[0,0],[1,0],[1,1],[0,1]],rows=[];
 quad.forEach(([x,y],i)=>{const [u,v]=target[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
 for(let col=0;col<8;col++){
  let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(rows[row][col])>Math.abs(rows[pivot][col]))pivot=row;
  [rows[col],rows[pivot]]=[rows[pivot],rows[col]];const scale=rows[col][col];if(Math.abs(scale)<1e-9)throw Error('DEGENERATE_FACADE');
  for(let j=col;j<9;j++)rows[col][j]/=scale;
  for(let row=0;row<8;row++)if(row!==col){const factor=rows[row][col];for(let j=col;j<9;j++)rows[row][j]-=factor*rows[col][j];}
 }
 const h=rows.map(row=>row[8]);return ([x,y])=>{const divisor=h[6]*x+h[7]*y+1;if(Math.abs(divisor)<1e-8)throw Error('INVALID_PROJECTION');return [(h[0]*x+h[1]*y+h[2])/divisor,(h[3]*x+h[4]*y+h[5])/divisor];};
}
export function rectifyFacadeAnalysis(raw,imageWidth=1,imageHeight=1){
 if(!raw||typeof raw.complete!=='boolean'||!Array.isArray(raw.openings)||raw.openings.length>40)throw Error('INCOMPLETE_FACADE');
 const facadeQuad=validateQuad(raw.facadeQuad),project=facadeProjection(facadeQuad);
 const openings=raw.openings.filter(o=>!(Number.isFinite(o?.confidence)&&o.confidence>=0&&o.confidence<0.65)).map(o=>{
  const imageQuad=validateQuad(o.imageQuad),points=imageQuad.map(project);
  if(points.some(p=>p.some(v=>!Number.isFinite(v)||v< -0.025||v>1.025)))throw Error('OPENING_OUTSIDE_FACADE');
  const x=Math.max(0,Math.min(...points.map(p=>p[0]))),y=Math.max(0,Math.min(...points.map(p=>p[1]))),right=Math.min(1,Math.max(...points.map(p=>p[0]))),bottom=Math.min(1,Math.max(...points.map(p=>p[1])));
  return {...o,imageQuad,x,y,width:right-x,height:bottom-y,columns:(o.verticalBars?.length??0)+1};
 });
 const distance=(a,b)=>Math.hypot((a[0]-b[0])*imageWidth,(a[1]-b[1])*imageHeight);
 const aspect=(distance(facadeQuad[0],facadeQuad[1])+distance(facadeQuad[3],facadeQuad[2]))/(distance(facadeQuad[0],facadeQuad[3])+distance(facadeQuad[1],facadeQuad[2]));
 return validateFacadeAnalysis({...raw,version:2,facadeQuad,openings,coverage:raw.complete?'full':'partial',aspect});
}
