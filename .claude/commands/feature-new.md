---
description: Scaffold de feature module seguindo a anatomia canônica
argument-hint: <nome-do-domínio>
---

Criar feature module `src/features/$1/`.

Estrutura (ver `.claude/rules/features.md`):

```
src/features/$1/
├── schemas.ts                  # Zod + types inferidos
├── use-$1.ts                   # Hooks TanStack Query (list/get/create/update/delete)
└── $1-form-dialog.tsx          # CRUD dialog com useAppForm + zodResolver
```

Convenções:
- Pasta/arquivos em kebab-case.
- Identificadores em camelCase (`useList$Nome`, `$NomeSchema`).
- Componentes em PascalCase (`$NomeFormDialog`).
- Espelhar `src/features/alerts/` ou `src/features/users/`.

Do:
1. Criar schemas com `z.infer` e exportar types.
2. Criar hooks TanStack Query com query keys `['$1', '<op>', ...]`.
3. Criar dialog com `useAppForm` + `zodResolver`.
4. Se usar API nova: rodar `/endpoint-new` primeiro.

Não:
- ❌ `useForm` cru (usar `useAppForm`).
- ❌ Token com `Bearer`.
- ❌ Hardcode de strings em JSX (usar `useTranslations`).
