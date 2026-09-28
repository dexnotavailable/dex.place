"""Build the reviewed, portable dex.place documentation edition and its gallery manifest.

No directory-wide export: ALLOWLIST is the only source authority. Source hashes and
section transformations are written outside public/. The online JSON and ZIP both
consume the exact same sanitized Markdown bytes. ZIP timestamps/order are fixed.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import unicodedata
import zipfile
from pathlib import Path
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
SOURCE = SITE / 'docs/world-website'
EXPORT_CONFIG = json.loads((SITE / 'scripts/world-docs-export.json').read_text(encoding='utf-8'))
VERSION = EXPORT_CONFIG['version']
if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)*', VERSION):
    raise ValueError('Invalid public edition version')
def specification_version(text: str) -> str:
    match = re.search(r'(?m)^Source specification version:\s*([0-9]+(?:\.[0-9]+)*)\b', text)
    if match is None:
        raise ValueError('Specification README needs a Source specification version: <version> line')
    return match.group(1)

SOURCE_SPEC_VERSION = specification_version((SOURCE / 'README.md').read_text(encoding='utf-8-sig'))
if SOURCE_SPEC_VERSION != EXPORT_CONFIG['sourceSpecificationVersion']:
    raise ValueError('Source specification differs from the reviewed public export configuration')
DATE = '2026-09-08'
ALLOWLIST = [
    ('README.md', 'index'),
    ('00-decisions-and-scope.md', 'decisions-and-scope'),
    ('01-art-direction-and-audio.md', 'art-direction-and-audio'),
    ('02-world-and-gameplay.md', 'world-and-gameplay'),
    ('03-sections-and-controls.md', 'sections-and-controls'),
    ('04-donation.md', 'donation'),
    ('05-shell-and-system-controls.md', 'shell-and-system-controls'),
    ('06-mobile-accessibility.md', 'mobile-accessibility'),
    ('07-content-runtime-and-hosting.md', 'content-runtime-and-hosting'),
    ('08-acceptance-and-delivery.md', 'acceptance-and-delivery'),
    ('09-sources-open-items-and-changelog.md', 'sources-and-change-rules'),
    ('10-world-production-workflow.md', 'world-production-workflow'),
    ('11-framing-and-sprite-comparison.md', 'framing-and-sprite-comparison'),
    ('12-audio-composition-and-budget.md', 'audio-composition-and-budget'),
    ('13-build-readiness-and-scope.md', 'build-readiness-and-scope'),
    ('14-local-audio-model-research.md', 'local-audio-model-research'),
    ('15-after-go-workflow.md', 'after-go-workflow'),
    ('16-copy-and-input-contract.md', 'copy-and-input-contract'),
    ('17-arrival-and-first-impression.md', 'arrival-and-first-impression'),
    ('18-physical-interface-and-review-loop.md', 'physical-interface-and-review-loop'),
    ('19-world-asset-inventory.md', 'world-asset-inventory'),
    ('20-world-repair-after-playtest.md', 'world-cohesion-revision'),
    ('21-next-pass-world-and-experience.md', 'inhabited-world-and-experience'),
    ('22-dex-account-treasury-and-social-presence.md', 'dex-account-treasury-and-social-presence'),
    ('23-code-donors-and-integration-sources.md', 'code-donors-and-integration-sources'),
    ('24-animation-and-art-donor-catalog.md', 'animation-and-art-donor-catalog'),
    ('25-design-reference-and-production-rules.md', 'design-reference-and-production-rules'),
    ('26-v2-implementation-record.md', 'v2-implementation-record'),
]
MAPPING = dict(ALLOWLIST)
PHYSICAL = [
    ('controls', 'shell-and-system-controls', 'global-control-registry', 'Controls'),
    ('movement', 'world-and-gameplay', '5-player-movement-and-controls', 'Movement'),
    ('downloads', 'sections-and-controls', '3-downloads-place-content-and-transfer', 'Downloads'),
    ('illustrations', 'sections-and-controls', '5-illustrations-exhibit-hall-and-full-artwork-viewer', 'Illustrations'),
    ('donate', 'donation', 'amount-behavior', 'Donate'),
    ('accessibility', 'mobile-accessibility', '5-assist-settings', 'Accessibility'),
]
ART = [
    ('shot-18-2', 'shot_18-2.png', 'Black-haired figure in a suit surrounded by sweeping black ink marks.'),
    ('shot-23', 'shot_23.png', 'Smiling red-haired character with closed eyes, black ribbons and sketch-like fading edges.'),
    ('inshot-20260620-071233415', 'InShot_20260620_071233415.jpg', 'Close-up of a red-haired, golden-eyed character against a pale blue sky with red and black graphic marks.'),
    ('inshot-20260826-123444237', 'InShot_20260826_123444237.jpg', 'Red-and-white-haired hooded character crouching in a glowing red scene.'),
    ('inshot-20260721-200821729', 'InShot_20260721_200821729.jpg', 'Ensemble character poster with red, black and white graphics and VNMC 4K 2026 CONVERGENCE text.'),
    ('inshot-20260708-060051952', 'InShot_20260708_060051952.jpg', 'Character in a split black-and-white coat beneath a large black brushstroke.'),
    ('inshot-20260708-055457338', 'InShot_20260708_055457338.jpg', 'Black-haired character in a long dark coat and red tie with cyan graphic strokes.'),
    ('kaizen', 'KAIZEN.png', 'Red-and-white-haired character standing in a dark hoodie and loose trousers against a peach background.'),
    ('towaki', 'TOWAKI.png', 'Lilac-haired character in a white dress carrying an oversized gun and hammer against a vivid pink background.'),
]

# Current portable status shared by the curated handoffs. Private account and
# operator receipts remain outside this edition; these claims have source owners.
LOCAL_REPAIR_STATUS = EXPORT_CONFIG['portableStatus']['implementation']
BANK_REVIEW_STATUS = EXPORT_CONFIG['portableStatus']['bank']
MUSIC_REVIEW_STATUS = EXPORT_CONFIG['portableStatus']['music']

# Whole sections rewritten for portability. Public contracts elsewhere are retained
# literally. These replacements remove operator/account history, not visitor rules.
REWRITES = {
 ('audio-composition-and-budget', 'Current direction and runtime checkpoint'): MUSIC_REVIEW_STATUS + '\n\nThe authored source is a sixteen-bar theme at 56 BPM in D minor, with a recurring A-D-E-F gesture. The current runtime selection has one music entry, two ambience entries and thirteen effects; nine rejected/unused or deferred entries remain reserved. Arrival and Support share the theme; Exhibition uses it more quietly. Dispatch, Archive and enclosed thresholds are musically silent. Reading and full artwork inspection stop music, ambience and effects.\n\nOne realtime output context plays the 48 kHz masters, while one lazy non-rendering 48 kHz offline context decodes them after opt-in. The current sixteen-buffer set measures 37,682,372 decoded bytes across the tested 48/96/192 kHz Brave output profiles with Opus/AAC. This proves the tested media cache behavior, not listening quality or total browser memory. Preserve musical phrasing and the 64 MiB application buffer cap; use a separately verified streaming route if the complete intended replacement cannot fit.',
 ('world-cohesion-revision', "World repair after Dex's playtest"): f'Source specification {SOURCE_SPEC_VERSION} records an active world, traversal and audio repair. The previous implementation candidate was rejected in playtesting and is not approved for promotion. Clearer destinations, physically coherent mechanisms, calm music with deliberate silence, better stair grounding and quieter recorded footsteps are required. Existing content, control identities and accessible alternatives remain in scope. Earlier functional receipts apply only to their tested behaviors; they do not establish whole-experience acceptance.',
 ('world-cohesion-revision', 'Current decisions versus pending implementation'): MUSIC_REVIEW_STATUS + '\n\n' + LOCAL_REPAIR_STATUS + '\n\nOrdinary regions share a calm vocabulary; enclosed transitions, reading and artwork views use explicit quiet states. ElevenLabs remains reserved. Renderer loss stops input, exposes error/Retry and requires a fresh canvas rather than resuming an old encounter. The earlier rejected candidate cannot be promoted or treated as completion.',
 ('world-cohesion-revision', 'Suno arrangement refinement'): 'The written melody was developed through a bounded Suno arrangement pass; the selected B interpretation is now integrated. The uploaded reference moves the lead one octave higher while preserving the bass and harmony registers. The first two bars have no accompaniment: a two-beat pre-roll places the first piano attack near 2.68 s, gentle harmony near 10.73 s and strings near 15.11 s. The complete reference lasts about 73.71 s including its ending tail; it is not a seamless runtime loop. Preserve the original MIDI, score, sampled render and complete generated outputs.\n\n' + MUSIC_REVIEW_STATUS + '\n\nThe MP3 exports measure -14.14 and -12.40 LUFS against the reference\'s -21.27 LUFS. Separate comparison files apply gain only, with no timing or content changes. A measured low-level ending does not establish natural musical resolution. The later user selection and complete-cue runtime derivative supersede that comparison stage. Exact 4,020,960-frame media, loop-boundary and 132 native-manager assertions pass across the tested output rates and codecs. No subscription purchase, top-up or public song publishing follows automatically from this offline authoring process. Account identities, request identifiers and credit ledgers stay private.\n\nDecode current 48 kHz masters at 48 kHz through one lazy non-rendering offline decode context, while retaining one realtime playback context. This preserves source-rate buffer storage when the output device runs at 96 or 192 kHz. Browser playback resamples without changing pitch or duration. Create the decode owner only after sound opt-in and release its reference on disposal. The 64 MiB application buffer cap remains; reservations use the actual decode rate and encoded padding allowance. Browser-internal decoder scratch memory is not claimed measured. The selected B arrangement has its own exact-media budget and loop proof. Do not shorten or damage a phrase to fit the cap; use a separately verified streaming route if the complete intended master does not fit.',
 ('art-direction-and-audio', 'Provider and asset-production boundary'): 'Image and audio providers are offline authoring tools. The public website plays reviewed exported files; visitor actions never start generation, consume provider credits or expose production credentials. The selected character uses its coherent authored CC0 animations. New original environment imagery is generated as separate foreground pieces followed by background depth roles and inspected in the assembled scene. The bounded sprite comparison is closed. The built-in hosted generator\'s backend identity was not exposed; avoid unverified model claims. ElevenLabs remains reserved by default, with local audio production proposed in the audio research chapter. Exact rights and output provenance must be verified before public use.',
 ('world-production-workflow', '2. Proposed toolchain and current truth'): '| Job | Proposed owner | Required proof |\n|---|---|---|\n| Map composition | Tiled layers, object classes, templates and JSON export | Actual native map import and coherent collision. |\n| Game runtime | Phaser within the React/Vite DOM shell | Browser movement, animation, object states and mobile integration. |\n| Pixel/animation authoring | Krita with editable frame sources | Controlled source-to-export pipeline. |\n| Static environment production | Individual original foreground pieces, then separate middle/far/sky layers | Inspect every output in composition; no new character-sheet competition or one-shot world image. |\n| Sound production | Finished music, ambience and effects | Offline production, actual listening and browser codec proof. |\n| Conditional character fallback | Controlled Blender model/rig/camera renders | Use only after a documented need; a present tool is not a proven animation pipeline. |\n\n**PROPOSED DEFAULT:** Tiled, Phaser and Krita form the first route. Prove one complete room before expansion. Keep one game runtime; change it only for a concrete documented failure.',
 ('index', 'Current handoff'): f'Edition {VERSION} remains the first unpublished public-design candidate, drawn from source specification revision {SOURCE_SPEC_VERSION}. [The world-cohesion revision](20-world-repair-after-playtest.md) owns the active repair. ' + LOCAL_REPAIR_STATUS + '\n\n' + MUSIC_REVIEW_STATUS + '\n\n' + BANK_REVIEW_STATUS + '\n\nThe unchanged authored CC0 hero, independent assets, pixel consistency, four primary sections, stable controls and artwork display-only boundary remain required. Reader/search and ZIP share the same sanitized bytes; candidate exports may change before first publication, while published edition bytes are immutable.',
 ('content-runtime-and-hosting', 'Existing owner evidence'): 'The website uses React, TypeScript, Vite and pnpm. Public content is exported through a reviewed adapter. An established origin and HTTPS delivery route remain the deployment/rollback owner; this design edition does not claim that the repaired candidate has been promoted there. Desktop-client releases and unrelated project code are separate work. Historical deployment records are not current health proof; verify the actual origin, public routes and retained rollback build before promotion.',
 ('content-runtime-and-hosting', 'Private authoring and reviewed export roots'): 'Keep editable artwork, native donor frames, audio masters, raw generation attempts and detailed provenance in private authoring storage, separate from served directories. Only the reviewed importer/exporter emits bounded runtime and display derivatives. Do not copy original art, donor archives, private manifests, operating records or credentials into public assets. Use explicit source/destination roles and keep release version control separate from private authoring. [Build readiness](13-build-readiness-and-scope.md) defines the shared-export and handoff boundary.',
 ('sources-and-change-rules', 'Current local evidence'): 'Source review covers the website runtime, public content catalog, Daniel font/wordmark assets, nine gallery display exports and existing hosting documentation. Review does not establish publication rights, current endpoint health or browser behavior by itself. Source and private proof inventories are intentionally omitted from this portable edition.',
 ('sources-and-change-rules', 'Planning evidence snapshot'): 'The initial planning review located the website source, content catalog, Daniel wordmark/font sources, selected illustration exports and historical hosting records. Those checks are preserved as planning history, not current endpoint, release-rights or browser proof. Exact workstation paths, unrelated repository changes and operator records are private.',
 ('sources-and-change-rules', 'Current implementation evidence'): LOCAL_REPAIR_STATUS + '\n\n' + BANK_REVIEW_STATUS + '\n\n' + MUSIC_REVIEW_STATUS + '\n\nReader/gallery/donation/settings behavior, exact ZIP handoff, QR payload decoding, source-rate audio decoding and Firefox/WebKit viewport journeys have scoped local receipts. Each result is limited to its recorded build and environment. Local HTTPS staging does not establish public delivery; emulation does not establish physical-device behavior, and waveform/codec checks do not establish subjective listening. Private operator paths, capture hashes, request queues and task chronology are excluded.',
 ('sources-and-change-rules', 'Change record format'): 'Every revision records the affected requirement/control IDs, exact before/after behavior, classification (confirmed/proposed/deferred), reason, changed acceptance expectations and verification state. Do not silently replace an existing decision. Public editions are immutable: a later change publishes a new version and does not replace earlier archive bytes.',
 ('sources-and-change-rules', 'Handoff note'): f'The first public documentation edition remains {VERSION}, an unpublished candidate based on source specification revision {SOURCE_SPEC_VERSION}. The prior implementation candidate was rejected; [the world-cohesion revision](20-world-repair-after-playtest.md) owns the current repairs. ' + LOCAL_REPAIR_STATUS + '\n\n' + MUSIC_REVIEW_STATUS + '\n\n' + BANK_REVIEW_STATUS + '\n\nThe unchanged authored CC0 hero, stable requirements/control IDs, four sections, layered inventory and display-only personal-art boundary remain required. Online reader/search and ZIP share this sanitized edition. Candidate exports may be refreshed before first publication; published bytes become immutable at verified promotion. Private operator chronology and proof inventories are excluded.',
 ('world-asset-inventory', 'Initial actual status'): 'Raw generated drafts, user style approval, usable-source acceptance and runtime integration are separate facts. Multiple revisions of one object count as one roster role. A baked checker background is an image defect, not transparency. Correct pixel pitch at the intended world size and prove clean separation before acceptance; later integration additionally needs actual scene evidence. Track current sources, measurements, transformations and live request state in the private production inventory. The authored CC0 hero and the gallery remain separate collections.',
 ('framing-and-sprite-comparison', 'Experiment boundary'): 'The bounded image comparison is closed. No generated character sheet is accepted for production. The chosen authored CC0 character remains the initial animation source. Further experiments require a separate documented scope; they must preserve provenance, exact model identity when exposed, parameters and all results. A pending generation is inspected through its existing record rather than resubmitted blindly. Account access, request identifiers and billing history are not part of the public edition.',
 ('framing-and-sprite-comparison', 'Outcome and attempt register'): 'The comparison tested the hosted built-in image route and named GPT Image 2, Nano Banana Pro, Seedream 5 Pro and Recraft 4.1 routes. The built-in backend identity was not exposed, so the comparison cannot establish that every branded route represents a distinct model family. One sample per valid route is limited feasibility evidence. A malformed transport attempt was excluded from quality scoring. Outputs were not promoted into the game. The observations below retain the practical lessons; account ledgers and provider identifiers are excluded.',
 ('audio-composition-and-budget', 'ElevenLabs budget: credits are not automatically API dollars'): 'ElevenLabs is reserved for other media projects; the default website allocation is zero. Local authoring and playback of completed files do not consume per-generation provider credits. If a paid route is explicitly selected later, verify its actual plan, billing unit, exact request cost, intended-use terms and bounded allowance before generation. Creative credits and API-dollar pricing must not be assumed interchangeable. Source duration and variant count affect cost; a shorter runtime loop does not imply a shorter billed source request. Target correction at the failed asset rather than regenerating the library. Stem separation, inpainting, extra variants, voice and video are not automatically included. Private account balances and cost ledgers are excluded from this public edition.',
 ('audio-composition-and-budget', 'Higgsfield alternative: live read-only quotes'): 'Higgsfield can expose music and audio-generation routes such as Sonilo and Mirelo. A schema or quote proves availability/cost lookup only; it does not prove atmosphere, seamless looping or publication rights. Treat it as a bounded alternative to the local route. Audition one cue against the composition target before expanding production. Provider credits are not interchangeable across services. If the selected route fails the intended result, document a verified replacement; no purchase or unlimited retry batch is implicit. Private quotes, balances, request identifiers and accounting are excluded.',
 ('local-audio-model-research', 'Fresh local inventory'): 'Runtime and model readiness must be verified before authoring. An older model version, a cache marker or an environment directory does not establish that the selected checkpoint can run. Check exact weights, runtime dependencies, available memory, physical storage and license. Preserve reusable archives instead of duplicating them. Published accelerator benchmarks are not evidence for a different workstation. The proposed ACE route and Stable Audio alternative remain subject to actual inference and listening proof. Private machine inventories and drive paths are excluded.',
 ('local-audio-model-research', 'Credits and scope'): 'ElevenLabs remains reserved; the default website allocation is zero. Local generation uses compute, electricity and storage rather than per-generation provider credits. Verify exact checkpoint and supporting-component rights. Higgsfield is a bounded fallback, not an automatic parallel batch. Visitors play finished assets and never trigger generation.',
 ('after-go-workflow', 'Establish the need'): 'Forecast additional physical storage for the isolated website checkout, missing dependencies, one selected model/runtime, temporary download/extraction duplication, build outputs, media exports and one rollback build. Count actual new physical bytes rather than path labels or already archived assets. Retain an 8 GiB working reserve beyond the forecast peak, revising it only from measured workload. Use the designated active-work volume and bulk archive; do not silently fill the system drive. Cleanup is conditional on this forecast. Private drive snapshots and candidate-file inventories are excluded.',
 ('build-readiness-and-scope', '8. Carry the actual reviewed spec into implementation'): 'Transfer the reviewed design package into the implementation checkout explicitly; a clean revision alone may omit later approved documents. Record each allowlisted source file, byte length and hash in a private handoff manifest. Copy only the reviewed website specification and its required implementation guidance, leaving unrelated projects and releases untouched. Verify hashes and local links after transfer and read the current owners before coding. Public export manifests remain separate from this private handoff evidence. This process does not itself commit, publish or claim runtime success.',
 ('build-readiness-and-scope', '5. One reviewed public documentation edition'): f'The online reader, search index, physical-file targets and ZIP share one reviewed sanitized export and edition ID. The current source specification is revision {SOURCE_SPEC_VERSION}; public documentation edition {VERSION} remains an unpublished repair candidate. The five-room repair is integrated locally with scoped traversal and interface proof. Music, recorded footsteps, physical-device checks and whole-experience acceptance remain open; boss work is deferred under [the world-cohesion revision](20-world-repair-after-playtest.md). This export does not establish public promotion. Reader records, sanitized files, ZIP and release metadata must be generated from the same bytes and reviewed together. Candidate exports may be refreshed before first publication. Once published, versioned bytes are immutable and later changes require a new public edition. A version label or generated archive does not establish public availability.',
 ('copy-and-input-contract', '4. Copy audit recorded in this pass'): 'The visitor-copy contract excludes role labels, biographies, taglines and fundraising pitches. Keep the functional donation heading, method choices and factual instructions. Retain literal victory/download states and accurate metadata; a browser request is distinct from a saved file or installed program. Atmospheric language remains design direction rather than automatically becoming live banners. Legacy runtime copy must pass this same contract before reuse.',
}

# V2 supersedes old curated handoff summaries without rewriting the published1.0
# files. Historical chapters remain, with explicit current ownership pointers.
REWRITES.update({
 ('index', 'Current handoff'): f'Edition{VERSION} is the new unpublished candidate from source specification{SOURCE_SPEC_VERSION}. Published1.0 is retained unchanged. Read [21](21-next-pass-world-and-experience.md), [22](22-dex-account-treasury-and-social-presence.md), then [26](26-v2-implementation-record.md) for current scope and actual implementation evidence. ' + LOCAL_REPAIR_STATUS + '\n\n' + MUSIC_REVIEW_STATUS + '\n\n' + BANK_REVIEW_STATUS,
 ('sources-and-change-rules', 'Handoff note'): f'Edition{VERSION} is a separate candidate; published1.0 remains immutable. Chapters21/22 own the current full scope and26 records its implementation status. ' + LOCAL_REPAIR_STATUS + '\n\n' + MUSIC_REVIEW_STATUS,
 ('audio-composition-and-budget', 'Current direction and runtime checkpoint'): MUSIC_REVIEW_STATUS + '\n\nThe source-rate decoder uses one lazy48kHz offline context after opt-in and one realtime playback context. Native AAC fallback measured64,806,772bytes including an outstanding decode reservation, below64MiB. This is AudioBuffer cache/reservation proof rather than total process memory, physical-device compatibility or subjective listening. The coherent chamber cue uses local owned instruments and requires no provider action. Preserve complete phrasing when changing future cues.',
 ('v2-implementation-record', 'Version 2 implementation record'): f'Public documentation edition{VERSION}, source specification{SOURCE_SPEC_VERSION}. The inhabited second version is in active implementation. This chapter records the actual checkpoint; it does not convert planned features or isolated tests into public-release acceptance. Earlier planning holds in21–25 are historical and superseded by this implementation record.',
 ('v2-implementation-record', 'Kickoff and ownership'): 'The active candidate entry is `src/worldsite/v2/main.tsx`; the first-pass entry remains as history. Existing public hosting and its retained rollback remain authoritative until a verified promotion. Published documentation1.0 is immutable; later reader/ZIP changes use this separate edition. Source, runtime assets, account services, preview plates and documentation must refer to the same reviewed revision. Detailed workstation, account-provider and operator records stay private.',
})

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def stable_id(text: str) -> str:
    text = re.sub(r'[`*_]', '', text)
    text = unicodedata.normalize('NFKD', text).lower()
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return re.sub(r'\s+', '-', re.sub(r'[^\w\s-]', '', text)).strip('-')

def role_for(path: str) -> str:
    lower = path.lower().replace('\\', '/')
    if 'clipboard-' in lower: return 'private composition reference (not bundled)'
    if 'media/images' in lower: return 'private illustration export library'
    if 'brand-assets' in lower: return 'private Daniel font and wordmark sources'
    if 'art-production' in lower: return 'private asset-authoring root'
    if 'proof' in lower: return 'private production review records'
    if '/models/' in lower or '/runtimes/' in lower: return 'private audio-authoring runtime'
    if 'archive' in lower: return 'private verified archive'
    return 'private website source workspace'

def sanitize(text: str, slug: str) -> tuple[str, list[dict]]:
    chunks = re.split(r'(?m)(?=^#{1,6} )', text)
    transformed = []
    review = []
    for chunk in chunks:
        if not chunk.strip(): continue
        match = re.match(r'^(#{1,6}) (.+)\n', chunk)
        heading = match.group(2) if match else '(preamble)'
        source_chunk = chunk
        # Revision suffixes annotate historical checkpoints; they must not bypass
        # the same portability rule when the source heading is renamed.
        rewrite_key = (slug, heading)
        if rewrite_key not in REWRITES:
            rewrite_key = (slug, heading.split(' · ', 1)[0])
        historical_audio_aliases = {
            'Historical ElevenLabs estimate': 'ElevenLabs budget: credits are not automatically API dollars',
            'Historical Higgsfield alternative': 'Higgsfield alternative: live read-only quotes',
        }
        if slug == 'audio-composition-and-budget' and rewrite_key[1] in historical_audio_aliases:
            rewrite_key = (slug, historical_audio_aliases[rewrite_key[1]])
        if rewrite_key in REWRITES:
            chunk = f'{match.group(1)} {heading}\n\n{REWRITES[rewrite_key]}\n\n'
        if heading == 'Source 2.0 next-pass precedence':
            chunk = chunk.replace('## Source 2.0 next-pass precedence', '## Current v2 precedence')
            chunk = chunk.replace('**Planning only, awaiting a new go (2026-09-08).**', '**Source 2.1 adopted; implementation is active.**')
            chunk = chunk.replace('The new planning hold, scope additions', 'The adopted scope additions')
            chunk = chunk.replace('The source2.0 plan awaits a new go.', 'The source 2.1 plan is being implemented.')
            chunk = chunk.replace('Earlier go/status/proof statements describe the first pass and do not authorize implementing this new pass.', 'Earlier first-pass proofs remain historical. Chapter26 records the current implementation checkpoint and remaining verification.')
        if slug == 'v2-implementation-record':
            chunk = re.sub(r'(?m)^- The foundation thread.*\n?', '- Shared account policy and email configuration remain behind the identity service. Confirmation/recovery readiness stays disabled until actual delivery and completion proof; no separate website identity database or changed desktop capability is implied.\n', chunk)
            chunk = re.sub(r'(?m)^- Old staging candidates.*\n?', '- The existing public rollback remains unchanged, with verified private source backups.\n', chunk)
            chunk = re.sub(r'(?m)^Private detailed evidence and next actions:.*\n?', 'Private evidence remains outside this edition. Published1.0 reader and archive bytes stay unchanged.\n', chunk)
        if slug == 'world-cohesion-revision' and heading == 'Working spatial and musical direction':
            chunk = chunk.replace('The first rebuild uses five chambers', 'The locally integrated rebuild uses five chambers')
            chunk += '\nThe room layout and mechanisms are integrated locally with scoped traversal and interface proof. The calm shared-bed paragraph records an earlier comparison direction, since rejected; the later original melody and Suno arrangement refinement own current music work. Integration is not whole-experience or listening approval.\n'
        if slug == 'index' and heading == 'Read order and ownership' and '20-world-repair-after-playtest.md' not in chunk:
            chunk = chunk.rstrip() + '\n| [20-world-repair-after-playtest.md](20-world-repair-after-playtest.md) | Latest playtest-driven world, traversal, mechanism and calm-audio repair; deferred boss work and comparison boundaries |\n\n'
        # Private asset references become portable role descriptions, never links.
        chunk = re.sub(r'!?\[([^\]]*)\]\(<?([A-Za-z]:[/\\][^\n)]*)>?\)', lambda m: f'{m.group(1)} ({role_for(m.group(2))})', chunk)
        chunk = re.sub(r'`([A-Za-z]:[/\\][^`\n]*)`', lambda m: f'`{role_for(m.group(1))}`', chunk)
        # Relevant links into this edition use portable filenames; other private
        # owner links become text. Public official URLs remain unchanged.
        def link(m):
            label, target = m.group(1), m.group(2).strip('<>')
            if re.match(r'https?://', target): return m.group(0)
            file, sep, anchor = target.partition('#')
            basename = file.replace('\\', '/').rsplit('/', 1)[-1]
            if basename in MAPPING:
                return f'[{label}]({MAPPING[basename]}.md' + (f'#{anchor}' if sep else '') + ')'
            if target.startswith('#'): return m.group(0)
            return label + ' (private source reference)'
        chunk = re.sub(r'\[([^\]]+)\]\(([^)\n]+)\)', link, chunk)
        # Strip isolated private facts while retaining the surrounding public rule.
        chunk = re.sub(r'(?m)^The canonical prompt contains .*\n?', '', chunk)
        chunk = re.sub(r'(?m)^The exact shared prompt and raw results belong.*\n?', 'Raw comparison assets remain private and are not shipped game assets.\n', chunk)
        chunk = re.sub(r'(?m)^Through v0\.2 .*\n?', 'Earlier production experiments are retained only as general lessons in the comparison chapter. They are not runtime or publication proof.\n', chunk)
        chunk = re.sub(r'(?m)^The repo map.*\n?', '', chunk)
        chunk = re.sub(r'(?m)^Godot is also installed.*\n?', 'Alternative authoring tools are not assumed dependencies; preserve one runtime unless a concrete failure justifies a documented replacement.\n', chunk)
        chunk = re.sub(r'(?m)^- Do not prune live Codex sessions.*\n?', '- Preserve active session and evidence stores; they are not a cleanup shortcut.\n', chunk)
        chunk = re.sub(r'(?m)^.*(?:OAuth completed|One owned workspace|Observed Higgsfield balance|Live quoted credits).*(?:\n|$)', '', chunk)
        chunk = re.sub(r'(?m)^Human checks were reported queued.*\n?', BANK_REVIEW_STATUS + ' Subjective listening and whole-experience review remain open.\n', chunk)
        chunk = re.sub(r'(?m)^.*Human checks were reported queued.*\n?', 'Release preparation is separate from promotion. Earlier artifact hashes and review gates apply only to their exact bytes. ' + BANK_REVIEW_STATUS + ' Listening and whole-route quality still require review.\n', chunk)
        # Do not expose orchestration files/names or secret reference identifiers.
        chunk = re.sub(r'\b(?:AGENTS\.md|CLAUDE\.md)\b', 'private implementation guidance', chunk)
        chunk = re.sub(r'\b(?:Profile/Identity/ProjectLedger|Identity/Profile/ProjectLedger|ProjectLedger|Profile/Identity|Identity/Profile)\b', 'private ownership records', chunk)
        chunk = re.sub(r'\b(?:Codex|Claude Code)\b', 'authoring assistant', chunk)
        chunk = re.sub(r'\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b', '[private identifier omitted]', chunk, flags=re.I)
        chunk = re.sub(r'(?i)(?:reported\s*|reported\*\*)?10[,.]?000\s*(?:ElevenLabs\s+)?credits', 'reserved provider allowance', chunk)
        chunk = chunk.replace('reported10,000', 'reserved').replace('reported10k', 'reserved').replace('reported 10k', 'reserved')
        chunk = chunk.replace('a reported10,000 ElevenLabs credits and available Higgsfield credits', 'a bounded offline-authoring allowance')
        chunk = chunk.replace('D-backed', 'active-work').replace('A-backed', 'archive-backed')
        chunk = chunk.replace('site AGENTS/CLAUDE instructions', 'private implementation guidance')
        chunk = chunk.replace('“10k credits,”', 'an allowance size,')
        chunk = chunk.replace('private ownership records/private ownership records', 'private ownership records')
        chunk = chunk.replace('`Temp/User`', 'private user input files')
        # Historical planning status must not be mistaken for current availability.
        chunk = re.sub(r'(?m)^(?:Status:|Revision 0\.[0-9]+ ·|Historical experiment revision0\.3,).*(?:\n|$)', 'Design baseline. Requirements and proposals below describe intended behavior; release verification is recorded separately.\n', chunk)
        chunk = re.sub(r'(?m)^(?:Version: [0-9.]+|Source specification version: [0-9.]+).*\n', f'Public design edition {VERSION} · source specification {SOURCE_SPEC_VERSION} · {DATE} · unpublished candidate; runtime and promotion proof are separate.\n', chunk)
        chunk = chunk.replace('No implementation, deployment, generation, CLI installation, or account action is authorized by this document. Implementation waits for Dex\'s explicit go.', 'This design edition is not a runtime verification report.')
        if slug in {'inhabited-world-and-experience', 'dex-account-treasury-and-social-presence', 'code-donors-and-integration-sources', 'animation-and-art-donor-catalog', 'design-reference-and-production-rules'}:
            chunk = chunk.replace('**PLANNING — awaiting a new go.**', '**Adopted specification; current implementation evidence is in chapter26.**')
            chunk = chunk.replace('**Planning only; the next go has not been received.**', '**Research baseline adopted for implementation; actual proof is in chapter26.**')
            chunk = chunk.replace('**Research and documentation only; the next implementation GO has not been received.**', '**Research baseline adopted for implementation; current evidence is in chapter26.**')
            chunk = chunk.replace('**Planning only; awaiting the new go.**', '**Research baseline adopted for implementation; current evidence is in chapter26.**')
            chunk = chunk.replace('No more taste questionnaire is required before go.', 'No more taste questionnaire is required to continue implementation.')
            chunk = re.sub(r'(?m)^The current request authorizes documentation reconciliation only\..*\n?', 'This is the adopted scope for the inhabited revision. Chapter26 supersedes the earlier planning hold and records implementation state. Preserve the complete scope through the read/build/inspect/replace loop.\n', chunk)
            chunk = re.sub(r'(?m)^2026-09-08 · Next-pass specification only\..*\n?', '2026-09-08 · Adopted account/social specification. Chapter26 records current implementation and remaining live-service proof. The contracts below remain distinct from verification results.\n', chunk)
        # Compact excessive blank lines without altering code indentation.
        chunk = re.sub(r'\n{3,}', '\n\n', chunk).rstrip() + '\n\n'
        reason = 'Public design content retained'
        if rewrite_key in REWRITES:
            reason = 'Curated complete section rewrite preserves the public design/production rule while excluding private inventories, account ledgers or operator chronology'
        elif chunk.strip() != source_chunk.strip():
            reason = 'Public contract retained with portable links/owner roles and private metadata removed'
        review.append({'heading': heading, 'disposition': 'Included' if chunk.strip() == source_chunk.strip() else 'Rewritten', 'reason': reason, 'sourceSectionSha256': digest(source_chunk.encode()), 'outputSectionSha256': digest(chunk.encode())})
        transformed.append(chunk)
    body = ''.join(transformed).strip() + '\n'
    return body, review

def with_headings(body: str) -> tuple[str, list[dict]]:
    heads, seen = [], {}
    lines, in_code = [], False
    for line in body.splitlines():
        if line.startswith('```'): in_code = not in_code
        m = re.match(r'^(#{1,6}) (.+)$', line) if not in_code else None
        if m:
            name = m.group(2)
            base = stable_id(name)
            count = seen.get(base, 0)
            seen[base] = count + 1
            ident = base if not count else f'{base}-{count}'
            heads.append({'id': ident, 'text': name, 'level': len(m.group(1))})
            lines.append(f'<a id="{ident}"></a>')
        lines.append(line)
    return '\n'.join(lines) + '\n', heads

def category(slug):
    if slug in ['donation', 'sections-and-controls', 'shell-and-system-controls', 'mobile-accessibility']: return 'Interactions'
    if slug in ['art-direction-and-audio', 'world-and-gameplay', 'arrival-and-first-impression', 'physical-interface-and-review-loop', 'world-cohesion-revision']: return 'World'
    if slug in ['audio-composition-and-budget', 'local-audio-model-research']: return 'Audio'
    if slug in ['world-production-workflow', 'world-asset-inventory', 'framing-and-sprite-comparison', 'content-runtime-and-hosting', 'build-readiness-and-scope', 'after-go-workflow']: return 'Production'
    return 'Specification'

def encode(data): return (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def prepare_gallery_exports(source: Path):
    """Technical display resize only: no crop, recolor, alpha removal or art edits."""
    target = SITE / 'public/content/illustrations'
    target.mkdir(parents=True, exist_ok=True)
    prepared = []
    for ident, filename, _ in ART:
        original = source / filename
        before = digest(original.read_bytes())
        with Image.open(original) as im:
            if im.mode not in ('RGB', 'RGBA'):
                raise RuntimeError(f'Unreviewed color conversion would be required: {filename}')
            if im.getexif().get(274, 1) != 1:
                raise RuntimeError(f'Orientation needs a separate display review: {filename}')
            original_width, original_height = im.size
            icc = im.info.get('icc_profile', b'')
            exports = {}
            for role, longest in [('display', 2048), ('thumbnail', 512)]:
                factor = min(1, longest / max(im.size))
                dimensions = (max(1, round(im.width * factor)), max(1, round(im.height * factor)))
                resized = im.resize(dimensions, Image.Resampling.LANCZOS) if dimensions != im.size else im.copy()
                path = target / f'{ident}-{role}.webp'
                resized.save(path, format='WEBP', lossless=True, method=6, exact=True, icc_profile=icc)
                with Image.open(path) as check:
                    if check.size != dimensions or check.mode not in ('RGB', 'RGBA'):
                        raise RuntimeError('Display dimension or alpha-mode mismatch')
                    # WebP can omit an all-opaque alpha channel without changing
                    # displayed pixels. Compare in the original mode to prove it.
                    if check.convert(resized.mode).tobytes() != resized.tobytes():
                        raise RuntimeError('Lossless WebP changed the resized pixels')
                    if check.info.get('icc_profile', b'') != icc:
                        raise RuntimeError('ICC profile was not preserved')
                exports[role] = {'src': '/content/illustrations/' + path.name, 'width': dimensions[0], 'height': dimensions[1], 'sha256': digest(path.read_bytes()), 'bytes': path.stat().st_size}
        if digest(original.read_bytes()) != before:
            raise RuntimeError('Artwork original changed during display export')
        prepared.append({'id': ident, 'publicationStatus': 'review-pending', 'sourceSha256': before, 'sourceWidth': original_width, 'sourceHeight': original_height, **exports})
    adapter = {'version': VERSION, 'processing': 'aspect-preserving Lanczos downscale; lossless WebP; original RGB/RGBA and ICC retained; no crop or recolor', 'items': prepared}
    (target / 'display-exports.json').write_bytes(encode(adapter))

def create_gallery(source: Path, report: dict):
    target = SITE / 'public/content/illustrations'
    target.mkdir(parents=True, exist_ok=True)
    adapter_path = target / 'display-exports.json'
    if not adapter_path.exists():
        raise RuntimeError('Run --prepare-gallery once to create the approved bounded display exports')
    adapter = json.loads(adapter_path.read_text(encoding='utf-8'))
    prepared = {x['id']: x for x in adapter['items']}
    if set(prepared) != {a[0] for a in ART}:
        raise RuntimeError('Gallery derivative adapter does not match the nine approved artworks')
    result = []
    for order, (ident, filename, alt) in enumerate(ART):
        original = source / filename
        if not original.is_file(): raise RuntimeError(f'Missing approved artwork export: {filename}')
        content = original.read_bytes()
        with Image.open(original) as im: width, height = im.size
        entry = prepared[ident]
        if entry['sourceSha256'] != digest(content) or (entry['sourceWidth'], entry['sourceHeight']) != (width, height):
            raise RuntimeError('Gallery source changed; explicitly re-export and review its display copies')
        for role, longest in [('display', 2048), ('thumbnail', 512)]:
            item = entry[role]
            path = (SITE / 'public' / item['src'].lstrip('/')).resolve()
            if not path.is_relative_to(target.resolve()) or not path.is_file():
                raise RuntimeError('Derivative path is not a contained existing gallery export')
            if digest(path.read_bytes()) != item['sha256']:
                raise RuntimeError('Gallery derivative hash mismatch')
            with Image.open(path) as check:
                if check.size != (item['width'], item['height']) or max(check.size) > longest:
                    raise RuntimeError('Gallery derivative exceeds its documented dimensions')
            factor = min(1, longest / max(width, height))
            if (item['width'], item['height']) != (round(width * factor), round(height * factor)):
                raise RuntimeError('Gallery derivative does not preserve full source aspect')
        display, thumb = entry['display'], entry['thumbnail']
        publication = entry.get('publicationStatus', 'review-pending')
        if publication not in ('review-pending', 'public', 'unpublished'):
            raise RuntimeError('Unrecognized gallery publication status')
        result.append({'id': ident, 'title': original.stem, 'alt': alt, 'src': display['src'], 'thumbnailSrc': thumb['src'], 'width': display['width'], 'height': display['height'], 'thumbnailWidth': thumb['width'], 'thumbnailHeight': thumb['height'], 'sortOrder': order, 'sha256': display['sha256'], 'thumbnailSha256': thumb['sha256'], 'bytes': display['bytes'], 'thumbnailBytes': thumb['bytes'], 'publicationStatus': publication, 'loading': 'lazy', 'usage': 'illustration-display-only'})
        report['illustrations'].append({'id': ident, 'source': str(original), 'sourceSha256': digest(content), 'sourceBytes': len(content), 'sourceWidth': width, 'sourceHeight': height, 'originalUnchanged': True, 'display': display, 'thumbnail': thumb, 'aspectAndBudgets': 'pass', 'pixelAndProfileVerification': 'lossless encoding of the deterministic aspect-preserving resize; original RGB/RGBA and ICC retained'})
    # Documentation editions do not version or silently rewrite shared artwork.
    current = json.loads((target / 'manifest.json').read_text(encoding='utf-8'))
    if current['items'] != result:
        raise RuntimeError('Gallery manifest differs from reviewed display adapter; reconcile separately before a docs export')
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--art-source', type=Path, default=Path('D:/Dex/Media/Images/Inbox'))
    parser.add_argument('--proof-dir', type=Path, default=Path('D:/Dex/Automation/Proofs/dex-place/20260906-public-edition'))
    parser.add_argument('--prepare-gallery', action='store_true', help='Create/review deterministic display derivatives; normal exports reuse and verify the adapter')
    parser.add_argument('--check-only', action='store_true', help='Validate the complete edition and write private proof only; do not replace public files or generated content')
    args = parser.parse_args()
    out = SITE / f'public/content/documentation/v{VERSION}'
    if args.prepare_gallery:
        raise RuntimeError('Gallery generation is a separate asset task; documentation export only verifies existing display files')
    docs, exported, review = [], {}, {'version': VERSION, 'sourceSpecificationVersion': SOURCE_SPEC_VERSION, 'publicationStatus': 'unpublished-candidate', 'repairStatus': 'active; previous candidate rejected; comparisons unapproved', 'sourceRoot': str(SOURCE), 'sources': [], 'illustrations': [], 'checks': {}}
    id_regex = re.compile(r'\b(?:R|SYS|DL|DOC|ART|DON|QA|WORLD|MOB|CUT|WP|MUS|AMB|SFX|O|N|NX|V2|N22|ACC|TRE|SOC|VOI|ADM|MOD|C23|AD|DR|REF|P)-\d+\b')
    source_ids, output_ids = set(), set()
    registry_coverage = []
    source_snapshot = {filename: (SOURCE / filename).read_bytes() for filename, _ in ALLOWLIST}
    physical_map_path = (SITE / EXPORT_CONFIG['physicalFilesSource']).resolve()
    if not physical_map_path.is_relative_to((SITE/'public/world/maps').resolve()):
        raise RuntimeError('Physical-file source is outside the reviewed map root')
    physical_map_bytes = physical_map_path.read_bytes()
    if specification_version(source_snapshot['README.md'].decode('utf-8-sig')) != SOURCE_SPEC_VERSION:
        raise RuntimeError('Source version changed while initializing export; rerun against a stable source snapshot')
    for filename, slug in ALLOWLIST:
        raw = source_snapshot[filename]
        source = raw.decode('utf-8-sig').replace('\r\n', '\n')
        source_ids.update(id_regex.findall(source))
        body, sections = sanitize(source, slug)
        body, heads = with_headings(body)
        data = body.encode('utf-8')
        output_ids.update(id_regex.findall(body))
        # Check registry first-column IDs per chapter, not only the global union.
        # This catches a lost control row even when another chapter mentions its ID.
        source_rows = [id_regex.findall(line.split('|')[1]) for line in source.splitlines() if line.startswith('|')]
        output_rows = [id_regex.findall(line.split('|')[1]) for line in body.splitlines() if line.startswith('|')]
        source_registry = [ident for row in source_rows for ident in row]
        output_registry = [ident for row in output_rows for ident in row]
        lost_rows = sorted({ident for ident in source_registry if output_registry.count(ident) < source_registry.count(ident)})
        if lost_rows: raise RuntimeError(f'Public registry rows lost in {filename}: {lost_rows}')
        registry_coverage.append({'source': filename, 'sourceRows': len(source_registry), 'outputRows': len(output_registry), 'missingIds': lost_rows})
        exported[f'{slug}.md'] = data
        docs.append({'id': f'dex-place:{slug}:{VERSION}', 'projectId': 'dex-place', 'slug': slug, 'title': heads[0]['text'], 'versionId': VERSION, 'category': category(slug), 'status': 'public', 'reviewedAt': DATE, 'bodyMarkdown': body, 'headings': heads, 'sha256': digest(data), 'url': f'/documentation/dex-place/{slug}?version={VERSION}'})
        review['sources'].append({'source': filename, 'sourceSha256': digest(raw), 'output': f'{slug}.md', 'outputSha256': digest(data), 'sections': sections})
    missing = source_ids - output_ids
    if missing: raise RuntimeError(f'Public requirement/control coverage lost: {sorted(missing)}')
    # Verify every portable target and heading before emitting any ZIP.
    heading_lookup = {d['slug'] + '.md': {h['id'] for h in d['headings']} for d in docs}
    link_count = 0
    for filename, data in exported.items():
        body = data.decode()
        forbidden = [r'\b[A-Za-z]:[/\\]', r'\bsk_[A-Za-z0-9]{16,}', r'\b[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\b', r'codex-clipboard-', r'\.codex', r'AGENTS\.md', r'CLAUDE\.md', r'440\.75|445\.5|451 credits|10\.25 credits|29\.05|8786\.59|8,786\.59']
        for pattern in forbidden:
            if re.search(pattern, body, re.I): raise RuntimeError(f'Private-data pattern in {filename}: {pattern}')
        for m in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', body):
            target = m.group(1)
            if target.startswith(('https://', 'http://')): continue
            file, _, anchor = target.partition('#')
            file = file or filename
            if file not in exported: raise RuntimeError(f'Broken portable link: {filename} -> {target}')
            if anchor and anchor not in heading_lookup[file]: raise RuntimeError(f'Broken portable anchor: {filename} -> {target}')
            link_count += 1
    physical = []
    objects = next(layer['objects'] for layer in json.loads(physical_map_bytes)['layers'] if layer['name']=='objects')
    for item in objects:
        props = {row['name']: row['value'] for row in item.get('properties', [])}
        if (item.get('class') or item.get('type')) != 'file' or props.get('section') != 'documentation': continue
        slug = props.get('itemId')
        target = next((doc for doc in docs if doc['slug']==slug), None)
        if not target: raise RuntimeError('Actual physical file targets an unavailable article: '+str(slug))
        heading = target['headings'][0]['id']
        physical.append({'id': item['name'], 'projectId': 'dex-place', 'slug': slug, 'headingId': heading, 'versionId': VERSION, 'title': target['title'], 'url': f'/documentation/dex-place/{slug}?version={VERSION}#{heading}'})
    manifest = {'version': VERSION, 'sourceSpecificationVersion': SOURCE_SPEC_VERSION, 'editionId': f'dex-place-docs-v{VERSION}', 'projectId': 'dex-place', 'date': DATE, 'status': 'public-design-edition', 'publicationStatus': 'unpublished-candidate', 'repairStatus': 'v2 implementation in progress; see implementation record for scoped evidence', 'documents': [{k: d[k] for k in ['slug', 'title', 'versionId', 'category', 'headings', 'sha256']} | {'filename': d['slug'] + '.md'} for d in docs], 'physicalFiles': physical}
    exported['manifest.json'] = encode(manifest)
    exported['README.md'] = (f'# dex.place documentation v{VERSION}\n\nSource specification {SOURCE_SPEC_VERSION}; unpublished design candidate. ' + LOCAL_REPAIR_STATUS + '\n\n' + MUSIC_REVIEW_STATUS + '\n\n' + BANK_REVIEW_STATUS + '\n\nStart with [the specification index](index.md), [the inhabited-world contract](inhabited-world-and-experience.md), [account and social contracts](dex-account-treasury-and-social-presence.md), and [the implementation record](v2-implementation-record.md). Reader/search and this ZIP use the same sanitized Markdown. This edition is not whole-experience acceptance or public-promotion proof.\n\nThe manifest lists document and stable heading identities and SHA-256 values. Published edition bytes are immutable; this candidate may be refreshed before first publication. Artwork originals, private source records, account ledgers and operating instructions are excluded.\n').encode('utf-8')
    filename = f'dex-place-documentation-v{VERSION}.zip'
    archive_dir = SITE / f'public/files/dex-place-documentation/v{VERSION}'
    archive = archive_dir / filename
    # Refuse to change frozen release bytes. Freeze marker is set after public promotion.
    frozen = archive.with_suffix('.published')
    import io
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for name, data in sorted(exported.items()):
            info = zipfile.ZipInfo(name, (2026, 9, 6, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, data)
    zip_data = buffer.getvalue()
    if frozen.exists() and archive.read_bytes() != zip_data: raise RuntimeError('Published edition immutable; bump version before export')
    # Validate the source snapshot before replacing either side of reader/ZIP parity.
    if any((SOURCE / name).read_bytes() != raw for name, raw in source_snapshot.items()):
        raise RuntimeError('Source changed during export; no documentation output replaced')
    if physical_map_path.read_bytes() != physical_map_bytes:
        raise RuntimeError('Physical-file map changed during export; no documentation output replaced')
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        if zf.testzip() is not None: raise RuntimeError('ZIP integrity failed')
        for name, data in exported.items():
            if zf.read(name) != data: raise RuntimeError('ZIP and online source differ')
    url = f'/files/dex-place-documentation/v{VERSION}/{filename}'
    download = {'productId': 'dex-place-documentation', 'releaseId': f'docs-v{VERSION}', 'artifactId': 'website-docs-zip', 'title': 'website documentation', 'summary': 'The design, interactions and production notes for dex.place.', 'version': VERSION, 'filename': filename, 'bytes': len(zip_data), 'sha256': digest(zip_data), 'url': url, 'publicUrl': 'https://dex.place' + url, 'format': 'ZIP', 'platforms': ['all'], 'arch': 'all', 'status': 'available', 'documentationUrl': f'/documentation/dex-place/index?version={VERSION}'}
    gallery = create_gallery(args.art_source, review)
    edition = {'version': VERSION, 'projectId': 'dex-place', 'date': DATE, 'manifestUrl': f'/content/documentation/v{VERSION}/manifest.json', 'documents': len(docs)}
    module = SITE / 'src/worldsite/content/index.ts'
    interfaces = module.read_text(encoding='utf-8').split('export const documentationEdition:', 1)[0].split('// Generated by scripts/export-world-docs.py;', 1)[0].rstrip() + '\n'
    interfaces = interfaces.replace("versionId = '1.0'", 'versionId = documentationEdition.version')
    historical_docs = []
    historical_releases = []
    preserved = []
    # Only a published marker admits an older immutable reader edition.
    for directory in sorted((SITE / 'public/files/dex-place-documentation').glob('v*')):
        prior_version = directory.name[1:]
        if prior_version == VERSION or prior_version not in EXPORT_CONFIG['retainPublishedVersions']: continue
        prior_archive = directory / f'dex-place-documentation-v{prior_version}.zip'
        if not prior_archive.with_suffix('.published').exists(): continue
        seal = json.loads(prior_archive.with_suffix('.published').read_text(encoding='utf-8-sig'))
        if seal.get('edition') != prior_version or seal.get('sha256') != digest(prior_archive.read_bytes()) or seal.get('bytes') != prior_archive.stat().st_size:
            raise RuntimeError('Published historical archive differs from its promotion seal')
        prior_root = SITE / f'public/content/documentation/v{prior_version}'
        prior_docs = json.loads((prior_root / 'documents.json').read_text(encoding='utf-8'))
        for doc in prior_docs:
            if doc['versionId'] != prior_version or digest(doc['bodyMarkdown'].encode('utf-8')) != doc['sha256']:
                raise RuntimeError('Frozen historical reader metadata mismatch')
            if (prior_root / (doc['slug']+'.md')).read_bytes() != doc['bodyMarkdown'].encode('utf-8'):
                raise RuntimeError('Frozen historical reader source mismatch')
        with zipfile.ZipFile(prior_archive) as prior_zip:
            if prior_zip.testzip() is not None: raise RuntimeError('Frozen historical archive is corrupt')
            for name in prior_zip.namelist():
                if Path(name).name != name or prior_zip.read(name) != (prior_root/name).read_bytes():
                    raise RuntimeError('Frozen historical reader/ZIP parity differs')
        historical_docs.extend(prior_docs)
        prior_release = json.loads((directory/'release.json').read_text(encoding='utf-8'))
        if prior_release['version'] != prior_version or prior_release['sha256'] != seal['sha256'] or prior_release['bytes'] != seal['bytes']:
            raise RuntimeError('Historical download record differs from published archive')
        historical_releases.append(prior_release)
        for path in sorted([*prior_root.glob('*'), *directory.glob('*')]):
            if path.is_file(): preserved.append({'path': str(path.relative_to(SITE)).replace('\\','/'), 'bytes': path.stat().st_size, 'sha256': digest(path.read_bytes())})
    content = interfaces + '\n// Generated by scripts/export-world-docs.py; exact reader/ZIP source edition.\n'
    for name, typ, value in [('documentationEdition', '{ version: string; projectId: string; date: string; manifestUrl: string; documents: number }', edition), ('documentation', 'PublicDocument[]', docs + historical_docs), ('physicalFiles', 'PhysicalFile[]', physical), ('download', 'DownloadRecord', download), ('documentationReleases', 'DownloadRecord[]', [download] + historical_releases), ('illustrations', 'Illustration[]', gallery)]:
        content += f'export const {name}: {typ} = ' + json.dumps(value, ensure_ascii=False, indent=2) + ';\n'
    # Path.write_text(newline=...) is unavailable in the installed Python 3.9
    # production helper; explicit open preserves the same deterministic bytes.
    if not args.check_only:
        if any((SOURCE / name).read_bytes() != raw for name, raw in source_snapshot.items()) or physical_map_path.read_bytes() != physical_map_bytes:
            raise RuntimeError('Source changed while validating retained content; no documentation output replaced')
        out.mkdir(parents=True, exist_ok=True)
        archive_dir.mkdir(parents=True, exist_ok=True)
        for name, data in exported.items(): (out / name).write_bytes(data)
        (out / 'documents.json').write_bytes(encode(docs))
        (out / 'physical-files.json').write_bytes(encode(physical))
        archive.write_bytes(zip_data)
        (archive_dir / 'release.json').write_bytes(encode(download))
        with module.open('w', encoding='utf-8', newline='\n') as output:
            output.write(content)
    for item in preserved:
        if digest((SITE/item['path']).read_bytes()) != item['sha256']:
            raise RuntimeError('Frozen public edition changed during export')
    review['checks'] = {'pass': True, 'allowlistedSources': len(ALLOWLIST), 'sourceIds': sorted(source_ids), 'outputIds': sorted(output_ids), 'missingIds': sorted(missing), 'registryRowCoverage': registry_coverage, 'sourceSnapshotStable': True, 'portableLinks': link_count, 'physicalDestinations': len(physical), 'zipEntries': len(exported), 'zipMatchesOnline': True, 'secretPatternScan': 'pass', 'currentHandoffSourceVersion': SOURCE_SPEC_VERSION}
    review['release'] = download
    review['exportConfigurationSha256'] = digest((SITE/'scripts/world-docs-export.json').read_bytes())
    review['physicalFilesSource'] = {'path': str(physical_map_path), 'sha256': digest(physical_map_bytes)}
    review['checkOnly'] = args.check_only
    review['preservedPublishedFiles'] = preserved
    review['historicalReaderDocuments'] = len(historical_docs)
    args.proof_dir.mkdir(parents=True, exist_ok=True)
    (args.proof_dir / 'private-export-review.json').write_bytes(encode(review))
    print(json.dumps({'documents': len(docs), 'sourceSections': sum(len(s['sections']) for s in review['sources']), 'portableLinks': link_count, 'zipBytes': len(zip_data), 'zipSha256': digest(zip_data), 'illustrationsVerified': len(review['illustrations']), 'historicalReaderDocuments': len(historical_docs), 'physicalDestinations': len(physical), 'checkOnly': args.check_only, 'proof': str(args.proof_dir / 'private-export-review.json')}, indent=2))

if __name__ == '__main__': main()
