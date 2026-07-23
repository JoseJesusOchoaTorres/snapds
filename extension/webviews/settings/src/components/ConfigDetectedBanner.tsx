interface Props {
  configPath: string;
  onLoad: () => void;
  onDismiss: () => void;
}

/**
 * Banner shown at the top of the settings panel when a snapds.config.json is
 * detected in the workspace and its contents differ from the current settings.
 */
export function ConfigDetectedBanner({ configPath, onLoad, onDismiss }: Props) {
  const filename = configPath.split(/[/\\]/).pop() ?? configPath;
  return (
    <div className="config-banner" role="status" aria-live="polite">
      <span className="config-banner-text">
        <strong>{filename}</strong> found — load it into your settings?
      </span>
      <div className="config-banner-actions">
        <button type="button" className="btn-small btn-primary" onClick={onLoad}>
          Load config
        </button>
        <button type="button" className="btn-small" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
