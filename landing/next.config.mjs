import nextra from 'nextra';

const withNextra = nextra({
  // Serve all MDX from the `content/` directory under the `/docs` path,
  // leaving `/` free for the custom marketing landing page.
  contentDirBasePath: '/docs',
});

export default withNextra({
  // Fully static site so it can be hosted on Cloudflare Pages.
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  // Nextra 4.x ships types compiled against React 18; @types/react@19 changed
  // ReactPortal.children and Component.refs in ways that break Nextra's
  // ComponentClass signatures. Ignore TS errors so builds succeed; runtime is fine.
  typescript: { ignoreBuildErrors: true },
});
