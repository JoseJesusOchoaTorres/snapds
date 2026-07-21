import type { DragEvent } from 'react';
import type { ComponentMeta } from '../types';
import { ComponentIcon } from './icons';

interface Props {
  meta: Pick<ComponentMeta, 'id' | 'name' | 'description'>;
  selected?: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
}

/** Leaf tree row for one component: click to preview, drag into the editor. */
export function ComponentRow({ meta, selected, onClick, onDragStart }: Props) {
  return (
    <div
      className={`tree-row tree-item${selected ? ' selected' : ''}`}
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
      title={meta.description ?? `${meta.name} — drag into your editor`}
    >
      <ComponentIcon />
      <span className="tree-label">{meta.name}</span>
      <span className="drag-handle" aria-hidden="true" title="Drag into your editor">
        ⠿
      </span>
    </div>
  );
}
