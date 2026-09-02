import type * as vscode from 'vscode';
import type { ComponentMeta, CustomSnippet, FromGallery, ToGallery } from '../util/messaging';
import { getWebviewHtml, webviewResourceRoots } from '../util/webviewHtml';

export interface GalleryHandlers {
  onReady: () => void | Promise<void>;
  onSearch: (query: string) => void;
  onSelect: (componentId: string) => void | Promise<void>;
  onSnippetSelect: (snippetId: string) => void | Promise<void>;
  onEditSnippet: (snippetId: string) => void | Promise<void>;
  onDeleteSnippet: (snippetId: string) => void | Promise<void>;
}

export class GalleryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'snapds.gallery';

  private view: vscode.WebviewView | undefined;
  /** Tracks packages currently being indexed so the state can be replayed when
   *  the view becomes visible mid-indexing (resolveWebviewView fires on first show). */
  private activeIndexing: string[] | null = null;
  /** Last per-package progress, replayed alongside `activeIndexing` so a view that
   *  opens mid-indexing shows the correct counter/name instead of a stale 0/N. */
  private lastProgress: { done: number; total: number; pkg: string } | null = null;

  constructor(
    private ctx: vscode.ExtensionContext,
    private handlers: GalleryHandlers,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: webviewResourceRoots(this.ctx, 'gallery'),
    };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.ctx, 'gallery');

    webviewView.webview.onDidReceiveMessage((msg: FromGallery) => {
      switch (msg.type) {
        case 'ready': {
          // Replay the indexing state so the gallery shows skeletons even when
          // the view first became visible after indexing had already started.
          // Capture progress first: postIndexing() clears it.
          const replayProgress = this.lastProgress;
          if (this.activeIndexing) {
            this.postIndexing(this.activeIndexing);
            if (replayProgress) {
              this.postIndexingProgress(
                replayProgress.done,
                replayProgress.total,
                replayProgress.pkg,
              );
            }
          }
          void this.handlers.onReady();
          break;
        }
        case 'search':
          this.handlers.onSearch(msg.query);
          break;
        case 'componentSelected':
          void this.handlers.onSelect(msg.componentId);
          break;
        case 'snippetSelected':
          void this.handlers.onSnippetSelect(msg.snippetId);
          break;
        case 'editSnippet':
          void this.handlers.onEditSnippet(msg.snippetId);
          break;
        case 'deleteSnippet':
          void this.handlers.onDeleteSnippet(msg.snippetId);
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
  }

  postComponentList(components: ComponentMeta[]): void {
    this.post({ type: 'componentList', components });
  }

  postSnippetList(snippets: CustomSnippet[]): void {
    this.post({ type: 'snippetList', snippets });
  }

  postSwitchTab(tab: 'components' | 'snippets'): void {
    this.post({ type: 'switchTab', tab });
  }

  postFocusSearch(): void {
    this.post({ type: 'focusSearch' });
  }

  postIndexing(packages: string[]): void {
    this.activeIndexing = packages.length > 0 ? packages : null;
    // A fresh (or finished) indexing run has no progress yet — clear the memo so
    // a later replay can't resurrect a previous run's counter.
    this.lastProgress = null;
    this.post({ type: 'indexing', packages });
  }

  postIndexingProgress(done: number, total: number, pkg: string): void {
    this.lastProgress = { done, total, pkg };
    this.post({ type: 'indexingProgress', done, total, pkg });
  }

  private post(msg: ToGallery): void {
    this.view?.webview.postMessage(msg);
  }
}
