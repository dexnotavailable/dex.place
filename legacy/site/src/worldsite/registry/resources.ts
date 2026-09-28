import Phaser from 'phaser';
import type {ArtAsset,ArtCatalogue,HeroManifest,RoomId} from './contracts';
import {ROOMS,roomAssets} from './rooms';
import {exhibitProps} from './scene-geometry';
import {illustrations} from './art';
export const ART_URL='/world/registry/assets.json';
export async function fetchCatalogue():Promise<ArtCatalogue>{const response=await fetch(ART_URL,{cache:'no-store'});if(!response.ok)throw Error('Room materials are not available yet.');const c=await response.json();if(!c||typeof c.assets!=='object'||typeof c.rooms!=='object')throw Error('The room material catalogue could not be read.');return c;}
export function frameDuration(a:ArtAsset){const frames=a.frames||1;return (Array.isArray(a.frameMs)?a.frameMs.reduce((n,t)=>n+t,0):(a.frameMs||120)*frames)/1000;}
export function frameAt(a:ArtAsset,time:number,loop=a.loop!==false){const count=a.frames||1;if(count===1)return 0;const durations=Array.isArray(a.frameMs)?a.frameMs:Array(count).fill(a.frameMs||120);const total=durations.reduce((n,t)=>n+t,0);let ms=Math.max(0,time*1000);ms=loop?ms%total:Math.min(ms,total-1);let frame=0;while(frame<count-1&&ms>=durations[frame]){ms-=durations[frame];frame++}return frame;}
export function frameBlend(a:ArtAsset,time:number){const count=a.frames||1,durations=Array.isArray(a.frameMs)?a.frameMs:Array(count).fill(a.frameMs||120),total=durations.reduce((n,t)=>n+t,0);let ms=Math.max(0,time*1000)%total,frame=0;while(frame<count-1&&ms>=durations[frame]){ms-=durations[frame];frame++}return{frame,next:(frame+1)%count,amount:count>1?ms/durations[frame]:0};}
export class Resources {
 private serial:Promise<void>=Promise.resolve();private disposed=false;private cancel:(()=>void)|null=null;loaded=new Set<string>();failures:string[]=[];private pending=new Map<RoomId,number>();private peakBytes=0;private transitionPeakBytes=0;
 constructor(private scene:Phaser.Scene,public catalogue:ArtCatalogue,public hero:HeroManifest){}
 required(id:RoomId){const room=this.catalogue.rooms[id];if(!room?.layers?.length)throw Error(`Room material is still missing: ${ROOMS[id].name}.`);if(!room.layers.some(l=>l.role==='floor'))throw Error(`Walkable floor material is still missing: ${ROOMS[id].name}.`);const props=roomAssets(ROOMS[id]).map(key=>id==='junction'&&key==='bridge-rope'&&this.catalogue.assets['map-cord']?'map-cord':key);const ids=[...new Set([...room.layers.map(l=>l.asset),...props,...(id==='exhibit'?exhibitProps(illustrations.map(a=>a.id),this.catalogue.assets,ROOMS[id].floor).map(p=>p.asset):[])])];const missing=ids.filter(key=>!this.catalogue.assets[key]);if(missing.length)throw Error(`Room material is still missing: ${missing.join(', ')}.`);return ids;}
 ensure(id:RoomId,progress:(loaded:number,total:number)=>void){this.pending.set(id,(this.pending.get(id)||0)+1);const task=this.serial.catch(()=>{}).then(()=>this.load(id,progress)).finally(()=>{const count=(this.pending.get(id)||1)-1;if(count)this.pending.set(id,count);else this.pending.delete(id)});this.serial=task.catch(()=>{});return task;}
 private registryKeys(){return this.scene.textures.getTextureKeys().filter(k=>k.startsWith('registry:')||k.startsWith('registry-hero:')||k.startsWith('registry-art:'));}
 private bytes(){return this.registryKeys().reduce((sum,key)=>sum+this.scene.textures.get(key).source.reduce((n,s)=>n+s.width*s.height*4,0),0);}
 private measure(){const bytes=this.bytes();this.peakBytes=Math.max(this.peakBytes,bytes);this.transitionPeakBytes=Math.max(this.transitionPeakBytes,bytes);return bytes;}
 observeMemory(){this.measure();}
 evictExcept(id:RoomId){
  if(this.disposed)return;const keep=new Set(this.required(id).map(k=>'registry:'+k));
  // Newer passages can be queued while an old one is cancelled. Never remove
  // shared textures required by the active/queued loader.
  for(const pending of this.pending.keys())for(const key of this.required(pending))keep.add('registry:'+key);
  for(const key of this.registryKeys())if(!key.startsWith('registry-hero:')&&!keep.has(key)&&!(key.startsWith('registry-art:')&&(id==='exhibit'||this.pending.has('exhibit'))))this.scene.textures.remove(key);
  this.measure();
 }
 residency(){return{residentRGBABytes:this.bytes(),peakRGBABytes:this.peakBytes,transitionPeakRGBABytes:this.transitionPeakBytes,residentTextureKeys:this.registryKeys(),loadedHistory:[...this.loaded],pendingRooms:[...this.pending.keys()],estimate:'RGBA8 source texture lower bound; excludes browser/GPU copies and render targets'};}
 private async load(id:RoomId,progress:(loaded:number,total:number)=>void){
  if(this.disposed)throw Error('Room loader closed.');this.transitionPeakBytes=this.bytes();const ids=this.required(id),missing=ids.filter(key=>!this.scene.textures.exists('registry:'+key));
  const heroMissing=Object.entries(this.hero.clips).filter(([key])=>!this.scene.textures.exists('registry-hero:'+key));const count=missing.length+heroMissing.length;progress(0,count);
  if(count)await new Promise<void>((resolve,reject)=>{
   const loader=this.scene.load,keys=new Set([...missing.map(key=>'registry:'+key),...heroMissing.map(([key])=>'registry-hero:'+key)]);let done=false,loaded=0;const bad:string[]=[];
   const finish=(error?:Error)=>{if(done)return;done=true;loader.off('filecomplete',complete);loader.off('loaderror',failure);loader.off('complete',finished);this.cancel=null;error?reject(error):resolve()};
   const complete=(key:string)=>{if(keys.has(key)){this.measure();progress(++loaded,count)}},failure=(file:Phaser.Loader.File)=>{if(keys.has(file.key))bad.push(file.key)},finished=()=>finish(bad.length?Error('Some room images could not load. Retry the passage.'):undefined);
   loader.on('filecomplete',complete);loader.on('loaderror',failure);loader.once('complete',finished);this.cancel=()=>finish(Error('Room loader closed.'));
   for(const key of missing){const a=this.catalogue.assets[key];if(!a.src.startsWith('/world/')){finish(Error('Invalid room asset path.'));return}if(a.frameWidth&&a.frameHeight)loader.spritesheet({key:'registry:'+key,url:a.src,frameConfig:{frameWidth:a.frameWidth,frameHeight:a.frameHeight,endFrame:(a.frames||1)-1},xhrSettings:{responseType:'blob',timeout:25000}});else loader.image({key:'registry:'+key,url:a.src,xhrSettings:{responseType:'blob',timeout:25000}});}
   for(const [key,a] of heroMissing)loader.spritesheet({key:'registry-hero:'+key,url:a.url,frameConfig:{frameWidth:a.frameWidth,frameHeight:a.frameHeight,endFrame:a.frames-1},xhrSettings:{responseType:'blob',timeout:25000}});
   loader.start();
  });
  if(this.disposed)throw Error('Room loader closed.');for(const key of ids)if(!this.scene.textures.exists('registry:'+key))throw Error('A room image is unavailable.');this.loaded.add(id);this.measure();
 }
 dispose(){this.disposed=true;this.cancel?.();this.cancel=null;}
}
