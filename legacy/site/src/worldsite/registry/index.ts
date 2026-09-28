import Phaser from 'phaser';
import {RegistryScene} from './RegistryScene';
import {fetchCatalogue} from './resources';
import type {GameEvent,GameHandle,HeroManifest,Progress} from './contracts';
export async function createRegistry(container:HTMLElement,emit:(event:GameEvent)=>void,progress:Progress):Promise<GameHandle>{
 const [catalogue,response]=await Promise.all([fetchCatalogue(),fetch('/world/hero/manifest.json')]);if(!response.ok)throw Error('Traveller assets could not load.');const hero:HeroManifest=await response.json();
 let destroyed=false,lost=false;const scene=new RegistryScene(catalogue,hero,progress,event=>{if(!destroyed&&!lost)emit(event)});
 const game=new Phaser.Game({type:Phaser.AUTO,parent:container,width:container.clientWidth||1600,height:container.clientHeight||900,backgroundColor:'#0d191e',render:{antialias:false,antialiasGL:false,pixelArt:true,roundPixels:true},scale:{mode:Phaser.Scale.RESIZE},input:{keyboard:false,mouse:false,touch:false,gamepad:false},audio:{noAudio:true},banner:false,scene:[scene],fps:{target:60,smoothStep:false}});
 const loss=(event:Event)=>{event.preventDefault();if(destroyed||lost)return;lost=true;scene.command({type:'active',value:false});game.pause();emit({type:'error',message:'The renderer stopped. Reload the game to continue.'})};container.addEventListener('webglcontextlost',loss,true);
 const observer=new ResizeObserver(()=>{if(!destroyed&&!lost&&container.clientWidth>0&&container.clientHeight>0)game.scale.resize(container.clientWidth,container.clientHeight)});observer.observe(container);
 const diagnostics=Object.freeze({snapshot:()=>scene.snapshot()});Object.defineProperty(window,'__registry',{configurable:true,value:diagnostics});
 return{command:c=>{if(!destroyed&&!lost)scene.command(c)},snapshot:()=>scene.snapshot(),destroy:()=>{if(destroyed)return;destroyed=true;observer.disconnect();container.removeEventListener('webglcontextlost',loss,true);game.destroy(true);if((window as unknown as Record<string,unknown>).__registry===diagnostics)delete (window as unknown as Record<string,unknown>).__registry}};
}
