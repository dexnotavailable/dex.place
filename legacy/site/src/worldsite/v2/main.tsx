import React,{useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,ArrowUpRight,Menu as MenuIcon,Volume2,VolumeX,X,UserRound,Map as MapIcon,RotateCcw,Slash,ChevronsRight} from 'lucide-react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/jetbrains-mono/400.css';
import {Dialog,FoldSelect,Range,Toggle} from '../ui';
import {Documentation,Illustrations,Donate} from '../pages';
import {documentation,documentationEdition,illustrations} from '../content';
import {getWorldAudio,audioRegionFor} from '../audio';
import type {WorldHandle,WorldIntent,WorldProgress,WorldPose,Section} from '../game/contracts';
import {WorldAnnotations,type AnnotationHandle} from '../WorldAnnotations';
import {AccountProvider,useDexAccount,AccountPanel,TreasuryPanel,OwnerPanel} from '../account';
import {readGuestProgress} from '../account/client';
import {ProductRecord} from './ProductRecord';
import {MapRecord} from './MapRecord';
import {SocialBridge,type SocialBridgeHandle} from './SocialBridge';
import {V2WorldPreview} from './WorldPreview';
import '../worldsite.css';
import './site-v2.css';

const order:Section[]=['downloads','donate','illustrations','documentation'];
const titles:Record<Section,string>={downloads:'Downloads',donate:'Donate',illustrations:'Illustrations',documentation:'Documentation'};
type Inspector={kind:'content'|'map'|'account'|'treasury'|'product';path?:string;title:string;productId?:string;encounterId?:string};
type MenuLayer='menu'|'settings'|'controls'|'reset'|null;
type Preferences={master:number;music:number;effects:number;ambience:number;motion:'system'|'reduced'|'full';quality:'auto'|'low'|'high';shake:boolean;holdToSlash:boolean;assistance:boolean;leftHanded:boolean;touchScale:'small'|'medium'|'large'};
const defaultPreferences:Preferences={master:60,music:36,effects:55,ambience:40,motion:'system',quality:'auto',shake:false,holdToSlash:false,assistance:false,leftHanded:false,touchScale:'medium'};
function readPreferences():Preferences {
 try {
  const value=JSON.parse(localStorage.getItem('dex.world.settings.v1')||'{}');
  if(!value||typeof value!=='object'||Array.isArray(value))return {...defaultPreferences};
  const next={...defaultPreferences};
  for(const key of ['master','music','effects','ambience'] as const)if(typeof value[key]==='number'&&Number.isFinite(value[key]))next[key]=Math.round(Math.max(0,Math.min(100,value[key])));
  for(const key of ['shake','holdToSlash','assistance','leftHanded'] as const)if(typeof value[key]==='boolean')next[key]=value[key];
  if(['system','reduced','full'].includes(value.motion))next.motion=value.motion;
  if(['auto','low','high'].includes(value.quality))next.quality=value.quality;
  if(['small','medium','large'].includes(value.touchScale))next.touchScale=value.touchScale;
  return next;
 }catch{return {...defaultPreferences}}
}
const routeSection=(path:string):Section|null=>{const first=new URL(path,location.origin).pathname.split('/')[1];return order.includes(first as Section)?first as Section:null};
const unavailablePath=(path:string)=>{const parts=new URL(path,location.origin).pathname.split('/').filter(Boolean);if(!parts.length)return false;if(['downloads','documentation','illustrations'].includes(parts[0]))return false;if(parts[0]==='donate')return parts.length>2||parts.length===2&&parts[1]!=='treasury';return !(['account','owner'].includes(parts[0])&&parts.length===1)};
const destinationForPath=(path:string)=>unavailablePath(path)?'unavailable':routeSection(path)||(/\/(?:account|owner)(?:\/|\?|#|$)/.test(path)?'account':'downloads');
const inputKeys:Record<string,'left'|'right'|'jump'|'slash'|'dash'|'interact'>={a:'left',d:'right',arrowleft:'left',arrowright:'right',' ':'jump',j:'slash',shift:'dash',e:'interact'};
const labels:Record<string,string>={arrival:'Arrival',junction:'Junction',dispatch:'Dispatch',arena:'Arena',hearth:'Counter',treasury:'Treasury',lookout:'Lookout',reservoir:'Reservoir',gallery:'Gallery',archive:'Archive','return-shaft':'Return lift'};
const locationPath=()=>location.pathname+location.search+location.hash;
const sameProductPath=(from:string,to:string)=>{const a=new URL(from,location.origin),b=new URL(to,location.origin);return /^\/downloads\/[^/]+$/.test(a.pathname)&&a.pathname===b.pathname};

/** Layout survives withdrawal; personal image elements exist only while visible. */
function IllustrationSlot({active,path,navigate}:{active:boolean;path:string;navigate:(url:string)=>void}) {
 const content=useRef<HTMLDivElement>(null),[measurement,setMeasurement]=useState<{path:string;height:number}|null>(null);
 const isIndex=new URL(path,location.origin).pathname.replace(/\/$/,'')==='/illustrations';
 useLayoutEffect(()=>{const node=content.current;if(!active||!node||isIndex)return;const measure=()=>{const height=Math.ceil(node.getBoundingClientRect().height);if(height>0)setMeasurement(value=>value?.path===path&&value.height===height?value:{path,height})};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect()},[active,path,isIndex]);
 const heldHeight=!isIndex&&measurement?.path===path?measurement.height:undefined;
 return <div className="v2-illustration-slot" style={!active&&heldHeight?{minHeight:heldHeight}:undefined} data-active={active}>{active?<div ref={content}><Illustrations path={path} navigate={navigate}/></div>:!heldHeight?<div className="art-grid v2-art-placeholder" aria-hidden="true">{illustrations.map(item=><a key={item.id} tabIndex={-1}><div/><span>{item.title}</span></a>)}</div>:<div aria-hidden="true"/>}</div>;
}

function Site() {
 const account=useDexAccount();const accountRef=useRef(account);accountRef.current=account;
 const [path,setPath]=useState(locationPath);const pathRef=useRef(path);pathRef.current=path;
 const [ready,setReady]=useState(false),[loadError,setLoadError]=useState(''),[loadAttempt,setLoadAttempt]=useState(0);
 const [entered,setEntered]=useState(false),[playing,setPlaying]=useState(false),[webVisible,setWebVisible]=useState(location.pathname!=='/');
 const [soundChoice,setSoundChoice]=useState(()=>{try{return localStorage.getItem('dex.sound.v2')!=='off'}catch{return true}}),[sound,setSound]=useState(false);
 const [room,setRoom]=useState('arrival'),[status,setStatus]=useState(''),[socialHud,setSocialHud]=useState(false);
 const [inspector,setInspector]=useState<Inspector|null>(null),[menu,setMenu]=useState<MenuLayer>(null);
 const [prefs,setPrefs]=useState<Preferences>(readPreferences),[systemReduced,setSystemReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [coarse,setCoarse]=useState(matchMedia('(pointer:coarse)').matches);
 const reduced=prefs.motion==='reduced'||prefs.motion==='system'&&systemReduced;
 const reducedRef=useRef(reduced);reducedRef.current=reduced;
 const [prompt,setPrompt]=useState<Extract<WorldIntent,{type:'prompt'}>>({type:'prompt',label:'',action:'E',visible:false});
 const [health,setHealth]=useState({health:5,maximum:5,state:'alive'});
 const [combat,setCombat]=useState({active:false,playerHealth:3,bossHealth:0,maximumBossHealth:8,phase:'waiting'});
 const [progress,setProgress]=useState<WorldProgress|null>(readGuestProgress);
 const [visit,setVisit]=useState<string|null>(null),[blackout,setBlackout]=useState(false);
 const [passage,setPassage]=useState<Extract<WorldIntent,{type:'room-transition'}>|null>(null);
 const [visibleSections,setVisibleSections]=useState<Set<string>>(new Set([routeSection(locationPath())||'downloads']));
 const [scrollProgress,setScrollProgress]=useState(0);
 const worldHost=useRef<HTMLDivElement>(null),stage=useRef<HTMLElement>(null),web=useRef<HTMLElement>(null),game=useRef<WorldHandle|null>(null),annotations=useRef<AnnotationHandle>(null);
 const audio=useRef(getWorldAudio());const pose=useRef<WorldPose|null>(null);const socialBridge=useRef<SocialBridgeHandle>(null);
 const playingRef=useRef(false),readyRef=useRef(false),enteredRef=useRef(false),inspectorRef=useRef(inspector),menuRef=useRef(menu),visitRef=useRef(visit),transition=useRef(0),transitionTimers=useRef<number[]>([]);
 playingRef.current=playing;readyRef.current=ready;enteredRef.current=entered;inspectorRef.current=inspector;menuRef.current=menu;visitRef.current=visit;
 const initialProgress=useRef(progress);const restoredAccount=useRef('');
 const passageRef=useRef(passage);passageRef.current=passage;
 const menuOrigin=useRef<{game:boolean;opener:HTMLElement|null}>({game:false,opener:null}),menuStack=useRef<MenuLayer[]>([]);
 const eventSink=useRef<(event:WorldIntent)=>void>(()=>{});

 const clearInputs=useCallback(()=>{game.current?.command({type:'focus',focused:false});game.current?.command({type:'pause',paused:true});playingRef.current=false;setPlaying(false)},[]);
 const cancelTransition=()=>{transition.current++;transitionTimers.current.forEach(clearTimeout);transitionTimers.current=[];setBlackout(false)};
 const endVisit=()=>{if(visitRef.current){game.current?.command({type:'leave-product-visit'});visitRef.current=null;setVisit(null)}};
 const scrollToSection=(section:string,immediate=false)=>{const node=document.getElementById(`section-${section}`)||web.current;node?.scrollIntoView({behavior:immediate||reducedRef.current?'instant':'smooth',block:'start'})};
 const navigate=useCallback((url:string,replace=false)=>{
  const sameProductVisit=!!visitRef.current&&sameProductPath(pathRef.current,url);
  cancelTransition();if(!sameProductVisit)endVisit();game.current?.command({type:'close-inspection'});clearInputs();setInspector(null);setMenu(null);setWebVisible(true);
  history[replace?'replaceState':'pushState']({dexV2:true,frame:'web'},'',url);setPath(locationPath());
  requestAnimationFrame(()=>scrollToSection(destinationForPath(url)));
 },[clearInputs,reduced]);
 const openInspector=useCallback((next:Inspector)=>{
  clearInputs();setMenu(null);setInspector(next);
  history.pushState({dexV2:true,frame:'inspection',inspector:next},'',next.path||locationPath());
 },[clearInputs]);
 const enableSound=()=>{
  audio.current.setGains({master:prefs.master/100,music:prefs.music/100,effects:prefs.effects/100,ambience:prefs.ambience/100});
  void audio.current.enableFromGesture().then(()=>{const state=audio.current.diagnostics();setSound(state.enabled&&!state.muted&&!state.needsGesture&&!state.lastError)}).catch(()=>{setSound(false);setStatus('Sound could not start. You can try it again.');});
 };
 const enter=()=>{
  if(!readyRef.current||passageRef.current?.phase==='loading')return;
  endVisit();
  cancelTransition();setInspector(null);setMenu(null);setEntered(true);enteredRef.current=true;setWebVisible(false);setPlaying(true);playingRef.current=true;
  history.replaceState({dexV2:true,frame:'game'},'', '/');setPath('/');
  game.current?.command({type:'pause',paused:false});game.current?.command({type:'focus',focused:true});worldHost.current?.focus({preventScroll:true});
  if(soundChoice)enableSound();else{audio.current.mute();setSound(false)}
 };
 const returnToWorld=()=>{endVisit();window.scrollTo({top:0,behavior:'instant'});enter()};
 const closeInspector=()=>{
  game.current?.command({type:'close-inspection'});setInspector(null);if(history.state?.frame==='inspection')history.back();
  if(enteredRef.current&&stage.current&&stage.current.getBoundingClientRect().bottom>innerHeight*.7){setPlaying(true);playingRef.current=true;game.current?.command({type:'pause',paused:false});game.current?.command({type:'focus',focused:true});worldHost.current?.focus({preventScroll:true})}
 };
 const openMenu=(value:MenuLayer)=>{menuOrigin.current={game:playingRef.current,opener:document.activeElement as HTMLElement};menuStack.current=[];clearInputs();setMenu(value)};
 const menuPage=(value:MenuLayer)=>{menuStack.current.push(menuRef.current);setMenu(value)};
 const closeMenu=()=>{
  if(menuStack.current.length){setMenu(menuStack.current.pop()||null);return}
  setMenu(null);const origin=menuOrigin.current;
  if(origin.game&&readyRef.current&&passageRef.current?.phase!=='loading'&&!inspectorRef.current&&stage.current&&stage.current.getBoundingClientRect().bottom>innerHeight*.7){setPlaying(true);playingRef.current=true;game.current?.command({type:'pause',paused:false});game.current?.command({type:'focus',focused:true});worldHost.current?.focus({preventScroll:true});if(soundChoice)enableSound()}
  else requestAnimationFrame(()=>{if(origin.opener?.isConnected)origin.opener.focus({preventScroll:true})});
 };
 const retryWorld=()=>{cancelTransition();endVisit();clearInputs();initialProgress.current=progress;passageRef.current=null;setPassage(null);setMenu(null);setLoadError('');setLoadAttempt(value=>value+1)};

 eventSink.current=event=>{
  switch(event.type){
   case 'ready':setReady(true);readyRef.current=true;setLoadError('');if(initialProgress.current)game.current?.command({type:'restore-progress',snapshot:initialProgress.current});game.current?.command({type:'pause',paused:!playingRef.current});game.current?.command({type:'focus',focused:playingRef.current});break;
   case 'error':cancelTransition();endVisit();passageRef.current=null;setPassage(null);setPrompt({type:'prompt',label:'',action:'E',visible:false});setLoadError(event.message);setReady(false);readyRef.current=false;clearInputs();break;
   case 'projection':annotations.current?.update(event);break;
   case 'prompt':setPrompt(event);break;
   case 'room-change':setRoom(event.roomId);break;
   case 'room-transition':passageRef.current=event.phase==='ready'?null:event;setPassage(passageRef.current);setBlackout(event.phase==='opening');break;
   case 'region':setRoom(event.region);break;
   case 'pose':pose.current=event.pose;socialBridge.current?.updatePose(event.pose);break;
   case 'health':setHealth(event);break;
   case 'combat':setCombat(event);break;
   case 'progress':setProgress(event.snapshot);if(event.event.kind!=='restore')void accountRef.current.saveProgress(event.snapshot,event.event.id);break;
   case 'navigate':{
    const doc=event.section==='documentation'&&event.itemId?documentation.find(item=>(item.slug===event.itemId||item.id===event.itemId)&&item.versionId===documentationEdition.version):undefined;
    const url=doc?.url||`/${event.section}${event.itemId&&event.section!=='documentation'?'/'+encodeURIComponent(event.itemId):''}`;
    openInspector({kind:'content',title:titles[event.section],path:url});break;
   }
   case 'map-inspect':openInspector({kind:'map',title:'Map'});break;
   case 'service':openInspector(event.service==='account'?{kind:'account',title:'dex account',path:'/account'}:event.service==='treasury'?{kind:'treasury',title:'Treasury',path:'/donate/treasury'}:{kind:'content',title:'Donate',path:'/donate'});break;
   case 'product-approach':openInspector({kind:'product',title:'Dispatch',productId:event.productId,encounterId:event.encounterId});break;
   case 'product-menu':{
    if(visitRef.current===event.visitId)return;clearInputs();setInspector(null);setMenu(null);setBlackout(true);const token=++transition.current;
    transitionTimers.current.push(window.setTimeout(()=>{if(transition.current!==token)return;setVisit(event.visitId);visitRef.current=event.visitId;setWebVisible(true);history.pushState({dexV2:true,frame:'web'},'',`/downloads/${encodeURIComponent(event.productId)}`);setPath(locationPath());document.getElementById('section-downloads')?.scrollIntoView({behavior:'instant',block:'start'});transitionTimers.current.push(window.setTimeout(()=>{if(transition.current===token)setBlackout(false)},reduced?40:250))},reduced?60:540));break;
   }
   case 'effect':if(sound&&playingRef.current)audio.current.playEffect(event.id,event.eventId);break;
   case 'defeat':setStatus('');break;
  }
 };

 useEffect(()=>{
  let cancelled=false,created:WorldHandle|null=null;setReady(false);readyRef.current=false;
  void import('../game').then(({createWorld})=>{if(cancelled||!worldHost.current)return;created=createWorld(worldHost.current,event=>{if(!cancelled)eventSink.current(event)});game.current=created;}).catch(()=>{if(!cancelled)setLoadError('World could not load.')});
  return()=>{cancelled=true;created?.destroy();if(game.current===created)game.current=null};
 },[loadAttempt]);
 useEffect(()=>{const user=account.session?.user;if(ready&&user&&account.progress?.progress&&restoredAccount.current!==user.id){restoredAccount.current=user.id;initialProgress.current=account.progress.progress;game.current?.command({type:'restore-progress',snapshot:account.progress.progress});game.current?.command({type:'pause',paused:!playingRef.current});game.current?.command({type:'focus',focused:playingRef.current})}if(!user)restoredAccount.current=''},[ready,account.session?.user?.id,account.progress]);
 useEffect(()=>{
  const changed=()=>{
   const guest=readGuestProgress()||{schemaVersion:1 as const,worldRevision:pose.current?.worldRevision||'inhabited-v2.1',discoveredRooms:['arrival'],discoveredContent:[],cuts:[],shortcuts:[],checkpointId:'anchor.home',encounterHistory:[]};
   initialProgress.current=guest;restoredAccount.current='';cancelTransition();endVisit();clearInputs();
   game.current?.command({type:'restore-progress',snapshot:guest});game.current?.command({type:'pause',paused:true});game.current?.command({type:'focus',focused:false});setProgress(guest);
  };
  window.addEventListener('dex-account-signed-out',changed);return()=>window.removeEventListener('dex-account-signed-out',changed);
 },[clearInputs]);
 useEffect(()=>{const imported=(event:Event)=>{const snapshot=(event as CustomEvent<WorldProgress>).detail;if(snapshot){initialProgress.current=snapshot;game.current?.command({type:'restore-progress',snapshot});game.current?.command({type:'pause',paused:!playingRef.current});game.current?.command({type:'focus',focused:playingRef.current})}};window.addEventListener('dex-progress-imported',imported);return()=>window.removeEventListener('dex-progress-imported',imported)},[]);
 useEffect(()=>{
  game.current?.command({type:'settings',reducedMotion:reduced,quality:prefs.quality,shake:prefs.shake,holdToSlash:prefs.holdToSlash,assistance:prefs.assistance});
  audio.current.setGains({master:prefs.master/100,music:prefs.music/100,effects:prefs.effects/100,ambience:prefs.ambience/100});
  try{localStorage.setItem('dex.world.settings.v1',JSON.stringify(prefs));localStorage.setItem('dex.sound.v2',soundChoice?'on':'off')}catch{}
 },[ready,prefs,reduced,soundChoice]);
 useEffect(()=>{audio.current.setScene({region:audioRegionFor(room),content:inspector?.kind==='content'&&inspector.path?.startsWith('/illustrations/')?'art':inspector?.path?.startsWith('/documentation/')?'reader':inspector||menu?'panel':'none',paused:!playing});},[playing,room,inspector,menu]);
 useEffect(()=>{if(menu)requestAnimationFrame(()=>document.querySelector<HTMLElement>('.v2-system-panel h1')?.focus({preventScroll:true}))},[menu]);
 useEffect(()=>{const changed=()=>{const state=audio.current.diagnostics();if(state.lastError&&!state.muted){audio.current.mute();return}setSound(state.enabled&&!state.muted&&!state.needsGesture&&!state.lastError);if(state.lastError)setStatus('Sound could not load. Use the sound control to try again.');else if(state.enabled&&!state.muted&&!state.needsGesture)setStatus(value=>value.startsWith('Sound ')?'':value)};window.addEventListener('world-audio-status',changed);return()=>window.removeEventListener('world-audio-status',changed)},[]);
 useEffect(()=>{
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),pointer=matchMedia('(pointer: coarse)');
  const onMotion=()=>setSystemReduced(motion.matches),onPointer=()=>setCoarse(pointer.matches);
  motion.addEventListener('change',onMotion);pointer.addEventListener('change',onPointer);return()=>{motion.removeEventListener('change',onMotion);pointer.removeEventListener('change',onPointer)};
 },[]);
 useEffect(()=>{
  if(!history.state?.dexV2)history.replaceState({dexV2:true,frame:location.pathname==='/'?'game':'web'},'',locationPath());
  const pop=()=>{cancelTransition();if(inspectorRef.current&&history.state?.frame!=='inspection')game.current?.command({type:'close-inspection'});if(!visitRef.current||!sameProductPath(pathRef.current,locationPath()))endVisit();setMenu(null);setPath(locationPath());const state=history.state;setInspector(state?.frame==='inspection'?state.inspector:null);if(state?.frame==='game'){setWebVisible(false);if(enteredRef.current&&readyRef.current){setPlaying(true);playingRef.current=true;game.current?.command({type:'pause',paused:false});game.current?.command({type:'focus',focused:true});worldHost.current?.focus({preventScroll:true})}}else{clearInputs();if(state?.frame!=='inspection'){setWebVisible(true);requestAnimationFrame(()=>scrollToSection(destinationForPath(locationPath()),true))}}};
  window.addEventListener('popstate',pop);if(location.pathname!=='/')requestAnimationFrame(()=>scrollToSection(destinationForPath(locationPath()),true));return()=>window.removeEventListener('popstate',pop);
 },[clearInputs]);
 useEffect(()=>{
  const onScroll=()=>{if(!stage.current)return;const rect=stage.current.getBoundingClientRect();const amount=Math.min(1,Math.max(0,-rect.top/Math.max(1,rect.height*.55)));setScrollProgress(amount);const below=rect.bottom<innerHeight*.68;setWebVisible(below);if(below&&playingRef.current)clearInputs();};
  const onWheel=(event:WheelEvent)=>{if((event.target as Element)?.closest('.v2-social-popover'))return;if(playingRef.current)clearInputs()};window.addEventListener('scroll',onScroll,{passive:true});stage.current?.addEventListener('wheel',onWheel,{passive:true});onScroll();
  const navHeight=Math.ceil(document.querySelector('.v2-web-nav')?.getBoundingClientRect().height||104);
  const observer=new IntersectionObserver(entries=>{setVisibleSections(prev=>{const next=new Set(prev);for(const entry of entries){const name=(entry.target.closest('[data-section]') as HTMLElement)?.dataset.section;if(!name)continue;entry.isIntersecting&&entry.intersectionRatio>=.01?next.add(name):next.delete(name)}return next})},{threshold:0.01,rootMargin:`-${navHeight}px 0px 0px`});
  document.querySelectorAll('[data-section]').forEach(node=>observer.observe(node.getAttribute('data-section')==='illustrations'?node.querySelector('.v2-illustration-slot')!:node));return()=>{window.removeEventListener('scroll',onScroll);stage.current?.removeEventListener('wheel',onWheel);observer.disconnect()};
 },[clearInputs]);
 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable=true]'))return;
   if(event.key==='Escape'&&socialBridge.current?.isHudOpen()){event.preventDefault();socialBridge.current.closeHud();worldHost.current?.focus({preventScroll:true});return}
   if(event.key==='Escape'&&playingRef.current){event.preventDefault();openMenu('menu');return}
   if(target.closest('button,a,[role="button"],[role="listbox"]'))return;
   if(!playingRef.current||inspectorRef.current||menuRef.current||socialBridge.current?.isHudOpen())return;
   if(event.key==='Tab'){clearInputs();return}
   const action=inputKeys[event.key.toLowerCase()];if(action){event.preventDefault();game.current?.command({type:'input',action,down:true})}
  };
  const keyup=(event:KeyboardEvent)=>{const action=inputKeys[event.key.toLowerCase()];if(action)game.current?.command({type:'input',action,down:false})};
  const release=()=>{game.current?.command({type:'input',action:'slash',down:false})};
  const blur=()=>{clearInputs();audio.current.pause()};
  const visibility=()=>{if(document.hidden)blur()};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',blur);window.addEventListener('orientationchange',blur);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('blur',blur);window.removeEventListener('orientationchange',blur);document.removeEventListener('visibilitychange',visibility)};
 },[clearInputs]);

 const navigateInspection=(url:string,replace=false)=>{
  const section=routeSection(url);if(!section){navigate(url,replace);return;}
  const next:Inspector={kind:'content',title:titles[section],path:url};setInspector(next);setPath(url);history.replaceState({dexV2:true,frame:'inspection',inspector:next},'',url);
 };
 const renderContent=(url:string)=>{
  const section=routeSection(url);
  if(section==='downloads')return <ProductRecord path={url} onNavigate={navigate}/>;
  if(section==='illustrations')return <Illustrations path={url} navigate={navigateInspection} onCloseInspection={closeInspector}/>;
  if(section==='documentation')return <Documentation path={url} navigate={navigateInspection} replaceLocation={url=>navigateInspection(url,true)}/>;
  if(section==='donate')return url.startsWith('/donate/treasury')?<TreasuryPanel onBack={()=>navigate('/donate')}/>:<Donate/>;
  return <AccountPanel/>;
 };
 const touch=(action:'left'|'right'|'jump'|'slash'|'dash'|'interact',label:string,children:React.ReactNode)=> <button aria-label={label} disabled={!playing||socialHud} onPointerDown={event=>{event.preventDefault();event.stopPropagation();if(socialBridge.current?.isHudOpen())return;event.currentTarget.setPointerCapture(event.pointerId);game.current?.command({type:'input',action,down:true})}} onPointerUp={()=>game.current?.command({type:'input',action,down:false})} onPointerCancel={()=>game.current?.command({type:'input',action,down:false})} onLostPointerCapture={()=>game.current?.command({type:'input',action,down:false})}>{children}</button>;
 const viewSection=routeSection(path),unavailable=unavailablePath(path);
 const canEnter=ready&&!loadError&&passage?.phase!=='loading';
 return <div className={'site-v2 touch-'+prefs.touchScale+' '+(reduced?'reduce-motion ':'')+(playing?'is-playing':'is-paused')} style={{'--journey-scroll':scrollProgress} as React.CSSProperties}>
  <a className="skip-link" href="#website" onClick={()=>clearInputs()}>Skip to website</a>
  <section ref={stage} className="v2-world-stage" aria-label="Explore dex.place">
   <div className="v2-world-frame"><div ref={worldHost} className="v2-world-canvas" tabIndex={0} role="region" aria-label="World. A and D move, Space double jumps, click or J attacks, E interacts. Tab leaves gameplay." onPointerDown={event=>{if((event.target as HTMLElement).closest('a,button,input'))return;if(socialBridge.current?.isHudOpen()){socialBridge.current.closeHud();return}if(!playingRef.current){if(enteredRef.current)enter();return}event.preventDefault();worldHost.current?.focus({preventScroll:true});game.current?.command({type:'input',action:'slash',down:true})}}/>
    <V2WorldPreview visible={!ready}/>
    <WorldAnnotations ref={annotations} active={entered&&!webVisible} showExhibits={room==='gallery'} showHint={playing&&prompt.visible} coarse={coarse} prompt={prompt} inspect={id=>game.current?.command({type:'inspect-gallery',id})} focusDisplay={clearInputs}/>
    <div className="v2-world-vignette" aria-hidden="true"/>
   </div>
   <SocialBridge ref={socialBridge} onHudChange={setSocialHud} returnGameFocus={()=>worldHost.current?.focus({preventScroll:true})} active={playing} visible={entered&&!webVisible} covered={!!inspector||!!menu} coarse={coarse} onGhosts={peers=>game.current?.command({type:'ghosts',peers})} onVoiceActivity={active=>audio.current.setVoiceActivity(active)} releaseGameInput={()=>{for(const action of ['left','right','jump','slash','dash','interact'] as const)game.current?.command({type:'input',action,down:false})}}/>
