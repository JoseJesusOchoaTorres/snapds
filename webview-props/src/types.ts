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

export type FromProps =
  | { type: 'ready' }
  | { type: 'propsUpdated'; componentId: string; props: Record<string, unknown> };

export type ToProps =
  | { type: 'componentSchema'; component: ComponentMeta }
  | { type: 'restoreProps'; props: Record<string, unknown> };
