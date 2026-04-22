import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import {
  LEGAL_LAST_UPDATED,
  PrivacyBody,
} from '@/features/auth/legal-content';

const PAGE_TITLE = 'Política de Privacidade — AlertPort';
const PAGE_DESCRIPTION =
  'Política de Privacidade da AlertPort: como coletamos, utilizamos, armazenamos e protegemos dados pessoais em conformidade com a LGPD.';

function getCanonicalUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_PUBLIC_URL;
  if (!base) return undefined;
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/privacy`;
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

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen bg-app-gradient overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl p-6 sm:p-10 shadow-[0_0_80px_rgba(179,38,30,0.08)]">
          {/* Header */}
          <header className="mb-8 flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                Política de Privacidade
              </h1>
              <p className="text-sm text-text-secondary">
                Como a AlertPort trata seus dados pessoais em conformidade com a LGPD.
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                Última atualização: {LEGAL_LAST_UPDATED}
              </p>
            </div>
          </header>

          <article className="prose-legal">
            <PrivacyBody />
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
              href="/terms"
              className="text-text-muted transition-colors hover:text-white hover:underline underline-offset-2"
            >
              Termos de Uso
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
