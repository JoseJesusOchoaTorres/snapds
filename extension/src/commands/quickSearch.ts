import * as vscode from 'vscode';
import { generateJSX } from '../ds/codegen';
import type { Store } from '../state/store';
import { injectComponent } from '../util/injectComponent';

type ComponentQuickPickItem = vscode.QuickPickItem & { componentId: string };

function snippetPreview(snippet: string): string {
  return snippet
    .split('\n')[0]
    .replace(/\$\{[^}]+\}/g, '…')
    .replace(/\$\d+/g, '…');
}

export function registerQuickSearch(ctx: vscode.ExtensionContext, store: Store): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('snapds.quickSearch', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          'Snapds: Open a React file to use Quick Component Search.',
        );
        return;
      }

      const components = store.listComponents();
      if (components.length === 0) {
        vscode.window.showWarningMessage(
          'Snapds: No components indexed. Register a package in Snapds Settings first.',
        );
        return;
      }

      const qp = vscode.window.createQuickPick<ComponentQuickPickItem>();
      qp.placeholder = 'Search components… (e.g. "Button", "Card")';
      qp.matchOnDescription = true;
      qp.matchOnDetail = true;

      qp.items = components.map((meta) => {
        const pkg = meta.id.split('#')[0];
        const configured = store.getConfiguredProps(meta.id) ?? {};
        const snippet = generateJSX(meta, configured);
        return {
          label: meta.name,
          description: pkg,
          detail: snippetPreview(snippet),
          componentId: meta.id,
        };
      });

      qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0];
        qp.hide();
        if (!selected) return;
        await injectComponent(selected.componentId, store, editor);
      });

      ctx.subscriptions.push(qp);
      qp.show();
    }),
  );
}
