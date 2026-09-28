import Phaser from 'phaser';
import { PALETTE as C, type AssetRect } from './assets';
import type { MapObject } from './map';
import { assemblyAsset, nativeBottom, nativePart, nativeStrip, nativeIndicator, nativeArtSnapshot, type NativeAssemblyArt } from './assemblyArt';
import {buildGalleryFrame} from './galleryFrames';

export interface Assembly {
  source:MapObject; root:Phaser.GameObjects.Container; body:Phaser.GameObjects.Graphics;
  light:Phaser.GameObjects.Graphics; movingPart?:Phaser.GameObjects.Graphics;
  state:string; clock:number; y:number; targetY:number; occupied:boolean; highlighted:boolean;
  artLayout?:{x:number;y:number;screen?:AssetRect;indicator?:AssetRect};
  nativeArt?:NativeAssemblyArt;
  panelVisual?:{activeAt:number;startAmount:number;amount:number;returnAt?:number;returnFrom?:number};
}

function rect(g:Phaser.GameObjects.Graphics,c:number,x:number,y:number,w:number,h:number,a=1) {g.fillStyle(c,a).fillRect(x,y,w,h);}

function applyNativeArt(scene:Phaser.Scene,a:Assembly) {
  const art:NativeAssemblyArt={parts:{},missing:[]};a.nativeArt=art;
  const add=(name:string,id:string,x:number,y:number,crop?:AssetRect)=>nativePart(scene,a.root,art,name,id,x,y,crop);
  const bottom=(name:string,id:string)=>nativeBottom(scene,a.root,art,name,id);
  const asset=(id:string)=>{const found=assemblyAsset(scene,id);if(!found&&!art.missing.includes(id))art.missing.push(id);return found};
  const {source:s,body}=a;
  if(s.kind==='terminal') {
    const housing=bottom('housing','P02');if(!housing)return;body.clear();
    const parts=asset('P02')?.metadata?.parts;
    const screen=parts?.screen||{x:6,y:15,width:11,height:13};
    a.artLayout={x:housing.x,y:housing.y,screen,indicator:parts?.indicator||{x:10,y:31,width:2,height:1}};
    add('screen','P03',housing.x+screen.x,housing.y+screen.y,asset('P03')?.metadata?.parts?.glassCrop||{x:1,y:4,width:11,height:13});
  } else if(s.kind==='home') {
    const post=bottom('post','P04');if(!post)return;body.clear();
    const lens=asset('P04')?.metadata?.parts?.lensPlacement?.rect||{x:8,y:8,width:12,height:12};
    nativeIndicator(scene,a.root,art,'home-lens','P05',post.x+lens.x,post.y+lens.y,{x:1,y:1,width:10,height:10});
  } else if(s.kind==='file') {
    const back=bottom('folder-back','P12');if(!back)return;body.clear();back.image.setTint(0x9ba397);
    const pages=add('folder-pages','P12',-13,-16,{x:3,y:5,width:26,height:13});pages?.image.setTintFill(0xe3e1ca);
    add('folder-cover','P12',-16,-16,{x:0,y:4,width:32,height:16});
    rect(body,C.ink,-17,-1,34,2,.35);
  } else if(s.kind==='gallery') {
    const frame=buildGalleryFrame(scene,a.root,art,String(s.props.itemId));body.clear();
    const aperture=frame.screen;a.artLayout={x:frame.x,y:frame.y,screen:aperture};
    rect(body,0xadb4ab,frame.x+aperture.x,frame.y+aperture.y,aperture.width,aperture.height);
    rect(body,C.paper,-14,frame.y+frame.outerHeight+12,28,2,.6);
  } else if(s.kind==='donate') {
    const plinth=bottom('plinth','P15');if(!plinth)return;body.clear();
    a.artLayout={x:plinth.x,y:plinth.y,screen:asset('P15')?.metadata?.parts?.plaque||{x:16,y:15,width:16,height:10}};
  } else if(s.kind==='banner') {
    const roller=asset('P16'),cloth=asset('P17'),weight=asset('P18');if(!roller||!cloth||!weight)return;
    body.clear();a.movingPart?.setVisible(false);
    const anchor=roller.metadata?.attachments?.clothLeft||{x:12,y:12};
    const rollerX=-(roller.metadata?.attachments?.origin?.x??Math.floor(roller.width/2));
    const clothX=rollerX+anchor.x,clothY=-cloth.height-weight.height;
    rect(body,C.structure,rollerX+1,clothY-anchor.y,4,-clothY+anchor.y);rect(body,C.ink,rollerX-3,-3,12,3);
    rect(body,C.ink,0,clothY+12,2,-clothY-42);
    add('banner-cloth','P17',clothX,clothY);
    add('banner-weight','P18',clothX,clothY);
    add('banner-roller','P16',rollerX,clothY-anchor.y);
  } else if(s.kind==='cable') {
    const cable=asset('P06');if(!cable)return;body.clear();
    const origin=cable.metadata?.attachments?.origin||{x:11,y:176};
    const upper=cable.metadata?.parts?.fixedUpper||{x:0,y:0,width:23,height:146};
    const lower=cable.metadata?.parts?.releasedLower||{x:0,y:146,width:23,height:30};
    add('cable-upper','P06',upper.x-origin.x,upper.y-origin.y,upper);
    add('cable-lower','P06',lower.x-origin.x,lower.y-origin.y,lower);
  } else if(s.kind==='bridge') {
    if(!nativeStrip(scene,a.root,art,'deck','P07',0,0,s.width,false))return;body.clear();
    const pivot=asset('P08')?.metadata?.attachments?.pivot||{x:13,y:31};
    add('bearing','P08',-pivot.x,-pivot.y);
  } else if(s.kind==='lift') {
    if(!nativeStrip(scene,a.root,art,'deck','P09',-Math.floor(s.width/2),0,s.width,true))return;body.clear();
    const rail=asset('FG04'),w=Math.round(s.width),left=-Math.floor(w/2);
    if(rail&&w>=32&&w<=rail.width) {
      add('rail-left','FG04',left,-rail.height,{x:0,y:0,width:16,height:rail.height});
      add('rail-span','FG04',left+16,-rail.height,{x:Math.floor((rail.width-w+32)/2),y:0,width:w-32,height:rail.height});
      add('rail-right','FG04',left+w-16,-rail.height,{x:rail.width-16,y:0,width:16,height:rail.height});
    } else {rect(body,C.structure,left+2,-32,3,32);rect(body,C.structure,left+w-5,-32,3,32);rect(body,C.paper,left+2,-32,w-4,2);}
    rect(body,C.structure,left+6,-38,3,15);
    nativeIndicator(scene,a.root,art,'lift-indicator','P11',left+4,-38,{x:6,y:2,width:16,height:5});
  } else if(s.kind==='landing') {
    if(!asset('P11'))return;body.clear();rect(body,C.structure,-5,-30,10,30);rect(body,C.concrete,-7,-30,14,3);
    nativeIndicator(scene,a.root,art,'lift-indicator','P11',-14,-38,{x:6,y:2,width:16,height:5});
  } else if(s.kind==='seal') {
    if(!asset('P17'))return;body.clear();rect(body,C.ink,-28,-96,56,96);rect(body,C.concrete,-30,-98,60,4);
    add('seal-upper','P17',-6,-55,{x:74,y:20,width:12,height:24});
    add('seal-lower','P17',-6,-31,{x:74,y:44,width:12,height:24});
  } else if(s.kind==='ornament') {
    if(!asset('P05'))return;body.clear();rect(body,C.structure,-1,-78,2,72);
    nativeIndicator(scene,a.root,art,'ornament','P05',-6,-6,{x:1,y:1,width:10,height:10});
  }
  a.root.bringToTop(a.light);
}

