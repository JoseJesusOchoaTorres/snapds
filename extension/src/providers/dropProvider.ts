import * as vscode from 'vscode';
import { escapeSnippet, generateJSX } from '../ds/codegen';
import type { Store } from '../state/store';
import { buildImportEdit, buildSnippetImportEdit } from '../util/injectComponent';
import type { CustomSnippet } from '../util/messaging';
import { DRAG_MIME } from '../util/messaging';

/**
 * Registers a drop provider that writes JSX for a dropped gallery item at the
 * drop site, including the correct import(s). Handles both design-system
 * components (`{componentId}`) and custom snippets (`{snippetId}`).
 *
 * @param ctx Extension context
 * @param store Global component store
 * @param getSnippet Resolves a custom snippet by id (local + shared merged)
 */
export function registerDropProvider(
  ctx: vscode.ExtensionContext,
  store: Store,
  getSnippet: (id: string) => CustomSnippet | undefined,
): void {
  const provider: vscode.DocumentDropEditProvider = {
    async provideDocumentDropEdits(document, _position, dataTransfer, _token) {
      const item = dataTransfer.get(DRAG_MIME);
      if (!item) return;

      let payload: { componentId?: string; snippetId?: string };
      try {
        payload = JSON.parse(await item.asString());
      } catch {
        return;
      }

      if (payload.snippetId) {
        const snippet = getSnippet(payload.snippetId);
        if (!snippet) return;
        const edit = new vscode.DocumentDropEdit(
          new vscode.SnippetString(escapeSnippet(snippet.code)),
        );
        const additional = new vscode.WorkspaceEdit();
        buildSnippetImportEdit(additional, document, snippet);
        edit.additionalEdit = additional;
        return edit;
      }

      if (!payload.componentId) return;
      const meta = store.getComponent(payload.componentId);
      if (!meta) return;

      const configured = store.getConfiguredProps(payload.componentId) ?? {};
      const snippet = generateJSX(meta, configured);

      const edit = new vscode.DocumentDropEdit(new vscode.SnippetString(snippet));
      edit.insertText = new vscode.SnippetString(snippet);

      const additional = new vscode.WorkspaceEdit();
      buildImportEdit(additional, document, meta);
      edit.additionalEdit = additional;

      return edit;
    },
  };

  ctx.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider({ language: 'javascriptreact' }, provider),
    vscode.languages.registerDocumentDropEditProvider({ language: 'typescriptreact' }, provider),
  );
}
