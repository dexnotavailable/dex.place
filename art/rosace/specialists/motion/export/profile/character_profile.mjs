// Finite profile/root binding. Native requests are data only; this module has no
// native launcher, scheduler, acceptance authority or raw-input export path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const keys = (obj, allowed, label) => {
  fail(obj && typeof obj === 'object' && !Array.isArray(obj), `${label}: object required`);
  fail(Object.keys(obj).every(k => allowed.includes(k)), `${label}: unknown field`);
};
const relative = value => {
  fail(typeof value === 'string' && value.length > 0 && !path.isAbsolute(value)
    && !/^[A-Za-z]:|^[/\\]/.test(value) && !value.split(/[/\\]/).some(s => !s || s === '.' || s === '..'), 'relative file/directory required');
  return value;
};
export const within = (root, target) => {
  const rel = path.relative(root, target);
  return rel === '' || !(rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel));
};

// Resolve missing output leaves through their nearest real parent. A symlink in
// an existing ancestor cannot turn a supposedly fresh output into a read root.
export function resolveRoot(value) {
  fail(typeof value === 'string' && path.isAbsolute(value), 'every root must be explicit and absolute');
  const missing = [];
  let existing = path.resolve(value);
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    fail(parent !== existing, 'root has no existing ancestor');
    existing = parent;
  }
  const result = path.join(fs.realpathSync(existing), ...missing);
  fail(/^[dD]:[\\/]/.test(result), 'active profile roots must be D-backed');
  return result;
}

export function rootFile(root, name) {
  relative(name);
  const full = fs.realpathSync(path.resolve(root, name));
  fail(within(root, full) && full !== root && fs.statSync(full).isFile(), `file escapes root: ${name}`);
  return full;
}

export function treeFiles(root, tree) {
  keys(tree, ['path', 'extensions', 'sha256', 'count'], 'source tree');
  relative(tree.path);
  fail(Array.isArray(tree.extensions) && tree.extensions.length > 0 && tree.extensions.every(e => ['.py', '.json'].includes(e)), 'source tree extensions');
  const dir = fs.realpathSync(path.resolve(root, tree.path));
  fail(within(root, dir) && fs.statSync(dir).isDirectory(), 'source tree escapes root');
  const rows = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      fail(!entry.isSymbolicLink(), 'source tree symlink is not a pinned source file');
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && tree.extensions.includes(path.extname(entry.name))) {
        const name = path.relative(root, full).replaceAll('\\', '/');
        rows.push({ path: name, sha256: sha(fs.readFileSync(full)) });
      }
    }
  }
  walk(dir);
  return rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function checkPins(root, pins, label) {
  fail(Array.isArray(pins) && pins.length > 0, `${label}: explicit pins required`);
  fail(new Set(pins.map(p => p.path)).size === pins.length, `${label}: duplicate pins`);
  return pins.map(p => {
    keys(p, ['path', 'sha256'], label);
    fail(/^[0-9a-f]{64}$/.test(p.sha256), `${label}: SHA256 required`);
    fail(sha(fs.readFileSync(rootFile(root, p.path))) === p.sha256, `${label} changed: ${p.path}`);
    return p;
  });
}

function fresh(root) { fail(!fs.existsSync(root), `fresh output required: ${root}`); }
function noOverlap(write, reads) {
  for (const root of reads) fail(!within(root, write) && !within(write, root), 'output overlaps source/private/reference input');
  fail(!write.split(/[\\/]/).some(s => s.toLowerCase() === 'public'), 'profile emits private review work only; publication stays with delivery');
}
function writeFresh(file, value) { fs.writeFileSync(file, bytes(value), { flag: 'wx' }); }

