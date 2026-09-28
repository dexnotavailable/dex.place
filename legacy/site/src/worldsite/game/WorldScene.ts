import Phaser from 'phaser';
import {createAssembly,paintAssembly,holdAssemblyInspection,releaseAssemblyInspection,type Assembly} from './assemblies';
import {MOTION as M,PALETTE as C,PUBLIC_ASSETS,type HeroAssets,type SceneAssets} from './assets';
import {readMap,type MapObject,type Solid,type WorldMap} from './map';
import type {Section,WorldCommand,WorldIntent,WorldProjection,WorldPose} from './contracts';
import type {AudioEffect} from '../audio';
import {Environment} from './environment';
import {cameraFrame} from '../camera-frame';
import {HingedBridge,RailLift} from './mechanisms';
import {readRoomGraph,roomFor,WORLD_REVISION,type RoomGraph,type WorldRoom} from './roomGraph';
import {ExplorationProgress} from './progress';
import type {CastManifest} from './cast';
import {Population} from './population';
import {SocialGhosts} from './ghosts';
import {RoomDoorway} from './doorway';
import {ReleasedMap} from './releasedMap';
import {RoomResources} from './roomResources';

type InputAction=Extract<WorldCommand,{type:'input'}>['action'];
type Player={x:number;y:number;vx:number;vy:number;grounded:boolean;support:string|null;facing:1|-1;coyote:number;jumpBuffer:number;dash:number;dashCooldown:number;airDash:boolean;airJump:boolean;jumpCount:number;airJumpCount:number;attack:number;attackHits:Set<string>;invulnerable:number;hurt:number;clip:string;clipTime:number};
type Fragment={x:number;y:number;vx:number;vy:number;life:number;color:number};
const approach=(value:number,target:number,amount:number)=>value<target?Math.min(value+amount,target):Math.max(value-amount,target);

/** Independent private world: authored room/collision graph, no remote simulation. */
export class WorldScene extends Phaser.Scene {
 private initialized=false;private queued:WorldCommand[]=[];private map!:WorldMap;private graph!:RoomGraph;private currentRoom!:WorldRoom;
 private heroAssets!:HeroAssets;private sceneAssets:SceneAssets={assets:[],placements:[]};private cast!:CastManifest;
 private player!:Player;private hero!:Phaser.GameObjects.Sprite;private sky!:Phaser.GameObjects.Graphics;private effects!:Phaser.GameObjects.Graphics;private environment!:Environment;
 private progress!:ExplorationProgress;private population!:Population;private ghosts!:SocialGhosts;
 private resources!:RoomResources;private disposed=false;private roomLoadToken=0;
 private pendingRoom:{roomId:string;doorId:string;sourceRoomId:string;token:number}|null=null;
 private retryRoom:(()=>void)|null=null;private inspectedSource:string|null=null;private presentationTime=0;
 private assemblies=new Map<string,Assembly>();private bridges=new Map<string,HingedBridge>();private lifts=new Map<string,RailLift>();private doors=new Map<string,RoomDoorway>();private physicalMap:ReleasedMap|null=null;
 private focused=false;private paused=false;private reducedMotion=false;private quality:'auto'|'low'|'high'='auto';private shake=false;private holdToSlash=false;private assistance=false;
 private held=new Set<InputAction>();private pressed=new Set<InputAction>();private accumulator=0;private clock=0;private stepCount=0;private hitStop=0;
 private nearest:MapObject|null=null;private lastPrompt='';private lastProjection='';private lastCombat='';private region='arrival';
 private health=3;private deadClock:number|null=null;private deathWasEncounter=false;
 private transition:{doorId:string;targetRoomId:string;entryId:string;clock:number;announced?:boolean}|null=null;
 private pendingProduct:{productId:string;encounterId:string}|null=null;
 private encounter:{productId:string;encounterId:string;visitId:string;menuEmitted:boolean}|null=null;
 private poseClock=0;private sequence=0;private lastPoseX=0;private lastPoseY=0;
 private footContact=-1;private footOrdinal=0;private lastFootX:number|null=null;private slashOrdinal=0;
 private fragments:Fragment[]=[];private airJumpMark:{x:number;y:number;remaining:number}|null=null;
 private readonly effectSession=Phaser.Utils.String.UUID();private effectSequence=0;private effectCounts:Partial<Record<AudioEffect,number>>={};private recentEffects:{id:AudioEffect;eventId:string;worldTime:number;action:string}[]=[];
 constructor(private emit:(event:WorldIntent)=>void){super('inhabited-world');}

