import type { CustomSnippet } from '../util/messaging';
import type { SnapdsConfig } from './configSchema';

/**
 * Pure helpers for the team-shared custom snippets stored in `snapds.config.json`.
 *
 * Shared snippets are edited by direct, targeted writes (promote / edit / demote)
 * rather than by the bulk config serializer, so these transforms operate on a
 * `SnapdsConfig` value and the caller persists the result. User-LOCAL snippets
 * live in `workspaceState` (see {@link SnippetStore}) and never appear here.
 */

/** Reads shared snippets out of a config, tagging each `scope: 'shared'`. */
export function readSharedSnippets(config: SnapdsConfig | undefined): CustomSnippet[] {
  return (config?.customSnippets ?? []).map((s) => ({ ...s, scope: 'shared' as const }));
}

/** Adds or replaces a shared snippet in a config (pure). Forces `scope: 'shared'`. */
export function upsertSharedSnippet(config: SnapdsConfig, snippet: CustomSnippet): SnapdsConfig {
  const rest = (config.customSnippets ?? []).filter((s) => s.id !== snippet.id);
  return { ...config, customSnippets: [...rest, { ...snippet, scope: 'shared' }] };
}

/** Removes a shared snippet by id (pure). Drops the key entirely when none remain. */
export function removeSharedSnippet(config: SnapdsConfig, id: string): SnapdsConfig {
  const next = (config.customSnippets ?? []).filter((s) => s.id !== id);
  const copy: SnapdsConfig = { ...config };
  if (next.length > 0) copy.customSnippets = next;
  else delete copy.customSnippets;
  return copy;
}

/**
 * Merges user-local and team-shared snippets into the single list the gallery and
 * quick search render. Ids are unique across both tiers; if one somehow appears in
 * both, the shared copy wins (it is the committed source of truth).
 */
export function mergeSnippets(local: CustomSnippet[], shared: CustomSnippet[]): CustomSnippet[] {
  const byId = new Map<string, CustomSnippet>();
  for (const s of local) byId.set(s.id, { ...s, scope: 'local' });
  for (const s of shared) byId.set(s.id, { ...s, scope: 'shared' });
  return [...byId.values()];
}

/** Count of shared snippets that differ between two lists — powers the import preview. */
export function diffSharedSnippets(current: CustomSnippet[], incoming: CustomSnippet[]): number {
  const currentById = new Map(current.map((s) => [s.id, JSON.stringify(s)]));
  const incomingIds = new Set<string>();
  let changed = 0;
  for (const s of incoming) {
    incomingIds.add(s.id);
    if (currentById.get(s.id) !== JSON.stringify(s)) changed++;
  }
  for (const s of current) if (!incomingIds.has(s.id)) changed++;
  return changed;
}
