import Phaser from 'phaser';
import type {WorldGhost,WorldPose} from './contracts';
import type {HeroAssets} from './assets';
export class SocialGhosts {
 private peers=new Map<string,{sprite:Phaser.GameObjects.Sprite;pose:WorldGhost;received:number}>();
 private local:WorldPose|null=null;
 constructor(private scene:Phaser.Scene,private hero:HeroAssets){}
 setLocal(pose:WorldPose){this.local=pose;}
 setPeers(peers:WorldGhost[]){
  const valid=new Set<string>();
  for(const p of peers.slice(0,8)){
   if(typeof p.id!=='string'||p.id.length>100||![p.x,p.y,p.frame].every(Number.isFinite)||!this.hero.clips[p.clip]||(p.opacity!==undefined&&!Number.isFinite(p.opacity))||!this.compatible(p))continue;
   valid.add(p.id);let entry=this.peers.get(p.id);
   if(!entry){entry={sprite:this.scene.add.sprite(p.x,p.y,'hero:'+p.clip,0).setDepth(19).setOrigin(this.hero.footX/200,this.hero.footY/200).setScale(this.hero.scale||1).setTint(0xa1c4d0),pose:p,received:performance.now()};this.peers.set(p.id,entry);}
   entry.pose={...p};entry.received=performance.now();
  }
  for(const [id,entry]of this.peers)if(!valid.has(id)){entry.sprite.destroy();this.peers.delete(id);}
 }
 private compatible(p:WorldGhost){const local=this.local;if(!local||p.roomId!==local.roomId||p.worldRevision!==local.worldRevision||p.geometryKey!==local.geometryKey)return false;const dynamic=p.supportKey.split('@')[0],remote=p.dynamicSupports?.[dynamic],here=local.dynamicSupports?.[dynamic];if(dynamic.startsWith('bridge.'))return remote==='settled'&&here==='settled';if(dynamic.startsWith('lift.'))return !!remote&&remote!=='locked'&&remote===here;return true;}
 update(dt:number){for(const [id,e]of this.peers){if(performance.now()-e.received>4000||!this.compatible(e.pose)){e.sprite.destroy();this.peers.delete(id);continue;}const alpha=Phaser.Math.Clamp(e.pose.opacity??.4,0,.55);const c=this.hero.clips[e.pose.clip];e.sprite.setPosition(Math.round(Phaser.Math.Linear(e.sprite.x,e.pose.x,Math.min(1,dt*12))),Math.round(Phaser.Math.Linear(e.sprite.y,e.pose.y,Math.min(1,dt*12)))).setTexture('hero:'+e.pose.clip,Phaser.Math.Clamp(Math.floor(e.pose.frame),0,c.frames-1)).setFlipX(e.pose.facing<0).setAlpha(alpha);}}
 snapshot(){return [...this.peers].map(([id,e])=>({id,x:e.sprite.x,y:e.sprite.y,roomId:e.pose.roomId,alpha:e.sprite.alpha}));}
 clear(){for(const e of this.peers.values())e.sprite.destroy();this.peers.clear();}
}
