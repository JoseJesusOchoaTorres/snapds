import { LINKS, NAV_LINKS, TECH } from '../content';
import { Logo } from './icons';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <a className="brand" href="#top" aria-label="Snapds home">
              <Logo className="brand__logo" />
              <span>Snapds</span>
            </a>
            <p className="footer__brandtext">
              Your design system, inside VS Code. Browse components, drop ready-to-use JSX, and
              export agent-ready skills.
            </p>
          </div>

          <div className="footer__col">
            <h4>Product</h4>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="footer__col">
            <h4>Resources</h4>
            <a href={LINKS.marketplace} target="_blank" rel="noreferrer">
              Marketplace
            </a>
            <a href={LINKS.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={LINKS.issues} target="_blank" rel="noreferrer">
              Issues
            </a>
            <a href={LINKS.changelog} target="_blank" rel="noreferrer">
              Changelog
            </a>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Snapds</span>
          <span>Built with {TECH.join(', ')}</span>
        </div>
      </div>
    </footer>
  );
}
