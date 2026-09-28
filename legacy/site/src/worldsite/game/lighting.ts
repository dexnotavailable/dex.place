import Phaser from 'phaser';
import type { SceneRoom } from './assets';
import type { WorldMap } from './map';

interface LitRoom {
  room: SceneRoom;
  shade: Phaser.GameObjects.Image | null;
  light: Phaser.GameObjects.Image | null;
  farFog: Phaser.GameObjects.TileSprite;
  nearFog: Phaser.GameObjects.TileSprite;
}

const clamp=(v:number)=>Math.max(0,Math.min(1,v));

/** World-only illumination and depth haze. DOM exhibits and controls never enter this pass. */
export class WorldLighting {
  private layers:LitRoom[]=[];
  private textureBytes=0;

  constructor(private scene:Phaser.Scene,rooms:SceneRoom[],private map:WorldMap) {
    this.makeFog('world-light:fog-a',0);
    this.makeFog('world-light:fog-b',1.7);
    for(const room of rooms) {
      const outside=room.kind==='arrival',hearth=room.id==='hearth';
      const farFog=scene.add.tileSprite(room.x,room.floorY-(outside?400:390),room.width,384,'world-light:fog-a')
        .setOrigin(0).setTileScale(4,3).setDepth(-35).setTint(outside?0xb8ced0:0x91aeb7).setAlpha(hearth?.025:outside?.20:room.kind==='gallery'?.045:.09);
      const nearFog=scene.add.tileSprite(room.x,room.floorY-160,room.width,192,'world-light:fog-b')
        .setOrigin(0).setTileScale(3,1.5).setDepth(25).setTint(outside?0xb4cbd0:0xadc1c2).setAlpha(hearth?.02:outside?.12:.075);
      const fields=room.kind==='arrival'?{shade:null,light:null}:this.makeFields(room);
      this.layers.push({room,...fields,farFog,nearFog});
    }
  }

