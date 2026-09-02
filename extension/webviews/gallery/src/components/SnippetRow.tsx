import type { DragEvent } from 'react';
import type { CustomSnippet } from '../types';
import { EditIcon, SnippetIcon, TrashIcon } from './icons';

interface Props {
  snippet: CustomSnippet;
  selected?: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Leaf tree row for one custom snippet: drag to inject, hover to edit/delete. */
export function SnippetRow({ snippet, selected, onClick, onDragStart, onEdit, onDelete }: Props) {
  return (
    <div
      className={`tree-row tree-item snippet-row${selected ? ' selected' : ''}`}
      role="treeitem"
      aria-level={2}
      aria-selected={!!selected}
      tabIndex={0}
      draggable
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onDragStart={onDragStart}
      title={snippet.description ?? `${snippet.name} — drag into your editor`}
    >
      <SnippetIcon />
      <span className="tree-label">{snippet.name}</span>
      {snippet.scope === 'shared' && (
        <span className="snippet-badge" title="Shared with the team via snapds.config.json">
          shared
        </span>
      )}
      <span className="snippet-actions">
        <button
          type="button"
          className="row-action"
          title="Edit snippet"
          aria-label={`Edit ${snippet.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="row-action"
          title="Delete snippet"
          aria-label={`Delete ${snippet.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon />
        </button>
      </span>
      <span className="drag-handle" aria-hidden="true" title="Drag into your editor">
        ⠿
      </span>
    </div>
  );
}
