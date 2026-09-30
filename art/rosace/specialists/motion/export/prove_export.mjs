// Real historical Rosace pixels, actual validator/ClipPlayer and alternate-root
// replay. This is export QA, not new native or visual/gameplay acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fromMotionMeta } from './from_motion_meta.mjs';
import { exportFrames, requiredWorldClips } from './export_frames.mjs';
import { validatePackage, frameTicks } from '../../../../../src/lab/contracts.ts';
import { ClipPlayer } from '../../../../../src/lab/game/clip-player.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
const write = (file,data) => fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');

function decode(python,files) {
  const p = spawnSync(python,[path.join(HERE,'png_codec.py')],{windowsHide:true,input:JSON.stringify({op:'decode',files}),encoding:'utf8',maxBuffer:150*1024*1024});
  assert.equal(p.status,0,p.stderr);
  return new Map(JSON.parse(p.stdout).map(r=>[r.key,{...r,data:Buffer.from(r.rgba,'base64')}]));
}

function verifyPixels(python,sourceRoot,input,output,normalConversion=false) {
  const proof = [];
  for (const v of input.variants) {
    const dir = v.height === 80 ? 'character' : 'character-closeup';
    const envelope = read(path.join(output,dir,'review-manifest.json'));
    assert.throws(()=>validatePackage(envelope,'must-not-load-review'));
    assert.equal(envelope.releaseEligible,false);
    const pkg = validatePackage(envelope.package,'real-review-package');
    assert.equal(fs.existsSync(path.join(output,dir,'manifest.json')),false);
    const provenance = read(path.join(output,dir,'provenance.json'));
    const files = [{key:'atlas',path:path.join(output,dir,'body.png')}];
    if (normalConversion) files.push({key:'normalAtlas',path:path.join(output,dir,'body_n.png')});
    for (const c of v.clips) for (const f of c.frames) {
      files.push({key:f.image,path:path.join(sourceRoot,f.image)});
      if (normalConversion) files.push({key:f.normal,path:path.join(sourceRoot,f.normal)});
    }
    const unique = [...new Map(files.map(f=>[f.key,f])).values()];
    const decoded = decode(python,unique), atlas = decoded.get('atlas');
    assert.deepEqual([atlas.width,atlas.height],[pkg.atlases[0].width,pkg.atlases[0].height]);
    let rgbaCompared=0,normalSurfacePixels=0;
    for (const c of v.clips) {
      const outputClip = pkg.clips.find(o=>o.id===c.id), player = new ClipPlayer(outputClip);
      let totalRoot=[0,0];
      for (const [index,f] of c.frames.entries()) {
        const outFrame = outputClip.frames[index], p = provenance.frames.find(p=>p.clip===c.id && p.index===index);
        assert.equal(outFrame.pose,f.pose);
        assert.deepEqual([outFrame.pivot[0]+p.trim[0],outFrame.pivot[1]+p.trim[1]],f.pivot);
        assert.deepEqual(outFrame.anchors,f.anchors);
        const source = decoded.get(f.image), [ax,ay,w,h]=outFrame.rect;
        assert.deepEqual([w,h],p.trim.slice(2));
        for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
          const original = ((y+p.trim[1])*source.width+x+p.trim[0])*4;
          const packed = ((y+ay)*atlas.width+x+ax)*4;
          assert.deepEqual(atlas.data.subarray(packed,packed+4),source.data.subarray(original,original+4));
          rgbaCompared+=4;
          if (normalConversion) {
            const n = decoded.get(f.normal), na = decoded.get('normalAtlas');
            const expected = Buffer.from(n.data.subarray(original,original+4));
            if (f.normalSpace === 'camera-y-up' && expected[3]>=128) { expected[1]=255-expected[1]; normalSurfacePixels++; }
            assert.deepEqual(na.data.subarray(packed,packed+4),expected);
          }
        }
        for (let tick=0;tick<frameTicks(outFrame);tick++) {
          assert.equal(player.frame.pose,f.pose);
          const delta=player.rootMotion() ?? [0,0];
          for (let axis=0;axis<2;axis++) {
            assert.equal(delta[axis],(f.rootMotion?.[axis]??0)/frameTicks(f));
            totalRoot[axis]+=delta[axis];
          }
          player.step();
        }
      }
      assert.equal(player.done,!outputClip.loop);
      proof.push({height:v.height,clip:c.id,frames:outputClip.frames.length,ticks:outputClip.frames.reduce((n,f)=>n+frameTicks(f),0),
        rootTotalPixels:totalRoot,rgbaCompared,normalSurfacePixels,pivotReconstruction:'exact',sourcePoseTimeline:'actual-ClipPlayer-exact'});
    }
  }
  return proof;
}

