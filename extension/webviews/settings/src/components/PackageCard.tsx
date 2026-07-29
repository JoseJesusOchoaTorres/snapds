import { Icon } from './Icon';

interface Props {
  name: string;
  selectedCount: number;
  totalCount: number;
  preview: string[];
  onOpen: () => void;
  onRemove?: () => void;
  showCount?: boolean;
  showEmptyPreview?: boolean;
  isActive?: boolean;
  /** In-repo local source (shadcn / design system folder) — shows a "Local" badge. */
  local?: boolean;
  /** Local only: the path-alias base its components import from (e.g. `@/components/ui`). */
  importAlias?: string;
}

const PREVIEW_LIMIT = 3;

/** Compact package card showing name, used/total badge and a chip preview. */
export function PackageCard({
  name,
  selectedCount,
  totalCount,
  preview,
  onOpen,
  onRemove,
  showCount = true,
  showEmptyPreview = true,
  isActive = false,
  local = false,
  importAlias,
}: Props) {
  const shown = preview.slice(0, PREVIEW_LIMIT);
  const extra = preview.length - shown.length;
  return (
    <div
      className={`pkg-card${onRemove ? ' pkg-card-removable' : ''}${isActive ? ' pkg-card-active' : ''}`}
    >
      <button type="button" className="pkg-card-main" onClick={onOpen} title={`Configure ${name}`}>
        <div className="pkg-card-head">
          <span className="pkg-card-name">{name}</span>
          {local && (
            <span
              className="pkg-card-badge-local"
              title="In-repo component source — imported via a path alias, not from node_modules"
            >
              Local
            </span>
          )}
          {showCount && (
            <span className="badge">
              {selectedCount}/{totalCount}
            </span>
          )}
        </div>
        {local && importAlias && (
          <span className="pkg-card-alias mono" title="Components here import from this path alias">
            → {importAlias}
          </span>
        )}
        {shown.length > 0 ? (
          <div className="pkg-card-chips">
            {shown.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
            {extra > 0 && <span className="chip chip-muted">+{extra}</span>}
          </div>
        ) : showEmptyPreview ? (
          <span className="pkg-card-empty">No components selected</span>
        ) : null}
      </button>
      {onRemove && (
        <button
          type="button"
          className="pkg-card-remove"
          onClick={onRemove}
          title={`Remove ${name}`}
          aria-label={`Remove ${name}`}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
