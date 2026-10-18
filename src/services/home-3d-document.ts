import {home3dBundle} from '../generated/home3d-bundle';
import type {HomeGeometry,HomeHeights,HomeModelPhotos,HomePhotoColors} from './home-insights';
import type {HousePhotoFace} from '../utils/house-photo-guide';
import type {FacadeModel} from './house-facade';
export type HomeSunState={minute:number;playing:boolean;active:boolean;vectors:[number,number,number][];reset?:boolean;aerial?:boolean;photographic?:boolean;photoColors?:boolean;lidarMode?:'model'|'points'|'both';terrainContours?:boolean;vegetationVisible?:boolean;vegetationShadows?:boolean;captureFace?:HousePhotoFace|null;facades?:FacadeModel[]};
export type Home3DMessage={type:string;minute?:number;mainMeasured?:boolean;measuredBuildings?:number;estimatedBuildings?:number;count?:number;lidarBuildings?:number;parcelPoints?:number;terrainTriangles?:number;vegetationTriangles?:number;colors?:HomePhotoColors};
export function home3dDocument(geometry:HomeGeometry,heights:HomeHeights|null,texture:string|null,sun:HomeSunState,photos:HomeModelPhotos|null=null){
 const config=JSON.stringify({geometry,heights,texture,sun,photos}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none';"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:none;background:#eaf0f5}canvas{display:block;touch-action:none}</style></head><body><script>window.HOME_MODEL=${config};${home3dBundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}
