import { FEATURES } from '../content';
import { Icon } from './icons';

export function Features() {
  return (
    <section id="features" className="section">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">Features</p>
          <h2 className="section__title">Everything you need to ship from your design system</h2>
          <p className="section__lead">
            Snapds meets you where you already work — inside the editor — and removes the busywork
            between picking a component and running your app.
          </p>
        </div>

        <div className="features">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className={feature.wide ? 'feature feature--wide' : 'feature'}
            >
              <div className="feature__icon">
                <Icon name={feature.icon} />
              </div>
              <h3 className="feature__title">{feature.title}</h3>
              <p className="feature__desc">{feature.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
