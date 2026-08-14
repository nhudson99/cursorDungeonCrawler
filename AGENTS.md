# Crypt of Ashen Keys

A 2D dungeon crawler (browser + Electron desktop) built with Vite + TypeScript. Deterministic game rules live in `src/core`, orchestration in `src/game.ts`, presentation in `src/renderer.ts` and `electron/`.

Standard commands (install, dev, test, typecheck, build, packaging) are documented in `README.md` and `package.json` scripts. See also `.cursor/rules/architecture.mdc` for the core/presentation split.

## Cursor Cloud specific instructions

- Node 20+ is required (`package.json` `engines`); the VM ships a compatible Node. Dependencies are plain npm with a lockfile — the startup update script runs `npm install`.
- Run the dev server with `npm run dev:server` (plain `vite`). Do NOT use `npm run dev` in a headless/cloud VM — it passes `--open`, which tries to launch a system browser. The server listens on `http://localhost:5173/`.
- This is a pure client-side game: no backend, database, secrets, or network services. Verify it by loading `http://localhost:5173/` in the browser and playing (title screen → Enter/Space/Click to start → WASD to move → mouse or Space to attack).
- The camera follows the player, so the player sprite stays centered while the dungeon scrolls around it. A player that looks "stationary in the center" is expected — check whether the surrounding dungeon shifts to confirm movement input is registering.
- The dark screen with a soft circular light around the player is intentional atmosphere (fog-of-war + torch radial light + vignette in `src/renderer.ts`), not a rendering bug.
- Before finishing rule/logic changes, run `npm run typecheck` and `npm test` (Vitest). Electron desktop is presentation-only and shares the `vite build` output; there is no separate desktop test suite.
