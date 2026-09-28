# dex.place canon

What dex.place is and what it contains. The content below is settled; we are redoing the
execution, not the ideas. Anything marked **open** is still being decided with Dex. When Dex
says something newer in a session, that wins, and this file gets updated in the same change.

Specs here are guardrails. Meeting every line can still produce a janky site (it happened
twice), so the assembled result, seen at real size, is the real test.

## What it is for

dex.place is Dex's home for his projects: downloads and installs, documentation, his
illustrations, and donations. Four destinations: **Downloads, Documentation, Illustrations,
Donate.** Priority for wayfinding is downloads, then donate, then illustrations, then
documentation.

It has to be useful to someone who never plays anything. A file must be reachable directly,
with no game, no boss and no sign-in in the way.

## Shape

- **The world on top.** A 2D side-view pixel world is the first impression and an optional,
  fun way into the content.
- **The website underneath.** Scrolling down makes the black cinematic bars recede and brings
  up a real website: proper navigation, readable pages, direct links, direct downloads. It gets
  its own layout; it is not the game's menus stretched onto a page. (Layout **open**.)

## Arrival (first impression)

- Honest loading. No fake wait on a fast connection.
- One Enter action gives control immediately and starts the chosen sound state. No extra click,
  no accidental attack.
- A small, readable character, centred, in a very wide, still space. Negative space, slow
  cloud layers, immense partly cropped architecture far away, ordinary normal-sized objects
  nearby so the distance reads as huge. A little megalophobia.
- Nothing competes in the first view: no NPC, category list, donation point, tutorial, quest
  text or sales copy. No timer; people can stand and look for as long as they like.
- One quiet environmental hint says "go right" (a muted red floor line). Going left leads to a
  short resting overlook.
- Scenery first, then curiosity, movement, discovery, and only then services and combat.

## Feel

Cinematic, quiet, exploratory, a bit emotional, fun to move through. Lonely enough that meeting
someone is a surprise, but inhabited, not abandoned horror. Familiar places arranged wrong,
things floating for no reason, anime-coded atmosphere and inhabitants. Stillness on arrival;
denser or more chaotic spaces are fine later, where they earn it. Some cozy rooms. Some doors
that take you somewhere much bigger.

References each have one job. Don't blend them into a collage or copy their characters.

| Reference | Its job |
|---|---|
| Backrooms | familiar spaces emptied of purpose, wrong proportions |
| Monogatari | odd framing, conspicuous empty space, bold colour choices |
| Hollow Knight | tactile movement and sword combat, connected places, shortcuts |
| Bruno Simon's portfolio | play as an enjoyable way into useful content |
| Journey | a tiny traveller against vast space, sparse encounters |
| Eastward | occasional warm, lived-in rooms |

## Brand and words

- The mark is lowercase **dex** in the **Daniel** font. Nothing under it.
- No taglines, subtitles, role labels, "solo dev", "made with love", mysterious one-liners, or
  copy that sells Dex to the visitor.
- Short text either helps someone use something or gives a real character a small voice.
- Pixel fonts are fine for headings; long text, docs, forms, bank details and accessibility
  text stay plainly readable.

## Interaction language

- **E / use**: inspect an artwork, document, door, desk, donation box, donor record, latch.
  Opens a panel with proper focus and back/close, then returns you to the world.
- **Click / J / slash**: the sword. Hits physical things and enemies with visible contact,
  wind-up and consequence.
- **Cutting is physical and permanent.** Cutting the map cord drops a banner that unrolls from
  a fixed rod; E then inspects the full map. It is a map, not fast travel, and the cut can't be
  undone in that save. Cutting a rope bridge separates the rope, the post stays, the deck
  lowers and becomes walkable.
- Fewer labels, more "try it and see". Remove "click to..." prompts wherever the object can
  just be interactive.
- **Movement**: left/right, buffered variable jump, double jump, dash, readable stairs,
  forgiving collision. Footsteps match the surface.
- **Combat**: readable wind-up, impact, recovery. Damage, knockback, death, respawn nearby.
  A few mobs in later areas to annoy people; the place stays sparse.
- **Every interactive thing is its own object with states** (fixed vs moving parts, idle,
  contact, settled), not part of a flat background.
- **Presentation**: restrained world UI, black cinematic bars, small nearby prompts. In-world
  panels look like part of the setting but are real accessible DOM (text, focus, buttons,
  sliders, forms, QR).

## Destinations

### Downloads

- On the website: immediate, direct.
- In the world: **every product-menu visit costs a fresh boss fight.** Kill the boss, death
  beat, cut to black, the product's menu opens, the visitor presses Download. Closing it or
  picking another product means another fight. Past wins never unlock the world route.
