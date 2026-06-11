import * as vscode from 'vscode';
import { getWebviewHtml, webviewResourceRoots } from '../util/webviewHtml';
import type { FromSettings, ToSettings, PackageMeta } from '../util/messaging';

export interface SettingsHandlers {
  onReady: () => void | Promise<void>;
  onSavePackages: (packages: string[]) => void | Promise<void>;
}

export class SettingsPanelProvider {
  public static readonly viewType = 'snapds.settings';
  public panel: vscode.WebviewPanel | undefined;

  constructor(
    private ctx: vscode.ExtensionContext,
    private handlers: SettingsHandlers,
  ) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      SettingsPanelProvider.viewType,
      'Snapds Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: webviewResourceRoots(this.ctx, 'settings'),
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.ctx, 'settings');

    this.panel.webview.onDidReceiveMessage((msg: FromSettings) => {
      switch (msg.type) {
        case 'ready':
          void this.handlers.onReady();
          break;
        case 'savePackages':
          void this.handlers.onSavePackages(msg.packages);
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  postPackageList(packages: PackageMeta[]): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'packageList', packages } satisfies ToSettings);
    }
  }

  postSaving(): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'saving' } satisfies ToSettings);
    }
  }

  postSaved(): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'saved' } satisfies ToSettings);
    }
  }
}
