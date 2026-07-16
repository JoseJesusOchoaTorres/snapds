'use client';

import { useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  THEME_KEY,
  type ThemeChoice,
} from '../lib/theme';
import { Moon, Monitor, Sun } from './icons';

type Option = { value: ThemeChoice; label: string; Icon: typeof Sun };

const OPTIONS: Option[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [mounted, setMounted] = useState(false);

  // Read the persisted preference only after mount to avoid a hydration
  // mismatch (the server has no access to localStorage).
  useEffect(() => {
    setMounted(true);
    setChoice(getStoredTheme());
  }, []);

  // Follow OS changes while in `system` mode, and react to changes made on
  // other tabs / the /docs pages (both write the same `theme` key).
  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      const next = getStoredTheme();
      setChoice(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onSystem);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onStorage);
    };
  }, [mounted]);

  const pick = (value: ThemeChoice) => {
    setChoice(value);
    setStoredTheme(value);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && choice === value;
        return (
          <button
            key={value}
            type="button"
            className={active ? 'theme-toggle__btn is-active' : 'theme-toggle__btn'}
            aria-pressed={mounted ? active : undefined}
            aria-label={label}
            title={label}
            onClick={() => pick(value)}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
