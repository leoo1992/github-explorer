import type { Metadata, Viewport } from 'next';
import { ThemeToggle } from '@/components/theme-toggle';
import './globals.css';
import './paid-overrides.css';
import './theme.css';

export const metadata: Metadata = {
  title: 'RepoScope | GitHub Engineering Intelligence',
  description:
    'Avalie repositórios públicos do GitHub com evidências de arquitetura, stack, qualidade e maturidade de engenharia.',
  applicationName: 'RepoScope',
  keywords: [
    'GitHub analysis',
    'technical recruiting',
    'engineering intelligence',
    'repository quality',
    'software architecture',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#12161e',
};

const themeBootScript = `
(function () {
  try {
    var stored;
    try { stored = localStorage.getItem('reposcope.theme'); } catch (_) {}
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f6f8' : '#12161e');
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
