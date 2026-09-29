# dex.place

Source for https://dex.place. The `main` branch is what's live.

- `CANON.md` — what the site is and contains.
- `AGENTS.md` — how to work in this repo.
- `src/`, `public/` — the site. The website layer is `src/site/` (design system:
  `docs/site/DESIGN-SYSTEM.md`); its docs, blog and gallery come from `content/`.
- `ops/` — the server and the deploy puller that serves `main` from Dex's PC.
- `legacy/` — code and docs from earlier versions, kept as reference. Not built or served.

```bash
npm install
npm run dev
```