export function bindProfile(profilePath, rootValues) {
  const profileBytes = fs.readFileSync(profilePath), profile = JSON.parse(profileBytes.toString('utf8').replace(/^\uFEFF/, ''));
  keys(profile, ['contract', 'id', 'kind', 'character', 'sourceHead', 'sourcePins', 'sourceTrees', 'privatePins', 'renderPins', 'referencePins', 'historical', 'native', 'limits'], 'profile');
  fail(profile.contract === 'dex.character-profile/1' && /^[a-z0-9-]+$/.test(profile.id), 'profile contract/id required');
  fail(['historical-review', 'provisional-w2-native-request'].includes(profile.kind), 'unsupported producer adapter');
  keys(profile.character, ['id', 'name'], 'character');
  fail(profile.character.id === 'rosace' && typeof profile.character.name === 'string', 'this finite seam needs an explicit Rosace profile');
  fail(/^[0-9a-f]{40}$/.test(profile.sourceHead), 'exact declared source head required');
  const requiredRoots = ['sourceRoot', 'privateRoot', 'buildRoot', 'renderRoot', 'exportRoot'];
  if (profile.kind === 'provisional-w2-native-request') requiredRoots.push('referenceRoot');
  keys(rootValues, requiredRoots, 'roots');
  const roots = Object.fromEntries(requiredRoots.map(k => [k, resolveRoot(rootValues[k])]));
  for (const k of ['sourceRoot', 'privateRoot', ...(roots.referenceRoot ? ['referenceRoot'] : [])]) fail(fs.statSync(roots[k]).isDirectory(), `${k} must exist`);
  const sourcePins = checkPins(roots.sourceRoot, profile.sourcePins, 'source pin');
  const sourceTrees = (profile.sourceTrees ?? []).map(tree => {
    const files = treeFiles(roots.sourceRoot, tree);
    fail(files.length === tree.count && sha(bytes(files)) === tree.sha256, `source closure changed: ${tree.path}`);
    return { ...tree, files };
  });
  let observedGitHead = null;
  try {
    const gitRoot = execFileSync('git', ['-C', roots.sourceRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    // A parent checkout is not sourceRoot's own identity.
    if (fs.realpathSync(gitRoot) === roots.sourceRoot) {
      observedGitHead = execFileSync('git', ['-C', roots.sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
      if (observedGitHead !== profile.sourceHead) {
        fail(profile.kind === 'historical-review', 'native producer Git head differs from frozen profile');
        execFileSync('git', ['-C', roots.sourceRoot, 'merge-base', '--is-ancestor', profile.sourceHead, observedGitHead], { windowsHide: true });
      }
    }
  } catch (e) {
    // Snapshots have no .git. A discovered source repository with a mismatch is
    // an error; it cannot be relabelled a snapshot to skip the identity check.
    if (observedGitHead !== null) throw e;
  }
  const result = { contract: 'dex.character-profile-binding/1', profileId: profile.id, kind: profile.kind,
    profileSha256: sha(profileBytes), adapterSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    declaredSourceHead: profile.sourceHead, observedGitHead,
    sourceHeadProof: observedGitHead ? 'executing Git root/head inspected; exact profile pins validated' : 'no Git head claimed; profile-pinned code/config snapshot bytes only',
    roots, sourcePins, sourceTrees, character: profile.character, nativeExecuted: false, releaseEligible: false, limits: profile.limits };
  const pinned = name => fail(sourcePins.some(p => p.path === name) || sourceTrees.some(t => t.files.some(p => p.path === name)), `entry/config is not pinned: ${name}`);
  fresh(roots.buildRoot); fresh(roots.exportRoot);
  const immutable = [roots.sourceRoot, roots.privateRoot, ...(roots.referenceRoot ? [roots.referenceRoot] : [])];
  noOverlap(roots.buildRoot, immutable); noOverlap(roots.exportRoot, immutable);
  fail(roots.buildRoot !== roots.exportRoot && !within(roots.exportRoot, roots.buildRoot), 'build/export roots collide');
  if (profile.kind === 'historical-review') {
    fail(profile.native === undefined && profile.privatePins === undefined && profile.referencePins === undefined, 'historical profile cannot bind native inputs');
    keys(profile.historical, ['importer', 'exporter', 'config'], 'historical adapter');
    for (const name of Object.values(profile.historical)) { rootFile(roots.sourceRoot, name); pinned(name); }
    fail(fs.statSync(roots.renderRoot).isDirectory(), 'historical render input must exist');
    noOverlap(roots.buildRoot, [roots.renderRoot]); noOverlap(roots.exportRoot, [roots.renderRoot]);
    result.renderPins = checkPins(roots.renderRoot, profile.renderPins, 'render input');
    const cfg = read(rootFile(roots.sourceRoot, profile.historical.config));
    fail(JSON.stringify(cfg.character) === JSON.stringify(profile.character), 'profile/import character differs');
  } else {
    fail(profile.historical === undefined && profile.renderPins === undefined, 'native profile cannot import historical frames');
    const n = profile.native;
    keys(n, ['wrapper', 'blenderEnv', 'r2', 'blend', 'sourceRequest', 'shots', 'head', 'handScale', 'mode', 'px', 'ss', 'camera', 'expected'], 'native adapter');
    fail(n.shots === 'idle' && n.head === '1.10' && n.handScale === '1.3' && n.mode === 'reconstruction' && n.px === '144,80' && n.ss === '4', 'only preserved provisional545 two-still settings supported');
    for (const name of [n.wrapper, n.blenderEnv, n.r2, n.sourceRequest]) { rootFile(roots.sourceRoot, name); pinned(name); }
    result.privatePins = checkPins(roots.privateRoot, profile.privatePins, 'private input');
    fail(result.privatePins.some(p => p.path === n.blend), 'native blend needs a private content pin');
    result.referencePins = checkPins(roots.referenceRoot, profile.referencePins, 'native comparison input');
    const review = resolveRoot(path.join(roots.sourceRoot, 'review/rosace'));
    fail(roots.renderRoot !== review && within(review, roots.renderRoot), 'producer --out only supports executing sourceRoot/review/rosace descendants');
    fresh(roots.renderRoot);
    for (const inputRoot of [roots.privateRoot, roots.referenceRoot]) noOverlap(roots.renderRoot, [inputRoot]);
    fail(!within(roots.renderRoot, roots.buildRoot) && !within(roots.buildRoot, roots.renderRoot)
      && !within(roots.renderRoot, roots.exportRoot) && !within(roots.exportRoot, roots.renderRoot), 'native render/write roots collide');
    const request = read(rootFile(roots.sourceRoot, n.sourceRequest));
    fail(request.wrapper === n.wrapper && request.guardRelaxed === false && request.canonicalChanges === false, 'preserved producer request differs');
    // Actual pass metadata binds cameras/canvas/foot origins; no camera argument
    // is injected into the guarded wrapper.
    result.comparison = [80, 144].map(px => {
      const metaName = `reconstruction-raw/idle/px${px}/meta.json`;
      fail(result.referencePins.some(p => p.path === metaName), 'reference metadata pin missing');
      const meta = read(rootFile(roots.referenceRoot, metaName));
      fail(meta.px === px && meta.ss === 4 && meta.yaw === n.camera[0] && meta.elev === n.camera[1], 'reference camera/size differs');
      return { px, ss: meta.ss, camera: [meta.yaw, meta.elev], canvas: meta.canvas, anchor: meta.anchor, ppm: meta.ppm };
    });
  }
  return { profile, binding: result };
}

export async function exportReview(profilePath, roots, python = 'python') {
  const { profile, binding } = bindProfile(profilePath, roots);
  fail(profile.kind === 'historical-review', 'native stills cannot be exported as motion frames');
  const source = binding.roots.sourceRoot, adapter = profile.historical;
  const importer = await import(pathToFileURL(rootFile(source, adapter.importer)).href);
  const exporter = await import(pathToFileURL(rootFile(source, adapter.exporter)).href);
  fs.mkdirSync(binding.roots.buildRoot, { recursive: true });
  const inputPath = path.join(binding.roots.buildRoot, 'authored-review-input.json');
  const imported = importer.fromMotionMeta({ configPath: rootFile(source, adapter.config), sourceRoot: binding.roots.renderRoot, outputPath: inputPath });
  const exported = exporter.exportFrames({ inputPath, sourceRoot: binding.roots.renderRoot, outputRoot: binding.roots.exportRoot, mode: 'review', python });
  binding.inputSha256 = sha(fs.readFileSync(inputPath));
  binding.exportMode = 'review'; binding.imported = imported; binding.exported = exported;
  writeFresh(path.join(binding.roots.buildRoot, 'profile-binding.json'), binding);
  return binding;
}

export function emitNative(profilePath, roots, python = 'python') {
  const { profile, binding } = bindProfile(profilePath, roots);
  fail(profile.kind === 'provisional-w2-native-request', 'historical frames are not a native producer');
  const r = binding.roots, n = profile.native;
  const output = path.join(r.renderRoot, 'reconstruction-raw');
  const request = { contract: 'dex.character-native-request/1', id: `${profile.id}-cold-two-still`,
    targetOwner: 'stage1-delivery', status: 'proposed-native-replay', nativeExecuted: false,
    character: profile.character, declaredProducerHead: profile.sourceHead, appearanceStatus: 'rejected-mechanical-prototype', binding,
    command: { executable: python, cwd: r.sourceRoot,
      env: { ROSACE_BUILD: r.buildRoot, DEXPLACE_DOWNLOADS: path.join(r.privateRoot, 'downloads'), ROSACE_BASES: path.join(r.privateRoot, 'bases') },
      argv: [rootFile(r.sourceRoot, n.blenderEnv), 'run', '--python-exit-code', '1', '--python', rootFile(r.sourceRoot, n.wrapper), '--',
        '--reconstruction-mode', n.mode, '--hand-scale', n.handScale, '--shots', n.shots,
        '--blend', rootFile(r.privateRoot, n.blend), '--r2', rootFile(r.sourceRoot, n.r2),
        '--head', n.head, '--ss', n.ss, '--px', n.px, '--out', output] },
    expectedOutputs: n.expected.map(name => path.join(output, relative(name))),
    comparisonRoot: r.referenceRoot, minimumNewStills: 2,
    nativeEnvironment: 'reuse sole delivery verified Blender5.1.2 isolated environment/backend; do not run setup/downloads or save a blend',
    requiredChecks: [
      'Gate and freeze the producer source/private/reference pins; verify exact Git producer head or exact hash-bound cold snapshot provenance.',
      'Run only this finite candidate replay with sole delivery native/GPU ownership. Original sharp_face/mesh/hand/R2 guards must remain unchanged.',
      'Compare native albedo/id/normal/depth/light/beauty and camera/canvas/ppm/anchors against each pinned545 candidate; record pixel/hash equality or diagnosed differences.',
      'Require native mesh4737 retained faces, full typed face/corner/point/key/weight preservation, recipe/contact/effectivePose/bone equality and both80/144 actual output.',
      'Reusing finished controls/post requires their own exact pins; this two-still raw replay does not independently rerun the full six-still native post.'
    ],
    unsupportedAdapters: [
      'Arbitrary external renderRoot blocked by nx_reconstruction_blender.py private executing review-root guard; request an owner-reviewed root adapter instead of weakening it.',
      'Producer opens pinned baseline .blend and reconstructs it in memory; no source-to-baseline build command is emitted.',
      'Raw ss4 still passes are not dex.authored-frames/1. Stage3 must deliver paired native finished motion/physical-cloth/FX/transitions with per-frame60Hz foot/root/source keys.',
      'No accepted9 body, current cloth, finished motion package, World installation or publication is established.'
    ] };
  fs.mkdirSync(r.buildRoot, { recursive: true });
  writeFresh(path.join(r.buildRoot, 'profile-binding.json'), binding);
  writeFresh(path.join(r.buildRoot, 'native-request.json'), request);
  return request;
}

export function parseArgs(argv) {
  const operation = argv[0];
  fail(['inspect', 'export-review', 'emit-native'].includes(operation), 'operation: inspect|export-review|emit-native');
  const options = {};
  const names = ['profile', 'source-root', 'private-root', 'build-root', 'render-root', 'export-root', 'reference-root', 'python'];
  fail(argv.length % 2 === 1, 'options require explicit values');
  for (let i = 1; i < argv.length; i += 2) {
    const name = argv[i]?.replace(/^--/, '');
    fail(argv[i]?.startsWith('--') && names.includes(name) && options[name] === undefined
      && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--'), 'unknown/duplicate/missing option');
    options[name] = argv[i + 1];
  }
  fail(options.profile, 'profile file required');
  const roots = {};
  for (const name of names.filter(n => n.endsWith('-root'))) if (options[name]) roots[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = options[name];
  return { operation, profilePath: options.profile, roots, python: options.python ?? 'python' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = args.operation === 'emit-native' ? emitNative(args.profilePath, args.roots, args.python)
      : args.operation === 'export-review' ? await exportReview(args.profilePath, args.roots, args.python)
      : bindProfile(args.profilePath, args.roots).binding;
    process.stdout.write(JSON.stringify({ status: args.operation, profile: result.profileId ?? result.binding.profileId,
      nativeExecuted: false, releaseEligible: false, roots: result.roots ?? result.binding.roots }) + '\n');
  } catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; }
}
