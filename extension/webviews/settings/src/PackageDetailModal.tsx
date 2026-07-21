import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface Props {
  pkg: string;
  detected: string[];
  selected: string[];
  loaded: boolean;
  manualValue: string;
  onManualChange: (v: string) => void;
  onToggle: (comp: string) => void;
  onAddManual: () => void;
  onOpenEye: (comp: string) => void;
  onOpenGear: (comp: string) => void;
  onClose: () => void;
  onReload: () => void;
}

/** Package DETAIL modal: filterable checkbox list with per-row EYE + GEAR actions. */
export function PackageDetailModal({
  pkg,
  detected,
  selected,
  loaded,
  manualValue,
  onManualChange,
  onToggle,
  onAddManual,
  onOpenEye,
  onOpenGear,
  onClose,
  onReload,
}: Props) {
  const [filter, setFilter] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);

  const all = useMemo(
    () => Array.from(new Set([...detected, ...selected])).sort((a, b) => a.localeCompare(b)),
    [detected, selected],
  );
  const visible = all.filter((c) => c.toLowerCase().includes(filter.toLowerCase()));
  const used = visible.filter((c) => selected.includes(c));
  const available = visible.filter((c) => !selected.includes(c));

  const renderRow = (c: string) => {
    const manual = !detected.includes(c);
    return (
      <div key={c} className="comp-row">
        <label className="comp-row-main">
          <input type="checkbox" checked={selected.includes(c)} onChange={() => onToggle(c)} />
          <span className="mono">
            {c}
            {manual ? ' *' : ''}
          </span>
        </label>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onOpenEye(c)}
          title="View details"
          aria-label={`View ${c} details`}
        >
          <Icon name="eye" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onOpenGear(c)}
          title="Edit overrides"
          aria-label={`Edit ${c} overrides`}
        >
          <Icon name="gear" />
        </button>
      </div>
    );
  };

  const reloadButton = (
    <button
      type="button"
      className="modal-close"
      onClick={onReload}
      title="Reload components from disk"
      aria-label="Reload components from disk"
    >
      ↺
    </button>
  );

  return (
    <Modal title={pkg} onClose={onClose} headerActions={reloadButton}>
      <input
        type="text"
        className="filter-input"
        placeholder="Filter components…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {!loaded ? (
        <div className="empty">Loading components…</div>
      ) : all.length === 0 ? (
        <div className="empty">No components detected. Add them manually below.</div>
      ) : (
        <div className="comp-groups">
          <div>
            <div className="group-label">
              Used <span className="badge">{used.length}</span>
            </div>
            {used.length ? (
              used.map(renderRow)
            ) : (
              <div className="comp-empty">None selected yet.</div>
            )}
          </div>
          {available.length > 0 && (
            <div>
              <div className="group-label">
                Available <span className="badge">{available.length}</span>
              </div>
              {available.map(renderRow)}
            </div>
          )}
        </div>
      )}

      <div className="manual-add-section">
        <button
          type="button"
          className="manual-add-toggle"
          onClick={() => setShowManualAdd((v) => !v)}
          aria-expanded={showManualAdd}
        >
          <span
            className="accordion-twisty"
            style={{ transform: showManualAdd ? 'rotate(90deg)' : 'none' }}
          >
            ▶
          </span>
          Add component manually
        </button>
        {showManualAdd && (
          <div className="manual-add-body">
            <p className="manual-add-desc">
              Use this when a component wasn't auto-detected. Type its export name and press{' '}
              <kbd>Enter</kbd> or click <strong>Add</strong>. Manually added components are marked
              with an asterisk (*) in the list above.
            </p>
            <div className="manual-add">
              <input
                type="text"
                className="filter-input"
                placeholder="ComponentName…"
                value={manualValue}
                onChange={(e) => onManualChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddManual()}
              />
              <button type="button" className="btn-secondary" onClick={onAddManual}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
