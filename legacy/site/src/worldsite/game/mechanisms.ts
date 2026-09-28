import Phaser from 'phaser';
import { PALETTE as C, type AssetRect } from './assets';
import { assemblyAsset, nativePart, nativeIndicator, nativeArtSnapshot, type NativeAssemblyArt, type NativeAssemblyPart } from './assemblyArt';

export interface MechanismPoint { x:number; y:number }
export interface MechanismActor extends MechanismPoint { facing:1|-1; bodyCenterOffset?:number }
export interface MechanismSurface { id:string; x:number; y:number; width:number; height:number; kind:'oneway' }
export interface MechanismStep { paused?:boolean; reducedMotion?:boolean; occupied?:boolean }
export interface MechanismEvent { id:string; type:'cut'|'impact'|'settled'|'latch'|'opened'|'closed'|'drive-start'|'docked'; point?:MechanismPoint }
type EventSink=(event:MechanismEvent)=>void;
const rad=Phaser.Math.DegToRad,clamp=Phaser.Math.Clamp;
const point=(x:number,y:number):MechanismPoint=>({x,y});
const rotated=(p:MechanismPoint,angle:number)=>point(p.x*Math.cos(rad(angle))-p.y*Math.sin(rad(angle)),p.x*Math.sin(rad(angle))+p.y*Math.cos(rad(angle)));
const plus=(a:MechanismPoint,b:MechanismPoint)=>point(a.x+b.x,a.y+b.y);
const mix=(a:MechanismPoint,b:MechanismPoint,t:number)=>point(Phaser.Math.Linear(a.x,b.x,t),Phaser.Math.Linear(a.y,b.y,t));
const distance=(a:MechanismPoint,b:MechanismPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const freshArt=():NativeAssemblyArt=>({parts:{},missing:[]});

/** Same directional slash envelope as the world; E measures the body, not feet. */
export function mechanismReach(actor:MechanismActor,target:MechanismPoint,action:'slash'|'interact') {
 const dx=target.x-actor.x,dy=target.y-(actor.y-(actor.bodyCenterOffset??24));
 return action==='slash'?dx*actor.facing>=-10&&dx*actor.facing<90&&Math.abs(dy)<60:Math.abs(dx)<67&&Math.abs(dy)<58;
}
function pixelEye(g:Phaser.GameObjects.Graphics){
 g.clear().fillStyle(C.deep).fillRect(-5,-3,10,6).fillRect(-3,-5,6,10);
 g.fillStyle(C.concrete).fillRect(-4,-2,2,4).fillRect(2,-2,2,4).fillRect(-2,-4,4,2).fillRect(-2,2,4,2);
 g.fillStyle(C.paper).fillRect(-2,-4,3,1);g.fillStyle(C.deep).fillRect(-2,-2,4,4);
}
function fiber(g:Phaser.GameObjects.Graphics,points:MechanismPoint[],color=0xb7b69b){
 g.lineStyle(3,C.deep,1).beginPath();points.forEach((p,i)=>i?g.lineTo(Math.round(p.x),Math.round(p.y)):g.moveTo(Math.round(p.x),Math.round(p.y)));g.strokePath();
 g.lineStyle(1,color,1).beginPath();points.forEach((p,i)=>i?g.lineTo(Math.round(p.x),Math.round(p.y)):g.moveTo(Math.round(p.x),Math.round(p.y)));g.strokePath();
}
function cappedHorizontal(scene:Phaser.Scene,root:Phaser.GameObjects.Container,art:NativeAssemblyArt,name:string,id:string,width:number,x=0,y=0,cap=16){
 const asset=assemblyAsset(scene,id);if(!asset)throw Error(`Mechanism asset missing: ${id}`);
 if(!Number.isInteger(width)||width<cap*2||asset.width<=cap*2)throw Error('Invalid native capped span');
 const add=(suffix:string,crop:AssetRect,px:number)=>nativePart(scene,root,art,name+suffix,id,px,y,crop);
 add(':left',{x:0,y:0,width:cap,height:asset.height},x);
 let remaining=width-cap*2,at=x+cap,index=0;
 while(remaining>0){const count=Math.min(remaining,asset.width-cap*2);add(':middle:'+index++,{x:cap,y:0,width:count,height:asset.height},at);remaining-=count;at+=count}
 add(':right',{x:asset.width-cap,y:0,width:cap,height:asset.height},x+width-cap);
}
function nativeColumn(scene:Phaser.Scene,root:Phaser.GameObjects.Container,art:NativeAssemblyArt,name:string,id:string,crop:AssetRect,height:number,x:number,y:number){
 for(let at=0,index=0;at<height;index++){
  const span=Math.min(crop.height,height-at);nativePart(scene,root,art,name+':'+index,id,x,y+at,{...crop,height:span});at+=span;
 }
}
/** Short native metal member: preserved caps, quiet face, original edge pixels. */
function metalMember(scene:Phaser.Scene,root:Phaser.GameObjects.Container,art:NativeAssemblyArt,name:string,width:number,x:number,y:number){
 if(width<36)throw Error('Native metal member must retain both18px end plates');
 const rows=[{sourceY:11,height:3,y:0},{sourceY:20,height:11,y:3},{sourceY:44,height:3,y:14}];
 for(const [rowIndex,row] of rows.entries()){
  nativePart(scene,root,art,`${name}:left:${rowIndex}`,'FG05',x,y+row.y,{x:0,y:row.sourceY,width:18,height:row.height});
  for(let at=18,index=0;at<width-18;index++){
   const span=Math.min(72,width-18-at);nativePart(scene,root,art,`${name}:face:${rowIndex}:${index}`,'FG05',x+at,y+row.y,{x:20,y:row.sourceY,width:span,height:row.height});at+=span;
  }
  nativePart(scene,root,art,`${name}:right:${rowIndex}`,'FG05',x+width-18,y+row.y,{x:382,y:row.sourceY,width:18,height:row.height});
 }
}
function fixedGuide(scene:Phaser.Scene,root:Phaser.GameObjects.Container,art:NativeAssemblyArt,name:string,height:number,center:number,y:number){
 nativePart(scene,root,art,name+':head','P10',center-10,y,{x:0,y:0,width:21,height:14});
 nativeColumn(scene,root,art,name+':shaft','P10',{x:0,y:60,width:21,height:86},height-28,center-10,y+14);
 nativePart(scene,root,art,name+':foot','P10',center-10,y+height-14,{x:0,y:306,width:21,height:14});
}

export interface HingedBridgeOptions {
 id:string; hinge:MechanismPoint; length?:number; raisedAngle?:number; deckEye?:MechanismPoint; fixedEye?:MechanismPoint; cutFraction?:number; depth?:number; onEvent?:EventSink;
}
/** A fixed bearing and mounting frame, one rigid deck, and two anchored fibers. */
export class HingedBridge {
 readonly root:Phaser.GameObjects.Container;
 readonly id:string;readonly hinge:MechanismPoint;readonly length:number;
 private deck:Phaser.GameObjects.Container;private rope:Phaser.GameObjects.Graphics;
 private fixedHardware:Phaser.GameObjects.Graphics;private deckHardware:Phaser.GameObjects.Graphics;
 private art=freshArt();private angle:number;private elapsed=0;private reduced=false;
 private phase:'held'|'severed'|'lowering'|'settling'|'settled'='held';
 private readonly raisedAngle:number;private readonly localEye:MechanismPoint;private readonly ceilingEye:MechanismPoint;private readonly fraction:number;private readonly event?:EventSink;
 private readonly severDelay=.08;private readonly lowerDuration=.62;private readonly settleDuration=.14;
 constructor(scene:Phaser.Scene,options:HingedBridgeOptions){
  this.id=options.id;this.hinge={...options.hinge};this.length=options.length??192;this.raisedAngle=options.raisedAngle??-50;this.angle=this.raisedAngle;
  // The native CC0 contact frames reach this eye at the default grounded approach.
  this.localEye={...(options.deckEye??point(72,0))};this.ceilingEye={...(options.fixedEye??point(-24,-130))};this.fraction=options.cutFraction??.9;this.event=options.onEvent;
  if(this.fraction<=0||this.fraction>=1)throw Error('Cut must be between the two hardware anchors');
  this.root=scene.add.container(this.hinge.x,this.hinge.y).setDepth(options.depth??10).setName('mechanism:'+this.id);
  const mast=assemblyAsset(scene,'P21');
  const mastEye=(mast?.metadata?.attachments as {fixedEye?:MechanismPoint}|undefined)?.fixedEye;
  if(!mastEye)throw Error('Bridge mast attachment unavailable');
  // The generated native mast owns the visible metal body. Its measured eye
  // registers to the existing fixed rope point; kinematics never follow art.
  nativePart(scene,this.root,this.art,'fixed-mast','P21',this.ceilingEye.x-mastEye.x,this.ceilingEye.y-mastEye.y);
  nativePart(scene,this.root,this.art,'receiver-plate','FG05',this.length,1,{x:382,y:11,width:18,height:30});
  nativePart(scene,this.root,this.art,'receiver-lug','P04',this.length+8,7,{x:10,y:28,width:7,height:24});
  this.deck=scene.add.container(0,0).setName('mechanism:'+this.id+':rigid-deck');this.root.add(this.deck);
  cappedHorizontal(scene,this.deck,this.art,'deck','P07',this.length);
  this.rope=scene.add.graphics();this.root.add(this.rope);
  // P21 includes the fixed socket. This invisible transform records that same
  // registered point for diagnostics without covering it with a flat icon.
  this.fixedHardware=scene.add.graphics().setPosition(this.ceilingEye.x,this.ceilingEye.y).setVisible(false);this.root.add(this.fixedHardware);
  this.deckHardware=scene.add.graphics();pixelEye(this.deckHardware);this.root.add(this.deckHardware);
  const pivot=assemblyAsset(scene,'P08')?.metadata?.attachments?.pivot??point(13,31);
  nativePart(scene,this.root,this.art,'fixed-bearing','P08',-pivot.x,-pivot.y);
  this.render(false);
 }
 get state(){return this.phase}
 get deckAngle(){return this.displayAngle}
 get isSettled(){return this.phase==='settled'}
 get cutPoint(){const raised=rotated(this.localEye,this.raisedAngle);return plus(this.hinge,mix(this.ceilingEye,raised,this.fraction))}
 get collisionSurface():MechanismSurface|null{return this.phase==='settled'?{id:this.id,x:this.hinge.x,y:this.hinge.y,width:this.length,height:8,kind:'oneway'}:null}
 canInteract(actor:MechanismActor){return this.phase==='held'&&mechanismReach(actor,this.cutPoint,'interact')}
 canSlash(actor:MechanismActor){return this.phase==='held'&&mechanismReach(actor,this.cutPoint,'slash')}
 trySever(actor:MechanismActor){if(!this.canSlash(actor))return false;this.phase='severed';this.elapsed=0;this.event?.({id:this.id,type:'cut',point:this.cutPoint});this.render(false);return true}
 update(seconds:number,options:MechanismStep={}){
  if(options.paused)return;
  this.reduced=!!options.reducedMotion;
  const previous=this.phase;
  if(this.phase!=='held'&&this.phase!=='settled'){
   this.elapsed+=clamp(seconds,0,.1);
   const moveTime=this.elapsed-this.severDelay;
   if(moveTime<0)this.phase='severed';
   else if(moveTime<this.lowerDuration){this.phase='lowering';const p=moveTime/this.lowerDuration;this.angle=this.raisedAngle*(1-p*p)}
   else if(moveTime<this.lowerDuration+this.settleDuration){this.phase='settling';const p=(moveTime-this.lowerDuration)/this.settleDuration;this.angle=options.reducedMotion?0:-1.25*Math.sin(Math.PI*p)}
   else {this.phase='settled';this.angle=0}
   if(previous!=='settling'&&this.phase==='settling')this.event?.({id:this.id,type:'impact',point:plus(this.hinge,point(this.length,0))});
   if(previous!=='settled'&&this.phase==='settled')this.event?.({id:this.id,type:'settled',point:plus(this.hinge,point(this.length,0))});
  }else if(this.phase==='settled')this.elapsed+=clamp(seconds,0,.1);
  this.render(!!options.reducedMotion);
 }
 private fibers(reduced:boolean){
  const eye=rotated(this.localEye,this.displayAngle),heldEye=rotated(this.localEye,this.raisedAngle),cut=mix(this.ceilingEye,heldEye,this.fraction);
  if(this.phase==='held')return {upper:[this.ceilingEye,cut],lower:[cut,eye],eye};
  const upperLength=distance(this.ceilingEye,cut),lowerLength=distance(cut,heldEye),t=this.elapsed;
  const upperStart=Math.atan2(cut.y-this.ceilingEye.y,cut.x-this.ceilingEye.x);
  const upperAngle=reduced?Math.PI/2:Math.PI/2+(upperStart-Math.PI/2)*Math.exp(-t*3.8)*Math.cos(t*7);
  const upperEnd=plus(this.ceilingEye,point(Math.cos(upperAngle)*upperLength,Math.sin(upperAngle)*upperLength));
  const lowerStart=Math.atan2(cut.y-heldEye.y,cut.x-heldEye.x),delta=Phaser.Math.Angle.Wrap(lowerStart-Math.PI/2);
  const lowerAngle=reduced?Math.PI/2:Math.PI/2+delta*Math.exp(-t*6)*Math.cos(t*9);
  const lowerEnd=plus(eye,point(Math.cos(lowerAngle)*lowerLength,Math.sin(lowerAngle)*lowerLength));
  return {upper:[this.ceilingEye,mix(this.ceilingEye,upperEnd,.55),upperEnd],lower:[eye,lowerEnd],eye};
 }
 private get displayAngle(){return this.phase==='settled'?0:Math.round(this.angle*2)/2}
 private render(reduced:boolean){
  this.deck.setAngle(this.displayAngle);const rope=this.fibers(reduced);this.rope.clear();fiber(this.rope,rope.upper);fiber(this.rope,rope.lower);
  this.deckHardware.setPosition(rope.eye.x,rope.eye.y).setAngle(this.displayAngle);
  if(this.phase==='held'){const k=rope.upper.at(-1)!;this.rope.fillStyle(C.signal).fillRect(Math.round(k.x)-3,Math.round(k.y)-4,6,8);this.rope.fillStyle(C.paper).fillRect(Math.round(k.x)-2,Math.round(k.y)-3,1,3)}
  else for(const end of [rope.upper.at(-1)!,rope.lower.at(-1)!])this.rope.fillStyle(C.signal).fillRect(Math.round(end.x)-1,Math.round(end.y)-1,3,2);
 }
 restoreSettled(){this.phase='settled';this.elapsed=2;this.angle=0;this.render(true)}
 reset(){this.phase='held';this.elapsed=0;this.angle=this.raisedAngle;this.reduced=false;this.render(false)}
 destroy(){this.root.destroy(true)}
 snapshot(){const rope=this.fibers(this.reduced),matrix=(g:Phaser.GameObjects.Graphics)=>{const m=g.getWorldTransformMatrix();return point(m.tx,m.ty)};return {id:this.id,phase:this.phase,elapsed:this.elapsed,angle:this.angle,displayAngle:this.displayAngle,length:this.length,hinge:{...this.hinge},fixedEye:plus(this.hinge,this.ceilingEye),deckEye:plus(this.hinge,rope.eye),cutPoint:this.cutPoint,actualHardware:{fixedEye:matrix(this.fixedHardware),deckEye:matrix(this.deckHardware)},rope:{upper:rope.upper.map(p=>plus(this.hinge,p)),lower:rope.lower.map(p=>plus(this.hinge,p)),upperLength:distance(this.ceilingEye,mix(this.ceilingEye,rotated(this.localEye,this.raisedAngle),this.fraction)),lowerLength:distance(mix(this.ceilingEye,rotated(this.localEye,this.raisedAngle),this.fraction),rotated(this.localEye,this.raisedAngle))},collision:this.collisionSurface,nativeArt:nativeArtSnapshot(this.art)}}
}

export interface LatchedBannerOptions {id:string;x:number;floorY:number;depth?:number;onEvent?:EventSink}
/** Tile each of nine source regions at scale1; preserve the authored cloth border. */
function nativeCloth(scene:Phaser.Scene,root:Phaser.GameObjects.Container,art:NativeAssemblyArt,x:number,y:number,width:number,height:number){
 const asset=assemblyAsset(scene,'P17');if(!asset)throw Error('Banner cloth unavailable');
 const border=12,parts:NativeAssemblyPart[]=[];
 const xs=[{source:0,size:border,span:border},{source:border,size:asset.width-border*2,span:width-border*2},{source:asset.width-border,size:border,span:border}];
 const ys=[{source:0,size:border,span:border},{source:border,size:asset.height-border*2,span:height-border*2},{source:asset.height-border,size:border,span:border}];
 let dy=0,index=0;
 for(const row of ys){let dx=0;for(const column of xs){for(let py=0;py<row.span;py+=row.size)for(let px=0;px<column.span;px+=column.size){const part=nativePart(scene,root,art,'cloth:'+index++,'P17',x+dx+px,y+dy+py,{x:column.source,y:row.source,width:Math.min(column.size,column.span-px),height:Math.min(row.size,row.span-py)});if(!part)throw Error('Invalid native banner slice');parts.push(part)}dx+=column.span}dy+=row.span}
 return parts;
}
/** Reusable strike latch: cloth is never severed or magically repaired by Close. */
export class LatchedBanner {
 readonly root:Phaser.GameObjects.Container;readonly id:string;
 private art=freshArt();private amount=0;private target=0;private phase:'latched'|'opening'|'open'|'closing'='latched';
 private latch:Phaser.GameObjects.Graphics;private cloth:NativeAssemblyPart[];private weight:Phaser.GameObjects.Container;
 private readonly clothX=-160;private readonly clothY=-375;private readonly clothWidth=320;private readonly clothHeight=368;private elapsed=0;
 constructor(scene:Phaser.Scene,private options:LatchedBannerOptions){
  this.id=options.id;this.root=scene.add.container(options.x,options.floorY).setDepth(options.depth??10).setName('mechanism:'+this.id);
  // Native signal-post stem material supplies the pole; its independent base,
  // cap and latch housing retain their own dimensions instead of stretching.
  nativeColumn(scene,this.root,this.art,'pole-shaft','P04',{x:10,y:28,width:7,height:78},387,-179,-393);
  nativePart(scene,this.root,this.art,'pole-foot','P04',-189,-6,{x:0,y:106,width:27,height:6});
  nativePart(scene,this.root,this.art,'pole-head','P10',-186,-395,{x:0,y:0,width:21,height:8});
  nativePart(scene,this.root,this.art,'latch-housing','P10',-178,-39,{x:0,y:50,width:21,height:10});
  const fixed=scene.add.graphics();this.root.add(fixed);
  fixed.lineStyle(1,C.ink).lineBetween(-168,this.clothY-4,-168,-45);
  this.cloth=nativeCloth(scene,this.root,this.art,this.clothX,this.clothY,this.clothWidth,this.clothHeight);
  this.weight=scene.add.container(0,this.clothY).setName('mechanism:'+this.id+':weight');this.root.add(this.weight);
  cappedHorizontal(scene,this.weight,this.art,'weight','P18',this.clothWidth,this.clothX,0,12);
  cappedHorizontal(scene,this.root,this.art,'roller','P16',345,-172,this.clothY-12,12);
  this.latch=scene.add.graphics().setPosition(-168,-34);this.root.add(this.latch);this.render();
 }
 get state(){return this.phase}
 get openAmount(){return this.amount}
 get interactionPoint(){return point(this.options.x-168,this.options.floorY-34)}
 get surfaceRect(){return {x:this.options.x+this.clothX,y:this.options.floorY+this.clothY,width:this.clothWidth,height:this.clothHeight,visibleFraction:this.amount}}
 get contentRect(){return {x:this.options.x+this.clothX+12,y:this.options.floorY+this.clothY+12,width:this.clothWidth-24,height:this.clothHeight-24,visibleFraction:this.amount}}
 canInteract(actor:MechanismActor){return this.phase==='latched'&&mechanismReach(actor,this.interactionPoint,'interact')}
 tryRelease(actor:MechanismActor,action:'slash'|'interact'='slash'){if(this.phase!=='latched'||!mechanismReach(actor,this.interactionPoint,action))return false;this.target=1;this.phase='opening';this.elapsed=0;this.options.onEvent?.({id:this.id,type:'latch',point:this.interactionPoint});return true}
 close(){if(this.target===0)return false;this.target=0;this.phase='closing';this.elapsed=0;return true}
 update(seconds:number,options:MechanismStep={}){if(options.paused)return;const dt=clamp(seconds,0,.1);this.elapsed+=dt;this.amount=options.reducedMotion?this.target:Phaser.Math.Clamp(this.amount+(this.target===1?1:-1)*dt/(this.target===1?.42:.22),0,1);if(this.phase==='opening'&&this.amount===1){this.phase='open';this.options.onEvent?.({id:this.id,type:'opened'})}if(this.phase==='closing'&&this.amount===0){this.phase='latched';this.options.onEvent?.({id:this.id,type:'closed'})}this.render()}
 private render(){const height=Math.round(this.amount*this.clothHeight);for(const part of this.cloth){const shown=clamp(height-(part.y-this.clothY),0,part.sourceRect.height);part.visibleHeight=shown;part.image.setVisible(shown>0);if(shown>0)part.image.setCrop(0,0,part.sourceRect.width,shown)}this.weight.setY(this.clothY+height);const released=this.phase!=='latched';this.latch.clear().fillStyle(C.warm).fillRect(-3,-2,6,2);this.latch.lineStyle(3,C.structure).lineBetween(0,0,released?7:0,released?-4:7);this.latch.lineStyle(1,C.concrete).lineBetween(-1,0,released?6:-1,released?-4:7)}
 restoreOpen(){this.amount=1;this.target=1;this.phase='open';this.elapsed=1;this.render()}
 reset(){this.amount=0;this.target=0;this.phase='latched';this.elapsed=0;this.render()}
 destroy(){this.root.destroy(true)}
 snapshot(){return {id:this.id,phase:this.phase,amount:this.amount,interactionPoint:this.interactionPoint,surfaceRect:this.surfaceRect,contentRect:this.contentRect,clothIntact:true,latchReleased:this.phase!=='latched',weightY:this.options.floorY+this.weight.y,nativeArt:nativeArtSnapshot(this.art)}}
}

export interface RailLiftOptions {id:string;x:number;lowerY:number;upperY:number;width?:number;speed?:number;depth?:number;onEvent?:EventSink}
/** Structural fixed guide frame, attached carriage shoes, and native deck. */
export class RailLift {
 readonly root:Phaser.GameObjects.Container;readonly id:string;readonly width:number;
 private fixed:Phaser.GameObjects.Container;private carriage:Phaser.GameObjects.Container;private shoes:Phaser.GameObjects.Graphics;private lamp:Phaser.GameObjects.Image;
 private art=freshArt();private y:number;private target:number;private phase:'docked_lower'|'engaging'|'moving_up'|'moving_down'|'settling'|'docked_upper'='docked_lower';
 private clock=0;private occupied=false;private readonly railDistance:number;
 constructor(scene:Phaser.Scene,private options:RailLiftOptions){
  if(options.upperY>=options.lowerY)throw Error('Lift upper stop must be above lower stop');
  this.id=options.id;this.width=options.width??192;this.y=options.lowerY;this.target=this.y;this.railDistance=this.width/2+4;
  this.root=scene.add.container(options.x,0).setDepth(options.depth??10).setName('mechanism:'+this.id);this.fixed=scene.add.container(0,0);this.carriage=scene.add.container(0,this.y);this.root.add([this.fixed,this.carriage]);
  const top=options.upperY-52,bottom=options.lowerY+34;
  // Each fixed member is native material, while the complete frame preserves
  // its verified mounts and guide centers. No filled rectangle owns its face.
  const frameLeft=-this.railDistance-18,frameWidth=this.railDistance*2+36;
  metalMember(scene,this.fixed,this.art,'frame-head',frameWidth,frameLeft,top-8);
  metalMember(scene,this.fixed,this.art,'frame-foot',frameWidth,frameLeft,bottom-3);
  for(const side of [-1,1]){
   const center=side*this.railDistance;
   fixedGuide(scene,this.fixed,this.art,'rail:'+side,bottom-top,center,top);
   for(const [index,y] of [top+12,bottom-12].entries())nativePart(scene,this.fixed,this.art,`rail-mount:${side}:${index}`,'P10',center-10,y-5,{x:0,y:50,width:21,height:10});
   const bankY=side<0?options.lowerY:options.upperY,outer=center+side*30;
   metalMember(scene,this.fixed,this.art,'bank-anchor:'+side,36,Math.min(center,outer)-3,bankY+5);
  }
  cappedHorizontal(scene,this.carriage,this.art,'deck','P09',this.width,-this.width/2,0,16);
  cappedHorizontal(scene,this.carriage,this.art,'railing','FG04',this.width,-this.width/2,-28,16);
  for(const side of [-1,1]){
   const center=side*this.railDistance,deckEdge=side*(this.width/2-10);
   nativePart(scene,this.carriage,this.art,'shoe-bracket:'+side,'FG05',Math.min(center,deckEdge)-5,7,{x:0,y:19,width:24,height:13});
   nativePart(scene,this.carriage,this.art,'guide-shoe:'+side,'P10',center-10,3,{x:0,y:146,width:21,height:10});
  }
  this.shoes=scene.add.graphics();this.carriage.add(this.shoes);
  const lamp=nativeIndicator(scene,this.carriage,this.art,'lamp','P11',-this.width/2+11,-43,{x:6,y:2,width:16,height:5});if(!lamp)throw Error('Lift lamp unavailable');this.lamp=lamp.image;
  const stem=scene.add.graphics();this.carriage.addAt(stem,0);stem.fillStyle(C.structure).fillRect(-this.width/2+20,-38,4,14);
  this.render();
 }
 get state(){return this.phase}
 get positionY(){return this.y}
 get targetY(){return this.target}
 get isOccupied(){return this.occupied}
 get collisionSurface():MechanismSurface{return {id:this.id,x:this.options.x-this.width/2,y:this.y,width:this.width,height:8,kind:'oneway'}}
 setOccupied(occupied:boolean){this.occupied=occupied;if(occupied&&this.phase.startsWith('docked'))this.clock=0}
 private request(target:number,fromRider:boolean){if(!this.phase.startsWith('docked')||target===this.y||(!fromRider&&this.occupied))return false;this.target=target;this.phase='engaging';this.clock=0;this.options.onEvent?.({id:this.id,type:'drive-start'});return true}
 ride(){return this.occupied&&this.request(this.y===this.options.lowerY?this.options.upperY:this.options.lowerY,true)}
 summon(stop:'upper'|'lower'){return this.request(stop==='upper'?this.options.upperY:this.options.lowerY,false)}
 update(seconds:number,options:MechanismStep={}){
  if(options.occupied!==undefined)this.setOccupied(options.occupied);if(options.paused)return 0;
  const previous=this.y;this.clock+=clamp(seconds,0,.1);
  if(this.phase==='engaging'&&this.clock>=.16){this.phase=this.target<this.y?'moving_up':'moving_down';this.clock=0}
  if(this.phase==='moving_up'||this.phase==='moving_down'){const step=(this.options.speed??32)*clamp(seconds,0,.1);this.y=this.target<this.y?Math.max(this.target,this.y-step):Math.min(this.target,this.y+step);if(this.y===this.target){this.phase='settling';this.clock=0;this.options.onEvent?.({id:this.id,type:'docked',point:point(this.options.x,this.y)})}}
  if(this.phase==='settling'&&this.clock>=.18){this.phase=this.y===this.options.lowerY?'docked_lower':'docked_upper';this.clock=0}
  if(this.phase==='docked_upper'&&!this.occupied&&this.clock>=8)this.request(this.options.lowerY,false);
  this.render(!!options.reducedMotion);return this.y-previous;
 }
 private render(reduced=false){
  this.carriage.setY(this.y);this.shoes.clear();
  for(const sign of [-1,1]){
   const center=sign*this.railDistance;
   // Two small contact shoes remain a moving mechanical cue, not a painted
   // replacement for the generated bracket and housing above them.
   this.shoes.fillStyle(C.deep).fillRect(center-3,14,6,8);
   this.shoes.fillStyle(C.concrete).fillRect(center-2,14,1,7).fillRect(center+1,14,1,7);
  }
  const active=!this.phase.startsWith('docked');this.lamp.setAlpha(active&&!reduced?.75+.2*Math.sin(this.clock*9):.9);
 }
 restoreDock(stop:'upper'|'lower'){this.y=stop==='upper'?this.options.upperY:this.options.lowerY;this.target=this.y;this.phase=stop==='upper'?'docked_upper':'docked_lower';this.clock=0;this.occupied=false;this.render()}
 reset(){this.y=this.options.lowerY;this.target=this.y;this.phase='docked_lower';this.clock=0;this.occupied=false;this.render()}
 destroy(){this.root.destroy(true)}
 snapshot(){return {id:this.id,phase:this.phase,y:this.y,target:this.target,occupied:this.occupied,width:this.width,collision:this.collisionSurface,railCenters:[this.options.x-this.railDistance,this.options.x+this.railDistance],shoeCenters:[point(this.options.x-this.railDistance,this.y+11),point(this.options.x+this.railDistance,this.y+11)],nativeArt:nativeArtSnapshot(this.art)}}
}
