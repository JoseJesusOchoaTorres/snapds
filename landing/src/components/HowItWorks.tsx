import { STEPS } from '../content';

export function HowItWorks() {
  return (
    <section id="how" className="section">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">How it works</p>
          <h2 className="section__title">From package to production JSX in four steps</h2>
          <p className="section__lead">
            No config to learn up front. Register a package and Snapds handles the introspection for
            you.
          </p>
        </div>

        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="step">
              <span className="step__num">{index + 1}</span>
              <h3 className="step__title">{step.title}</h3>
              <p className="step__desc">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
