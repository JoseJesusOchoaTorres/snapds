import { Icon } from './Icon';

interface Props {
  name: string;
  selectedCount: number;
  totalCount: number;
  preview: string[];
  onOpen: () => void;
  /** Active cards: deactivate (exclude all components). */
  onRemove?: () => void;
  /** Manual local folders: permanently unregister the folder from Snapds. */
  onRemoveLocal?: () => void;
  /** Available discovered cards: hide from the Available list (reversible). */
  onHide?: () => void;
  /** Hidden cards: restore to the Available list. */
  onUnhide?: () => void;
  showCount?: boolean;
  showEmptyPreview?: boolean;
  isActive?: boolean;
  /** Renders the card dimmed — used in the "Hidden" group. */
  hidden?: boolean;
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
  onRemoveLocal,
  onHide,
  onUnhide,
  showCount = true,
  showEmptyPreview = true,
  isActive = false,
  hidden = false,
  local = false,
  importAlias,
}: Props) {
  const shown = preview.slice(0, PREVIEW_LIMIT);
  const extra = preview.length - shown.length;
  const hasAction = !!(onRemove || onRemoveLocal || onHide || onUnhide);
  return (
    <div
      className={`pkg-card${hasAction ? ' pkg-card-removable' : ''}${isActive ? ' pkg-card-active' : ''}${hidden ? ' pkg-card-hidden' : ''}`}
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
          title={`Deactivate ${name} — clear its selected components and move it back to Available. The package stays discoverable.`}
          aria-label={`Deactivate ${name}`}
        >
          <Icon name="close" />
        </button>
      )}
      {onRemoveLocal && (
        <button
          type="button"
          className="pkg-card-remove"
          onClick={onRemoveLocal}
          title={`Remove ${name} from Snapds — permanently unregister this manually-added folder. Re-add it any time with "+ Local folder".`}
          aria-label={`Remove folder ${name} from Snapds`}
        >
          <Icon name="trash" />
        </button>
      )}
      {onHide && (
        <button
          type="button"
          className="pkg-card-remove"
          onClick={onHide}
          title={`Hide ${name} from the Available list — a personal declutter, not an uninstall. Reveal it again under "Show hidden".`}
          aria-label={`Hide ${name}`}
        >
          <Icon name="eye-closed" />
        </button>
      )}
      {onUnhide && (
        <button
          type="button"
          className="pkg-card-remove"
          onClick={onUnhide}
          title={`Show ${name} in the Available list again`}
          aria-label={`Show ${name}`}
        >
          <Icon name="eye" />
        </button>
      )}
    </div>
  );
}
