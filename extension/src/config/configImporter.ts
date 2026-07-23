import * as vscode from 'vscode';
import type { DsPackage, DsRegistry } from '../ds/dsRegistry';
import { getSkillsConfig, setSkillsConfig } from '../ds/skillWriter';
import type { UserOverridesStore } from '../state/userOverrides';
import { normalizePackage, resolveConfig } from './configResolver';
import type { ImportChangeSummary, SnapdsConfig } from './configSchema';

const SCOPE_FILTERS_KEY = 'snapds.scopeFilters';

/**
 * Computes a summary of what will change when `incoming` is applied on top of
 * the current state. Used to power the ImportPreviewModal before committing.
 */
export function previewImport(
  incoming: SnapdsConfig,
  registry: DsRegistry,
  ctx: vscode.ExtensionContext,
): ImportChangeSummary {
  const current = registry.list();
  const currentNames = new Set(current.map((p) => p.name));
  const incomingPkgs = (incoming.packages ?? []).map(normalizePackage);
  const incomingNames = new Set(incomingPkgs.map((p) => p.name));

  const packagesAdded = incomingPkgs.filter((p) => !currentNames.has(p.name)).map((p) => p.name);
  const packagesRemoved = current.filter((p) => !incomingNames.has(p.name)).map((p) => p.name);
  const packagesUpdated = incomingPkgs
    .filter((p) => {
      if (!currentNames.has(p.name)) return false;
      // biome-ignore lint/style/noNonNullAssertion: currentNames.has() on line above guarantees find() returns a value
      const cur = current.find((c) => c.name === p.name)!;
      // Packages exported with the new format carry `components` (allowlist) and
      // omit `excluded` when nothing is excluded. Treat that as excluded: [] so
      // the comparison below works correctly.
      const incomingExcluded = p.excluded ?? (p.components ? [] : undefined);
      return (
        JSON.stringify(incomingExcluded) !== JSON.stringify(cur.excluded) ||
        JSON.stringify(p.manual) !== JSON.stringify(cur.manual)
      );
    })
    .map((p) => p.name);

  const overridesCount = incomingPkgs.reduce(
    (acc, p) => acc + Object.keys(p.overrides ?? {}).length,
    0,
  );

  const currentSkills = getSkillsConfig();
  const skillsChanged =
    incoming.skills !== undefined &&
    JSON.stringify(incoming.skills) !== JSON.stringify(currentSkills);

  const currentFilters = ctx.workspaceState.get<string[]>(SCOPE_FILTERS_KEY) ?? [];
  const scopeFiltersChanged =
    incoming.scopeFilters !== undefined &&
    JSON.stringify(incoming.scopeFilters) !== JSON.stringify(currentFilters);

  return {
    packagesAdded,
    packagesRemoved,
    packagesUpdated,
    overridesCount,
    skillsChanged,
    scopeFiltersChanged,
  };
}

/**
 * Applies a resolved SnapdsConfig to the extension's persisted state:
 * - Registers / removes packages via DsRegistry
 * - Writes skills config to workspace settings
 * - Saves scope filters to workspaceState
 * - Optionally applies overrides to UserOverridesStore
 *
 * Call `previewImport` first to show the user what will change.
 */
export async function applyConfig(
  incoming: SnapdsConfig,
  registry: DsRegistry,
  userOverrides: UserOverridesStore,
  ctx: vscode.ExtensionContext,
  opts: { applyOverrides: boolean } = { applyOverrides: false },
): Promise<void> {
  const incomingPkgs = (incoming.packages ?? []).map(normalizePackage);
  const currentPkgs = registry.list();

  // Build the new package list, preserving machine-local fields (version, tsconfigPath)
  // for packages that already exist.
  const newList: DsPackage[] = incomingPkgs.map((incoming) => {
    const existing = currentPkgs.find((p) => p.name === incoming.name);
    // When exported with the new format, `excluded` is absent when nothing was
    // excluded (components carries the snapshot instead). Treat as excluded: [].
    const excluded = incoming.excluded ?? (incoming.components ? [] : (existing?.excluded ?? []));
    return {
      name: incoming.name,
      importPath: incoming.importPath,
      // Preserve resolved version + tsconfig from current registry; fall back to 'unknown'.
      version: existing?.version ?? 'unknown',
      tsconfigPath: existing?.tsconfigPath,
      excluded,
      manual: incoming.manual ?? [],
    };
  });

  await registry.saveAll(newList);

  if (incoming.skills) {
    await setSkillsConfig(incoming.skills);
  }

  if (incoming.scopeFilters) {
    await ctx.workspaceState.update(SCOPE_FILTERS_KEY, incoming.scopeFilters);
  }

  if (opts.applyOverrides) {
    for (const pkg of incomingPkgs) {
      if (!pkg.overrides) continue;
      for (const [compName, override] of Object.entries(pkg.overrides)) {
        await userOverrides.set(pkg.name, compName, override);
      }
    }
  }
}

/**
 * Detects whether a snapds.config.json exists at the workspace root and whether
 * its current state differs from what's stored in VS Code settings.
 * Used to decide whether to show the "config detected" banner/notification.
 */
export function detectConfigConflict(
  registry: DsRegistry,
  ctx: vscode.ExtensionContext,
): { detected: boolean; hasConflicts: boolean; configPath?: string } {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) return { detected: false, hasConflicts: false };

  const resolved = resolveConfig(folder);
  if (!resolved) return { detected: false, hasConflicts: false };

  const summary = previewImport(resolved.config, registry, ctx);
  const hasConflicts =
    summary.packagesAdded.length > 0 ||
    summary.packagesRemoved.length > 0 ||
    summary.packagesUpdated.length > 0 ||
    summary.skillsChanged ||
    summary.scopeFiltersChanged;

  return { detected: true, hasConflicts, configPath: resolved.owningPath };
}
