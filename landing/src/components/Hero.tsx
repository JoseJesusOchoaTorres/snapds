import { LINKS, NAV_LINKS } from '../content';
import { EditorMock } from './EditorMock';
import { ArrowRight } from './icons';

export function Hero() {
  return (
    <section className="hero section--vlines" id="top">
      <div className="container hero__grid">
        <div>
          <span className="badge">
            <span className="badge__dot" /> For React + TypeScript teams
          </span>
          <h1 className="hero__title">
            Your design system, <span className="gradient-text">inside VS Code</span>
          </h1>
          <p className="hero__lead">
            Snapds turns any React component package into a visual gallery. Browse components, drop
            them as ready-to-use JSX with imports handled for you, and export agent-ready skills —
            without leaving your editor.
          </p>
          <div className="hero__cta">
            <a
              className="btn btn--primary btn--lg"
              href={LINKS.marketplace}
              target="_blank"
              rel="noreferrer"
            >
              Get the extension <ArrowRight size={18} />
            </a>
            <a className="btn btn--ghost btn--lg" href={NAV_LINKS[4].href} rel="noreferrer">
              Documentation
            </a>
          </div>
          <ul className="hero__meta">
            <li>Zero runtime dependencies</li>
            <li>Built for monorepos</li>
            <li>VS Code 1.85+</li>
          </ul>
        </div>

        <EditorMock />
      </div>
    </section>
  );
}
