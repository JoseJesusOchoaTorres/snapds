import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { getPageMap } from 'nextra/page-map';
import type { ReactNode } from 'react';
import { Logo } from '../../src/components/icons';
import 'nextra-theme-docs/style.css';

const REPO = 'https://github.com/JoseJesusOchoaTorres/snapds';
const MARKETPLACE = 'https://marketplace.visualstudio.com/search?term=snapds&target=VSCode';

const logo = (
  <span
    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, letterSpacing: '-0.01em' }}
  >
    <Logo size={22} />
    Snapds
  </span>
);

const navbar = (
  <Navbar logo={logo} projectLink={REPO}>
    <a
      href={MARKETPLACE}
      target="_blank"
      rel="noreferrer"
      style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap' }}
    >
      Marketplace
    </a>
  </Navbar>
);

const footer = (
  <Footer>
    <span>© {new Date().getFullYear()} Snapds</span>
  </Footer>
);

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap('/docs');
  return (
    <Layout
      navbar={navbar}
      footer={footer}
      pageMap={pageMap}
      docsRepositoryBase={`${REPO}/tree/main/landing`}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
    >
      {children}
    </Layout>
  );
}
