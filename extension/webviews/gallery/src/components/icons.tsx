/** Small theme-aware tree icons (fill/stroke use `currentColor`). */

export function FolderIcon() {
  return (
    <span className="tree-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M1.5 2.75h4.1l1.2 1.5h7.7c.3 0 .5.2.5.5v8.25c0 .3-.2.5-.5.5H1.5c-.3 0-.5-.2-.5-.5v-9.75c0-.3.2-.5.5-.5z" />
      </svg>
    </span>
  );
}

export function ComponentIcon() {
  return (
    <span className="tree-icon" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 4 2.5 8 6 12M10 4l3.5 4L10 12" />
      </svg>
    </span>
  );
}

/** Two stacked chevrons pointing down — "expand all". */
export function ExpandAllIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4l4 3.5L12 4M4 8.5l4 3.5 4-3.5" />
    </svg>
  );
}

/** A tag / category glyph for snippet category groups. */
export function TagIcon() {
  return (
    <span className="tree-icon" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2.5 2.5h5l6 6-5 5-6-6z" />
        <circle cx="5" cy="5" r="1" />
      </svg>
    </span>
  );
}

/** A code-brackets glyph for a custom snippet leaf row. */
export function SnippetIcon() {
  return (
    <span className="tree-icon" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5.5 4.5 2.5 8l3 3.5M10.5 4.5 13.5 8l-3 3.5M9 3l-2 10" />
      </svg>
    </span>
  );
}

/** Pencil — edit a snippet. */
export function EditIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 2.5 13.5 5 6 12.5 3 13l.5-3z" />
    </svg>
  );
}

/** Trash — delete a snippet. */
export function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 4.5h10M6.5 4V2.5h3V4M4.5 4.5 5 13.5h6l.5-9" />
    </svg>
  );
}

/** A small "×" — clears the search input. */
export function ClearIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** Two stacked chevrons pointing up — "collapse all". */
export function CollapseAllIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7.5L8 4l4 3.5M4 12l4-3.5 4 3.5" />
    </svg>
  );
}