function paintNativeArt(a:Assembly,time:number,reduced:boolean,amount:number,pulse:number,panelAmount:number) {
  const art=a.nativeArt;if(!art||!Object.keys(art.parts).length)return false;
  const {source:s,light}=a,parts=art.parts;
  const drop=(name:string,cut:boolean)=>{const part=parts[name];if(!part)return;const t=Math.min(1,a.clock);part.image.setPosition(part.x,part.y+(cut&&!reduced?Math.round(30*t+120*t*t):0)).setAlpha(cut?(reduced?0:Math.max(0,1-(t-.25)/.6)):1);};
  if(s.kind==='terminal'||s.kind==='product') {parts.screen?.image.setAlpha(.82+.18*panelAmount);return false;}
  if(s.kind==='banner'&&parts['banner-cloth']) {
    const cloth=parts['banner-cloth'],weight=parts['banner-weight'];
    const height=Math.max(0,Math.min(cloth.sourceRect.height,Math.round(cloth.sourceRect.height*amount)));
    cloth.visibleHeight=height;cloth.image.setCrop(0,0,cloth.sourceRect.width,height).setVisible(height>0);
    weight.image.setY(cloth.y+height);weight.visibleHeight=weight.sourceRect.height;
    if(a.state==='unfurling'&&amount>=1)a.state='open';else if(a.state==='furling'&&amount<=0)a.state='rolled';
    if(amount<.1){rect(light,C.paper,-1,-34,2,18);rect(light,C.signal,-3,-28,6,10);}
    if(a.highlighted)rect(light,C.warm,cloth.x,cloth.y-5,cloth.sourceRect.width,1,.6);
  } else if(s.kind==='cable'&&parts['cable-upper']) {
    drop('cable-lower',a.state==='cut');
    if(a.highlighted&&a.state!=='cut'){const lower=parts['cable-lower'];rect(light,C.warm,-4,lower.y,8,1);rect(light,C.signal,-1,-13,2,3);}
  } else if(s.kind==='seal'&&parts['seal-upper']) {
    drop('seal-lower',a.state==='open');
    if(a.state==='open')rect(light,C.warm,-20,-90,40,3,.45);else rect(light,C.signal,-4,-40,8,13,a.highlighted?1:.72);
  } else if(s.kind==='ornament'&&parts['ornament:emission']) {
    for(const name of Object.keys(parts))drop(name,a.state==='cut');
    if(a.state!=='cut')parts['ornament:emission'].image.setAlpha((a.highlighted?1:.68)*pulse);
  } else if(s.kind==='home') {
    parts['home-lens:emission']?.image.setAlpha((a.highlighted?1:.72)*pulse);
    if(a.highlighted)rect(light,C.warm,-7,2,14,1);
  } else if(s.kind==='lift'||s.kind==='landing') {
    const target=s.kind==='landing'?a.root.scene.children.getByName('assembly:'+String(s.props.target)) as Phaser.GameObjects.Container|undefined:a.root;
    const state=s.kind==='landing'?String(target?.getData('assemblyState')||''):a.state;
    const here=s.kind==='lift'||Math.abs((target?.y??Infinity)-s.y)<2;
    parts['lift-indicator:emission']?.image.setAlpha(state.startsWith('moving')?pulse:(here?.9:.3));
  } else if(s.kind==='gallery'&&a.artLayout?.screen) {
    const box=a.artLayout.screen,x=a.artLayout.x+box.x,y=a.artLayout.y+box.y;
    rect(light,C.warm,x,y-3,box.width,1,Math.max(a.highlighted?.65:.2,panelAmount*.92));
    if(a.highlighted||panelAmount>0){const alpha=.4+.6*panelAmount;rect(light,C.warm,x,y,6,1,alpha);rect(light,C.warm,x,y,1,8,alpha);rect(light,C.warm,x+box.width-6,y,6,1,alpha);rect(light,C.warm,x+box.width-1,y,1,8,alpha);}
  } else if(s.kind==='donate'&&a.artLayout?.screen) {
    const box=a.artLayout.screen;rect(light,C.warm,a.artLayout.x+box.x+2,a.artLayout.y+box.y+2,box.width-4,1,Math.max(a.highlighted?.85:.4,.45+.5*panelAmount)*pulse);
    if(panelAmount>0)rect(light,C.paper,a.artLayout.x+box.x,a.artLayout.y+box.y-2,box.width,1,panelAmount*.65);
  } else if(s.kind==='file') {
    const cover=parts['folder-cover'],pages=parts['folder-pages'];
    if(cover){const fold=Math.round(panelAmount*12);cover.image.setCrop(0,fold,32,16-fold);cover.visibleHeight=16-fold;}
    if(pages)pages.image.setY(pages.y-Math.round(panelAmount*3));
    if(a.highlighted)rect(light,C.warm,-15,1,30,1);
  } else if(s.kind==='bridge') {
    if(a.state==='lowering')rect(light,C.warm,-2,-2,4,2,.5*pulse);
  } else return false;
  return true;
}

