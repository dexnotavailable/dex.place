import type {InputAction,HeroManifest} from './contracts';
import type {Surface} from './rooms';
export const MOTION={step:1/60,speed:190,acceleration:1450,deceleration:1850,gravity:820,jumpSpeed:340,shortJumpSpeed:145,coyote:.12,buffer:.15,dashSpeed:365,dashDuration:.17,dashCooldown:.55,stepHeight:16,groundSnap:9};
export interface Player {x:number;y:number;vx:number;vy:number;facing:1|-1;grounded:boolean;support:string|null;airJump:boolean;airDash:boolean;coyote:number;buffer:number;dash:number;dashCooldown:number;attack:number;attackHits:Set<string>;hurt:number;invulnerable:number;clip:string;clipTime:number;jumps:number;doubleJumps:number;distance:number}
const approach=(n:number,t:number,d:number)=>n<t?Math.min(n+d,t):Math.max(n-d,t);
export function freshPlayer(x:number,y:number,facing:1|-1=1):Player{return{x,y,vx:0,vy:0,facing,grounded:true,support:null,airJump:true,airDash:true,coyote:MOTION.coyote,buffer:0,dash:0,dashCooldown:0,attack:-1,attackHits:new Set(),hurt:0,invulnerable:.6,clip:'idle',clipTime:0,jumps:0,doubleJumps:0,distance:0}}
export function strikeTouchesPoint(player:{x:number;y:number;facing:1|-1},point:{x:number;y:number}){const forward=(point.x-player.x)*player.facing;return forward>=-10&&forward<90&&point.y>=player.y-70&&point.y<=player.y+5;}
export function stepPlayer(p:Player,dt:number,held:Set<InputAction>,pressed:Set<InputAction>,solids:Surface[],width:number,hero:HeroManifest,on:{slash:()=>void;contact:()=>void;land:()=>void}){
 const m=MOTION,dir=(held.has('right')?1:0)-(held.has('left')?1:0),oldX=p.x;
 p.invulnerable=Math.max(0,p.invulnerable-dt);p.hurt=Math.max(0,p.hurt-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.coyote=p.grounded?m.coyote:Math.max(0,p.coyote-dt);p.buffer=Math.max(0,p.buffer-dt);if(pressed.has('jump'))p.buffer=m.buffer;
 if(dir&&p.hurt===0)p.facing=dir>0?1:-1;
 if(pressed.has('dash')&&p.dashCooldown===0&&(p.grounded||p.airDash)&&p.hurt===0){p.dash=m.dashDuration;p.dashCooldown=m.dashCooldown;if(!p.grounded)p.airDash=false;}
 const ground=p.buffer>0&&p.coyote>0,air=!ground&&pressed.has('jump')&&!p.grounded&&p.airJump;
 if((ground||air)&&!p.hurt){p.vy=-m.jumpSpeed;p.grounded=false;p.support=null;p.coyote=0;p.buffer=0;p.dash=0;p.jumps++;if(air){p.airJump=false;p.doubleJumps++;}}
 if(!held.has('jump')&&p.vy<-m.shortJumpSpeed)p.vy=Math.min(-m.shortJumpSpeed,p.vy+1900*dt);
 if(p.hurt>0){p.vx=approach(p.vx,0,160*dt);p.vy+=m.gravity*dt;}else if(p.dash>0){p.dash=Math.max(0,p.dash-dt);p.vx=p.facing*m.dashSpeed;p.vy=0;}else{p.vx=approach(p.vx,dir*m.speed,(dir?m.acceleration:m.deceleration)*dt);p.vy=Math.min(600,p.vy+m.gravity*dt);}
 if(pressed.has('slash')&&p.attack<0&&p.hurt===0){p.attack=0;p.attackHits.clear();on.slash();}
 if(p.attack>=0){const before=p.attack;p.attack+=dt;const [start,end]=hero.actions.slash.activeWindowMs;if(p.attack>=start/1000&&before<end/1000)on.contact();if(p.attack>=hero.actions.slash.totalDurationMs/1000)p.attack=-1;}
 const scale=hero.scale||1,half=hero.bodyBounds.width*scale/2,height=hero.bodyBounds.height*scale,grounded=p.grounded,fallSpeed=p.vy;
 p.x+=p.vx*dt;const overlap=(s:Surface)=>p.x+half>s.x+.3&&p.x-half<s.x+s.width-.3;
 for(const s of solids)if((!s.oneway||s.stair)&&overlap(s)&&p.y>s.y+.1&&p.y-height<s.y+s.height){const rise=p.y-s.y;if(grounded&&rise>0&&rise<=m.stepHeight){p.y=s.y;p.vy=0;continue}if(s.oneway)continue;if(p.vx>0)p.x=s.x-half;else if(p.vx<0)p.x=s.x+s.width+half;p.vx=0;}
 const oldY=p.y;p.y+=p.vy*dt;p.grounded=false;p.support=null;
 let landing:Surface|undefined;if(p.vy>=0)for(const s of solids)if(overlap(s)&&oldY<=s.y+1.5&&p.y>=s.y&&(!landing||s.y<landing.y))landing=s;
 if(!landing&&p.vy>=0&&p.coyote>0)for(const s of solids)if(overlap(s)&&s.y>=p.y&&s.y-p.y<=m.groundSnap&&(!landing||s.y<landing.y))landing=s;
 if(landing){p.y=landing.y;p.vy=0;p.grounded=true;p.support=landing.id;p.airDash=true;p.airJump=true;if(!grounded&&fallSpeed>80)on.land();}
 else if(p.vy<0)for(const s of solids)if(!s.oneway&&overlap(s)&&oldY-height>=s.y+s.height&&p.y-height<s.y+s.height){p.y=s.y+s.height+height;p.vy=0;}
 p.x=Math.max(half,Math.min(width-half,p.x));p.distance+=Math.abs(p.x-oldX);
 const attackVisible=p.attack>=0&&p.attack<hero.actions.slash.activeWindowMs[1]/1000;
 const next=p.hurt>0?'hit':attackVisible?'attack1':p.dash>0?'run':!p.grounded?(p.vy<0?'jump':'fall'):Math.abs(p.vx)>8?'run':'idle';
 if(next!==p.clip){p.clip=next;p.clipTime=0}else p.clipTime+=dt;
}
