import { Fragment, type ReactNode } from 'react';
import { FAQS } from '../content';
import { ChevronDown } from './icons';

function withCode(text: string): ReactNode {
  return text.split('`').map((part, index) => {
    const isCode = index % 2 === 1;
    const key = `${isCode ? 'code' : 'text'}:${part}`;
    return isCode ? <code key={key}>{part}</code> : <Fragment key={key}>{part}</Fragment>;
  });
}

export function Faq() {
  return (
    <section id="faq" className="section section--ruled">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">FAQ</p>
          <h2 className="section__title">Questions, answered</h2>
        </div>

        <div className="faq">
          {FAQS.map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <ChevronDown className="chev" size={18} />
              </summary>
              <p className="faq__answer">{withCode(item.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
