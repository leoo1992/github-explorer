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
  themeColor: '#070a12',
};

const themeBootScript = `
(function () {
  try {
    var stored = localStorage.getItem('reposcope.theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#070a12');
  } catch (_) {
    document.documentElement.dataset.theme = 'dark';
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
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
