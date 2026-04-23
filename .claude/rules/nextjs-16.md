# Next.js 16 — "not the Next.js you know"

> Versão 16.2.4 com Turbopack por padrão. Várias APIs mudaram. **Ler `node_modules/next/dist/docs/` antes de escrever código** quando houver qualquer dúvida.

## Convenções do projeto

- **App Router only** (sem Pages Router). Todas as rotas em `src/app/`.
- **Turbopack** em dev e build (configurado em `next.config.ts`).
- Rotas autenticadas em `src/app/(app)/` — todas devem declarar:
  ```ts
  export const dynamic = 'force-dynamic';
  ```
  Porque leem `sessionStorage` em runtime e não podem ser pre-renderizadas.
- Maioria de `src/app/(app)/**/page.tsx` é client component (`'use client'` no topo).

## APIs que mudaram

- `cookies()`, `headers()`, `draftMode()` agora são **async** (retornam Promise). Sempre `await`.
- `params` e `searchParams` em `page.tsx` e `layout.tsx` também são Promise.
- `useRouter` de `next/navigation` — não `next/router`.
- `Link` não precisa mais de `<a>` child.

## Metadata

- `generateMetadata()` pode ser async e lê `params` via Promise.
- Metadata estática via `export const metadata = { ... }`.

## Sentry integration

- Inicialização em `instrumentation.ts` e `sentry.*.config.ts`.
- Não quebrar o wiring em `next.config.ts` (`withSentryConfig`).

## Antes de gerar código

1. A API existe no Next 16? Checar `node_modules/next/dist/docs/`.
2. Heed deprecation notices — se o doc diz "deprecated", não use.
3. Em dúvida, perguntar ao usuário antes de inventar.
