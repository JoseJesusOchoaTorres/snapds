import type { SnippetDraft, SnippetSaveResult } from '@snapds/webview-shared';

export type { SnippetDraft, SnippetSaveResult };

/** host → webview */
export type ToSnippet = { type: 'draft'; draft: SnippetDraft };

/** webview → host */
export type FromSnippet =
  | { type: 'ready' }
  | { type: 'save'; result: SnippetSaveResult }
  | { type: 'cancel' };
