# Changelog

All notable changes to the **Snapds** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.1](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.7.0...snapds-v1.7.1) (2026-08-13)


### Bug Fixes

* **deps:** resolve transitive security advisories via pnpm overrides + vsce bump ([9cff0ba](https://github.com/JoseJesusOchoaTorres/snapds/commit/9cff0ba41362c277bb0a127d9364ef2d9cf415a8))

## [1.7.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.6.0...snapds-v1.7.0) (2026-08-05)


### Features

* **props:** preview local icon SVGs in the props panel ([df7b179](https://github.com/JoseJesusOchoaTorres/snapds/commit/df7b179d8a57b54e319cc481101cf36d4b46cb60))


### Bug Fixes

* address PR review feedback and resolve CodeQL XSS finding ([da909a5](https://github.com/JoseJesusOchoaTorres/snapds/commit/da909a56d40fd2cd8767f9ab5ad809552dc77099))
* **gallery:** keep the indexing bar in sync with the notification toast ([7fdd73f](https://github.com/JoseJesusOchoaTorres/snapds/commit/7fdd73f0d76c3aa2de3eaa1e54f0bea6dfa48576))
* **icon:** thicken activity-bar icon stroke to match VS Code weight ([e7b1b34](https://github.com/JoseJesusOchoaTorres/snapds/commit/e7b1b347e87eaae67280f3bb48215199af0d8dbd))
* **props:** reject syntactically broken sources in the SVG preview extractor ([800c660](https://github.com/JoseJesusOchoaTorres/snapds/commit/800c66084499bec8aae20a5cbc8c0b68a2ca49ec))
* **settings:** show active package component counts on open ([648b1aa](https://github.com/JoseJesusOchoaTorres/snapds/commit/648b1aaa229ad59257172087907021988d0921a7))


### Performance Improvements

* **introspection:** reuse one TypeScript program per package ([39bf628](https://github.com/JoseJesusOchoaTorres/snapds/commit/39bf6289d8724d3ceea821fe16d7b0c61b7ad4e4))

## [1.6.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.5.0...snapds-v1.6.0) (2026-07-30)


### Features

* **introspect:** detect local component sources from components.json ([b5ae1ae](https://github.com/JoseJesusOchoaTorres/snapds/commit/b5ae1ae67dd238fa6d2ceb052858831cb4b39042))
* **introspect:** introspect local component sources (foundation) ([89700ee](https://github.com/JoseJesusOchoaTorres/snapds/commit/89700ee9bf61b26b1866ab58acf1f0ae17382bfc))
* **local-sources:** manual folder add + live file watcher ([ca0f7cc](https://github.com/JoseJesusOchoaTorres/snapds/commit/ca0f7cc44f8c188b5a513c50e6259db7ac373af4))
* **local-sources:** opt-in detection banner + local-aware skill wording ([865347c](https://github.com/JoseJesusOchoaTorres/snapds/commit/865347c2a12e1e0e947d1bd5c68b392e7d9f8f4e))
* **local-sources:** validate + harden monorepo multi-source detection ([17cb5a9](https://github.com/JoseJesusOchoaTorres/snapds/commit/17cb5a913768c15dc4baaac3f2fafd9814e02042))
* **settings:** clarify npm vs local sources in components tab ([d5d1e8d](https://github.com/JoseJesusOchoaTorres/snapds/commit/d5d1e8dbf820028c83e40259996a36ebbb23a4e9))
* **settings:** hide unwanted packages and remove manual local folders ([d5e33d0](https://github.com/JoseJesusOchoaTorres/snapds/commit/d5e33d0fd8aab713e84270cbc80c4a78c6784c6a))
* **settings:** make card action tooltips explain the consequence ([24d72a4](https://github.com/JoseJesusOchoaTorres/snapds/commit/24d72a4023d81723cbf5a9c9193666dfd0e2f4a1))
* **settings:** reload-by-name, LOCAL/UNSCOPED chips, and a discard button ([442be3e](https://github.com/JoseJesusOchoaTorres/snapds/commit/442be3e9fb930c15e02374060e92cb2a4493451a))
* **settings:** surface local component sources in settings + gallery ([4ec751b](https://github.com/JoseJesusOchoaTorres/snapds/commit/4ec751b0a023cf5c47c4dc92a2976f4b36fc80e9))


### Bug Fixes

* **introspect:** ship typescript lib files so bundled ts resolves types ([0e0afdd](https://github.com/JoseJesusOchoaTorres/snapds/commit/0e0afddbf63065336efb49970490acbc40bf183b))
* **local-sources:** address PR review feedback ([45ecc38](https://github.com/JoseJesusOchoaTorres/snapds/commit/45ecc3849f55342745ec23b7949e8db9895b6317))
* **local-sources:** show manually-added folders in the package list ([2fa6a11](https://github.com/JoseJesusOchoaTorres/snapds/commit/2fa6a112bf9bba65f7227c943126f4274283455c))
* **settings,gallery:** sticky-header hover, stale scope filters, reload centering ([475cdcf](https://github.com/JoseJesusOchoaTorres/snapds/commit/475cdcf1c04565d43dffd913437bf4c1548eeeb6))
* **skills:** correct the cursor index-router test expectation ([be7770d](https://github.com/JoseJesusOchoaTorres/snapds/commit/be7770d4efbb559ebc3db841b0c1495ea91a47f3))

## [1.5.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.4.0...snapds-v1.5.0) (2026-07-29)


### Features

* **gallery:** clearable search and sticky package headers ([4358cd6](https://github.com/JoseJesusOchoaTorres/snapds/commit/4358cd62f7be968dedc7b4765eea178fb874fcf4))
* **settings:** improve package modal and scope filters ([27f636c](https://github.com/JoseJesusOchoaTorres/snapds/commit/27f636c600ecf9e31ea003f2e6b9e017a6d2899d))


### Bug Fixes

* **introspect:** keep props inherited from sibling packages ([3128286](https://github.com/JoseJesusOchoaTorres/snapds/commit/3128286e86bef0e976ddffe887a6ffe7e16989ae))
* **introspect:** surface props for react-aria-style components ([67ad404](https://github.com/JoseJesusOchoaTorres/snapds/commit/67ad4042fd3af7f0ede4e94fb8d96d1f7178f633))

## [1.4.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.3.0...snapds-v1.4.0) (2026-07-28)


### Features

* **skills:** generate skills for multiple coding agents ([0e37ad2](https://github.com/JoseJesusOchoaTorres/snapds/commit/0e37ad2c2e74bee991bf71c2bbe2daba4176fff1))


### Bug Fixes

* apply CodeRabbit auto-fixes ([29dc726](https://github.com/JoseJesusOchoaTorres/snapds/commit/29dc72608ff6588eab67a90e33966314aff92d9f))
* gallery indexing state and loading group interactivity ([f60b742](https://github.com/JoseJesusOchoaTorres/snapds/commit/f60b7425b6970161d84989c76ac408e88c14ec6d))
* replace non-null assertion with index access in App.tsx ([3f0a570](https://github.com/JoseJesusOchoaTorres/snapds/commit/3f0a57033a4416bd4a53fa0971fc273e0e607545))

## [1.3.0](https://github.com/JoseJesusOchoaTorres/snapds/compare/snapds-v1.2.0...snapds-v1.3.0) (2026-07-23)


### Features

* config hash detection, gallery UX, and settings design fixes ([eb40721](https://github.com/JoseJesusOchoaTorres/snapds/commit/eb407217c828acdbe340083bf410f474652d51ad))

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
