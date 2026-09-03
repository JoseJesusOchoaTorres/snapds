import * as vscode from 'vscode';
import type {
  FromSnippetEditor,
  SnippetDraft,
  SnippetSaveResult,
  ToSnippetEditor,
} from '../util/messaging';
import { getWebviewHtml, webviewResourceRoots } from '../util/webviewHtml';

export interface SnippetEditorHandlers {
  onSave: (result: SnippetSaveResult) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Webview panel that hosts the capture/edit modal. Opened by the "Save selection
 * as snippet" command and by "Edit" on a gallery snippet row. Mirrors the props
 * panel: a single reusable panel with the pending-message flush pattern so a
 * draft posted before the webview signals `ready` is not lost.
 */
export class SnippetEditorProvider {
  private panel: vscode.WebviewPanel | undefined;
  private pendingDraft: SnippetDraft | undefined;

  constructor(
    private ctx: vscode.ExtensionContext,
    private handlers: SnippetEditorHandlers,
  ) {}

  /** Opens the modal with a draft (fresh capture or an existing snippet to edit). */
  open(draft: SnippetDraft): void {
    this.pendingDraft = draft;
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active, false);
      this.post({ type: 'draft', draft });
    } else {
      this.show();
    }
  }

  private show(): void {
    const panel = vscode.window.createWebviewPanel(
      'snapds.snippetEditor',
      'Save Snippet',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: webviewResourceRoots(this.ctx, 'snippet'),
      },
    );
    // Use the built-in snippet codicon so the tab is recognisable at a glance.
    panel.iconPath = new vscode.ThemeIcon('symbol-snippet');
    panel.webview.html = getWebviewHtml(panel.webview, this.ctx, 'snippet');

    panel.webview.onDidReceiveMessage((msg: FromSnippetEditor) => {
      switch (msg.type) {
        case 'ready':
          this.flushPending();
          break;
        case 'save':
          void Promise.resolve(this.handlers.onSave(msg.result)).then(
            () => panel.dispose(),
            (err: unknown) => {
              const detail = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage(`Snapds: failed to save snippet — ${detail}`);
              // Leave the panel open so the user can retry without losing their draft.
            },
          );
          break;
        case 'cancel':
          this.handlers.onCancel?.();
          panel.dispose();
          break;
      }
    });

    panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel = panel;
  }

  private flushPending(): void {
    if (this.pendingDraft) {
      this.post({ type: 'draft', draft: this.pendingDraft });
      this.pendingDraft = undefined;
    }
  }

  private post(msg: ToSnippetEditor): void {
    this.panel?.webview.postMessage(msg);
  }
}
