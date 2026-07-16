import type { Metadata } from 'next';
import { Head } from 'nextra/components';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'Snapds — your design system, inside VS Code',
    template: '%s — Snapds',
  },
  description:
    'Snapds turns any React component package into a visual gallery inside VS Code. Explore components, drop them as ready-to-use JSX with imports handled for you, and export agent-ready skills.',
  openGraph: {
    title: 'Snapds — your design system, inside VS Code',
    description:
      'Browse React components visually, drag-and-drop JSX with imports handled automatically, and generate agent-ready skills — without leaving your editor.',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

// Applied before paint so the landing never flashes the wrong theme. Uses the
// same `theme` storage key + `light`/`dark` class as `nextra-theme-docs`, so
// the preference stays in sync between the landing and the /docs pages.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;c.remove('light','dark');c.add(d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head
        color={{ hue: 218, saturation: 100, lightness: { dark: 70, light: 55 } }}
        backgroundColor={{ dark: '#08090d', light: '#ffffff' }}
      />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
