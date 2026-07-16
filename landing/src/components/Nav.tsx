'use client';

import { useEffect, useState } from 'react';
import { LINKS, NAV_LINKS } from '../content';
import { ThemeToggle } from './ThemeToggle';
import { GitHub, Logo, Menu } from './icons';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={scrolled ? 'nav is-scrolled' : 'nav'}>
      <div className="container nav__inner">
        <a className="brand" href="#top" aria-label="Snapds home">
          <Logo className="brand__logo" />
          <span>Snapds</span>
        </a>

        <nav className="nav__links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} className="nav__link" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="nav__actions">
          <ThemeToggle />
          <a className="btn btn--ghost" href={LINKS.github} target="_blank" rel="noreferrer">
            <GitHub size={18} />
            GitHub
          </a>
          <a className="btn btn--primary" href={LINKS.marketplace} target="_blank" rel="noreferrer">
            Get the extension
          </a>
          <button
            type="button"
            className="nav__toggle"
            aria-expanded={open}
            aria-controls="nav-mobile"
            aria-label="Toggle navigation menu"
            onClick={() => setOpen((value) => !value)}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="nav__mobile" id="nav-mobile">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href={LINKS.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      )}
    </header>
  );
}
