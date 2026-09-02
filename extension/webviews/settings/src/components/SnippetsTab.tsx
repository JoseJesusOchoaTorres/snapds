import { type DragEvent, useMemo, useState } from 'react';
import type { CustomSnippet } from '../types';

const UNCATEGORIZED = 'Uncategorized';

interface Props {
  snippets: CustomSnippet[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetScope: (id: string, scope: 'local' | 'shared') => void;
  onRecategorize: (id: string, category: string) => void;
  onRenameCategory: (from: string, to: string) => void;
  onDeleteCategory: (category: string) => void;
}

interface Group {
  category: string;
  real: boolean;
  items: CustomSnippet[];
}

export function SnippetsTab({
  snippets,
  onEdit,
  onDelete,
  onSetScope,
  onRecategorize,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catDraft, setCatDraft] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropCat, setDropCat] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, CustomSnippet[]>();
    for (const s of snippets) {
      const cat = s.category?.trim() || UNCATEGORIZED;
      const list = map.get(cat);
      if (list) list.push(s);
      else map.set(cat, [s]);
    }
    return [...map.entries()]
      .map(([category, items]) => ({ category, real: category !== UNCATEGORIZED, items }))
      .sort((a, b) => {
        if (a.category === UNCATEGORIZED) return 1;
        if (b.category === UNCATEGORIZED) return -1;
        return a.category.localeCompare(b.category);
      });
  }, [snippets]);

  if (snippets.length === 0) {
    return (
      <div className="snip-empty">
        <p>No custom snippets yet.</p>
        <p className="snip-hint">
          Select code in a React file and press <kbd>⌃⌥⌘N</kbd> (or right-click → “Save Selection as
          Snippet”) to capture one.
        </p>
      </div>
    );
  }

  const commitRename = (from: string) => {
    const to = catDraft.trim();
    setEditingCat(null);
    if (to && to !== from) onRenameCategory(from, to);
  };

  const draggedSnippet = draggingId ? snippets.find((s) => s.id === draggingId) : undefined;

  const onDropInto = (category: string) => (e: DragEvent) => {
    e.preventDefault();
    setDropCat(null);
    const id = draggingId ?? e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    if (!id) return;
    const target = category === UNCATEGORIZED ? '' : category;
    onRecategorize(id, target);
  };

  const allowDrop = (category: string) => (e: DragEvent) => {
    if (!draggingId) return;
    e.preventDefault();
    if (dropCat !== category) setDropCat(category);
  };

  return (
    <div className="snip-tab">
      <p className="snip-lead">
        {snippets.length} snippet{snippets.length === 1 ? '' : 's'} across {groups.length} categor
        {groups.length === 1 ? 'y' : 'ies'}. Drag a snippet onto another category to move it, or
        rename a category to move/merge all of its snippets at once.
      </p>

      {groups.map((g) => {
        const isDropTarget =
          dropCat === g.category &&
          draggedSnippet &&
          (draggedSnippet.category ?? '') !== (g.real ? g.category : '');
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: drop zone for drag-to-recategorize; keyboard users manage categories via the modal + Rename/Clear
          <section
            className={`snip-group${isDropTarget ? ' drop-target' : ''}`}
            key={g.category}
            onDragOver={allowDrop(g.category)}
            onDragLeave={() => dropCat === g.category && setDropCat(null)}
            onDrop={onDropInto(g.category)}
          >
            <header className="snip-group-head">
              {editingCat === g.category ? (
                <input
                  type="text"
                  className="snip-cat-input"
                  value={catDraft}
                  // biome-ignore lint/a11y/noAutofocus: focus the rename field the user just opened
                  autoFocus
                  onChange={(e) => setCatDraft(e.target.value)}
                  onBlur={() => commitRename(g.category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(g.category);
                    else if (e.key === 'Escape') setEditingCat(null);
                  }}
                />
              ) : (
                <h3 className="snip-cat">{g.category}</h3>
              )}
              <span className="snip-count">{g.items.length}</span>
              {g.real && editingCat !== g.category && (
                <span className="snip-cat-actions">
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setEditingCat(g.category);
                      setCatDraft(g.category);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    title="Move every snippet here to Uncategorized"
                    onClick={() => onDeleteCategory(g.category)}
                  >
                    Clear
                  </button>
                </span>
              )}
            </header>

            <ul className="snip-list">
              {g.items.map((s) => (
                <li
                  className={`snip-item${draggingId === s.id ? ' dragging' : ''}`}
                  key={s.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(s.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', s.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropCat(null);
                  }}
                >
                  <span className="snip-grip" aria-hidden="true" title="Drag to another category">
                    ⠿
                  </span>
                  <div className="snip-main">
                    <span className="snip-name">{s.name}</span>
                    {s.description && <span className="snip-desc">{s.description}</span>}
                  </div>
                  <span className={`snip-scope ${s.scope}`}>{s.scope}</span>
                  <span className="snip-lang">
                    {s.languageId === 'javascriptreact' ? 'JSX' : 'TSX'}
                  </span>
                  <span className="snip-item-actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => onSetScope(s.id, s.scope === 'shared' ? 'local' : 'shared')}
                      title={
                        s.scope === 'shared'
                          ? 'Make private (workspaceState)'
                          : 'Share with the team (snapds.config.json)'
                      }
                    >
                      {s.scope === 'shared' ? 'Make private' : 'Share'}
                    </button>
                    <button type="button" className="btn-link" onClick={() => onEdit(s.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => onDelete(s.id)}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
