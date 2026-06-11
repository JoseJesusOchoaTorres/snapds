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

export type ToGallery =
  | { type: 'componentList'; components: ComponentMeta[] };