 preload(){
  this.load.json('world-map',PUBLIC_ASSETS.map);this.load.json('room-graph',PUBLIC_ASSETS.rooms);
  this.load.json('hero-manifest',PUBLIC_ASSETS.hero);this.load.json('scene-manifest',PUBLIC_ASSETS.scene);this.load.json('cast-manifest',PUBLIC_ASSETS.cast);
  this.load.on('filecomplete-json-hero-manifest',()=>{this.heroAssets=this.cache.json.get('hero-manifest');for(const[name,clip]of Object.entries(this.heroAssets?.clips||{}))this.load.spritesheet('hero:'+name,clip.url,{frameWidth:clip.frameWidth,frameHeight:clip.frameHeight});});
  this.load.on('filecomplete-json-scene-manifest',()=>{this.sceneAssets=this.cache.json.get('scene-manifest')||{assets:[],placements:[]};});
  this.load.on('filecomplete-json-cast-manifest',()=>{this.cast=this.cache.json.get('cast-manifest');});
 }
 async create(){try{
  if(this.disposed)return;
  this.map=readMap(this.cache.json.get('world-map'));this.graph=readRoomGraph(this.cache.json.get('room-graph'),this.map);this.currentRoom=roomFor(this.graph,'arrival')!;
  if(!this.heroAssets?.clips||!this.textures.exists('hero:idle')||!this.cast?.actors.length)throw Error('The character assets could not load.');
  this.resources=new RoomResources(this,this.sceneAssets,this.map,this.graph,this.cast);
  const disposeLoading=()=>{this.endInspection(true);this.disposed=true;this.roomLoadToken++;this.pendingRoom=null;this.retryRoom=null;this.resources.dispose();};
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,disposeLoading);
  this.events.once(Phaser.Scenes.Events.DESTROY,disposeLoading);
  await this.resources.ensure('arrival');if(this.disposed)return;
  this.sky=this.add.graphics().setScrollFactor(0).setDepth(-100);this.effects=this.add.graphics().setDepth(30);
  this.environment=new Environment(this,this.sceneAssets,this.map);this.progress=new ExplorationProgress(this.graph,this.map,this.emit);
  this.player=this.freshPlayer(this.map.anchors.find(a=>a.id==='anchor.home')!);
  this.hero=this.add.sprite(this.player.x,this.player.y,'hero:idle',0).setDepth(20).setOrigin(this.heroAssets.footX/200,this.heroAssets.footY/200).setScale(this.heroAssets.scale||1);
  this.buildAssemblies('arrival');this.population=new Population(this,this.cast,this.map.objects,(amount,x)=>this.hurt(amount,x),(id,action)=>this.effect(id,action),()=>this.finishBoss());
  this.ghosts=new SocialGhosts(this,this.heroAssets);this.cameras.main.setRoundPixels(true);this.initialized=true;
  this.setRoom('arrival',null,false);this.player=this.freshPlayer(this.map.anchors.find(a=>a.id==='anchor.home')!);this.resize();this.scale.on('resize',this.resize,this);this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.scale.off('resize',this.resize,this));
  for(const c of this.queued)this.command(c);this.queued=[];this.renderWorld(0,true);this.emit({type:'ready'});this.progress.request();
 }catch(e){if(this.disposed)return;this.initialized=false;this.emit({type:'error',message:e instanceof Error?e.message:'The world could not load.'});}}
 invalidateRenderer(){this.endInspection(true);this.disposed=true;this.roomLoadToken++;this.pendingRoom=null;this.retryRoom=null;this.resources?.dispose();this.load.reset();}

 command(c:WorldCommand){if(!this.initialized){this.queued.push(c);return;}switch(c.type){
  case'pause':if(!c.paused)this.endInspection();this.paused=c.paused;this.clearInputs();this.accumulator=0;break;
  case'focus':this.focused=c.focused;this.clearInputs();break;
  case'input':if(!this.focused||this.paused||this.deadClock!==null||this.transition||this.pendingRoom)return;if(c.down){if(!this.held.has(c.action))this.pressed.add(c.action);this.held.add(c.action);}else this.held.delete(c.action);break;
  case'retry-passage':this.retryRoom?.();break;
  case'close-inspection':this.endInspection();break;
  case'travel':this.travel(c.section);break;
  case'enter-room':this.cancelEncounter();this.loadRoom(c.roomId,'command:'+c.roomId,()=>this.setRoom(c.roomId,c.entranceId??null));break;
  case'enter-encounter':this.enterEncounter(c.productId,c.encounterId,c.assistance??this.assistance);break;
  case'fight':this.enterEncounter(this.pendingProduct?.productId||'dex-place-documentation',this.pendingProduct?.encounterId||'encounter.documentation',c.assistance);break;
  case'leave-product-visit':this.leaveProductVisit();break;
  case'restore-progress':if(this.progress.restore(c.snapshot)){this.restoreMechanisms();const anchor=this.progress.checkpoint,id=String(anchor.props.roomId||'arrival');this.cancelEncounter();this.loadRoom(id,'restore:'+id,()=>{this.setRoom(id,null,false);this.player=this.freshPlayer(anchor);this.renderWorld(0,true);});}break;
  case'request-progress':this.progress.request();break;
  case'ghosts':this.ghosts.setPeers(c.peers);break;
  case'inspect-map':this.inspectMap();break;
  case'inspect-gallery':{const object=this.map.objects.find(o=>o.id===c.id&&o.kind==='gallery');if(object&&object.props.roomId===this.currentRoom.id&&this.galleryProjection().some(e=>e.id===c.id))this.inspect(object);break;}
  case'banner':if(c.open)this.inspectMap();break;
  case'restart':this.progress.reset();this.restoreMechanisms(true);this.population.resetCreatures();this.travel('home');break;
  case'settings':this.reducedMotion=c.reducedMotion;this.quality=c.quality;this.shake=c.shake;this.holdToSlash=c.holdToSlash;if(typeof c.assistance==='boolean'){this.assistance=c.assistance;this.population.setAssistance(c.assistance);}break;
 }}
 private freshPlayer(anchor:{x:number;y:number},facing:1|-1=1):Player{return{x:anchor.x,y:anchor.y,vx:0,vy:0,grounded:true,support:null,facing,coyote:M.coyote,jumpBuffer:0,dash:0,dashCooldown:0,airDash:true,airJump:true,jumpCount:0,airJumpCount:0,attack:-1,attackHits:new Set(),invulnerable:1,hurt:0,clip:'idle',clipTime:0};}
 private clearInputs(){this.held.clear();this.pressed.clear();if(this.player){this.player.vx=0;this.player.jumpBuffer=0;this.player.dash=0;}}
 private beginInspection(id:string){this.endInspection();const a=this.assemblies.get(id);this.inspectedSource=a&&holdAssemblyInspection(a,this.presentationTime)?id:null;}
 private endInspection(immediate=false){if(immediate){for(const a of this.assemblies.values())releaseAssemblyInspection(a,this.presentationTime,true);}else if(this.inspectedSource){const a=this.assemblies.get(this.inspectedSource);if(a)releaseAssemblyInspection(a,this.presentationTime);}this.inspectedSource=null;}
 private hydrateRoom(id:string){this.environment.ensureRoom(id);this.buildAssemblies(id);this.population.ensureRoom(id);}
 private loadRoom(id:string,doorId:string,onReady:()=>void,passage=false){
  if(!roomFor(this.graph,id)||this.disposed)return;
  const token=++this.roomLoadToken,sourceRoomId=this.currentRoom.id;
  this.transition=null;this.clearInputs();this.pendingRoom={roomId:id,doorId,sourceRoomId,token};
  this.retryRoom=()=>{const door=this.map.objects.find(o=>o.id===doorId);if(passage&&door&&!this.eligible(door)){this.emit({type:'room-transition',phase:'failed',sourceRoomId,targetRoomId:id,doorId,message:'Return to the passage to retry.'});return;}this.loadRoom(id,doorId,onReady,passage);};
  const announce=(loadedAssets:number,totalAssets:number)=>{if(!this.disposed&&this.pendingRoom?.token===token&&totalAssets>0)this.emit({type:'room-transition',phase:'loading',sourceRoomId,targetRoomId:id,doorId,loadedAssets,totalAssets});};
  void this.resources.ensure(id,announce).then(()=>{
   if(this.disposed||this.pendingRoom?.token!==token)return;
   this.hydrateRoom(id);this.pendingRoom=null;this.retryRoom=null;onReady();
   if(passage&&this.transition)this.emit({type:'room-transition',phase:'prepared',sourceRoomId,targetRoomId:id,doorId});
   if(!passage&&!this.disposed&&this.currentRoom.id===id)this.emit({type:'room-transition',phase:'ready',sourceRoomId,targetRoomId:id,doorId});
  }).catch(()=>{
   if(this.disposed||this.pendingRoom?.token!==token)return;
   this.pendingRoom=null;this.clearInputs();this.emit({type:'room-transition',phase:'failed',sourceRoomId,targetRoomId:id,doorId,message:'Room could not load. Try the passage again.'});
  });
 }
 private effect(id:AudioEffect,action:string){const eventId=`${this.effectSession}:${++this.effectSequence}`;this.effectCounts[id]=(this.effectCounts[id]||0)+1;this.recentEffects.push({id,eventId,worldTime:this.clock,action});if(this.recentEffects.length>40)this.recentEffects.shift();this.emit({type:'effect',id,eventId});}
 private buildAssemblies(roomId:string){
  for(const source of this.map.objects){
   if(source.props.roomId!==roomId)continue;
   if(source.kind==='door'){if(!this.doors.has(source.id))this.doors.set(source.id,new RoomDoorway(this,source));continue;}
   if(source.kind==='map'){if(!this.physicalMap){this.physicalMap=new ReleasedMap(this,source.id,source.x,source.y,()=>{this.progress.cut(String(source.props.persistentCut));this.effect('paper-open','map-settled');});if(this.progress.hasCut(String(source.props.persistentCut)))this.physicalMap.restore();}continue;}
   if(['mob','resident'].includes(source.kind))continue;
   if(this.assemblies.has(source.id))continue;
   const visual=source.kind==='product'?{...source,kind:'terminal'}:source.kind==='shortcut'?{...source,kind:'landing'}:source;
   const a=createAssembly(this,visual);a.source=source;this.assemblies.set(source.id,a);
  }
  for(const a of this.assemblies.values()){const s=a.source;
   if(s.props.roomId!==roomId)continue;
   if(s.kind==='bridge'&&!this.bridges.has(s.id)){
    a.root.setVisible(false);const cable=[...this.assemblies.values()].find(c=>c.source.kind==='cable'&&c.source.props.target===s.id);cable?.root.setVisible(false);
    this.bridges.set(s.id,new HingedBridge(this,{id:s.id,hinge:{x:s.x,y:s.y},length:s.width,onEvent:e=>{if(e.type==='cut'){a.state='lowering';if(cable)cable.state='cut';this.progress.cut(String(s.props.persistentCut));this.effect('cable-cut','cut:'+s.id);this.hitStop=.025;}if(e.type==='impact')this.effect('hit-metal','bridge-contact');if(e.type==='settled'){a.state='open';this.progress.cut(String(s.props.persistentCut));}}}));
    if(this.progress.hasCut(String(s.props.persistentCut)))this.bridges.get(s.id)!.restoreSettled();
   }else if(s.kind==='lift'&&!this.lifts.has(s.id)){
    a.root.setVisible(false);const upper=this.map.anchors.find(x=>x.id===s.props.upper)!;
    this.lifts.set(s.id,new RailLift(this,{id:s.id,x:s.x,lowerY:s.y,upperY:upper.y,width:s.width,speed:72,onEvent:e=>{if(e.type==='drive-start')this.effect('lift-start','lift-drive');if(e.type==='docked')this.effect('lift-dock','lift-dock');}}));
    this.lifts.get(s.id)!.restoreDock(this.progress.hasShortcut('shortcut.gallery-return')?'lower':'upper');
   }
  }
 }
 private restoreMechanisms(reset=false){for(const[id,bridge]of this.bridges){const s=this.map.objects.find(o=>o.id===id)!;if(!reset&&this.progress.hasCut(String(s.props.persistentCut)))bridge.restoreSettled();else bridge.reset();}if(!reset&&this.progress.hasCut('cut.map.junction'))this.physicalMap?.restore();else if(this.physicalMap){this.physicalMap.destroy();this.physicalMap=null;this.buildAssemblies('junction');}for(const lift of this.lifts.values())lift.restoreDock(this.progress.hasShortcut('shortcut.gallery-return')?'lower':'upper');}
 private setRoom(id:string,entranceId:string|null,checkpoint=true){const room=roomFor(this.graph,id);if(!room||!this.resources.isReady(id))return false;const before=this.currentRoom?.id??null;const entrance=room.entrances.find(e=>e.id===entranceId)||room.entrances[0];if(!entrance)return false;
  this.roomLoadToken++;this.pendingRoom=null;this.retryRoom=null;this.endInspection(true);
  this.currentRoom=room;this.transition=null;this.clearInputs();this.player=this.freshPlayer(entrance,entrance.facing);this.health=3;this.deadClock=null;this.hitStop=0;this.accumulator=0;this.lastFootX=null;this.footContact=-1;this.nearest=null;
  (this.environment as Environment&{setRoom?:(roomId:string)=>void}).setRoom?.(id);this.population?.setRoom(id);this.ghosts?.clear();
  if(checkpoint&&id!=='arena')this.progress.checkpointAt(entrance.checkpointId);this.progress.discoverRoom(id);
  this.region=id;this.emit({type:'room-change',roomId:id,previousRoomId:before,geometryKey:room.geometryKey,worldRevision:WORLD_REVISION});this.emit({type:'region',region:id});this.notifyHealth('alive');this.renderWorld(0,true);return true;
 }
 private travel(section:Section|'home'){const mapping={home:'arrival',downloads:'dispatch',documentation:'archive',illustrations:'gallery',donate:'treasury'},id=mapping[section];this.cancelEncounter();this.loadRoom(id,'travel:'+id,()=>{this.setRoom(id,null);if(section==='home'){const a=this.map.anchors.find(x=>x.id==='anchor.home')!;this.player=this.freshPlayer(a);this.progress.checkpointAt(a.id);this.renderWorld(0,true);}});}
 private cancelEncounter(){this.encounter=null;this.pendingProduct=null;this.population?.clearBoss();this.notifyCombat();}
 private enterEncounter(productId:string,encounterId:string,assistance:boolean){
  if(this.currentRoom.id!=='dispatch'||!this.pendingProduct||this.pendingProduct.productId!==productId||this.pendingProduct.encounterId!==encounterId)return;
  const record=this.graph.products.find(p=>p.productId===productId&&p.encounterId===encounterId);if(!record)return;
  const actor=this.cast.actors.find(a=>a.id===record.bossActorId);if(!actor||['idle','walk','attack','hurt','death'].some(clip=>!actor.clips[clip])){this.emit({type:'room-transition',phase:'failed',sourceRoomId:this.currentRoom.id,targetRoomId:record.roomId,doorId:'product:'+productId});return;}
  this.paused=false;this.focused=true;
  this.loadRoom(record.roomId,'product:'+productId,()=>{this.setRoom(record.roomId,record.entranceId,false);this.encounter={productId,encounterId,visitId:crypto.randomUUID(),menuEmitted:false};this.pendingProduct=null;this.population.enterBoss(record.bossActorId,this.currentRoom.x+1850,this.currentRoom.floorY,assistance);this.notifyCombat();});
 }
 private finishBoss(){const visit=this.encounter;if(!visit||visit.menuEmitted)return;visit.menuEmitted=true;this.progress.outcome(visit.encounterId,'win');this.clearInputs();this.paused=true;this.emit({type:'product-menu',...visit});this.notifyCombat();}
 private leaveProductVisit(){const record=this.graph.products.find(p=>p.encounterId===this.encounter?.encounterId);this.cancelEncounter();this.paused=false;if(record)this.setRoom(record.returnRoomId,record.returnEntranceId);else this.setRoom('dispatch','dispatch.from.arena');}
 private useDoor(source:MapObject){if(this.transition||this.pendingRoom||this.deadClock!==null)return;const door=this.graph.doors.find(d=>d.id===source.id);if(!door)return;if(door.requiresShortcut&&!this.progress.hasShortcut(door.requiresShortcut)){this.emit({type:'prompt',label:'Release from the gallery landing',action:'E',visible:true});return;}const target=roomFor(this.graph,door.targetRoomId);if(!target?.entrances.some(e=>e.id===door.targetEntranceId)){this.emit({type:'room-transition',phase:'failed',sourceRoomId:this.currentRoom.id,targetRoomId:door.targetRoomId,doorId:door.id});return;}this.loadRoom(door.targetRoomId,door.id,()=>{this.transition={doorId:door.id,targetRoomId:door.targetRoomId,entryId:door.targetEntranceId,clock:0,announced:false};},true);}

 private resize(){if(!this.cameras?.main)return;const w=this.scale.width,h=this.scale.height;this.sky?.clear().fillStyle(0x829da7).fillRect(0,0,w+4,h+4);if(this.player)this.renderWorld(0,true);}
 update(_time:number,delta:number){if(!this.initialized)return;const dt=Math.min(delta/1000,.1);if(!document.hidden)this.presentationTime+=dt;
  if(!this.paused&&!this.pendingRoom){
   if(this.deadClock!==null){this.deadClock+=dt;this.player.clipTime=this.deadClock;if(this.deadClock>this.heroDuration('death')+.25)this.respawn();}
   else if(this.transition&&this.focused){const t=this.transition;if(!t.announced){t.announced=true;this.doors.get(t.doorId)?.setOpening(true);this.emit({type:'room-transition',phase:'opening',sourceRoomId:this.currentRoom.id,targetRoomId:t.targetRoomId,doorId:t.doorId});}t.clock+=dt;this.doors.get(t.doorId)?.update(dt,this.reducedMotion);if(t.clock>(this.reducedMotion?.12:.5)){const from=this.currentRoom.id;this.cancelEncounter();this.setRoom(t.targetRoomId,t.entryId);this.emit({type:'room-transition',phase:'ready',sourceRoomId:from,targetRoomId:t.targetRoomId,doorId:t.doorId});}}
   else if(this.focused){if(this.hitStop>0)this.hitStop=Math.max(0,this.hitStop-dt);else{this.accumulator+=dt;let steps=0;while(this.accumulator>=M.step&&steps<6){this.fixedStep(M.step);this.accumulator-=M.step;steps++;}if(steps===6)this.accumulator=0;}}
   else this.player.clipTime+=dt;
  }
  this.renderWorld(dt);this.publishPose(dt);
 }
 private fixedStep(dt:number){this.clock+=dt;this.stepCount++;const p=this.player;this.advanceMechanisms(dt);
  if(this.pressed.has('interact'))this.interact();if(this.paused||this.transition||this.pendingRoom){this.pressed.clear();return;}
  if(this.pressed.has('jump'))p.jumpBuffer=M.jumpBuffer;p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.hurt=Math.max(0,p.hurt-dt);p.coyote=p.grounded?M.coyote:Math.max(0,p.coyote-dt);p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
  const direction=(this.held.has('right')?1:0)-(this.held.has('left')?1:0);if(direction&&p.hurt===0)p.facing=direction>0?1:-1;
  if(this.pressed.has('dash')&&p.dashCooldown===0&&(p.grounded||p.airDash)&&p.hurt===0){p.dash=M.dashDuration;p.dashCooldown=M.dashCooldown;if(!p.grounded)p.airDash=false;}
  const groundJump=p.jumpBuffer>0&&p.coyote>0,airJump=!groundJump&&this.pressed.has('jump')&&!p.grounded&&p.airJump;
  if((groundJump||airJump)&&p.hurt===0){p.vy=-M.jumpSpeed;p.grounded=false;p.support=null;p.coyote=0;p.jumpBuffer=0;p.dash=0;p.jumpCount++;if(airJump){p.airJump=false;p.airJumpCount++;this.airJumpMark={x:p.x,y:p.y+2,remaining:.16};}}
  if(!this.held.has('jump')&&p.vy<-M.shortJumpSpeed)p.vy=Math.min(-M.shortJumpSpeed,p.vy+1900*dt);
  if(p.hurt>0){p.vx=approach(p.vx,0,160*dt);p.vy=Math.min(520,p.vy+M.gravity*dt);}else if(p.dash>0){p.dash=Math.max(0,p.dash-dt);p.vx=p.facing*M.dashSpeed;p.vy=0;}else{p.vx=approach(p.vx,direction*M.speed,(direction?M.acceleration:M.deceleration)*dt);p.vy=Math.min(520,p.vy+M.gravity*dt);}
  if((this.pressed.has('slash')||(this.holdToSlash&&this.held.has('slash')))&&p.attack<0&&p.hurt===0){p.attack=0;p.attackHits.clear();this.effect(++this.slashOrdinal%2?'slash-1':'slash-2','slash-start');}
  if(p.attack>=0){const previous=p.attack;p.attack+=dt;if(p.attack>=M.attackStart&&previous<M.attackEnd)this.strike();if(p.attack>=M.attackDuration)p.attack=-1;}
  this.movePlayer(dt);if(this.deadClock!==null){this.pressed.clear();return;}
  this.population.update(dt,p);if(this.deadClock!==null){this.pressed.clear();return;}
  if(this.airJumpMark){this.airJumpMark.remaining-=dt;if(this.airJumpMark.remaining<=0)this.airJumpMark=null;}
  for(const f of this.fragments){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=220*dt;}this.fragments=this.fragments.filter(f=>f.life>0);
  this.updateHeroClip(dt);this.updatePrompt();this.notifyCombat();
  if(p.grounded&&!this.encounter){const checkpoint=this.map.anchors.find(a=>a.props.autoCheckpoint===true&&a.props.roomId===this.currentRoom.id&&Math.abs(a.x-p.x)<40&&Math.abs(a.y-p.y)<8);if(checkpoint)this.progress.checkpointAt(checkpoint.id);}
  this.pressed.clear();
 }
 private activeSolids():Solid[]{const out=this.map.solids.filter(s=>s.props.roomId===this.currentRoom.id);for(const[id,bridge]of this.bridges){const o=this.map.objects.find(o=>o.id===id);const s=bridge.collisionSurface;if(o?.props.roomId===this.currentRoom.id&&s)out.push({...s,props:{material:'metal'}});}for(const[id,lift]of this.lifts){const o=this.map.objects.find(o=>o.id===id);if(o?.props.roomId!==this.currentRoom.id||!this.progress.hasShortcut(String(o.props.requiresShortcut)))continue;out.push({...lift.collisionSurface,props:{material:'metal'}});}return out;}
 private movePlayer(dt:number){const p=this.player,half=11,height=46,solids=this.activeSolids(),oldY=p.y,wasGrounded=p.grounded,fallSpeed=p.vy;p.x+=p.vx*dt;const overlaps=(s:Solid)=>p.x+half>s.x+.3&&p.x-half<s.x+s.width-.3;
  for(const s of solids)if(s.kind==='solid'&&overlaps(s)&&p.y>s.y+.1&&p.y-height<s.y+s.height){const rise=p.y-s.y;if(p.grounded&&rise>0&&rise<=16){p.y=s.y;p.vy=0;continue;}if(p.vx>0)p.x=s.x-half;else if(p.vx<0)p.x=s.x+s.width+half;p.vx=0;}
  const before=p.y;p.y+=p.vy*dt;p.grounded=false;p.support=null;let landing:Solid|null=null;
  if(p.vy>=0)for(const s of solids)if(overlaps(s)&&before<=s.y+1.5&&p.y>=s.y&&(!landing||s.y<landing.y))landing=s;
  if(landing){p.y=landing.y;p.vy=0;p.grounded=true;p.support=landing.id;p.airDash=true;p.airJump=true;if(!wasGrounded&&fallSpeed>80)this.effect('landing','land:'+landing.id);}else if(p.vy<0)for(const s of solids)if(s.kind==='solid'&&overlaps(s)&&before-height>=s.y+s.height&&p.y-height<s.y+s.height){p.y=s.y+s.height+height;p.vy=0;}
  if(!p.grounded&&p.vy>=0&&oldY<=before+.1){let down:Solid|null=null;for(const s of solids)if(overlaps(s)&&s.y>=p.y&&s.y-p.y<=9&&(!down||s.y<down.y))down=s;if(down&&p.coyote>0){p.y=down.y;p.vy=0;p.grounded=true;p.support=down.id;p.airJump=true;p.airDash=true;}}
  p.x=Phaser.Math.Clamp(p.x,this.currentRoom.x+92,this.currentRoom.x+this.currentRoom.width-92);
  if(p.y>1750){this.health=0;this.beginDeath(true);}
 }
 private advanceMechanisms(dt:number){this.physicalMap?.update(dt,this.currentRoom.id!=='junction',this.reducedMotion);for(const[id,bridge]of this.bridges)if(this.map.objects.find(o=>o.id===id)?.props.roomId===this.currentRoom.id)bridge.update(dt,{reducedMotion:this.reducedMotion});for(const[id,lift]of this.lifts){const source=this.map.objects.find(o=>o.id===id)!;if(source.props.roomId!==this.currentRoom.id||!this.progress.hasShortcut(String(source.props.requiresShortcut)))continue;const occupied=this.player.grounded&&this.player.support===id,dy=lift.update(dt,{occupied,reducedMotion:this.reducedMotion});if(occupied)this.player.y+=dy;const a=this.assemblies.get(id)!;a.y=lift.positionY;a.state=lift.state;a.occupied=occupied;}}
 private hurt(amount:number,fromX:number){const p=this.player;if(p.invulnerable>0||this.deadClock!==null||this.currentRoom.safe||(this.encounter&&this.assistance))return;this.health=Math.max(0,this.health-amount);p.invulnerable=1.2;p.hurt=.32;p.vx=p.x>=fromX?160:-160;p.vy=-105;p.grounded=false;p.dash=0;p.attack=-1;this.effect('hurt','player-hit');this.notifyHealth('hurt');if(this.health<=0)this.beginDeath(false);}
 private beginDeath(fall:boolean){if(this.deadClock!==null)return;this.deathWasEncounter=!!this.encounter;if(this.encounter)this.progress.outcome(this.encounter.encounterId,'defeat');this.clearInputs();this.player.vy=0;this.player.attack=-1;this.player.clip='death';this.player.clipTime=0;this.deadClock=fall?this.heroDuration('death'):0;this.effect('defeat',fall?'fall-recovery':'player-death');this.notifyHealth('dead');}
 private respawn(){this.notifyHealth('respawning');const encounter=this.encounter;this.cancelEncounter();if(this.deathWasEncounter&&encounter){this.setRoom('dispatch','dispatch.from.arena');this.pendingProduct={productId:encounter.productId,encounterId:encounter.encounterId};this.emit({type:'product-approach',...this.pendingProduct});this.paused=true;}else {const a=this.progress.checkpoint;this.setRoom(String(a.props.roomId||'arrival'),null,false);this.player=this.freshPlayer(a);this.player.invulnerable=2;}this.health=3;this.deadClock=null;this.renderWorld(0,true);this.notifyHealth('alive');}
 private notifyHealth(state:'alive'|'hurt'|'dead'|'respawning'){this.emit({type:'health',health:this.health,maximum:3,state,checkpointId:this.progress?.snapshot().checkpointId||'anchor.home'});}
 private notifyCombat(){const b=this.population?.bossState||{active:false,health:0,maximumHealth:0,phase:'none'},key=`${b.active}|${b.health}|${this.health}|${b.phase}`;if(key!==this.lastCombat){this.lastCombat=key;this.emit({type:'combat',active:b.active,playerHealth:this.health,bossHealth:b.health,maximumBossHealth:b.maximumHealth,phase:b.phase});}}

 private point(o:MapObject){if(o.kind==='cable')return this.bridges.get(String(o.props.target))?.cutPoint||{x:o.x,y:o.y};if(o.kind==='map')return this.physicalMap?.point||{x:o.x,y:o.y-34};if(o.kind==='lift')return{x:o.x,y:this.lifts.get(o.id)?.positionY??o.y};return{x:o.x,y:o.y};}
 private eligible(o:MapObject){if(o.props.roomId!==this.currentRoom.id||['bridge','mob'].includes(o.kind))return false;if(o.kind==='map')return this.physicalMap?.state==='settled'?this.physicalMap.canInspect(this.player):Math.abs(this.player.x-this.point(o).x)<85&&Math.abs(this.player.y-o.y)<60;if(o.kind==='cable')return this.bridges.get(String(o.props.target))?.canInteract(this.player)||false;if(o.kind==='shortcut'&&this.progress.hasShortcut(String(o.props.shortcutId)))return false;return Math.abs(this.player.x-o.x)<(o.kind==='gallery'?110:68)&&Math.abs(this.player.y-this.point(o).y)<65;}
 private promptFor(o:MapObject):{label:string;action:'E'|'Slash'|'E / Slash'}{switch(o.kind){case'door':return{label:o.props.requiresShortcut&&!this.progress.hasShortcut(String(o.props.requiresShortcut))?'Released from gallery':String(o.props.label||'Enter'),action:'E'};case'map':return{label:this.physicalMap?.state==='settled'?'Map':'Release map',action:this.physicalMap?.state==='settled'?'E':'Slash'};case'cable':return{label:'Cut fastening',action:'Slash'};case'product':return{label:'Downloads',action:'E'};case'resident':return{label:o.props.service==='account'?'dex account':'Treasury',action:'E'};case'gallery':return{label:String(o.props.label||'Inspect'),action:'E'};case'shortcut':return{label:'Release return lift',action:'E'};case'lift':{const kit=this.lifts.get(o.id);return{label:kit?.state.startsWith('docked')?'Ride lift':'Lift moving',action:'E'};}case'landing':return{label:'Summon lift',action:'E'};case'donate':return{label:'Donate',action:'E'};case'file':return{label:o.props.section==='illustrations'?'Collection':'Read',action:'E'};case'terminal':return{label:'Archive',action:'E'};default:return{label:'Inspect',action:'E'};}}
 private updatePrompt(){let nearest:MapObject|null=null,distance=Infinity;for(const o of this.map.objects)if(this.eligible(o)){const d=Math.abs(this.point(o).x-this.player.x);if(d<distance){nearest=o;distance=d;}}this.nearest=nearest;for(const a of this.assemblies.values())a.highlighted=a.source.id===nearest?.id;const prompt=nearest?this.promptFor(nearest):{label:'',action:'E' as const};const key=JSON.stringify([nearest?.id,prompt]);if(key!==this.lastPrompt){this.lastPrompt=key;this.emit({type:'prompt',...prompt,visible:!!nearest});}}
 private interact(){this.updatePrompt();const o=this.nearest;if(!o)return;if(o.kind==='door'){this.useDoor(o);return;}if(o.kind==='map'){if(this.physicalMap?.state==='settled')this.inspectMap();return;}if(o.kind==='cable')return;if(o.kind==='shortcut'){this.progress.shortcut(String(o.props.shortcutId));this.lifts.get(String(o.props.target))?.restoreDock('upper');this.effect('hit-metal','shortcut-release');return;}if(o.kind==='lift'){this.lifts.get(o.id)?.ride();return;}if(o.kind==='landing'){this.lifts.get(String(o.props.target))?.summon(o.props.stop==='upper'?'upper':'lower');return;}this.inspect(o);}
 private inspect(o:MapObject){this.beginInspection(o.id);this.clearInputs();const p=this.player;if(p.grounded&&p.attack<0&&p.hurt<=0){if(Math.abs(o.x-p.x)>1)p.facing=o.x>p.x?1:-1;p.clip='idle';p.clipTime=0;this.footContact=-1;}this.paused=true;if(o.kind==='product'){this.pendingProduct={productId:String(o.props.productId),encounterId:String(o.props.encounterId)};this.emit({type:'product-approach',...this.pendingProduct});return;}if(o.props.service){this.emit({type:'service',service:o.props.service as 'account'|'treasury'|'donate',objectId:o.id});return;}const section=o.props.section as Section;if(section){const itemId=typeof o.props.itemId==='string'?o.props.itemId:undefined;if(itemId)this.progress.discoverContent(itemId);this.effect(o.kind==='file'?'paper-open':'confirm','inspect:'+o.id);this.emit({type:'navigate',section,itemId,entryMode:'world-prop'});}}
 private inspectMap(){if(!this.physicalMap?.canInspect(this.player))return;this.clearInputs();this.paused=true;this.emit({type:'map-inspect',mapId:this.physicalMap.id,roomId:this.currentRoom.id,discoveredRooms:this.progress.snapshot().discoveredRooms});}
 private strike(){const p=this.player;if(this.currentRoom.id==='junction'&&this.physicalMap?.canCut(p)&&!p.attackHits.has(this.physicalMap.id)){this.physicalMap.sever(p);this.progress.cut('cut.map.junction');p.attackHits.add(this.physicalMap.id);this.effect('cable-cut','map-cut');this.hitStop=.025;}
  for(const o of this.map.objects)if(o.props.roomId===this.currentRoom.id&&o.kind==='cable'&&!p.attackHits.has(o.id)){const bridge=this.bridges.get(String(o.props.target));if(bridge?.trySever(p))p.attackHits.add(o.id);}this.population.strike(p);
 }
 private heroDuration(name:string){const clip=this.heroAssets.clips[name];return(clip?.durations||Array(clip?.frames||1).fill(80)).reduce((a:number,b:number)=>a+b,0)/1000;}
 private updateHeroClip(dt:number){const p=this.player,next=p.hurt>0?'hit':p.attack>=0?'attack1':p.dash>0?'run':!p.grounded?(p.vy<0?'jump':'fall'):Math.abs(p.vx)>8?'run':'idle';if(next!==p.clip){p.clip=next;p.clipTime=0;this.footContact=-1;}else p.clipTime+=dt;if(next==='run'&&p.grounded&&p.dash===0){const contact=Math.floor((p.clipTime-.08)/.32);if(contact>=0&&contact!==this.footContact){this.footContact=contact;const support=this.activeSolids().find(s=>s.id===p.support),material=support?.props.material==='metal'?'metal':'concrete';if(this.lastFootX===null||Math.abs(p.x-this.lastFootX)>=22){this.lastFootX=p.x;this.effect(`step-${material}-${++this.footOrdinal%2?1:2}`,'foot:'+p.support);}}}else if(next==='run')this.footContact=Math.floor((p.clipTime-.08)/.32);else this.footContact=-1;}

 private renderWorld(dt:number,immediate=false){if(!this.player||!this.environment)return;const p=this.player,cam=this.cameras.main,bounds={left:this.currentRoom.x,right:this.currentRoom.x+this.currentRoom.width};const f=cameraFrame(this.scale.width,this.scale.height,p.x,p.y,this.map.width,false,bounds);cam.setZoom(f.zoom);this.sky.setScale(1/f.zoom).setPosition((f.zoom-1)*this.scale.width/(2*f.zoom),(f.zoom-1)*this.scale.height/(2*f.zoom));const blend=immediate||this.reducedMotion?1:1-Math.exp(-dt*4.2);cam.scrollX=Math.round(Phaser.Math.Linear(cam.scrollX,f.scrollX,blend));cam.scrollY=Math.round(Phaser.Math.Linear(cam.scrollY,f.scrollY,blend));
  const left=cam.scrollX+(this.scale.width-f.viewW)/2,top=cam.scrollY+(this.scale.height-f.viewH)/2;this.environment.update(this.clock,left,top,f.viewW,f.viewH,this.reducedMotion,this.quality);
  this.hero.setPosition(Math.round(p.x),Math.round(p.y)).setFlipX(p.facing<0).setAlpha(p.invulnerable>0?.75:1);const clip=this.heroAssets.clips[p.clip]||this.heroAssets.clips.idle,times=clip.durations||Array(clip.frames).fill(80),total=times.reduce((a:number,b:number)=>a+b,0);let time=(p.clip==='attack1'?Math.max(0,p.attack):p.clipTime)*1000;if(['idle','run'].includes(p.clip))time%=total;else time=Math.min(time,total-1);let frame=0;while(frame<times.length-1&&time>=times[frame]){time-=times[frame];frame++;}this.hero.setTexture('hero:'+p.clip,p.dash>0?2:frame);
  for(const a of this.assemblies.values()){const hidden=['bridge','cable','lift'].includes(a.source.kind)&&!!(this.bridges.get(a.source.id)||this.bridges.get(String(a.source.props.target))||this.lifts.get(a.source.id));a.root.setVisible(a.source.props.roomId===this.currentRoom.id&&!hidden);if(a.root.visible)paintAssembly(a,this.clock,this.reducedMotion,1,this.presentationTime);}
  for(const[id,b]of this.bridges)b.root.setVisible(this.map.objects.find(o=>o.id===id)?.props.roomId===this.currentRoom.id);
  for(const[id,l]of this.lifts)l.root.setVisible(this.map.objects.find(o=>o.id===id)?.props.roomId===this.currentRoom.id);
  for(const d of this.doors.values()){d.setVisible(d.source.props.roomId===this.currentRoom.id);if(!this.transition)d.update(dt,this.reducedMotion);}
  this.physicalMap?.setVisible(this.currentRoom.id==='junction');this.effects.clear();if(this.airJumpMark){const m=this.airJumpMark;this.effects.fillStyle(C.paper,.6).fillRect(Math.round(m.x)-7,Math.round(m.y),4,2).fillRect(Math.round(m.x)+3,Math.round(m.y),4,2);}
  for(const f of this.fragments)this.effects.fillStyle(f.color,Math.min(1,f.life*4)).fillRect(Math.round(f.x),Math.round(f.y),2,2);
  this.ghosts?.setLocal(this.pose(false));this.ghosts?.update(dt);this.publishProjection();
 }
 private screenPoint(x:number,y:number){const c=this.cameras.main,left=c.scrollX+(this.scale.width-this.scale.width/c.zoom)/2,top=c.scrollY+(this.scale.height-this.scale.height/c.zoom)/2;return{x:Math.round((x-left)*c.zoom),y:Math.round((y-top)*c.zoom)};}
 private galleryProjection():WorldProjection['exhibits']{if(this.currentRoom.id!=='gallery')return[];const entries:WorldProjection['exhibits']=[];for(const a of this.assemblies.values()){if(a.source.kind!=='gallery'||a.source.props.roomId!==this.currentRoom.id||!a.artLayout?.screen)continue;const box=a.artLayout.screen,point=this.screenPoint(a.source.x+a.artLayout.x+box.x,a.y+a.artLayout.y+box.y),width=box.width*this.cameras.main.zoom,height=box.height*this.cameras.main.zoom;if(point.x+width<=0||point.x>=this.scale.width||point.y+height<=0||point.y>=this.scale.height)continue;entries.push({id:a.source.id,itemId:String(a.source.props.itemId),...point,width,height});}return entries;}
 private publishProjection(){const projection:WorldProjection={type:'projection',width:this.scale.width,height:this.scale.height,exhibits:this.galleryProjection()};if(this.nearest){const point=this.point(this.nearest);projection.promptAnchor=this.screenPoint(point.x,point.y-(this.nearest.kind==='map'?18:70));}if(projection.exhibits.length){const scale=this.heroAssets.scale||1,z=this.cameras.main.zoom,foot=this.screenPoint(Math.round(this.player.x),Math.round(this.player.y));projection.hero={x:foot.x-this.heroAssets.footX*scale*z,y:foot.y-this.heroAssets.footY*scale*z,width:200*scale*z,height:200*scale*z,frame:Number(this.hero.frame.name),clip:this.player.clip,flip:this.player.facing<0};}const key=JSON.stringify(projection);if(key!==this.lastProjection){this.lastProjection=key;this.emit(projection);}}
 private dynamicSupports(){const states:Record<string,string>={};if(this.currentRoom.id==='reservoir')states['bridge.reservoir']=this.bridges.get('bridge.reservoir')?.state||'held';if(this.currentRoom.id==='return-shaft'){const lift=this.lifts.get('lift.gallery-return');states['lift.gallery-return']=!this.progress.hasShortcut('shortcut.gallery-return')?'locked':lift?.state==='docked_lower'?'lower':lift?.state==='docked_upper'?'upper':'moving:'+Math.round(lift?.positionY||1500);}return states;}
 private pose(moving:boolean):WorldPose{const p=this.player,lift=p.support&&this.lifts.get(p.support);return{roomId:this.currentRoom.id,worldRevision:WORLD_REVISION,geometryKey:this.currentRoom.geometryKey,supportKey:lift?p.support+'@'+Math.round(lift.positionY):p.support||'',x:p.x,y:p.y,facing:p.facing,clip:p.clip,frame:Number(this.hero.frame.name)||0,grounded:p.grounded,sequence:this.sequence,active:this.focused&&!this.paused&&this.deadClock===null&&!this.transition&&!this.pendingRoom,moving,dynamicSupports:this.dynamicSupports()};}
 private publishPose(dt:number){this.poseClock+=dt;if(this.poseClock<.1)return;this.poseClock=0;const p=this.player,moving=(this.held.has('left')||this.held.has('right')||this.held.has('jump'))&&Math.hypot(p.x-this.lastPoseX,p.y-this.lastPoseY)>.5;this.lastPoseX=p.x;this.lastPoseY=p.y;this.sequence++;this.emit({type:'pose',pose:this.pose(moving)});}
 snapshot(){if(!this.initialized)return{ready:false};const p=this.player,c=this.cameras.main;return{ready:true,resources:this.resources.snapshot(),pendingRoom:this.pendingRoom,inspectionSource:this.inspectedSource,presentationTime:this.presentationTime,version:WORLD_REVISION,roomId:this.currentRoom.id,focused:this.focused,paused:this.paused,region:this.region,stepCount:this.stepCount,player:{x:p.x,y:p.y,vx:p.vx,vy:p.vy,grounded:p.grounded,support:p.support,health:this.health,airJumpAvailable:p.airJump,jumpCount:p.jumpCount,airJumpCount:p.airJumpCount,coyote:p.coyote,clip:p.clip,frame:this.hero.frame.name,attack:p.attack,facing:p.facing,screen:this.screenPoint(p.x,p.y)},camera:{x:c.scrollX,y:c.scrollY,zoom:c.zoom,width:this.scale.width,height:this.scale.height},banner:{open:this.physicalMap?.state==='settled',amount:this.physicalMap?.kit.openAmount||0},mapState:this.physicalMap?.state,transition:this.transition,progress:this.progress.snapshot(),pose:this.pose(false),ghosts:this.ghosts.snapshot(),prompt:this.nearest?{id:this.nearest.id,...this.promptFor(this.nearest),anchor:this.point(this.nearest)}:null,assemblies:[...this.assemblies].map(([id,a])=>({id,kind:a.source.kind,state:a.state,presentationAmount:a.panelVisual?.amount||0,coverHeight:a.nativeArt?.parts['folder-cover']?.visibleHeight,x:a.source.x,y:a.y,occupied:a.occupied,targetY:a.targetY})),mechanisms:{bridges:[...this.bridges.values()].map(b=>b.snapshot()),lifts:[...this.lifts.values()].map(l=>l.snapshot())},population:this.population.snapshot(),boss:this.population.bossState,encounter:this.encounter,health:this.health,defeatPresentation:this.deadClock,audioEffects:{counts:{...this.effectCounts},recent:this.recentEffects},assets:{hero:'luizmelo.martial-hero',heroBodyHeight:this.heroAssets.bodyHeight,sceneAssets:this.sceneAssets.assets.length},environment:this.environment.snapshot(),settings:{reducedMotion:this.reducedMotion,quality:this.quality}};}
}
