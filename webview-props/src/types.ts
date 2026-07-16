import type { ComponentMeta, PropMeta } from '@snapds/webview-shared';

export type { ComponentMeta, PropMeta };

export type FromProps =
  | { type: 'ready' }
  | { type: 'propsUpdated'; componentId: string; props: Record<string, unknown> }
  | { type: 'switchVersion'; pkg: string; version: string }
  | { type: 'addToPackageJson'; pkg: string; version: string };

export type ToProps =
  | { type: 'componentSchema'; component: ComponentMeta }
  | { type: 'restoreProps'; props: Record<string, unknown> }
  | {
      type: 'versionsAvailable';
      pkg: string;
      versions: string[];
      activeVersion: string;
      isAutoResolved: boolean;
      inPackageJson: boolean;
      hasFileContext: boolean;
      resolvedFrom?: string;
    };
