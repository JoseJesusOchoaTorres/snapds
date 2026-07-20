import { SKILL_ITEMS } from '../content';
import { Icon } from './icons';

export function Skills() {
  return (
    <section id="skills" className="section section--ruled">
      <div className="container">
        <div className="skills__grid">
          <div>
            <p className="eyebrow">Agent-ready skills</p>
            <h2 className="section__title">Teach your coding agent your design system</h2>
            <p className="section__lead">
              Snapds exports a compact dictionary plus on-demand detail, so assistants use your
              components correctly — without re-reading source or burning context tokens.
            </p>

            <div className="skills__list">
              {SKILL_ITEMS.map((item) => (
                <div key={item.title} className="skills__item">
                  <Icon name={item.icon} size={22} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="codecard" aria-hidden="true">
            <div className="codecard__bar">
              <Icon name="folder" size={14} /> .augment/skills
            </div>
            <pre className="codecard__body">
              {`.augment/skills/
└─ acme-ui/
   ├─ SKILL.md          # dictionary index
   ├─ button/SKILL.md
   ├─ card/SKILL.md
   └─ badge/SKILL.md

AGENTS.md               # assistant-agnostic`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
