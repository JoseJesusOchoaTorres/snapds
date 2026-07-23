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
      <div className="config-banner-content">
        <strong className="config-banner-title">{filename} found</strong>
        <p className="config-banner-body">
          This file contains package selections, scope filters, or AI skill settings that differ
          from your current setup — a teammate may have updated it. A full preview will show exactly
          what changes before anything is applied.
        </p>
      </div>
      <div className="config-banner-main-action">
        <button
          type="button"
          className="btn-small btn-primary"
          onClick={onLoad}
          title="Preview and apply changes from the config file"
        >
          Load config
        </button>
      </div>
      <button
        type="button"
        className="config-banner-dismiss"
        onClick={onDismiss}
        title="Dismiss — you can always load the config later from the header"
        aria-label="Dismiss"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 4L4 12M4 4L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
