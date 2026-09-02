import { emitImport } from '../ds/codegen';
import { analyzeSelectionImports, parseImportsToSpecs } from '../ds/importScanner';
import { newSnippetId } from '../state/snippetStore';
import type { CustomSnippet, SnippetSaveResult } from '../util/messaging';

/** Editor languages snippets can be captured from and injected into (v1). */
export const SNIPPET_LANGUAGES = ['javascriptreact', 'typescriptreact'];

export function isSnippetLanguage(languageId: string): boolean {
  return SNIPPET_LANGUAGES.includes(languageId);
}

/**
 * Auto-detects the import statements a selection depends on, rendered as
 * human-readable lines for the capture modal to pre-fill and let the user
 * confirm or edit.
 */
export function detectImportLines(fileText: string, selectionText: string): string[] {
  return analyzeSelectionImports(fileText, selectionText).map(emitImport);
}

/**
 * Turns the modal's save result into a stored `CustomSnippet`, re-parsing the
 * (possibly edited) import lines into structured specs. A new id is minted when
 * capturing; on edit the caller passes the original id (via `result.id`) and its
 * original `createdAt` so ordering stays stable.
 */
export function resultToSnippet(
  result: SnippetSaveResult,
  meta: { languageId: string; createdAt: string },
): CustomSnippet {
  return {
    id: result.id ?? newSnippetId(),
    name: result.name.trim(),
    description: result.description.trim() || undefined,
    category: result.category.trim() || undefined,
    code: result.code,
    imports: parseImportsToSpecs(result.importLines.join('\n')),
    languageId: meta.languageId,
    scope: result.scope,
    createdAt: meta.createdAt,
  };
}
