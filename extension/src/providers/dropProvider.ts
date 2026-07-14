import * as vscode from 'vscode';
import { computeImportEdit, generateJSX, splitComponentId } from '../ds/codegen';
import type { Store } from '../state/store';
import type { ComponentMeta } from '../util/messaging';
import { DRAG_MIME } from '../util/messaging';

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
      applyImportEdit(additional, document, meta);
      edit.additionalEdit = additional;

      return edit;
    },
  };

  ctx.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider({ language: 'javascriptreact' }, provider),
    vscode.languages.registerDocumentDropEditProvider({ language: 'typescriptreact' }, provider),
  );
}

function applyImportEdit(
  edit: vscode.WorkspaceEdit,
  doc: vscode.TextDocument,
  meta: ComponentMeta,
): void {
  const { pkg, name } = splitComponentId(meta.id);
  const result = computeImportEdit(doc.getText(), pkg, name);

  if (result.kind === 'replace') {
    const range = new vscode.Range(doc.positionAt(result.start), doc.positionAt(result.end));
    edit.replace(doc.uri, range, result.text);
  } else if (result.kind === 'insert') {
    edit.insert(doc.uri, doc.positionAt(result.offset), result.text);
  }
}
