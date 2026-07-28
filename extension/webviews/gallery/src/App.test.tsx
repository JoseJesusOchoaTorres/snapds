import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import type { ComponentMeta, ToGallery } from './types';

afterEach(cleanup);

function post(msg: ToGallery) {
  window.dispatchEvent(new MessageEvent('message', { data: msg }));
}

const mkComp = (id: string, name: string): ComponentMeta => ({ id, name, props: [] });
const btn = mkComp('@acme/ui#Button', 'Button');
const card = mkComp('@acme/ui#Card', 'Card');
const arrow = mkComp('@acme/icons#ArrowIcon', 'ArrowIcon');

// ─── componentList ────────────────────────────────────────────────────────────

describe('componentList message', () => {
  it('shows all components from the received list', async () => {
    render(<App />);
    act(() => post({ type: 'componentList', components: [btn, card] }));
    expect(screen.getByText('Button')).toBeTruthy();
    expect(screen.getByText('Card')).toBeTruthy();
  });

  it('replaces previously shown components when a new full list arrives', async () => {
    render(<App />);
    act(() => post({ type: 'componentList', components: [btn] }));
    act(() => post({ type: 'componentList', components: [card] }));
    expect(screen.queryByText('Button')).toBeNull();
    expect(screen.getByText('Card')).toBeTruthy();
  });

  it('removes a package from the indexing bar when its components arrive', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    act(() => post({ type: 'componentList', components: [btn, arrow] }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('advances the progress counter when a package arrives incrementally', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    act(() => post({ type: 'componentList', components: [btn] }));
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows the last completed package name in the indexing bar', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    act(() => post({ type: 'componentList', components: [btn] }));
    expect(within(screen.getByRole('status')).getByText('@acme/ui')).toBeTruthy();
  });
});

// ─── indexing ─────────────────────────────────────────────────────────────────

describe('indexing message', () => {
  it('shows the indexing bar with a 0/N counter while packages are loading', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('0 / 2')).toBeTruthy();
  });

  it('hides the indexing bar when the packages list is cleared', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui'] }));
    act(() => post({ type: 'indexing', packages: [] }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
