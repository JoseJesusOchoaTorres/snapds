import type { SkillFormat } from './types';

/**
 * Presentation metadata for the agent picker and per-agent sub-tabs. Mirrors the
 * label/hint of the host-side registry in `extension/src/ds/skillAgents.ts`
 * (kept in sync by hand, like the twin type definitions in this codebase).
 */
export interface AgentMeta {
  id: SkillFormat;
  label: string;
  hint: string;
  /**
   * True when the agent only discovers its config at the repository root (not in
   * nested subfolders), so a `subfolder`/`custom` destination can hide it.
   */
  rootOnly?: boolean;
  /**
   * True when the agent has no lazy loading, so snapds writes a single catalog
   * file (the `compactConsolidated` option applies only to these).
   */
  consolidated?: boolean;
}

export const AGENT_META: AgentMeta[] = [
  { id: 'claude', label: 'Claude Code', hint: '.claude/skills/' },
  { id: 'augment', label: 'Augment', hint: '.augment/skills/' },
  { id: 'cursor', label: 'Cursor', hint: '.cursor/rules/' },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    hint: '.github/instructions/',
    rootOnly: true,
    consolidated: true,
  },
  { id: 'windsurf', label: 'Windsurf', hint: '.windsurf/rules/', rootOnly: true },
  { id: 'cline', label: 'Cline', hint: '.clinerules/', rootOnly: true, consolidated: true },
  { id: 'generic', label: 'AGENTS.md (Codex · Gemini · Jules)', hint: 'AGENTS.md' },
];

/** Agent ids that are only detected at the repo root. */
export const ROOT_ONLY_AGENTS = AGENT_META.filter((a) => a.rootOnly).map((a) => a.id);

/** Agent ids that write a single consolidated catalog (no lazy loading). */
export const CONSOLIDATED_AGENTS = AGENT_META.filter((a) => a.consolidated).map((a) => a.id);

export const AGENT_LABEL = Object.fromEntries(AGENT_META.map((a) => [a.id, a.label])) as Record<
  SkillFormat,
  string
>;
