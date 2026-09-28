import {useEffect,useRef,useState} from 'react';
import {cameraFrame} from '../camera-frame';
import source from '../content/world-preview.json';

type Frame={url:string;width:number;height:number;worldRect:{x:number;y:number;width:number;height:number};anchor:{x:number;y:number};cameraBounds?:{left:number;right:number}};
/** Responsive frames captured from the real room renderer; never personal art. */
export function V2WorldPreview({visible}:{visible:boolean}){
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
 useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;setSize({width:rect.width,height:rect.height})});observer.observe(ref.current);return()=>observer.disconnect()},[]);
 const ratio=size.width/Math.max(1,size.height),profile=size.height<521?'compact':ratio<.6?'portrait':ratio<.85?'tablet':ratio<1.55?'landscape':ratio<1.68?'desktop':ratio<2.1?'wide':'ultrawide';
 const frames=source.entries.home as Record<string,Frame>,frame=frames[profile]||frames[ratio<.85?'portrait':'wide'];
 const camera=cameraFrame(size.width,size.height,frame.anchor.x,frame.anchor.y,source.mapWidth,false,frame.cameraBounds||source.cameraBounds);
 return <div ref={ref} aria-hidden="true" style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',background:'#829da7',opacity:visible?1:0,visibility:visible?'visible':'hidden',transition:'opacity .3s, visibility .3s',zIndex:2}}>{size.height>0&&<img src={frame.url} alt="" draggable={false} decoding="async" {...{fetchpriority:'high'}} width={frame.width} height={frame.height} style={{position:'absolute',left:(frame.worldRect.x-camera.left)*camera.zoom,top:(frame.worldRect.y-camera.top)*camera.zoom,width:frame.worldRect.width*camera.zoom,height:frame.worldRect.height*camera.zoom,maxWidth:'none',imageRendering:'pixelated'}}/>}</div>;
}
