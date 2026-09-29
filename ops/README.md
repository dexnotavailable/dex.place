# ops: how this repo runs dex.place

The `main` branch of this repo is what https://dex.place serves. A small puller on
Dex's PC checks GitHub every 30 seconds, builds whatever `main` points at, tests the
build, and swaps it in. It doesn't matter where you edit (this PC, the cloud, someone
else's machine): once a commit is on `main`, it goes live.

## Making a change live

1. Push or merge to `main`.
2. Within about 30 seconds the puller notices the new commit. It builds it in its
   own folder with `npm ci` (or `npm install` if there is no lockfile) and
   `npm run build`, then checks that `dist/index.html` exists.
3. It checks the build with the commit's own `ops/server.mjs`, run twice on spare ports:
   - serving `dist/` directly: `/` must return 200 and `/healthz` must say `ok`;
   - the way the real origin runs it, following a scratch copy of `state.json`. It
     starts on the live build, then the scratch state is switched to the new build.
     The server has to notice the switch, stay healthy, and serve the same `/` as
     in the first run.
4. If the commit changed anything in `ops/`, the new ops code is checked too (see
   "Changing the ops code itself").
5. If all of that passes, it switches the live site to the new build. The server picks
   up the switch on its next request, with no restart and no dropped requests.

Total time is usually under a minute. Most of it is `npm ci`. The `ops/` checks add
about 5 seconds, and only run when `ops/` changed.

**If the build or the check fails, nothing changes.** The previous build stays live.
The failure is recorded (see `/__deploy`), and that commit isn't retried. Push a
fix, or an empty commit (`git commit --allow-empty -m redeploy`), to try again.

What the repo has to provide:

- `package.json` with a `build` script that writes the site to `dist/` (including
  `dist/index.html`). `dist/404.html` is used for missing pages if it exists.
- Everything in `dist/` is public, except dotfiles, which are never served.
- Large downloads (installers etc.) do not go in git. See "Downloads" below.

The build runs code from this repo (npm scripts and dependencies) on Dex's PC.
Anyone who can push to `main` can run code there, so keep push access tight.

## What's live right now

- https://dex.place/__deploy (or http://127.0.0.1:8088/__deploy on the PC) shows
  the live commit, when it went live, the previous commit, and the last commit that
  failed to build (if any).
- `node D:\Dex\Servers\dex.place\repo\ops\deploy.mjs --status` prints the whole
  deploy state.

## Rolling back

**One build back** (for example, the new build is live but broken):

```powershell
node D:\Dex\Servers\dex.place\repo\ops\deploy.mjs --rollback
```

The previous build goes live straight away. The commit you rolled back from is put on
hold: the puller won't redeploy it, even though it's still on `main`. The next new
commit on `main` goes live as usual. Running `--rollback` again swaps back.

If `repo\ops\deploy.mjs` itself is broken, run the same command from the
last-known-good copy instead. It does exactly the same thing:

```powershell
node D:\Dex\Servers\dex.place\ops-good\deploy.mjs --rollback
```

**Back to the old v2 origin** (the `run-production.mjs` server from before this repo
took over): `install-hosting.ps1` printed the backup path when it ran. Use it here:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\Dex\Projects\dex.place\ops\rollback-to-v2.ps1 `
  -BackupXml D:\Dex\Automation\backups\dex-place\<timestamp>\dex-site-origin.task.xml
```

That puts the original tunnel script back from the same folder, stops the new origin,
puts the scheduled task back the way it was, starts it, and waits for the old origin's
`/healthz`. The tunnel script is only restored if it is still exactly what the cutover
wrote; if someone edited it since, it is left alone with a warning, and the original
is `start-cloudflare-tunnel.ps1` in that folder. Add `-WhatIf` to see the plan first.
`D:\Dex\Servers\dex.place` stays on disk untouched.

## Where things live

