# Changelog

All notable changes to the **Snapds** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Biome-based linting and formatting across the monorepo (`pnpm lint`, `pnpm format`, `pnpm check`).
- Keyboard accessibility and `prefers-reduced-motion` support in the webviews.
- Expand-all / collapse-all controls and search-driven auto-expansion in the Components gallery.

### Changed

- The extension is now fully self-contained: `typescript` and `react-docgen-typescript`
  are bundled into `dist/extension.js`, so the packaged `.vsix` no longer relies on
  runtime `node_modules`.
- Refined the gallery tree to mirror the VS Code File Explorer (dimmed rest state,
  full-contrast on hover/selection).

## [0.1.0] - 2026-07-14

### Added

- Initial release.
- **Components gallery** sidebar: browse registered Snapds packages and their components
  as an accessible tree, search, and drag components into the active React file.
- **Settings** webview: manage registered packages, select/exclude components, and
  configure AI skill generation with a three-tier override model (`auto < company < user`).
- **Component Properties** panel: inspect a component's props schema and generate example JSX.
- **Skill generation** for `augment` and `generic` formats, written to the workspace or a
  custom destination.
- Google sign-in via OAuth 2.0 with PKCE (loopback redirect); tokens stored in VS Code
  `SecretStorage`.
