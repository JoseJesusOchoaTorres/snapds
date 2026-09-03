import * as vscode from 'vscode';
import {
  computeImportEdit,
  escapeSnippet,
  generateJSX,
  planImports,
  splitComponentId,
} from '../ds/codegen';
import type { Store } from '../state/store';
import type { ComponentMeta, CustomSnippet } from './messaging';

/**
 * Builds a workspace edit to add an import for the component to the given document.
 */
export function buildImportEdit(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  meta: ComponentMeta,
): void {
  const { pkg, name } = splitComponentId(meta.id);
  // Local sources carry an explicit per-file specifier (e.g. `@/components/ui/button`);
  // npm packages leave it unset and fall back to the id's package prefix.
  const specifier = meta.importSpecifier ?? pkg;
  const result = computeImportEdit(document.getText(), specifier, name);

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

/**
 * Injects a component's JSX snippet and its import at the cursor.
 */
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

/**
 * Adds every import a custom snippet needs to the given document. Unlike a
 * component (one derived import), a snippet carries its own `imports`, so this
 * plans and applies the full set — merging named symbols into existing lines and
 * inserting any brand-new import lines after the last existing import.
 */
export function buildSnippetImportEdit(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  snippet: CustomSnippet,
): void {
  for (const result of planImports(document.getText(), snippet.imports)) {
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
}

/**
 * Injects a custom snippet's code and all of its imports at the cursor. The code
 * is escaped so `$`, `{`, `}`, and `\` in captured source are inserted literally
 * rather than being interpreted as `SnippetString` tab-stop syntax.
 */
export async function injectSnippet(
  snippet: CustomSnippet,
  editor: vscode.TextEditor,
): Promise<void> {
  const workspaceEdit = new vscode.WorkspaceEdit();
  buildSnippetImportEdit(workspaceEdit, editor.document, snippet);
  await vscode.workspace.applyEdit(workspaceEdit);
  await editor.insertSnippet(new vscode.SnippetString(escapeSnippet(snippet.code)));
}
