// Fixture for exportsScan tests. Mirrors a typography-style package where some
// components are plain forward-ref values and others are polymorphic generic
// call signatures (which react-docgen-typescript fails to detect).

export interface TextProps {
  size?: string;
}

/** A normal forward-ref style component value export. */
export declare const Keyboard: (props: TextProps) => unknown;

/**
 * A polymorphic component declared as a generic call signature. This is the
 * shape that docgen misses but the compiler-API scan must still surface.
 */
export declare const Text: <C = unknown>(props: TextProps & { as?: C }) => unknown;

// A type-only export: must be skipped by enumerateComponentExports.
export type Variant = 'a' | 'b';

// A lowercase value export: must be skipped (not a component).
export declare const helper: () => void;
