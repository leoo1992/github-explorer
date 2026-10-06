import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RepoScope | GitHub Engineering Intelligence',
  description:
    'Analise repositórios e portfólios públicos do GitHub com sinais de arquitetura, stack, qualidade e maturidade de engenharia para recrutamento e liderança técnica.',
  applicationName: 'RepoScope',
  authors: [{ name: 'Leonardo Santos Custódio' }],
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
