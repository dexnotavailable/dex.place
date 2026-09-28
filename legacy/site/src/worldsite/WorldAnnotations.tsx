import {forwardRef,useImperativeHandle,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {illustrations} from './content';
import type {WorldIntent,WorldProjection} from './game/contracts';
import heroMasks from './hero-occlusion.json';
import './world-annotations.css';

type Prompt=Extract<WorldIntent,{type:'prompt'}>;
export interface AnnotationHandle {update:(projection:WorldProjection)=>void}
type Props={active:boolean;showExhibits?:boolean;showHint:boolean;coarse:boolean;prompt:Prompt;inspect:(id:string)=>void;focusDisplay:()=>void};
const maskRuns=new Map<string,number[][]>();

function exhibitClip(projection:WorldProjection) {
 const h=projection.hero;if(!h)return undefined;
 const mask=(heroMasks as Record<string,string[]>)[h.clip]?.[h.frame];if(!mask)return undefined;
 const key=h.clip+':'+h.frame;let runs=maskRuns.get(key);if(!runs){runs=[...mask.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)].map(row=>[Number(row[1]),Number(row[2]),Number(row[3])]);maskRuns.set(key,runs)}
 let path=`M0 0H${projection.width}V${projection.height}H0Z`;
 // One outer rectangle plus the authored opaque pixel runs, even-odd, reveals
 // the canvas actor underneath. Inline CSS paths also work in WebKit, where
 // a fragment URL to an SVG mask on an HTML element was ignored.
 for(const [x,y,width] of runs) {
  const left=Math.round(h.x+(h.flip?200-x-width:x)*h.width/200),top=Math.round(h.y+y*h.height/200);
  const right=Math.round(h.x+(h.flip?200-x:x+width)*h.width/200),bottom=Math.round(h.y+(y+1)*h.height/200);
  if(right>left&&bottom>top)path+=`M${left} ${top}H${right}V${bottom}H${left}Z`;
 }
 return `path(evenodd, '${path}')`;
}

function Exhibit({entry,inspect,focusDisplay}:{entry:WorldProjection['exhibits'][number];inspect:Props['inspect'];focusDisplay:Props['focusDisplay']}) {
 const art=illustrations.find(a=>a.id===entry.itemId&&a.usage==='illustration-display-only');
 const [failed,setFailed]=useState(false);
 if(!art)return null;
 return <a className="world-exhibit" data-bay-id={entry.id} data-art-id={art.id} href={'/illustrations/'+encodeURIComponent(art.id)} aria-label={'Inspect '+art.title} style={{left:entry.x,top:entry.y,width:entry.width,height:entry.height}}
  onFocus={focusDisplay} onClick={event=>{event.stopPropagation();if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();inspect(entry.id)}}>
  {failed?<span className="exhibit-error">Image unavailable</span>:<img src={art.thumbnailSrc} width={art.thumbnailWidth} height={art.thumbnailHeight} alt={art.alt} draggable={false} decoding="async" onError={()=>setFailed(true)}/>}
 </a>;
}

export const WorldAnnotations=forwardRef<AnnotationHandle,Props>(function WorldAnnotations({active,showExhibits=true,showHint,coarse,prompt,inspect,focusDisplay},ref){
 const [projection,setProjection]=useState<WorldProjection>({type:'projection',width:0,height:0,exhibits:[]});
 const hint=useRef<HTMLDivElement>(null),[hintSize,setHintSize]=useState({width:0,height:0});
 useImperativeHandle(ref,()=>({update:setProjection}),[]);
 const clip=useMemo(()=>exhibitClip(projection),[projection]);
 useLayoutEffect(()=>{const el=hint.current;if(!el)return;const measure=()=>{const r=el.getBoundingClientRect();setHintSize(old=>old.width===r.width&&old.height===r.height?old:{width:r.width,height:r.height})};const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect()},[active,showHint,prompt.visible]);
 if(!active)return null;
 const anchor=projection.promptAnchor;
 const margin=12,maxWidth=Math.max(80,Math.min(260,projection.width-2*margin));
 const left=anchor?Math.max(margin,Math.min(projection.width-hintSize.width-margin,anchor.x-hintSize.width/2)):margin;
 const top=anchor?Math.max(margin,Math.min(projection.height-hintSize.height-margin,anchor.y-hintSize.height-8)):margin;
 return <div className="world-annotations">
  {showExhibits&&!!projection.exhibits.length&&<div className="world-exhibits" style={{clipPath:clip}}>{projection.exhibits.map(entry=><Exhibit key={entry.id+':'+entry.itemId} entry={entry} inspect={inspect} focusDisplay={focusDisplay}/>)}</div>}
  {showHint&&prompt.visible&&anchor&&<div ref={hint} className="target-hint" role="status" aria-live="polite" style={{left,top,maxWidth}}><kbd>{coarse?'Interact':prompt.action}</kbd><span>{prompt.label}</span></div>}
 </div>;
});
