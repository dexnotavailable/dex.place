import Phaser from 'phaser';
export interface ActorClip {url:string;frameWidth:number;frameHeight:number;frames:number;durationsMs?:number[];loop?:boolean}
export interface ActorDefinition {id:string;role:string;footX:number;footY:number;scale:number;body:{x:number;y:number;width:number;height:number};facingDefault?:'left'|'right';clips:Record<string,ActorClip>;clipPivots?:Record<string,{x:number;y:number}>;attackWindows?:Record<string,{startFrame:number;endFrameExclusive:number}>}
export interface CastManifest {schemaVersion:number;actors:ActorDefinition[]}
export function loadCast(scene:Phaser.Scene,manifest:CastManifest){
 for(const actor of manifest.actors||[])for(const [name,clip]of Object.entries(actor.clips)){
  if(!clip.url.startsWith('/world/cast-v2/')||clip.frameWidth<1||clip.frameHeight<1)throw Error('Actor source is invalid.');
  scene.load.spritesheet(`cast:${actor.id}:${name}`,clip.url,{frameWidth:clip.frameWidth,frameHeight:clip.frameHeight});
 }
}
export class CastActor {
 readonly sprite:Phaser.GameObjects.Sprite;clip='idle';clock=0;facing:1|-1=1;
 constructor(scene:Phaser.Scene,readonly definition:ActorDefinition,public x:number,public y:number){
  const clip=definition.clips.idle||definition.clips.walk;if(!clip)throw Error('Actor idle is unavailable.');
  this.clip=definition.clips.idle?'idle':'walk';const key=`cast:${definition.id}:${this.clip}`;
  if(!scene.textures.exists(key))throw Error('Actor source could not load: '+definition.id);
  this.sprite=scene.add.sprite(x,y,key,0).setDepth(18).setOrigin(definition.footX/clip.frameWidth,definition.footY/clip.frameHeight).setScale(definition.scale||1);
 }
 setClip(clip:string){const next=this.definition.clips[clip]?clip:this.definition.clips.idle?'idle':'walk';if(next!==this.clip){this.clip=next;this.clock=0;}}
 duration(clip=this.clip){const c=this.definition.clips[clip];return c?(c.durationsMs||Array(c.frames).fill(100)).reduce((a:number,b:number)=>a+b,0)/1000:.8;}
 frameAt(clip:string,time:number){const c=this.definition.clips[clip];if(!c)return 0;const times=c.durationsMs||Array(c.frames).fill(100);let ms=Math.max(0,time*1000);if(c.loop??['idle','walk','fly'].includes(clip))ms%=times.reduce((a:number,b:number)=>a+b,0);else ms=Math.min(ms,this.duration(clip)*1000-1);let frame=0;while(frame<times.length-1&&ms>=times[frame]){ms-=times[frame];frame++;}return frame;}
 update(dt:number){this.clock+=dt;const clip=this.definition.clips[this.clip],pivot=this.definition.clipPivots?.[this.clip]||{x:this.definition.footX,y:this.definition.footY};this.sprite.setPosition(Math.round(this.x),Math.round(this.y)).setOrigin(pivot.x/clip.frameWidth,pivot.y/clip.frameHeight).setFlipX(this.facing===(this.definition.facingDefault==='left'?1:-1)).setTexture(`cast:${this.definition.id}:${this.clip}`,this.frameAt(this.clip,this.clock));}
 destroy(){this.sprite.destroy();}
}
