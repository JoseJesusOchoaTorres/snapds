import type { SkillFormat } from '../util/messaging';

/**
 * How an agent consumes skill files, which drives layout, frontmatter, and how
 * much detail is safe to keep "always loaded":
 * - `folder`            one dir per skill; router + per-component (lazy via folders).
 * - `flat-lazy`         flat dir; small always-on router + per-component files the
 *                       agent loads on demand via a `description`/`trigger` field.
 * - `flat-consolidated` no lazy loading; a single compact catalog file (the router).
 * - `generic`           agent-agnostic AGENTS.md index + per-component files.
 */
export type SkillLayout = 'folder' | 'flat-lazy' | 'flat-consolidated' | 'generic';

export interface FrontmatterCtx {
  name: string;
  pkg: string;
  slug: string;
  description: string;
}

export interface AgentDescriptor {
  id: SkillFormat;
  /** Human label shown in the Settings UI. */
  label: string;
  /** Short path hint shown next to the label, e.g. `.claude/skills/`. */
  hint: string;
  layout: SkillLayout;
  /** Directory under the destination root where files live (`''` = root). */
  baseDir: string;
  /** Router/main file path, relative to `baseDir`. */
  routerRelPath: string;
  /** Per-component file path relative to `baseDir` (undefined for consolidated agents). */
  componentRelPath?: (slug: string) => string;
  /** Matches `baseDir`-relative paths snapds owns, so listing stays scoped to snapds. */
  owns: (relPath: string) => boolean;
  /** Frontmatter block (with `---` fences) for a per-component file, or `''`. */
  componentFrontmatter?: (ctx: FrontmatterCtx) => string;
  /** Frontmatter block for the router/consolidated file, or `''`. */
  routerFrontmatter?: () => string;
}

const AUGMENT_LIKE = {
  layout: 'folder' as const,
  routerRelPath: 'snapds/SKILL.md',
  componentRelPath: (s: string) => `snapds-${s}/SKILL.md`,
  owns: (rel: string) => /^snapds(\/|-)/.test(rel),
  componentFrontmatter: ({ name, pkg, slug }: FrontmatterCtx) =>
    [
      '---',
      `name: snapds-${slug}`,
      `description: How to use ${name}${pkg ? ` from ${pkg}` : ''}. Use when adding or modifying ${name} in JSX/TSX.`,
      '---',
    ].join('\n'),
  routerFrontmatter: () =>
    [
      '---',
      'name: snapds',
      'description: Index/router for the Snapds design system; load a component sub-skill on demand.',
      '---',
    ].join('\n'),
};

/** Registry of every supported agent. Add a new agent by adding one entry here. */
export const AGENTS: Record<SkillFormat, AgentDescriptor> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    hint: '.claude/skills/',
    baseDir: '.claude/skills',
    ...AUGMENT_LIKE,
  },
  augment: {
    id: 'augment',
    label: 'Augment',
    hint: '.augment/skills/',
    baseDir: '.augment/skills',
    ...AUGMENT_LIKE,
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    hint: '.cursor/rules/',
    layout: 'flat-lazy',
    baseDir: '.cursor/rules',
    routerRelPath: 'snapds-index.mdc',
    componentRelPath: (s) => `snapds-${s}.mdc`,
    owns: (rel) => /^snapds-.*\.mdc$/.test(rel),
    componentFrontmatter: ({ name, pkg }) =>
      [
        '---',
        `description: How to use ${name}${pkg ? ` from ${pkg}` : ''}. Load when adding or modifying ${name} in JSX/TSX.`,
        'globs:',
        'alwaysApply: false',
        '---',
      ].join('\n'),
    routerFrontmatter: () =>
      [
        '---',
        'description: Snapds design system index. Prefer these components over raw HTML equivalents.',
        'alwaysApply: true',
        '---',
      ].join('\n'),
  },
  windsurf: {
    id: 'windsurf',
    label: 'Windsurf',
    hint: '.windsurf/rules/',
    layout: 'flat-lazy',
    baseDir: '.windsurf/rules',
    routerRelPath: 'snapds-index.md',
    componentRelPath: (s) => `snapds-${s}.md`,
    owns: (rel) => /^snapds-.*\.md$/.test(rel),
    componentFrontmatter: ({ name, pkg }) =>
      [
        '---',
        'trigger: model_decision',
        `description: How to use ${name}${pkg ? ` from ${pkg}` : ''}. Load when adding or modifying ${name} in JSX/TSX.`,
        '---',
      ].join('\n'),
    routerFrontmatter: () => ['---', 'trigger: always_on', '---'].join('\n'),
  },
  copilot: {
    id: 'copilot',
    label: 'GitHub Copilot',
    hint: '.github/instructions/',
    layout: 'flat-consolidated',
    baseDir: '.github',
    routerRelPath: 'instructions/snapds.instructions.md',
    owns: (rel) => rel === 'instructions/snapds.instructions.md',
    routerFrontmatter: () => ['---', "applyTo: '**/*.{tsx,jsx}'", '---'].join('\n'),
  },
  cline: {
    id: 'cline',
    label: 'Cline',
    hint: '.clinerules/',
    layout: 'flat-consolidated',
    baseDir: '.clinerules',
    routerRelPath: 'snapds.md',
    owns: (rel) => rel === 'snapds.md',
  },
  generic: {
    id: 'generic',
    label: 'AGENTS.md (Codex · Gemini · Jules)',
    hint: 'AGENTS.md',
    layout: 'generic',
    baseDir: '',
    routerRelPath: 'AGENTS.md',
    componentRelPath: (s) => `snapds-skills/${s}.md`,
    owns: (rel) => rel === 'AGENTS.md' || rel.startsWith('snapds-skills/'),
  },
};

/** Display order for the agent picker in the Settings UI. */
export const AGENT_ORDER: SkillFormat[] = [
  'claude',
  'augment',
  'cursor',
  'copilot',
  'windsurf',
  'cline',
  'generic',
];
