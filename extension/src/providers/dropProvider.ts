import * as vscode from 'vscode';
import { generateJSX, generateImport, splitComponentId } from '../ds/codegen';
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
  if (!pkg) return;

  const text = doc.getText();
  const importRegex = new RegExp(
    `(import\\s+(?:[\\w\\s,]*?)?\\{)([^}]*)(\\}\\s+from\\s+['"]${escapeRegex(pkg)}['\"];?)`
  );

  const m = text.match(importRegex);
  if (m) {
    const prefix = m[1];
    const inner = m[2];
    const suffix = m[3];

    const names = inner.split(',').map((s) => s.trim()).filter(Boolean);
    if (names.includes(name)) return;
    names.push(name);

    let newInner = ' ' + names.join(', ') + ' ';
    if (inner.includes('\n')) {
      newInner = '\n  ' + names.join(',\n  ') + '\n';
    }

    const newText = `${prefix}${newInner}${suffix}`;
    const startPos = doc.positionAt(m.index!);
    const endPos = doc.positionAt(m.index! + m[0].length);
    edit.replace(doc.uri, new vscode.Range(startPos, endPos), newText);
    return;
  }

  let lastImportLine = -1;
  for (let i = 0; i < doc.lineCount; i++) {
    if (/^\s*import\b/.test(doc.lineAt(i).text)) lastImportLine = i;
  }

  const insertLine = lastImportLine + 1;
  const insertPos = new vscode.Position(insertLine, 0);
  edit.insert(doc.uri, insertPos, generateImport(meta) + '\n');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
