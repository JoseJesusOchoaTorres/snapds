import type { ComponentMeta } from '../util/messaging';

/** The subset of a package descriptor the whitelist model depends on. */
export interface WhitelistSelection {
  name: string;
  /** Component names the user explicitly de-selected. Anything not listed is auto-included. */
  excluded?: string[];
  /** Component names the user added manually that introspection did not detect. */
  manual?: string[];
}

/**
 * Applies the single-whitelist model to a package's detected components.
 * All detected components are included by default; only those in `excluded`
 * are removed, and any `manual` names not already present are appended as
 * empty-prop placeholders. New upstream components are auto-included.
 */
export function applyWhitelist(all: ComponentMeta[], pkg: WhitelistSelection): ComponentMeta[] {
  const excluded = new Set(pkg.excluded ?? []);
  const result = all.filter((c) => !excluded.has(c.name));
  const present = new Set(result.map((c) => c.name));
  for (const name of pkg.manual ?? []) {
    if (excluded.has(name) || present.has(name)) continue;
    result.push({ id: `${pkg.name}#${name}`, name, props: [] });
    present.add(name);
  }
  return result;
}
