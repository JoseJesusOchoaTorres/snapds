interface Props {
  name: string;
  selectedCount: number;
  totalCount: number;
  preview: string[];
  onOpen: () => void;
  showCount?: boolean;
  showEmptyPreview?: boolean;
}

const PREVIEW_LIMIT = 6;

/** Compact package card showing name, used/total badge and a chip preview. */
export function PackageCard({
  name,
  selectedCount,
  totalCount,
  preview,
  onOpen,
  showCount = true,
  showEmptyPreview = true,
}: Props) {
  const shown = preview.slice(0, PREVIEW_LIMIT);
  const extra = preview.length - shown.length;
  return (
    <button type="button" className="pkg-card" onClick={onOpen} title={`Configure ${name}`}>
      <div className="pkg-card-head">
        <span className="pkg-card-name">{name}</span>
        {showCount && (
          <span className="badge">
            {selectedCount}/{totalCount}
          </span>
        )}
      </div>
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
  );
}
