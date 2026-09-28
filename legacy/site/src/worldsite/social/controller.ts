import {accountRequest,loadAccountSession} from '../account/client';
import type {WorldPose} from '../game/contracts';
import type {SocialEligibility,SocialPeer,SocialSnapshot} from './types';

export class SocialController {
  private state:SocialSnapshot={enabled:false,status:'off',peers:[],blocked:[],message:'',capacity:false,voiceAvailable:false};
  private pose:WorldPose|null=null;
  private eligibility:SocialEligibility={worldActive:false,focused:false,fullContent:false,hudOpen:false};
  private sequence=0;private timer:number;private busy=false;private generation=0;private destroyed=false;private knownAccount='';private listeners=new Set<(state:SocialSnapshot)=>void>();
  private withdrawListeners=new Set<()=>void>();
  private lastRoom='';
  private speakingIds=new Set<string>();
  private networkSuspended=false;
  private presencePosted=false;
  private poseAbort:AbortController|null=null;
  constructor(onChange?:(snapshot:SocialSnapshot)=>void){if(onChange)this.listeners.add(onChange);this.timer=window.setInterval(()=>void this.tick(),100);window.addEventListener('blur',this.withdraw);window.addEventListener('pagehide',this.withdraw);window.addEventListener('orientationchange',this.withdraw);document.addEventListener('visibilitychange',this.onVisibility);window.addEventListener('dex-account-signed-out',this.signOut);}
  snapshot=():SocialSnapshot=>({...this.state,peers:[...this.state.peers],blocked:[...this.state.blocked]});
  subscribe=(listener:(state:SocialSnapshot)=>void)=>{this.listeners.add(listener);listener(this.snapshot());return()=>{this.listeners.delete(listener);};};
  onWithdraw=(listener:()=>void)=>{this.withdrawListeners.add(listener);return()=>{this.withdrawListeners.delete(listener);};};
  private emit(){if(!this.destroyed)for(const listener of this.listeners)listener(this.snapshot());}
  setWorld(pose:WorldPose,eligibility:SocialEligibility){const previous=this.eligible(),hud=this.eligibility.hudOpen;this.pose=pose;this.eligibility=eligibility;if(this.lastRoom&&this.lastRoom!==pose.roomId){this.withdraw();}this.lastRoom=pose.roomId;if(previous&&!this.eligible())this.withdraw();else if(hud!==eligibility.hudOpen)this.emit();}
  setEligibility(eligibility:SocialEligibility){const previous=this.eligible(),hud=this.eligibility.hudOpen;this.eligibility=eligibility;if(previous&&!this.eligible())this.withdraw();else if(hud!==eligibility.hudOpen)this.emit();}
  setSpeaking(ids:string[]){this.speakingIds=new Set(ids);let changed=false;this.state.peers=this.state.peers.map(peer=>{const speaking=this.speakingIds.has(peer.id)&&!peer.muted&&peer.opacity>=1;if(speaking!==peer.speaking)changed=true;return {...peer,speaking};});if(changed)this.emit();}
  eligible(){return this.state.enabled&&!this.networkSuspended&&!!this.pose&&(this.pose.active||this.eligibility.hudOpen)&&this.eligibility.worldActive&&this.eligibility.focused&&!this.eligibility.fullContent&&document.visibilityState==='visible'&&document.hasFocus();}
  getWorld(){return this.pose;}
  canTalk(){return this.eligible()&&!this.eligibility.hudOpen;}
  async setEnabled(enabled:boolean){if(!enabled){this.state.enabled=false;this.withdraw();this.state.status='off';this.emit();return;}this.networkSuspended=false;this.state.status='joining';this.state.message='';this.emit();try{const session=await loadAccountSession();if(!session.user)throw new Error('Sign in to show nearby visitors.');this.knownAccount=session.user.id;this.state.enabled=true;const result=await accountRequest<{blocked:{id:string;alias:string}[]}>('social');this.state.blocked=result.blocked;this.state.status='active';this.emit();}catch(error){this.state.enabled=false;this.state.status='unavailable';this.state.message=(error as Error).message;this.emit();}}
  private async tick(){
    if(this.destroyed||this.busy||!this.eligible()||!this.pose)return;
    const generation=this.generation;this.busy=true;
    const abort=new AbortController();this.poseAbort=abort;this.presencePosted=true;
    try{
      const result=await accountRequest<{peers:SocialPeer[];idle:boolean;capacity:boolean;voiceAvailable:boolean}>('social/pose',{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(16000)]),body:{...this.pose,sequence:++this.sequence,active:true,moving:this.eligibility.hudOpen?false:this.pose.moving}});
      if(generation!==this.generation||!this.eligible())return;
      this.state.peers=result.peers.map(peer=>({...peer,speaking:this.speakingIds.has(peer.id)&&!peer.muted&&peer.opacity>=1}));
      this.state.status=result.idle?'idle':'active';this.state.capacity=result.capacity;this.state.voiceAvailable=result.voiceAvailable;
      this.state.message=result.idle?'Nearby presence is idle. Move or deliberately talk to return.':'';this.emit();
    }catch(error){
      if(generation!==this.generation)return;this.networkSuspended=true;this.withdraw();this.state.status='unavailable';this.state.message=(error as Error).message;this.emit();
    }finally{if(this.poseAbort===abort)this.poseAbort=null;this.busy=false;}
  }
  withdraw=()=>{const hadPresence=this.presencePosted;this.presencePosted=false;this.generation++;this.poseAbort?.abort();this.poseAbort=null;this.state.peers=[];this.state.status=this.state.enabled?'covered':'off';for(const listener of this.withdrawListeners)listener();if(hadPresence)void accountRequest('social/leave',{method:'POST',body:{}}).catch(()=>{});this.emit();};
  private onVisibility=()=>{if(document.visibilityState!=='visible')this.withdraw();};
  private signOut=()=>{this.knownAccount='';this.state.enabled=false;this.withdraw();};
  async personAction(action:'mute'|'unmute'|'block'|'unblock',accountId:string){await accountRequest('social/person',{method:'POST',body:{action,accountId}});if(action==='block')this.state.peers=this.state.peers.filter(peer=>peer.accountId!==accountId);if(action==='mute'||action==='unmute')this.state.peers=this.state.peers.map(peer=>peer.accountId===accountId?{...peer,muted:action==='mute'}:peer);const result=await accountRequest<{blocked:{id:string;alias:string}[]}>('social');this.state.blocked=result.blocked;this.emit();}
  async report(accountId:string,reason:string){await accountRequest('social/report',{method:'POST',body:{accountId,reason}});}
  destroy(){if(this.destroyed)return;this.state.enabled=false;this.withdraw();this.destroyed=true;window.clearInterval(this.timer);window.removeEventListener('blur',this.withdraw);window.removeEventListener('pagehide',this.withdraw);window.removeEventListener('orientationchange',this.withdraw);document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('dex-account-signed-out',this.signOut);this.listeners.clear();this.withdrawListeners.clear();}
}
