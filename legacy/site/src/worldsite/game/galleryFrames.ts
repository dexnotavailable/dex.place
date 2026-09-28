import Phaser from 'phaser';
import {assemblyAsset,nativePart,type NativeAssemblyArt} from './assemblyArt';
import {ILLUSTRATION_DIMENSIONS} from './illustrationDimensions';

/** The world knows only dimensions; the separate DOM display owns every artwork. */
export function buildGalleryFrame(scene:Phaser.Scene,root:Phaser.GameObjects.Container,art:NativeAssemblyArt,itemId:string){
 const dimensions=ILLUSTRATION_DIMENSIONS[itemId],source=assemblyAsset(scene,'P14');
 if(!dimensions||!source)throw Error('Gallery frame dimensions/material are unavailable: '+itemId);
 const opening=source.metadata?.parts?.aperture||{x:9,y:9,width:92,height:153};
 const ratio=dimensions.width/dimensions.height;
 const width=Math.round(Math.min(192,150*ratio)),height=Math.round(width/ratio);
 const left=opening.x,right=source.width-opening.x-opening.width,top=opening.y,bottom=source.height-opening.y-opening.height;
 const outerW=left+width+right,outerH=top+height+bottom,x=-Math.round(outerW/2),y=-145-Math.round(outerH/2);
 const columns=[{source:0,size:left,span:left},{source:left,size:opening.width,span:width},{source:left+opening.width,size:right,span:right}];
 const rows=[{source:0,size:top,span:top},{source:top,size:opening.height,span:height},{source:top+opening.height,size:bottom,span:bottom}];
 // The donor's two lower feet extend fourteen pixels inward. Keep each in
 // its end cap; repeating the nine-pixel edge crop would duplicate feet.
 const bottomColumns=[{source:0,size:14,span:14},{source:14,size:source.width-28,span:outerW-28},{source:source.width-14,size:14,span:14}];
 let dy=0,index=0;
 for(let row=0;row<3;row++){let dx=0;for(let column=0;column<3;column++){
  const r=rows[row],c=(row===2?bottomColumns:columns)[column];
  if(row!==1||column!==1)for(let py=0;py<r.span;py+=r.size)for(let px=0;px<c.span;px+=c.size){
   const part=nativePart(scene,root,art,'gallery-frame:'+index++,'P14',x+dx+px,y+dy+py,{x:c.source,y:r.source,width:Math.min(c.size,c.span-px),height:Math.min(r.size,r.span-py)});
   if(!part)throw Error('Gallery frame crop unavailable');
  }
  dx+=c.span;
 }dy+=rows[row].span;}
 return{x,y,screen:{x:left,y:top,width,height},outerWidth:outerW,outerHeight:outerH};
}
