/** Shared by the live camera and its exported loading frame. All units are world pixels. */
export const ARRIVAL_SIGNAL={x:2138,y:264,width:3,height:9};
export function cameraFrame(width:number,height:number,x:number,y:number,mapWidth=3840,arena=false,bounds?:{left:number;right:number}) {
 const portrait=width/Math.max(height,1)<.85;
 const zoom=arena?Math.max(.7,height/840):Math.max(portrait?40/52:.65,height/(portrait?900:1020));
 const viewW=width/zoom,viewH=height/zoom;
 const desiredX=arena?740-viewW/2:x-viewW*.4;
 const desiredY=arena?1100-viewH*.79:y-viewH*.77;
 const minX=arena?80:bounds?.left??380,maxX=arena?1400-viewW:(bounds?.right??mapWidth+300)-viewW;
 const targetX=maxX<minX?(minX+maxX)/2:Math.max(minX,Math.min(maxX,desiredX));
 const scrollX=targetX+(viewW-width)/2,scrollY=desiredY+(viewH-height)/2;
 return {zoom,viewW,viewH,scrollX,scrollY,left:Math.round(scrollX)+(width-viewW)/2,top:Math.round(scrollY)+(height-viewH)/2,portrait};
}
