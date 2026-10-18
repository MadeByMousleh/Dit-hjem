import {createContext,useContext} from 'react';
export const HouseSceneInteraction=createContext<(active:boolean)=>void>(()=>{});
export const useHouseSceneInteraction=()=>useContext(HouseSceneInteraction);
