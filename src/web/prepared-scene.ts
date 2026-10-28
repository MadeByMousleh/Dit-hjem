import * as THREE from 'three';
import type {PreparedGeometry} from '../services/property-model-format';
export function packGeometry(geometry:THREE.BufferGeometry):PreparedGeometry{
 const attributes:PreparedGeometry['attributes']={};for(const name of ['position','normal','uv','color']){const a=geometry.getAttribute(name);if(a)attributes[name]={size:a.itemSize,values:Array.from(a.array)};}
 return {attributes,index:geometry.index?Array.from(geometry.index.array):null};
}
export function unpackGeometry(saved:PreparedGeometry){const geometry=new THREE.BufferGeometry();for(const [name,a]of Object.entries(saved.attributes))geometry.setAttribute(name,new THREE.Float32BufferAttribute(a.values,a.size));if(saved.index)geometry.setIndex(saved.index);geometry.computeBoundingSphere();return geometry;}
