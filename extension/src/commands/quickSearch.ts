import * as vscode from 'vscode';
import { generateJSX } from '../ds/codegen';
import type { Store } from '../state/store';
import { injectComponent, injectSnippet } from '../util/injectComponent';
import type { CustomSnippet } from '../util/messaging';

type QuickItem = vscode.QuickPickItem & { componentId?: string; snippetId?: string };

/** Resolver for the custom snippets shown in the second section of the picker. */
export interface SnippetSource {
  list: () => CustomSnippet[];
  get: (id: string) => CustomSnippet | undefined;
}

function snippetPreview(snippet: string): string {
  return snippet
    .split('\n')[0]
    .replace(/\$\{[^}]+\}/g, '…')
    .replace(/\$\d+/g, '…');
}

function separator(label: string): QuickItem {
  return { label, kind: vscode.QuickPickItemKind.Separator };
}

export function registerQuickSearch(
  ctx: vscode.ExtensionContext,
  store: Store,
  snippets: SnippetSource,
): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('snapds.quickSearch', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Snapds: Open a React file to use Quick Search.');
        return;
      }

      const components = store.listComponents();
      const customSnippets = snippets.list();
      if (components.length === 0 && customSnippets.length === 0) {
        vscode.window.showWarningMessage(
          'Snapds: Nothing to insert yet. Register a package or save a snippet first.',
        );
        return;
      }

      const items: QuickItem[] = [];

      if (components.length > 0) {
        items.push(separator('Components'));
        for (const meta of components) {
          const pkg = meta.id.split('#')[0];
          const configured = store.getConfiguredProps(meta.id) ?? {};
          items.push({
            label: meta.name,
            description: pkg,
            detail: snippetPreview(generateJSX(meta, configured)),
            componentId: meta.id,
          });
        }
      }

      if (customSnippets.length > 0) {
        items.push(separator('Custom Snippets'));
        for (const snip of customSnippets) {
          items.push({
            label: snip.name,
            description: `$(bookmark) ${snip.category ?? 'Uncategorized'}${snip.scope === 'shared' ? ' · shared' : ''}`,
            detail: snippetPreview(snip.code),
            snippetId: snip.id,
          });
        }
      }

      const qp = vscode.window.createQuickPick<QuickItem>();
      qp.placeholder = 'Search components and custom snippets…';
      qp.matchOnDescription = true;
      qp.matchOnDetail = true;
      qp.items = items;

      qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0];
        qp.hide();
        if (!selected) return;
        if (selected.componentId) {
          await injectComponent(selected.componentId, store, editor);
        } else if (selected.snippetId) {
          const snip = snippets.get(selected.snippetId);
          if (snip) await injectSnippet(snip, editor);
        }
      });

      ctx.subscriptions.push(qp);
      qp.show();
    }),
  );
}
