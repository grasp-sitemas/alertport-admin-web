---
description: Cria rota protegida nova com RoleGuard, navigation e chaves i18n
argument-hint: <path> [roles csv]
---

Criar rota protegida em `src/app/(app)/$1/` com roles `$2` (default: todos exceto AUDITOR).

Playbook de `CLAUDE.md` → "Nova rota protegida":

1. Criar `src/app/(app)/$1/page.tsx`:
   - `'use client';`
   - `export const dynamic = 'force-dynamic';`
   - Envolver conteúdo em `<RoleGuard roles={[...]}>` de `src/components/shared/`.
2. Adicionar entrada em `src/config/navigation.ts` com matriz de roles.
3. Atualizar `.claude/rules/roles-matrix.md` com a nova linha.
4. Adicionar chaves de tradução em **todos os 5 arquivos** de `src/messages/` no namespace apropriado (`sidebar`, `<feature>`).
5. Se for CRUD: criar smoke Playwright em `tests/e2e/$1.spec.ts`.

Regras:
- `force-dynamic` é obrigatório (rota lê sessionStorage).
- i18n em 5 arquivos (use `/i18n-add`).
- Roles ficam sincronizados entre `navigation.ts`, `<RoleGuard>` e a matriz em `.claude/rules/roles-matrix.md`.

Ao final, rode `/validate`.