  private makeFog(key:string,phase:number) {
    if(this.scene.textures.exists(key))return;
    const width=384,height=128,texture=this.scene.textures.createCanvas(key,width,height);
    if(!texture)return;
    const context=texture.getContext(),pixels=context.createImageData(width,height);
    // Periodic waves form soft horizontal density folds. Integer texture pixels
    // remain stable as the plane drifts; no full-resolution shader/FBO is allocated.
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const nx=x/width*Math.PI*2,ny=y/height*Math.PI;
      const wave=.5+.20*Math.sin(nx*2+Math.sin(ny*3)+phase)+.16*Math.cos(nx*3-ny*5+phase)+.08*Math.sin(nx*7+ny*8);
      const density=Math.pow(clamp((wave-.22)/.78),1.4)*Math.pow(Math.sin(ny),1.7);
      const i=(y*width+x)*4;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
      pixels.data[i+3]=Math.round(density*230);
    }
    context.putImageData(pixels,0,0);texture.refresh();this.textureBytes+=width*height*4;
  }

  private makeFields(room:SceneRoom) {
    const top=(room.topY??room.floorY-780)-200,bottom=room.floorY+140;
    const width=Math.min(384,Math.ceil(room.width/4)),height=Math.min(256,Math.ceil((bottom-top)/4));
    const shadeKey=`world-light:shade:${room.id}`,lightKey=`world-light:light:${room.id}`;
    const shade=this.scene.textures.createCanvas(shadeKey,width,height),light=this.scene.textures.createCanvas(lightKey,width,height);
    if(!shade||!light)return {shade:null,light:null};
    const shadeContext=shade.getContext(),lightContext=light.getContext();
    const dark=shadeContext.createImageData(width,height),lit=lightContext.createImageData(width,height);
    const terminal=this.map.objects.find(o=>o.kind==='terminal'&&o.x>=room.x&&o.x<room.x+room.width);
    const warm=room.kind==='dispatch'||room.kind==='support';
    const fixtureX=terminal?.x??room.x+room.width*.52+38,fixtureY=room.floorY-(room.id==='hearth'?230:430);
    const ambient=room.kind==='gallery'?[.87,.92,.90]:room.kind==='threshold'?[.55,.66,.71]:room.id==='hearth'?[.58,.58,.51]:[.67,.77,.81];
    const color=warm?[1,.77,.49]:[.69,.88,1];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const wx=room.x+x/width*room.width,wy=top+y/height*(bottom-top);
      const below=(wy-fixtureY)/430;
      const spread=(warm?105:56)+clamp(below)*(warm?235:145);
      const beam=below>0&&below<1.02?Math.pow(clamp(1-Math.abs(wx-fixtureX)/spread),1.5)*clamp(below*5)*(1-clamp(below)*.38):0;
      const pool=Math.exp(-Math.pow((wx-fixtureX-22)/(warm?245:125),2)-Math.pow((wy-room.floorY+30)/110,2));
      const blocked=wy>room.floorY+4;
      const strength=room.kind==='threshold'||room.id==='hearth'?0:clamp((beam*.7+pool*.7)*(blocked?0:1));
      const local=(room.lights||[]).map(source=>({source,weight:blocked?0:source.strength*Math.exp(-Math.pow((wx-source.x)/source.radiusX,2)-Math.pow((wy-source.y)/source.radiusY,2))}));
      const localStrength=clamp(local.reduce((sum,item)=>sum+item.weight,0));
      const edgeShade=Math.pow(1-Math.sin(Math.PI*x/width),2)*.055;
      const i=(y*width+x)*4;
      for(let channel=0;channel<3;channel++) {
        const warmth=local.reduce((sum,item)=>sum+item.weight*((item.source.color>>((2-channel)*8))&255)/255,0);
        dark.data[i+channel]=Math.round(clamp(ambient[channel]-edgeShade+strength*(warm?[.30,.20,.09][channel]:.20)+warmth*.44)*255);
        lit.data[i+channel]=Math.round((localStrength?clamp(warmth/localStrength):color[channel])*255);
      }
      dark.data[i+3]=255;
      lit.data[i+3]=Math.round(clamp(strength+localStrength)*(room.kind==='gallery'?12:room.id==='hearth'?45:28));
    }
    shadeContext.putImageData(dark,0,0);lightContext.putImageData(lit,0,0);shade.refresh();light.refresh();
    this.textureBytes+=width*height*8;
    const material=this.scene.add.image(room.x,top,shadeKey).setOrigin(0).setDisplaySize(room.width,bottom-top)
      .setDepth(23).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(room.kind==='gallery'?.22:room.id==='hearth'?.62:.42);
    const illumination=this.scene.add.image(room.x,top,lightKey).setOrigin(0).setDisplaySize(room.width,bottom-top)
      .setDepth(24).setBlendMode(Phaser.BlendModes.SCREEN);
    return {shade:material,light:illumination};
  }

  update(time:number,left:number,width:number,reduced:boolean,low:boolean) {
    for(const {room,shade,light,farFog,nearFog} of this.layers) {
      const visible=room.x<left+width&&room.x+room.width>left;
      shade?.setVisible(visible);light?.setVisible(visible);
      if(light)light.setAlpha(!reduced&&!low&&room.lights?.some(source=>source.flicker)? .94+Math.sin(time*5.2)*.035+Math.sin(time*8.7)*.025:1);
      farFog.setVisible(visible&&room.kind!=='threshold');nearFog.setVisible(visible&&!low&&room.kind!=='threshold');
      const t=reduced||low?0:time;
      farFog.tilePositionX=Math.floor(t*1.6+room.x*.071);
      nearFog.tilePositionX=Math.floor(-t*2.8+room.x*.037);
    }
  }

  snapshot(){return {mode:'bounded-world-material-pass-v1',generatedRgbaBytes:this.textureBytes,roomFields:this.layers.filter(l=>l.shade).length,fogPlanes:this.layers.length*2,personalArtworkFiltered:false,planes:this.layers.map(({room,farFog,nearFog})=>({room:room.id,far:{visible:farFog.visible,x:farFog.tilePositionX,alpha:farFog.alpha},near:{visible:nearFog.visible,x:nearFog.tilePositionX,alpha:nearFog.alpha}}))};}
}
