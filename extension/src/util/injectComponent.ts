import * as vscode from 'vscode';
import { computeImportEdit, generateJSX, splitComponentId } from '../ds/codegen';
import type { Store } from '../state/store';
import type { ComponentMeta } from './messaging';

export function buildImportEdit(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  meta: ComponentMeta,
): void {
  const { pkg, name } = splitComponentId(meta.id);
  const result = computeImportEdit(document.getText(), pkg, name);

  if (result.kind === 'replace') {
    const range = new vscode.Range(
      document.positionAt(result.start),
      document.positionAt(result.end),
    );
    edit.replace(document.uri, range, result.text);
  } else if (result.kind === 'insert') {
    edit.insert(document.uri, document.positionAt(result.offset), result.text);
  }
}

export async function injectComponent(
  componentId: string,
  store: Store,
  editor: vscode.TextEditor,
): Promise<void> {
  const meta = store.getComponent(componentId);
  if (!meta) return;

  const configured = store.getConfiguredProps(componentId) ?? {};
  const snippet = generateJSX(meta, configured);

  const workspaceEdit = new vscode.WorkspaceEdit();
  buildImportEdit(workspaceEdit, editor.document, meta);
  await vscode.workspace.applyEdit(workspaceEdit);
  await editor.insertSnippet(new vscode.SnippetString(snippet));
}