/** Read-only part inventory; the world owner may include this in its snapshot. */
export function assemblyArtSnapshot(a:Assembly) {return nativeArtSnapshot(a.nativeArt);}

const inspectable=(a:Assembly)=>['terminal','product','file','gallery','donate'].includes(a.source.kind);
export function holdAssemblyInspection(a:Assembly,time:number){
 if(!inspectable(a))return false;
 const amount=a.panelVisual?.amount||0;a.state='panel_active';a.panelVisual={activeAt:time,startAmount:amount,amount};return true;
}
export function releaseAssemblyInspection(a:Assembly,time:number,immediate=false){
 if(!inspectable(a)||!a.panelVisual)return;
 if(immediate){a.state='intact';a.panelVisual=undefined;return;}
 if(a.state==='returning')return;
 a.state='returning';a.panelVisual.returnAt=time;a.panelVisual.returnFrom=a.panelVisual.amount;
}

/** Static housing and moving/emissive parts deliberately remain separate render objects. */
export function createAssembly(scene:Phaser.Scene, source:MapObject):Assembly {
  const root=scene.add.container(source.x,source.y).setDepth(source.kind==='bridge'?5:12).setName('assembly:'+source.id);
  const body=scene.add.graphics(); const light=scene.add.graphics(); root.add([body,light]);
  const a:Assembly={source,root,body,light,state:source.kind==='lift'?'docked_lower':source.kind==='banner'?'rolled':'intact',clock:0,y:source.y,targetY:source.y,occupied:false,highlighted:false};
  const w=source.width;
  switch(source.kind) {
    case 'terminal':
      rect(body,C.deep,-20,-49,40,49); rect(body,C.concrete,-18,-49,36,4);
      rect(body,C.structure,-17,-44,34,40); rect(body,C.ink,-13,-39,26,17);
      rect(body,C.concrete,-16,-19,32,3); rect(body,C.deep,-13,-14,27,10);
      rect(body,C.paper,-13,-12,6,1); rect(body,C.structure,-25,-3,50,3); break;
    case 'home':
      rect(body,C.concrete,-11,-3,22,3); rect(body,C.structure,-3,-22,6,20);
      rect(body,C.warm,-2,-26,4,3); break;
    case 'file':
      rect(body,C.ink,-12,-4,25,4); rect(body,C.paper,-10,-16,21,13); rect(body,C.concrete,-7,-12,13,1);
      rect(body,C.concrete,-7,-8,9,1); break;
    case 'gallery':
      rect(body,C.ink,-36,-103,72,103);rect(body,C.concrete,-34,-101,68,4);
      rect(body,0x667c80,-31,-94,62,75);rect(body,C.structure,-28,-91,56,69);
      rect(body,C.paper,-7,-10,14,1); break;
    case 'donate':
      rect(body,C.structure,-27,-8,54,8);rect(body,C.concrete,-20,-40,40,34);
      rect(body,C.paper,-21,-42,42,4);rect(body,C.ink,-12,-47,24,5);
      rect(body,C.warm,-2,-50,4,3); break;
    case 'banner': {
      rect(body,C.structure,-28,-116,4,116);rect(body,C.ink,-31,-3,10,3);
      rect(body,C.structure,-28,-116,58,4);rect(body,C.concrete,-23,-108,46,6);
      const cloth=scene.add.graphics(); root.addAt(cloth,1); a.movingPart=cloth;
      break;
    }
    case 'cable':
      rect(body,C.ink,-2,-132,4,132);rect(body,C.paper,0,-131,1,131);
      rect(body,C.signal,-6,-10,12,12);rect(body,C.concrete,-11,-136,22,4);break;
    case 'bridge':
      rect(body,C.structure,0,0,w,12);rect(body,C.paper,0,0,w,3);rect(body,C.ink,0,12,w,5);
      for(let x=5;x<w;x+=16)rect(body,C.concrete,x,4,1,8);break;
    case 'seal':
      rect(body,C.ink,-28,-96,56,96);rect(body,C.concrete,-30,-98,60,4);
      rect(body,C.paper,-5,-55,10,48);rect(body,C.signal,-6,-39,12,13);break;
    case 'ornament':
      rect(body,C.structure,-1,-78,2,78);body.fillStyle(C.concrete).fillTriangle(-11,-9,10,-9,0,15);
      rect(body,C.warm,-3,-5,6,3);break;
    case 'lift':
      rect(body,C.ink,-w/2,-1,w,13);rect(body,C.paper,-w/2,-1,w,3);
      rect(body,C.concrete,-w/2+7,4,w-14,3);rect(body,C.structure,-w/2,-38,3,38);
      rect(body,C.structure,w/2-3,-38,3,38);rect(body,C.paper,-w/2,-39,8,2);break;
    case 'landing':
      rect(body,C.structure,-5,-34,10,34);rect(body,C.concrete,-7,-34,14,4);
      rect(body,C.ink,-4,-27,8,13);break;
  }
  applyNativeArt(scene,a);
  return a;
}

