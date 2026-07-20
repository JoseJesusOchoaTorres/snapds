import type { ComponentMeta, PropMeta } from '@snapds/webview-shared';

export type { ComponentMeta, PropMeta };

export type FromGallery =
  | { type: 'ready' }
  | { type: 'componentSelected'; componentId: string }
  | { type: 'search'; query: string };

export type ToGallery = { type: 'componentList'; components: ComponentMeta[] };
