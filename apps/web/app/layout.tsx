import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'ValletControl — Controle financeiro pessoal',
    template: '%s · ValletControl',
  },
  description: 'Controle financeiro pessoal — resumo mensal, categorias e recorrências.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
