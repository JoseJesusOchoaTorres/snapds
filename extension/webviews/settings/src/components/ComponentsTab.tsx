import { useMemo } from 'react';
import type { PackageMeta } from '../types';
import { PackageCard } from './PackageCard';

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
  onAddLocalSource: () => void;
  hiddenPackages: string[];
  showHidden: boolean;
  onToggleShowHidden: () => void;
  onHidePackage: (name: string) => void;
  onUnhidePackage: (name: string) => void;
  onRemoveLocalSource: (name: string) => void;
}

/**
 * Synthetic filter bucket for packages without an npm scope (e.g. `lucide-react`,
 * `cmdk`). Real scopes always start with `@`, so this sentinel can never collide.
 */
const UNSCOPED = 'UNSCOPED';

/** Dedicated filter bucket for in-repo local sources (shadcn / design systems). */
const LOCAL = 'LOCAL';

/** Returns the npm scope of a package name (`@acme/ui` -> `@acme`), else null. */
function scopeOf(name: string): string | null {
  if (!name.startsWith('@')) return null;
  const slash = name.indexOf('/');
  return slash > 0 ? name.slice(0, slash) : name;
}

/** Filter key for a package: `Local` for in-repo sources, else its npm scope or `(unscoped)`. */
function filterKeyOf(p: PackageMeta): string {
  if (p.kind === 'local') return LOCAL;
  return scopeOf(p.name) ?? UNSCOPED;
}

/**
 * A local folder the user registered by hand (no `components.json`). These are
 * the only sources that can be truly removed — detected ones re-appear on scan,
 * so those are hidden instead.
 */