export function proveExport({ sourceRoot, outputRoot, python='python' }) {
  assert.equal(fs.existsSync(outputRoot),false,'proof run directory must be fresh');
  fs.mkdirSync(outputRoot,{recursive:true});
  const inputPath=path.join(outputRoot,'real-input.json');
  fromMotionMeta({configPath:path.join(HERE,'rosace-review-import.json'),sourceRoot,outputPath:inputPath});
  const input=read(inputPath), first=path.join(outputRoot,'original-root-export');
  const a=exportFrames({inputPath,sourceRoot,outputRoot:first,python,mode:'review'});
  const pixels=verifyPixels(python,sourceRoot,input,first);
  assert.deepEqual(pixels.map(p=>[p.height,p.ticks]),[[80,33],[144,33]]);
  const alternate=path.join(outputRoot,'alternate-source-root');
  fs.mkdirSync(alternate);
  const files=new Set(input.variants.flatMap(v=>v.clips.flatMap(c=>c.frames.map(f=>f.image))));
  for (const source of input.provenance.sources) files.add(source.metadata);
  for (const relative of files) { const target=path.join(alternate,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(sourceRoot,relative),target); }
  const alternateInput=path.join(outputRoot,'alternate-input.json');
  fromMotionMeta({configPath:path.join(HERE,'rosace-review-import.json'),sourceRoot:alternate,outputPath:alternateInput});
  assert.equal(sha(inputPath),sha(alternateInput),'clean alternate-root import changed input');
  const second=path.join(outputRoot,'alternate-root-export');
  exportFrames({inputPath:alternateInput,sourceRoot:alternate,outputRoot:second,python,mode:'review'});
  const replay=[];
  for (const dir of ['character','character-closeup']) for (const filename of ['body.png','review-manifest.json','provenance.json']) {
    assert.equal(sha(path.join(first,dir,filename)),sha(path.join(second,dir,filename)));
    replay.push({file:`${dir}/${filename}`,sha256:sha(path.join(first,dir,filename))});
  }
  const negatives=[];
  function rejects(name,mutate,mode='review',pattern) {
    const fixture=structuredClone(input);mutate(fixture);
    const file=path.join(outputRoot,`${name}-input.json`);write(file,fixture);
    const target=path.join(outputRoot,`${name}-rejected-output`);
    assert.throws(()=>exportFrames({inputPath:file,sourceRoot,outputRoot:target,python,mode}),pattern);
    assert.equal(fs.existsSync(target),false);
    negatives.push(name);
  }
  rejects('missing-release-moves',()=>{},'release',/missing required clips/);
  rejects('unknown-generated-origin',f=>f.origin='generated-reference','review',/generated\/reference-only/);
  rejects('tampered-frame-digest',f=>f.variants[0].clips[0].frames[0].imageSha256='0'.repeat(64),'review',/albedo digest changed/);
  rejects('pose-correspondence',f=>f.variants[1].clips[0].frames[0].pose+='-wrong','review',/80\/144 pose differs/);
  rejects('duration-correspondence',f=>f.variants[1].clips[0].frames[0].duration=2,'review',/80\/144 duration differs/);
  rejects('missing-world-sit-unqualified-all',f=>{for(const v of f.variants){const source=v.clips[0];v.clips=requiredWorldClips().filter(id=>id!=='sit').map(id=>({...structuredClone(source),id}));}},'release',/missing required clips/);
  rejects('unqualified-complete-coverage',f=>{for(const v of f.variants){const source=v.clips[0];v.clips=[...requiredWorldClips(),'m1_5'].map(id=>({...structuredClone(source),id}));}},'release',/unqualified source\/head/);
  const normalConfig=read(path.join(HERE,'rosace-review-import.json'));
  normalConfig.clips[0].endTickExclusive=2;
  for (const v of Object.values(normalConfig.clips[0].variants)) {v.normals=true;v.normalSpace='camera-y-up';}
  const configFile=path.join(outputRoot,'normal-coordinate-config.json');write(configFile,normalConfig);
  const normalInput=path.join(outputRoot,'normal-coordinate-input.json');
  fromMotionMeta({configPath:configFile,sourceRoot,outputPath:normalInput});
  const normalOutput=path.join(outputRoot,'normal-coordinate-export');
  exportFrames({inputPath:normalInput,sourceRoot,outputRoot:normalOutput,python,mode:'review'});
  const normalProof=verifyPixels(python,sourceRoot,read(normalInput),normalOutput,true);
  const result={status:'pass-real-frame-export-review-only',realSource:'existing dressed N1 native80/144, unqualified historical spring-cloth material',
    validator:'actual src/lab/contracts.ts',packer:'actual src/lab/art/atlas-builder.ts',clock:'actual ClipPlayer',
    output:first,inputSha256:sha(inputPath),pixels,alternateRootReplay:replay,negativeFixtures:negatives,normalCoordinateProof:normalProof,
    releasePackageProduced:false,nativeExecuted:false,movingPlaybackInspected:false,
    limitations:'no new native/cloth/art/finished package/runtime proof; strike normal surfaces absent, real full N1 uses normal:null'};
  write(path.join(outputRoot,'proof.json'),result);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i].replace(/^--/,''),process.argv[i+1]);
  try {const result=proveExport({sourceRoot:args.get('source-root'),outputRoot:args.get('out'),python:args.get('python')??'python'});process.stdout.write(JSON.stringify(result)+'\n');}
  catch(e){process.stderr.write(e.stack+'\n');process.exitCode=1;}
}
