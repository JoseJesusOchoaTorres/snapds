import { vscode } from '@snapds/webview-shared';
import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from './CodeEditor';
import type { SnippetDraft, ToSnippet } from './types';

// ── CategoryCombobox ─────────────────────────────────────────────────────────
// Replaces <datalist> (which renders with OS chrome, ignoring VS Code CSS vars)
// with a fully-themed custom combobox.
function CategoryCombobox({
  value,
  suggestions,
  onChange,
}: {
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => s !== value && s.toLowerCase().includes(value.toLowerCase()),
  );
  const isOpen = open && filtered.length > 0;

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="combobox">
      {/* Per ARIA 1.1: role="combobox" belongs on the input, not the wrapper. */}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        value={value}
        placeholder="Pick or create — blank means Uncategorized"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls="cat-listbox"
        aria-activedescendant={activeIdx >= 0 ? `cat-opt-${activeIdx}` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Keep the list open when focus moves into it (mousedown → option click).
          if (!listRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
            setActiveIdx(-1);
          }
        }}
        onKeyDown={(e) => {
          if (!isOpen) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            pick(filtered[activeIdx]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setActiveIdx(-1);
          }
        }}
      />
      {isOpen && (
        <div
          ref={listRef}
          className="combobox-list"
          role="listbox"
          id="cat-listbox"
          aria-label="Existing categories"
        >
          {filtered.map((s, i) => (
            <div
              key={s}
              role="option"
              tabIndex={-1}
              id={`cat-opt-${i}`}
              aria-selected={i === activeIdx}
              className={`combobox-opt${i === activeIdx ? ' active' : ''}`}
              // mousedown fires before the input's onBlur so the list stays open.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ImportRow {
  line: string;
  include: boolean;
}

export default function App() {
  const [draft, setDraft] = useState<SnippetDraft | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState<'local' | 'shared'>('local');
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [code, setCode] = useState('');

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToSnippet>) => {
      if (e.data.type !== 'draft') return;
      const d = e.data.draft;
      setDraft(d);
      setName(d.name);
      setDescription(d.description);
      setCategory(d.category);
      setScope(d.scope);
      setImports(d.importLines.map((line) => ({ line, include: true })));
      setCode(d.code);
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!draft) return <p className="empty">Loading snippet…</p>;

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && code.trim().length > 0;

  const setImportLine = (i: number, line: string) =>
    setImports((rows) => rows.map((r, idx) => (idx === i ? { ...r, line } : r)));
  const toggleImport = (i: number) =>
    setImports((rows) => rows.map((r, idx) => (idx === i ? { ...r, include: !r.include } : r)));
  const removeImport = (i: number) => setImports((rows) => rows.filter((_, idx) => idx !== i));
  const addImport = () => setImports((rows) => [...rows, { line: '', include: true }]);

  const save = () => {
    if (!canSave) return;
    vscode.postMessage({
      type: 'save',
      result: {
        id: draft.id,
        name: trimmedName,
        description: description.trim(),
        category: category.trim(),
        code,
        scope,
        importLines: imports
          .filter((r) => r.include && r.line.trim().length > 0)
          .map((r) => r.line.trim()),
      },
    });
  };

  const cancel = () => vscode.postMessage({ type: 'cancel' });

  return (
    <div className="snippet-editor">
      <header className="editor-head">
        <h1>{draft.mode === 'edit' ? 'Edit snippet' : 'New snippet'}</h1>
        <p className="editor-sub">
          Captured from <code>{draft.languageId}</code>. It will drag &amp; inject like a component.
        </p>
      </header>

      <label className="field">
        <span className="field-label">
          Name{' '}
          <span className="req" aria-hidden="true">
            *
          </span>
        </span>
        <input
          type="text"
          value={name}
          // biome-ignore lint/a11y/noAutofocus: the name field is the first action in a dedicated capture modal, so focusing it is expected
          autoFocus
          placeholder="e.g. Labeled button pair"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
      </label>

      <label className="field">
        <span className="field-label">Description</span>
        <textarea
          rows={2}
          value={description}
          placeholder="What is this snippet for?"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field-label">Category</span>
        <CategoryCombobox
          value={category}
          suggestions={draft.existingCategories}
          onChange={setCategory}
        />
      </div>

      <div className="field">
        <span className="field-label">
          Code{' '}
          <span className="req" aria-hidden="true">
            *
          </span>
        </span>
        <CodeEditor value={code} onChange={setCode} />
      </div>

      <fieldset className="field imports">
        <legend className="field-label pb-2">
          Imports <span className="hint">— injected with the snippet</span>
        </legend>
        {imports.length === 0 && (
          <p className="hint">No imports detected. Add any the snippet needs.</p>
        )}
        {imports.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and editable in place
          <div className="import-row" key={i}>
            <input
              type="checkbox"
              checked={row.include}
              aria-label={`Include import ${i + 1}`}
              onChange={() => toggleImport(i)}
            />
            <input
              type="text"
              className="import-line"
              value={row.line}
              spellCheck={false}
              onChange={(e) => setImportLine(i, e.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove import ${i + 1}`}
              title="Remove"
              onClick={() => removeImport(i)}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="add-import" onClick={addImport}>
          + Add import
        </button>
      </fieldset>

      <div className="field">
        <span className="field-label">Storage</span>
        <div className="scope-row">
          <label className={`scope-opt${scope === 'local' ? ' active' : ''}`}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'local'}
              onChange={() => setScope('local')}
            />
            <span>
              <strong>Private</strong>
              <em>This repo only, never committed</em>
            </span>
          </label>
          <label
            className={`scope-opt${scope === 'shared' ? ' active' : ''}${draft.canShare ? '' : ' disabled'}`}
            title={draft.canShare ? undefined : 'Open a workspace to share snippets with the team'}
          >
            <input
              type="radio"
              name="scope"
              checked={scope === 'shared'}
              disabled={!draft.canShare}
              onChange={() => setScope('shared')}
            />
            <span>
              <strong>Share with team</strong>
              <em>Written to snapds.config.json (committed)</em>
            </span>
          </label>
        </div>
      </div>

      <footer className="editor-actions">
        <button type="button" className="btn-secondary" onClick={cancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" disabled={!canSave} onClick={save}>
          {draft.mode === 'edit' ? 'Save changes' : 'Save snippet'}
        </button>
      </footer>
    </div>
  );
}
