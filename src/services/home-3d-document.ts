import {home3dBundle} from '../generated/home3d-bundle';
import {gzipSync,strToU8} from 'fflate';
import {base64} from './property-model-format';
import type {HomeEnvironment,HomeGeometry,HomeHeights,HomeModelPhotos,HomePhotoColors,RoofMaterial} from './home-insights';
import type {HousePhotoFace} from '../utils/house-photo-guide';
import type {FacadeModel} from './house-facade';
import type {WallColorPatch,WallColorAnalysis} from './facade-colors';
import type {AerialOpenings} from './aerial-openings';
import type {SceneEdits} from '../utils/scene-opening-edits';
import type {ModelWeather,HomeWeather} from './home-weather';
import type {PreparedScene,PropertyModel} from './property-model-format';
export type HomeCameraMode='orbit'|'place'|'ground';
export type HomeSunState={roofMaterials?:Record<string,RoofMaterial>;forecast?:HomeWeather|null;weatherMode?:import('./home-weather').WeatherMode;at?:number;timestamps?:number[];cameraMode?:HomeCameraMode;constellations?:boolean;minute:number;playing:boolean;active:boolean;vectors:[number,number,number][];reset?:boolean;aerial?:boolean;flatParcel?:boolean;weather?:ModelWeather|null;weatherTimeline?:(ModelWeather|null)[];live?:boolean;reducedMotion?:boolean;photographic?:boolean;photoColors?:boolean;lidarMode?:'model'|'points'|'both';terrainContours?:boolean;vegetationVisible?:boolean;vegetationShadows?:boolean;captureFace?:HousePhotoFace|null;facades?:FacadeModel[];aerialOpenings?:AerialOpenings;sceneEdits?:SceneEdits;wallPalette?:{requestId:string;analysis:WallColorAnalysis}};
export type Home3DMessage={type:string;model?:PropertyModel;prepared?:PreparedScene;cameraMode?:HomeCameraMode;message?:string;sceneEdits?:SceneEdits;minute?:number;mainMeasured?:boolean;measuredBuildings?:number;estimatedBuildings?:number;count?:number;lidarBuildings?:number;parcelPoints?:number;terrainTriangles?:number;vegetationTriangles?:number;colors?:HomePhotoColors;patches?:WallColorPatch[];addressId?:string;requestId?:string;error?:string};
export function home3dDocument(geometry:HomeGeometry,heights:HomeHeights|null,texture:string|null,sun:HomeSunState,photos:HomeModelPhotos|null=null,environment:HomeEnvironment|null=null,prepared:PreparedScene|null=null){
 // Send a bounded-size compressed string across the native WebView bridge,
 // rather than a many-megabyte executable object literal of restored meshes.
 const config=base64(gzipSync(strToU8(JSON.stringify({geometry,heights,texture,sun,photos,environment,prepared})),{level:1}));
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none';"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:none;background:#eaf0f5}canvas{display:block;touch-action:none}</style></head><body><script>window.HOME_MODEL_GZIP=${JSON.stringify(config)};${home3dBundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}
