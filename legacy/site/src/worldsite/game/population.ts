import Phaser from 'phaser';
import {CastActor,type CastManifest} from './cast';
import type {MapObject} from './map';
export interface CombatPlayer {x:number;y:number;facing:1|-1;invulnerable:number;grounded:boolean;attackHits:Set<string>}
type Hit=(amount:number,fromX:number)=>void;
const BOSS_MAX_HEALTH=8;
type Creature={source:MapObject;actor:CastActor;health:number;phase:'sleep'|'patrol'|'attack'|'recovery'|'hurt'|'death'|'gone';clock:number;hit:boolean;fallVelocity?:number;deadGrounded?:boolean};
export class Population {
 private creatures:Creature[]=[];private residents:{source:MapObject;actor:CastActor}[]=[];
 private boss:{actor:CastActor;health:number;phase:'waiting'|'approach'|'attack'|'recovery'|'hurt'|'death';clock:number;hit:boolean;recoveryHit:boolean;pattern:number;targetX:number;sent:boolean}|null=null;
 private roomId='arrival';private shot:Phaser.GameObjects.Graphics;
 private projectiles:{x:number;y:number;vx:number;life:number}[]=[];private assisted=false;
 constructor(private scene:Phaser.Scene,private cast:CastManifest,private objects:MapObject[],private damage:Hit,private effect:(id:'hurt'|'hit-metal'|'telegraph'|'victory',action:string)=>void,private bossDead:()=>void){
  this.shot=scene.add.graphics().setDepth(22);
 }
 ensureRoom(id:string){
  for(const source of this.objects){if(source.props.roomId!==id||!['mob','resident'].includes(source.kind)||this.creatures.some(c=>c.source.id===source.id)||this.residents.some(r=>r.source.id===source.id))continue;
   const definition=this.cast.actors.find(a=>a.id===source.props.actorId);if(!definition)throw Error('Resident/creature asset is missing: '+source.props.actorId);
   const actor=new CastActor(this.scene,definition,source.x,source.y);actor.sprite.setVisible(id===this.roomId);
   if(source.kind==='resident')this.residents.push({source,actor});else this.creatures.push({source,actor,health:Number(source.props.health)||2,phase:'sleep',clock:0,hit:false});
  }
 }
 setRoom(id:string){this.ensureRoom(id);this.roomId=id;this.projectiles=[];for(const c of this.creatures){const visible=c.source.props.roomId===id&&c.phase!=='gone';c.actor.sprite.setVisible(visible);if(visible&&c.phase!=='death'){c.phase='sleep';c.clock=0;c.actor.setClip('idle');}}for(const r of this.residents)r.actor.sprite.setVisible(r.source.props.roomId===id);if(id!=='arena')this.clearBoss();}
 enterBoss(id:string,x:number,y:number,assisted:boolean){this.clearBoss();const definition=this.cast.actors.find(a=>a.id===id);if(!definition)throw Error('The encounter actor could not load.');this.boss={actor:new CastActor(this.scene,definition,x,y),health:BOSS_MAX_HEALTH,phase:'waiting',clock:0,hit:false,recoveryHit:false,pattern:0,targetX:x,sent:false};this.assisted=assisted;}
 clearBoss(){this.boss?.actor.destroy();this.boss=null;this.projectiles=[];this.shot.clear();}
 setAssistance(value:boolean){this.assisted=value;}
 get bossState(){const b=this.boss;return b?{active:true,health:b.health,maximumHealth:BOSS_MAX_HEALTH,phase:b.phase,x:b.actor.x,y:b.actor.y,clip:b.actor.clip,frame:b.actor.frameAt(b.actor.clip,b.actor.clock)}:{active:false,health:0,maximumHealth:0,phase:'none',x:0,y:0,clip:'',frame:0};}
 strike(player:CombatPlayer){
  const reaches=(actor:CastActor)=>Math.abs(actor.y-player.y)<90&&(actor.x-player.x)*player.facing>=-16&&(actor.x-player.x)*player.facing<105;
  for(const c of this.creatures){if(c.source.props.roomId!==this.roomId||['death','gone'].includes(c.phase)||player.attackHits.has(c.source.id)||!reaches(c.actor))continue;player.attackHits.add(c.source.id);c.health--;c.clock=0;c.actor.x=Phaser.Math.Clamp(c.actor.x+player.facing*18,Number(c.source.props.patrolLeft),Number(c.source.props.patrolRight));c.phase=c.health<=0?'death':'hurt';c.actor.setClip(c.phase==='death'?'death':'hurt');this.effect('hit-metal','creature-contact:'+c.source.id);}
  const b=this.boss;if(b&&b.phase==='recovery'&&!b.recoveryHit&&!player.attackHits.has('boss')&&reaches(b.actor)){player.attackHits.add('boss');b.recoveryHit=true;b.health--;b.clock=0;b.phase=b.health<=0?'death':'hurt';b.actor.setClip(b.phase==='death'?'death':'hurt');this.effect('hit-metal','boss-contact');if(b.health<=0){this.projectiles=[];this.effect('victory','boss-defeated');}}
 }
 update(dt:number,player:CombatPlayer){
  for(const r of this.residents)if(r.source.props.roomId===this.roomId){if(Math.abs(player.x-r.actor.x)<200)r.actor.facing=player.x<r.actor.x?-1:1;r.actor.setClip('idle');r.actor.update(dt);}
  for(const c of this.creatures){if(c.source.props.roomId!==this.roomId||c.phase==='gone')continue;c.clock+=dt;const actor=c.actor,dx=player.x-actor.x,flight=actor.definition.role==='flying-mob'||String(c.source.props.actorId).includes('bat');
   if(c.phase==='death'){if(flight&&!c.deadGrounded){c.fallVelocity=(c.fallVelocity||0)+420*dt;actor.y+=c.fallVelocity*dt;actor.setClip(c.clock<.3?'fallStart':'fall');const floor=Number(c.source.props.floorY)||1140;if(actor.y>=floor){actor.y=floor;c.deadGrounded=true;c.clock=0;actor.setClip('death');}}else if(c.clock>actor.duration('death')+.35){c.phase='gone';actor.sprite.setVisible(false);}actor.update(dt);continue;}
   if(c.phase==='hurt'){if(c.clock>=actor.duration('hurt')){c.phase='recovery';c.clock=0;actor.setClip('idle');}actor.update(dt);continue;}
   if(c.phase==='sleep'){actor.setClip('idle');if(Math.abs(dx)<480&&c.clock>.6){c.phase='patrol';c.clock=0;}}
   else if(c.phase==='patrol'){actor.setClip('walk');actor.facing=dx<0?-1:1;actor.x+=actor.facing*(flight?44:32)*dt;actor.x=Phaser.Math.Clamp(actor.x,Number(c.source.props.patrolLeft),Number(c.source.props.patrolRight));if(Math.abs(dx)<(flight?150:44)){c.phase='attack';c.clock=0;c.hit=false;actor.setClip('attack');}}
   else if(c.phase==='attack'){
    const duration=actor.duration('attack');if(flight){actor.y=Phaser.Math.Linear(actor.y,player.y-20,Math.min(1,dt*3));actor.x+=actor.facing*80*dt;}
    const window=actor.definition.attackWindows?.attack;const frame=actor.frameAt('attack',c.clock);const active=window?frame>=window.startFrame&&frame<window.endFrameExclusive:c.clock>=duration*.55&&c.clock<duration*.8;
    if(active&&!c.hit&&Math.abs(player.x-actor.x)<(flight?45:55)&&Math.abs(player.y-actor.y)<65){c.hit=true;this.damage(1,actor.x);}
    if(c.clock>=duration){c.phase='recovery';c.clock=0;actor.setClip('idle');}
   }else if(c.phase==='recovery'){if(flight)actor.y=Phaser.Math.Linear(actor.y,c.source.y,Math.min(1,dt*2));if(c.clock>1.2){c.phase='patrol';c.clock=0;}}
   actor.update(dt);
  }
  this.updateBoss(dt,player);this.shot.clear();
  for(const p of this.projectiles){p.x+=p.vx*dt;p.life-=dt;if(!this.assisted&&Math.abs(p.x-player.x)<20&&Math.abs(p.y-(player.y-25))<24){p.life=0;this.damage(1,p.x);}this.shot.fillStyle(0x7799b3,.25).fillCircle(Math.round(p.x),Math.round(p.y),12).fillStyle(0xc5dce4,.85).fillRect(Math.round(p.x)-5,Math.round(p.y)-3,10,6);}
  this.projectiles=this.projectiles.filter(p=>p.life>0);
  const b=this.boss;if(b?.phase==='attack'&&b.pattern===1){const alpha=.15+.25*Math.min(1,b.clock/b.actor.duration());this.shot.fillStyle(0xa4c6d8,alpha).fillRect(Math.round(b.targetX)-50,b.actor.y-3,100,3);if(b.hit)this.shot.fillStyle(0xc5dce4,.6).fillRect(Math.round(b.targetX)-16,b.actor.y-115,32,112);}
 }
 private updateBoss(dt:number,p:CombatPlayer){const b=this.boss;if(!b)return;b.clock+=dt;const a=b.actor,dx=p.x-a.x;a.facing=dx<0?-1:1;
  if(b.phase==='death'){if(b.clock>a.duration('death')+.45&&!b.sent){b.sent=true;this.bossDead();}a.update(dt);return;}
  if(b.phase==='hurt'){if(b.clock>a.duration('hurt')){b.phase='recovery';b.clock=0;a.setClip('idle');}}
  else if(b.phase==='waiting'){a.setClip('idle');if(Math.abs(dx)<850&&b.clock>1){b.phase='approach';b.clock=0;}}
  else if(b.phase==='approach'){a.setClip(Math.abs(dx)>180?'walk':'idle');if(Math.abs(dx)>180)a.x+=a.facing*40*dt;if(b.clock>(this.assisted?2.4:1.65)){b.phase='attack';b.clock=0;b.hit=false;b.targetX=p.x;a.setClip(b.pattern===0?'attack':'attack2');this.effect('telegraph','boss-windup');}}
  else if(b.phase==='attack'){const duration=a.duration(),window=a.definition.attackWindows?.[a.clip],frame=a.frameAt(a.clip,b.clock);const contact=window?frame>=window.startFrame:b.clock>=duration*.6;
   if(contact&&!b.hit){b.hit=true;if(b.pattern===0)this.projectiles.push({x:a.x+a.facing*30,y:a.y-28,vx:a.facing*(this.assisted?100:150),life:5});else if(!this.assisted&&Math.abs(p.x-b.targetX)<50&&p.y>a.y-120)this.damage(1,b.targetX);}
   if(b.clock>=duration){b.phase='recovery';b.recoveryHit=false;b.clock=0;a.setClip('idle');}
  }else if(b.phase==='recovery'&&b.clock>(this.assisted?1.65:1.05)){b.phase='approach';b.clock=0;b.pattern=1-b.pattern;}
  a.update(dt);
 }
 resetCreatures(){for(const c of this.creatures){c.health=Number(c.source.props.health)||2;c.phase='sleep';c.clock=0;c.hit=false;c.fallVelocity=undefined;c.deadGrounded=false;c.actor.x=c.source.x;c.actor.y=c.source.y;c.actor.setClip('idle');}this.setRoom(this.roomId);}
 snapshot(){return {residents:this.residents.filter(r=>r.source.props.roomId===this.roomId).map(r=>({id:r.source.id,actor:r.actor.definition.id,x:r.actor.x,y:r.actor.y})),mobs:this.creatures.filter(c=>c.source.props.roomId===this.roomId).map(c=>({id:c.source.id,phase:c.phase,health:c.health,x:c.actor.x,y:c.actor.y})),boss:this.bossState};}
}
