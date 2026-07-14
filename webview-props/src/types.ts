import type { ComponentMeta, PropMeta } from '@snapds/webview-shared';

export type { ComponentMeta, PropMeta };

export type FromProps =
  | { type: 'ready' }
  | { type: 'propsUpdated'; componentId: string; props: Record<string, unknown> };

export type ToProps =
  | { type: 'componentSchema'; component: ComponentMeta }
  | { type: 'restoreProps'; props: Record<string, unknown> };
