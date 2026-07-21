import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentRow } from './ComponentRow';

afterEach(cleanup);

const meta = { id: '@acme/ui#Button', name: 'Button', description: 'A button' };

describe('ComponentRow', () => {
  it('renders the name inside an ARIA treeitem at level 2', () => {
    render(<ComponentRow meta={meta} onClick={() => {}} onDragStart={() => {}} />);
    const row = screen.getByRole('treeitem');
    expect(row.textContent).toContain('Button');
    expect(row.getAttribute('aria-level')).toBe('2');
    expect(row.getAttribute('aria-selected')).toBe('false');
  });

  it('reflects the selected state via aria-selected', () => {
    render(<ComponentRow meta={meta} selected onClick={() => {}} onDragStart={() => {}} />);
    expect(screen.getByRole('treeitem').getAttribute('aria-selected')).toBe('true');
  });

  it('activates on click and on Enter/Space keys', () => {
    const onClick = vi.fn();
    render(<ComponentRow meta={meta} onClick={onClick} onDragStart={() => {}} />);
    const row = screen.getByRole('treeitem');
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});
