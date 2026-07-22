import { type ReactNode, useRef } from 'react';
import { Icon, type IconName } from './Icon';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  panel: ReactNode;
  /** Primary action buttons for this tab, rendered in the shared action bar. */
  actions?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

/** Accessible tablist with roving tabindex + Left/Right/Home/End arrow navigation. */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const idx = tabs.findIndex((t) => t.id === active);
  const current = tabs[idx];

  const focusTab = (i: number) => {
    const t = tabs[(i + tabs.length) % tabs.length];
    onChange(t.id);
    refs.current[t.id]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab(idx + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab(idx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div>
      <div className="tablist" role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              type="button"
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className="tab"
              onClick={() => onChange(t.id)}
            >
              {t.icon && <Icon name={t.icon} />}
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`tabpanel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
        >
          {t.id === active && t.panel}
        </div>
      ))}
      {current?.actions && <div className="action-bar">{current.actions}</div>}
    </div>
  );
}
