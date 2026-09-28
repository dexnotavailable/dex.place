import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { ChevronDown, X } from 'lucide-react';

export function FoldSelect<T extends string>({label,value,options,onChange}:{label:string;value:T;options:{value:T;label:string}[];onChange:(v:T)=>void}) {
 const [open,setOpen]=useState(false);
 const id=useId();const box=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false)};
  document.addEventListener('pointerdown',outside);
  const raf=requestAnimationFrame(()=>{(list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')||list.current?.querySelector<HTMLButtonElement>('[role="option"]'))?.focus({preventScroll:true});list.current?.scrollIntoView({block:'nearest',behavior:'auto'})});
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('pointerdown',outside)};
 },[open]);
 const close=()=>{setOpen(false);trigger.current?.focus()};
 return <div className="fold-select" ref={box} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false)}} onKeyDown={e=>{
  if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}
  if(!open)return;
  const all=[...list.current!.querySelectorAll<HTMLButtonElement>('[role="option"]')];const i=all.indexOf(document.activeElement as HTMLButtonElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();all[(i+(e.key==='ArrowDown'?1:all.length-1))%all.length]?.focus()}
  else if(e.key==='Home'||e.key==='End'){e.preventDefault();all[e.key==='Home'?0:all.length-1]?.focus()}
 }}>
  <span className="field-label" id={id+'-label'}>{label}</span>
  <button ref={trigger} type="button" aria-labelledby={id+'-label '+id+'-value'} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id+'-options':undefined} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true)}}}><span id={id+'-value'}>{options.find(o=>o.value===value)?.label}</span><ChevronDown size={15}/></button>
  {open&&<div ref={list} id={id+'-options'} role="listbox" aria-labelledby={id+'-label'} className="fold-options">{options.map(o=><button role="option" tabIndex={o.value===value?0:-1} aria-selected={o.value===value} key={o.value} onClick={()=>{onChange(o.value);close()}}>{o.label}<span aria-hidden="true">{o.value===value?'•':''}</span></button>)}</div>}
 </div>
}
export function Dialog({title,close,children,className='',overlayClassName='',overlayStyle}:{title:string;close:()=>void;children:ReactNode;className?:string;overlayClassName?:string;overlayStyle?:CSSProperties}) {
 const ref=useRef<HTMLDivElement>(null); const restore=useRef<HTMLElement|null>(null);
 useEffect(()=>{const panel=ref.current;restore.current=document.activeElement as HTMLElement;panel?.querySelector<HTMLElement>('h1')?.focus();return()=>{const active=document.activeElement;if((active===document.body||panel?.contains(active))&&restore.current?.isConnected)restore.current.focus()}},[]);
 return <div className={"veil "+overlayClassName} style={overlayStyle} onPointerDown={e=>{if(overlayClassName==='banner-veil'&&e.target===e.currentTarget){e.preventDefault();e.stopPropagation();close()}}}><div ref={ref} className={'panel '+className} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(!document.fullscreenElement)close()}if(e.key==='Tab'){const list=[...ref.current!.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement?.tagName==='H1')){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}}><div className="panel-rail"/><header className="panel-heading"><h1 tabIndex={-1}>{title}</h1><button className="icon-button" onClick={close} aria-label={'Close '+title}><X size={19}/></button></header><div className="panel-body">{children}</div><div className="panel-hem"/></div></div>
}
export function Toggle({label,value,onChange,description,disabled=false}:{label:string;value:boolean;onChange:(v:boolean)=>void;description?:string;disabled?:boolean}){const id=useId();return <label className="toggle-row"><span>{label}{description&&<small id={id}>{description}</small>}</span><input type="checkbox" aria-label={label} aria-describedby={description?id:undefined} disabled={disabled} checked={value} onChange={e=>onChange(e.target.checked)}/><i aria-hidden="true"/></label>}
export function Range({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){return <label className="range-row"><span>{label}<output>{value}%</output></span><input aria-label={label} type="range" min={0} max={100} step={5} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
export async function copyText(text:string){if(!navigator.clipboard)throw new Error('Clipboard unavailable. Select and copy the text.');await navigator.clipboard.writeText(text)}
