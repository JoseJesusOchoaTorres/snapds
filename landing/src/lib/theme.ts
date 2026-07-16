/**
 * Minimal theme controller that mirrors the `next-themes` conventions used by
 * `nextra-theme-docs` (attribute `class`, storageKey `theme`, default
 * `system`). Sharing the same storage key and the same `light`/`dark` class on
 * `<html>` is what keeps the landing page and the /docs pages synchronized:
 * whichever page writes the preference, the other reads it on next load.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

/** Must match `nextra-theme-docs` (`storageKey` default). */
export const THEME_KEY = 'theme';

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function resolveDark(choice: ThemeChoice): boolean {
  return choice === 'dark' || (choice === 'system' && systemPrefersDark());
}

/** Apply the resolved theme to <html> exactly like next-themes does. */
export function applyTheme(choice: ThemeChoice): void {
  const dark = resolveDark(choice);
  const el = document.documentElement;
  el.classList.remove('light', 'dark');
  el.classList.add(dark ? 'dark' : 'light');
  el.style.colorScheme = dark ? 'dark' : 'light';
}

export function getStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  const value = window.localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function setStoredTheme(choice: ThemeChoice): void {
  window.localStorage.setItem(THEME_KEY, choice);
  applyTheme(choice);
}
