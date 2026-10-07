'use client';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem('reposcope.theme', theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#070a12');
}

export function ThemeToggle() {
  function toggleTheme() {
    const current: Theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Alternar tema claro e escuro"
      title="Alternar tema claro e escuro"
    >
      <span className="theme-toggle-icon" aria-hidden="true">◐</span>
    </button>
  );
}
