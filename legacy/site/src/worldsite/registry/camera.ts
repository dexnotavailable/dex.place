import type {Room} from './rooms';
export interface CameraState {x:number;y:number;committed:boolean}
export function cameraTarget(width:number,height:number,room:Room,player:{x:number;y:number},state:CameraState,dt:number,reduced=false,opponent?:{x:number}){
 const portrait=width/height<.8,zoom=room.id==='arena'&&portrait?Math.max(.72,width/650):Math.max(.6,height/900),viewW=width/zoom,viewH=Math.min(900,height/zoom),offsetY=Math.max(0,(height-viewH*zoom)/2);
 if(Math.abs(player.x-room.camera.x)>140||Math.abs(player.y-room.floor)>180)state.committed=true;
 let x=state.committed?player.x:room.camera.x;
 if(room.id==='arena')x=viewW>=room.width?room.width/2:player.x+Math.max(-viewW*.17,Math.min(viewW*.17,((opponent?.x??player.x)-player.x)*.4));
 const half=viewW/2;x=room.width>viewW?Math.max(half,Math.min(room.width-half,x)):room.width/2;
 const desiredTop=room.floor-viewH*.8+Math.min(0,player.y-room.floor+150)*.55;
 const y=Math.max(0,Math.min(900-viewH,desiredTop))+viewH/2;
 const blend=reduced?1:1-Math.exp(-dt*4.5);state.x+=(x-state.x)*blend;state.y+=(y-state.y)*blend;
 return {zoom,viewW,viewH,offsetY,left:state.x-viewW/2,top:Math.max(0,Math.min(900-viewH,state.y-viewH/2)),x:state.x,y:state.y};
}
