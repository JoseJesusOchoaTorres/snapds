import { useMemo, useState } from 'react';
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
}: Props) {
  const [filter, setFilter] = useState('');

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
          👁
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onOpenGear(c)}
          title="Edit overrides"
          aria-label={`Edit ${c} overrides`}
        >
          ⚙
        </button>
      </div>
    );
  };

  return (
    <Modal title={pkg} onClose={onClose}>
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

      <div className="manual-add">
        <input
          type="text"
          className="filter-input"
          placeholder="Add component manually…"
          value={manualValue}
          onChange={(e) => onManualChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddManual()}
        />
        <button type="button" className="btn-secondary" onClick={onAddManual}>
          Add
        </button>
      </div>
    </Modal>
  );
}
