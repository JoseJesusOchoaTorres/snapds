import { useState } from 'react';
import type { ConfigImportPreviewPayload } from '../types';
import { Modal } from './Modal';

interface Props {
  preview: ConfigImportPreviewPayload;
  onConfirm: (applyOverrides: boolean) => void;
  onClose: () => void;
}

/**
 * Shows what will change before the user commits to loading a snapds.config.json.
 */
export function ImportPreviewModal({ preview, onConfirm, onClose }: Props) {
  const [applyOverrides, setApplyOverrides] = useState(false);

  const filename = preview.configPath.split('/').pop() ?? preview.configPath;
  const hasChanges =
    preview.packagesAdded.length > 0 ||
    preview.packagesRemoved.length > 0 ||
    preview.packagesUpdated.length > 0 ||
    preview.skillsChanged ||
    preview.scopeFiltersChanged;

  return (
    <Modal title={`Load ${filename}`} onClose={onClose}>
      <div className="import-preview-body">
        {!hasChanges && preview.overridesCount === 0 ? (
          <p className="muted">The config matches your current settings — nothing to apply.</p>
        ) : (
          <ul className="change-list">
            {preview.packagesAdded.length > 0 && (
              <li>
                <span className="change-badge change-add">+{preview.packagesAdded.length}</span>{' '}
                package{preview.packagesAdded.length !== 1 ? 's' : ''} added:{' '}
                <span className="muted">{preview.packagesAdded.join(', ')}</span>
              </li>
            )}
            {preview.packagesRemoved.length > 0 && (
              <li>
                <span className="change-badge change-remove">
                  −{preview.packagesRemoved.length}
                </span>{' '}
                package{preview.packagesRemoved.length !== 1 ? 's' : ''} removed:{' '}
                <span className="muted">{preview.packagesRemoved.join(', ')}</span>
              </li>
            )}
            {preview.packagesUpdated.length > 0 && (
              <li>
                <span className="change-badge change-update">
                  ~{preview.packagesUpdated.length}
                </span>{' '}
                package{preview.packagesUpdated.length !== 1 ? 's' : ''} updated
              </li>
            )}
            {preview.overridesCount > 0 && (
              <li>
                <span className="change-badge change-update">{preview.overridesCount}</span>{' '}
                component override{preview.overridesCount !== 1 ? 's' : ''} in config
              </li>
            )}
            {preview.skillsChanged && <li>AI skills config will be updated</li>}
            {preview.scopeFiltersChanged && <li>Scope filters will be updated</li>}
          </ul>
        )}

        {preview.overridesCount > 0 && (
          <label className="row-checkbox row-checkbox--spaced">
            <input
              type="checkbox"
              checked={applyOverrides}
              onChange={(e) => setApplyOverrides(e.target.checked)}
            />
            <span>Apply component overrides to my local settings</span>
          </label>
        )}

        <div className="modal-footer">
          <button type="button" className="btn-small" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-small btn-primary"
            disabled={!hasChanges && preview.overridesCount === 0}
            onClick={() => {
              onConfirm(applyOverrides);
              onClose();
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
