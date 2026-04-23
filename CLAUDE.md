@AGENTS.md
@.claude/rules/api-contracts.md
@.claude/rules/forms.md
@.claude/rules/i18n.md
@.claude/rules/nextjs-16.md
@.claude/rules/features.md

# CLAUDE.md — AlertPort Admin Web

> Instruções, não documentação. Leia em uma respiração.

## Context

- **Projeto**: Painel administrativo do AlertPort. Extraído do legado `shieldgo-admin-web` e reescrito em stack moderna.
- **Invariante dura**: contratos de backend são **imutáveis**. Esta app espelha o wire format legado — nenhuma mudança de payload, endpoint ou header.
- **Stack**: Next.js 16.2.4 App Router + Turbopack · React 19.2.4 · TS strict · Tailwind v4 (`@theme`) · TanStack Query v5 · RHF + Zod (via `useAppForm`) · next-intl v4 (pt/en/es/ja/zh) · Axios com interceptors · Radix UI · Vitest + Playwright · Sentry · Firebase (Firestore push) · Socket.IO.
- **14 feature modules**: `alerts, auth, bulk-import, calls, clients, collaborators, company, dashboard, equipment, modules, onboarding, reports, shared, sites, users`.
- **6 roles**: `SUPER_ADMIN_MASTER, ADMIN_MASTER, ADMIN, MANAGER, OPERATOR, AUDITOR`.
- **5 locales**: pt (canônica) · en · es · ja · zh.
- **Runtime**: Node ≥ 22 (`.nvmrc`). Portão de validação: `npm run validate`.

## How I Work

- Nunca alterar shape de payload, path de endpoint ou o `skip` 1-indexed. Ver `src/config/endpoints.ts` e `src/hooks/use-pagination.ts`.
- Todo formulário passa por `useAppForm` (`@/hooks/use-app-form`). ESLint bloqueia `useForm` cru.
- Estado: server → TanStack Query · session → `sessionStorage` + `useSyncExternalStore` · UI → `useState` · URL → `nuqs`.
- Rotas em `src/app/(app)/` são autenticadas e devem ser `force-dynamic` (leem sessionStorage em runtime).
- Nomes: pastas kebab-case · identificadores camelCase · componentes PascalCase.
- i18n: adicionar/renomear chave = editar os 5 arquivos de `src/messages/`. pt é canônica.
- Antes de escrever código Next.js, consultar `node_modules/next/dist/docs/` — a versão 16 tem breaking changes vs. treino.
- Plan first em tarefas que tocam contratos, auth ou i18n.

## Playbooks

### Novo endpoint
1. Declarar em `src/config/endpoints.ts` (sem Bearer; POST p/ filtros; `skip` 1-indexed).
2. Método tipado em `src/services/<domínio>.service.ts` usando `apiClient` de `src/lib/api-client.ts`.
3. Tipos em `src/types/api.ts`.
4. Schema Zod em `src/features/<domínio>/schemas.ts` se precisar validar.
5. Hook TanStack Query em `src/features/<domínio>/use-<coisa>.ts` (convenção de query key existente).
6. Invalidação via `src/lib/query-invalidation.ts`.
7. Stub de contract test em `tests/contracts/`.

### Nova rota protegida
1. `src/app/(app)/<rota>/page.tsx` — client component + `export const dynamic = 'force-dynamic'`.
2. Envolver em `<RoleGuard roles={[...]}>` (`src/components/shared/`).
3. Entrada em `src/config/navigation.ts` com matriz de roles.
4. Chaves de tradução nos 5 arquivos de `src/messages/`.
5. Smoke Playwright se for fluxo CRUD.

### Nova feature module
1. Criar `src/features/<nome>/` com: `schemas.ts`, `use-<recurso>.ts`, `<recurso>-form-dialog.tsx` (`useAppForm` + `zodResolver`).
2. Espelhar anatomia de `src/features/alerts/` ou `src/features/users/`.

### PR-ready
Rodar `/pr-ready`: valida `npm run validate`, paridade de locales, imports proibidos (`useForm` cru), presença de `force-dynamic` em rotas novas.

## Do Not

- ❌ Importar `useForm` de `react-hook-form` fora de `src/hooks/use-app-form.ts`.
- ❌ Enviar `Authorization: Bearer <token>` — o backend espera o token literal. Ver `src/lib/api-client.ts`.
- ❌ Trocar `skip` para offset 0-indexed. É 1-indexed page number. Ver `src/hooks/use-pagination.ts`.
- ❌ Converter endpoints de filtro de POST para GET.
- ❌ Adicionar routing de locale por URL (`/pt/...`). next-intl é usado **sem** routing.
- ❌ Persistir sessão em cookies ou localStorage. Só em `sessionStorage['alertport_session']`.
- ❌ Prerenderizar rotas autenticadas. Sempre `force-dynamic`.
- ❌ Adicionar chave em `pt.json` sem propagar para en/es/ja/zh.
- ❌ Mutar o repo `shieldgo-admin-web` — é fonte de referência, não destino.
- ❌ `git commit --amend`, `--force push`, `reset --hard`, `--no-verify`, `--no-gpg-sign` sem ordem explícita.
- ❌ Inventar APIs do Next 16 de memória. Ler docs no `node_modules/next/dist/docs/` antes.

## Known Failure Modes

- **Silent form submit**: caller passou `form.handleSubmit(onValid)` com `useForm` cru; Zod rejeita e nada acontece. Fix: `useAppForm`.
- **Missing locale key**: UI mostra `users.title` literal. Fix: paridade nos 5 arquivos.
- **Loop 401**: interceptor destrói sessão e redireciona em qualquer 401. Não lançar 401 a partir de probe não-autenticado.
- **FormData Content-Type**: não setar manualmente — Axios precisa gerar o boundary. Ver `src/lib/api-client.ts`.
- **service:unavailable banner**: 2 falhas 5xx/rede consecutivas disparam o evento. Não fazer retry-bomb.
- **Firestore push**: documentos são **deletados após processamento**. Não re-ler.
- **Auto-scope**: `src/hooks/use-filters.ts` aplica account/client/site da sessão. Bypassar quebra endpoints para roles mais estreitos.

## How to Ask

- "Adicionar endpoint X → service → hook → invalidation" (usar playbook).
- "Adicionar chave i18n X.y em todos os locales" (`/i18n-add`).
- "Rodar `/validate` antes de propor PR."
- Dúvida em contrato? Ler `.claude/rules/api-contracts.md` e parar antes de alterar.

## Arquivos críticos (navegar primeiro)

- `src/config/endpoints.ts` — contratos de URL.
- `src/lib/api-client.ts` — interceptors Axios, retry, 401.
- `src/hooks/use-pagination.ts` — quirk `skip` 1-indexed.
- `src/hooks/use-filters.ts` — auto-scope de hierarquia.
- `src/hooks/use-app-form.ts` — wrapper obrigatório de formulário.
- `src/lib/session.ts` — ciclo de vida da sessão.
- `src/config/roles.ts` + `src/config/navigation.ts` — matriz de acesso.
- `src/features/alerts/realtime.ts` + `src/features/calls/use-call.ts` — tempo real.
