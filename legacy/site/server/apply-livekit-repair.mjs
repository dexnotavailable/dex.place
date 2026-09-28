/** Reproducible local Apache-2.0 upstream patch, never applied to an installed service. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const base='A:/Dex/Builds/dex-place-livekit-1.13.6',root=resolve(base,'source'),proof='D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/voice-repair';
await mkdir(proof,{recursive:true});
const paths=['pkg/rtc/subscriptionmanager.go','pkg/rtc/participant.go','pkg/service/roommanager.go'];
const sources=new Map(),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),before=[];
for(const path of paths){const file=resolve(root,path),body=await readFile(file,'utf8');if(body.includes('Dex: per-track'))throw new Error('Patch already present; no repeated application.');const backup=resolve(base,'original',path);await mkdir(dirname(backup),{recursive:true});await copyFile(file,backup);sources.set(path,body);before.push({path,sha256:hash(body)});}
function replace(path,needle,value){const body=sources.get(path);if(body.split(needle).length!==2)throw new Error(`Expected exactly one pinned anchor: ${path}`);sources.set(path,body.replace(needle,value));}
replace(paths[0],'type SubscriptionManager struct {','type SubscriptionManager struct {\n\t// Dex: per-track grants are set only by the authenticated room-admin RPC.\n\tadminSubscriptionLock sync.RWMutex\n\tadminSubscriptions sync.Map // livekit.TrackID -> struct{}; lifetime of this participant');
replace(paths[0],'func (m *SubscriptionManager) SubscribeToTrack(trackID livekit.TrackID, isSync bool) {',`// SetAdminSubscription never changes the participant's general canSubscribe permission.
// It is not reachable through client signalling or participant metadata.
func (m *SubscriptionManager) SetAdminSubscription(trackID livekit.TrackID, allowed bool) {
\tm.adminSubscriptionLock.Lock()
\tdefer m.adminSubscriptionLock.Unlock()
\tif allowed {
\t\tm.adminSubscriptions.Store(trackID, struct{}{})
\t} else {
\t\tm.adminSubscriptions.Delete(trackID)
\t}
}

func (m *SubscriptionManager) HasAdminSubscription(trackID livekit.TrackID) bool {
\t_, allowed := m.adminSubscriptions.Load(trackID)
\treturn allowed
}

func (m *SubscriptionManager) SubscribeToTrack(trackID livekit.TrackID, isSync bool) {
\t// Serialize desired-state mutation against admin revocation. A late client request
\t// cannot restore desired=true after an override is removed.
\tm.adminSubscriptionLock.RLock()
\tdefer m.adminSubscriptionLock.RUnlock()
\tif !m.params.Participant.CanSubscribe() && !m.HasAdminSubscription(trackID) {
\t\treturn
\t}`);
replace(paths[0],'func (m *SubscriptionManager) subscribe(sub *mediaTrackSubscription) error {\n\tsub.logger.Debugw("executing subscribe")\n\n\tif !m.params.Participant.CanSubscribe() {','func (m *SubscriptionManager) subscribe(sub *mediaTrackSubscription) error {\n\tsub.logger.Debugw("executing subscribe")\n\n\tif !m.params.Participant.CanSubscribe() && !m.HasAdminSubscription(sub.trackID) {');
replace(paths[0],'m.params.Logger.Debugw("executing subscribe synchronous", "trackID", trackID)\n\n\tif !m.params.Participant.CanSubscribe() {','m.params.Logger.Debugw("executing subscribe synchronous", "trackID", trackID)\n\n\tif !m.params.Participant.CanSubscribe() && !m.HasAdminSubscription(trackID) {');
replace(paths[1],`\t\t// revoke all subscriptions
\t\tfor _, st := range p.SubscriptionManager.GetSubscribedTracks() {
\t\t\tst.MediaTrack().RemoveSubscriber(p.ID(), false)
\t\t}`,`\t\t// Dex: per-track room-admin grants survive unrelated microphone permission changes.
\t\t// Non-approved tracks still lose subscription when general permission is denied.
\t\tfor _, st := range p.SubscriptionManager.GetSubscribedTracks() {
\t\t\tif !p.SubscriptionManager.HasAdminSubscription(st.ID()) {
\t\t\t\tst.MediaTrack().RemoveSubscriber(p.ID(), false)
\t\t\t}
\t\t}
\t\tp.SubscriptionManager.ReconcileAll()`);
replace(paths[2],'\tparticipant.GetLogger().Debugw("updating participant subscriptions")\n\troom.UpdateSubscriptions(',`\tparticipant.GetLogger().Debugw("updating participant subscriptions")
\t// Dex: per-track permission is granted only on this authenticated room-admin RPC.
\t// Client signalling calls Room.UpdateSubscriptions directly and cannot set this grant.
\tif admin, ok := participant.(interface {
\t\tSetAdminSubscription(livekit.TrackID, bool)
\t}); ok {
\t\tfor _, trackID := range req.TrackSids {
\t\t\tadmin.SetAdminSubscription(livekit.TrackID(trackID), req.Subscribe)
\t\t}
\t\tfor _, group := range req.ParticipantTracks {
\t\t\tfor _, trackID := range group.TrackSids {
\t\t\t\tadmin.SetAdminSubscription(livekit.TrackID(trackID), req.Subscribe)
\t\t\t}
\t\t}
\t}
\troom.UpdateSubscriptions(`);
for(const[path,body]of sources)await writeFile(resolve(root,path),body);
const test=`// Copyright 2026 dex. Licensed under the Apache License, Version 2.0.
package rtc

import (
  "sync"
  "testing"
  "github.com/livekit/protocol/livekit"
)

func TestDexAdminSubscriptionIsPerTrackAndRevocable(t *testing.T) {
  manager := &SubscriptionManager{}
  approved, other := livekit.TrackID("approved"), livekit.TrackID("unapproved")
  if manager.HasAdminSubscription(approved) { t.Fatal("new participant has a grant") }
  manager.SetAdminSubscription(approved, true)
  if !manager.HasAdminSubscription(approved) || manager.HasAdminSubscription(other) { t.Fatal("grant is not isolated by track") }
  manager.SetAdminSubscription(approved, false)
  if manager.HasAdminSubscription(approved) { t.Fatal("revoked track is still permitted") }
  if (&SubscriptionManager{}).HasAdminSubscription(approved) { t.Fatal("another participant inherited permission") }
}

func TestDexAdminSubscriptionConcurrentReadAndRevoke(t *testing.T) {
  manager := &SubscriptionManager{}
  var workers sync.WaitGroup
  for i:=0;i<8;i++ { workers.Add(1);go func(){defer workers.Done();for j:=0;j<1000;j++{manager.SetAdminSubscription("approved",true);manager.HasAdminSubscription("approved");manager.SetAdminSubscription("approved",false)}}() }
  workers.Wait(); manager.SetAdminSubscription("approved",false)
  if manager.HasAdminSubscription("approved") {t.Fatal("last revoke did not win")}
}
`;
await writeFile(resolve(root,'pkg/rtc/dex_admin_subscription_test.go'),test);
await writeFile(resolve(proof,'source-receipt.json'),JSON.stringify({upstreamTag:'v1.13.6',upstreamCommit:'3cfbd1242618a61178f7a05b126d6c0c4cac3731',archiveSha256:'7339d5b6f5bcc73579a516c7f18f803a708b9be7514b987a8445f2d06b4defd4',license:'Apache-2.0',builder:'golang:1.26.6-alpine3.24@sha256:af8d6740070b8906d12eae1c3e3ea0957fb63f492051ea05e354c38ef9fe88df',before,after:[...sources].map(([path,body])=>({path,sha256:hash(body)})),newTest:'pkg/rtc/dex_admin_subscription_test.go',sourceRoot:root,originalRoot:resolve(base,'original')},null,2));
console.log('Applied three production-file changes and one focused test to isolated pinned source. Original files retained.');
