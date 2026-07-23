import * as vscode from 'vscode';
import { generateJSX } from '../ds/codegen';
import type { Store } from '../state/store';
import { buildImportEdit } from '../util/injectComponent';
import { DRAG_MIME } from '../util/messaging';

/**
 * Registers a drop provider that writes JSX for a component at the drop site,
 * including the correct import statement.
 *
 * @param ctx Extension context
 * @param store Global state store
 */
export function registerDropProvider(ctx: vscode.ExtensionContext, store: Store): void {
  const provider: vscode.DocumentDropEditProvider = {
    async provideDocumentDropEdits(document, _position, dataTransfer, _token) {
      const item = dataTransfer.get(DRAG_MIME);
      if (!item) return;

      let payload: { componentId: string };
      try {
        payload = JSON.parse(await item.asString()) as { componentId: string };
      } catch {
        return;
      }
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
