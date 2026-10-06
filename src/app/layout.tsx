import type { Metadata, Viewport } from 'next';
import './globals.css';
import './paid-overrides.css';

export const metadata: Metadata = {
  title: 'RepoScope | GitHub Engineering Intelligence',
  description:
    'Avalie repositórios e portfólios públicos do GitHub com evidências de arquitetura, stack, qualidade e maturidade de engenharia.',
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
