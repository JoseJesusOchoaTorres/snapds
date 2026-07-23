import type * as vscode from 'vscode';
import type { ComponentMeta, FromGallery, ToGallery } from '../util/messaging';
import { getWebviewHtml, webviewResourceRoots } from '../util/webviewHtml';

export interface GalleryHandlers {
  onReady: () => void | Promise<void>;
  onSearch: (query: string) => void;
  onSelect: (componentId: string) => void | Promise<void>;
}

export class GalleryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'snapds.gallery';

  private view: vscode.WebviewView | undefined;
  /** Tracks packages currently being indexed so the state can be replayed when
   *  the view becomes visible mid-indexing (resolveWebviewView fires on first show). */
  private activeIndexing: string[] | null = null;

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
        case 'ready':
          // Replay the indexing state so the gallery shows skeletons even when
          // the view first became visible after indexing had already started.
          if (this.activeIndexing) this.postIndexing(this.activeIndexing);
          void this.handlers.onReady();
          break;
        case 'search':
          this.handlers.onSearch(msg.query);
          break;
        case 'componentSelected':
          void this.handlers.onSelect(msg.componentId);
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

  postIndexing(packages: string[]): void {
    this.activeIndexing = packages.length > 0 ? packages : null;
    this.post({ type: 'indexing', packages });
  }

  private post(msg: ToGallery): void {
    this.view?.webview.postMessage(msg);
  }
}
