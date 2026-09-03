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

export interface SnippetFrontmatterCtx {
  name: string;
  slug: string;
  category: string;
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
  /**
   * Router/index for the snippets dictionary — mirrors `routerRelPath` for snippets.
   * When set, each snippet gets its own lazy-loaded detail file and the component
   * router links to this snippets router. Undefined for consolidated agents
   * (copilot, cline) — those inline everything in one file by design.
   */
  snippetsRouterRelPath?: string;
  /** Per-snippet detail file path relative to `baseDir`. */
  snippetRelPath?: (slug: string) => string;
  /** Returns true when a `baseDir`-relative path is a per-snippet detail file. */
  isSnippetFile?: (relPath: string) => boolean;
  /** Matches `baseDir`-relative paths snapds owns, so listing stays scoped to snapds. */
  owns: (relPath: string) => boolean;
  /** Frontmatter block (with `---` fences) for a per-component file. */
  componentFrontmatter?: (ctx: FrontmatterCtx) => string;
  /** Frontmatter block for the component router/consolidated file. */
  routerFrontmatter?: () => string;
  /** Frontmatter block for the snippets router file. */
  snippetsRouterFrontmatter?: () => string;
  /** Frontmatter block for a per-snippet detail file. */
  snippetFrontmatter?: (ctx: SnippetFrontmatterCtx) => string;
}

const AUGMENT_LIKE = {
  layout: 'folder' as const,
  routerRelPath: 'snapds/SKILL.md',
  componentRelPath: (s: string) => `snapds-${s}/SKILL.md`,
  snippetsRouterRelPath: 'snapds-snippets/SKILL.md',
  snippetRelPath: (s: string) => `snapds-snippet-${s}/SKILL.md`,
  isSnippetFile: (rel: string) => rel.startsWith('snapds-snippet-') && rel.endsWith('/SKILL.md'),
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
  snippetsRouterFrontmatter: () =>
    [
      '---',
      'name: snapds-snippets',
      'description: Index/router for Snapds custom snippets; load a snippet sub-skill on demand.',
      '---',
    ].join('\n'),
  snippetFrontmatter: ({ name, slug, description }: SnippetFrontmatterCtx) =>
    [
      '---',
      `name: snapds-snippet-${slug}`,
      `description: ${description || `Custom snippet: ${name}`}. Load when building a similar pattern.`,
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
    snippetsRouterRelPath: 'snapds-snippets.mdc',
    snippetRelPath: (s) => `snapds-snippet-${s}.mdc`,
    isSnippetFile: (rel) => /^snapds-snippet-[\w-]+\.mdc$/.test(rel),
    owns: (rel) => /^snapds(-index|-snippets(-router)?|-snippet-[\w-]+|-[\w-]+)\.mdc$/.test(rel),
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
    snippetsRouterFrontmatter: () =>
      [
        '---',
        'description: Index/router for Snapds custom snippets; load a snippet sub-rule on demand.',
        'globs:',
        'alwaysApply: false',
        '---',
      ].join('\n'),
    snippetFrontmatter: ({ name, description }: SnippetFrontmatterCtx) =>
      [
        '---',
        `description: ${description || `Custom snippet: ${name}`}. Load when building a similar pattern.`,
        'globs:',
        'alwaysApply: false',
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
    snippetsRouterRelPath: 'snapds-snippets.md',
    snippetRelPath: (s) => `snapds-snippet-${s}.md`,
    isSnippetFile: (rel) => /^snapds-snippet-[\w-]+\.md$/.test(rel),
    owns: (rel) => /^snapds(-index|-snippets(-router)?|-snippet-[\w-]+|-[\w-]+)\.md$/.test(rel),
    componentFrontmatter: ({ name, pkg }) =>
      [
        '---',
        'trigger: model_decision',
        `description: How to use ${name}${pkg ? ` from ${pkg}` : ''}. Load when adding or modifying ${name} in JSX/TSX.`,
        '---',
      ].join('\n'),
    routerFrontmatter: () => ['---', 'trigger: always_on', '---'].join('\n'),
    snippetsRouterFrontmatter: () =>
      [
        '---',
        'trigger: model_decision',
        'description: Index/router for Snapds custom snippets; load a snippet sub-rule on demand.',
        '---',
      ].join('\n'),
    snippetFrontmatter: ({ name, description }: SnippetFrontmatterCtx) =>
      [
        '---',
        'trigger: model_decision',
        `description: ${description || `Custom snippet: ${name}`}. Load when building a similar pattern.`,
        '---',
      ].join('\n'),
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
    snippetsRouterRelPath: 'snapds-skills/snippets.md',
    snippetRelPath: (s) => `snapds-skills/snippet-${s}.md`,
    isSnippetFile: (rel) => /^snapds-skills\/snippet-[\w-]+\.md$/.test(rel),
    owns: (rel) => rel === 'AGENTS.md' || rel.startsWith('snapds-skills/'),
    snippetsRouterFrontmatter: () => '',
    snippetFrontmatter: () => '',
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
