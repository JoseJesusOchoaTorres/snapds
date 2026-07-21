# Snapds — Contributor Guide

> **End-user docs** → [snapds.dev](https://snapds.dev) · **Marketplace** → VS Code Extension page

Snapds is a VS Code extension for React monorepos. It introspects component packages, extracts prop metadata via `react-docgen-typescript`, and provides a webview gallery for browsing and drag-and-dropping JSX components directly into your code.

---

## Repo structure

```
snapds/
├── extension/          # VS Code extension
│   ├── src/            #   Node.js extension host (esbuild → dist/)
│   ├── webviews/       #   Three Vite React apps (gallery, props, settings)
│   │   ├── gallery/
│   │   ├── props/
│   │   ├── settings/
│   │   └── shared/     #   Types shared across webviews
│   └── media/          #   Compiled webview output (gitignored, copied by build)
├── landing/            # Marketing & docs site (Next.js + Nextra)
├── scripts/            # Build utilities
│   └── copy-webviews.mjs  # Copies webview dist/ → extension/media/
├── .github/workflows/  # CI — release-please action
└── wrangler.toml       # Cloudflare Workers config (serves landing/out/)
```

---

## Prerequisites

- Node.js `22.x` (see `.node-version`)
- pnpm `9+`

```bash
pnpm install
```

---

## Scripts

### Root (run from repo root)

| Script | What it does |
|---|---|
| `pnpm run dev` | Watches extension host + all 3 webviews + copies to `media/` on change |
| `pnpm run dev:extension` | Watches only the extension host (esbuild) |
| `pnpm run dev:webviews` | Watches only the 3 webviews (Vite) |
| `pnpm run dev:landing` | Starts the landing page dev server |
| `pnpm run build` | Full production build (webviews → extension host → copy to media) |
| `pnpm run build:landing` | Builds only the landing page (`landing/out/`) |
| `pnpm run deploy:landing` | Deploys `landing/out/` to Cloudflare Pages (non-production branches) |
| `pnpm run test` | Runs all tests (extension + webviews) |
| `pnpm run lint` | Biome check (lint + format) |
| `pnpm run lint:fix` | Biome check with auto-fix |
| `pnpm run package` | Full build + generates `.vsix` in `extension/` |

### Extension (`extension/package.json`)

| Script | What it does |
|---|---|
| `dev` | esbuild watch — extension host only |
| `dev:webviews` | Vite watch — all 3 webviews in parallel |
| `build` | Production build (webviews first, then extension host) |
| `build:webviews` | Builds only the 3 webviews |
| `test` | Webview tests (Vitest) + extension tests (Node built-in runner) |
| `package` | `vsce package --no-dependencies` → generates `.vsix` |

---

## Local development

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start everything in watch mode:
   ```bash
   pnpm run dev
   ```

3. Press `F5` in VS Code to launch the Extension Development Host.

4. Open a React workspace in the new window and click the Snapds icon in the Activity Bar.

> The `dev` script runs 3 processes concurrently: `ext` (esbuild watch), `web` (Vite watch × 3), and `cp` (chokidar — copies webview `dist/` to `extension/media/` on each rebuild). Reload the webview in VS Code after each rebuild.

---

## Packaging the extension

Generate a `.vsix` for local install or distribution:

```bash
pnpm run package
```

Builds everything first, then runs `vsce package`. The file lands in `extension/snapds-<version>.vsix`.

To install locally:

```bash
code --install-extension extension/snapds-0.1.0.vsix
```

> Publishing to the VS Code Marketplace requires a publisher account on Azure DevOps. Run `pnpm --filter snapds run publish` when that's set up.

---

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook validates every message automatically.

| Prefix | When to use | Version bump |
|---|---|---|
| `feat:` | New user-facing feature | minor `0.1.0 → 0.2.0` |
| `fix:` | Bug fix | patch `0.1.0 → 0.1.1` |
| `feat!:` / `fix!:` | Breaking change | major `0.1.0 → 1.0.0` |
| `chore:` | Tooling, deps, config | none |
| `refactor:` | Internal restructure, no behavior change | none |
| `docs:` | Documentation only | none |
| `test:` | Tests only | none |

Scope is optional but useful: `feat(gallery): add filter by category`.

To skip hooks while fixing pre-existing errors:

```bash
git commit --no-verify -m "your message"
```

---

## Release flow

Releases are automated via [release-please](https://github.com/googleapis/release-please).

1. **Merge a feature branch into `main`** — normal PR flow.
2. **release-please opens a Release PR** automatically, titled `chore(release): X.Y.Z`. It contains the bumped version in `extension/package.json` and an updated `CHANGELOG.md`.
3. **Accumulate features** — the Release PR stays open and self-updates as more branches are merged into `main`. No need to rush.
4. **When ready to ship** — merge the Release PR. release-please creates the git tag and GitHub Release automatically.

The version bump follows the highest-impact commit since the last release:
- Any `feat:` → minor bump
- Only `fix:` → patch bump
- Any `!` breaking change → major bump

Only `extension/package.json` is versioned. The root and landing packages are unversioned.

---

## Landing page deployment

The landing page (`landing/`) is a Next.js static site deployed to Cloudflare Workers.

| Cloudflare command | Script |
|---|---|
| Build | `pnpm run build:landing` |
| Production deploy | `npx wrangler deploy` (uses `wrangler.toml`) |
| Branch/preview deploy | `pnpm run deploy:landing` → `npx wrangler deploy` |

---

## Running tests

```bash
pnpm run test
```

- **Extension host** — bundled with esbuild, runs on Node's built-in test runner (`node --test`).
- **Webviews** — Vitest + Testing Library (jsdom).

Run only one suite:

```bash
pnpm --filter snapds run test:webviews
```

---

## Linting & formatting

[Biome](https://biomejs.dev/) handles both lint and format in one pass.

```bash
pnpm run lint        # check
pnpm run lint:fix    # apply safe fixes
```

The `pre-commit` hook runs `pnpm run lint` automatically before each commit.
