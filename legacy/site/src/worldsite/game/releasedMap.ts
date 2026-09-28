import Phaser from 'phaser';
import {LatchedBanner,mechanismReach,type MechanismActor} from './mechanisms';
/** Permanent cut state around the existing native cloth/weight assembly. */
export class ReleasedMap {
 readonly kit:LatchedBanner;private thread:Phaser.GameObjects.Graphics;private elapsed=0;private cut=false;
 constructor(private scene:Phaser.Scene,readonly id:string,private x:number,private floorY:number,private onSettled:()=>void){this.kit=new LatchedBanner(scene,{id,x,floorY});this.thread=scene.add.graphics().setDepth(13);this.render();}
 get point(){return {x:this.x-168,y:this.floorY-34};}
 get state(){return !this.cut?'fastened':this.elapsed<.75?'falling':'settled';}
 canCut(actor:MechanismActor){return !this.cut&&mechanismReach(actor,this.point,'slash');}
 canInspect(actor:MechanismActor){return this.state==='settled'&&Math.abs(actor.x-this.point.x)<100&&Math.abs(actor.y-this.floorY)<65;}
 sever(actor:MechanismActor){if(!this.canCut(actor))return false;this.cut=true;this.elapsed=0;this.kit.tryRelease(actor,'slash');return true;}
 restore(){this.cut=true;this.elapsed=1;this.kit.restoreOpen();this.render();}
 update(dt:number,paused:boolean,reduced:boolean){if(paused)return;const before=this.state;if(this.cut)this.elapsed+=dt;this.kit.update(dt,{reducedMotion:reduced});this.render();if(before!=='settled'&&this.state==='settled')this.onSettled();}
 private render(){const g=this.thread,p=this.point;g.clear();if(!this.cut){g.lineStyle(3,0x132630).lineBetween(p.x,p.y-54,p.x,p.y+3);g.lineStyle(1,0xc4bda0).lineBetween(p.x,p.y-54,p.x,p.y+3);g.fillStyle(0xb44f49).fillRect(p.x-3,p.y-4,6,8);}else {g.lineStyle(1,0xa5ab92).lineBetween(p.x,p.y-54,p.x+Math.round(Math.sin(this.elapsed*8)*3*Math.exp(-this.elapsed*2)),p.y-8);if(this.elapsed<.9){const y=p.y+Math.min(62,this.elapsed*this.elapsed*120);g.lineStyle(1,0xb9b797,Math.max(0,1-this.elapsed)).lineBetween(p.x+2,y,p.x+8,y+17);}}}
 setVisible(visible:boolean){this.kit.root.setVisible(visible);this.thread.setVisible(visible);}
 destroy(){this.kit.destroy();this.thread.destroy();}
}