- Only list real products. Don't invent binaries to fill the list.

### Documentation

An archive behind an ordinary door. No puzzle and no prerequisite. Real documentation is
clearly separate from any lore.

### Illustrations

Dex's own art. **Display only**: never used as scenery, textures, sprites, backdrops, or as a
reference for making assets. Each piece can be inspected on its own; a separate catalogue
action shows them all. Getting to the exhibit can be a longer journey so it means more.
Descriptions and any Convergence story get written with Dex later.

Kaizen is the main character of Dex's separate Convergence story. He is not the site's
traveller and not part of the site's world unless Dex says so.

### Donate

- Ko-fi: redirects to https://ko-fi.com/dexdonation.
- MB Bank: shows a QR for the real account with an amount slider from 100,000 to 10,000,000
  VND. On-site wording can say something like "donate dex", but the transfer itself always
  shows the bank's real recipient name.
- Donation boxes scattered in safe spots, each with an easy view of top donors next to it.
  **No treasury room** (scrapped).
- Never fake donor names, ranks, totals or payment success. Empty data stays empty. Payment
  never gates the story or any file.

### dex account

Called **dex account**. One identity shared with dexCode and dexClient, extensible to future
products. Register, sign in, recover, sign out; saved exploration; private donation history
and optional donor credit. In the world, a counter/attendant near the start leads to the same
account state as the website. Never fake a session. Integration details **open**.

### Other visitors

- Other players appear as tinted ghost/soul silhouettes. Your own avatar looks normal.
- Each keeps their own progress, bosses and mechanisms. No shared combat.
- Visible only if they moved or spoke in roughly the last minute; then they fade. Holding V
  to talk counts as activity. Proximity voice, push-to-talk, with a mobile equivalent, real
  mute/block and permissions.
- Gestures and small services matter more than lore text.

## Sound

Slow, calm, emotional, memorable. A little silence first, a higher piano phrase, gentle strings
coming in. An orchestral variant in the arena. Intentional silence in some reading spots.
Ambience before music; music swells in, never starts abruptly (the last two versions both
started too abruptly). Rooms that belong together keep the music going rather than restarting.
Dex picked the grand, mystical **Suno "B"** arrangement as the theme. Save ElevenLabs credits
for other projects. Technical fade checks are not a listening approval; Dex's ears are.

## Devices

Real review targets: Samsung Internet on Android and iPad Safari. Check mobile on every
version. Emulation and real-device results are reported separately.

## Story

**Open, with a carried-forward candidate.** The last accepted story was *The Registry*: a
small working institution that receives rooms broken off from their buildings. A few ordinary
staff catalogue them and keep the paths working. A huge distant ring stays unexplained. The
traveller carries a sword and has no forced backstory. First small story: a Courtyard door
near the accountant opens onto empty sky; the long scenic route reaches the real courtyard;
you release its far-side latch; the door now brings you back beside the accountant, who
quietly takes a cup break in the new light. Bosses are constructed "wardens" formed by
dispatch seals, so you never keep killing a friendly character. Details in
`legacy/planning-20260913/`.

## Character

**Open.** Being designed with Dex now. A cloud session's code-drawn prototype
("character-01 / crimson halo") is on the branch `claude/magical-meitner-ea41go` as reference.

## How assets get made

- **No image generation.** No GPT image, no Higgsfield, no generated sprite sheets.
- Every asset is authored one at a time with Dex: pixel-drawn in code or by hand, built in
  Blender where 3D helps for big structures, or from Dex's own drawings.
- Each asset goes through a loop: a side-by-side sheet with Dex's references at the same
  pixel grid, Dex reacts, adjust, repeat until accepted. Judge motion at real size through a
  full cycle; single pretty frames prove nothing.
- Reference images from other artists or games stay out of this public repo. Review sheets
  that contain them live in the git-ignored `review/` folder.
- Compose a whole space first, then split it into foreground, midground, background, and
  separate moving/interactive pieces. The overall map sets connections and landmarks, never
  the scale of individual rooms.
- Unmistakably pixel art at real screen size. Chunkier pixels on small nearby things, finer
  texture on huge platforms so they don't look like toy blocks, finer still in the distance.
  Flat side view; no fake 3D or isometric edges on walkways the camera never rotates around.
- Keep an inventory. Every prop has a reason to be there and defined states.
- If something looks wrong in the assembled scene, change it. Don't protect a weak piece
  because work went into it.

## Old work

`legacy/` holds the code, docs and runtime assets from the September iterations (the first
world, the public "inhabited" v2, and the local 12-room Registry game) as a salvage bank.
Reuse, reshape or ignore anything in it. It is not built or served.
