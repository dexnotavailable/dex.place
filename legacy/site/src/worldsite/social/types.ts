import type { WorldPose, WorldGhost } from '../game/contracts';
export interface SocialEligibility { worldActive:boolean; focused:boolean; fullContent:boolean; hudOpen:boolean }
export interface SocialPeer extends WorldGhost { accountId:string; muted:boolean; speaking:boolean; opacity:number }
export interface SocialSnapshot { enabled:boolean; status:'off'|'joining'|'active'|'idle'|'covered'|'unavailable'; peers:SocialPeer[]; blocked:{id:string;alias:string}[]; message:string; capacity:boolean; voiceAvailable:boolean }
export interface SocialPayload extends WorldPose { meaningfulMovement?:boolean }
export interface VoiceSnapshot { state:'off'|'joining'|'listening'|'permission'|'ready'|'talking'|'error';message:string;volume:number;muted:boolean;deviceId:string;devices:MediaDeviceInfo[];speakingIds:string[] }
