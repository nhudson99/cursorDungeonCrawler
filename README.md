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

A pull request cannot change Pages **Source**. Required in the repo UI:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions** — not “Deploy from a branch”. If Source is `main` `/`, GitHub’s Jekyll `pages-build-deployment` publishes the Vite **source** `index.html` (`script src="/src/main.ts"`), the canvas stays black, and that deploy overwrites the `dist/` Actions artifact.
2. Re-run the **GitHub Pages** workflow after flipping the source (and after this repo’s workflow tries to cancel a competing Jekyll run so `dist/` can stay live).
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
