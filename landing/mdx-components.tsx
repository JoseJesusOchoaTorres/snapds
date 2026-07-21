import { Callout, Cards, FileTree, Steps, Tabs } from 'nextra/components';
import type { MDXComponents } from 'nextra/mdx-components';
import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';

const themeComponents = getThemeComponents();

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...themeComponents,
    Callout,
    Cards,
    FileTree,
    Steps,
    Tabs,
    ...components,
  };
}
