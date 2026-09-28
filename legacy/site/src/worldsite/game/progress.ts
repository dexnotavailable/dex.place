import type {WorldProgress,WorldIntent} from './contracts';
import type {RoomGraph} from './roomGraph';
import type {WorldMap} from './map';

export class ExplorationProgress {
 private state:WorldProgress;
 constructor(private graph:RoomGraph,private map:WorldMap,private emit:(event:WorldIntent)=>void){this.state=this.empty();}
 private empty():WorldProgress{return {schemaVersion:1,worldRevision:this.graph.worldRevision,discoveredRooms:['arrival'],discoveredContent:[],cuts:[],shortcuts:[],checkpointId:'anchor.home',encounterHistory:[]};}
 snapshot():WorldProgress{return structuredClone(this.state);}
 hasCut(id:string){return this.state.cuts.includes(id);}
 hasShortcut(id:string){return this.state.shortcuts.includes(id);}
 get checkpoint(){return this.map.anchors.find(a=>a.id===this.state.checkpointId)||this.map.anchors.find(a=>a.id==='anchor.home')!;}
 private publish(kind:Extract<WorldIntent,{type:'progress'}>['event']['kind'],subjectId:string){this.emit({type:'progress',snapshot:this.snapshot(),event:{id:crypto.randomUUID(),kind,subjectId}});}
 request(){this.publish('checkpoint',this.state.checkpointId);}
 discoverRoom(id:string){if(!this.state.discoveredRooms.includes(id)&&this.graph.rooms.some(r=>r.id===id)){this.state.discoveredRooms.push(id);this.publish('room',id);}}
 discoverContent(id:string){if(id&&!this.state.discoveredContent.includes(id)&&this.graph.contentIds.includes(id)){this.state.discoveredContent.push(id);this.publish('content',id);}}
 cut(id:string){if(this.graph.persistentCutIds.includes(id)&&!this.hasCut(id)){this.state.cuts.push(id);this.publish('cut',id);}}
 shortcut(id:string){if(this.graph.persistentShortcutIds.includes(id)&&!this.hasShortcut(id)){this.state.shortcuts.push(id);this.publish('shortcut',id);}}
 checkpointAt(id:string){if(id!==this.state.checkpointId&&this.map.anchors.some(a=>a.id===id)){this.state.checkpointId=id;this.publish('checkpoint',id);}}
 outcome(encounterId:string,outcome:'win'|'defeat'){if(!this.graph.products.some(p=>p.encounterId===encounterId))return;this.state.encounterHistory.push({eventId:crypto.randomUUID(),encounterId,outcome,recordedAt:new Date().toISOString()});this.state.encounterHistory=this.state.encounterHistory.slice(-100);this.publish('encounter',encounterId);}
 restore(input:unknown){
  if(!input||typeof input!=='object')return false;
  const raw=input as Partial<WorldProgress>;if(raw.schemaVersion!==1)return false;
  const strings=(v:unknown,allowed:Set<string>)=>Array.isArray(v)?[...new Set(v.filter((s):s is string=>typeof s==='string'&&s.length<160&&allowed.has(s)))].slice(0,200):[];
  const next=this.empty();next.discoveredRooms=strings(raw.discoveredRooms,new Set(this.graph.rooms.map(r=>r.id)));if(!next.discoveredRooms.includes('arrival'))next.discoveredRooms.unshift('arrival');
  next.discoveredContent=strings(raw.discoveredContent,new Set(this.graph.contentIds));next.cuts=strings(raw.cuts,new Set(this.graph.persistentCutIds));next.shortcuts=strings(raw.shortcuts,new Set(this.graph.persistentShortcutIds));
  if(typeof raw.checkpointId==='string'){const anchor=this.map.anchors.find(a=>a.id===raw.checkpointId);if(anchor)next.checkpointId=anchor.props.roomId==='arena'?'checkpoint.dispatch.from.arena':anchor.id;}
  const events=new Set<string>();next.encounterHistory=Array.isArray(raw.encounterHistory)?raw.encounterHistory.filter(e=>e&&typeof e.eventId==='string'&&e.eventId.length<100&&!events.has(e.eventId)&&events.add(e.eventId)&&this.graph.products.some(p=>p.encounterId===e.encounterId)&&['win','defeat'].includes(e.outcome)&&typeof e.recordedAt==='string'&&Number.isFinite(Date.parse(e.recordedAt))).slice(-100):[];
  this.state=next;this.publish('restore',next.checkpointId);return true;
 }
 reset(){this.state=this.empty();this.publish('reset','world');}
}
