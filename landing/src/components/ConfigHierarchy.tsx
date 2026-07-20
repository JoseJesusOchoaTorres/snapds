import { Fragment, type ReactNode } from 'react';
import { CONFIG_LEVELS } from '../content';

function withCode(text: string): ReactNode {
  return text.split('`').map((part, index) => {
    const isCode = index % 2 === 1;
    const key = `${isCode ? 'code' : 'text'}:${part}`;
    return isCode ? <code key={key}>{part}</code> : <Fragment key={key}>{part}</Fragment>;
  });
}

export function ConfigHierarchy() {
  return (
    <section className="section section--ruled">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">Configuration</p>
          <h2 className="section__title">Sensible defaults, with overrides when you need them</h2>
          <p className="section__lead">
            Three layers, each optional. Start with zero config and add structure only when your
            team needs it.
          </p>
        </div>

        <div className="config">
          {CONFIG_LEVELS.map((level) => (
            <div key={level.tag} className="level">
              <span className="level__tag">{level.tag}</span>
              <h3 className="level__title">{level.title}</h3>
              <p className="level__desc">{withCode(level.desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
