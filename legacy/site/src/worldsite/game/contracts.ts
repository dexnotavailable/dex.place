import type { AudioEffect } from '../audio';
export type Section = 'downloads' | 'documentation' | 'illustrations' | 'donate';
export type WorldRoomId = 'arrival'|'junction'|'dispatch'|'arena'|'hearth'|'treasury'|'lookout'|'reservoir'|'gallery'|'archive'|'return-shaft';
export interface WorldProgress {
  schemaVersion:1; worldRevision:string; discoveredRooms:string[]; discoveredContent:string[];
  cuts:string[]; shortcuts:string[]; checkpointId:string;
  encounterHistory:{eventId:string;encounterId:string;outcome:'win'|'defeat';recordedAt:string}[];
}
export interface WorldPose {
  roomId:string;worldRevision:string;geometryKey:string;supportKey:string;
  x:number;y:number;facing:1|-1;clip:string;frame:number;grounded:boolean;
  sequence:number;active:boolean;moving:boolean;
  dynamicSupports?:Record<string,string>;
}
export interface WorldGhost extends Omit<WorldPose,'active'|'moving'> {
  id:string;alias:string;speaking?:boolean;opacity?:number;
}
export type V2WorldIntent =
  | {type:'room-change';roomId:string;previousRoomId:string|null;geometryKey:string;worldRevision:string}
  | {type:'room-transition';phase:'loading'|'prepared'|'opening'|'ready'|'failed';sourceRoomId:string;targetRoomId:string;doorId:string;loadedAssets?:number;totalAssets?:number;message?:string}
  | {type:'progress';snapshot:WorldProgress;event:{id:string;kind:'room'|'content'|'cut'|'shortcut'|'checkpoint'|'encounter'|'restore'|'reset';subjectId:string}}
  | {type:'pose';pose:WorldPose}
  | {type:'map-inspect';mapId:string;roomId:string;discoveredRooms:string[]}
  | {type:'service';service:'account'|'treasury'|'donate';objectId:string}
  | {type:'product-approach';productId:string;encounterId:string}
  | {type:'product-menu';productId:string;visitId:string;encounterId:string}
  | {type:'health';health:number;maximum:number;state:'alive'|'hurt'|'dead'|'respawning';checkpointId:string};
export type WorldProjection={type:'projection';width:number;height:number;promptAnchor?:{x:number;y:number};hero?:{x:number;y:number;width:number;height:number;frame:number;clip:string;flip:boolean};exhibits:{id:string;itemId:string;x:number;y:number;width:number;height:number}[]};
export type WorldIntent = V2WorldIntent | WorldProjection | {type:'effect';id:AudioEffect;eventId:string} | {type:'combat';active:boolean;playerHealth:number;bossHealth:number;maximumBossHealth:number;phase:string} | {type:'navigate'; section:Section; itemId?:string; entryMode:'world-prop'} | {type:'banner'; open:boolean;anchor?:{x:number;y:number;width?:number;height?:number}} | {type:'ready'} | {type:'error'; message:string} | {type:'victory'} | {type:'defeat'} | {type:'region'; region:string} | {type:'prompt'; label:string; action:'E'|'Slash'|'E / Slash'; visible:boolean};
export type WorldCommand = {type:'close-inspection'} | {type:'retry-passage'} | {type:'enter-room';roomId:string;entranceId?:string} | {type:'enter-encounter';productId:string;encounterId:string;assistance?:boolean} | {type:'leave-product-visit'} | {type:'restore-progress';snapshot:unknown} | {type:'request-progress'} | {type:'ghosts';peers:WorldGhost[]} | {type:'inspect-map';id?:string} | {type:'inspect-gallery';id:string} | {type:'pause';paused:boolean} | {type:'focus';focused:boolean} | {type:'travel';section:Section|'home'} | {type:'fight';assistance:boolean} | {type:'restart'} | {type:'banner';open:boolean} | {type:'settings';reducedMotion:boolean;quality:'auto'|'low'|'high';shake:boolean;holdToSlash:boolean;assistance?:boolean} | {type:'input';action:'left'|'right'|'jump'|'slash'|'dash'|'interact';down:boolean};
export interface WorldHandle {command:(command:WorldCommand)=>void; destroy:()=>void;}
