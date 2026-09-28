import Phaser from 'phaser';
import {PALETTE as C,type SceneAssets,type ScenePlacement,type SceneRoom} from './assets';
import type {WorldMap} from './map';
import {WorldLighting} from './lighting';
import {ARRIVAL_SIGNAL} from '../camera-frame';
import {buildPlatforms} from './platforms';

/** Independently placed source art. Geometry remains owned by the authored map. */
export class Environment {
  private activeRoomId:string|null=null;
  private lighting:WorldLighting;
  private parts:{image:Phaser.GameObjects.Image;record:ScenePlacement}[]=[];
  private sky:Phaser.GameObjects.Image|null=null;
  private water:Phaser.GameObjects.TileSprite|null=null;
  private waterBase:Phaser.GameObjects.Graphics;
  private waterFade:Phaser.GameObjects.Graphics;
  private atmosphere:Phaser.GameObjects.Graphics;
  private details:Phaser.GameObjects.Graphics;
  private solidArt:Phaser.GameObjects.Graphics;
  private lightPools:Phaser.GameObjects.Graphics;
  private low=false;
  private reducedOffsets=new Map<ScenePlacement,number>();
  private lastWidth=0;
  private rooms:SceneRoom[]=[];
  private roomWater:{room:SceneRoom;image:Phaser.GameObjects.TileSprite}[]=[];
  private roomLabels:{roomId?:string;text:Phaser.GameObjects.Text}[]=[];
  private roomMasks=new Map<string,Phaser.Display.Masks.GeometryMask>();
  private serviceLights=new Map<string,{x:number;color:number;beam:Phaser.GameObjects.Image;wall:Phaser.GameObjects.Image;spill:Phaser.GameObjects.Image;pool:Phaser.GameObjects.Image}>();
  private recesses:{image:Phaser.GameObjects.Image;back:Phaser.GameObjects.Graphics}[]=[];
  constructor(private scene:Phaser.Scene,private manifest:SceneAssets,private map:WorldMap) {
    this.rooms=manifest.rooms||[];
    this.atmosphere=scene.add.graphics().setDepth(-38);
    this.details=scene.add.graphics().setDepth(11);
    this.solidArt=scene.add.graphics().setDepth(4);
    this.lightPools=scene.add.graphics().setDepth(18);
    this.waterBase=scene.add.graphics().setDepth(-77);
    this.waterFade=scene.add.graphics().setDepth(-75);
    if(scene.textures.exists('asset:B01'))this.sky=scene.add.image(0,0,'asset:B01').setOrigin(0).setDepth(-98);
    if(!this.rooms.length&&scene.textures.exists('asset:B07'))this.water=scene.add.tileSprite(0,670,1,1,'asset:B07').setOrigin(0).setDepth(-76);
    this.ensureRoom(this.rooms.length?'arrival':'');
    this.buildFloors();if(this.rooms.length){this.buildRooms();this.buildServiceLight()}else this.buildInterior();
    this.lighting=new WorldLighting(scene,this.rooms,map);
  }
  private image(id:string,x:number,y:number,depth:number) {
    const key=`asset:${id}`;if(!this.scene.textures.exists(key))return null;
    const texture=this.scene.textures.get(key);
    return this.scene.add.image(x,y,key,texture.has('content')?'content':undefined).setOrigin(0).setDepth(depth);
  }
  private buildFloors() {
    buildPlatforms(this.scene,this.manifest,this.map,this.solidArt);
  }
  /** Idempotent after the room loader has registered the source texture frames. */
  ensureRoom(roomId:string) {
    for(const p of this.manifest.placements) {
      if(p.roomId&&roomId&&p.roomId!==roomId||this.parts.some(part=>part.record===p))continue;
      const image=this.image(p.assetId,p.x,p.y,p.depth);if(!image)continue;
      const source=this.manifest.assets.find(asset=>asset.id===p.assetId);if(source?.sprite)image.setFrame(0);
      image.setDisplaySize(p.width,p.height).setAlpha(p.alpha??1).setFlipX(p.flipX??false);
      if(p.crop)image.setCrop(p.crop.x,p.crop.y,p.crop.width,p.crop.height);
      if(p.tint!==undefined)image.setTint(p.tint);
      if(p.assetId==='V2-M11'&&p.roomId&&this.roomMasks.has(p.roomId))image.setMask(this.roomMasks.get(p.roomId)!);
      image.setVisible(!this.activeRoomId||!p.roomId||p.roomId===this.activeRoomId);
      this.parts.push({image,record:p});this.addRecess(image,p);
    }
  }
  setRoom(roomId:string) {
    this.ensureRoom(roomId);
    this.activeRoomId=roomId;
    this.reducedOffsets.clear();
    const tints:Record<string,number>={hearth:0x5b6252,treasury:0x738174,archive:0x657b82,gallery:0xacbab1,arena:0x687a84,dispatch:0x71858a,lookout:0xd0d4c3,reservoir:0x92b2bc,arrival:0xb6c6c8,junction:0xa6bec1};
    this.sky?.setTint(tints[roomId]??0xffffff);
    for(const {image,record} of this.parts)image.setVisible(!record.roomId||record.roomId===roomId);
    for(const {room,image} of this.roomWater)image.setVisible(room.id===roomId);
    for(const label of this.roomLabels)label.text.setVisible(!label.roomId||label.roomId===roomId);
  }
  private buildRooms() {
    const scene=this.scene;
    for(const room of this.rooms) {
      const floor=room.floorY,top=room.topY??floor-780;
      const back=scene.add.graphics().setDepth(-44);
      // Cutaway foundations continue beneath the authored slabs. The level
      // geometry remains authoritative at stairs and at the lift shaft.
      const foundation=scene.add.graphics().setDepth(2);
      for(const s of this.map.solids) {
        const x=Math.max(s.x,room.x),right=Math.min(s.x+s.width,room.x+room.width);
        if(right<=x||s.props.walkSurface==='stairs'||s.props.structure==='service'||room.kind==='arrival')continue;
        foundation.fillStyle(0x132b36).fillRect(x,s.y+65,right-x,Math.max(320,this.map.height-s.y));
        foundation.fillStyle(0x314851).fillRect(x,s.y+65,right-x,8);
      }
      if(room.kind==='threshold') {
        back.fillStyle(0x12232e).fillRect(room.x,-this.map.height,room.width,floor+this.map.height+520);
        back.fillStyle(0x091821).fillRect(room.x,-this.map.height,room.width,top+this.map.height+80);
        // Closely spaced structural reveals express an enclosed passage, not
        // another destination populated with the same furniture.
        for(let x=room.x+32;x<room.x+room.width;x+=144)back.fillStyle(0x263b43).fillRect(x,top+80,8,floor-top-80);
      } else if(room.kind==='dispatch') {
        back.fillStyle(0x243b45).fillRect(room.x,-this.map.height,room.width,this.map.height*3);
        back.fillStyle(0x0c202b).fillRect(room.x,-this.map.height,room.width,top+this.map.height+100);
      } else if(room.kind==='archive') {
        back.fillStyle(0x1a2c33).fillRect(room.x,-this.map.height,room.width,floor+this.map.height+420);
        back.fillStyle(0x0e1e27).fillRect(room.x,-this.map.height,room.width,top+this.map.height+120);
        for(let x=room.x+90;x<room.x+room.width-40;x+=288)back.fillStyle(0x33484d,.45).fillRect(x,top+120,6,floor-top-120);
      } else if(room.kind==='gallery') {
        back.fillStyle(0x536b73).fillRect(room.x,-this.map.height,room.width,floor+this.map.height+300);
        back.fillStyle(0x1b3541).fillRect(room.x,-this.map.height,room.width,top+this.map.height+110);
      } else if(room.kind==='support') {
        const hearth=room.id==='hearth';
        back.fillStyle(hearth?0x343a34:0x263c3d).fillRect(room.x,-this.map.height,room.width,floor+this.map.height+400);
        back.fillStyle(hearth?0x1a2928:0x112b31).fillRect(room.x,-this.map.height,room.width,top+this.map.height+100);
        back.fillStyle(0xcab994,.4).fillRect(room.x+room.width*.52,floor-430,76,3);
      }
      if(room.kind!=='arrival')for(let y=0;y<240;y+=8)back.fillStyle(0x081922,.38*(1-y/240)).fillRect(room.x,top+y,room.width,8);
      if(room.windows?.length) {
        // Subtract real openings from the backdrop. Far art and water stay in
        // their own layers behind it, instead of painting a fake scenic panel.
        let spans=[{x:room.x,y:-this.map.height,width:room.width,height:this.map.height*3}];
        for(const window of room.windows)spans=spans.flatMap(r=>{
          const x=Math.max(r.x,window.x),y=Math.max(r.y,window.y),right=Math.min(r.x+r.width,window.x+window.width),bottom=Math.min(r.y+r.height,window.y+window.height);
          if(right<=x||bottom<=y)return [r];
          return [{x:r.x,y:r.y,width:r.width,height:y-r.y},{x:r.x,y:bottom,width:r.width,height:r.y+r.height-bottom},{x:r.x,y,width:x-r.x,height:bottom-y},{x:right,y,width:r.x+r.width-right,height:bottom-y}].filter(s=>s.width>0&&s.height>0);
        });
        const mask=scene.add.graphics().setVisible(false);mask.fillStyle(0xffffff);for(const r of spans)mask.fillRect(r.x,r.y,r.width,r.height);const geometry=mask.createGeometryMask();back.setMask(geometry);this.roomMasks.set(room.id,geometry);
        for(const part of this.parts)if(part.record.roomId===room.id&&part.record.assetId==='V2-M11')part.image.setMask(geometry);
      }
      if(room.waterY!==undefined&&scene.textures.exists('asset:B07')) {
        const image=scene.add.tileSprite(room.x,room.waterY,room.width,512,'asset:B07').setOrigin(0).setDepth(-76);
        this.roomWater.push({room,image});
        const horizon=scene.add.graphics().setDepth(-74);
        for(let dy=0;dy<56;dy+=4)horizon.fillStyle(0xa7bcc5,Math.pow(1-dy/56,1.5)).fillRect(room.x,room.waterY+dy,room.width,4);
        scene.add.rectangle(room.x,room.waterY+512,room.width,2000,0x668693).setOrigin(0).setDepth(-77);
      }
    }
    for(const label of this.manifest.labels||[]) {
      const text=scene.add.text(label.x,label.y,label.text,{fontFamily:'Inter, sans-serif',fontSize:'18px',color:'#d5d9ce',padding:{x:10,y:7},backgroundColor:'#263b43'}).setDepth(10).setOrigin(0,.5);
      this.roomLabels.push({roomId:label.roomId,text});
    }
  }
  private buildServiceLight() {
    const scene=this.scene,key='environment:soft-pixel-light-v1';
    if(!scene.textures.exists(key)) {
      // This tiny nearest-sampled mask changes illumination, never the source
      // pixels of the platform, props, character, DOM or personal artwork.
      const texture=scene.textures.createCanvas(key,96,96);
      if(!texture)return;
      const context=texture.getContext(),pixels=context.createImageData(96,96);
      for(let y=0;y<96;y++)for(let x=0;x<96;x++) {
        const radius=Math.hypot((x-47.5)/48,(y-47.5)/48),at=(y*96+x)*4;
        pixels.data[at]=255;pixels.data[at+1]=255;pixels.data[at+2]=255;
        pixels.data[at+3]=Math.round(255*Math.pow(Math.max(0,1-radius*radius),3));
      }
      context.putImageData(pixels,0,0);texture.refresh();
    }
    const beamKey='environment:service-beam-v2';
    if(!scene.textures.exists(beamKey)) {
      const texture=scene.textures.createCanvas(beamKey,256,216);
      if(!texture)return;
      const context=texture.getContext(),pixels=context.createImageData(256,216);
      for(let y=0;y<216;y++)for(let x=0;x<256;x++) {
        const t=y/215,half=19+t*103,edge=Math.max(0,1-Math.abs(x-127.5)/half),at=(y*256+x)*4;
        pixels.data[at]=255;pixels.data[at+1]=255;pixels.data[at+2]=255;
        pixels.data[at+3]=Math.round(255*Math.pow(edge,.8)*(1-t*.55)*Math.min(1,t*20));
      }
      context.putImageData(pixels,0,0);texture.refresh();
    }
    for(const room of this.rooms) {
      if(room.kind!=='dispatch'&&room.kind!=='archive')continue;
      const terminal=this.map.objects.find(o=>o.kind==='terminal'&&o.x>=room.x&&o.x<room.x+room.width);
      const x=terminal?.x??room.x+room.width*.52+38;
      // Above the wall/gantry textures, below the recess and playable objects.
      scene.add.graphics().setDepth(-19).fillStyle(0x07151d,.28).fillRect(room.x,-this.map.height,room.width,room.floorY+this.map.height);
      const warm=room.kind==='dispatch',color=warm?0xe7c392:0xb9d3d5;
      const light=(px:number,py:number,w:number,h:number,alpha:number,depth:number)=>scene.add.image(px,py,key).setDisplaySize(w,h).setTint(color).setAlpha(alpha).setDepth(depth).setBlendMode(Phaser.BlendModes.SCREEN);
      const beam=scene.add.image(x,room.floorY-427,beamKey).setOrigin(.5,0).setDisplaySize(warm?512:288,428).setTint(color).setAlpha(warm?.105:.08).setDepth(-18.7).setBlendMode(Phaser.BlendModes.SCREEN);
      this.serviceLights.set(room.id,{x,color,beam,wall:light(x+18,room.floorY-96,warm?440:270,260,warm?.12:.09,-18.5),spill:light(x+30,room.floorY-26,warm?400:220,94,warm?.15:.12,19),pool:light(x+54,room.floorY+2,warm?560:240,28,warm?.52:.42,19.1)});
    }
  }
  private addRecess(image:Phaser.GameObjects.Image,p:ScenePlacement) {
      if(p.assetId!=='M04'||!this.rooms.some(r=>r.id===p.roomId&&r.kind==='archive'))return;
      // M04's aperture is normalized against its authored213x640 source.
      // Placement position, dimensions and parallax stay authoritative.
      const x=Math.round(p.width*38/213),y=Math.round(p.height*17/640),w=Math.round(p.width*137/213),h=Math.round(p.height*607/640);
      const back=this.scene.add.graphics().setDepth(p.depth-.1).setPosition(image.x,image.y);
      back.fillStyle(0x132731).fillRect(x,y,w,h);
      back.fillStyle(0x0b1d27,.58).fillRect(x+24,y+28,w-48,h-42);
      back.fillStyle(0x112731).fillRect(x,y,6,h).fillRect(x+w-8,y+14,8,h-14);
      back.fillStyle(0x071821).fillRect(x+6,y,w-14,28);
      back.fillStyle(0x263d43).fillRect(x,y+h-9,w,9);
      back.fillStyle(0x7a8a82,.28).fillRect(x+7,y+h-9,w-14,2);
      this.recesses.push({image,back});
  }
  private buildInterior() {
    const scene=this.scene;
    const wall=scene.add.graphics().setDepth(-44);
    // Dark backing is intentional room depth, with the sky-facing openings kept clear.
    wall.fillStyle(0x203039).fillRect(70,790,1340,410);
    wall.fillStyle(0x172b33).fillRect(1840,716,1420,500);
    wall.fillStyle(0x4a646e).fillRect(2200,13,912,348);
    wall.fillStyle(0x24353b).fillRect(3320,224,460,988);
    wall.fillStyle(0x24353b).fillEllipse(3550,228,460,246);
    // Recesses and shadow near the ceilings establish room depth in a flat plane.
    for(let y=0;y<260;y+=8) {
      wall.fillStyle(0x0a1a24,.5*(1-y/260)).fillRect(1840,716+y,1420,8);
      wall.fillStyle(0x142b35,.38*(1-y/260)).fillRect(2200,13+y,912,8);
    }
    // Building faces continue below the floor, giving every room a foundation.
    const foundation=scene.add.graphics().setDepth(2);
    foundation.fillStyle(0x253942).fillRect(560,683,1240,1200).fillRect(2200,397,912,118);
    foundation.fillStyle(0x3d535a).fillRect(560,683,1240,18).fillRect(2200,397,912,9);
    foundation.fillStyle(0x1b303a).fillRect(2300,1084,460,500).fillRect(3260,684,580,1100).fillRect(120,1160,1240,500);
    // Large back-lit intervals break up the causeway's supporting facade.
    for(const x of [645,1045,1445]) {
      foundation.fillStyle(0x607b85,.55).fillRect(x,760,220,270);
      foundation.fillStyle(0x162b35).fillRect(x+9,769,202,252);
      foundation.fillStyle(0x38515b).fillRect(x+16,776,6,236);
    }
    const seams=scene.add.graphics().setDepth(-39);
    seams.lineStyle(1,0x657c82,.1);
    for(let x=185;x<1320;x+=160)seams.lineBetween(x,800,x,1082);
    for(let y=824;y<1080;y+=83)seams.lineBetween(120,y,1360,y);
    for(let x=1860;x<3250;x+=190)seams.lineBetween(x,718,x,1199);
    for(let y=730;y<1200;y+=100)seams.lineBetween(1840,y,3260,y);
    // Shelf transparent recesses get their required separate backing rectangles.
    for(const x of [2310,2640])scene.add.rectangle(x+39,984,76,112,0x22313f).setDepth(7.5);
    // Warm service lights sit in their own layer. No baked glow is stretched with art.
    this.details.fillStyle(C.warm,.82).fillRect(884,535,31,2).fillRect(2370,769,80,2).fillRect(3440,215,64,2);
    this.details.fillStyle(C.signal,.9).fillRect(ARRIVAL_SIGNAL.x,ARRIVAL_SIGNAL.y,ARRIVAL_SIGNAL.width,ARRIVAL_SIGNAL.height).fillRect(3017,189,3,9);
  }
  update(time:number,left:number,top:number,width:number,height:number,reduced:boolean,quality:'auto'|'low'|'high') {
    this.low=quality==='low'||(quality==='auto'&&width<900);
    if(!reduced||Math.abs(width-this.lastWidth)>1)this.reducedOffsets.clear();this.lastWidth=width;
    // Screen sampling follows the world pixel grid; no CSS/personal-art filtering.
    if(this.sky) {
      this.sky.setPosition(Math.floor(left)-2,Math.floor(top)-2).setDisplaySize(Math.ceil(width)+4,Math.ceil(height)+4);
    }
    if(this.water) {
      this.water.setPosition(Math.floor(left)-2,670).setSize(Math.ceil(width)+4,512);
      this.water.tilePositionX=Math.floor(left*.2+(reduced||this.low?0:Math.sin(time*.055)*3));
      this.waterBase.clear().fillStyle(0x668693).fillRect(Math.floor(left)-2,670,Math.ceil(width)+4,2200);
      this.waterFade.clear();
      for(let y=0;y<128;y+=4)this.waterFade.fillStyle(0x668693,Math.min(1,(y+4)/128)).fillRect(Math.floor(left)-2,1054+y,Math.ceil(width)+4,4);
    }
    for(const {image,record:p} of this.parts) {
      const sprite=this.manifest.assets.find(asset=>asset.id===p.assetId)?.sprite;
      if(sprite)image.setFrame(reduced?0:Math.floor(time*1000/Math.max(16,sprite.frameMs||80))%sprite.frames);
      const room=p.roomId?this.rooms.find(r=>r.id===p.roomId):undefined;
      const inView=(!this.activeRoomId||!p.roomId||p.roomId===this.activeRoomId)&&(!room||room.x<left+width+128&&room.x+room.width>left-128);
      const parallax=p.scrollFactor??1;
      const reference=room?room.x+room.width/2-700:800;
      const motionOffset=(left-reference)*(1-parallax);
      if(reduced&&!this.reducedOffsets.has(p))this.reducedOffsets.set(p,motionOffset);
      const offset=reduced?this.reducedOffsets.get(p)!:motionOffset;
      const portraitOffset=width/height<.85?p.portraitOffset:undefined;
      const drift=reduced||this.low?0:p.motion==='cloud'?Math.sin(time*.017)*8:p.motion==='haze'?Math.sin(time*.03)*4:0;
      // Reference origin keeps authored composition stable at arrival; parallax
      // changes horizontal spacing gently while vertical navigation stays grounded.
      image.setPosition(Math.round(p.x+offset+drift+(portraitOffset?.x??0)),p.y+(portraitOffset?.y??0));
      image.setVisible(inView&&!(this.low&&p.optional));
      if(p.motion==='water')image.setAlpha((p.alpha??1)*(reduced||this.low?1:.93+Math.sin(time*.12)*.07));
    }
    for(const {image,back} of this.recesses)back.setPosition(image.x,image.y).setVisible(image.visible);
    for(const [id,light] of this.serviceLights) {
      const room=this.rooms.find(r=>r.id===id)!,visible=(!this.activeRoomId||room.id===this.activeRoomId)&&room.x<left+width&&room.x+room.width>left;
      light.beam.setVisible(visible);light.wall.setVisible(visible&&!this.low);light.spill.setVisible(visible);light.pool.setVisible(visible);
    }
    const g=this.atmosphere;g.clear();
    // Gentle, spatial light falloff: nested low-opacity pixel-aligned columns.
    if(!this.rooms.length) {
      for(const beam of [{x:2404,y:46,w:93,h:314,c:0xdfdcc4},{x:3464,y:217,w:70,h:423,c:0xe3be83}]) {
        for(let y=0;y<beam.h;y+=8) {
          const spread=Math.floor(y*.22),alpha=(beam.c===0xe3be83?.115:.055)*(1-y/(beam.h*1.5));
          g.fillStyle(beam.c,alpha).fillRect(beam.x-spread,beam.y+y,beam.w+spread*2,Math.min(8,beam.h-y));
        }
      }
      if(!reduced&&!this.low)for(let i=0;i<12;i++) {
        const x=2220+(i*137)%815+Math.sin(time*.04+i)*7,y=24+(i*53+time*(.7+i%3))%310;
        g.fillStyle(C.paper,.16).fillRect(Math.round(x),Math.round(y),1,1);
      }
    }
    for(const {room,image} of this.roomWater) {
      image.setVisible((!this.activeRoomId||room.id===this.activeRoomId)&&room.x<left+width&&room.x+room.width>left);
      image.tilePositionX=reduced||this.low?0:Math.round(Math.sin(time*.055)*3);
    }
    if(this.rooms.length){this.paintRoomLight(left,top,width,height);this.lighting.update(time,left,width,reduced,this.low);return;}
    const pool=this.lightPools;pool.clear();
    for(let i=5;i>=0;i--) {
      pool.fillStyle(0xf1dcb1,.022).fillRect(3375-i*15,638,235+i*30,3);
      pool.fillStyle(0xd6ddd0,.015).fillRect(2365-i*8,358,167+i*16,2);
    }
  }
  private paintRoomLight(left:number,_top:number,width:number,_height:number) {
    const g=this.atmosphere,pool=this.lightPools,fixtures=this.details;g.clear();pool.clear();fixtures.clear();
    for(const room of this.rooms) {
      if(room.x>=left+width||room.x+room.width<=left||room.kind==='arrival')continue;
      if(room.windows?.length){
        for(const window of room.windows){
          if(window.x+window.width+240<left||window.x-240>left+width)continue;
          const bottom=window.y+window.height;
          for(let dy=0;dy<room.floorY-bottom;dy+=8){const spread=Math.round(dy*.22);g.fillStyle(0xd7ddc8,.033*(1-dy/700)).fillRect(window.x-spread,bottom+dy,window.width+spread*2,8);}
        }
        continue;
      }
      if(room.kind==='threshold') {
        const x=room.x+room.width*.5,y=room.floorY-110;
        fixtures.fillStyle(C.structure).fillRect(x-15,y-5,30,8);fixtures.fillStyle(C.ink).fillRect(x-15,y-5,30,2);fixtures.fillStyle(C.warm,.65).fillRect(x-12,y,24,2);
        continue;
      }
      const warm=room.kind==='support'||room.kind==='dispatch';
      const window=room.windows?.[0];
      const local=this.serviceLights.get(room.id);
      const y=window?window.y-3:room.floorY-(room.kind==='gallery'?570:430),x=local?local.x-38:window?window.x+window.width*.5-38:room.x+room.width*.52;
      const color=local?local.color:warm?0xe3be83:0xd1d9d0;
      if(!window)fixtures.fillStyle(C.structure).fillRect(x+35,room.topY??room.floorY-780,3,Math.max(0,y-(room.topY??room.floorY-780)));
      if(!window){fixtures.fillStyle(C.ink).fillRect(x-5,y-9,86,12);fixtures.fillStyle(C.structure).fillRect(x-3,y-8,82,7);}
      for(let d=0;!local&&d<room.floorY-y;d+=8) {
        const spread=Math.round(d*.22);g.fillStyle(color,(warm?.07:.04)*(1-d/700)).fillRect(x-spread,y+d,76+spread*2,8);
      }
      fixtures.fillStyle(color,local?.9:.65).fillRect(x,y,76,2);
      if(!local)pool.fillStyle(color,.08).fillRect(x-100,room.floorY-2,270,3);
    }
  }
  snapshot(){return {composition:this.rooms.length?'waterfront-rooms-repair-v1':'causeway-layered-v1',rooms:this.rooms.map(r=>({id:r.id,kind:r.kind,x:r.x,width:r.width,floorY:r.floorY})),placements:this.parts.length,low:this.low,visible:this.parts.filter(p=>p.image.visible).length,roles:[...new Set(this.parts.map(p=>p.record.assetId))],lighting:this.lighting.snapshot()};}
}
