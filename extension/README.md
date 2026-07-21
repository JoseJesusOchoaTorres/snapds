# Snapds (VS Code Extension)

Snapds is a powerful VS Code extension designed for React monorepos. It introspects your packages, extracts component metadata using `react-docgen-typescript`, and provides a seamless webview gallery for visually exploring and drag-and-dropping JSX components directly into your code.

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Managing packages & components](#managing-packages--components)
- [Generate skills](#generate-skills)
- [Configuration hierarchy](#configuration-hierarchy)
- [Extension commands](#extension-commands)
- [Development](#development)
- [Running tests](#running-tests)

## Requirements

- VS Code `1.85.0` or newer.
- A workspace containing a React project whose component packages expose TypeScript types (`.d.ts` or source `.tsx`). Snapds reads props via `react-docgen-typescript` plus the TypeScript compiler API.
- No runtime dependencies are added to your project — Snapds only reads metadata and writes the code/skills you ask it to.

## Getting started

1. Install **Snapds** from the VS Code Marketplace (or, from this repo, press `F5` to launch an Extension Development Host).
2. Open a React workspace and click the **Snapds** icon in the Activity Bar to reveal the **Components** view.
3. Open **Snapds Settings** (the gear in the Components view title bar, or run **`Snapds: Open Settings`**) and register a package by name (e.g. `@acme/ui`). Snapds introspects it and lists its components.
4. Back in the **Components** view, drag any component into an open React file — Snapds inserts the JSX and adds the import automatically.
5. Select a component to open the **Component Properties** panel and adjust prop values before dropping.

## Features

- 🧩 **Visual Component Gallery**: Browse all available components from your registered packages in a dedicated sidebar webview.
- 🚀 **Drag and Drop JSX**: Drag a component from the gallery and drop it into your React code. Snapds automatically generates the correct JSX and handles the necessary import statements.
- **Quick Component Search**: Press `⌃⌥⌘K` (macOS) or `Ctrl+Shift+Alt+K` (Windows/Linux) to open a spotlight-style picker. Type any component name, press `Enter`, and the JSX snippet and import are injected at the cursor — identical result to drag & drop, without touching the mouse.
- 📦 **Smart Import Management**: Automatically injects new imports without duplicating existing ones. It correctly handles multi-line Prettier-formatted imports and updates them seamlessly.
- ⚡ **Performance Optimized**: Uses advanced caching based on package version and config file mtime so re-opening the gallery is instant. Each package version is cached independently, so switching between versions in the props panel requires no re-parse after startup.
- 🗂️ **Monorepo multi-version support**: In a monorepo with apps using different versions of the same package, Snapds auto-detects the right version from the file currently open in your editor and shows the matching props. A version selector in the props panel lets you override this manually, and an "Add to this app" button injects the dependency into the nearest `package.json` when the package isn't listed there yet.
- 🤖 **Generate Skills**: Turn your component metadata into agent-consumable skill docs so coding agents can use your design system without re-reading source or `.d.ts` files (saving tokens).

## Managing Packages & Components

Open **Snapds Settings** (the gear on the Components view, or run **`Snapds: Open Settings`**) to register packages and choose which components are exposed.

### Multi-version monorepo support

When the same package is installed at different versions across apps in a monorepo, Snapds handles each app independently:

- **Auto-resolution.** When you switch the active editor, Snapds walks up from the focused file to find the nearest `node_modules/{pkg}` and uses that version's props in the panel. The version badge in the props header shows `auto` when the version was inferred this way.
- **Manual override.** A version dropdown in the props panel header lets you pin any detected version regardless of which file is active.
- **Fallback.** If no local installation is found along the file's path (e.g. a shared root-level file), Snapds falls back to the highest semver found in the workspace.
- **Add to this app.** When the selected version isn't listed in the focused app's `package.json`, an **Add to this app** button appears. Clicking it adds the dependency to the nearest `package.json` and shows a reminder to run `pnpm install`.



- **Packages** are listed as collapsible sections. Enable a package to introspect it on demand.
- **Components use an auto-include model.** Every component Snapds detects is included by default and shown as a chip. Un-toggle a chip to *exclude* a component; components added upstream are picked up automatically on the next refresh, so nothing is silently hidden.
- **Manual additions.** If a component isn't detected (for example a polymorphic component whose type signature `react-docgen-typescript` can't read), type its name into the manual field to add it explicitly. Manually added chips are marked with `*`.

Your selection is stored per-package in `snapds.packages` as `excluded` (chips you turned off) and `manual` (names you added) — the extension never persists a full allow-list, so new upstream components always surface.

> **Note on detection:** Snapds combines `react-docgen-typescript` with a TypeScript Compiler API pass that enumerates every exported value component. This catches polymorphic / `as`-style components (declared as generic call signatures) that docgen alone misses; such components appear as chips with no introspected props until you add overrides.

## Generate Skills

Snapds can export the public contract of your components (props, types, enum values, defaults, import line, and a canonical usage example) as skill documentation for coding agents.

### Output formats

Both formats use the same **dictionary + on-demand detail** topology so an agent's context window stays small regardless of which assistant consumes them:

- **Augment skills** — a directory per skill, each with a `SKILL.md` and YAML frontmatter. A tiny `snapds/SKILL.md` acts as the always-loaded **dictionary/router**; one `snapds-<component>/SKILL.md` per component holds the detail and is loaded on demand.
- **Generic `AGENTS.md`** — an assistant-agnostic **dictionary** file (`AGENTS.md`) that only lists components and links to per-component detail files under `snapds-skills/<component>.md`, which agents open on demand.

In both formats the index is intentionally tiny and never inlines component detail, so unused components never enter the context window.

### Destinations

You choose where the files are written:

- **Workspace (team-shared)** — committable, at the repo root (`.augment/skills` for Augment skills; root `AGENTS.md` + `snapds-skills/` for generic).
- **Custom folder** — any folder you pick, for skills you keep outside the repo (e.g. a personal `~/.augment/skills` shared across projects).

### Enabling & auto-generation

The **Agent Skills** section in Settings is hidden until you flip its **Enable** toggle. Once enabled you can pick the format(s) and destination and turn on **Auto-generate**, which regenerates skills *incrementally* (index + only the new detail files) whenever components are added. These choices persist in `snapds.skills`, so regeneration is one click.

### How to trigger

- Toggle **Auto-generate** on and let Snapds keep skills in sync as your selection changes, or
- Click **Regenerate skills** in the Settings action bar (or run **`Snapds: Regenerate All Skills`**) to rewrite every file from your saved settings, or
- Run **`Snapds: Generate Skills`** for a one-off run that prompts for a format and destination (workspace or a folder you pick).

Point your agent/assistant at the generated dictionary file (`snapds/SKILL.md` or `AGENTS.md`) so it loads component detail on demand.

> Generated files begin with an auto-generated header warning. Regenerate them after your components change rather than hand-editing.

### Complementing generated skills

You never edit the generated `.md`/`SKILL.md` files by hand — they are overwritten on every regeneration. Instead, your custom guidance lives in settings (`snapds.skills`) and is merged into the output each time, so it survives regeneration. Three layers are available, all in the Settings panel:

- **Project guidance** — a single block of conventions that apply to the whole design system. It is injected into the dictionary/router index (`snapds/SKILL.md` or `AGENTS.md`). Edit it under **General skill instructions → Project guidance**.
- **Reusable snippets** — named blocks of guidance you define once under **General skill instructions → Reusable snippets** (e.g. "Always wrap in `FormField`") and then assign to any number of components.
- **Per-component notes** — free-text notes and snippet assignments scoped to a single component. Expand a package under **Components to import**, and each *selected* component chip shows a ✎ button (it gains a • dot when notes exist). Clicking it opens an inline editor to attach snippets and write component-specific guidance.

At generation time Snapds resolves these into each component's detail file in order (assigned snippets first, then the per-component note), while the project guidance goes to the index.

## Configuration Hierarchy

Snapds uses a 3-level cascading configuration system to give you maximum flexibility:

1. **Auto (AST Introspection)**: By default, Snapds parses your TypeScript components to determine properties, types, and default values.
2. **Team / Workspace (`snapds.config.json`)**: A committable file for shared overrides, package registrations, excluded components, snippets, and AI skills config. Snapds finds the nearest file by walking up from your active editor to the workspace root.
3. **User (`.vscode/settings.json`)**: Individual user preferences and local overrides that never get committed.

**Precedence:** auto introspection < team config (`snapds.config.json`) < user settings.

### Workspace config file (`snapds.config.json`)

Create a `snapds.config.json` at the workspace root (or in a sub-directory for monorepo per-app config). The full schema:

```jsonc
// snapds.config.json
{
  "version": "1",
  "packages": [
    {
      "name": "@acme/ui",
      "importPath": "@acme/ui",
      "excluded": ["InternalOnly"],
      "manual": ["PolymorphicButton"],
      "overrides": {
        "Button": {
          "snippet": "<Button variant=\"primary\">$1</Button>",
          "props": {
            "variant": { "defaultValue": "primary" },
            "internalId": { "hidden": true }
          }
        }
      }
    }
  ],
  "skills": {
    "enabled": true,
    "formats": ["augment"],
    "destination": "workspace",
    "autoGenerate": false
  },
  "scopeFilters": ["button", "form"]
}
```

Editing the file automatically invalidates the introspection cache and refreshes the gallery.

> **Backward compat:** The older `ignore` field (as a direct property on the package object) is still accepted and maps to `excluded`.

### Monorepo per-app config (`extends`)

In a monorepo where different apps use different design systems, each app can have its own `snapds.config.json` that inherits from a root base:

```
/monorepo
├── snapds.config.json          ← shared skills config, global scope filters
└── apps/
    ├── mobile/
    │   └── snapds.config.json  ← { "extends": "../../snapds.config.json", "packages": [...] }
    └── web/
        └── snapds.config.json  ← { "extends": "../../snapds.config.json", "packages": [...] }
```

Snapds walks up from the active editor file to find the nearest config. Child values override parent values on deep merge; all other parent values are inherited.

### Export & import config from Settings

You can generate or load a `snapds.config.json` directly from the Settings panel:

- **Export config** — saves your current package selections, AI skills config, scope filters, and (optionally) your local component overrides to a `snapds.config.json`. Choose between **Replace** (full overwrite) and **Merge** (only write what changed) when a file already exists.
- **Load config** — imports a config file into your settings. A summary shows what will change before you commit. Works with any path — defaults to the workspace root config, or browse to pick a file.

When Snapds detects a config file at startup that differs from your current settings, it shows a one-time notification. Afterwards a banner in the Settings panel lets you load it at any time.

## Extension Commands

Snapds provides the following commands via the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`):

- **`Snapds: Quick Component Search`** (`snapds.quickSearch`): Opens a spotlight-style Quick Pick populated with every indexed component. Start typing to filter, press `Enter` to inject the selected component's JSX snippet and import at the cursor — same result as drag & drop. Default shortcut: `⌃⌥⌘K` on macOS, `Ctrl+Shift+Alt+K` on Windows/Linux. Reassign via **Preferences: Open Keyboard Shortcuts**.
- **`Snapds: Open Settings`**: Opens the package management and configuration panel.
- **`Snapds: Open Props Panel`**: Opens a dedicated panel for editing component properties.
- **`Snapds: Generate Skills`**: Generates agent-consumable skill docs from your components with an interactive format/destination prompt (see [Generate Skills](#generate-skills)).
- **`Snapds: Regenerate All Skills`**: Rewrites every skill doc from your current component selection using the saved *Agent Skills* settings.
- **`Snapds: Clear Introspection Cache`** (`snapds.clearCache`): Clears all cached component introspection results and re-parses configured packages. Use this if the gallery or props panel is showing stale/outdated props.
- **`Snapds: Reindex Packages`** (`snapds.reindex`): Re-triggers background parsing for all registered packages without clearing the cache first — already-cached packages are served instantly while only uncached ones are re-parsed. Useful after updating a package without reloading VS Code.

## Development

The extension package lives at `extension/` within the monorepo. The three webviews (gallery, props, settings) live under `extension/webviews/` as plain Vite apps — each has its own `vite.config.ts` and shares types via `extension/webviews/shared/`. Their compiled output is copied to `extension/media/` by `scripts/copy-webviews.mjs`.

To build and run the extension locally:

1. Install dependencies from the repo root:
   ```bash
   pnpm install
   ```
2. Build the extension and all webviews:
   ```bash
   pnpm run build
   ```
   Or build just the webviews:
   ```bash
   pnpm run build:webviews
   ```
3. Open the project in VS Code, press `F5` to open a new Extension Development Host window.
4. In the new window, open a React project, click on the **Snapds** icon in the Activity Bar, and start exploring your components!

For active development, run from the repo root:

```bash
pnpm run dev
```

This concurrently watches the extension host (esbuild) and all three webviews (Vite).

### Running tests

```bash
pnpm run test
```

- **Extension** logic (PKCE, path-traversal guard, component whitelist, export scanning, skill generation, JSX codegen, user overrides) is bundled with esbuild and runs on Node's built-in test runner.
- **Webviews** use Vitest + Testing Library (jsdom) to cover the shared prop controls and key UI components.

Linting and formatting are handled by [Biome](https://biomejs.dev/): `pnpm run lint` (check) and `pnpm run lint:fix` (apply safe fixes).
