import type { ReactNode } from 'react';

interface AccordionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  headerAccessory?: ReactNode;
}

/** A minimal collapsible section styled with VS Code theme variables. */
export function Accordion({ title, open, onToggle, children, headerAccessory }: AccordionProps) {
  return (
    <section
      style={{
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 4,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <div
        className="accordion-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--vscode-editor-inactiveSelectionBackground)',
        }}
      >
        <button
          type="button"
          className="accordion-toggle"
          aria-expanded={open}
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden="true"
            className="accordion-twisty"
            style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ▶
          </span>
          <h3 style={{ margin: 0, flex: 1, fontSize: 14 }}>{title}</h3>
        </button>
        {headerAccessory}
      </div>
      {open && <div style={{ padding: 12 }}>{children}</div>}
    </section>
  );
}
