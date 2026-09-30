// Gated file/CPU proof. All rendered inputs pre-exist. Native request/preparation
// is explicitly not a render, accepted-body proof, cloth proof or World test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bindProfile, exportReview, emitNative, parseArgs, rootFile, treeFiles } from './character_profile.mjs';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = value => JSON.stringify(value, null, 2) + '\n';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../../..');
function write(file, value) { fs.writeFileSync(file, json(value), { flag: 'wx' }); }
function copy(root, target, names) {
  assert.equal(fs.existsSync(target), false, 'alternate input must be fresh');
  for (const name of new Set(names)) {
    const dest = path.join(target, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(rootFile(root, name), dest, fs.constants.COPYFILE_EXCL);
    assert.equal(fileSha(dest), fileSha(rootFile(root, name)));
  }
}

async function clockAndPivots(sourceRoot, inputPath, exportRoot) {
  const { validatePackage, frameTicks } = await import(pathToFileURL(path.join(sourceRoot, 'src/lab/contracts.ts')).href);
  const { ClipPlayer } = await import(pathToFileURL(path.join(sourceRoot, 'src/lab/game/clip-player.ts')).href);
  const input = read(inputPath), rows = [];
  for (const v of input.variants) {
    const dir = v.height === 80 ? 'character' : 'character-closeup';
    const envelope = read(path.join(exportRoot, dir, 'review-manifest.json'));
    assert.throws(() => validatePackage(envelope, 'review must not load'));
    assert.equal(envelope.releaseEligible, false);
    assert.equal(fs.existsSync(path.join(exportRoot, dir, 'manifest.json')), false);
    const pkg = validatePackage(envelope.package, 'profile review'), provenance = read(path.join(exportRoot, dir, 'provenance.json'));
    const clip = pkg.clips[0], source = v.clips[0], player = new ClipPlayer(clip);
    let ticks = 0, root = [0, 0];
    for (const [i, f] of source.frames.entries()) {
      const out = clip.frames[i], p = provenance.frames.find(p => p.clip === source.id && p.index === i);
      assert.deepEqual([out.pivot[0] + p.trim[0], out.pivot[1] + p.trim[1]], f.pivot);
      assert.deepEqual(out.anchors, f.anchors);
      for (let t = 0; t < frameTicks(f); t++) {
        assert.equal(player.frame.pose, f.pose);
        assert.equal(player.index, i);
        const d = player.rootMotion() ?? [0, 0];
        for (let axis = 0; axis < 2; axis++) { assert.equal(d[axis], (f.rootMotion?.[axis] ?? 0) / frameTicks(f)); root[axis] += d[axis]; }
        ticks++; player.step();
      }
    }
    assert.equal(player.done, true); assert.equal(ticks, 33);
    rows.push({ height: v.height, frames: source.frames.length, ticks, root, exactSourcePoseAndFootPivots: true, missingCoverage: envelope.missingClips });
  }
  return rows;
}

export async function proveProfile({ out, renderRoot, privateRoot, producerRoot, referenceRoot, existingExportRoot, python = 'python' }) {
  assert.equal(fs.existsSync(out), false, 'proof root must be fresh');
  fs.mkdirSync(out, { recursive: true });
  const historicalProfile = path.join(HERE, 'rosace-historical-review.json'), nativeProfile = path.join(HERE, 'rosace-provisional-w2.json');
  const historical = read(historicalProfile), native = read(nativeProfile), negatives = [];
  const roots = { sourceRoot: REPO, privateRoot, renderRoot, buildRoot: path.join(out, 'original-build'), exportRoot: path.join(out, 'original-packages') };
  function reject(name, action, pattern) { assert.throws(action, pattern); negatives.push(name); }
  reject('unknown executor option', () => parseArgs(['emit-native', '--execute', 'true']), /unknown/);
  reject('duplicate option', () => parseArgs(['inspect', '--profile', 'x', '--profile', 'y']), /duplicate/);
  reject('missing option value', () => parseArgs(['inspect', '--profile']), /explicit values/);
  reject('release mode unsupported', () => parseArgs(['release', '--profile', 'x']), /operation/);
  reject('build overlaps private input', () => bindProfile(historicalProfile, { ...roots, buildRoot: path.join(privateRoot, 'new') }), /overlaps/);
  reject('mixed-case public path', () => bindProfile(historicalProfile, { ...roots, exportRoot: path.join(out, 'PUBLIC', 'packages') }), /publication/);
  const altered = structuredClone(historical); altered.sourcePins[0].sha256 = '0'.repeat(64);
  const alteredPath = path.join(out, 'bad-source-profile.json'); write(alteredPath, altered);
  reject('source content mismatch', () => bindProfile(alteredPath, roots), /source pin changed/);
  const traversal = structuredClone(historical); traversal.sourcePins[0].path = '../outside.mjs';
  const traversalPath = path.join(out, 'traversal-profile.json'); write(traversalPath, traversal);
  reject('source traversal', () => bindProfile(traversalPath, roots), /relative/);
  const wrongChar = structuredClone(historical); wrongChar.character.name = 'another identity';
  const wrongCharPath = path.join(out, 'wrong-character.json'); write(wrongCharPath, wrongChar);
  reject('profile/import identity mismatch', () => bindProfile(wrongCharPath, roots), /character differs/);
  await exportReview(historicalProfile, roots, python);
  const clocks = await clockAndPivots(REPO, path.join(roots.buildRoot, 'authored-review-input.json'), roots.exportRoot);
  const canonicalFiles = ['character/body.png', 'character/review-manifest.json', 'character/provenance.json',
    'character-closeup/body.png', 'character-closeup/review-manifest.json', 'character-closeup/provenance.json'];
  const referenceBytes = canonicalFiles.map(name => {
    assert.equal(fileSha(path.join(roots.exportRoot, name)), fileSha(path.join(existingExportRoot, name)), 'new profile output differs from independently pixel-checked9da output');
    return { path: name, sha256: fileSha(path.join(roots.exportRoot, name)) };
  });
  const altCode = path.join(out, 'alternate-export-source'), altFrames = path.join(out, 'alternate-render-input');
  copy(REPO, altCode, historical.sourcePins.map(p => p.path));
  copy(renderRoot, altFrames, historical.renderPins.map(p => p.path));
  const alternate = { sourceRoot: altCode, privateRoot, renderRoot: altFrames, buildRoot: path.join(out, 'alternate-build'), exportRoot: path.join(out, 'alternate-packages') };
  await exportReview(historicalProfile, alternate, python);
  assert.equal(fileSha(path.join(roots.buildRoot, 'authored-review-input.json')), fileSha(path.join(alternate.buildRoot, 'authored-review-input.json')));
  for (const name of canonicalFiles) assert.equal(fileSha(path.join(roots.exportRoot, name)), fileSha(path.join(alternate.exportRoot, name)), 'cold source+render root changed package');
  const alternateClocks = await clockAndPivots(altCode, path.join(alternate.buildRoot, 'authored-review-input.json'), alternate.exportRoot);
  assert.deepEqual(alternateClocks, clocks);
  reject('fresh output enforced', () => bindProfile(historicalProfile, roots), /fresh output/);
  const mutateName = historical.renderPins.find(p => p.path.endsWith('.png')).path;
  fs.appendFileSync(path.join(altFrames, mutateName), 'mutation');
  reject('render bytes changed', () => bindProfile(historicalProfile, { ...alternate, buildRoot: path.join(out, 'mutated-build'), exportRoot: path.join(out, 'mutated-packages') }), /render input changed/);
  fs.copyFileSync(path.join(altFrames, mutateName), path.join(out, 'rejected-mutated-render.png'), fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(path.join(renderRoot, mutateName), path.join(altFrames, mutateName));
  assert.equal(fileSha(path.join(altFrames, mutateName)), fileSha(path.join(renderRoot, mutateName)));
  const producerNames = native.sourcePins.map(p => p.path);
  const originalProducer = bindProfile(nativeProfile, { sourceRoot: producerRoot, privateRoot, referenceRoot,
    buildRoot: path.join(out, 'producer-inspection-build'), renderRoot: path.join(producerRoot, 'review/rosace/profile-inspection-not-rendered'), exportRoot: path.join(out, 'producer-inspection-packages') }).binding;
  assert.equal(originalProducer.observedGitHead, native.sourceHead);
  for (const tree of native.sourceTrees) producerNames.push(...treeFiles(producerRoot, tree).map(p => p.path));
  const altProducer = path.join(out, 'alternate-native-source'), altPrivate = path.join(out, 'alternate-private-input'), altReference = path.join(out, 'alternate-comparison-input');
  copy(producerRoot, altProducer, producerNames);
  copy(privateRoot, altPrivate, native.privatePins.map(p => p.path));
  copy(referenceRoot, altReference, native.referencePins.map(p => p.path));
  const nativeRoots = { sourceRoot: altProducer, privateRoot: altPrivate, referenceRoot: altReference,
    buildRoot: path.join(out, 'native-request-build'), renderRoot: path.join(altProducer, 'review/rosace/profile-cold'), exportRoot: path.join(out, 'future-packages-unused') };
  reject('unsupported external native output', () => bindProfile(nativeProfile, { ...nativeRoots, renderRoot: path.join(out, 'external-native') }), /only supports/);
  const badNative = structuredClone(native); badNative.native.ss = '1';
  const badNativePath = path.join(out, 'bad-native-settings.json'); write(badNativePath, badNative);
  reject('native settings drift', () => bindProfile(badNativePath, nativeRoots), /preserved provisional/);
  const nativeBinding = bindProfile(nativeProfile, nativeRoots).binding;
  assert.equal(nativeBinding.sourcePins.length, 12);
  assert.deepEqual(nativeBinding.comparison.map(m => m.camera), [[45, 8], [45, 8]]);
  const request = emitNative(nativeProfile, nativeRoots, python);
  assert.equal(request.nativeExecuted, false);
  assert.equal(fs.existsSync(nativeRoots.renderRoot), false, 'emitting native request must never create a render tree');
  assert.equal(request.minimumNewStills, 2);
  const argv = request.command.argv;
  for (const [flag, value] of [['--blend', path.join(altPrivate, 'build/rosace.blend')], ['--r2', path.join(altProducer, native.native.r2)], ['--out', path.join(nativeRoots.renderRoot, 'reconstruction-raw')], ['--px', '144,80'], ['--ss', '4']]) assert.equal(argv[argv.indexOf(flag) + 1], value);
  assert.equal(argv.includes('--save-lane'), false);
  const postEmitRoots = { ...nativeRoots, buildRoot: path.join(out, 'closure-mutated-build') };
  const closureFile = path.join(altProducer, 'tools/pixel-pipeline/rosace/common.py');
  fs.appendFileSync(closureFile, '\n# mutation fixture\n');
  reject('transitive source closure changed', () => bindProfile(nativeProfile, postEmitRoots), /source closure changed/);
  // Restore the exact source snapshot after the rejection so the finite request
  // remains reviewable/runnable by sole delivery from an unchanged pinned root.
  fs.copyFileSync(path.join(producerRoot, 'tools/pixel-pipeline/rosace/common.py'), closureFile);
  assert.equal(fileSha(closureFile), fileSha(path.join(producerRoot, 'tools/pixel-pipeline/rosace/common.py')));
  const proof = { contract: 'dex.character-profile-proof/1', status: 'pass-profile-export-and-native-preparation',
    adapterSha256: fileSha(path.join(HERE, 'character_profile.mjs')), proofSourceSha256: fileSha(fileURLToPath(import.meta.url)),
    profiles: [{ path: historicalProfile, sha256: fileSha(historicalProfile) }, { path: nativeProfile, sha256: fileSha(nativeProfile) }],
    historical: { clocks, packedBytesEqualToIndependentlyPixelChecked9da: referenceBytes, coldReplay: 'alternate code plus rendered input roots,6/6package bytes and input bytes identical', alternateClocks },
    nativePreparation: { producerHead: native.sourceHead, originalProducerObservedGitHead: originalProducer.observedGitHead,
      alternateProducerObservedGitHead: nativeBinding.observedGitHead, snapshotIdentity: 'same pinned producer code/configs/private/comparison bytes; no Git head claimed for snapshot',
      source12Pins: nativeBinding.sourcePins, closureTrees: native.sourceTrees,
      privateInputPins: nativeBinding.privatePins, comparisonPins: nativeBinding.referencePins,
      sourceSnapshot: altProducer, privateSnapshot: altPrivate, comparisonSnapshot: altReference,
      request: path.join(nativeRoots.buildRoot, 'native-request.json'), requestSha256: fileSha(path.join(nativeRoots.buildRoot, 'native-request.json')) },
    negatives, nativeExecuted: false, appearanceAccepted: false, physicalClothProven: false, releasePackageProven: false, worldLoaded: false,
    limits: 'historical N1 packaging and guarded mechanical545 root preparation only; native cold render/rebuild/current body/motion/cloth/fullkit/World acceptance remain open' };
  write(path.join(out, 'proof.json'), proof);
  return proof;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2), args = {};
    assert.equal(argv.length % 2, 0);
    const names = ['out', 'render-root', 'private-root', 'producer-root', 'reference-root', 'existing-export-root', 'python'];
    for (let i = 0; i < argv.length; i += 2) { assert.ok(argv[i].startsWith('--') && names.includes(argv[i].slice(2)) && !args[argv[i].slice(2)] && argv[i + 1]); args[argv[i].slice(2)] = argv[i + 1]; }
    const result = await proveProfile({ out: args.out, renderRoot: args['render-root'], privateRoot: args['private-root'], producerRoot: args['producer-root'],
      referenceRoot: args['reference-root'], existingExportRoot: args['existing-export-root'], python: args.python });
    process.stdout.write(JSON.stringify({ status: result.status, negativeCount: result.negatives.length, nativeExecuted: false, proof: path.join(args.out, 'proof.json') }) + '\n');
  } catch (e) { process.stderr.write(e.stack + '\n'); process.exitCode = 1; }
}
