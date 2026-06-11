import type { DragEvent } from 'react';
import type { ComponentMeta } from '../types';

interface Props {
  meta: Pick<ComponentMeta, 'id' | 'name' | 'description'>;
  selected?: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
}

export function ComponentCard({ meta, selected, onClick, onDragStart }: Props) {
  return (
    <div
      className={`card ${selected ? 'selected' : ''}`}
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      title={meta.description ?? meta.name}
    >
      <div className="name">{meta.name}</div>
    </div>
  );
}
