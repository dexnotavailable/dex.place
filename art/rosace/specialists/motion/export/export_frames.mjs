// File-backed authored PNGs -> existing dex.sprite/1 packer/validator.
// No native app, rendering, model, synthesized frame or fallback is launched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pack, trim } from '../../../../../src/lab/art/atlas-builder.ts';
import { validatePackage, frameTicks } from '../../../../../src/lab/contracts.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]+$/.test(value);
const finitePair = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const requireTrue = (value, message) => { if (!value) throw new Error(message); };
const FRAME_INPUT_KEYS = ['image','imageSha256','normal','normalSha256','normalSpace','pivot','pose','duration','hold','phase','hitboxes','hurtboxes','iframes','cancel','rootMotion','events','anchors'];
const strictKeys = (value, keys, where) => {
  requireTrue(value && typeof value === 'object' && !Array.isArray(value), `${where}: object required`);
  const unknown = Object.keys(value).filter(k => !keys.includes(k));
  requireTrue(unknown.length === 0, `${where}: unknown fields ${unknown.join(',')}`);
};

export function frameSetDigest(clip) {
  // Relative source names/digests + every approved pose/pivot/timing/runtime field.
  // No array root or execution timestamp enters the accepted-content identity.
  const frames = clip.frames.map(f => Object.fromEntries(FRAME_INPUT_KEYS.filter(k => f[k] !== undefined).map(k => [k,f[k]])));
  const clipFields = Object.fromEntries(['id','loop','next','gravity','angles','tags'].filter(k => clip[k] !== undefined).map(k => [k,clip[k]]));
  return sha(jsonBytes({clip:clipFields,frames}));
}

// Same byte-only ImageData shape used by atlas-builder; no DOM/canvas substitute.
globalThis.ImageData ??= class ImageData {
  constructor(width, height) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
};

export function requiredWorldClips() {
  // Read the actual public constant without importing Player's browser/physics graph.
  const text = fs.readFileSync(path.join(REPO, 'src/lab/game/player.ts'), 'utf8');
  const match = text.match(/export const PLAYER_CLIPS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  requireTrue(match, 'cannot locate actual PLAYER_CLIPS constant; integration update required');
  const names = [...match[1].matchAll(/"([a-zA-Z0-9_]+)"/g)].map(m => m[1]);
  requireTrue(names.length > 0, 'empty actual required player clip set');
  return [...new Set([...names, 'sit'])];
}

export function sourceFile(root, relative) {
  requireTrue(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative), 'source paths must be relative');
  const realRoot = fs.realpathSync(root);
  const candidate = fs.realpathSync(path.resolve(realRoot, relative));
  const remainder = path.relative(realRoot, candidate);
  requireTrue(remainder && !remainder.startsWith('..' + path.sep) && remainder !== '..' && !path.isAbsolute(remainder), 'source path escapes root');
  requireTrue(fs.statSync(candidate).isFile(), 'source path must name a file');
  return candidate;
}

function qualification(clip, sourceRoot) {
  const q = clip.qualification;
  requireTrue(q?.status === 'qualified' && /^[0-9a-f]{40}$/.test(q.sourceHead ?? ''), `${clip.id}: unqualified source/head`);
  requireTrue(Array.isArray(q.evidence) && q.evidence.length > 0, `${clip.id}: missing qualification evidence`);
  const frameSet = frameSetDigest(clip);
  requireTrue(q.frameSetSha256 === frameSet, `${clip.id}: qualified frame/timeline set changed`);
  return q.evidence.map(p => {
    requireTrue(/^[0-9a-f]{64}$/.test(p.sha256 ?? ''), `${clip.id}: invalid evidence digest`);
    const receiptBytes = fs.readFileSync(sourceFile(sourceRoot, p.path));
    const actual = sha(receiptBytes);
    requireTrue(actual === p.sha256, `${clip.id}: qualification evidence changed`);
    const receipt = JSON.parse(receiptBytes.toString('utf8').replace(/^\uFEFF/,''));
    requireTrue(receipt.contract === 'dex.authored-qualification/1' && receipt.status === 'qualified'
      && receipt.sourceHead === q.sourceHead && receipt.clip === clip.id && receipt.frameSetSha256 === frameSet,
      `${clip.id}: evidence does not qualify this exact clip/frame set`);
    return { path: p.path, sha256: actual };
  });
}

