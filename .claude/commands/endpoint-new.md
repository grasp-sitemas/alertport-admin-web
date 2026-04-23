---
description: Adiciona novo endpoint seguindo o golden path (endpoints.ts → service → hook → invalidation → contract test)
argument-hint: <domínio> <nome-da-operação> [método-http]
---

Adicionar endpoint para o domínio `$1`, operação `$2` (método: $3 ou default GET).

Execute o playbook de `CLAUDE.md` → "Novo endpoint":

1. Ler `src/config/endpoints.ts` e adicionar a URL (sem `Bearer`; POST para filtros; `skip` 1-indexed).
2. Adicionar método tipado em `src/services/$1.service.ts` usando `apiClient` de `src/lib/api-client.ts`.
3. Adicionar/extender types em `src/types/api.ts`.
4. Se precisar validar input: schema Zod em `src/features/$1/schemas.ts`.
5. Hook TanStack Query em `src/features/$1/use-$2.ts` (query key `['$1', '$2', filters]`).
6. Invalidação via `src/lib/query-invalidation.ts` (helper nomeado).
7. Stub de contract test em `tests/contracts/$1-$2.test.ts`.

Antes de finalizar, rode `/validate` e reporte.

**Regras invioláveis** (ver `.claude/rules/api-contracts.md`):
- Token literal, sem `Bearer`.
- `skip` 1-indexed.
- POST em filtros, não GET.
- Não alterar shape de payload existente.
