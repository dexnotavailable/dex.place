import type {WorldRoomId} from './contracts';
import type {WorldMap,MapObject} from './map';

export const WORLD_REVISION='inhabited-v2.1' as const;
export interface RoomEntrance {id:string;x:number;y:number;facing:1|-1;checkpointId:string}
export interface WorldRoom {id:WorldRoomId;x:number;y:number;width:number;height:number;floorY:number;topY:number;kind:'arrival'|'junction'|'dispatch'|'arena'|'hearth'|'treasury'|'lookout'|'reservoir'|'gallery'|'archive'|'shaft';geometryKey:string;entrances:RoomEntrance[];safe:boolean;music:'calm'|'silent'|'arena'}
export interface RoomDoor {id:string;roomId:WorldRoomId;targetRoomId:WorldRoomId;targetEntranceId:string;checkpointId:string;requiresShortcut?:string;transition:'door'|'passage'|'lift'}
export interface RoomGraph {schemaVersion:1;worldRevision:string;rooms:WorldRoom[];doors:RoomDoor[];products:{productId:string;encounterId:string;roomId:WorldRoomId;entranceId:string;returnRoomId:WorldRoomId;returnEntranceId:string;bossActorId:string}[];persistentCutIds:string[];persistentShortcutIds:string[];contentIds:string[]}

export function readRoomGraph(raw:RoomGraph,map:WorldMap):RoomGraph {
 if(raw?.schemaVersion!==1||raw.worldRevision!==WORLD_REVISION||!Array.isArray(raw.rooms)||!Array.isArray(raw.doors))throw Error('Room graph is unavailable.');
 const roomIds=new Set<string>(),entryIds=new Set<string>();
 for(const room of raw.rooms){
  if(roomIds.has(room.id)||![room.x,room.y,room.width,room.height,room.floorY].every(Number.isFinite)||room.width<600||room.height<400||room.x<0||room.x+room.width>map.width)throw Error('Room bounds are invalid.');
  roomIds.add(room.id);
  for(const entry of room.entrances){if(entryIds.has(entry.id)||entry.x<room.x||entry.x>room.x+room.width||!map.anchors.some(a=>a.id===entry.checkpointId))throw Error('Room entrance is invalid.');entryIds.add(entry.id);}
 }
 for(const door of raw.doors){const target=raw.rooms.find(r=>r.id===door.targetRoomId);if(!roomIds.has(door.roomId)||!target?.entrances.some(e=>e.id===door.targetEntranceId)||!map.objects.some(o=>o.id===door.id))throw Error('Door destination is invalid.');}
 return raw;
}
export const roomFor=(graph:RoomGraph,id:string)=>graph.rooms.find(r=>r.id===id);
export const roomObject=(object:MapObject,roomId:string)=>object.props.roomId===roomId;
