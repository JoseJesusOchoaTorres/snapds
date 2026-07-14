import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Accordion } from './Accordion';

afterEach(cleanup);

describe('Accordion', () => {
  it('exposes an accessible disclosure button reflecting the open state', () => {
    const onToggle = vi.fn();
    render(
      <Accordion title="General" open={false} onToggle={onToggle}>
        <p>Body</p>
      </Accordion>,
    );
    const btn = screen.getByRole('button', { name: /General/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders children only when open', () => {
    const { rerender } = render(
      <Accordion title="General" open={false} onToggle={() => {}}>
        <p>Body content</p>
      </Accordion>,
    );
    expect(screen.queryByText('Body content')).toBeNull();

    rerender(
      <Accordion title="General" open onToggle={() => {}}>
        <p>Body content</p>
      </Accordion>,
    );
    expect(screen.queryByText('Body content')).not.toBeNull();
    expect(screen.getByRole('button', { name: /General/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
});