<div className="v2-cinema-bar top" aria-hidden="true"/><div className="v2-cinema-bar bottom" aria-hidden="true"/>
   <header className="v2-game-header"><a href="/" className="v2-wordmark" aria-label="dex home" onClick={e=>{e.preventDefault();returnToWorld()}}>dex</a><div><button aria-label={sound?'Turn sound off':'Turn sound on'} onClick={()=>{if(sound){audio.current.mute();setSound(false);setSoundChoice(false)}else{setSoundChoice(true);enableSound()}}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button aria-label="Menu, pause game" onClick={()=>openMenu('menu')}><MenuIcon size={21}/></button></div></header>
   {!entered&&!webVisible&&<div className="v2-entry"><span className="v2-entry-mark" aria-hidden="true">dex</span><div className="v2-entry-actions"><button className="v2-enter" disabled={!canEnter} onClick={enter}>{loadError?'World unavailable':canEnter?'Enter':'Loading'}<ArrowRight size={17}/></button><button className="v2-entry-sound" aria-pressed={soundChoice} onClick={()=>setSoundChoice(v=>!v)}>{soundChoice?<Volume2 size={14}/>:<VolumeX size={14}/>}Sound {soundChoice?'on':'off'}</button></div>{loadError&&<button className="v2-inline-link" onClick={retryWorld}>Try loading again</button>}<a href="#website" className="v2-entry-browse" onClick={()=>clearInputs()}>Website<ArrowDown size={13}/></a></div>}
   {entered&&!ready&&!webVisible&&!inspector&&!menu&&<div className="v2-world-recovery" role={loadError?'alert':'status'}><p>{loadError||'Loading world…'}</p>{loadError&&<button className="v2-button solid" onClick={retryWorld}>Retry world</button>}<button className="v2-inline-link" onClick={()=>navigate('/downloads')}>Website<ArrowDown size={15}/></button></div>}
   {entered&&ready&&!loadError&&!playing&&!webVisible&&!inspector&&!menu&&!blackout&&<button className="v2-resume" disabled={!canEnter} onClick={enter}>{canEnter?'Resume':'Loading'}<ArrowRight size={16}/></button>}
   {entered&&playing&&<div className="v2-life" aria-label={`Health ${health.health} of ${health.maximum}`}><span>{Array.from({length:health.maximum},(_,i)=><i key={i} className={i<health.health?'full':''}/>)}</span></div>}
   {combat.active&&<div className="v2-boss-health"><span>Guardian</span><progress aria-label="Boss health" value={combat.bossHealth} max={combat.maximumBossHealth}/></div>}
   {coarse&&entered&&!webVisible&&<div className={'v2-touch size-'+prefs.touchScale+' '+(prefs.leftHanded?'left-handed':'')}><div className="v2-touch-movement" aria-label="Movement controls">{touch('left','Move left',<ArrowLeft/>)}{touch('right','Move right',<ArrowRight/>)}</div><div className="v2-touch-actions" aria-label="Action controls">{touch('interact','Interact',<span>E</span>)}{touch('dash','Dash',<ChevronsRight/>)}{touch('slash','Attack',<Slash/>)}{touch('jump','Jump; press again for double jump',<ArrowUp/>)}</div></div>}
   <button className="v2-scroll-cue" aria-label="Browse website below" onClick={()=>{clearInputs();web.current?.scrollIntoView({behavior:reduced?'instant':'smooth'})}}><span>Website</span><ArrowDown size={15}/></button>
   <span className="sr-only" role="status">{canEnter?'World ready':loadError||'Loading world'}</span>
   {passage&&entered&&!webVisible&&!inspector&&!menu&&passage.phase!=='opening'&&(passage.phase!=='prepared'||!playing)&&<div className={'v2-passage '+passage.phase} role="status"><span>{passage.phase==='failed'?passage.message||'Passage could not load.':passage.phase==='prepared'?'Passage ready':'Loading passage'}{passage.phase==='loading'&&passage.totalAssets?` · ${passage.loadedAssets||0} / ${passage.totalAssets}`:''}</span>{passage.phase==='failed'&&<button onClick={()=>{game.current?.command({type:'retry-passage'});worldHost.current?.focus({preventScroll:true})}}>Retry passage</button>}</div>}
  </section>
  <main ref={web} id="website" className="v2-website">
   <nav className="v2-web-nav" aria-label="Website"><a href="/" className="v2-wordmark" aria-label="Return to world" onClick={e=>{e.preventDefault();returnToWorld()}}>dex</a><div className="v2-web-links">{order.map(section=><a key={section} href={`/${section}`} aria-current={viewSection===section?'page':undefined} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate('/'+section)}}>{titles[section]}</a>)}</div><a href="/account" className="v2-account-link" aria-label="dex account" onClick={e=>{e.preventDefault();navigate('/account')}}><UserRound size={16}/><span>{account.session?.user?.displayName||'dex account'}</span></a></nav>
   <div className="v2-web-content">
    {unavailable&&<section id="section-unavailable" className="v2-web-section v2-unavailable" aria-label="Page unavailable"><h2>Page unavailable</h2><p>This address does not match a page here.</p><div className="v2-record-actions"><button className="v2-button solid" onClick={()=>navigate('/downloads')}>Downloads<ArrowRight size={16}/></button><a className="v2-inline-link" href="/">Return to world<ArrowUpRight size={16}/></a></div></section>}
    <section id="section-downloads" data-section="downloads" className="v2-web-section"><div className="v2-section-title"><span>01</span><h2>Downloads</h2>{visit&&<button className="v2-inline-link" onClick={returnToWorld}>Return to world<ArrowUpRight size={16}/></button>}</div><ProductRecord path={viewSection==='downloads'?path:'/downloads'} onNavigate={navigate}/></section>
    <section id="section-donate" data-section="donate" className="v2-web-section v2-donate-section"><div className="v2-section-title"><span>02</span><h2>Donate</h2><a className="v2-inline-link" href="/donate/treasury" onClick={e=>{e.preventDefault();navigate('/donate/treasury')}}>Treasury<ArrowUpRight size={16}/></a></div><div className="v2-donation-layout"><div className="v2-donation-record">{!unavailable&&path.startsWith('/donate/treasury')?<TreasuryPanel onBack={()=>navigate('/donate')}/>:<Donate/>}</div><aside className="v2-treasury-preview"><div className="v2-small-rule"/><p className="v2-kicker">Treasury</p><TreasuryPanel/></aside></div></section>
    <section id="section-illustrations" data-section="illustrations" className="v2-web-section"><div className="v2-section-title"><span>03</span><h2>Illustrations</h2></div><IllustrationSlot active={visibleSections.has('illustrations')} path={viewSection==='illustrations'?path:'/illustrations'} navigate={navigate}/></section>
    <section id="section-documentation" data-section="documentation" className="v2-web-section"><div className="v2-section-title"><span>04</span><h2>Documentation</h2></div><Documentation path={viewSection==='documentation'?path:'/documentation'} navigate={navigate} replaceLocation={url=>navigate(url,true)}/></section>
    {!unavailable&&path.startsWith('/account')&&<section id="section-account" className="v2-web-section v2-account-section"><div className="v2-section-title"><span><UserRound size={17}/></span><h2>dex account</h2></div><AccountPanel/></section>}
    {!unavailable&&path.startsWith('/owner')&&<section id="section-account" className="v2-web-section"><OwnerPanel/></section>}
   </div>
   <footer className="v2-footer"><a href="/" className="v2-wordmark" onClick={e=>{e.preventDefault();returnToWorld()}}>dex</a><button onClick={()=>openMenu('settings')}>Settings</button><button onClick={()=>openMenu('controls')}>Controls</button><a href="/documentation" onClick={e=>{e.preventDefault();navigate('/documentation')}}>Documentation</a></footer>
  </main>
  {inspector&&<Dialog title={inspector.title} close={closeInspector} className={'v2-inspector '+(inspector.path?.startsWith('/illustrations/')?'v2-art-inspector':'')} overlayClassName="v2-veil">{inspector.kind==='map'?<MapRecord roomId={room} discovered={progress?.discoveredRooms||[]}/>:inspector.kind==='account'?<AccountPanel onClose={closeInspector}/>:inspector.kind==='treasury'?<TreasuryPanel/>:inspector.kind==='product'?<div className="v2-arena-entry"><p className="v2-kicker">dex.place</p><h2>Documentation</h2><button className="v2-button solid" onClick={()=>{const selected=inspector;setInspector(null);history.replaceState({dexV2:true,frame:'game'},'','/');setPath('/');setPlaying(true);playingRef.current=true;game.current?.command({type:'pause',paused:false});game.current?.command({type:'focus',focused:true});game.current?.command({type:'enter-encounter',productId:selected.productId!,encounterId:selected.encounterId!,assistance:prefs.assistance});worldHost.current?.focus({preventScroll:true})}}>Enter arena<ArrowRight size={17}/></button></div>:<>{renderContent(inspector.path!)}<button className="v2-inspection-browse" onClick={()=>navigate(inspector.path!)}>Open in website<ArrowUpRight size={15}/></button></>}</Dialog>}
  {menu&&<Dialog title={menu==='menu'?'Menu':menu==='settings'?'Settings':menu==='controls'?'Controls':'Restart world'} close={closeMenu} className="v2-system-panel" overlayClassName="v2-veil">
   {menu==='menu'?<div className="v2-menu-list"><button disabled={!canEnter} onClick={returnToWorld}>{loadError?'World unavailable':canEnter?'Resume':'Loading'}<ArrowRight size={17}/></button>{loadError&&<><p role="status">{loadError}</p><button onClick={retryWorld}>Retry world<RotateCcw size={15}/></button></>}<button onClick={()=>navigate('/downloads')}>Website<ArrowDown size={16}/></button>{progress?.cuts.includes('cut.map.junction')&&<button onClick={()=>{setMenu(null);openInspector({kind:'map',title:'Map'})}}>Map<MapIcon size={17}/></button>}<button onClick={()=>navigate('/account')}>dex account<UserRound size={17}/></button><button onClick={()=>menuPage('settings')}>Settings</button><button onClick={()=>menuPage('controls')}>Controls</button><button disabled={!ready} onClick={()=>menuPage('reset')}>Restart world<RotateCcw size={15}/></button></div>:menu==='settings'?<div className="v2-settings"><Range label="Master" value={prefs.master} onChange={master=>setPrefs(p=>({...p,master}))}/><Range label="Music" value={prefs.music} onChange={music=>setPrefs(p=>({...p,music}))}/><Range label="Effects" value={prefs.effects} onChange={effects=>setPrefs(p=>({...p,effects}))}/><Range label="Ambience" value={prefs.ambience} onChange={ambience=>setPrefs(p=>({...p,ambience}))}/><FoldSelect label="Motion" value={prefs.motion} options={[{value:'system',label:'System'},{value:'reduced',label:'Reduced'},{value:'full',label:'Full'}]} onChange={motion=>setPrefs(p=>({...p,motion}))}/><FoldSelect label="Quality" value={prefs.quality} options={[{value:'auto',label:'Auto'},{value:'low',label:'Low'},{value:'high',label:'High'}]} onChange={quality=>setPrefs(p=>({...p,quality}))}/><Toggle label="Camera shake" value={prefs.shake} onChange={shake=>setPrefs(p=>({...p,shake}))}/><Toggle label="Hold to attack" value={prefs.holdToSlash} onChange={holdToSlash=>setPrefs(p=>({...p,holdToSlash}))}/><Toggle label="Combat assistance" description="Slower attacks. No player damage in the arena." value={prefs.assistance} onChange={assistance=>setPrefs(p=>({...p,assistance}))}/><FoldSelect label="Touch-control size" value={prefs.touchScale} options={[{value:'small',label:'Small'},{value:'medium',label:'Medium'},{value:'large',label:'Large'}]} onChange={touchScale=>setPrefs(p=>({...p,touchScale}))}/><Toggle label="Left-handed touch controls" value={prefs.leftHanded} onChange={leftHanded=>setPrefs(p=>({...p,leftHanded}))}/></div>:menu==='controls'?<dl className="v2-controls-list"><div><dt>A / D · ← / →</dt><dd>Move</dd></div><div><dt>Space</dt><dd>Jump · press again in the air</dd></div><div><dt>Click / J</dt><dd>Attack</dd></div><div><dt>E</dt><dd>Inspect / use</dd></div><div><dt>Shift</dt><dd>Dash</dd></div><div><dt>V</dt><dd>Hold to talk when voice is enabled</dd></div><div><dt>Esc</dt><dd>Pause / close</dd></div><div><dt>Scroll / Tab</dt><dd>Leave gameplay for the website</dd></div></dl>:<div><p>Restart this world’s exploration and return to the arrival. Your account and donation history stay.</p><div className="v2-record-actions"><button className="v2-button solid" onClick={()=>{endVisit();game.current?.command({type:'restart'});setMenu(null);returnToWorld()}}>Restart</button><button className="v2-button" onClick={closeMenu}>Cancel</button></div></div>}
  </Dialog>}
  <div className={'v2-blackout '+(blackout&&!menu&&!inspector&&(!webVisible||!!visit)?'active':'')} aria-hidden="true"/>
  <div className="v2-status" role="status">{status}</div>
 </div>;
}

createRoot(document.getElementById('root')!).render(<AccountProvider><Site/></AccountProvider>);
