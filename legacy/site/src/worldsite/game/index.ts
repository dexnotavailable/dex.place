import Phaser from 'phaser';
import { WorldScene } from './WorldScene';
import type { WorldHandle, WorldIntent } from './contracts';

export function createWorld(container:HTMLElement,onIntent:(event:WorldIntent)=>void):WorldHandle {
  let destroyed=false,contextLost=false;
  const scene=new WorldScene(event=>{if(!destroyed&&!contextLost)onIntent(event);});
  const game=new Phaser.Game({
    type:Phaser.AUTO,parent:container,backgroundColor:'#607b86',
    width:Math.max(1,container.clientWidth),height:Math.max(1,container.clientHeight),
    render:{antialias:false,antialiasGL:false,pixelArt:true,roundPixels:true},
    scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.NO_CENTER},
    input:{keyboard:false,mouse:false,touch:false,gamepad:false},
    audio:{noAudio:true},banner:false,scene:[scene],fps:{target:60,smoothStep:false},
  });
  const loseContext=(event:Event)=>{
    if(destroyed||contextLost||event.target!==game.canvas)return;
    event.preventDefault();contextLost=true;
    scene.command({type:'pause',paused:true});
    scene.command({type:'focus',focused:false});
    scene.command({type:'banner',open:false});
    scene.invalidateRenderer();
    game.pause();
    // This instance stays failed even if the browser restores its context.
    // Explicit Retry destroys it and creates a fresh, unfocused world.
    onIntent({type:'error',message:'World could not load.'});
  };
  // Capture reaches the canvas's non-bubbling event and also covers preload.
  container.addEventListener('webglcontextlost',loseContext,true);
  const observer=new ResizeObserver(()=>{const width=container.clientWidth,height=container.clientHeight;if(!destroyed&&!contextLost&&container.isConnected&&width>=32&&height>=32)game.scale.resize(width,height);});
  observer.observe(container);
  const diagnostics=Object.freeze({snapshot:()=>{const state=scene.snapshot();return {...state,ready:state.ready&&!contextLost,contextLost};}});
  Object.defineProperty(window,'__dexWorld',{configurable:true,value:diagnostics});
  return {
    command:command=>{if(!destroyed&&!contextLost)scene.command(command);},
    destroy:()=>{if(destroyed)return;destroyed=true;container.removeEventListener('webglcontextlost',loseContext,true);observer.disconnect();scene.invalidateRenderer();game.destroy(true);if((window as unknown as Record<string,unknown>).__dexWorld===diagnostics)delete (window as unknown as Record<string,unknown>).__dexWorld;},
  };
}
