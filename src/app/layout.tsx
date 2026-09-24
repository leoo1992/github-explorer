import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RepoScope | GitHub Architecture Explorer',
  description:
    'Explore arquitetura, tecnologias, qualidade e estrutura de repositórios públicos do GitHub.',
  applicationName: 'RepoScope',
  authors: [{ name: 'Leonardo Santos Custódio' }],
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
