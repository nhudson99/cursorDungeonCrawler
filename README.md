# Crypt of Ashen Keys

A 2D dungeon crawler. Slash through five floors. Descend. Survive.

## Setup

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Browser game with hot reload |
| `npm run electron:dev` | Desktop window against the Vite server |
| `npm test` | Unit tests once |
| `npm run test:watch` | Unit tests on change |
| `npm run typecheck` | TypeScript |
| `npm run ci` | Types + tests + web build |
| `npm run dist:win` | Windows installer, portable exe, Steam folder |

## Layout

```
src/core/       game rules (unit tested, no DOM)
src/game.ts     loop, input, floor flow
src/renderer.ts canvas draw
src/input.ts    browser + MemoryInput for tests
electron/       desktop shell
.github/        CI, GitHub Pages, tagged Windows releases
```

## Deploy

**Web (GitHub Pages)** — pushes to `main` (or a manual **Actions → GitHub Pages → Run workflow**) build `dist/` with base `/cursorDungeonCrawler/` and deploy to https://nhudson99.github.io/cursorDungeonCrawler/.

A pull request cannot turn Pages on. One-time in the repo UI:

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions. Until this is set, `deploy-pages` 404s and the live URL stays 404 even when CI is green.
2. Re-run the **GitHub Pages** workflow after flipping the source.
3. **Environment approval** is not required unless Settings → Environments → `github-pages` has required reviewers. If a run sits on *Waiting for review*, approve it or remove the reviewers — a PR cannot do that either.

**Desktop** — tag a version to build installers:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Artifacts land on the GitHub Release. Steam uploads `release/win-unpacked`.

**Local Windows build**

```bash
npm run dist:win
```
