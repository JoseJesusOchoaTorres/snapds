import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ToGallery } from '../util/messaging';
import { GalleryViewProvider } from './galleryViewProvider';

// Minimal fakes: a WebviewView whose webview records posted messages and hands
// back the message callback so a test can simulate the webview's `ready`. The
// ExtensionContext points at a nonexistent dir so getWebviewHtml takes its
// "assets missing" fallback branch (no asWebviewUri/cspSource needed).
function makeFakeView() {
  const posted: ToGallery[] = [];
  let received: ((m: unknown) => void) | undefined;
  const view = {
    webview: {
      options: {} as unknown,
      html: '',
      onDidReceiveMessage: (cb: (m: unknown) => void) => {
        received = cb;
        return { dispose() {} };
      },
      postMessage: (m: ToGallery) => {
        posted.push(m);
        return Promise.resolve(true);
      },
      asWebviewUri: (u: unknown) => u,
      cspSource: 'vscode-webview:',
    },
    onDidDispose: (_cb: () => void) => ({ dispose() {} }),
  };
  return { view, posted, fireReady: () => received?.({ type: 'ready' }) };
}

// biome-ignore lint/suspicious/noExplicitAny: minimal stubs for a unit test.
const ctx = { extensionUri: { fsPath: '/snapds-nonexistent-test-dir' }, subscriptions: [] } as any;
const handlers = { onReady: () => {}, onSearch: () => {}, onSelect: () => {} };

test('replays the active indexing state AND the last progress to a view opening mid-index', () => {
  const provider = new GalleryViewProvider(ctx, handlers);

  // First view receives the live indexing updates.
  const first = makeFakeView();
  // biome-ignore lint/suspicious/noExplicitAny: fake WebviewView.
  provider.resolveWebviewView(first.view as any);
  provider.postIndexing(['@acme/ui', '@acme/icons']);
  provider.postIndexingProgress(1, 2, '@acme/ui');

  // A second view becomes visible mid-index (VS Code re-resolves the view). Its
  // `ready` must replay BOTH the indexing set and the last progress — the latter
  // regresses if postIndexing() nulls lastProgress before it is captured.
  const second = makeFakeView();
  // biome-ignore lint/suspicious/noExplicitAny: fake WebviewView.
  provider.resolveWebviewView(second.view as any);
  second.fireReady();

  const indexing = second.posted.find((m) => m.type === 'indexing');
  const progress = second.posted.find((m) => m.type === 'indexingProgress');
  assert.deepEqual(indexing, { type: 'indexing', packages: ['@acme/ui', '@acme/icons'] });
  assert.deepEqual(progress, { type: 'indexingProgress', done: 1, total: 2, pkg: '@acme/ui' });
  // Order matters: indexing must arrive before the progress that refines it.
  assert.ok(
    second.posted.indexOf(indexing as ToGallery) < second.posted.indexOf(progress as ToGallery),
  );
});

test('does not replay anything once indexing has finished', () => {
  const provider = new GalleryViewProvider(ctx, handlers);
  const first = makeFakeView();
  // biome-ignore lint/suspicious/noExplicitAny: fake WebviewView.
  provider.resolveWebviewView(first.view as any);
  provider.postIndexing(['@acme/ui']);
  provider.postIndexingProgress(1, 1, '@acme/ui');
  provider.postIndexing([]); // run complete

  const second = makeFakeView();
  // biome-ignore lint/suspicious/noExplicitAny: fake WebviewView.
  provider.resolveWebviewView(second.view as any);
  second.fireReady();

  assert.equal(
    second.posted.some((m) => m.type === 'indexing' || m.type === 'indexingProgress'),
    false,
  );
});
