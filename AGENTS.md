# Working in this repo

Read `CANON.md` first. It is what the site is and contains; don't redesign content that is
settled there. Items marked **open** get decided with Dex, not by an agent alone.

## main is the live site

- A puller on Dex's PC builds `main` and serves it at https://dex.place, usually within a
  minute of a push. Unfinished is fine; broken is not. A build that fails or doesn't pass the
  smoke test is not deployed, and the previous build stays live.
- Work on a branch. Merge or push to `main` only what Dex has accepted in the session.
- See what's live: https://dex.place/__deploy (commit SHA). Hosting details: `ops/README.md`.

## Rules

- This repo is **public**. No secrets, tokens, .env files, account data, donor records or
  personal data. Server-side credentials live in the host's credential store, never here.
- No image generation for assets. See "How assets get made" in `CANON.md`.
- Other people's reference images never get committed. Keep review sheets that include them
  in `review/` (git-ignored).
- Big binaries (installers, raw art production) don't go in git. Downloads are served from the
  host's `downloads` folder; see `ops/README.md`.
- `legacy/` is reference only. Nothing in it is built or served.
- Characters (player, NPCs, bosses) follow `docs/character/PIPELINE.md`. Any lane that changes
  the character, render or motion pipeline updates that file before it finishes: new numbers,
  settings, commands, gates and pitfalls, marked proven / in progress / proposed.
- Use npm (Node 24). `npm run dev`, `npm run build`.
