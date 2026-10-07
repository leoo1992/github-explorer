'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const themeEvent = 'reposcope:theme';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', theme === 'light' ? '#f5f6f8' : '#12161e',
  );
  window.dispatchEvent(new Event(themeEvent));
}

function subscribe(onChange: () => void) {
  function syncStorage(event: StorageEvent) {
    if (event.key !== 'reposcope.theme' && event.key !== null) return;
    const theme = event.newValue === 'light' || event.newValue === 'dark'
      ? event.newValue
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(theme);
  }
  window.addEventListener(themeEvent, onChange);
  window.addEventListener('storage', syncStorage);
  return () => {
    window.removeEventListener(themeEvent, onChange);
    window.removeEventListener('storage', syncStorage);
  };
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light');

  function changeTheme(dark: boolean) {
    const next = dark ? 'dark' : 'light';
    applyTheme(next);
    try {
      localStorage.setItem('reposcope.theme', next);
    } catch {
      // Theme changes remain usable when the browser blocks local storage.
    }
  }

  return (
    <label className="btn btn-ghost btn-square swap swap-rotate theme-toggle" title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
      <input
        type="checkbox"
        className="theme-controller"
        value="dark"
        aria-label="Tema escuro"
        checked={theme === 'dark'}
        onChange={(event) => changeTheme(event.target.checked)}
      />
      <span className="swap-on" aria-hidden="true"><Moon /></span>
      <span className="swap-off" aria-hidden="true"><Sun /></span>
    </label>
  );
}
