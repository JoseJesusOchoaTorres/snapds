import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ClearIcon } from './icons';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Optional keyboard shortcut hint shown when the search field is empty. */
  shortcutHint?: string;
}

export interface SearchBarHandle {
  focus(): void;
}

export const SearchBar = forwardRef<SearchBarHandle, Props>(function SearchBar(
  { value, onChange, shortcutHint },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        type="text"
        aria-label="Search components"
        placeholder="Search components…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc clears the search when there's text (and stays in the input),
          // rather than bubbling up as a generic dismiss.
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            e.stopPropagation();
            clear();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          title="Clear search (Esc)"
          onClick={clear}
        >
          <ClearIcon />
        </button>
      ) : (
        shortcutHint && <kbd className="search-shortcut">{shortcutHint}</kbd>
      )}
    </div>
  );
});
