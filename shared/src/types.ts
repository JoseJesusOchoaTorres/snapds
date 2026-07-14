/**
 * Component metadata shared by every webview. These mirror the extension's
 * messaging shapes for the fields the UIs consume; per-webview message-protocol
 * unions live in each webview's own `types.ts`.
 */
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
