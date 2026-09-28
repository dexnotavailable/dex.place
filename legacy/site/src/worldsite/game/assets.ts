export interface AssetRect {x:number;y:number;width:number;height:number}
export interface SceneAsset {id:string;url:string;frame?:AssetRect;repeatFrame?:AssetRect;collisionTop?:number;sprite?:{frameWidth:number;frameHeight:number;frames:number;frameMs:number};parts?:{screen?:AssetRect;indicator?:AssetRect}}
export interface ScenePlacement {id?:string;assetId:string;x:number;y:number;width:number;height:number;depth:number;alpha?:number;scrollFactor?:number;flipX?:boolean;tint?:number;motion?:'haze'|'water'|'cloud';optional?:boolean;portraitOffset?:{x:number;y:number};roomId?:string;crop?:AssetRect}
export interface SceneRoom {id:string;label:string;x:number;width:number;floorY:number;kind:'arrival'|'dispatch'|'archive'|'gallery'|'support'|'threshold';topY?:number;waterY?:number;music:'calm'|'silent'|'arena';windows?:AssetRect[];lights?:{id:string;x:number;y:number;radiusX:number;radiusY:number;color:number;strength:number;flicker?:boolean}[]}
export interface SceneLabel {id:string;text:string;x:number;y:number;roomId?:string}
export interface SceneAssets {assets:SceneAsset[];placements:ScenePlacement[];rooms?:SceneRoom[];labels?:SceneLabel[]}
export interface HeroClip {url:string;frameWidth:number;frameHeight:number;frames:number;durations?:number[]}
export interface HeroAssets {clips:Record<string,HeroClip>;footX:number;footY:number;bodyHeight:number;scale?:number}
export const PUBLIC_ASSETS = {map:'/world/maps/inhabited-v2.json',rooms:'/world/rooms-v2.json',scene:'/world/scene-assets-v2.json',hero:'/world/hero/manifest.json',cast:'/world/cast-v2/manifest.json'};

export const PALETTE = {sky:0xaebec2, paper:0xd7dcd4, concrete:0x84989b, structure:0x3f555d, ink:0x182b35, deep:0x101f29, water:0x537079, signal:0xd85b59, warm:0xe7c999};
export const MOTION = {step:1/60, speed:148, acceleration:1100, deceleration:1500, gravity:740, jumpSpeed:320, shortJumpSpeed:125, coyote:.12, jumpBuffer:.15, dashSpeed:290,dashDuration:.16,dashCooldown:.6,attackDuration:.36,attackStart:.1,attackEnd:.18};
