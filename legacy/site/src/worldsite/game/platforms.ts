import Phaser from 'phaser';
import type { SceneAssets } from './assets';
import type { Solid, WorldMap } from './map';

const C={underside:0x183039,shadow:0x112832,face:0x304b52,edge:0x718384};
const stair=(s:Solid)=>s.props.walkSurface==='stairs'||s.id.includes('stair');

/** Generated material on exact authored geometry, with independent end/support parts. */
export function buildPlatforms(scene:Phaser.Scene,manifest:SceneAssets,map:WorldMap,g:Phaser.GameObjects.Graphics) {
 const material=manifest.assets.find(a=>a.id==='causeway'),key='asset:causeway';
 if(!material||!scene.textures.exists(key))throw Error('Platform material is unavailable.');
 const texture=scene.textures.get(key),frame=material.repeatFrame??material.frame;
 if(!frame)throw Error('Platform material repeat bounds are missing.');
 const frameName=texture.has('content')?'content':undefined;
 const slabs=map.solids.filter(s=>s.props.structure!=='service');
 const hardware=scene.add.graphics().setDepth(5.1);
 for(const s of slabs) {
  const depth=Math.max(frame.height,s.height+20);
  // This quiet backing continues the cutaway under deep stairs. The exposed
  // cap/fascia is the generated raster; no procedural material replaces it.
  g.fillStyle(C.underside).fillRect(s.x,s.y,s.width,depth);
  g.fillStyle(C.shadow).fillRect(s.x,s.y+depth-3,s.width,3);
  // Tile phase is world-aligned, including adjacent map records. Crop at the
  // real solid boundary; never stretch source pixels or paint across a gap.
  for(let tile=Math.floor(s.x/frame.width)*frame.width;tile<s.x+s.width;tile+=frame.width){
   const from=Math.max(0,s.x-tile),width=Math.min(frame.width,s.x+s.width-tile)-from;
   scene.add.image(tile,s.y-(material.collisionTop??0),key,frameName).setOrigin(0).setDepth(5).setCrop(from,0,width,frame.height);
  }
  const leftJoined=slabs.some(o=>o!==s&&o.x+o.width===s.x&&Math.abs(o.y-s.y)<=8);
  const rightJoined=slabs.some(o=>o!==s&&o.x===s.x+s.width&&Math.abs(o.y-s.y)<=8);
  // End faces exist only at exposed ends. There is no raster end-cap motif in
  // the repeating interior material, and no periodic bracket below the slab.
  if(!leftJoined)hardware.fillStyle(C.shadow).fillRect(s.x,s.y+16,1,depth-16);
  if(!rightJoined)hardware.fillStyle(C.shadow).fillRect(s.x+s.width-1,s.y+16,1,depth-16);
 }
 for(const p of manifest.placements.filter(p=>p.assetId==='FG03')){
  const center=p.x+p.width/2,s=slabs.find(s=>!stair(s)&&center>=s.x&&center<s.x+s.width&&p.y>=s.y+52&&p.y<=s.y+76);
  if(!s)continue;
  const x=Math.round(p.x-10),width=Math.round(p.width+20),y=Math.round(Math.max(p.y,s.y+frame.height-2));
  hardware.fillStyle(C.underside).fillRect(x,y-10,width,12);
  hardware.fillStyle(C.edge).fillRect(x+2,y-10,width-4,2);
  hardware.fillStyle(C.shadow).fillRect(x+7,y,width-14,2);
 }
 // Historical service banks keep their native metal source. Actual bridge and
 // lift decks remain wholly owned by their independent mechanism assemblies.
 for(const s of map.solids.filter(s=>s.props.structure==='service')){
  const texture=scene.textures.get('asset:P07'),native=manifest.assets.find(a=>a.id==='P07')?.frame;
  if(!native)throw Error('Service platform material is unavailable.');
  const piece=(x:number,sx:number,width:number)=>{const frame=`service:${sx}:${width}`;if(!texture.has(frame))texture.add(frame,0,native.x+sx,native.y,width,12);scene.add.image(x,s.y,'asset:P07',frame).setOrigin(0).setDepth(5)};
  piece(s.x,0,16);let at=16;
  while(at<s.width-16){const width=Math.min(native.width-32,s.width-16-at);piece(s.x+at,16,width);at+=width}
  piece(s.x+s.width-16,native.width-16,16);
  g.fillStyle(C.face).fillRect(s.x+18,s.y+12,4,52).fillRect(s.x+s.width-22,s.y+12,4,52);
 }
}
