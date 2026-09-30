// Explicit review adapter for saved Blender motion metadata. Per-tick rows keep
// root impulses/exposure and close-up frame indices exact; no invented moves.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceFile } from './export_frames.mjs';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const fail = (ok,message) => { if (!ok) throw new Error(message); };
const phase = label => /^[A]/.test(label) ? 'anticipation' : /^[SC]/.test(label) ? 'active' : /^[FR]/.test(label) ? 'recovery' : 'neutral';

export function fromMotionMeta({ configPath, sourceRoot, outputPath }) {
  const cfg = read(configPath);
  fail(cfg.contract === 'dex.motion-meta-import/1' && cfg.clips?.length > 0, 'motion-meta import config required');
  fail(cfg.character?.id && cfg.character?.name, 'explicit character identity required');
  const byHeight = new Map();
  const sources = [];
  for (const clip of cfg.clips) {
    fail(typeof clip.id === 'string' && typeof clip.actionKey === 'string', 'clip/action identity required');
    for (const [heightText,variant] of Object.entries(clip.variants)) {
      const height = Number(heightText), metaPath = sourceFile(sourceRoot,variant.meta);
      const metaBytes = fs.readFileSync(metaPath), meta = JSON.parse(metaBytes.toString('utf8').replace(/^\uFEFF/,''));
      fail([80,144].includes(height) && meta.px === height && meta.ss === 1, 'adapter needs genuine native80/144 metadata, ss1');
      const m = meta.motion;
      fail(m?.in_place === true && Number.isInteger(m.game_frames), 'adapter requires explicitly in-place motion');
      fail(Array.isArray(m.sample_frame) && Array.isArray(m.body_sample_frame) && Array.isArray(m.root_motion_px) && Array.isArray(m.drawing), 'missing motion timeline/roots');
      fail([m.sample_frame,m.body_sample_frame,m.root_motion_px,m.drawing].every(a => a.length === m.game_frames), 'motion timeline arrays disagree');
      fail(Array.isArray(meta.anchor) && meta.anchor.length === 2 && meta.anchor.every(Number.isFinite), 'explicit native canvas foot origin required');
      const start = clip.startTick ?? 1, end = clip.endTickExclusive ?? m.game_frames;
      fail(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start < end && end <= m.game_frames, 'invalid actor interval');
      fail(start !== 0 || clip.includePre === true, 'pre-roll frame0 is not a gameplay drawing without explicit includePre');
      const frames = [];
      for (let tick=start;tick<end;tick++) {
        const sample = m.sample_frame[tick], body = m.body_sample_frame[tick];
        fail(Number.isInteger(sample) && Number.isInteger(body) && meta.frames.includes(sample), 'selected drawing has no rendered frame');
        const dir = path.posix.dirname(variant.meta.replaceAll('\\','/'));
        const image = `${dir}/sprite_${String(sample).padStart(4,'0')}.png`;
        const imagePath = sourceFile(sourceRoot,image), anchor = meta.anchors?.[String(sample)];
        fail(anchor && Number.isFinite(m.root_motion_px[tick]), 'missing actual drawing anchors/root delta');
        const mapped = {};
        for (const [target,source] of Object.entries(cfg.anchorMap ?? {})) {
          const point = anchor[source];
          fail(Array.isArray(point) && point.length >= 2 && point.slice(0,2).every(Number.isFinite), `missing native anchor ${source}`);
          mapped[target] = [point[0]-meta.anchor[0],point[1]-meta.anchor[1]];
        }
        const f = {image,imageSha256:sha(fs.readFileSync(imagePath)),pivot:meta.anchor,
          // Pose/frame correspondence is the actual shared action tick + body key,
          // separate from per-resolution canvas/crop and cloth redraw filenames.
          pose:`${clip.actionKey}:actor${tick}:body${body}`,duration:1,phase:phase(m.drawing[tick]),
          rootMotion:[m.root_motion_px[tick],0],anchors:mapped};
        if (variant.normals === true) {
          fail(['camera-y-up','sprite-y-down'].includes(variant.normalSpace), 'normal coordinate convention required');
          f.normal = `${dir}/sprite_${String(sample).padStart(4,'0')}_normal.png`;
          f.normalSpace = variant.normalSpace;
          f.normalSha256 = sha(fs.readFileSync(sourceFile(sourceRoot,f.normal)));
        }
        frames.push(f);
      }
      const outputClip = {id:clip.id,loop:clip.loop ?? false,tags:clip.tags ?? ['review-only'],frames,
        qualification:{status:'unqualified',sourceHead:'unknown-historical',evidence:[]}};
      if (!byHeight.has(height)) byHeight.set(height,{height,shading:variant.shading ?? 'baked',clips:[]});
      byHeight.get(height).clips.push(outputClip);
      sources.push({clip:clip.id,height,metadata:variant.meta,sha256:sha(metaBytes),
        originalGameFrames:m.game_frames,exportActorInterval:[start,end],camera:[meta.yaw,meta.elev],
        sourceInPlace:true,rootTotalPixels:frames.reduce((sum,f) => sum+f.rootMotion[0],0),
        limitations:'historical native pixels; spring secondary motion, not qualified mesh cloth; no complete gameplay/events/kit acceptance'});
    }
  }
  const input = {contract:'dex.authored-frames/1',fps:60,space:'in-place',origin:'authored-native',
    character:cfg.character,requiredClips:cfg.requiredClips ?? [],variants:[...byHeight.values()].sort((a,b)=>a.height-b.height),
    provenance:{adapter:'existing motion.sample_frame per actor tick, not body_sample-only; exact per-tick roots',
      adapterSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),sources,
      limits:'review-only import; no image resizing, missing-clip filling, procedural fallback or release qualification'}};
  fail(!fs.existsSync(outputPath), 'input export path must be fresh');
  fs.mkdirSync(path.dirname(path.resolve(outputPath)),{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
  return {status:'review-input-created',variants:input.variants.map(v => ({height:v.height,clips:v.clips.map(c=>c.id),frames:v.clips.reduce((n,c)=>n+c.frames.length,0)}))};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const values = new Map();
  for (let i=2;i<process.argv.length;i+=2) values.set(process.argv[i].replace(/^--/,''),process.argv[i+1]);
  try { fail([...values.keys()].every(k => ['config','source-root','out'].includes(k)), 'unknown motion import option');
    process.stdout.write(JSON.stringify(fromMotionMeta({configPath:values.get('config'),sourceRoot:values.get('source-root'),outputPath:values.get('out')}))+'\n'); }
  catch (e) { process.stderr.write(e.message+'\n'); process.exitCode=1; }
}
