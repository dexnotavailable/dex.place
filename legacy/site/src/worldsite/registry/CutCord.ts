import Phaser from 'phaser';
import type {ArtAsset} from './contracts';
type Point={x:number;y:number};
/** A real straight-strand texture with two native crops after the cut.
 * Fixed hardware is owned separately; neither stub can move its mounting post.
 * Rope length and pixel aspect remain fixed while the attached endpoint moves. */
export class CutCord {
 private full:Phaser.GameObjects.Image;private fixedPiece:Phaser.GameObjects.Image;private movingPiece:Phaser.GameObjects.Image;
 private cutTime:number|null=null;private initialAngle:number;private scale:number;private end:()=>Point;
 readonly cutPoint:Point;
 constructor(scene:Phaser.Scene,id:string,key:string,asset:ArtAsset,private fixed:Point,end:()=>Point,private fraction:number,depth=34){
  const width=asset.frameWidth||asset.width,height=asset.frameHeight||asset.height,start=asset.anchors?.start||asset.pivot||[width/2,0],bottom=asset.anchors?.end||[start[0],height-1];
  if(bottom[1]<=start[1]||Math.abs(bottom[0]-start[0])>2)throw Error('Cord requires upright native start/end anchors: '+id);
  this.end=end;const finish=end(),length=Math.hypot(finish.x-fixed.x,finish.y-fixed.y);this.scale=length/(bottom[1]-start[1]);this.initialAngle=Math.atan2(finish.y-fixed.y,finish.x-fixed.x)-Math.PI/2;
  this.cutPoint={x:fixed.x+(finish.x-fixed.x)*fraction,y:fixed.y+(finish.y-fixed.y)*fraction};
  const split=Math.max(1,Math.min(height-1,Math.round(start[1]+(bottom[1]-start[1])*fraction))),texture=scene.textures.get(key),first='cord:'+id+':fixed',second='cord:'+id+':moving';
  if(!texture.has(first))texture.add(first,0,0,0,width,split);if(!texture.has(second))texture.add(second,0,0,split,width,height-split);
  // Adding the two crops changes Phaser's firstFrame. Explicitly retain the
  // complete source strand while intact, rather than drawing just the stub.
  this.full=scene.add.image(fixed.x,fixed.y,key,'__BASE').setOrigin(start[0]/width,start[1]/height).setScale(this.scale).setRotation(this.initialAngle).setDepth(depth);
  this.fixedPiece=scene.add.image(fixed.x,fixed.y,key,first).setOrigin(start[0]/width,start[1]/split).setScale(this.scale).setDepth(depth).setVisible(false);
  this.movingPiece=scene.add.image(finish.x,finish.y,key,second).setOrigin(bottom[0]/width,(bottom[1]-split)/(height-split)).setScale(this.scale).setDepth(depth).setVisible(false);
 }
 sever(){if(this.cutTime!==null)return;this.cutTime=0;this.full.setVisible(false);this.fixedPiece.setVisible(true);this.movingPiece.setVisible(true);}
 restore(){this.sever();this.cutTime=4;this.update(0,false);}
 update(dt:number,reduced:boolean){if(this.cutTime===null)return;this.cutTime+=dt;const t=reduced?4:this.cutTime,settle=1-Math.exp(-t*4),swing=Math.sin(t*7)*Math.exp(-t*2)*.3;
  const fixedTarget=Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(this.initialAngle),0)*Math.PI/180,movingTarget=Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(this.initialAngle),180)*Math.PI/180;
  this.fixedPiece.setRotation(this.initialAngle+fixedTarget*settle+swing);const end=this.end();this.movingPiece.setPosition(end.x,end.y).setRotation(this.initialAngle+movingTarget*settle-swing);
 }
 snapshot(){return {state:this.cutTime===null?'held':'cut',cutPoint:this.cutPoint,fixed:{x:this.fixedPiece.x,y:this.fixedPiece.y,angle:this.fixedPiece.rotation},moving:{x:this.movingPiece.x,y:this.movingPiece.y,angle:this.movingPiece.rotation},scale:this.scale};}
 destroy(){this.full.destroy();this.fixedPiece.destroy();this.movingPiece.destroy();}
}
