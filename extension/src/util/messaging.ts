export interface PropMeta {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'enum' | 'function' | 'ReactNode' | string;
  raw: string;
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  enumValues?: string[];
}

export interface ComponentMeta {
  id: string;
  name: string;
  description?: string;
  props: PropMeta[];
  snippet?: string;
}

export type FromGallery =
  | { type: 'ready' }
  | { type: 'componentSelected'; componentId: string }
  | { type: 'search'; query: string };

export type FromProps =
  | { type: 'ready' }
  | { type: 'propsUpdated'; componentId: string; props: Record<string, unknown> };

export type FromSettings =
  | { type: 'ready' }
  | { type: 'savePackages'; packages: { name: string; blacklist: string[] }[] };

export type ToGallery =
  | { type: 'componentList'; components: ComponentMeta[] };

export type ToProps =
  | { type: 'componentSchema'; component: ComponentMeta }
  | { type: 'restoreProps'; props: Record<string, unknown> };

export interface PackageMeta {
  name: string;
  enabled: boolean;
  blacklist?: string[];
}

export type ToSettings =
  | { type: 'packageList'; packages: PackageMeta[] }
  | { type: 'saving' }
  | { type: 'saved' };

export const DRAG_MIME = 'application/vnd.code.tree.snapds.component';
