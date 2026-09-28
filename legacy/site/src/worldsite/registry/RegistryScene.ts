import Phaser from 'phaser';
import {illustrations} from './art';
import type {ArtAsset,ArtCatalogue,Command,GameEvent,HeroManifest,InputAction,Layer,Progress,RoomId,Settings} from './contracts';
import {ROOMS,type Portal,type Prop,type Room} from './rooms';
import {Resources,frameAt,frameDuration,frameBlend,fetchCatalogue} from './resources';
import {freshPlayer,stepPlayer,strikeTouchesPoint,MOTION,type Player} from './controller';
import {cameraTarget,type CameraState} from './camera';
import {createEnemy,stepEnemy,strikeEnemy,type Enemy} from './combat';
import {defaultProgress,defaultSettings} from './progress';
import {FrameMixPipeline} from './FrameMixPipeline';
import {exhibitProps} from './scene-geometry';
import {CutCord} from './CutCord';

type Visual={sprite:Phaser.GameObjects.Sprite;mixed:boolean;asset:string;x:number;y:number;phase:number;layer?:Layer};
type Near={id:string;x:number;y:number;label:string;action:'E'|'Slash';prop?:Prop;portal?:Portal};
export class RegistryScene extends Phaser.Scene {
 private resources:Resources;private room:Room=ROOMS.arrival;private player:Player=freshPlayer(1400,740);private hero!:Phaser.GameObjects.Sprite;
 private visuals:Visual[]=[];private propSprites=new Map<string,Phaser.GameObjects.Sprite>();private doors=new Map<string,{leaf:Phaser.GameObjects.Sprite;closedX:number;amount:number;target:number;mask:Phaser.Display.Masks.GeometryMask;aperture:Phaser.GameObjects.Graphics}>();private artSprites:Phaser.GameObjects.Image[]=[];
 private held=new Set<InputAction>();private pressed=new Set<InputAction>();private active=false;private initialized=false;private disposed=false;private loading=false;private retryTask:(()=>void)|null=null;private operation=0;
 private settings:Settings={...defaultSettings};private progress:Progress;private presentationTime=0;private gameTime=0;private accumulator=0;private dead=0;private health=3;private footDistance=0;private lastFoot=-1;private effects=0;
 private cameraState:CameraState={x:1400,y:450,committed:false};private frame={zoom:1,viewW:1600,viewH:900,offsetY:0,left:600,top:0,x:1400,y:450};private near:Near|null=null;private lastHud='';
 private enemy:Enemy|null=null;private enemySprite:Phaser.GameObjects.Sprite|null=null;private bossFinished=false;private visit=false;private portalGrace=0;private bannerTime=0;private bridgeTime=0;
 private bridgeSprite:Phaser.GameObjects.Sprite|null=null;private npc:Phaser.GameObjects.Sprite|null=null;private npcResponse=-1;private rested=false;private fx!:Phaser.GameObjects.Graphics;
 private descentMotion:{fromX:number;fromY:number;toX:number;toY:number;clock:number}|null=null;
 private openingDoorAt:number|null=null;
 private cords=new Map<string,CutCord>();
 private npcTalk=-1;
 private recesses:{image:Phaser.GameObjects.Sprite;shape:Phaser.GameObjects.Graphics;mask:Phaser.Display.Masks.GeometryMask}[]=[];
 private upperStairRoute=false;
 private lowerStairRoute=false;
 private reflections:{source:Visual;sprite:Phaser.GameObjects.Sprite;plane:number}[]=[];
 private reflectionMask:Phaser.Display.Masks.GeometryMask|null=null;private reflectionShape:Phaser.GameObjects.Graphics|null=null;
 constructor(catalogue:ArtCatalogue,private manifest:HeroManifest,progress:Progress,private emit:(event:GameEvent)=>void){super('registry-game');this.resources=new Resources(this,catalogue,manifest);this.progress=structuredClone(progress);}
 async create(){if(this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer&&!this.game.renderer.pipelines.has('RegistryFrameMix'))this.game.renderer.pipelines.add('RegistryFrameMix',new FrameMixPipeline(this.game));this.fx=this.add.graphics().setDepth(80);this.events.once('shutdown',()=>this.dispose());this.events.once('destroy',()=>this.dispose());this.scale.on('resize',this.resize,this);await this.loadRoom(this.progress.checkpoint,'home',false);}
 private resize(){if(this.initialized)this.render(0,true)}
 private dispose(){if(this.disposed)return;this.disposed=true;this.operation++;this.resources.dispose();this.scale.off('resize',this.resize,this);}
 command(c:Command){
  if(c.type==='active'){this.active=c.value;this.clearInputs();return}
  if(c.type==='settings'){this.settings={...c.settings};return}
  if(c.type==='retry'){this.retryTask?.();return}
  if(c.type==='cancel-passage'&&this.initialized){this.operation++;this.loading=false;this.retryTask=null;this.openingDoorAt=null;this.clearInputs();for(const door of this.doors.values())door.target=0;this.emit({type:'black',value:false});this.emit({type:'room',room:this.room.id});this.emit({type:'ready'});return}
  if(!this.initialized||this.loading)return;
  if(c.type==='pointer'&&this.active){const x=this.frame.left+c.x/this.frame.zoom,y=this.frame.top+(c.y-this.frame.offsetY)/this.frame.zoom;const art=this.roomProps().find(p=>p.kind==='art'&&x>=p.x-p.width/2-8&&x<=p.x+p.width/2+8&&y>=p.y-p.height-8&&y<=p.y+8);if(art?.itemId){this.openArt(art.itemId);return}this.command({type:'input',action:'slash',down:true});return}
  if(c.type==='input'){if(!this.active||this.dead||this.descentMotion)return;if(c.down){if(!this.held.has(c.action))this.pressed.add(c.action);this.held.add(c.action);this.rested=false}else this.held.delete(c.action);return}
  if(c.type==='close'){this.npcTalk=-1;if(this.visit){this.visit=false;void this.loadRoom('vestibule','arena')}else {this.active=true;this.clearInputs();for(const door of this.doors.values())door.target=0;}return}
  if(c.type==='challenge'&&this.room.id==='vestibule'){this.visit=false;void this.loadRoom('arena','left',true,()=>{this.enemy=createEnemy('warden',this.room.bossX||1160,this.room.floor,true);this.bossFinished=false;this.spawnEnemy()});return}
  if(c.type==='leave-encounter'&&this.room.id==='arena'){this.visit=false;void this.loadRoom('vestibule','arena');return}
  if(c.type==='restart'){this.progress=defaultProgress();this.changed();this.visit=false;void this.loadRoom('arrival','home');return}
  if(c.type==='latch'&&this.room.id==='courtyard'&&Math.abs(this.player.x-(this.room.props.find(p=>p.kind==='latch')?.x??Infinity))<90){this.progress.courtyard=true;this.changed();this.effect('hit-metal');this.active=true;this.doors.get('registry')!.target=1;return}
  if(c.type==='rest'){this.rested=true;this.health=3;this.active=true;this.clearInputs();return}
  if(c.type==='acknowledge'){this.active=true;return}
  if(c.type==='inspect-art'&&this.room.id==='exhibit'){const prop=this.roomProps().find(p=>p.itemId===c.id);if(prop&&Math.abs(prop.x-this.player.x)<130)this.openArt(c.id);}
  if(c.type==='mark-art-seen'&&illustrations.some(a=>a.id===c.id)&&!this.progress.art.includes(c.id)){this.progress.art.push(c.id);this.changed();}
 }
 private clearInputs(){this.held.clear();this.pressed.clear();this.accumulator=0;this.player.vx=0;this.player.dash=0;this.player.buffer=0;}
 private changed(){this.emit({type:'progress',progress:structuredClone(this.progress)})}
 private effect(id:Extract<GameEvent,{type:'effect'}>['id']){this.emit({type:'effect',id,eventId:'registry:'+this.operation+':'+(++this.effects)})}
 private panel(panel:Extract<GameEvent,{type:'panel'}>['panel']){this.active=false;this.clearInputs();this.emit({type:'panel',panel})}
 private async loadRoom(id:RoomId,entry:string,fade=true,after?:()=>void){
  if(this.disposed)return;const token=++this.operation;this.loading=true;this.clearInputs();const wasReady=this.initialized;this.retryTask=()=>{void fetchCatalogue().then(c=>{this.resources.catalogue=c;return this.loadRoom(id,entry,fade,after)}).catch(error=>this.emit({type:'error',message:String(error),room:id}))};
  try{
   await this.resources.ensure(id,(loaded,total)=>this.emit({type:'load',room:id,loaded,total}));
   if(id==='exhibit')await this.loadArt();this.resources.observeMemory();if(this.disposed)return;if(token!==this.operation){this.resources.evictExcept(this.room.id);return;}
   if(fade){if(this.openingDoorAt!==null&&!this.settings.reduced)await new Promise(resolve=>setTimeout(resolve,Math.max(0,.34-(this.presentationTime-this.openingDoorAt!))*1000));if(this.disposed||token!==this.operation)return;this.emit({type:'black',value:true});await new Promise(resolve=>setTimeout(resolve,this.settings.reduced?40:240));if(this.disposed||token!==this.operation)return}
   this.clearRoom();this.room=ROOMS[id];const start=this.room.entries[entry]||this.room.entries.left;this.player=freshPlayer(start.x,start.y,start.facing);this.upperStairRoute=!!this.room.ascent&&start.y<this.room.floor-25;this.lowerStairRoute=!!this.room.descent&&start.y>this.room.floor+30;this.openingDoorAt=null;this.descentMotion=null;this.footDistance=0;this.lastFoot=-1;this.health=3;this.dead=0;this.rested=false;this.cameraState={...this.room.camera,committed:id!=='arrival'};this.portalGrace=.55;
   this.buildRoom();this.resources.evictExcept(id);this.initialized=true;this.loading=false;this.retryTask=null;this.near=null;this.lastHud='';
   if(!this.progress.rooms.includes(id))this.progress.rooms.push(id);if(id!=='arena')this.progress.checkpoint=id;this.changed();this.emit({type:'room',room:id});this.render(0,true);this.emit({type:'black',value:false});
   if(id==='registry'&&this.progress.courtyard&&!this.progress.acknowledged)this.npcResponse=-2;
   after?.();if(!wasReady)this.emit({type:'ready'});
  }catch(error){if(this.disposed||token!==this.operation)return;this.loading=false;this.active=false;this.emit({type:'black',value:false});this.emit({type:'error',message:error instanceof Error?error.message:'Room could not load.',room:id})}
 }
 private loadArt(){const missing=illustrations.filter(a=>a.usage==='illustration-display-only'&&!this.textures.exists('registry-art:'+a.id));if(!missing.length)return Promise.resolve();return new Promise<void>((resolve,reject)=>{const bad:string[]=[];const fail=(f:Phaser.Loader.File)=>{if(f.key.startsWith('registry-art:'))bad.push(f.key)};this.load.on('loaderror',fail);this.load.once('complete',()=>{this.load.off('loaderror',fail);bad.length?reject(Error('Some illustrations could not load. Retry the exhibit.')):resolve()});for(const art of missing)this.load.image('registry-art:'+art.id,art.thumbnailSrc);this.load.start()})}
 private clearRoom(){for(const reflection of this.reflections)reflection.sprite.destroy();this.reflections=[];this.reflectionMask?.destroy();this.reflectionMask=null;this.reflectionShape?.destroy();this.reflectionShape=null;for(const recess of this.recesses){recess.image.destroy();recess.mask.destroy();recess.shape.destroy()}this.recesses=[];for(const v of this.visuals)v.sprite.destroy();this.visuals=[];for(const cord of this.cords.values())cord.destroy();this.cords.clear();for(const s of this.propSprites.values())s.destroy();this.propSprites.clear();for(const d of this.doors.values()){d.leaf.destroy();d.mask.destroy();d.aperture.destroy()}this.doors.clear();for(const s of this.artSprites)s.destroy();this.artSprites=[];this.npc?.destroy();this.npc=null;this.enemySprite?.destroy();this.enemySprite=null;this.enemy=null;this.hero?.destroy();this.bridgeSprite?.destroy();this.bridgeSprite=null;this.npcResponse=-1;this.fx.clear();}
 private assetSprite(asset:string,x:number,y:number,width:number,height:number,depth=30){const a=this.resources.catalogue.assets[asset];if(!a||!this.textures.exists('registry:'+asset))throw Error('Required art not ready: '+asset);const w=a.frameWidth||a.width,h=a.frameHeight||a.height,pivot=a.pivot||[w/2,h],scale=Math.min(width/w,height/h);return this.add.sprite(x,y,'registry:'+asset,0).setOrigin(pivot[0]/w,pivot[1]/h).setScale(scale).setDepth(depth);}
 private roomProps(){return this.room.id==='exhibit'?[...this.room.props,...exhibitProps(illustrations.map(a=>a.id),this.resources.catalogue.assets,this.room.floor)]:this.room.props;}
 private buildRoom(){
  for(const l of this.resources.catalogue.rooms[this.room.id]!.layers){const a=this.resources.catalogue.assets[l.asset],sprite=this.add.sprite(this.room.referenceLeft+l.x,l.y,'registry:'+l.asset,0).setOrigin(0).setDisplaySize(l.width,l.height).setDepth(l.depth).setAlpha(l.alpha??1);if(l.blend==='add')sprite.setBlendMode(Phaser.BlendModes.ADD);if(l.blend==='screen')sprite.setBlendMode(Phaser.BlendModes.SCREEN);const mixed=(a.frames||1)>1&&['cloud','water','light'].includes(l.role)&&this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;if(mixed)sprite.setPipeline('RegistryFrameMix',{nextFrame:0,frameMix:0});this.visuals.push({sprite,mixed,asset:l.asset,x:this.room.referenceLeft+l.x,y:l.y,phase:l.phase||0,layer:l});}
  if(this.room.id==='pool'){
   const water=this.visuals.find(v=>v.layer?.role==='water');if(water){const l=water.layer!,plane=l.y;water.sprite.setAlpha(.38);
    this.reflectionShape=this.add.graphics().fillStyle(0xffffff).fillRect(this.room.referenceLeft+l.x,l.y,l.width,l.height).setVisible(false);this.reflectionMask=this.reflectionShape.createGeometryMask();
    const backgrounds=this.visuals.filter(v=>['sky','landmark','cloud'].includes(v.layer?.role||''));
    backgrounds.forEach((source,i)=>{const sprite=this.add.sprite(source.sprite.x,plane*2-source.sprite.y,source.sprite.texture.key,source.sprite.frame.name).setOrigin(0).setScale(source.sprite.scaleX,-source.sprite.scaleY).setDepth(l.depth-8+i*.5).setTint(0xabc4d3).setMask(this.reflectionMask!);if(source.mixed)sprite.setPipeline('RegistryFrameMix',{...source.sprite.pipelineData});this.reflections.push({source,sprite,plane});});
   }
  }
  for(const prop of this.roomProps()){
   if(prop.kind==='bridge')continue;
   const sprite=this.assetSprite(prop.asset,prop.x,prop.y,prop.width,prop.height,prop.kind==='art'?25:prop.kind==='npc'?35:30);this.propSprites.set(prop.id,sprite);
   if(prop.kind==='map'){const a=this.resources.catalogue.assets[prop.asset],height=a.frameHeight||a.height,pivot=a.pivot;if(!pivot)throw Error('Map banner needs its native top-rod pivot.');const bottom=a.anchors?.bottom?.[1]??height;if(bottom<=pivot[1])throw Error('Map banner bottom must follow its top rod.');sprite.setScale(prop.height/(bottom-pivot[1]));}
   if(prop.kind==='latch'){
    // The mount and screws share the lever's native pixel pitch and anchor.
    // Only the lever's own pivot is animated after the physical release.
    const base=this.assetSprite('courtyard-latch-base',prop.x,prop.y,prop.width,prop.height,29).setScale(sprite.scaleX);
    this.propSprites.set(prop.id+':base',base);
   }
   if(prop.kind==='art'&&prop.itemId){const a=illustrations.find(a=>a.id===prop.itemId)!,rect=prop.aperture||{x:prop.x-prop.width/2+11,y:prop.y-prop.height+13,width:prop.width-22,height:prop.height-26},scale=Math.min(rect.width/a.thumbnailWidth,rect.height/a.thumbnailHeight);this.artSprites.push(this.add.image(rect.x+rect.width/2,rect.y+rect.height/2,'registry-art:'+a.id).setDisplaySize(a.thumbnailWidth*scale,a.thumbnailHeight*scale).setDepth(26))}
  }
  for(const p of this.room.portals)if(!p.automatic){
   // An ordinary door sits inside the monumental architectural recess. The
   // frame keeps one human scale; the surrounding void carries the huge scale.
   const material=this.resources.catalogue.assets['door-frame'],cover=125/(material.frameHeight||material.height);
   const frame=this.assetSprite('door-frame',p.x,p.y,p.width||88,p.height||152,27).setScale(cover);this.propSprites.set('portal:'+p.id,frame);
   const f=this.resources.catalogue.assets['door-frame'],l=this.resources.catalogue.assets['door-leaf'],fw=f.frameWidth||f.width,fh=f.frameHeight||f.height,fp=f.pivot||[fw/2,fh],tl=f.anchors?.apertureTL||f.anchors?.sourceTopLeft,br=f.anchors?.apertureBR||f.anchors?.sourceBottomRight;
   const opening=tl&&br?{x:frame.x+(tl[0]-fp[0])*frame.scaleX,y:frame.y+(tl[1]-fp[1])*frame.scaleY,width:(br[0]-tl[0])*frame.scaleX,height:(br[1]-tl[1])*frame.scaleY}:{x:p.x-(p.width||88)*.375,y:p.y-(p.height||152)*.91,width:(p.width||88)*.75,height:(p.height||152)*.91};
   const recess={left:p.x-(p.width||88)/2-3,right:p.x+(p.width||88)/2+3,top:p.y-(p.height||152)-3,bottom:p.y+2},shade=this.add.graphics().setVisible(false).fillStyle(0xffffff);
   // Only an invisible clipping shape is procedural. The visible recess uses
   // the generated stone/shadow material; the small leaf aperture stays open.
   if(opening.y>recess.top)shade.fillRect(recess.left,recess.top,recess.right-recess.left,opening.y-recess.top);
   if(opening.x>recess.left)shade.fillRect(recess.left,opening.y,opening.x-recess.left,Math.max(0,recess.bottom-opening.y));
   if(recess.right>opening.x+opening.width)shade.fillRect(opening.x+opening.width,opening.y,recess.right-opening.x-opening.width,Math.max(0,recess.bottom-opening.y));
   if(recess.bottom>opening.y+opening.height)shade.fillRect(opening.x,opening.y+opening.height,opening.width,recess.bottom-opening.y-opening.height);
   const recessAsset=this.resources.catalogue.assets['door-recess'],rw=recessAsset.frameWidth||recessAsset.width,rh=recessAsset.frameHeight||recessAsset.height,rs=Math.max((recess.right-recess.left)/rw,(recess.bottom-recess.top)/rh),recessImage=this.assetSprite('door-recess',p.x,recess.bottom,rw*rs,rh*rs,22),recessMask=shade.createGeometryMask();recessImage.setMask(recessMask);this.recesses.push({image:recessImage,shape:shade,mask:recessMask});
   const lw=l.frameWidth||l.width,lh=l.frameHeight||l.height,lp=l.pivot||[lw/2,lh],scale=Math.min(opening.width/lw,opening.height/lh),left=opening.x+(opening.width-lw*scale)/2,top=opening.y+opening.height-lh*scale;
   const leaf=this.assetSprite('door-leaf',left+lp[0]*scale,top+lp[1]*scale,lw*scale,lh*scale,24),aperture=this.add.graphics().fillStyle(0xffffff).fillRect(opening.x,opening.y,opening.width,opening.height).setVisible(false),mask=aperture.createGeometryMask();leaf.setMask(mask);this.doors.set(p.id,{leaf,closedX:leaf.x,amount:0,target:0,mask,aperture});
  }
  if(this.room.id==='registry'){const point=this.room.npc!;this.npc=this.assetSprite('accountant-idle',point.x,point.y,90,100,30);}
  if(this.room.id==='junction'){
   this.bannerTime=0;const p=this.room.props.find(p=>p.kind==='map')!,material=this.resources.catalogue.assets['map-cord']?'map-cord':'bridge-rope',fixed=p.cordFixed||{x:p.x,y:this.mapAttachment().y-40};
   const cord=new CutCord(this,'map','registry:'+material,this.resources.catalogue.assets[material],fixed,()=>this.mapAttachment(),.6,31);this.cords.set('map',cord);p.cutPoint={...cord.cutPoint};p.interactY=cord.cutPoint.y+35;if(this.progress.cuts.includes('map')){this.bannerTime=1;cord.restore();}
  }
  if(this.room.bridge){
   this.bridgeTime=this.progress.cuts.includes('bridge')?1:0;const b=this.room.bridge,a=this.resources.catalogue.assets.bridge,w=a.frameWidth||a.width,pivot=a.pivot||[0,(a.frameHeight||a.height)/2],span=(a.anchors?.end?.[0]??w)-pivot[0];
   if(span<=0)throw Error('Bridge end must follow its native hinge pivot.');
   const scale=b.length/span,top=a.anchors?.walkTop?.[1]??0,hingeY=b.y+(pivot[1]-top)*scale;
   this.bridgeSprite=this.assetSprite('bridge',b.x,hingeY,b.length,100,32).setOrigin(pivot[0]/w,pivot[1]/(a.frameHeight||a.height)).setScale(scale).setAngle(-86);
   let fixed=b.fixed||{x:b.x-75,y:b.y-35};
   if(b.post){const post=this.assetSprite('bridge-post',b.post.x,b.post.y,40,48,33);this.propSprites.set('bridge:post',post);const material=this.resources.catalogue.assets['bridge-post'],tie=material.anchors?.rope,p=material.pivot||[(material.frameWidth||material.width)/2,material.frameHeight||material.height];if(tie)fixed={x:post.x+(tie[0]-p[0])*post.scaleX,y:post.y+(tie[1]-p[1])*post.scaleY};}
   const cord=new CutCord(this,'bridge','registry:bridge-rope',this.resources.catalogue.assets['bridge-rope'],fixed,()=>this.bridgeAttachment(),.12,34);this.cords.set('bridge',cord);
   const target=this.room.props.find(p=>p.kind==='bridge')!;target.cutPoint={...cord.cutPoint};if(this.progress.cuts.includes('bridge'))cord.restore();
  }
  if(this.room.sentry){const s=this.room.sentry;this.enemy=createEnemy('sentry:'+this.room.id,s.x,this.room.floor,false,s.left,s.right);this.spawnEnemy();}
  const idle=this.manifest.clips.idle;this.hero=this.add.sprite(this.player.x,this.player.y,'registry-hero:idle').setOrigin(this.manifest.footX/idle.frameWidth,this.manifest.footY/idle.frameHeight).setScale(this.manifest.scale||1).setDepth(40);
 }
 private spawnEnemy(){if(!this.enemy)return;this.enemySprite?.destroy();const a=this.resources.catalogue.assets['warden-idle'],h=a.bodyBounds?.height||a.frameHeight||a.height,scale=(this.enemy.boss?96:52)/h;this.enemySprite=this.assetSprite('warden-idle',this.enemy.x,this.enemy.y,(a.frameWidth||a.width)*scale,(a.frameHeight||a.height)*scale,39);}
 private bridgeAttachment(){const s=this.bridgeSprite!,a=this.resources.catalogue.assets.bridge,w=a.frameWidth||a.width,h=a.frameHeight||a.height,pivot=a.pivot||[0,h/2],point=a.anchors?.rope||a.anchors?.end||[w,pivot[1]],x=(point[0]-pivot[0])*s.scaleX,y=(point[1]-pivot[1])*s.scaleY,c=Math.cos(s.rotation),n=Math.sin(s.rotation);return{x:s.x+x*c-y*n,y:s.y+x*n+y*c};}
 private mapAttachment(){const s=this.propSprites.get('map')!,a=this.resources.catalogue.assets['map-banner'],pivot=a.pivot!,start=a.anchors?.rolledTie,end=a.anchors?.unrolledTie;if(start&&end){const point=[start[0]+(end[0]-start[0])*this.bannerTime,start[1]+(end[1]-start[1])*this.bannerTime];return{x:s.x+(point[0]-pivot[0])*s.scaleX,y:s.y+(point[1]-pivot[1])*s.scaleY};}return{x:s.x,y:s.y+12+93*this.bannerTime};}
 update(_time:number,delta:number){if(!this.initialized||this.disposed)return;const dt=Math.min(.1,delta/1000);if(!document.hidden)this.presentationTime+=dt;
  if(this.npcTalk>=0&&!document.hidden)this.npcTalk+=dt;
  if(this.active&&!this.loading&&!document.hidden){this.accumulator+=dt;let loops=0;while(this.accumulator>=MOTION.step&&loops++<6){this.step(MOTION.step);this.accumulator-=MOTION.step;}if(loops>=6)this.accumulator=0;}
  const npcPoint=this.npc?this.screen(this.npc.x,this.npc.y):null,npcVisible=!!npcPoint&&npcPoint.x>25&&npcPoint.x<this.scale.width-25&&npcPoint.y>0&&npcPoint.y<this.scale.height;
  if(this.npcResponse===-2&&npcVisible&&this.active)this.npcResponse=0;
  if(this.npcResponse>=0&&this.active&&!this.loading&&npcVisible){this.npcResponse+=dt;const clips=this.resources.catalogue.assets,responseDuration=frameDuration(clips['accountant-acknowledge'])+frameDuration(clips['accountant-rest'])+.8;if(this.npcResponse>responseDuration){this.progress.acknowledged=true;this.changed();this.npcResponse=-1;}}
  this.render(dt);this.hud();
 }
 private step(dt:number){this.gameTime+=dt;this.portalGrace=Math.max(0,this.portalGrace-dt);if(this.dead){this.dead+=dt;if(this.dead>.8){this.dead=0;this.visit=false;void this.loadRoom(this.room.id==='arena'?'vestibule':this.progress.checkpoint,this.room.id==='arena'?'arena':'left');}return}
  if(this.descentMotion){const d=this.descentMotion;d.clock+=dt;const t=Math.min(1,d.clock/.2),amount=t*t*(3-2*t);this.player.x=d.fromX+(d.toX-d.fromX)*amount;this.player.y=d.fromY+(d.toY-d.fromY)*amount;this.player.facing=-1;this.player.clip='run';this.player.clipTime+=dt;if(t===1){this.player.grounded=false;this.player.support=null;this.player.coyote=0;this.player.vy=20;this.descentMotion=null}this.pressed.clear();return}
  if(this.pressed.has('interact'))this.interact();if(!this.active||this.loading||this.descentMotion){this.pressed.clear();return}
  if(this.progress.cuts.includes('bridge')){const before=this.bridgeTime;this.bridgeTime=Math.min(1,this.bridgeTime+dt/1.1);if(before<1&&this.bridgeTime===1)this.effect('hit-metal')}if(this.progress.cuts.includes('map')&&this.room.id==='junction')this.bannerTime=Math.min(1,this.bannerTime+dt/Math.max(.4,frameDuration(this.resources.catalogue.assets['map-banner'])));
  const useUpper=this.upperStairRoute||this.player.y<this.room.floor-25||this.player.support?.startsWith('up:');
  const solids=this.room.solids.filter(s=>(!this.room.ascent||!s.id.startsWith('up:')||useUpper)&&!(this.lowerStairRoute&&s.id==='main'));if(this.room.bridge&&this.bridgeTime>=1){const b=this.room.bridge;solids.push({id:'bridge',x:b.x,y:b.y,width:b.length,height:8,oneway:true,material:'metal'});}
  stepPlayer(this.player,dt,this.held,this.pressed,solids,this.room.width,this.manifest,{slash:()=>this.effect(this.effects%2?'slash-1':'slash-2'),contact:()=>this.strike(),land:()=>this.effect('landing')});
  if(this.player.support?.startsWith('up:')||this.player.support==='upper')this.upperStairRoute=true;else if(this.player.grounded&&this.player.support==='main')this.upperStairRoute=false;
  if(this.lowerStairRoute&&this.room.descent&&this.player.x>=this.room.descent.x-8&&this.player.y<=this.room.floor+10)this.lowerStairRoute=false;
  const p=this.player;if(p.y>this.room.height+140){this.die();this.pressed.clear();return}
  if(p.grounded&&p.clip==='run'&&p.dash===0){const frame=frameAt({width:1,height:1,src:'',frames:this.manifest.clips.run.frames,frameMs:this.manifest.clips.run.durationsMs||this.manifest.clips.run.durations},p.clipTime);if((frame===1||frame===5)&&frame!==this.lastFoot&&p.distance-this.footDistance>20){this.footDistance=p.distance;this.effect(p.support==='bridge'?'step-metal-1':this.effects%2?'step-concrete-1':'step-concrete-2')}this.lastFoot=frame}else this.lastFoot=-1;
  if(this.enemy){const e=this.enemy;stepEnemy(e,p,dt,this.settings.assistance,x=>this.hurt(x),()=>this.effect('telegraph'),frameDuration(this.resources.catalogue.assets['warden-death']));if(e.phase==='gone'&&e.boss&&!this.bossFinished){this.bossFinished=true;this.progress.wins++;this.changed();this.active=false;this.clearInputs();this.emit({type:'black',value:true});const op=this.operation;setTimeout(()=>{if(this.disposed||op!==this.operation)return;this.visit=true;this.emit({type:'black',value:false});this.panel({kind:'product'})},this.settings.reduced?60:540)}}
  if(this.portalGrace===0&&!this.dead)for(const portal of this.room.portals)if(portal.automatic&&Math.abs(p.x-portal.x)<36&&(portal.automatic==='left'?this.held.has('left'):this.held.has('right'))){void this.loadRoom(portal.target,portal.entry);break}
  this.pressed.clear();
 }
 private hurt(fromX:number){if(this.player.invulnerable>0||this.dead||this.room.safe||this.settings.assistance)return;this.health--;const p=this.player;p.invulnerable=1.2;p.hurt=.32;p.vx=p.x>=fromX?170:-170;p.vy=-110;p.grounded=false;p.dash=0;p.attack=-1;this.effect('hurt');if(this.health<=0)this.die();}
 private die(){if(this.dead)return;this.health=0;this.dead=.001;this.clearInputs();this.player.clip='death';this.player.clipTime=0;this.effect('defeat');}
 private strike(){const p=this.player;
  const target=this.room.props.find(x=>x.kind==='map'||x.kind==='bridge'),cut=target?.cutPoint;
  if(target&&cut&&!this.progress.cuts.includes(target.kind)&&strikeTouchesPoint(p,cut)){this.progress.cuts.push(target.kind);this.cords.get(target.kind)?.sever();if(target.kind==='map')this.bannerTime=0;else this.bridgeTime=0;this.changed();this.effect('cable-cut')}
  if(this.enemy&&strikeEnemy(this.enemy,p)){this.effect('hit-metal');if(this.enemy.health<=0)this.effect('victory')}
 }
 private nearest():Near|null{
  if(this.dead||this.loading)return null;const p=this.player,candidates:Near[]=[];
  for(const portal of this.room.portals)if(!portal.automatic)candidates.push({id:'door:'+portal.id,x:portal.x,y:portal.y,label:portal.courtyard?'Courtyard':ROOMS[portal.target].name,action:'E',portal});
  if(this.room.descent&&Math.abs(p.y-this.room.descent.y)<18)candidates.push({id:'archive-stairs',...this.room.descent,label:'Descend',action:'E'});
  if(this.room.ascent&&Math.abs(p.y-this.room.ascent.y)<18&&!this.upperStairRoute)candidates.push({id:'upper-stairs',...this.room.ascent,label:'Ascend',action:'E'});
  for(const prop of this.roomProps()){if(prop.kind==='bridge'&&this.progress.cuts.includes('bridge'))continue;if(prop.kind==='map'&&this.progress.cuts.includes('map')&&this.bannerTime<1)continue;if(prop.kind==='latch'&&this.progress.courtyard)continue;const labels:Record<Prop['kind'],string>={npc:'Accountant',rest:'Rest',donate:'Donate',donors:'Top donors',map:'Map',consignment:'Collections',docs:'Records',catalogue:'Collection',art:'Inspect',latch:'Release latch',bridge:'Cut restraint'},cut=prop.kind==='bridge'||prop.kind==='map'&&!this.progress.cuts.includes('map');candidates.push({id:prop.id,x:cut&&prop.cutPoint?prop.cutPoint.x:prop.x,y:prop.kind==='map'&&this.progress.cuts.includes('map')?this.room.floor:prop.interactY??prop.y,label:prop.kind==='map'&&!this.progress.cuts.includes('map')?'Release map':labels[prop.kind],action:cut?'Slash':'E',prop});}
  return candidates.filter(c=>Math.abs(c.x-p.x)<(c.id.endsWith('-stairs')?28:c.prop?.kind==='art'?85:80)&&Math.abs(c.y-p.y)<125).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]||null;
 }
 private interact(){const near=this.nearest();if(!near||near.action==='Slash')return;if(near.id==='archive-stairs'||near.id==='upper-stairs'){this.clearInputs();const upper=near.id==='upper-stairs';this.upperStairRoute=upper;this.lowerStairRoute=!upper;this.descentMotion={fromX:this.player.x,fromY:this.player.y,toX:near.x-(upper?20:12),toY:near.y+(upper?-16:18),clock:0};return}const portal=near.portal;
  if(portal){const door=this.doors.get(portal.id);if(portal.courtyard&&!this.progress.courtyard){if(this.room.id==='registry'){if(door)door.target=1;this.panel({kind:'sky-door'})}return;}if(door){door.target=1;this.openingDoorAt=this.presentationTime}void this.loadRoom(portal.target,portal.entry);return;}
  const prop=near.prop!;if(prop.kind==='npc'){this.npcTalk=0;this.effect('confirm');this.panel({kind:'accountant'});}else if(prop.kind==='art')this.openArt(prop.itemId!);else this.panel({kind:prop.kind==='map'?'map':prop.kind==='docs'?'docs':prop.kind==='latch'?'latch':prop.kind==='donate'?'donate':prop.kind==='donors'?'donors':prop.kind==='rest'?'rest':prop.kind==='catalogue'?'catalogue':'consignment'});
 }
 private openArt(id:string){this.panel({kind:'art',id});}
 private render(dt:number,immediate=false){if(!this.initialized)return;this.frame=cameraTarget(this.scale.width,this.scale.height,this.room,this.player,this.cameraState,immediate?100:dt,this.settings.reduced,this.enemy||undefined);const f=this.frame,cam=this.cameras.main;cam.setZoom(f.zoom);cam.setScroll(f.left+(f.viewW-this.scale.width)/2,f.top+(f.viewH-this.scale.height)/2);
  const t=this.settings.reduced?0:this.presentationTime;
  for(const v of this.visuals){const a=this.resources.catalogue.assets[v.asset],l=v.layer!;const parallax=l.parallax??1;let drift=0;if(l.drift&&!this.settings.reduced)drift=Math.sin((t*l.drift+v.phase)/180)*90;v.sprite.setPosition(Math.round(v.x+(f.left-this.room.referenceLeft)*(1-parallax)+drift),Math.round(v.y+(f.top)*(1-parallax)));if(v.mixed){const blend=frameBlend(a,t+v.phase);v.sprite.setFrame(blend.frame);Object.assign(v.sprite.pipelineData,{nextFrame:this.settings.reduced?blend.frame:blend.next,frameMix:this.settings.reduced?0:blend.amount})}else v.sprite.setFrame(frameAt(a,t+v.phase));}
  for(const r of this.reflections){const original=r.source.sprite;r.sprite.setPosition(original.x,r.plane*2-original.y).setScale(original.scaleX,-original.scaleY).setFrame(original.frame.name).setAlpha(r.source.layer?.role==='sky'?1:original.alpha*.72);if(r.source.mixed)Object.assign(r.sprite.pipelineData,original.pipelineData);}
  for(const prop of this.roomProps()){const s=this.propSprites.get(prop.id);if(!s)continue;const a=this.resources.catalogue.assets[prop.asset];s.setFrame(frameAt(a,t));}
  for(const door of this.doors.values()){door.amount=this.settings.reduced?door.target:door.amount+(door.target-door.amount)*Math.min(1,dt*10);door.leaf.setX(Math.round(door.closedX+door.amount*door.leaf.displayWidth));}
  if(this.room.id==='courtyard')this.propSprites.get('latch')?.setAngle(this.progress.courtyard?-70:0);
  if(this.room.id==='junction'){const banner=this.propSprites.get('map')!,a=this.resources.catalogue.assets['map-banner'];banner.setFrame(frameAt(a,this.bannerTime*frameDuration(a),false));}
  if(this.bridgeSprite){const amount=this.bridgeTime;this.bridgeSprite.setAngle(-86*(1-amount*amount*(3-2*amount)));}
  for(const cord of this.cords.values())cord.update(this.active&&!this.loading?dt:0,this.settings.reduced);
  if(this.npc){const responding=this.npcResponse>=0,ackDuration=frameDuration(this.resources.catalogue.assets['accountant-acknowledge']),talking=this.npcTalk>=0&&this.npcTalk<ackDuration,asset=responding?(this.npcResponse<ackDuration?'accountant-acknowledge':'accountant-rest'):talking&&!this.progress.courtyard?'accountant-acknowledge':this.progress.acknowledged?'accountant-rest':'accountant-idle';const a=this.resources.catalogue.assets[asset],w=a.frameWidth||a.width,h=a.frameHeight||a.height,pivot=a.pivot||[w/2,h],clock=responding?this.npcResponse-(asset==='accountant-rest'?ackDuration:0):talking?this.npcTalk:this.progress.acknowledged?frameDuration(a):t;this.npc.setTexture('registry:'+asset,frameAt(a,clock,asset==='accountant-idle')).setOrigin(pivot[0]/w,pivot[1]/h).setScale(62/(a.bodyBounds?.height||h));}
  const p=this.player,name=this.dead?'death':this.rested?'idle':p.clip,clip=this.manifest.clips[name]||this.manifest.clips.idle;const clock=this.dead?this.dead:p.clip==='attack1'?p.attack:p.clipTime;const index=frameAt({src:'',width:clip.frameWidth,height:clip.frameHeight,frames:clip.frames,frameMs:clip.durationsMs||clip.durations,loop:clip.loop??['idle','run'].includes(name)},clock);this.hero.setPosition(Math.round(p.x),Math.round(p.y)).setTexture('registry-hero:'+name,p.dash>0?this.manifest.actions.dash.frame:index).setOrigin(this.manifest.footX/clip.frameWidth,this.manifest.footY/clip.frameHeight).setFlipX(p.facing<0).setAlpha(p.invulnerable>0&&p.hurt>0?.55:1);
  this.fx.clear();if(this.enemy&&this.enemySprite){const e=this.enemy,a=this.resources.catalogue.assets[e.clip],duration=frameDuration(a),times=Array.isArray(a.frameMs)?a.frameMs:Array(a.frames||1).fill(a.frameMs||120),sourceWindup=times.slice(0,a.attackWindupFrames??2).reduce((sum,value)=>sum+value,0)/1000;let clock=e.clock;if(e.phase==='windup')clock=Math.min(sourceWindup-.0001,e.clock/(this.settings.assistance?1.15:.85)*sourceWindup);else if(e.phase==='active')clock=sourceWindup+e.clock/(e.pattern===0?.38:.5)*(duration-sourceWindup);const w=a.frameWidth||a.width,h=a.frameHeight||a.height,pivot=a.pivot||[w/2,h],flipped=(a.facing||'left')==='left'?e.facing>0:e.facing<0;this.enemySprite.setTexture('registry:'+e.clip,frameAt(a,clock,e.phase==='waiting'||e.phase==='approach')).setOrigin((flipped?w-pivot[0]:pivot[0])/w,pivot[1]/h).setPosition(Math.round(e.x),Math.round(e.y)).setFlipX(flipped).setVisible(e.phase!=='gone');if(e.phase==='windup'){const alpha=.18+.3*Math.min(1,e.clock/.85);this.fx.fillStyle(0xd39b77,alpha);if(e.pattern===1)this.fx.fillRect(e.targetX-70,e.y-3,140,3);else this.fx.fillRect(e.x+(e.facing<0?-200:0),e.y-3,200,3);}if(e.phase==='active'&&e.pattern===1){const strength=e.clock<.14?.12:Math.max(0,1-(e.clock-.14)/.36);this.fx.fillStyle(0xe8d0b1,strength*.12).fillRect(e.targetX-70,e.y-115,140,115).fillStyle(0xe8d0b1,strength*.65).fillRect(e.targetX-70,e.y-8,140,8);for(const offset of [-42,0,42])this.fx.fillStyle(0xe8d0b1,strength*.35).fillRect(e.targetX+offset-2,e.y-85,4,85);}}
 }
 private screen(x:number,y:number){return{x:Math.round((x-this.frame.left)*this.frame.zoom),y:Math.round((y-this.frame.top)*this.frame.zoom+this.frame.offsetY)}}
 private hud(){this.near=this.active?this.nearest():null;const n=this.near,point=n?this.screen(n.x,n.y-95):null,e=this.enemy;const event:Extract<GameEvent,{type:'hud'}>={type:'hud',health:this.health,maximum:3,letterbox:this.frame.offsetY,boss:e?.boss?{health:e.health,maximum:e.maximum,phase:e.phase}:undefined,prompt:n&&point?{id:n.id,label:n.label,action:n.action,...point}:undefined};const serialized=JSON.stringify(event);if(serialized!==this.lastHud){this.lastHud=serialized;this.emit(event)}}
 snapshot(){return{ready:this.initialized,loading:this.loading,active:this.active,room:this.room.id,player:{...this.player,attackHits:[...this.player.attackHits]},health:this.health,camera:{...this.frame,committed:this.cameraState.committed},progress:structuredClone(this.progress),enemy:this.enemy?{...this.enemy}:null,prompt:this.near?{id:this.near.id,label:this.near.label,action:this.near.action,x:this.near.x,y:this.near.y}:null,mechanisms:{map:this.bannerTime,bridge:this.bridgeTime,courtyard:this.progress.courtyard,accountantResponse:this.npcResponse,cords:Object.fromEntries([...this.cords].map(([id,c])=>[id,c.snapshot()])),fixedHardware:Object.fromEntries(['bridge:post','latch:base'].flatMap(id=>{const s=this.propSprites.get(id);return s?[[id,{x:s.x,y:s.y,rotation:s.rotation}]]:[]}))},resources:{...this.resources.residency(),catalogue:this.resources.catalogue.version},animation:this.visuals.filter(v=>(this.resources.catalogue.assets[v.asset].frames||1)>1).map(v=>({asset:v.asset,frame:v.sprite.frame.name})),time:this.presentationTime,gameTime:this.gameTime,visit:this.visit,settings:this.settings}}
}
