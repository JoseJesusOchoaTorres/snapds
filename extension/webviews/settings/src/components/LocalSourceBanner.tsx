interface Props {
  /** Names (workspace-relative folders) of detected, not-yet-registered local sources. */
  sources: string[];
  onAdd: () => void;
  onDismiss: () => void;
}

/**
 * Banner shown when Snapds auto-detects an in-repo component source (a
 * `components.json`, e.g. shadcn) that isn't registered yet, offering one-click
 * opt-in. Mirrors ConfigDetectedBanner.
 */
export function LocalSourceBanner({ sources, onAdd, onDismiss }: Props) {
  const label = sources.length === 1 ? sources[0] : `${sources.length} local sources`;
  return (
    <div className="config-banner" role="status" aria-live="polite">
      <div className="config-banner-content">
        <strong className="config-banner-title">Local component source detected</strong>
        <p className="config-banner-body">
          Snapds found an in-repo component folder ({label}) from a <code>components.json</code>{' '}
          (e.g. shadcn). Add it to browse and drag its components — imports use its path alias.
        </p>
      </div>
      <div className="config-banner-main-action">
        <button
          type="button"
          className="btn-small btn-primary"
          onClick={onAdd}
          title="Register the detected local component source(s)"
        >
          Add source
        </button>
      </div>
      <button
        type="button"
        className="config-banner-dismiss"
        onClick={onDismiss}
        title="Dismiss — the source still appears under the LOCAL filter in Components"
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
