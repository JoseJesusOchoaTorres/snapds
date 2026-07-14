import { Control } from '@snapds/webview-shared';
import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import type { AddedProp, ComponentDetail, PropMeta, PropOverride, UserOverride } from './types';

interface Props {
  detail: ComponentDetail;
  onClose: () => void;
  onSave: (override: UserOverride) => void;
  onResetAll: () => void;
}

const NEW_TYPES = ['string', 'boolean', 'number', 'enum', 'ReactNode', 'function'];

/** GEAR modal: writable USER override layer (snippet, per-prop, add-prop). */
export function OverrideEditorModal({ detail, onClose, onSave, onResetAll }: Props) {
  const [snippet, setSnippet] = useState(detail.userOverride?.snippet ?? '');
  const [propOv, setPropOv] = useState<Record<string, PropOverride>>(
    detail.userOverride?.props ?? {},
  );
  const [added, setAdded] = useState<AddedProp[]>(detail.userOverride?.addedProps ?? []);
  const [np, setNp] = useState({ name: '', type: 'string', description: '' });

  const rows = useMemo<PropMeta[]>(() => {
    const list = [...detail.props];
    for (const name of Object.keys(propOv))
      if (!list.some((p) => p.name === name))
        list.push({ name, type: 'string', raw: '', required: false });
    return list;
  }, [detail.props, propOv]);

  const patch = (name: string, p: Partial<PropOverride>) =>
    setPropOv((prev) => ({ ...prev, [name]: { ...prev[name], ...p } }));
  const resetProp = (name: string) =>
    setPropOv((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

  const addProp = () => {
    const name = np.name.trim();
    if (!name || added.some((a) => a.name === name)) return;
    setAdded((prev) => [
      ...prev,
      { name, type: np.type, description: np.description.trim() || undefined },
    ]);
    setNp({ name: '', type: 'string', description: '' });
  };

  const save = () => {
    const props: Record<string, PropOverride> = {};
    for (const [k, v] of Object.entries(propOv)) {
      const clean: PropOverride = {};
      if (v.hidden) clean.hidden = true;
      if (v.description) clean.description = v.description;
      if (v.defaultValue !== undefined) clean.defaultValue = v.defaultValue;
      if (Object.keys(clean).length) props[k] = clean;
    }
    const override: UserOverride = {};
    if (snippet.trim()) override.snippet = snippet;
    if (Object.keys(props).length) override.props = props;
    if (added.length) override.addedProps = added;
    onSave(override);
  };

  return (
    <Modal title={`Override: ${detail.component}`} onClose={onClose}>
      <label className="field">
        <span className="name">Custom JSX snippet</span>
        <textarea
          value={snippet}
          placeholder={detail.snippet ?? '<Component … />'}
          onChange={(e) => setSnippet(e.target.value)}
        />
      </label>

      <h4 className="detail-heading">Props</h4>
      {rows.map((p) => {
        const ov = propOv[p.name];
        const overridden = !!ov && Object.keys(ov).length > 0;
        return (
          <div key={p.name} className="ov-row">
            <div className="ov-row-head">
              <span className="mono">{p.name}</span>
              {overridden && <span className="badge">override</span>}
              <label className="row-checkbox ov-hidden">
                <input
                  type="checkbox"
                  checked={ov?.hidden ?? false}
                  onChange={(e) => patch(p.name, { hidden: e.target.checked })}
                />
                <span>hidden</span>
              </label>
              {overridden && (
                <button type="button" className="link-btn" onClick={() => resetProp(p.name)}>
                  Reset
                </button>
              )}
            </div>
            {!ov?.hidden && (
              <>
                <input
                  type="text"
                  className="filter-input"
                  placeholder={p.description ?? 'description'}
                  value={ov?.description ?? ''}
                  onChange={(e) => patch(p.name, { description: e.target.value })}
                />
                <Control
                  prop={p}
                  value={ov?.defaultValue ?? p.defaultValue}
                  onChange={(v) => patch(p.name, { defaultValue: v })}
                />
              </>
            )}
          </div>
        );
      })}

      <h4 className="detail-heading">Add prop</h4>
      <div className="add-prop">
        <input
          type="text"
          className="filter-input"
          placeholder="name"
          value={np.name}
          onChange={(e) => setNp({ ...np, name: e.target.value })}
        />
        <select value={np.type} onChange={(e) => setNp({ ...np, type: e.target.value })}>
          {NEW_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={addProp}>
          Add
        </button>
      </div>
      {added.length > 0 && (
        <div className="added-list">
          {added.map((a) => (
            <span key={a.name} className="chip">
              {a.name}: {a.type}
              <button
                type="button"
                className="chip-x"
                onClick={() => setAdded((prev) => prev.filter((x) => x.name !== a.name))}
                aria-label={`Remove ${a.name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="link-btn" onClick={onResetAll}>
          Reset all
        </button>
        <button type="button" className="btn-primary" onClick={save}>
          Save override
        </button>
      </div>
    </Modal>
  );
}