function isManualLocal(p: PackageMeta): boolean {
  return p.kind === 'local' && p.autoDetected === false;
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
  onAddLocalSource,
  hiddenPackages,
  showHidden,
  onToggleShowHidden,
  onHidePackage,
  onUnhidePackage,
  onRemoveLocalSource,
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
    let hasUnscoped = false;
    let hasLocal = false;
    for (const p of packages) {
      if (p.kind === 'local') {
        hasLocal = true;
        continue;
      }
      const s = scopeOf(p.name);
      if (s) set.add(s);
      else hasUnscoped = true;
    }
    // Synthetic buckets (uppercase) lead so they read as distinct meta-filters,
    // then the real npm scopes (e.g. @radix-ui) sorted after them.
    const special: string[] = [];
    if (hasLocal) special.push(LOCAL);
    if (hasUnscoped) special.push(UNSCOPED);
    return [...special, ...[...set].sort()];
  }, [packages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isActive/comparator/scopeOf are stable module/derived helpers; re-running only on the listed inputs is intended.
  const { active, available } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasQuery = q.length > 0;
    // Only honor filters that correspond to a chip currently on screen. This
    // ignores stale/renamed persisted values (e.g. an old "(unscoped)" after the
    // bucket was renamed) that would otherwise match nothing and hide everything.
    const activeChips = scopeFilters.filter((s) => scopes.includes(s));
    const hasChips = activeChips.length > 0;
    // Scopes are OR'd among themselves, but the text narrows the result: with
    // @starlight selected and "button" typed, only Starlight buttons match.
    const matched = packages.filter((p) => {
      const scopeMatch = !hasChips || activeChips.includes(filterKeyOf(p));
      const textMatch = !hasQuery || p.name.toLowerCase().includes(q);
      return scopeMatch && textMatch;
    });
    return {
      active: matched.filter(isActive).sort(comparator),
      available: matched.filter((p) => !isActive(p)).sort(comparator),
    };
  }, [packages, selectedByPkg, query, scopeFilters, scopes]);

  const renderCard = (p: PackageMeta, opts: { available?: boolean; hidden?: boolean } = {}) => {
    const { available = false, hidden = false } = opts;
    const detected = componentsByPkg[p.name] ?? [];
    const selected = selectedByPkg[p.name] ?? [];
    const total = new Set([...detected, ...selected]).size;
    const manualLocal = isManualLocal(p);
    return (
      <PackageCard
        key={p.name}
        name={p.name}
        selectedCount={selected.length}
        totalCount={total}
        preview={selected}
        onOpen={() => onOpenPackage(p.name)}
        // Manual folders get a real Remove (unregister) in either section;
        // discovered Active packages keep the deactivate (×); discovered
        // Available packages get Hide, and hidden ones get Unhide.
        onRemove={!available && !manualLocal ? () => onRemovePackage(p.name) : undefined}
        onRemoveLocal={manualLocal ? () => onRemoveLocalSource(p.name) : undefined}
        onHide={available && !manualLocal && !hidden ? () => onHidePackage(p.name) : undefined}
        onUnhide={hidden ? () => onUnhidePackage(p.name) : undefined}
        hidden={hidden}
        showCount={!available}
        showEmptyPreview={!available}
        isActive={!available}
        local={p.kind === 'local'}
        importAlias={p.importAlias}
      />
    );
  };

  // Available splits into visible vs hidden (personal declutter). Manual local
  // folders are never hideable — they always stay visible with their Remove.
  const hiddenSet = new Set(hiddenPackages);
  const availableVisible = available.filter((p) => isManualLocal(p) || !hiddenSet.has(p.name));
  const availableHidden = available.filter((p) => !isManualLocal(p) && hiddenSet.has(p.name));

  return (
    <div className="tab-content">
      <div className="components-toolbar">
        <input
          type="text"
          className="filter-input"
          placeholder="Filter packages…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button
          type="button"
          className="btn-small add-local-source"
          onClick={onAddLocalSource}
          title="Register an in-repo component folder (shadcn or your own design system)"
        >
          + Local folder
        </button>
      </div>

      <p className="tab-hint">
        Components come from your <strong>npm packages</strong> and <strong>local folders</strong>{' '}
        in this repo (shadcn or your own design system). Use <strong>+ Local folder</strong> to
        register an in-repo folder — a{' '}
        <span className="scope-chip scope-chip-meta scope-chip-inline">LOCAL</span> source injects
        from a path alias like <code>@/components/ui</code> instead of <code>node_modules</code>.
      </p>

      {scopes.length > 0 && (
        <div className="scope-filters">
          {scopes.map((s) => {
            const active = scopeFilters.includes(s);
            const meta = s === LOCAL || s === UNSCOPED;
            const title =
              s === LOCAL
                ? 'In-repo component sources (shadcn or your own design system)'
                : s === UNSCOPED
                  ? 'npm packages published without an @scope (e.g. lucide-react, cmdk)'
                  : `Show only ${s} packages`;
            return (
              <button
                key={s}
                type="button"
                className={`scope-chip${meta ? ' scope-chip-meta' : ''}${active ? ' scope-chip-active' : ''}`}
                aria-pressed={active}
                title={title}
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
            <div className="empty empty-guide">
              <p>Nothing selected yet. Components can come from two kinds of source:</p>
              <ul>
                <li>
                  <strong>npm packages</strong> — installed in <code>node_modules</code>, imported
                  by their package name.
                </li>
                <li>
                  <strong>local folders</strong> — in-repo components (shadcn or your own design
                  system), imported from a path alias.
                </li>
              </ul>
              <p>
                Open a package under <strong>Available</strong> and pick its components, or add an
                in-repo folder with <strong>+ Local folder</strong>.
              </p>
            </div>
          )}

          <h3 className="section-title">
            Available <span className="badge">{availableVisible.length}</span>
            {availableHidden.length > 0 && (
              <button
                type="button"
                className="link-toggle"
                onClick={onToggleShowHidden}
                aria-pressed={showHidden}
              >
                {showHidden ? 'Hide hidden' : `Show hidden (${availableHidden.length})`}
              </button>
            )}
          </h3>
          {availableVisible.length ? (
            <>
              <p className="section-desc">None of these packages have components selected yet.</p>
              <div className="pkg-card-grid">
                {availableVisible.map((p) => renderCard(p, { available: true }))}
              </div>
            </>
          ) : (
            <div className="empty">
              {availableHidden.length > 0
                ? 'All available packages are hidden.'
                : 'Nothing available.'}
            </div>
          )}

          {showHidden && availableHidden.length > 0 && (
            <>
              <h4 className="section-subtitle">
                Hidden <span className="badge">{availableHidden.length}</span>
              </h4>
              <p className="section-desc">
                Not shown in the list above. Unhide any to bring it back.
              </p>
              <div className="pkg-card-grid">
                {availableHidden.map((p) => renderCard(p, { available: true, hidden: true }))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
