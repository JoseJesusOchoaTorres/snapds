import type { ReactNode } from 'react';

interface AccordionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  headerAccessory?: ReactNode;
}

export function Accordion({ title, open, onToggle, children, headerAccessory }: AccordionProps) {
  return (
    <section className="accordion">
      <div className="accordion-header">
        <h3 className="accordion-title">
          <button
            type="button"
            className="accordion-toggle"
            aria-expanded={open}
            onClick={onToggle}
          >
            <span aria-hidden="true" className={`accordion-twisty${open ? ' open' : ''}`}>
              ▶
            </span>
            {title}
          </button>
        </h3>
        {headerAccessory}
      </div>
      {open && <div className="accordion-body">{children}</div>}
    </section>
  );
}
