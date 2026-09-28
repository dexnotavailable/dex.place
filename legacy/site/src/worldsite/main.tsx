import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Volume2, VolumeX, Menu as MenuIcon, ArrowLeft, ArrowRight, ArrowUp, Swords, X, RotateCcw } from 'lucide-react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/jetbrains-mono/400.css';
import { Dialog, FoldSelect, Range, Toggle } from './ui';
import { Downloads, Documentation, Illustrations, Donate } from './pages';
import { download, physicalFiles, type DownloadRecord } from './content';
import type { Section, WorldCommand, WorldHandle, WorldIntent } from './game/contracts';
import { getWorldAudio, audioRegionFor, type AudioScene } from './audio';
import './worldsite.css';
import './control-preview.css';
import './arrival.css';
import { WorldPreview } from './WorldPreview';
import { EXPERIENCE } from './experience';
import {WorldAnnotations,type AnnotationHandle} from './WorldAnnotations';

const sections:Section[]=['downloads','documentation','illustrations','donate'];
const titles:Record<Section,string>={downloads:'Downloads',documentation:'Documentation',illustrations:'Illustrations',donate:'Donate'};
type Layer='section'|'menu'|'settings'|'controls'|'banner'|'result'|'reset-world'|'reset-settings'|null;
type Settings={master:number;music:number;effects:number;ambience:number;motion:'system'|'reduced'|'full';quality:'auto'|'low'|'high';shake:boolean;assistance:boolean;holdToSlash:boolean;touchScale:'small'|'medium'|'large';leftHanded:boolean;browse:boolean};
const defaults:Settings={master:60,music:45,effects:60,ambience:40,motion:'system',quality:'auto',shake:false,assistance:false,holdToSlash:false,touchScale:'medium',leftHanded:false,browse:false};
const readSettings=():Settings=>{
 const result={...defaults};
 try {const saved=JSON.parse(localStorage.getItem('dex.world.settings.v1')||'null');if(!saved||typeof saved!=='object'||Array.isArray(saved))return result;
  for(const key of ['master','music','effects','ambience'] as const)if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))result[key]=Math.max(0,Math.min(100,saved[key]));
  for(const key of ['shake','assistance','holdToSlash','leftHanded','browse'] as const)if(typeof saved[key]==='boolean')result[key]=saved[key];
  if(['system','reduced','full'].includes(saved.motion))result.motion=saved.motion;
  if(['auto','low','high'].includes(saved.quality))result.quality=saved.quality;
  if(['small','medium','large'].includes(saved.touchScale))result.touchScale=saved.touchScale;
 }catch{} return result;
};
const part=(path:string):Section|null=>{try{const section=new URL(path,location.origin).pathname.split('/')[1] as Section;return sections.includes(section)?section:null}catch{return null}};
const inputKeys:Record<string,Extract<WorldCommand,{type:'input'}>['action']>={a:'left',arrowleft:'left',d:'right',arrowright:'right',' ':'jump',j:'slash',shift:'dash',e:'interact'};
const FILE_CHECK_TIMEOUT=15000;
type FileSnapshot=Readonly<DownloadRecord & {deliveryUrl:string;manifestUrl:string;scope:'local'|'public'}>;
type TransferIntent={id:string;snapshot:FileSnapshot;consumed:boolean};
function snapshotFile(record:DownloadRecord):FileSnapshot {
 const local=import.meta.env.DEV&&['127.0.0.1','localhost','[::1]'].includes(location.hostname);
 const delivery=new URL(local?record.url:record.publicUrl,location.origin);
 if(record.status!=='available'||!Number.isSafeInteger(record.bytes)||record.bytes<=0||!/^[a-f0-9]{64}$/i.test(record.sha256)||delivery.origin!==location.origin||(!local&&delivery.protocol!=='https:')||delivery.search||delivery.hash)throw new Error('File is unavailable. Try again.');
 return Object.freeze({...record,platforms:Object.freeze([...record.platforms]) as unknown as string[],deliveryUrl:delivery.href,manifestUrl:new URL('release.json',delivery).href,scope:local?'local':'public'});
}
async function verifyFile(snapshot:FileSnapshot,signal:AbortSignal):Promise<Blob>{
 const response=await fetch(snapshot.manifestUrl,{cache:'no-store',signal,redirect:'error'});
 if(!response.ok)throw new Error('File is unavailable. Try again.');
 const current=await response.json() as DownloadRecord;
 const fields=['productId','releaseId','artifactId','version','filename','bytes','sha256','url','publicUrl','arch'] as const;
 if(current.status!=='available'||fields.some(key=>current[key]!==snapshot[key])||JSON.stringify(current.platforms)!==JSON.stringify(snapshot.platforms))throw new Error('This file selection is no longer available. Choose it again from Downloads.');
 // The initial reward is a small, non-executable documentation ZIP. Check its real
 // bytes as well as metadata; a future installer must use its delivery contract.
 const file=await fetch(snapshot.deliveryUrl,{cache:'no-store',signal,redirect:'error'});
 if(!file.ok||!file.body)throw new Error('File is unavailable. Try again.');
 const length=file.headers.get('content-length');if(length&&Number(length)!==snapshot.bytes)throw new Error('File identity changed. Choose it again from Downloads.');
 const reader=file.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>snapshot.bytes)throw new Error('File identity changed. Choose it again from Downloads.');chunks.push(next.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength}
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(value=>value.toString(16).padStart(2,'0')).join('');
 if(signal.aborted)throw signal.reason;
 if(bytes!==snapshot.bytes||digest!==snapshot.sha256.toLowerCase())throw new Error('File identity changed. Choose it again from Downloads.');
 return new Blob([data],{type:'application/zip'});
}
function requestFile(snapshot:FileSnapshot,blob:Blob){
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=snapshot.filename;document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const fileDetails=(snapshot:Pick<DownloadRecord,'productId'|'releaseId'|'artifactId'>)=>`/downloads/${encodeURIComponent(snapshot.productId)}?release=${encodeURIComponent(snapshot.releaseId)}&artifact=${encodeURIComponent(snapshot.artifactId)}`;

function App(){
 const [path,setPath]=useState(location.pathname+location.search+location.hash);
 const [layer,setLayer]=useState<Layer>(location.pathname==='/'?null:'section');
 const [settings,setSettings]=useState<Settings>(readSettings);const settingsRef=useRef(settings);settingsRef.current=settings;
 const [systemReduced,setSystemReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
 const reduced=settings.motion==='reduced'||(settings.motion==='system'&&systemReduced);
 const [coarse,setCoarse]=useState(matchMedia('(pointer:coarse)').matches);
 const [arrivalRevealing,setArrivalRevealing]=useState(false);const firstArrival=useRef(true);
 const [bannerAnchor,setBannerAnchor]=useState<{x:number;y:number;width?:number;height?:number}|null>(null);
 const [readyAnnouncement,setReadyAnnouncement]=useState('');const [ready,setReady]=useState(false);const [worldError,setWorldError]=useState('');const [worldRevision,setWorldRevision]=useState(0);
 const [focused,setFocused]=useState(false);const [sound,setSound]=useState(false);const [status,setStatus]=useState('');const [region,setRegion]=useState('arrival');
 const [prompt,setPrompt]=useState<Extract<WorldIntent,{type:'prompt'}>>({type:'prompt',label:'',action:'E',visible:false});
 const annotations=useRef<AnnotationHandle>(null);
 const [combat,setCombat]=useState<Extract<WorldIntent,{type:'combat'}>>({type:'combat',active:false,playerHealth:3,bossHealth:6,maximumBossHealth:8,phase:'waiting'});
 const [fightState,setFightState]=useState<'none'|'active'|'victory'|'defeat'>('none');const fightStateRef=useRef(fightState);fightStateRef.current=fightState;
 const [preparing,setPreparing]=useState(false);const [loadSlow,setLoadSlow]=useState(false);
 const [resultFile,setResultFile]=useState<FileSnapshot|null>(null);const [fileStatus,setFileStatus]=useState('');
 const world=useRef<WorldHandle|null>(null);const host=useRef<HTMLDivElement>(null);const frame=useRef<HTMLDivElement>(null);const header=useRef<HTMLElement>(null);const [shellHeight,setShellHeight]=useState(64);
 const layerRef=useRef(layer);layerRef.current=layer;const focusRef=useRef(focused);focusRef.current=focused;
 const pathRef=useRef(path);pathRef.current=path;const armed=useRef<TransferIntent|null>(null);const fileRequest=useRef<AbortController|null>(null);
 const donationAmount=useRef(100000);const entry=useRef<'world-prop'|'navigation'|'direct'>('direct');const prepareRevision=useRef(0);
 const audio=useRef<ReturnType<typeof getWorldAudio>|null>(null);
 const audioStatus=useRef('');const soundWanted=useRef(false);
 const menuReturn=useRef('Settings');
 const command=(c:WorldCommand)=>world.current?.command(c);
 const cancelFight=()=>{armed.current=null;fileRequest.current?.abort();fileRequest.current=null;prepareRevision.current++;setPreparing(false);setFightState('none');fightStateRef.current='none';setResultFile(null);setFileStatus('')};
 const navigate=useCallback((url:string,mode:'world-prop'|'navigation'='navigation')=>{
   const u=new URL(url,location.origin);if(u.origin!==location.origin)return;
   cancelFight();setArrivalRevealing(false);entry.current=mode;setStatus('');
   const next=u.pathname+u.search+u.hash;if(next!==location.pathname+location.search+location.hash)history.pushState({dex:true},'',next);
   setPath(next);setLayer(u.pathname==='/'?null:'section');setFocused(false);world.current?.command({type:'banner',open:false});
   if(mode==='navigation')world.current?.command({type:'travel',section:part(u.pathname)||'home'});
 },[]);
 const focusWorld=()=>{if(!ready||worldError||settings.browse)return;setArrivalRevealing(false);setFocused(true);setLayer(null);frame.current?.focus()};
 const closeSection=()=>{cancelFight();setLayer(null);history.replaceState({dex:true},'','/');setPath('/');setFocused(entry.current==='world-prop'&&ready&&!worldError&&!settings.browse);const target=entry.current==='world-prop'?frame.current:header.current?.querySelector<HTMLElement>(`a[href="/${part(path)||''}"]`);requestAnimationFrame(()=>target?.focus())};
 const closeBanner=()=>{command({type:'banner',open:false});setLayer(null);setFocused(true);frame.current?.focus()};
 const resume=()=>{setLayer(null);setFocused(ready&&!worldError&&!settings.browse);if(ready&&!worldError&&!settings.browse)frame.current?.focus();if(soundWanted.current)audio.current?.resumeFromGesture().catch(()=>setStatus('Sound could not resume. Use Sound to try again.'))};
 const returnTo=(target:'menu'|'settings',label:string)=>{setLayer(target);requestAnimationFrame(()=>{[...document.querySelectorAll<HTMLButtonElement>('.panel button')].find(button=>button.textContent?.trim()===label)?.focus()})};
 const openSubmenu=(target:'settings'|'controls'|'reset-world')=>{menuReturn.current=target==='settings'?'Settings':target==='controls'?'Controls':'Restart world';setLayer(target)};
 const closeLayer=()=>{if(layer==='section')closeSection();else if(layer==='banner')closeBanner();else if(layer==='settings'||layer==='controls'||layer==='reset-settings'||layer==='reset-world')setLayer('menu');else resume()};
 const onIntent=useRef<(e:WorldIntent)=>void>(()=>{});
 onIntent.current=e=>{
   if(e.type==='effect'){audio.current?.playEffect(e.id,e.eventId);}
   else if(e.type==='ready'){if(firstArrival.current){firstArrival.current=false;if(location.pathname==='/'&&!reduced&&!layerRef.current)setArrivalRevealing(true)}setReady(true);setReadyAnnouncement(location.pathname==='/'?'World ready':'');setWorldError('');world.current?.command({type:'travel',section:part(location.pathname)||'home'});}
   else if(e.type==='error'){setWorldError(e.message);setReadyAnnouncement('');setArrivalRevealing(false);setReady(false);setFocused(false);audio.current?.pause();if(layerRef.current==='banner')setLayer(null);cancelFight();if(part(pathRef.current)==='downloads'){setLayer('section');setStatus('World could not load. You can download the file directly.')}}
   else if(e.type==='prompt')setPrompt(e);
   else if(e.type==='projection')annotations.current?.update(e);
   else if(e.type==='region')setRegion(e.region);
   else if(e.type==='combat')setCombat(e);
   else if(e.type==='banner'){setBannerAnchor(e.anchor??null);setLayer(e.open?'banner':null);if(e.open)setFocused(false);}
   else if(e.type==='navigate'){
    let url='/'+e.section;
    if(e.section==='documentation'&&e.itemId){const file=physicalFiles.find(f=>f.id===e.itemId);url=file?.url||'/documentation/dex-place/'+e.itemId;}
    else if(e.itemId)url+='/'+e.itemId;
    navigate(url,'world-prop');
   }else if(e.type==='victory'){
    if(fightStateRef.current!=='active')return;fightStateRef.current='victory';setFightState('victory');setLayer('result');setFocused(false);
    const intent=armed.current;if(intent&&!intent.consumed){setResultFile(intent.snapshot);void handoffFile(intent.snapshot,intent)}else setFileStatus('Replay only');
   }else if(e.type==='defeat'){if(fightStateRef.current!=='active')return;fightStateRef.current='defeat';setFightState('defeat');setLayer('result');setFocused(false);setFileStatus('');}
 };
 useEffect(()=>{
   annotations.current?.update({type:'projection',width:0,height:0,exhibits:[]});setReady(false);
   if(settings.browse||!host.current)return;
   let disposed=false;setReadyAnnouncement('');setReady(false);setWorldError('');setLoadSlow(false);
   const slow=setTimeout(()=>setLoadSlow(true),8000);const deadline=setTimeout(()=>{if(!disposed){disposed=true;setWorldError('World could not load.');world.current?.destroy();world.current=null}},30000);
   import('./game').then(({createWorld})=>{if(disposed||!host.current)return;world.current=createWorld(host.current,e=>{if(disposed)return;if(e.type==='ready'||e.type==='error'){clearTimeout(slow);clearTimeout(deadline)}onIntent.current(e)});}).catch(()=>{if(!disposed)setWorldError('World could not load.')});
   return()=>{disposed=true;clearTimeout(slow);clearTimeout(deadline);world.current?.destroy();world.current=null};
 },[worldRevision,settings.browse]);
 useEffect(()=>{command({type:'pause',paused:!!layer||!focused||settings.browse});command({type:'focus',focused:focused&&!layer&&!settings.browse})},[layer,focused,ready,settings.browse]);
 useEffect(()=>{if(reduced)setArrivalRevealing(false);command({type:'settings',reducedMotion:reduced,quality:settings.quality,shake:settings.shake,holdToSlash:settings.holdToSlash,assistance:settings.assistance});try{localStorage.setItem('dex.world.settings.v1',JSON.stringify(settings))}catch{}},[settings,reduced,ready]);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),c=matchMedia('(pointer:coarse)');const update=()=>{setSystemReduced(m.matches);setCoarse(c.matches)};m.addEventListener('change',update);c.addEventListener('change',update);return()=>{m.removeEventListener('change',update);c.removeEventListener('change',update)}},[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent,down:boolean)=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Escape'&&down){if(!layerRef.current&&focusRef.current){e.preventDefault();setLayer('menu')}return}if(layerRef.current||!focusRef.current)return;const target=e.target as HTMLElement;if(target.closest('input,textarea,select,button,a,[contenteditable=true]'))return;const action=inputKeys[e.key.toLowerCase()];if(action){e.preventDefault();world.current?.command({type:'input',action,down})}};
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false);
  const hidden=()=>{if(document.hidden){world.current?.command({type:'pause',paused:true});audio.current?.pause();if(layerRef.current==='banner'){world.current?.command({type:'banner',open:false});setLayer('menu')}else if(focusRef.current&&!layerRef.current)setLayer('menu');setFocused(false)}};
  const blur=()=>{world.current?.command({type:'pause',paused:true});audio.current?.pause();if(layerRef.current==='banner'){world.current?.command({type:'banner',open:false});setLayer('menu')}else if(focusRef.current&&!layerRef.current)setLayer('menu');setFocused(false)};
  const pop=()=>{cancelFight();setPath(location.pathname+location.search+location.hash);setLayer(location.pathname==='/'?null:'section');setFocused(false);entry.current='direct';world.current?.command({type:'travel',section:part(location.pathname)||'home'})};
  const rotate=()=>{world.current?.command({type:'pause',paused:true});setFocused(false);if(layerRef.current==='banner'){world.current?.command({type:'banner',open:false});setLayer('menu')}else if(!layerRef.current)setLayer('menu')};
  document.addEventListener('keydown',kd);document.addEventListener('keyup',ku);document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);window.addEventListener('popstate',pop);window.addEventListener('orientationchange',rotate);
  return()=>{document.removeEventListener('keydown',kd);document.removeEventListener('keyup',ku);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);window.removeEventListener('popstate',pop);window.removeEventListener('orientationchange',rotate)};
 },[]);
 useEffect(()=>{document.title=(part(path)?titles[part(path)!]+' · ':'')+'dex'},[path]);
 useEffect(()=>{if(!header.current)return;const observer=new ResizeObserver(entries=>{const size=entries[0]?.target.getBoundingClientRect().height;if(size)setShellHeight(size)});observer.observe(header.current);return()=>observer.disconnect()},[]);
 useEffect(()=>{
  const receive=()=>{const state=audio.current?.diagnostics();if(!state)return;if(state.lastError&&!state.muted){audio.current?.mute();return}setSound(state.enabled&&!state.muted&&!state.needsGesture&&!state.lastError);
   const message=state.lastError?'Sound could not load. Use Sound to try again.':state.needsGesture&&soundWanted.current?'Sound is paused. Use Sound or Resume to continue.':'';
   if(message!==audioStatus.current){const previousAudio=audioStatus.current;setStatus(previous=>message||(previous===previousAudio?'':previous));audioStatus.current=message}
  };window.addEventListener('world-audio-status',receive);return()=>{window.removeEventListener('world-audio-status',receive);fileRequest.current?.abort()};
 },[]);
 const currentAudioScene=():AudioScene=>{const section=layer==='section'?part(path):null;const detail=new URL(path,location.origin).pathname.split('/').filter(Boolean).length>1;return {region:fightState==='active'?'boss':audioRegionFor(section||region),content:section==='documentation'?'reader':section==='illustrations'&&detail?'art':section?'panel':'none',paused:document.hidden||!!worldError||!!(layer&&layer!=='section'&&layer!=='banner')}};
 useEffect(()=>{
  if(!audio.current)return;
  audio.current.setGains({master:settings.master/100,music:settings.music/100,effects:settings.effects/100,ambience:settings.ambience/100});
  audio.current.setScene(currentAudioScene());
 },[sound,settings,region,layer,path,fightState,worldError]);
 const soundToggle=async()=>{if(sound){soundWanted.current=false;audio.current?.mute();setSound(false);return}soundWanted.current=true;try{audio.current=getWorldAudio();audio.current.setGains({master:settings.master/100,music:settings.music/100,effects:settings.effects/100,ambience:settings.ambience/100});audio.current.setScene(currentAudioScene());await audio.current.enableFromGesture();const state=audio.current.diagnostics();setSound(state.enabled&&!state.muted&&!state.needsGesture&&!state.lastError);if(!state.lastError)setStatus('')}catch{setSound(false);setStatus('Sound could not start. Try again.')}};
 const checkFile=async(snapshot:FileSnapshot,onValid:(blob:Blob)=>void,onError:(message:string)=>void)=>{
  if(fileRequest.current)return;
  const controller=new AbortController(),rev=++prepareRevision.current;fileRequest.current=controller;setPreparing(true);let timedOut=false;
  const timeout=window.setTimeout(()=>{timedOut=true;controller.abort()},FILE_CHECK_TIMEOUT);
  try{const blob=await verifyFile(snapshot,controller.signal);if(rev===prepareRevision.current&&!controller.signal.aborted)onValid(blob)}
  catch(error){if(rev===prepareRevision.current)onError(timedOut?'File check timed out. Try again.':error instanceof Error?error.message:'File is unavailable. Try again.')}
  finally{clearTimeout(timeout);if(rev===prepareRevision.current){fileRequest.current=null;setPreparing(false)}}
 };
 const enterFight=()=>{const keepMenu=['menu','settings','controls','reset-settings','reset-world'].includes(layerRef.current||'');setFightState('active');fightStateRef.current='active';command({type:'fight',assistance:settingsRef.current.assistance});if(keepMenu){setFocused(false);command({type:'pause',paused:true});command({type:'focus',focused:false})}else{setLayer(null);setFocused(true);frame.current?.focus()}};
 const startFight=async()=>{
  if(!EXPERIENCE.encountersConfigured||armed.current||fileRequest.current||!ready||worldError||settings.browse)return;
  setStatus('');let snapshot:FileSnapshot;try{snapshot=snapshotFile(download)}catch{setStatus('File is unavailable. Try again.');return}
  await checkFile(snapshot,()=>{const next=fileDetails(snapshot);history.replaceState(history.state,'',next);setPath(next);armed.current={id:crypto.randomUUID(),snapshot,consumed:false};setResultFile(snapshot);setFileStatus(`Defeat the boss to download ${snapshot.filename} (${Math.round(snapshot.bytes/1024)} KB).`);enterFight()},message=>setStatus(message));
 };
 const handoffFile=async(snapshot:FileSnapshot,intent?:TransferIntent)=>{
  setFileStatus('Checking file…');await checkFile(snapshot,blob=>{if(intent){if(armed.current!==intent||intent.consumed)return;intent.consumed=true}requestFile(snapshot,blob);setFileStatus('Download requested')},message=>setFileStatus(message));
 };
 const retryFight=async()=>{
  if(fileRequest.current)return;const intent=armed.current;if(!intent){setFileStatus('Replay only');enterFight();return}
  setFileStatus('Checking file…');await checkFile(intent.snapshot,()=>{if(armed.current===intent){setFileStatus('');enterFight()}},message=>{const next=fileDetails(intent.snapshot);navigate(next);setStatus(message)});
 };
 const leaveFight=()=>{const snapshot=armed.current?.snapshot||resultFile||download;navigate(fileDetails(snapshot));requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.download-detail .primary')?.focus())};
 const set=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
 const input=(action:Extract<WorldCommand,{type:'input'}>['action'],down:boolean)=>command({type:'input',action,down});
 const touch=(action:Extract<WorldCommand,{type:'input'}>['action'],label:string,icon:React.ReactNode,enabled=true)=><button aria-label={label} disabled={!enabled} aria-hidden={!enabled} className={!enabled?'reserved-control':undefined} onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);input(action,true)}} onPointerUp={e=>{e.preventDefault();input(action,false)}} onPointerCancel={()=>input(action,false)} onLostPointerCapture={()=>input(action,false)}>{icon}<span>{label}</span></button>;
 const navigateInternal=(url:string)=>{const next=new URL(url,location.origin);if(next.origin!==location.origin)return;if(part(next.pathname)!==part(path)){navigate(url);return}const local=next.pathname+next.search+next.hash;if(local!==location.pathname+location.search+location.hash)history.pushState({dex:true},'',local);setPath(local);setLayer('section');setFocused(false)};
 const openSection=(section:Section)=>{if(part(path)===section&&fightStateRef.current==='none'){setLayer('section');setFocused(false);requestAnimationFrame(()=>document.querySelector<HTMLElement>('.panel-heading h1')?.focus());return}navigate('/'+section)};
 const link=(url:string)=>(e:React.MouseEvent)=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(url)};
 const handleWorldBlur=(e:React.FocusEvent<HTMLDivElement>)=>{if(!e.currentTarget.contains(e.relatedTarget as Node)){setFocused(false);command({type:'pause',paused:true})}};
 const replaceLocation=(url:string)=>{const next=new URL(url,location.origin);if(next.origin!==location.origin)return;const local=next.pathname+next.search+next.hash;history.replaceState(history.state,'',local);setPath(local)};
 const routeSection=part(path);const active=routeSection==='donate'&&!/^\/donate\/?$/.test(new URL(path,location.origin).pathname)?null:routeSection;const panelTitle=active?(active==='donate'?'donate to dex':titles[active]):'Not found';
 return <div className={'site '+(reduced?'reduced ':'')+(settings.browse?'browse ':'')+(settings.leftHanded?'left-handed ':'')} data-touch-scale={settings.touchScale} style={{'--shell-height':shellHeight+'px'} as React.CSSProperties}>
  <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();setFocused(false);const target=layer==='section'?document.querySelector<HTMLElement>('.panel-heading h1'):document.getElementById('home-content-index');target?.focus()}}>Skip to content</a>
  <header className="site-header" ref={header}><a className="wordmark" href="/" aria-label="dex home" onClick={e=>{e.preventDefault();navigate('/')}}>dex</a><nav aria-label="Main" className="main-nav">{sections.map(s=><a key={s} href={'/'+s} aria-current={active===s?'page':undefined} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openSection(s)}}>{titles[s]}</a>)}</nav><div className="header-tools"><button onClick={soundToggle} aria-label={sound?'Sound on':'Sound off'} className="sound-button">{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>{sound?'Sound on':'Sound off'}</span></button><button onClick={()=>setLayer('menu')} aria-label="Menu, pause game"><MenuIcon size={19}/><span>Menu</span></button></div></header>
  <main id="main-content" tabIndex={-1}><span className="sr-only" role="status" aria-live="polite">{readyAnnouncement}</span><nav id="home-content-index" tabIndex={-1} aria-label="Site sections" className="home-content-index">{sections.map(section=><a key={section} href={'/'+section} onClick={link('/'+section)}>{titles[section]}</a>)}</nav><div className="world-frame" ref={frame} tabIndex={0} role="application" aria-label="Explore dex.place. Move with A and D, jump with Space, slash with J, interact with E. Tab leaves the world." onClick={()=>{if(!layer)focusWorld()}} onBlur={handleWorldBlur}><div className="world-canvas" ref={host}/>{(!ready||arrivalRevealing)&&!settings.browse&&<div className={"loading-composition "+(ready?"arrival-reveal":"")} aria-hidden="true" onAnimationEnd={()=>setArrivalRevealing(false)}><WorldPreview section={part(path)||'home'} signal/></div>}{settings.browse&&<WorldPreview section={part(path)||'home'}/>}<WorldAnnotations ref={annotations} active={ready&&!worldError&&!settings.browse&&!arrivalRevealing&&!layer} showHint={focused} coarse={coarse} prompt={prompt} inspect={id=>command({type:'inspect-gallery',id})} focusDisplay={()=>{setFocused(false);command({type:'pause',paused:true});command({type:'focus',focused:false})}}/></div>
   {!layer&&<div className="world-overlay">{!ready&&!settings.browse?<div className="entry-prompt"><p role="status">{worldError|| (loadSlow?'World is still loading. You can use the tabs.':'Loading world…')}</p>{worldError&&<button onClick={()=>setWorldRevision(v=>v+1)}>Try loading world again</button>}</div>:!focused&&!settings.browse?<button className="enter-world" onClick={focusWorld}>Enter world <ArrowRight size={15}/></button>:settings.browse?<div className="browse-index"><nav>{sections.map(s=><a key={s} href={'/'+s} onClick={link('/'+s)}>{titles[s]}<ArrowRight size={18}/></a>)}</nav><button className="text-button" onClick={()=>set('browse',false)}>Return to world</button></div>:null}
    {focused&&ready&&!coarse&&<div className="controls-hint"><span><kbd>A</kbd><kbd>D</kbd> Move</span><span><kbd>Space</kbd> Jump x2</span><span><kbd>J</kbd> Slash</span><span><kbd>Shift</kbd> Dash</span></div>}
    {fightState==='active'&&<div className="combat-hud"><span aria-label={'Health '+combat.playerHealth+' of 3'} className="health-pips">{[0,1,2].map(n=><i key={n} className={n<combat.playerHealth?'filled':''}/>)}</span><span className="boss-meter" aria-label={'Sentinel health '+combat.bossHealth+' of 6'}><i style={{width:combat.bossHealth/6*100+'%'}}/></span><button className="text-button" onClick={()=>setLayer('menu')}>Pause</button><span className="sr-only" role="status">{combat.phase}</span><span className="sr-only" role="status">{fileStatus}</span></div>}
    {focused&&ready&&coarse&&<div className="touch-controls"><div className="touch-move">{touch('left','Move left',<ArrowLeft/>)}{touch('right','Move right',<ArrowRight/>)}</div><div className="touch-actions">{touch('interact','Interact',<span>E</span>,prompt.visible)}{touch('dash','Dash',<ArrowRight/>)}{touch('jump','Jump',<ArrowUp/>)}{touch('slash','Slash',<Swords/>)}</div></div>}
   </div>}
  </main>
  {layer==='section'&&<Dialog key={active||'unknown'} title={panelTitle} close={closeSection} className={active==='illustrations'?'gallery-panel':active==='documentation'?'docs-panel':active==='donate'?'donate-panel':''}>{active==='downloads'?<Downloads encounterConfigured={EXPERIENCE.encountersConfigured} path={path} navigate={navigateInternal} fight={startFight} busy={preparing} worldAvailable={ready&&!worldError&&!settings.browse} assistance={settings.assistance} setAssistance={v=>set('assistance',v)}/>:active==='documentation'?<Documentation path={path} navigate={navigateInternal} replaceLocation={replaceLocation}/>:active==='illustrations'?<Illustrations path={path} navigate={navigateInternal}/>:active==='donate'?<Donate initialAmount={donationAmount.current} onCommit={value=>{donationAmount.current=value}}/>:<><p>This page could not be found.</p><button onClick={()=>navigate('/')}>Back home</button></>}{preparing&&<p role="status">Checking file…</p>}{status&&<p role="status" className="status">{status}</p>}</Dialog>}
  {layer==='banner'&&<Dialog title="Destinations" close={closeBanner} className={'banner-panel'+(bannerAnchor?.width?' banner-native':'')} overlayClassName="banner-veil" overlayStyle={{'--banner-x':(bannerAnchor?.x??260)+'px','--banner-y':(bannerAnchor?.y??120)+'px','--banner-width':(bannerAnchor?.width??350)+'px','--banner-height':(bannerAnchor?.height??340)+'px','--world-top':(host.current?.getBoundingClientRect().top??64)+'px'} as React.CSSProperties}><div className="banner-links">{sections.map(s=><a key={s} href={'/'+s} onClick={link('/'+s)}>{titles[s]}<ArrowRight size={17}/></a>)}</div></Dialog>}
  {layer==='menu'&&<Dialog title="Menu" close={resume} className="menu-panel"><div className="menu-actions"><button className="primary" onClick={resume} disabled={!ready||!!worldError||settings.browse}>Resume<ArrowRight size={17}/></button>{(!ready||worldError)&&!settings.browse&&<p>{worldError?'World is unavailable.':'World is still loading.'} You can browse the site.</p>}<button onClick={()=>openSubmenu('settings')}>Settings</button><button onClick={()=>openSubmenu('controls')}>Controls</button><button onClick={()=>{cancelFight();command({type:'travel',section:active||'home'});set('browse',!settings.browse);setLayer(new URL(path,location.origin).pathname==='/'?null:'section');setFocused(false)}}>{settings.browse?'Return to world':'Browse site'}</button><button onClick={()=>openSubmenu('reset-world')}>Restart world</button>{fightState!=='none'&&<button onClick={leaveFight}>Leave fight</button>}</div></Dialog>}
  {layer==='settings'&&<Dialog title="Settings" close={()=>returnTo('menu','Settings')} className="settings-panel"><div className="settings-groups"><section><h2>Audio</h2><Range label="Master volume" value={settings.master} onChange={v=>set('master',v)}/><Range label="Music volume" value={settings.music} onChange={v=>set('music',v)}/><Range label="Effects volume" value={settings.effects} onChange={v=>set('effects',v)}/><Range label="Ambience volume" value={settings.ambience} onChange={v=>set('ambience',v)}/></section><section><h2>Presentation</h2><FoldSelect label="Motion" value={settings.motion} options={[{value:'system',label:'System'},{value:'reduced',label:'Reduced'},{value:'full',label:'Full'}]} onChange={v=>set('motion',v)}/><FoldSelect label="Quality" value={settings.quality} options={[{value:'auto',label:'Auto'},{value:'low',label:'Low'},{value:'high',label:'High'}]} onChange={v=>set('quality',v)}/><Toggle label="Camera shake" disabled={reduced} value={settings.shake&&!reduced} onChange={v=>{if(!reduced)set('shake',v)}} description={reduced?'Unavailable with reduced motion':undefined}/></section><section><h2>Controls</h2>{EXPERIENCE.encountersConfigured&&<Toggle label="Combat assistance" description="Slower attacks. No player damage." value={settings.assistance} onChange={v=>set('assistance',v)}/>}<Toggle label="Hold to slash" value={settings.holdToSlash} onChange={v=>set('holdToSlash',v)}/><FoldSelect label="Touch scale" value={settings.touchScale} options={[{value:'small',label:'Small'},{value:'medium',label:'Medium'},{value:'large',label:'Large'}]} onChange={v=>set('touchScale',v)}/><Toggle label="Left-handed controls" value={settings.leftHanded} onChange={v=>set('leftHanded',v)}/><figure className="control-preview" style={{'--preview-key':({small:48,medium:56,large:64}[settings.touchScale])+'px'} as React.CSSProperties}><figcaption>Touch preview<span>{settings.leftHanded?'Movement on right':'Movement on left'} · {{small:48,medium:56,large:64}[settings.touchScale]} px</span></figcaption><div className={'control-preview-layout '+(settings.leftHanded?'mirrored':'')} aria-hidden="true"><div className="control-preview-group"><span className="control-preview-key"><ArrowLeft/>Left</span><span className="control-preview-key"><ArrowRight/>Right</span></div><div className="control-preview-group actions"><span className="control-preview-key">E<small>Interact</small></span><span className="control-preview-key"><ArrowRight/>Dash</span><span className="control-preview-key"><ArrowUp/>Jump</span><span className="control-preview-key"><Swords/>Slash</span></div></div></figure></section></div><div className="action-row"><button className="text-button" onClick={()=>returnTo('menu',menuReturn.current)}><ArrowLeft size={15}/>Back</button><button className="text-button" onClick={()=>setLayer('reset-settings')}>Reset settings</button></div></Dialog>}
  {layer==='controls'&&<Dialog title="Controls" close={()=>returnTo('menu','Controls')} className="menu-panel"><dl className="bindings">{[['Move','A / D or arrows'],['Jump / air jump','Space, then Space again'],['Dash','Shift'],['Slash','J'],['Interact','E'],['Pause','Escape']].map(([name,key])=><div key={name}><dt>{name}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl><p>Press Jump again in the air for one extra jump. Release between presses.</p><p>Slash marked cables, seals and rolled banners. Use E to inspect files, terminals and gallery bays, or to summon and ride a lift.</p><p>The tabs open every section directly. Downloads also have a direct file link.</p><button onClick={()=>returnTo('menu',menuReturn.current)}><ArrowLeft size={15}/>Back</button></Dialog>}
  {(layer==='reset-world'||layer==='reset-settings')&&<Dialog title={layer==='reset-world'?'Restart world?':'Reset settings?'} close={()=>returnTo(layer==='reset-settings'?'settings':'menu',layer==='reset-settings'?'Reset settings':'Restart world')} className="menu-panel"><p>{layer==='reset-world'?'Return to the causeway and restore world objects. Your files and settings stay as they are.':'Restore the default settings and turn sound off.'}</p><div className="action-row"><button className="primary" onClick={()=>{if(layer==='reset-world'){cancelFight();command({type:'restart'});history.replaceState({dex:true},'','/');setPath('/');resume()}else{setSettings({...defaults});soundWanted.current=false;audio.current?.mute();setSound(false);returnTo('settings','Reset settings')}}}>{layer==='reset-world'?'Restart':'Reset'}</button><button onClick={()=>returnTo(layer==='reset-settings'?'settings':'menu',layer==='reset-settings'?'Reset settings':'Restart world')}>Cancel</button></div></Dialog>}
  {layer==='result'&&<Dialog title={fightState==='victory'?'Boss defeated':'Try again'} close={leaveFight} className="result-panel"><p>{resultFile?.title||download.title}</p><p className="filename">{resultFile?.filename||download.filename}</p><p role="status">{fileStatus}</p>{fightState==='victory'?<>{armed.current&&resultFile&&<><p>If your browser did not start it, download the file here.</p><a className={'button primary '+(preparing?'disabled':'')} aria-disabled={preparing} href={resultFile.deliveryUrl} download={resultFile.filename} onClick={e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(!preparing)void handoffFile(resultFile)}}>Download file <ArrowRight size={17}/></a></>}<div className="action-row"><button disabled={preparing} onClick={()=>{armed.current=null;setFileStatus('Replay only');enterFight()}}>Play again</button><button className="text-button" onClick={leaveFight}>Back to file details</button>{/no longer available|identity changed/.test(fileStatus)&&<button className="text-button" onClick={()=>navigate('/downloads')}>Back to downloads</button>}</div></>:<><div className="action-row"><button className="primary" disabled={preparing} onClick={retryFight}><RotateCcw size={16}/>Retry fight</button><button onClick={leaveFight}>Leave fight</button></div></>}</Dialog>}
  {status&&layer!=='section'&&layer!=='result'&&<div className="global-status" role="status">{status}<button aria-label="Dismiss" onClick={()=>setStatus('')}><X size={14}/></button></div>}
 </div>
}
createRoot(document.getElementById('root')!).render(<App/>);

