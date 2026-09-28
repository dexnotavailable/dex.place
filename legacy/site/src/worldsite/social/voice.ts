import {Room,RoomEvent,Track,createLocalAudioTrack,type LocalAudioTrack,type RemoteTrack,type RemoteParticipant} from 'livekit-client';
import {accountRequest,eventId} from '../account/client';
import {SocialController} from './controller';
import type {SocialPeer,VoiceSnapshot} from './types';

interface AudioNodeOwner {source:MediaStreamAudioSourceNode;gain:GainNode;pan:StereoPannerNode|null;track:RemoteTrack;element:HTMLMediaElement;accountId:string}
export class VoiceController {
  private state:VoiceSnapshot={state:'off',message:'',volume:.7,muted:false,deviceId:'',devices:[],speakingIds:[]};
  private listeners=new Set<(state:VoiceSnapshot)=>void>();private room:Room|null=null;private context:AudioContext|null=null;private nodes=new Map<string,AudioNodeOwner>();private peers:SocialPeer[]=[];private micReady=false;private localTrack:LocalAudioTrack|null=null;private held=false;private controlHold=false;private holdId='';private generation=0;private holdGeneration=0;private holdAt=0;private destroyed=false;private watchdog:number;private unsubscribe:()=>void;private unsubscribeWithdraw:()=>void;
  private availableTracks=new Map<string,{track:RemoteTrack;participant:RemoteParticipant}>();
  private remoteSpeakingIds=new Set<string>();private syncingAudio=false;private leaving:Promise<void>|null=null;
  constructor(private social:SocialController,onChange?:(state:VoiceSnapshot)=>void){if(onChange)this.listeners.add(onChange);this.unsubscribe=social.subscribe(state=>{this.peers=state.peers;this.updateAudibility();if(this.held&&!this.controlHold&&!social.canTalk())this.release();if(!social.eligible()&&this.state.state!=='off')void this.leave();});this.unsubscribeWithdraw=social.onWithdraw(()=>{void this.leave();});this.watchdog=window.setInterval(()=>void this.holdHeartbeat(),750);window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.release);window.addEventListener('pagehide',this.release);window.addEventListener('orientationchange',this.release);window.addEventListener('dex-account-signed-out',this.release);}
  snapshot=():VoiceSnapshot=>({...this.state,devices:[...this.state.devices],speakingIds:[...this.state.speakingIds]});
  subscribe=(listener:(state:VoiceSnapshot)=>void)=>{this.listeners.add(listener);listener(this.snapshot());return()=>{this.listeners.delete(listener);};};
  private emit(){if(!this.destroyed)for(const listener of this.listeners)listener(this.snapshot());}
  async join(){
    if(this.state.state!=='off'&&this.state.state!=='error')return;
    if(this.leaving)await this.leaving;
    if(!this.social.eligible()){this.state.message='Enter the world and enable Nearby before joining voice.';this.emit();return;}
    const generation=++this.generation;this.state.state='joining';this.state.message='Connecting voice…';this.emit();
    try{
      this.context=new AudioContext();await this.context.resume();
      const grant=await accountRequest<{url:string;token:string;subscriptionPolicy:string}>('voice/join',{method:'POST',body:{}});
      if(generation!==this.generation)return;
      const room=new Room({adaptiveStream:false,dynacast:false});this.room=room;
      room.on(RoomEvent.TrackSubscribed,(track,_publication,participant)=>{this.availableTracks.set(track.sid||participant.identity,{track,participant});this.updateAudibility();});
      room.on(RoomEvent.TrackUnsubscribed,track=>{this.availableTracks.delete(track.sid||'');this.detach(track.sid||'');this.updateAudibility();});
      room.on(RoomEvent.ActiveSpeakersChanged,speakers=>{this.remoteSpeakingIds=new Set(speakers.map(s=>s.identity));this.updateAudibility();});
      room.on(RoomEvent.Disconnected,()=>{if(generation===this.generation){void this.leave().then(()=>{this.state.message='Voice disconnected. Join again when ready.';this.emit();});}});
      await room.connect(grant.url,grant.token,{autoSubscribe:grant.subscriptionPolicy==='server-forwarded-private-room'});
      if(generation!==this.generation||!this.social.eligible()){await room.disconnect();return;}
      this.state.state=this.micReady?'ready':'listening';this.state.message=this.micReady?'Listening. Hold V or Talk when ready.':'Listening. Enable your microphone before the first hold.';this.emit();
    }catch(error){if(generation!==this.generation)return;await this.leave();this.state.state='error';this.state.message=(error as Error).message||'Voice could not connect.';this.emit();}
  }
  async enableMicrophone(){
    if(!this.social.eligible()||!this.room||this.state.state==='joining')return;
    this.release();const generation=this.holdGeneration,transport=this.generation;this.state.state='permission';this.state.message='Requesting microphone permission…';this.emit();
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:this.state.deviceId?{deviceId:{exact:this.state.deviceId}}:true,video:false});stream.getTracks().forEach(track=>track.stop());
      if(generation!==this.holdGeneration||transport!==this.generation||!this.social.eligible()||!this.room)return;
      this.micReady=true;this.state.devices=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='audioinput');this.state.state='ready';this.state.message='Microphone permission is ready. A fresh hold starts talking; capture is currently stopped.';this.emit();
    }catch(error){if(generation!==this.holdGeneration||transport!==this.generation||!this.room)return;this.micReady=false;this.state.state='listening';this.state.message=this.microphoneError(error);this.emit();}
  }
  private microphoneError(error:unknown){const name=(error as DOMException).name;if(name==='NotAllowedError')return 'Microphone permission was not granted. You can keep listening.';if(name==='NotFoundError')return 'No microphone was found.';if(name==='NotReadableError')return 'The microphone is busy or unavailable.';if(name==='OverconstrainedError')return 'That microphone is no longer available. Choose another device.';return 'Microphone setup could not finish. Try again when ready.';}
  async press(fromControl=false){if(this.held||!(fromControl?this.social.eligible():this.social.canTalk())||!this.room)return;if(!this.micReady){await this.enableMicrophone();return;}this.held=true;this.controlHold=fromControl;this.holdAt=performance.now();this.holdId=eventId('talk');const holdGeneration=++this.holdGeneration;try{await accountRequest('voice/hold',{method:'POST',body:{pressed:true,holdId:this.holdId}});if(!this.held||holdGeneration!==this.holdGeneration)return;const track=await createLocalAudioTrack({deviceId:this.state.deviceId||undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true});if(!this.held||holdGeneration!==this.holdGeneration||!(this.controlHold?this.social.eligible():this.social.canTalk())||!this.room){track.stop();return;}this.localTrack=track;await this.room.localParticipant.publishTrack(track,{source:Track.Source.Microphone});if(!this.held||holdGeneration!==this.holdGeneration){track.stop();return;}this.state.state='talking';this.state.message='Talking · release to stop';this.emit();}catch(error){this.release();this.state.message=(error as Error).message||'Talking could not start.';this.emit();}}
  release=()=>{this.held=false;this.controlHold=false;this.holdGeneration++;const track=this.localTrack;this.localTrack=null;if(track){track.stop();void this.room?.localParticipant.unpublishTrack(track).catch(()=>{});}if(this.holdId){this.holdId='';void accountRequest('voice/hold',{method:'POST',body:{pressed:false}}).catch(()=>{});}if(this.room){this.state.state=this.micReady?'ready':'listening';this.state.message='Microphone capture stopped.';}this.emit();};
  private async holdHeartbeat(){if(!this.held)return;if(!(this.controlHold?this.social.eligible():this.social.canTalk())||performance.now()-this.holdAt>=60000){this.release();return;}try{await accountRequest('voice/hold',{method:'POST',body:{pressed:true,holdId:this.holdId}});}catch{this.release();this.state.message='Talking stopped because the connection was lost.';this.emit();}}
  private keydown=(event:KeyboardEvent)=>{if(event.code!=='KeyV'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||!this.social.canTalk())return;const target=event.target as HTMLElement;if(target.closest('input,textarea,select,button,[contenteditable="true"]'))return;event.preventDefault();void this.press();};
  private keyup=(event:KeyboardEvent)=>{if(event.code==='KeyV')this.release();};
  private attach(track:RemoteTrack,participant:RemoteParticipant){if(track.kind!==Track.Kind.Audio||!this.context)return;const peer=this.peers.find(peer=>peer.id===participant.identity);if(!peer||peer.muted||peer.opacity<1)return;
    // Brave requires an active media element to drive decoded WebRTC audio into WebAudio.
    // The element is muted: the single audible path is the controlled spatial gain graph.
    const element=track.attach();element.muted=true;element.volume=0;element.setAttribute('playsinline','');document.body.append(element);void element.play().catch(()=>{this.state.message='Voice playback needs another interaction. Rejoin when ready.';this.emit();});
    const source=this.context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));const gain=this.context.createGain();gain.gain.value=0;source.connect(gain);const pan=this.context.createStereoPanner?this.context.createStereoPanner():null;if(pan){gain.connect(pan);pan.connect(this.context.destination);}else gain.connect(this.context.destination);this.nodes.set(track.sid||participant.identity,{source,gain,pan,track,element,accountId:peer.accountId});}
  private detach(sid:string){const node=this.nodes.get(sid);if(!node)return;node.track.detach(node.element);node.element.remove();node.source.disconnect();node.gain.disconnect();node.pan?.disconnect();this.nodes.delete(sid);}
  private updateAudibility(){
    if(this.syncingAudio)return;this.syncingAudio=true;
    try{
      const own=this.social.getWorld(),eligible=(peer:SocialPeer|undefined)=>!!peer&&!!own&&!peer.muted&&peer.opacity>=1&&this.social.eligible()&&Math.hypot(peer.x-own.x,peer.y-own.y)<=360;
      for(const[sid,entry]of this.availableTracks)if(!this.nodes.has(sid)&&eligible(this.peers.find(peer=>peer.id===entry.participant.identity)))this.attach(entry.track,entry.participant);
      for(const[sid,node]of this.nodes){const peer=this.peers.find(peer=>peer.accountId===node.accountId);if(!eligible(peer)){this.detach(sid);continue;}if(this.context&&peer&&own){const distance=Math.hypot(peer.x-own.x,peer.y-own.y),gain=this.state.muted?0:this.state.volume*Math.pow(Math.max(0,1-distance/360),1.2);node.gain.gain.setTargetAtTime(gain,this.context.currentTime,.04);node.pan?.pan.setTargetAtTime(Math.max(-.7,Math.min(.7,(peer.x-own.x)/360)),this.context.currentTime,.06);}}
      const speaking=this.peers.filter(peer=>eligible(peer)&&this.remoteSpeakingIds.has(peer.id)&&[...this.nodes.values()].some(node=>node.accountId===peer.accountId)).map(peer=>peer.id).sort();
      if(speaking.join(',')!==this.state.speakingIds.join(',')){this.state.speakingIds=speaking;this.social.setSpeaking(speaking);this.emit();}
    }finally{this.syncingAudio=false;}
  }
  setVolume(value:number){this.state.volume=Math.min(1,Math.max(0,value));this.updateAudibility();this.emit();}
  setMuted(muted:boolean){this.state.muted=muted;this.updateAudibility();this.emit();}
  setDevice(deviceId:string){this.release();this.state.deviceId=deviceId;this.micReady=false;if(this.room)this.state.state='listening';this.state.message='Enable the selected microphone before talking.';this.emit();}
  async leave(){
    if(this.leaving)return this.leaving;
    this.generation++;this.release();const room=this.room,context=this.context;this.room=null;this.context=null;
    for(const sid of this.nodes.keys())this.detach(sid);this.availableTracks.clear();this.remoteSpeakingIds.clear();this.state.state='off';this.state.speakingIds=[];this.state.message='Voice is off. Microphone capture stopped.';this.social.setSpeaking([]);this.emit();
    this.leaving=(async()=>{if(room)await room.disconnect();if(context)await context.close().catch(()=>{});await accountRequest('voice/leave',{method:'POST',body:{}}).catch(()=>{});})().finally(()=>{this.leaving=null;});
    return this.leaving;
  }
  destroy(){if(this.destroyed)return;void this.leave();this.destroyed=true;window.clearInterval(this.watchdog);this.unsubscribe();this.unsubscribeWithdraw();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.release);window.removeEventListener('pagehide',this.release);window.removeEventListener('orientationchange',this.release);window.removeEventListener('dex-account-signed-out',this.release);this.listeners.clear();}
}
