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

  it('keeps the indexing bar visible when a full snapshot arrives mid-index', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    // A snapshot must not clear pending — the bar stays until indexingProgress.
    act(() => post({ type: 'componentList', components: [btn, arrow] }));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(within(screen.getByRole('status')).getByText('0 / 2')).toBeTruthy();
  });

  it('does not mark packages done from a full snapshot during a reindex', async () => {
    render(<App />);
    // Two packages already populated from a prior load.
    act(() => post({ type: 'componentList', components: [btn, arrow] }));
    // Reindex begins; the first refresh re-emits the full (still-old) snapshot.
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    act(() => post({ type: 'componentList', components: [btn, arrow] }));
    // Progress must stay 0/2 — only indexingProgress advances it.
    expect(within(screen.getByRole('status')).getByText('0 / 2')).toBeTruthy();
    act(() => post({ type: 'indexingProgress', done: 1, total: 2, pkg: '@acme/ui' }));
    expect(within(screen.getByRole('status')).getByText('1 / 2')).toBeTruthy();
    act(() => post({ type: 'indexingProgress', done: 2, total: 2, pkg: '@acme/icons' }));
    expect(screen.queryByRole('status')).toBeNull();
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

  it('shows the first pending package name before any progress event', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    expect(within(screen.getByRole('status')).getByText('@acme/ui')).toBeTruthy();
  });
});

// ─── indexingProgress ───────────────────────────────────────────────────────────

describe('indexingProgress message', () => {
  it('drives the counter authoritatively (matches the host toast)', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    act(() => post({ type: 'indexingProgress', done: 1, total: 2, pkg: '@acme/ui' }));
    expect(within(screen.getByRole('status')).getByText('1 / 2')).toBeTruthy();
    expect(within(screen.getByRole('status')).getByText('@acme/ui')).toBeTruthy();
  });

  it('reports the host counter verbatim, independent of pending set size', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/icons'] }));
    // Host says 2/2 even though only one package has been dropped from pending.
    act(() => post({ type: 'indexingProgress', done: 2, total: 2, pkg: '@acme/ui' }));
    expect(within(screen.getByRole('status')).getByText('2 / 2')).toBeTruthy();
  });

  it('clears the skeleton for a package that yielded zero components', async () => {
    render(<App />);
    act(() => post({ type: 'indexing', packages: ['@acme/ui', '@acme/empty'] }));
    // @acme/empty finishes with no componentList of its own — progress must still
    // drop it from the pending skeleton set.
    act(() => post({ type: 'indexingProgress', done: 1, total: 2, pkg: '@acme/empty' }));
    expect(screen.queryByLabelText('Loading @acme/empty')).toBeNull();
    expect(screen.getByLabelText('Loading @acme/ui')).toBeTruthy();
  });
});
