import * as vscode from 'vscode';
import type { ComponentMeta, FromProps, ToProps } from '../util/messaging';
import { getWebviewHtml, webviewResourceRoots } from '../util/webviewHtml';

export interface PropsPanelHandlers {
  onReady: () => void | Promise<void>;
  onPropsUpdated: (componentId: string, props: Record<string, unknown>) => void;
}

export class PropsPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private pendingSchema: ComponentMeta | undefined;
  private pendingValues: Record<string, unknown> | undefined;

  constructor(
    private ctx: vscode.ExtensionContext,
    private handlers: PropsPanelHandlers,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'snapds.props',
      'Component Properties',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: webviewResourceRoots(this.ctx, 'props'),
      },
    );
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'icons', 'props-light.svg'),
      dark: vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'icons', 'props-dark.svg'),
    };
    panel.webview.html = getWebviewHtml(panel.webview, this.ctx, 'props');

    panel.webview.onDidReceiveMessage((msg: FromProps) => {
      switch (msg.type) {
        case 'ready':
          void this.handlers.onReady();
          this.flushPending();
          break;
        case 'propsUpdated':
          this.handlers.onPropsUpdated(msg.componentId, msg.props);
          break;
      }
    });

    panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel = panel;
  }

  isOpen(): boolean {
    return this.panel !== undefined;
  }

  postComponentSchema(component: ComponentMeta, values?: Record<string, unknown>): void {
    if (!this.panel) {
      this.pendingSchema = component;
      this.pendingValues = values;
      this.show();
      return;
    }
    this.post({ type: 'componentSchema', component });
    if (values) this.post({ type: 'restoreProps', props: values });
  }

  private flushPending(): void {
    if (this.pendingSchema) {
      this.post({ type: 'componentSchema', component: this.pendingSchema });
      if (this.pendingValues) this.post({ type: 'restoreProps', props: this.pendingValues });
      this.pendingSchema = undefined;
      this.pendingValues = undefined;
    }
  }

  private post(msg: ToProps): void {
    this.panel?.webview.postMessage(msg);
  }
}
