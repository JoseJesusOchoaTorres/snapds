import { useRef } from 'react';
import { ClearIcon } from './icons';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          title="Clear search (Esc)"
          onClick={clear}
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}
