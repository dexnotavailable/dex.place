import Phaser from 'phaser';
import type {SceneAssets,SceneAsset} from './assets';
import type {WorldMap} from './map';
import type {RoomGraph} from './roomGraph';
import type {CastManifest,ActorClip} from './cast';

type Resource={key:string;url:string;asset?:SceneAsset;clip?:ActorClip};
const OBJECT_ASSETS:Record<string,string[]>={
 door:['V2-P02','V2-P03'],terminal:['terminal','P03'],product:['terminal','P03'],
 home:['P04','P05'],file:['P12'],gallery:['P14'],donate:['P15'],
 map:['P04','P10','P16','P17','P18'],banner:['P16','P17','P18'],
 cable:['P06'],bridge:['P07','P08','P21','FG05','P04'],
 lift:['P09','FG04','FG05','P10','P11'],landing:['P11'],shortcut:['P11'],
 seal:['P17'],ornament:['P05'],
};

/** One loader queue; visited room textures are reused without rebuilding state. */
export class RoomResources {
 private serial:Promise<void>=Promise.resolve();
 private disposed=false;
 private cancelActive:(()=>void)|null=null;
 private loadedRooms=new Set<string>();
 private failures=new Map<string,string>();
 constructor(private scene:Phaser.Scene,private manifest:SceneAssets,private map:WorldMap,private graph:RoomGraph,private cast:CastManifest){}

 required(roomId:string):Resource[]{
  if(!this.graph.rooms.some(r=>r.id===roomId))throw Error('Unknown room: '+roomId);
  const ids=new Set(['causeway','B01','B07']);
  if(this.map.solids.some(s=>s.props.structure==='service'))ids.add('P07');
  for(const p of this.manifest.placements)if(!p.roomId||p.roomId===roomId)ids.add(p.assetId);
  const actors=new Set<string>();
  for(const object of this.map.objects){if(object.props.roomId!==roomId)continue;
   for(const id of OBJECT_ASSETS[object.kind]||[])ids.add(id);
   if(object.kind==='resident'||object.kind==='mob')actors.add(String(object.props.actorId));
  }
  for(const product of this.graph.products)if(product.roomId===roomId)actors.add(product.bossActorId);
  const resources:Resource[]=[];
  for(const id of ids){
   const asset=this.manifest.assets.find(a=>a.id===id||(id==='terminal'&&a.id==='P02'&&!this.manifest.assets.some(a=>a.id==='terminal')));
   if(!asset||!asset.url.startsWith('/world/'))throw Error('Room material declaration is unavailable: '+id);
   resources.push({key:'asset:'+asset.id,url:asset.url,asset});
  }
  for(const id of actors){const actor=this.cast.actors.find(a=>a.id===id);if(!actor)throw Error('Room actor declaration is unavailable: '+id);
   for(const[name,clip]of Object.entries(actor.clips)){
    if(!clip.url.startsWith('/world/cast-v2/')||clip.frameWidth<1||clip.frameHeight<1)throw Error('Actor source is invalid.');
    resources.push({key:`cast:${id}:${name}`,url:clip.url,clip});
   }
  }
  return resources;
 }
 isReady(roomId:string){return this.loadedRooms.has(roomId)&&this.required(roomId).every(r=>this.scene.textures.exists(r.key));}
 ensure(roomId:string,onProgress?:(loaded:number,total:number)=>void):Promise<void>{
  // A cached safe-room return must not wait behind an obsolete network request.
  if(this.isReady(roomId)){onProgress?.(0,0);return Promise.resolve();}
  const task=this.serial.catch(()=>{}).then(()=>this.load(roomId,onProgress));
  this.serial=task.catch(()=>{});return task;
 }
 private async load(roomId:string,onProgress?:(loaded:number,total:number)=>void){
  if(this.disposed)throw Error('Room loader disposed');
  const all=this.required(roomId),missing=all.filter(r=>!this.scene.textures.exists(r.key));
  onProgress?.(0,missing.length);
  if(missing.length)await new Promise<void>((resolve,reject)=>{
   const loader=this.scene.load,failed:string[]=[];let loaded=0,finished=false;
   const keys=new Set(missing.map(r=>r.key));
   const cleanup=()=>{loader.off(Phaser.Loader.Events.FILE_COMPLETE,completeFile);loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR,errorFile);loader.off(Phaser.Loader.Events.COMPLETE,complete);this.cancelActive=null;};
   const end=(error?:Error)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve();};
   const completeFile=(key:string)=>{if(keys.has(key)){loaded++;onProgress?.(loaded,missing.length);}};
   const errorFile=(file:Phaser.Loader.File)=>{if(keys.has(file.key))failed.push(file.key);};
   const complete=()=>end(failed.length||missing.some(r=>!this.scene.textures.exists(r.key))?Error('Some room material could not load.'):undefined);
   this.cancelActive=()=>end(Error('Room loader disposed'));
   loader.on(Phaser.Loader.Events.FILE_COMPLETE,completeFile);loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR,errorFile);loader.once(Phaser.Loader.Events.COMPLETE,complete);
   for(const resource of missing){const sprite=resource.clip||resource.asset?.sprite;
    if(sprite)loader.spritesheet({key:resource.key,url:resource.url,frameConfig:{frameWidth:sprite.frameWidth,frameHeight:sprite.frameHeight},xhrSettings:{responseType:'blob',timeout:20000}});
    else loader.image({key:resource.key,url:resource.url,xhrSettings:{responseType:'blob',timeout:20000}});
   }
   loader.start();
  }).catch(error=>{this.failures.set(roomId,String(error));throw error;});
  if(this.disposed)throw Error('Room loader disposed');
  for(const r of all){const asset=r.asset;if(!asset)continue;const texture=this.scene.textures.get(r.key);
   for(const[name,frame]of [['content',asset.frame],['repeat',asset.repeatFrame]] as const)if(frame&&!texture.has(name))texture.add(name,0,frame.x,frame.y,frame.width,frame.height);
  }
  this.loadedRooms.add(roomId);this.failures.delete(roomId);
 }
 snapshot(){return{loadedRooms:[...this.loadedRooms],failures:Object.fromEntries(this.failures),textureKeys:this.scene.textures.getTextureKeys().filter(k=>k.startsWith('asset:')||k.startsWith('cast:'))};}
 dispose(){this.disposed=true;this.cancelActive?.();this.cancelActive=null;}
}
