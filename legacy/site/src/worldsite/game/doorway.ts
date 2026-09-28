import Phaser from 'phaser';
import type {MapObject} from './map';
import type {SceneAssets} from './assets';
import {nativePart,type NativeAssemblyArt} from './assemblyArt';

// Measured inner opening of the unchanged 192×275 V2-P02 frame. The small
// underlap sits beneath opaque stone, so camera rounding cannot expose a seam.
const APERTURE=[
 [96,27],[83,30],[65,38],[53,48],[46,59],[41,79],[39,99],
 [39,275],[153,275],[153,99],[151,79],[148,59],[141,48],
 [127,38],[106,30],
];

export class RoomDoorway {
 readonly root:Phaser.GameObjects.Container;
 private leaf:Phaser.GameObjects.Image;
 private latch:Phaser.GameObjects.Graphics;
 private aperture:Phaser.GameObjects.Graphics;
 private mask:Phaser.Display.Masks.GeometryMask;
 private closedX:number;
 private travel:number;
 private latchY:number;
 private open=0;
 private target=0;

 constructor(scene:Phaser.Scene,readonly source:MapObject){
  const manifest=scene.cache.json.get('scene-manifest') as SceneAssets;
  const frame=manifest.placements.find(p=>p.assetId==='V2-P02'&&p.roomId===source.props.roomId&&Math.abs(p.x+p.width/2-source.x)<2);
  if(!frame)throw Error('Door frame placement is unavailable: '+source.id);
  const left=frame.x-source.x,top=frame.y-source.y,sx=frame.width/192,sy=frame.height/275;
  const points=APERTURE.map(([x,y])=>new Phaser.Geom.Point(Math.round(left+x*sx),Math.round(top+y*sy)));
  this.root=scene.add.container(source.x,source.y).setDepth(frame.depth-1).setName('door:'+source.id);
  const back=scene.add.graphics().fillStyle(0x07151e).fillPoints(points,true);
  this.root.add(back);
  this.aperture=scene.add.graphics().setPosition(source.x,source.y).setVisible(false);
  this.aperture.fillStyle(0xffffff).fillPoints(points,true);
  this.mask=this.aperture.createGeometryMask();

  const art:NativeAssemblyArt={parts:{},missing:[]};
  this.closedX=Math.round(left+frame.width/2-52);
  const leafY=Math.round(top+28*sy)-3;
  const leaf=nativePart(scene,this.root,art,'leaf','V2-P03',this.closedX,leafY);
  if(!leaf)throw Error('Door leaf material is unavailable.');
  // Keep the generated leaf at native pixel pitch. Its lower body continues
  // below the floor and is clipped by the fixed opening, rather than squashed.
  this.leaf=leaf.image.setMask(this.mask);
  this.travel=Math.ceil(frame.width*114/192)+8;
  this.latchY=Math.round(top+frame.height*.63);
  this.latch=scene.add.graphics().setMask(this.mask);
  this.root.add(this.latch);
  this.drawLatch();
 }

 private drawLatch(){
  const x=Math.round(this.closedX+83-this.travel*this.open);
  this.latch.clear().fillStyle(0x1b2528).fillRect(x-2,this.latchY-2,7,15)
   .fillStyle(0xa29a76).fillRect(x,this.latchY,3,11)
   .fillStyle(0xdbc7a0).fillRect(x,this.latchY,2,2);
 }
 setOpening(open:boolean){this.target=open?1:0;}
 update(dt:number,reduced:boolean){
  this.open=reduced?this.target:Phaser.Math.Linear(this.open,this.target,Math.min(1,dt*9));
  this.leaf.x=Math.round(this.closedX-this.travel*this.open);
  this.leaf.setVisible(this.open<.995);
  this.latch.setVisible(this.open<.995);
  this.drawLatch();
 }
 get opened(){return this.open>.96;}
 setVisible(visible:boolean){
  // Departed doors settle closed while absent, so a later return starts from
  // the same complete leaf instead of retaining an old half-open transition.
  if(!visible){this.open=0;this.target=0;this.leaf.x=this.closedX;this.drawLatch();}
  this.root.setVisible(visible);
 }
 destroy(){this.root.destroy(true);this.mask.destroy();this.aperture.destroy();}
}
