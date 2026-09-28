import {ROOM_IDS,type Progress,type RoomId,type Settings} from './contracts';
export const SAVE_KEY='dex.registry.guest.v1',SETTINGS_KEY='dex.registry.preferences.v1';
export const defaultProgress=():Progress=>({version:'registry-1',checkpoint:'arrival',rooms:['arrival'],cuts:[],courtyard:false,acknowledged:false,art:[],wins:0});
export const defaultSettings:Settings={sound:true,master:.6,music:.36,effects:.55,reduced:false,assistance:false,touchSize:'normal'};
export function parseProgress(raw:unknown):Progress {
 const p=defaultProgress();if(!raw||typeof raw!=='object'||(raw as Progress).version!==p.version)return p;
 const value=raw as Partial<Progress>,rooms=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter((x):x is RoomId=>ROOM_IDS.includes(x)))]:[];
 p.rooms=[...new Set<RoomId>(['arrival',...rooms(value.rooms)])];
 if(value.checkpoint&&ROOM_IDS.includes(value.checkpoint)&&value.checkpoint!=='arena')p.checkpoint=value.checkpoint;
 p.cuts=Array.isArray(value.cuts)?[...new Set(value.cuts.filter(x=>['map','bridge'].includes(x)))]:[];
 p.courtyard=value.courtyard===true;p.acknowledged=p.courtyard&&value.acknowledged===true;
 p.art=Array.isArray(value.art)?[...new Set(value.art.filter(x=>typeof x==='string'&&x.length<100))].slice(0,100):[];
 p.wins=typeof value.wins==='number'&&Number.isFinite(value.wins)?Math.max(0,Math.min(100000,Math.floor(value.wins))):0;return p;
}
export function readProgress(){try{return parseProgress(JSON.parse(localStorage.getItem(SAVE_KEY)||'null'))}catch{return defaultProgress()}}
export function saveProgress(p:Progress){try{localStorage.setItem(SAVE_KEY,JSON.stringify(p));return true}catch{return false}}
export function readSettings():Settings {try{const p=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(!p||typeof p!=='object')return {...defaultSettings,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches};return {...defaultSettings,...Object.fromEntries(['sound','reduced','assistance'].filter(k=>typeof p[k]==='boolean').map(k=>[k,p[k]])),...Object.fromEntries(['master','music','effects'].filter(k=>typeof p[k]==='number'&&Number.isFinite(p[k])).map(k=>[k,Math.max(0,Math.min(1,p[k]))])),touchSize:p.touchSize==='large'?'large':'normal'}}catch{return {...defaultSettings}}}
