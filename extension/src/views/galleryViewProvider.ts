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

  private post(msg: ToGallery): void {
    this.view?.webview.postMessage(msg);
  }
}
