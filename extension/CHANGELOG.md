# Changelog

All notable changes to the **Snapds** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.1.0...snapds-v1.2.0) (2026-07-23)


### Features

* export and import config ([d8e5798](https://github.com/JoseJesusOchoaTorres/snapds/commit/d8e57982b8e620aba7212dd2972b7eeec370886d))
* shortcuts for quick search and insert ([03e3443](https://github.com/JoseJesusOchoaTorres/snapds/commit/03e3443ee532d425b2a08cd061afb683fceebecf))


### Bug Fixes

* a11y, path, token, and animation fixes across settings and landing ([5452dd5](https://github.com/JoseJesusOchoaTorres/snapds/commit/5452dd539f7ae84a809fc6a635e50f65f16d8d06))
* improve webview accessibility ([eecbe9c](https://github.com/JoseJesusOchoaTorres/snapds/commit/eecbe9c96cc513e4c13e97e6b074623c33940423))
* pass empty array fallback to postVersionsAvailable instead of undefined ([ce85f43](https://github.com/JoseJesusOchoaTorres/snapds/commit/ce85f43d7eae5793a93ab95d3df376d29776ee6c))
* prevent path traversal via config extends and export path ([cb02cc0](https://github.com/JoseJesusOchoaTorres/snapds/commit/cb02cc0175db65496349cb034eae5fe3e88c71a5))
* **settings:** resolve stuck loading states and add per-package reload ([1fcf741](https://github.com/JoseJesusOchoaTorres/snapds/commit/1fcf741a12cbfc29d2b7cff09e37e07832b6ad56))

## [1.1.0](https://github.com/JoseJesusOchoaTorres/snapds/pull/6) (2026-07-21)

### Changed

* the extension version was bumped to 1.1.0 to override the previous version on the marketplace

## [0.3.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v0.2.0...snapds-v0.3.0) (2026-07-21)


### Features

* shortcuts for quick search and insert ([03e3443](https://github.com/JoseJesusOchoaTorres/snapds/commit/03e3443ee532d425b2a08cd061afb683fceebecf))


### Bug Fixes

* **settings:** resolve stuck loading states and add per-package reload ([1fcf741](https://github.com/JoseJesusOchoaTorres/snapds/commit/1fcf741a12cbfc29d2b7cff09e37e07832b6ad56))

## [0.2.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v0.1.0...snapds-v0.2.0) (2026-07-21)


### Features

* export and import config ([d8e5798](https://github.com/JoseJesusOchoaTorres/snapds/commit/d8e57982b8e620aba7212dd2972b7eeec370886d))

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
