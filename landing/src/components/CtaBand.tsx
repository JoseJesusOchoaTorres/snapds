import { LINKS } from '../content'
import { ArrowRight, GitHub } from './icons'

export function CtaBand() {
  return (
    <section className="section section--ruled">
      <div className="container">
        <div className="cta">
          <h2 className="gradient-text">
            Bring your design system into every file
          </h2>
          <p>
            Install Snapds, register a package, and start dropping
            production-ready components in minutes.
          </p>
          <div className="cta__actions">
            <a
              className="btn btn--primary btn--lg"
              href={LINKS.marketplace}
              target="_blank"
              rel="noreferrer"
            >
              Get the extension <ArrowRight size={18} />
            </a>
            <a
              className="btn btn--ghost btn--lg"
              href={LINKS.github}
              target="_blank"
              rel="noreferrer"
            >
              <GitHub size={18} /> Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
