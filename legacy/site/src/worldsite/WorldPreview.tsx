import {useEffect,useRef,useState} from 'react';
import {cameraFrame,ARRIVAL_SIGNAL} from './camera-frame';
import previews from './content/world-preview.json';

/** This is a crop from the actual renderer, positioned by the same camera math. */
export function WorldPreview({section='home',signal=false}:{section?:keyof typeof previews.entries;signal?:boolean}) {
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
 useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setSize({width:r.width,height:r.height})});observer.observe(ref.current);return()=>observer.disconnect()},[]);
 const profile=size.width/Math.max(1,size.height)<.85?'portrait':'wide';
 const data=previews.entries[section][profile];
 const signalRect=(previews as typeof previews & {arrivalSignal?:typeof ARRIVAL_SIGNAL}).arrivalSignal||ARRIVAL_SIGNAL;
 const cameraBounds=(previews as typeof previews&{cameraBounds?:{left:number;right:number}}).cameraBounds;
 const camera=cameraFrame(size.width,size.height,data.anchor.x,data.anchor.y,previews.mapWidth,false,cameraBounds);
 return <div ref={ref} className="world-preview" aria-hidden="true">{size.height>0&&<><img alt="" draggable={false} loading="eager" {...{fetchpriority:'high'}} decoding="async" src={data.url} width={data.width} height={data.height} style={{left:(data.worldRect.x-camera.left)*camera.zoom,top:(data.worldRect.y-camera.top)*camera.zoom,width:data.worldRect.width*camera.zoom,height:data.worldRect.height*camera.zoom}}/>{signal&&section==='home'&&<i className="preview-signal" style={{left:(signalRect.x-camera.left)*camera.zoom,top:(signalRect.y-camera.top)*camera.zoom,width:signalRect.width*camera.zoom,height:signalRect.height*camera.zoom}}/>}</>}</div>;
}
