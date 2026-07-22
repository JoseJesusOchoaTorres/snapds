import { useMemo } from 'react';
import { PackageCard } from './PackageCard';
import type { PackageMeta } from './types';

interface Props {
  packages: PackageMeta[];
  componentsByPkg: Record<string, string[]>;
  selectedByPkg: Record<string, string[]>;
  query: string;
  onQueryChange: (v: string) => void;
  scopeFilters: string[];
  onToggleScope: (scope: string) => void;
  onOpenPackage: (name: string) => void;
  onRemovePackage: (name: string) => void;
}

/** Returns the npm scope of a package name (`@acme/ui` -> `@acme`), else null. */
function scopeOf(name: string): string | null {
  if (!name.startsWith('@')) return null;
  const slash = name.indexOf('/');
  return slash > 0 ? name.slice(0, slash) : name;
}

/** Splits packages into Active (>=1 used component or enabled) vs Available sections. */
export function ComponentsTab({
  packages,
  componentsByPkg,
  selectedByPkg,
  query,
  onQueryChange,
  scopeFilters,
  onToggleScope,
  onOpenPackage,
  onRemovePackage,
}: Props) {
  const comparator = (a: PackageMeta, b: PackageMeta) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  };

  // Selection-driven: once a package has a known selection (even empty), it
  // drives Active/Available so deselecting the last component moves the card to
  // Available. Fall back to the persisted `enabled` flag until selection loads.
  const isActive = (p: PackageMeta) => {
    const sel = selectedByPkg[p.name];
    return sel !== undefined ? sel.length > 0 : p.enabled;
  };

  const scopes = useMemo(() => {
    const set = new Set<string>();
    for (const p of packages) {
      const s = scopeOf(p.name);
      if (s) set.add(s);
    }
    return [...set].sort();
  }, [packages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isActive/comparator/scopeOf are stable module/derived helpers; re-running only on the listed inputs is intended.
  const { active, available } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasQuery = q.length > 0;
    const hasChips = scopeFilters.length > 0;
    // Scopes are OR'd among themselves, but the text narrows the result: with
    // @starlight selected and "button" typed, only Starlight buttons match.
    const matched = packages.filter((p) => {
      const scope = scopeOf(p.name);
      const scopeMatch = !hasChips || (scope != null && scopeFilters.includes(scope));
      const textMatch = !hasQuery || p.name.toLowerCase().includes(q);
      return scopeMatch && textMatch;
    });
    return {
      active: matched.filter(isActive).sort(comparator),
      available: matched.filter((p) => !isActive(p)).sort(comparator),
    };
  }, [packages, selectedByPkg, query, scopeFilters]);

  const renderCard = (p: PackageMeta, available = false) => {
    const detected = componentsByPkg[p.name] ?? [];
    const selected = selectedByPkg[p.name] ?? [];
    const total = new Set([...detected, ...selected]).size;
    return (
      <PackageCard
        key={p.name}
        name={p.name}
        selectedCount={selected.length}
        totalCount={total}
        preview={selected}
        onOpen={() => onOpenPackage(p.name)}
        onRemove={available ? undefined : () => onRemovePackage(p.name)}
        showCount={!available}
        showEmptyPreview={!available}
        isActive={!available}
      />
    );
  };

  return (
    <div className="tab-content">
      <input
        type="text"
        className="filter-input"
        placeholder="Filter packages…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      {scopes.length > 0 && (
        <div className="scope-filters">
          {scopes.map((s) => {
            const active = scopeFilters.includes(s);
            return (
              <button
                key={s}
                type="button"
                className={`scope-chip${active ? ' scope-chip-active' : ''}`}
                aria-pressed={active}
                onClick={() => onToggleScope(s)}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      {packages.length === 0 ? (
        <div className="empty">No packages found.</div>
      ) : (
        <>
          <h3 className="section-title">
            Active <span className="badge">{active.length}</span>
          </h3>
          {active.length ? (
            <div className="pkg-card-grid">{active.map((p) => renderCard(p))}</div>
          ) : (
            <div className="empty">No active packages yet.</div>
          )}

          <h3 className="section-title">
            Available <span className="badge">{available.length}</span>
          </h3>
          {available.length ? (
            <>
              <p className="section-desc">None of these packages have components selected yet.</p>
              <div className="pkg-card-grid">{available.map((p) => renderCard(p, true))}</div>
            </>
          ) : (
            <div className="empty">Nothing available.</div>
          )}
        </>
      )}
    </div>
  );
}
