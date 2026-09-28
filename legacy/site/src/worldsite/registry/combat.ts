import type {Player} from './controller';
export type EnemyPhase='waiting'|'approach'|'windup'|'active'|'recovery'|'hurt'|'death'|'gone';
export interface Enemy {id:string;x:number;y:number;facing:1|-1;health:number;maximum:number;phase:EnemyPhase;clock:number;pattern:number;targetX:number;strikeSpent:boolean;recoveryHit:boolean;boss:boolean;left:number;right:number;clip:string}
export const createEnemy=(id:string,x:number,y:number,boss:boolean,left=120,right=1480):Enemy=>({id,x,y,facing:-1,health:boss?6:2,maximum:boss?6:2,phase:'waiting',clock:0,pattern:0,targetX:x,strikeSpent:false,recoveryHit:false,boss,left,right,clip:'warden-idle'});
export function strikeEnemy(e:Enemy,p:Player){if(['death','gone','waiting'].includes(e.phase)||p.attackHits.has(e.id)||e.boss&&e.phase!=='recovery'||e.boss&&e.recoveryHit)return false;const dx=(e.x-p.x)*p.facing;if(dx<-16||dx>100||Math.abs(e.y-p.y)>100)return false;p.attackHits.add(e.id);e.health--;e.recoveryHit=true;e.phase=e.health<=0?'death':'hurt';e.clock=0;e.clip=e.health<=0?'warden-death':'warden-hit';return true;}
export function stepEnemy(e:Enemy,p:Player,dt:number,assisted:boolean,damage:(fromX:number)=>void,effect:()=>void,deathDuration:number){
 e.clock+=dt;const dx=p.x-e.x;
 if(e.phase==='gone')return;
 if(e.phase==='death'){e.clip='warden-death';if(e.clock>deathDuration+.45)e.phase='gone';return}
 if(e.phase!=='windup'&&e.phase!=='active')e.facing=dx<0?-1:1;
 if(e.phase==='waiting'){e.clip='warden-idle';if(Math.abs(dx)<(e.boss?480:380)&&e.clock>(e.boss?1.1:.7)){e.phase='approach';e.clock=0}}
 else if(e.phase==='approach'){e.clip='warden-idle';if(Math.abs(dx)>145)e.x+=e.facing*(e.boss?70:48)*dt;e.x=Math.max(e.left,Math.min(e.right,e.x));if(e.clock>(e.boss?1.25:1.5)){e.phase='windup';e.clock=0;e.targetX=p.x;e.strikeSpent=false;e.clip='warden-attack';effect()}}
 else if(e.phase==='windup'){e.clip='warden-attack';if(e.clock>(assisted?1.15:.85)){e.phase='active';e.clock=0}}
 else if(e.phase==='active'){
  e.clip='warden-attack';if(e.pattern===0){e.x=Math.max(e.left,Math.min(e.right,e.x+e.facing*(e.boss?330:200)*dt));if(!e.strikeSpent&&Math.abs(p.x-e.x)<72&&Math.abs(p.y-e.y)<80){e.strikeSpent=true;damage(e.x)}}
  else if(e.clock>.14&&!e.strikeSpent){e.strikeSpent=true;if(Math.abs(p.x-e.targetX)<70&&p.y>e.y-115)damage(e.targetX)}
  if(e.clock>(e.pattern===0?.38:.5)){e.phase='recovery';e.clock=0;e.recoveryHit=false;e.clip='warden-recover'}
 }else if(e.phase==='hurt'){e.clip='warden-hit';if(e.clock>.28){e.phase='recovery';e.clock=0;e.clip='warden-recover'}}
 else if(e.phase==='recovery'){e.clip='warden-recover';if(e.clock>(assisted?1.7:1.3)){e.phase='approach';e.clock=0;e.pattern=1-e.pattern}}
}
