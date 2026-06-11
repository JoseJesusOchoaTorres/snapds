import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

export type WebviewApp = 'gallery' | 'props' | 'settings';

export function getWebviewHtml(
  webview: vscode.Webview,
  ctx: vscode.ExtensionContext,
  app: WebviewApp,
): string {
  const root = vscode.Uri.joinPath(ctx.extensionUri, 'media', app);
  const indexPath = path.join(root.fsPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return `<!doctype html><html><body><p>Webview assets missing for "${app}". Run the build.</p></body></html>`;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  const nonce = randomBytes(16).toString('base64');

  // Rewrite relative URLs (./assets/...) to vscode-webview-resource:// URIs.
  html = html.replace(/(src|href)="\.?\/?(assets\/[^"]+)"/g, (_m, attr, p) => {
    const uri = webview.asWebviewUri(vscode.Uri.joinPath(root, p));
    return `${attr}="${uri}"`;
  });

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  html = html.replace(/<script /g, `<script nonce="${nonce}" `);
  return html;
}

export function webviewResourceRoots(
  ctx: vscode.ExtensionContext,
  app: WebviewApp,
): vscode.Uri[] {
  return [vscode.Uri.joinPath(ctx.extensionUri, 'media', app)];
}
