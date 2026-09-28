# dex site

## World website — read first

The current design specification is [docs/world-website/README.md](docs/world-website/README.md)
(see the current version in that index). It defines the cinematic liminal pixel world, katana interactions,
boss-linked downloads, documentation files, illustration exhibit, donation flow,
all controls, mobile behavior, section audio/credit budgets, selected CC0 animation,
public documentation exports, copy/input rules, four-stage implementation workflow,
Samsung Internet/iPad mobile checks and acceptance rules. Dex's go is active;
source specification1.8 records the current implementation and latest playtest
changes. Local proof and the unfinished public delivery are distinguished in
[REVIEW-READY.md](REVIEW-READY.md). No second generic implementation/deployment
approval is required; actual final checks and rollback remain necessary.

The sections below describe the **legacy runtime and historical checks**. They
do not override the new specification. In particular, existing artwork is now
restricted to display within Illustrations, and the planned MB slider range is
100,000–10,000,000 VND. Legacy seasonal effects, art motion rigs, and scan-only
slider behavior are not automatic requirements for the replacement. Hosting
claims below require a fresh check before being treated as current.

Responsive dex website generated from the Figma Make export and cleaned up for
Dex's project hub.

## Live Deployment

- Site: https://dex.place
- Alternate hostname: https://www.dex.place
- Origin: this machine on `127.0.0.1:8088`
- Public edge: the restart-safe `dex-site` Cloudflare Tunnel

See `HOSTING.md` for tunnel ownership, scheduled tasks, public verification, and
installer delivery details.

## Support Endpoint

Live supporter rail: Ko-fi - https://ko-fi.com/dexdonation

Ko-fi is the current public support/payment endpoint for dex, REDLINE BREACH,
local AI tooling, and summer prototypes.

Local bank rail: VietQR for MB Bank account `0585739325`.

The bank QR uses MB Bank BIN `970422` through VietQR quick links. By default it
renders a scan-only account QR. Moving the nonlinear amount slider adds `amount`
and `addInfo=dex support` to the QR URL so supported banking apps can prefill
the transfer amount and memo. Slider marks run from scan-only through 500k at
the middle, then 1m, 2m, 5m, and 10m VND toward the high end.

## Visual And Interaction Direction

The permanent site shell is white with black type. Seasonal color is moving ink:
summer red, autumn gold-orange, winter blue, and spring rose. The original
pointer-reactive wind particle system stays part of the seasonal layer.

Interactive controls remain rectangular. Their character comes from magnetic
pointer movement, offset shadows, sliding color, split-label swaps, icon motion,
and click feedback rather than clipped corners. Reduced-motion preferences turn
those effects into immediate state changes.

Interaction studies were informed by the MIT-licensed
[Motion Primitives](https://github.com/ibelick/motion-primitives) and Codrops'
[Kinetic Type Page Transition](https://github.com/codrops/KineticTypePageTransition),
[Balloon Button](https://github.com/codrops/BalloonButton), and
[Elastic Grid Scroll](https://github.com/codrops/ElasticGridScroll) repositories.
The dex controls are implemented locally against the existing Motion dependency.

## CONVERGENCE Ambient Motion Rig

CONVERGENCE uses Live2D-style ambient motion without the Cubism runtime. The
source PSD already has useful hair, ribbon, and cape groups, but it is not an
authored Cubism model with deformers, physics parameters, or a `.moc3` file.
Cubism would add a separate Core/runtime and release-license route without
removing the actual rigging work.

The local exporter rebuilds the artwork as 21 Photoshop-order WebP plates. Seven
real PSD groups move: all five hair groups, Towaki's ribbon, and Ena's cape.
Slow mismatched CSS transform loops provide the resting breeze; Motion springs
add pointer wind. The flattened banner remains underneath until every plate is
loaded, and `prefers-reduced-motion` freezes the exact reconstructed artwork.
The portfolio viewer adds the site's existing seasonal flake canvas above it.

Re-export after changing `A:\VNMC BANNER 2026.psd`:

```powershell
pnpm motion:export
pnpm build
```

The export command keeps its Python dependencies and pip cache under
`D:\Dex\Temp`, then writes runtime assets under
`public\assets\portfolio\vnmc-banner-2026\motion` and refreshes the generated
manifest in `src\app\data`.

Technique references:

- [Live2D Cubism Web Samples](https://github.com/Live2D/CubismWebSamples)
- [Live2D physics and hair movement](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)
- [Parallax.js layered input model](https://github.com/wagerfield/parallax)
- [Motion spring values](https://motion.dev/docs/react-use-spring)

## Running The Code

Install dependencies:

```powershell
pnpm install
```

Start the development server:

```powershell
pnpm dev
```

Build the site:

```powershell
pnpm build
```

Serve the production build from the local tunnel origin:

```powershell
pnpm serve:production
```

The production origin binds to `127.0.0.1:8088` by default and supports range
requests for the client installer. See `HOSTING.md` for the Cloudflare Tunnel
owner state and the live `dex.place` verification.

The loader-neutral Hoshikawa Haven Minecraft resource pack is published at
`/downloads/Hoshikawa-Haven-Brand-v1.zip`, with SHA-1 and SHA-256 sidecars in
the same directory. The canonical source and build script remain under
`D:\Dex\Servers\Minecraft\SMP\resource-pack`.

Register the restart-safe local origin task and inspect hosting state:

```powershell
pnpm hosting:register
pnpm hosting:status
```
