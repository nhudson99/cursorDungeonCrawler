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

**Web (GitHub Pages)** — pushes to `main` build `dist/` and deploy. In the repo: Settings → Pages → Source: GitHub Actions.

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