export function paintAssembly(a:Assembly,time:number,reducedMotion:boolean,bannerAmount:number,presentationTime=time) {
  const {source:s,body,light}=a;light.clear();
  const active=a.highlighted?1:.65;
  const pulse=reducedMotion?1:.88+Math.sin(time*1.25+s.x)*.12;
  const ease=(value:number)=>{const t=Phaser.Math.Clamp(value,0,1);return t*t*(3-2*t)};
  if(a.state==='intact'&&a.panelVisual)releaseAssemblyInspection(a,presentationTime);
  if(a.state==='panel_active'){
   if(!a.panelVisual)holdAssemblyInspection(a,presentationTime);
   const visual=a.panelVisual!;visual.amount=reducedMotion?1:visual.startAmount+(1-visual.startAmount)*ease((presentationTime-visual.activeAt)/.16);
  }else if(a.state==='returning'&&a.panelVisual){
   const visual=a.panelVisual,elapsed=presentationTime-(visual.returnAt??presentationTime);
   visual.amount=reducedMotion?0:(visual.returnFrom??1)*(1-ease(elapsed/.22));
   if(reducedMotion||elapsed>=.22){a.state='intact';a.panelVisual=undefined;}
  }
  const panelAmount=a.panelVisual?.amount||0;
  const nativeHandled=paintNativeArt(a,time,reducedMotion,bannerAmount,pulse,panelAmount);
  if(!nativeHandled) {
  if(s.kind==='terminal'||s.kind==='product') {
    const layout=a.artLayout,screen=layout?.screen,indicator=layout?.indicator;
    if(layout && screen) {
      const x=layout.x+screen.x,y=layout.y+screen.y;
      // Screen and status state animate independently above the static housing.
      rect(light,C.warm,x,y,screen.width,screen.height,(.2+.22*panelAmount)*pulse*active);
      rect(light,C.paper,x+1,y+3,Math.max(1,screen.width-3),1,.72*active);
      rect(light,C.warm,x+1,y+6,Math.max(1,screen.width-6),1,.9*active);
      if(a.highlighted)rect(light,C.warm,x,y,screen.width,1,.95);
      if(indicator)rect(light,a.state==='panel_active'?C.warm:C.signal,layout.x+indicator.x,layout.y+indicator.y,indicator.width,indicator.height,pulse);
    } else {
      rect(light,C.warm,-11,-37,22,13,.68*pulse*active);
      rect(light,C.paper,-8,-34,12,1,.85);rect(light,C.warm,-8,-30,7,1,.9);
      if(a.highlighted)rect(light,C.warm,-18,-48,36,1,.95);
    }
  } else if(s.kind==='banner' && a.movingPart) {
    const cloth=a.movingPart;cloth.clear();
    const h=5+bannerAmount*126;
    rect(cloth,C.ink,-23,-102,49,h+3,.65);
    rect(cloth,C.paper,-23,-102,46,h);
    rect(cloth,C.concrete,-23,-102,3,h,.7);
    rect(cloth,C.structure,-24,-103+h,49,5);
    if(bannerAmount<.1)rect(light,C.signal,-3,-105,6,12);
    if(a.highlighted)rect(light,C.warm,-23,-109,46,2);
  } else if(s.kind==='cable') {
    if(a.state==='cut') {body.clear();rect(body,C.ink,-2,-132,4,103);rect(body,C.paper,0,-131,1,104);}
    else if(a.highlighted)rect(light,C.paper,-7,-11,14,1);
  } else if(s.kind==='seal' && a.state==='open') {
    body.clear();rect(body,C.ink,-28,-96,56,96);rect(body,C.warm,-20,-90,40,4,.45);
  } else if(s.kind==='ornament' && a.state==='cut') {body.setAlpha(.15);}
  else if(s.kind==='lift' || s.kind==='landing') {
    rect(light,a.state.startsWith('moving')?C.warm:C.signal,s.kind==='lift'?-44:-2,s.kind==='lift'?-36:-24,4,4,pulse);
  } else if(s.kind==='gallery')rect(light,C.warm,-30,-97,60,2,a.highlighted?.9:.4);
  else if(s.kind==='donate')rect(light,C.warm,-3,-51,6,3,pulse);
  if(a.highlighted && !['terminal','cable','banner','lift','landing'].includes(s.kind))rect(light,C.warm,-11,3,22,1);
  }
  a.root.setY(Math.round(a.y));
  a.root.setData('assemblyState',a.state);
}
