import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale } from 'lucide-react';
import {
  LEGAL_LAST_UPDATED,
  TermsBody,
} from '@/features/auth/legal-content';

const PAGE_TITLE = 'Termos de Uso — AlertPort';
const PAGE_DESCRIPTION =
  'Termos de Uso da plataforma AlertPort: regras de cadastro, licença, responsabilidades, pagamentos e lei aplicável.';

function getCanonicalUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_PUBLIC_URL;
  if (!base) return undefined;
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/terms`;
}

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: (() => {
    const canonical = getCanonicalUrl();
    return canonical ? { canonical } : undefined;
  })(),
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: 'article',
    url: getCanonicalUrl(),
  },
};

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-app-gradient overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl p-6 sm:p-10 shadow-[0_0_80px_rgba(179,38,30,0.08)]">
          {/* Header */}
          <header className="mb-8 flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/30">
              <Scale className="h-5 w-5 text-brand-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                Termos de Uso
              </h1>
              <p className="text-sm text-text-secondary">
                Condições que regulam o acesso e a utilização da plataforma AlertPort.
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Última atualização: {LEGAL_LAST_UPDATED}
              </p>
            </div>
          </header>

          <article className="prose-legal">
            <TermsBody />
          </article>

          {/* Footer */}
          <footer className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="text-text-muted transition-colors hover:text-white hover:underline underline-offset-2"
            >
              ← Voltar para o início
            </Link>
            <Link
              href="/privacy"
              className="text-text-muted transition-colors hover:text-white hover:underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
          </footer>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          © {new Date().getFullYear()} AlertPort
        </p>
      </main>
    </div>
  );
}
