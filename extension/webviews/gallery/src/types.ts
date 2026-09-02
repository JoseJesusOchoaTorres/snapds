import type { ComponentMeta, CustomSnippet, PropMeta } from '@snapds/webview-shared';

export type { ComponentMeta, CustomSnippet, PropMeta };

export type FromGallery =
  | { type: 'ready' }
  | { type: 'componentSelected'; componentId: string }
  | { type: 'search'; query: string }
  | { type: 'snippetSelected'; snippetId: string }
  | { type: 'editSnippet'; snippetId: string }
  | { type: 'deleteSnippet'; snippetId: string };

export type ToGallery =
  | { type: 'componentList'; components: ComponentMeta[] }
  | { type: 'snippetList'; snippets: CustomSnippet[] }
  | { type: 'indexing'; packages: string[] }
  | { type: 'indexingProgress'; done: number; total: number; pkg: string }
  | { type: 'switchTab'; tab: 'components' | 'snippets' }
  | { type: 'focusSearch' };