function pngBridge(python, request) {
  const result = spawnSync(python, [path.join(HERE, 'png_codec.py')], {
    input: JSON.stringify(request), encoding: 'utf8', maxBuffer: 380 * 1024 * 1024,
    windowsHide: true, timeout: 120_000,
  });
  if (result.error || result.status !== 0) throw new Error(`PNG codec failed: ${result.error?.message ?? result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

function frameOut(source, rect, pivot, clipId) {
  const allowed = ['duration','hold','phase','hitboxes','hurtboxes','iframes','cancel','rootMotion','events','anchors'];
  const frame = Object.fromEntries(allowed.filter(k => source[k] !== undefined).map(k => [k, source[k]]));
  // Existing World seatedFrame consumes duration only. This preserves the same
  //60Hz exposure on both older and repaired consumers without adding drawings.
  if (clipId === 'sit') { frame.duration=frameTicks(source); delete frame.hold; }
  return { ...frame, rect, pivot, pose: source.pose };
}

function validateInput(input, mode) {
  strictKeys(input,['contract','fps','space','origin','character','requiredClips','variants','provenance'],'input');
  requireTrue(input.contract === 'dex.authored-frames/1' && input.fps === 60 && input.space === 'in-place', 'expected authored-frame contract,60Hz,in-place space');
  requireTrue(['authored-native','authored-2d'].includes(input.origin), 'generated/reference-only/unknown frames cannot enter authored export');
  requireTrue(id(input.character?.id) && typeof input.character.name === 'string' && input.character.name.length > 0, 'invalid character identity');
  strictKeys(input.character,['id','name'],'character');
  requireTrue(Array.isArray(input.requiredClips) && input.requiredClips.every(id), 'requiredClips must explicitly declare character-specific moves');
  requireTrue(Array.isArray(input.variants) && input.variants.length > 0 && input.variants.length <= 2, 'one or two native variants required');
  const heights = input.variants.map(v => v.height);
  requireTrue(new Set(heights).size === heights.length && heights.every(h => h === 80 || h === 144), 'unique genuine80/144 native variants required');
  if (mode === 'release') requireTrue(heights.length === 2 && heights.includes(80) && heights.includes(144), 'release needs both real80 and144 variants');
  for (const variant of input.variants) {
    strictKeys(variant,['height','shading','clips','defaults'],'variant');
    requireTrue(Array.isArray(variant.clips) && variant.clips.length > 0, 'variant has no clips');
    requireTrue(['flat','baked'].includes(variant.shading), 'explicit atlas shading required');
    const names = variant.clips.map(c => c.id);
    requireTrue(names.every(id) && new Set(names).size === names.length, 'duplicate/invalid clip ID');
    for (const clip of variant.clips) {
      strictKeys(clip,['id','loop','next','gravity','angles','tags','frames','qualification'],clip.id);
      requireTrue(Array.isArray(clip.frames) && clip.frames.length > 0 && clip.frames.length <= 2048, `${clip.id}: invalid frame count`);
      for (const f of clip.frames) {
        strictKeys(f,FRAME_INPUT_KEYS,`${clip.id} frame`);
        requireTrue(typeof f.pose === 'string' && f.pose.trim().length > 0, `${clip.id}: source pose/frame identity required`);
        requireTrue(finitePair(f.pivot), `${clip.id}: explicit finite source foot pivot required`);
        requireTrue(Number.isInteger(f.duration) && f.duration >= 1 && f.duration <= 600, `${clip.id}: integer60Hz exposure required`);
        requireTrue(f.hold === undefined || Number.isInteger(f.hold) && f.hold >= 0 && f.hold <= 600, `${clip.id}: invalid hold`);
        requireTrue(f.rootMotion === undefined || finitePair(f.rootMotion), `${clip.id}: invalid root delta`);
        requireTrue(!f.normal || ['sprite-y-down','camera-y-up'].includes(f.normalSpace), `${clip.id}: normal space must be explicit`);
        if (mode === 'release') requireTrue(/^[0-9a-f]{64}$/.test(f.imageSha256 ?? ''), `${clip.id}: release frame digest required`);
      }
    }
  }
}

function pairVariants(variants, mode) {
  if (variants.length !== 2) return;
  const a = new Map(variants[0].pkg.clips.map(c => [c.id,c]));
  const b = new Map(variants[1].pkg.clips.map(c => [c.id,c]));
  // Review can remain partial but paired provided clips must still be index-safe.
  requireTrue([...a.keys()].sort().join('|') === [...b.keys()].sort().join('|'), '80/144 clip IDs differ');
  for (const [name, clip] of a) {
    const other = b.get(name);
    requireTrue(clip.frames.length === other.frames.length, `${name}:80/144 frame counts differ`);
    for (const key of ['loop','next']) requireTrue(clip[key] === other[key], `${name}:80/144 ${key} differs`);
    clip.frames.forEach((f,i) => {
      const g = other.frames[i];
      for (const key of ['duration','hold','phase','pose']) requireTrue(f[key] === g[key], `${name}[${i}]:80/144 ${key} differs`);
      if (mode === 'release') for (let axis=0;axis<2;axis++) {
        const x = (f.rootMotion?.[axis] ?? 0) / variants[0].height;
        const y = (g.rootMotion?.[axis] ?? 0) / variants[1].height;
        requireTrue(Math.abs(x-y) <= 0.0001, `${name}[${i}]:80/144 H-space root delta differs`);
      }
    });
  }
}

export function exportFrames({ inputPath, sourceRoot, outputRoot, mode = 'review', python = 'python', maxWidth = 2048 }) {
  requireTrue(['review','release'].includes(mode), 'mode must be review or release');
  requireTrue(Number.isInteger(maxWidth) && maxWidth >= 64 && maxWidth <= 8192, 'atlas width must be64..8192');
  const inputBytes = fs.readFileSync(inputPath), input = JSON.parse(inputBytes.toString('utf8').replace(/^\uFEFF/,''));
  validateInput(input, mode);
  const output = path.resolve(outputRoot);
  requireTrue(!fs.existsSync(output), 'output root must be fresh; no replacement of assets');
  const required = [...new Set([...requiredWorldClips(), ...input.requiredClips])];
  const fileRequests = new Map();
  for (const variant of input.variants) for (const clip of variant.clips) for (const f of clip.frames) {
    for (const key of ['image','normal']) if (f[key]) {
      const absolute = sourceFile(sourceRoot, f[key]);
      requireTrue(path.extname(absolute).toLowerCase() === '.png', 'only authored PNGs accepted');
      const requestKey = `${f[key]}|${key === 'normal' ? f.normalSpace : 'albedo'}`;
      f[`_${key}Key`] = requestKey;
      fileRequests.set(requestKey,{key:requestKey,path:absolute,...(key === 'normal' ? {normalSpace:f.normalSpace} : {})});
    }
  }
  const decoded = new Map(pngBridge(python,{op:'decode',files:[...fileRequests.values()]}).map(row => [row.key,row]));
  const outputs = [];
  for (const variant of [...input.variants].sort((a,b) => a.height-b.height)) {
    const missing = required.filter(id => !variant.clips.some(c => c.id === id));
    if (mode === 'release') requireTrue(missing.length === 0, `H${variant.height}: missing required clips ${missing.join(',')}`);
    const allFrames = variant.clips.flatMap(c => c.frames);
    const normals = allFrames.filter(f => f.normal).length;
    requireTrue(normals === 0 || normals === allFrames.length, 'a variant must supply every normal or choose normal:null');
    const images = new Map(), packedFrames = new Map(), provenance = [];
    const releaseSignatures = new Map();
    for (const clip of [...variant.clips].sort((a,b) => a.id.localeCompare(b.id,'en'))) {
      const evidence = mode === 'release' ? qualification(clip,sourceRoot) : [];
      const imageHashes = [];
      for (const [index,f] of clip.frames.entries()) {
        const image = decoded.get(f._imageKey), normal = f.normal ? decoded.get(f._normalKey) : null;
        requireTrue(image, `${clip.id}: missing albedo`);
        if (f.imageSha256) requireTrue(image.fileSha256 === f.imageSha256, `${clip.id}: albedo digest changed`);
        if (normal) {
          requireTrue(normal.width === image.width && normal.height === image.height, `${clip.id}: normal dimensions differ`);
          if (f.normalSha256) requireTrue(normal.fileSha256 === f.normalSha256, `${clip.id}: normal digest changed`);
          if (mode === 'release') requireTrue(/^[0-9a-f]{64}$/.test(f.normalSha256 ?? ''), `${clip.id}: normal digest required`);
        }
        const albedo = new Uint8ClampedArray(Buffer.from(image.rgba,'base64'));
        const n = normal ? new Uint8ClampedArray(Buffer.from(normal.rgba,'base64')) : new Uint8ClampedArray(albedo.length);
        const cropped = trim(image.width,image.height,albedo,n,0);
        requireTrue(cropped, `${clip.id}: frame is fully transparent`);
        requireTrue(cropped.w+4 <= maxWidth, `${clip.id}: frame wider than atlas policy`);
        const contentKey = sha(Buffer.concat([Buffer.from(`${cropped.w},${cropped.h}|`),Buffer.from(cropped.albedo),...(normal ? [Buffer.from(cropped.normal)] : [])]));
        images.set(contentKey,{key:contentKey,w:cropped.w,h:cropped.h,albedo:cropped.albedo,normal:cropped.normal});
        packedFrames.set(`${clip.id}:${index}`,{key:contentKey,pivot:[f.pivot[0]-cropped.x,f.pivot[1]-cropped.y]});
        imageHashes.push(image.fileSha256);
        provenance.push({clip:clip.id,index,pose:f.pose,image:f.image,imageSha256:image.fileSha256,
          normal:f.normal ?? null,normalSha256:normal?.fileSha256 ?? null,normalSpace:f.normalSpace ?? null,
          sourceCanvas:[image.width,image.height],sourcePivot:f.pivot,trim:[cropped.x,cropped.y,cropped.w,cropped.h],
          ticks:frameTicks(f),rootMotion:f.rootMotion ?? [0,0],qualification:clip.qualification?.status ?? 'unqualified',evidence});
      }
      releaseSignatures.set(clip.id,imageHashes);
    }
    if (mode === 'release') {
      const idle = new Set(releaseSignatures.get('idle'));
      for (const [clip,hashes] of releaseSignatures) if (clip !== 'idle') {
        requireTrue(!hashes.every(h => idle.has(h)), `${clip}: all drawings alias idle; no missing-move fallback`);
      }
    }
    // Reuse actual existing shelf packer, with deterministic tie order from content keys.
    const ordered = [...images.values()].sort((a,b) => a.key.localeCompare(b.key,'en'));
    const atlas = pack(ordered,maxWidth);
    const clips = [...variant.clips].sort((a,b) => a.id.localeCompare(b.id,'en')).map(c => ({
      ...Object.fromEntries(['id','loop','next','gravity','angles','tags'].filter(k => c[k] !== undefined).map(k => [k,c[k]])),
      atlas:'body', frames:c.frames.map((f,i) => { const m = packedFrames.get(`${c.id}:${i}`); return frameOut(f,atlas.rects.get(m.key),m.pivot,c.id); }),
    }));
    const pkg = validatePackage({contract:'dex.sprite/1',name:input.character.name,
      atlases:[{id:'body',albedo:'body.png',normal:normals ? 'body_n.png' : null,width:atlas.width,height:atlas.height,shading:variant.shading}],
      clips,...(variant.defaults ? {defaults:variant.defaults} : {})},`H${variant.height} authored export`);
    outputs.push({height:variant.height,dir:variant.height === 80 ? 'character' : 'character-closeup',pkg,atlas,provenance,missing,normals:!!normals});
  }
  pairVariants(outputs,mode);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const staging = fs.mkdtempSync(path.join(path.dirname(output),'.authored-export-'));
  try {
    const writes = [];
    for (const result of outputs) {
      const dir = path.join(staging,result.dir); fs.mkdirSync(dir);
      writes.push({path:path.join(dir,'body.png'),width:result.atlas.width,height:result.atlas.height,rgba:Buffer.from(result.atlas.albedo.data).toString('base64')});
      if (result.normals) writes.push({path:path.join(dir,'body_n.png'),width:result.atlas.width,height:result.atlas.height,rgba:Buffer.from(result.atlas.normal.data).toString('base64')});
      const document = mode === 'release' ? result.pkg : {contract:'dex.sprite-review/1',releaseEligible:false,
        missingRequiredClips:result.missing,nativeBodyHeight:result.height,package:result.pkg};
      fs.writeFileSync(path.join(dir,mode === 'release' ? 'manifest.json' : 'review-manifest.json'),jsonBytes(document),{flag:'wx'});
      fs.writeFileSync(path.join(dir,'provenance.json'),jsonBytes({contract:'dex.authored-export-provenance/1',mode,fps:60,
        character:input.character,height:result.height,inputSha256:sha(inputBytes),
        exporterSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),
        pngCodecSha256:sha(fs.readFileSync(path.join(HERE,'png_codec.py'))),
        genericValidatorSha256:sha(fs.readFileSync(path.join(REPO,'src/lab/contracts.ts'))),
        atlasPackerSha256:sha(fs.readFileSync(path.join(REPO,'src/lab/art/atlas-builder.ts'))),
        sourceProvenance:input.provenance ?? null,frames:result.provenance,
        limits:'qualification is caller attestation with hashed evidence; this exporter does not perform native/art/cloth/playback acceptance'}),{flag:'wx'});
    }
    const encoded = pngBridge(python,{op:'encode',images:writes});
    const pngs = encoded.map((row,i) => ({...row,file:path.relative(staging,writes[i].path).replaceAll('\\','/')}));
    const result = {contract:'dex.authored-export-result/1',mode,releaseEligible:mode === 'release',
      variants:outputs.map(r => ({height:r.height,dir:r.dir,clips:r.pkg.clips.map(c => c.id),frameCount:r.pkg.clips.reduce((n,c) => n+c.frames.length,0),
        missingRequiredClips:r.missing,ticks:Object.fromEntries(r.pkg.clips.map(c => [c.id,c.frames.reduce((n,f) => n+frameTicks(f),0)])),
        atlasDimensions:[r.atlas.width,r.atlas.height]})),pngs};
    fs.writeFileSync(path.join(staging,'export-result.json'),jsonBytes(result),{flag:'wx'});
    fs.renameSync(staging,output);
    return result;
  } catch (error) {
    // Keep this exact isolated failed trial for diagnosis; never recurse over user paths.
    error.message += `; isolated unfinished trial retained at ${staging}`;
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const values = new Map();
  for (let i=2;i<process.argv.length;i+=2) {
    requireTrue(process.argv[i].startsWith('--') && process.argv[i+1], 'expected --option value');
    values.set(process.argv[i].slice(2),process.argv[i+1]);
  }
  try {
    requireTrue([...values.keys()].every(k => ['input','source-root','output-root','mode','python','max-width'].includes(k)), 'unknown exporter option');
    const result = exportFrames({inputPath:values.get('input'),sourceRoot:values.get('source-root'),outputRoot:values.get('output-root'),
      mode:values.get('mode') ?? 'review',python:values.get('python') ?? 'python',maxWidth:Number(values.get('max-width') ?? 2048)});
    process.stdout.write(JSON.stringify(result)+'\n');
  } catch (e) { process.stderr.write(e.message+'\n'); process.exitCode=1; }
}
