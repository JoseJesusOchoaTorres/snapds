import { useState } from 'react';
import { Modal } from './Modal';
import type { ConfigExportMode } from './types';

interface Props {
  defaultPath: string;
  existingConfig: boolean;
  onExport: (opts: {
    includeOverrides: boolean;
    mode: ConfigExportMode;
    outputPath?: string;
  }) => void;
  onClose: () => void;
}

/**
 * Modal for exporting the current settings to a snapds.config.json file.
 */
export function ExportConfigModal({ defaultPath, existingConfig, onExport, onClose }: Props) {
  const [includeOverrides, setIncludeOverrides] = useState(false);
  const [mode, setMode] = useState<ConfigExportMode>(existingConfig ? 'merge' : 'replace');
  const [customPath, setCustomPath] = useState('');

  const outputPath = customPath.trim() || undefined;

  return (
    <Modal title="Export config" onClose={onClose}>
      <div className="export-modal-body">
        {existingConfig && (
          <fieldset className="fieldset">
            <legend>When file already exists</legend>
            <label className="row-checkbox">
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              <span>Merge — only write what changed</span>
            </label>
            <label className="row-checkbox">
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              <span>Replace — overwrite the entire file</span>
            </label>
          </fieldset>
        )}

        <div className="fieldset-row">
          <label className="field-label">Output path (optional)</label>
          <input
            type="text"
            className="filter-input"
            placeholder={defaultPath}
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
          />
          <p className="muted" style={{ marginTop: 4 }}>
            Leave empty to write to the workspace root.
          </p>
        </div>

        <div className="modal-footer modal-footer--split">
          <label
            className="row-checkbox export-overrides-toggle"
            title="Promotes your local snippets and prop defaults into the shared config so teammates get them too."
          >
            <input
              type="checkbox"
              checked={includeOverrides}
              onChange={(e) => setIncludeOverrides(e.target.checked)}
            />
            <span>
              Include overrides
              <span className="export-overrides-hint"> — snippets &amp; prop defaults</span>
            </span>
          </label>
          <div className="modal-footer-actions">
            <button type="button" className="btn-small" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-small btn-primary"
              onClick={() => {
                onExport({ includeOverrides, mode, outputPath });
                onClose();
              }}
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
