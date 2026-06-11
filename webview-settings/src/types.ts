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

export type FromSettings =
  | { type: 'ready' }
  | { type: 'savePackages'; packages: { name: string; blacklist: string[] }[] };

export interface PackageMeta {
  name: string;
  enabled: boolean;
  blacklist?: string[];
}

export type ToSettings =
  | { type: 'packageList'; packages: PackageMeta[] }
  | { type: 'saving' }
  | { type: 'saved' };
