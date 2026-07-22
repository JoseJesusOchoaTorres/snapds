import { Modal } from './Modal';
import type { ComponentDetail } from './types';

interface Props {
  detail: ComponentDetail;
  onClose: () => void;
  onOpenSkill: (path: string) => void;
}

/** EYE modal: read-only merged view of a component's props + on-disk skill files. */
export function ComponentDetailModal({ detail, onClose, onOpenSkill }: Props) {
  return (
    <Modal title={detail.component} onClose={onClose}>
      {detail.description && <p className="detail-desc">{detail.description}</p>}

      <h4 className="detail-heading">Props</h4>
      {detail.props.length === 0 ? (
        <div className="empty">This component has no documented props.</div>
      ) : (
        <table className="props-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Req</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {detail.props.map((p) => (
              <tr key={p.name}>
                <td className="mono">{p.name}</td>
                <td className="mono">{p.raw || p.type}</td>
                <td>{p.required ? '✓' : ''}</td>
                <td className="mono">
                  {p.defaultValue === undefined ? '' : String(p.defaultValue)}
                </td>
                <td>{p.description ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4 className="detail-heading">Skill files</h4>
      {detail.skillFiles.length === 0 ? (
        <div className="empty">Not yet generated.</div>
      ) : (
        <div className="skill-file-list">
          {detail.skillFiles.map((f) => (
            <button
              type="button"
              key={f.path}
              className="skill-file-row"
              onClick={() => onOpenSkill(f.path)}
              title={f.path}
            >
              <span className="skill-file-icon">📄</span>
              <span className="skill-file-label">{f.label}</span>
              <span className="badge">{f.format}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