| Path | What it is |
|---|---|
| `D:\Dex\Servers\dex.place\repo\` | Clean clone of this repo. Reset every cycle to the live commit, so never edit it by hand. It only lags behind `main` while `main` is a failed or rolled-back commit. |
| `D:\Dex\Servers\dex.place\ops-good\` | Last-known-good copy of `ops/`: the code of the last puller that ran a full cycle from `repo\ops`. The supervisor falls back to it (see below). Written only by the puller. |
| `D:\Dex\Servers\dex.place\builds\<commit>\dist\` | One folder per built commit. The last 5 are kept, plus the live and previous ones no matter what. After a successful build, only `dist\` is kept. |
| `D:\Dex\Servers\dex.place\tmp\` | Scratch space for the checks. Emptied after each one. |
| `D:\Dex\Servers\dex.place\state.json` | Which build is live, the previous build, the last failure, and history. Only the puller writes it. |
| `D:\Dex\Servers\dex.place\downloads\` | Files served at `/downloads/<name>`. Not in git. |
| `D:\Dex\Servers\dex.place\cache\npm\` | npm cache for builds. |
| `D:\Dex\Servers\dex.place\logs\` | Logs (see below). |
| `D:\Dex\GameDev\Deploy\SP13\WebGL\` | The SP13 WebGL game, served at `/sp13/`. Published by the SP13 pipeline, not by this repo. Not in git. |

Task Scheduler task `\Dex\Dex Site Origin` runs
`repo\ops\start-origin.ps1 -KeepAlive` at logon. That supervisor runs the two node
processes and restarts them if they exit. `\Dex\Dex Site Cloudflare Tunnel` forwards
dex.place and www.dex.place to 127.0.0.1:8088. Its task is never changed; only its
script loses one block at cutover (see "The tunnel script and the logon race").

## Logs

All under `D:\Dex\Servers\dex.place\logs\`:

- `deploy.log`: what the puller did (deployed, failed, skipped, pruned).
- `builds\<time>-<commit>.log`: full npm and smoke-test output for each build attempt.
  The failure entry in `state.json` points at the right file. The last 40 are kept.
- `server.log`: one line per request (not `/healthz`), plus server events.
  It rotates at 10 MB.
- `supervisor.log`: process starts, exits, and restarts.
- `server.stdout.log`, `server.stderr.log`, `deploy.stdout.log`, `deploy.stderr.log`:
  raw process output. The previous run's copies are kept as `.prev`.

## Downloads

`/downloads/<name>` serves files from `D:\Dex\Servers\dex.place\downloads\` as
attachments. They are never cached (`private, no-store`), and resumable Range requests
work. To publish a download, copy the file into that folder. Nothing gets committed
or deployed. `install-hosting.ps1` hardlinks the existing installer and packs there
from the old site, so they take no extra disk space.

A file in that folder always wins. Any other `/downloads/...` path (the
`/downloads/` page itself, for example) falls through to the build like every
other URL, and an unknown name gets the build's 404 page. Never put an
`index.html` in the downloads folder: it would be served as an attachment in
place of the page.

## Changing the ops code itself

The code in `ops/` ships through `main` like everything else, and it runs the site,
so a commit that changes `ops/` has to pass extra checks before it goes live.
If any of them fails, it is treated like a failed build: nothing changes.

- The new commit's own `ops/server.mjs` does both smoke tests above, including the
  one that follows `state.json` the way the live server does. So a server change
  that only breaks in live mode still never goes live.
- `ops/deploy.mjs`, `ops/server.mjs` and `ops/start-origin.ps1` must exist, and every
  `ops/*.mjs` must pass `node --check`.
- Every `ops/*.ps1` must be ASCII-only and parse under Windows PowerShell 5.1, and
  every command it calls by name must exist: either a function defined in some
  `ops/*.ps1`, or a real cmdlet or program. That catches a renamed helper in
  `hosting-common.ps1` that `start-origin.ps1` still calls by its old name. These
  files are only read here, never run.
- A self-test of the new `ops/deploy.mjs`. It gets a tiny throwaway repo and deploy
  root under `tmp\`. It must deploy a commit there end to end (clone, build, its own
  smoke tests, switch), print it with `--status`, and put the previous one back with
  `--rollback`.

Once a commit that changed `ops/` is live, the puller exits with code 75. The
supervisor restarts it at once on the new code. If `ops/server.mjs` changed, the
server restarts too, which means about 2 seconds with no origin (Cloudflare shows an
error page for requests in that gap).

**Safety net.** Some failures only show up on the real deploy root, so the checks can
miss them. For those:

- After the puller running from `repo\ops` finishes a cycle, it copies the `ops/` it
  was started from into `ops-good\`. That copy is the last puller known to work here.
- If `repo\ops\deploy.mjs` exits with an error 3 times in a row, each time within
  5 minutes of starting, the supervisor runs `ops-good\deploy.mjs` instead. That copy
  keeps pulling `main`, so pushing a fix still deploys it. It exits with code 75 as
  soon as the live commit's `ops/` changes, and the supervisor goes back to
  `repo\ops\deploy.mjs`. See `supervisor.log` for the switch.
- `node D:\Dex\Servers\dex.place\ops-good\deploy.mjs --rollback` works even when
  `repo\ops\deploy.mjs` does not.

Changes to `ops/start-origin.ps1` take effect the next time the scheduled task starts
(at logon, or after `Stop-ScheduledTask` / `Start-ScheduledTask`). The new supervisor
takes over the running node processes. There is no fallback for the supervisor
itself. The checks above only prove that it parses and that the commands it calls
exist, so test a supervisor change with `node --test ops/test/ops.test.mjs` before
pushing it.

`server.mjs` command-line options are part of the contract with `deploy.mjs`
(`--root`, `--deploy-root`, `--port`, `--sha`, `--no-log`, `--downloads`, the
`{"event":"listening"}` line, and `/__deploy` reporting the live `sha`). `--sp13-root`
(or `DEX_SP13_ROOT`) moves the `/sp13/` folder; the default is the real one. The same goes
for `deploy.mjs`'s `--once`, `--status`, `--rollback`, `--deploy-root`, `--repo-url`,
`--branch` and `--smoke-ports`, which the live puller uses to self-test the next one.
Keep them working.

Exit codes of `deploy.mjs`: `0` ok or nothing to do, `1` failed, `2` bad arguments,
`73` another puller is already running, `75` ops changed (restart me).

## Server behaviour, briefly

- Serves 127.0.0.1:8088 only. Only GET and HEAD are allowed; anything else gets 405.
- `www.dex.place` redirects (301) to `https://dex.place` with the same path and query.
- `/healthz` returns `ok` (503 `no-build` if nothing is deployed yet). `/__deploy` is
  described above.
- A directory serves its `index.html`. Unknown paths get 404, using `dist/404.html`
  if the build has one.
- Caching: HTML gets `no-cache, no-transform` (`no-transform` stops Cloudflare
  injecting scripts). `/assets/*` gets cached for a year (`immutable`), because
  Vite puts a hash in those file names. Everything else gets `no-cache` with
  ETag/Last-Modified, so repeat visits get quick 304s.
- Blocked, as a 404: `..` in any form (encoded, backslashes), dotfiles, Windows
  aliases (`::$DATA`, trailing dots, device names like `con`), and links that
  point outside the served folder.
- `/sp13/` is Dex's SP13 WebGL game, served from `D:\Dex\GameDev\Deploy\SP13\WebGL`
  exactly like the v2 origin served it (see below).

### `/sp13/`

The same rules as the v2 origin's `serve-production.mjs`:

- `/sp13` redirects (308, `no-store`) to `/sp13/`, keeping the query. `/sp13/` is
  `index.html`.
- Only these are served; everything else under `/sp13/` is a 404 (directories too):
  `index.html`, `sp13-launcher.js`, `sp13.css`, `current.json`, and
  `releases/<id>/release.json` or `releases/<id>/player/...`, where `<id>` is lowercase
  letters, digits and dashes (it starts with a letter or digit, at most 160 characters).
  The same path blocking as the rest of the site applies on top.
- Unity's pre-compressed files (`player.wasm.br`, `player.data.gz`, ...) are sent as
  stored, with `Content-Encoding: br` or `gzip` and the type of the file underneath
  (`.wasm` is `application/wasm`, `.js` JavaScript, `.data` and `.unityweb`
  `application/octet-stream`). Range requests work on the stored bytes.
- Caching: `current.json` is `no-store` and never answers 304, so the launcher always
  sees which release is live. `releases/*` is cached for a year (`immutable`), because
  a release folder never changes once published. The other files are `no-cache`.
  Every `/sp13/` file response, 304s included, repeats `Cache-Control` as
  `Cloudflare-CDN-Cache-Control`.
- If the SP13 folder is missing, `/sp13/*` is a 404 and the rest of the site carries on.
  It is picked up as soon as it exists.

The v2 origin also ran the website API (`/api/*`: accounts, the Ko-fi webhook, voice).
That API is retired on purpose, so `/api/*` is a 404 now. Other v2 differences:
v2 fell back to `index.html` for unknown extensionless paths (this origin sends the
404 page), redirected `www` with 308 rather than 301, gzipped text itself (Cloudflare
does that at the edge now), and had cache rules for its own folders (`/files/`,
`/content/documentation/`, `/audio/world-v*`, `/world/assets/`).

## The tunnel script and the logon race

`\Dex\Dex Site Cloudflare Tunnel` runs
`D:\Dex\Projects\SUMMER PROJECT 3\dex-client\site\scripts\start-cloudflare-tunnel.ps1`.
In v2 that script began with an "origin fallback": if
`http://127.0.0.1:8088/healthz` did not answer, it started the v2 origin
(`start-production-origin.ps1`, which runs `run-production.mjs`). Both tasks start at
logon, so the tunnel could start the v2 origin while `start-origin.ps1` was still
starting, and one of the two origins lost the port.

- The cutover removes that block (see below). From then on, the origin belongs to
  `\Dex\Dex Site Origin` alone.
- `start-origin.ps1` also defends itself, in case the block ever comes back. If the port
  is held by the v2 origin (a `node` process running `run-production.mjs` or
  `serve-production*.mjs`), it stops that process, waits for the port to be free, and
  starts its own server. It does this at startup and every time it restarts the server.
  First it waits for the v2 origin to answer `/healthz` (at most 30 s, then
  `-V2OriginSettleSeconds`, default 5, more). The launcher that started it gives up,
  and takes the unpatched tunnel script down with it, if that origin disappears before
  it is healthy.
- It never touches a v2 origin whose parent is a v2 keeper
  (`start-production-origin.ps1`, which is what `rollback-to-v2.ps1` brings back).
  Stopping that one would only start a restart fight. It never touches any other
  program on the port either: it logs `server start failed: port 8088 is held by ...`
  and tries again with backoff (up to 60 s).

## First-time setup (cutover from v2)

```powershell
cd D:\Dex\Projects\dex.place
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops\install-hosting.ps1 -WhatIf   # plan only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops\install-hosting.ps1           # do it
```

`ops/` must already be on `main` on GitHub, because the script clones from there. It
backs up the task, builds the first deploy while the old origin is still serving, and
hardlinks the downloads. Next it patches the tunnel script: it copies
`start-cloudflare-tunnel.ps1` into the backup folder, next to the task XML (plus
`start-cloudflare-tunnel.backup.json` with its path and hashes), and replaces only the
origin-fallback block (`try { Invoke-WebRequest $OriginHealthUrl ... } catch
{ & $originLauncher | Out-Null }`) with a comment saying the origin is owned by the
"Dex Site Origin" task running `dex.place/ops/start-origin.ps1`. It then checks that
Windows PowerShell 5.1 still parses the file and that a line diff against the backup
shows that one change and nothing else. Otherwise it puts the original back and stops
there, before touching the old origin. `-WhatIf` prints this diff. The credential
code is not touched. The tunnel does not need a restart, because PowerShell read the
whole script when the task started, and the fallback only ran at that point.

Then it stops the old origin (only if it really is `run-production.mjs`), points the
task at `start-origin.ps1`, and waits for health. If health fails, it restores the old
task, the old origin and the original tunnel script automatically.

If the tunnel script has moved, pass `-TunnelScript <path>`. If the script no longer
has a block the patch recognizes, `-WhatIf` reports it as BLOCKED; fix it by hand, or
pass `-TunnelScript ''` to skip the step.

## Tests

Run from the repo root, with Node 22 or newer (checked on Node 24.18):

```powershell
node --test ops/test/ops.test.mjs
```

Give it the file, not the folder. Since Node 22, `node --test ops/test` treats the
folder as a module name and fails with "Cannot find module". A full run takes about
3 to 4 minutes. It needs `git` on PATH. The PowerShell tests only run on Windows.
`install-hosting.ps1 -WhatIf` is skipped if the `\Dex\Dex Site Origin` task does not
exist.

The tests use a throwaway deploy root under `D:\Dex\Temp\dex-place-ops-test\`, a local
git repo instead of GitHub, and ports 18000-18999. They never touch port 8088, the real
deploy root, or the scheduled tasks. The `install-hosting.ps1 -WhatIf` check only
reads the task. The tunnel-script tests read the real `start-cloudflare-tunnel.ps1`,
but they only patch copies. The v2 origin in the boot-race tests is a stand-in `node`
script named `run-production.mjs`, running on a test port.
