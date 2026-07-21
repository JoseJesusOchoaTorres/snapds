import type { IconName } from './components/icons';

export const LINKS = {
  github: 'https://github.com/JoseJesusOchoaTorres/snapds',
  marketplace: 'https://marketplace.visualstudio.com/items?itemName=Octojose.snapds',
  issues: 'https://github.com/JoseJesusOchoaTorres/snapds/issues',
  changelog: 'https://github.com/JoseJesusOchoaTorres/snapds/blob/main/extension/CHANGELOG.md',
};

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#skills', label: 'Skills' },
  { href: '#faq', label: 'FAQ' },
  { href: '/docs', label: 'Docs' },
];

export const TECH = ['React', 'TypeScript'];

export type Feature = {
  icon: IconName;
  title: string;
  desc: string;
  wide?: boolean;
};

export const FEATURES: Feature[] = [
  {
    icon: 'grid',
    title: 'Visual component gallery',
    desc: 'Browse every component from your registered packages in a dedicated sidebar — searchable, grouped by package, expand or collapse all.',
    wide: true,
  },
  {
    icon: 'cursor',
    title: 'Drag & drop JSX',
    desc: 'Drop a component into any React file. Snapds writes correct JSX with sensible tab-stops so you can tweak values immediately.',
  },
  {
    icon: 'braces',
    title: 'Smart import management',
    desc: 'New imports are merged into the right statement without duplicates — including multi-line, Prettier-formatted imports.',
  },
  {
    icon: 'bolt',
    title: 'Blazing performance',
    desc: 'mtime-based caching and differential updates keep introspection and the gallery fast, even on large monorepos.',
  },
  {
    icon: 'sparkles',
    title: 'Agent-ready skills',
    desc: 'Export your component contract as skill docs so coding agents use your design system without re-reading source or burning tokens.',
    wide: true,
  },
];

export type Step = { title: string; desc: string };

export const STEPS: Step[] = [
  {
    title: 'Register a package',
    desc: 'Add a package like @acme/ui in Snapds Settings. It introspects props, types, enums and defaults automatically.',
  },
  {
    title: 'Explore the gallery',
    desc: 'Open the Components view in the Activity Bar. Search, filter and browse everything your package exposes.',
  },
  {
    title: 'Drop into your code',
    desc: 'Drag a component into a React file — the JSX and its import are written for you, no manual wiring.',
  },
  {
    title: 'Generate skills',
    desc: 'Optionally export agent-ready skills so your assistant knows your design system on demand.',
  },
];

export type SkillItem = { icon: IconName; title: string; desc: string };

export const SKILL_ITEMS: SkillItem[] = [
  {
    icon: 'layers',
    title: 'Dictionary + on-demand detail',
    desc: 'A tiny always-loaded index lists components and links to per-component detail loaded only when needed, so context windows stay small.',
  },
  {
    icon: 'file',
    title: 'Two formats',
    desc: 'Augment skills (SKILL.md per component) or an assistant-agnostic AGENTS.md dictionary — pick one or both.',
  },
  {
    icon: 'folder',
    title: 'Team or personal destinations',
    desc: 'Write committable, team-shared skills to the repo root, or to any custom folder you keep outside it.',
  },
  {
    icon: 'refresh',
    title: 'Incremental auto-generation',
    desc: 'Enable Auto-generate and Snapds regenerates the index and only the new detail files as your selection changes.',
  },
];

export type Level = { tag: string; title: string; desc: string };

export const CONFIG_LEVELS: Level[] = [
  {
    tag: 'Level 1',
    title: 'Auto introspection',
    desc: 'By default Snapds parses your TypeScript components to determine props, types and default values.',
  },
  {
    tag: 'Level 2',
    title: 'Team / workspace',
    desc: 'Add a `snapds.config.json` at the repo root for shared overrides, custom snippets and ignore lists.',
  },
  {
    tag: 'Level 3',
    title: 'User settings',
    desc: 'Personal package registrations and selections live in your workspace `.vscode/settings.json`.',
  },
];

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: 'Which projects does Snapds work with?',
    a: 'React + TypeScript monorepos. It reads component metadata via react-docgen-typescript plus the TypeScript compiler API, and requires VS Code 1.85 or newer.',
  },
  {
    q: 'Does it add runtime dependencies to my project?',
    a: 'No. Snapds only reads metadata and writes the code and skill files you explicitly ask for — nothing is added to your bundle.',
  },
  {
    q: 'What about polymorphic or `as`-style components?',
    a: 'A TypeScript compiler pass enumerates exported value components that docgen alone misses. They appear as chips; add overrides to give them props.',
  },
  {
    q: 'Where are my package selections stored?',
    a: 'Per package under `snapds.packages` as excluded and manual lists. Snapds never persists a full allow-list, so new upstream components always surface.',
  },
];
