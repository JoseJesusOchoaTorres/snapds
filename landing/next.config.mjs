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
});
