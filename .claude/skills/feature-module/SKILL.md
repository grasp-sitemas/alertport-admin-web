---
name: feature-module
description: Anatomia de um feature module em src/features/
---

# Feature module — anatomia

## Estrutura

```
src/features/<domínio>/
├── schemas.ts               # Zod + types
├── schemas.test.ts          # Vitest para schemas
├── use-<recurso>.ts         # Hooks TanStack Query
├── <recurso>-form-dialog.tsx
├── <recurso>-columns.tsx    # Opcional — DataTable columns
├── realtime.ts              # Opcional — Firestore subs
└── index.ts                 # Barrel export (opcional)
```

## Nomenclatura

- Pasta: kebab-case (`bulk-import`, `call-center`).
- Arquivo: kebab-case (`user-form-dialog.tsx`).
- Hook: `use-<coisa>.ts` → export `use<Coisa>`.
- Componente: PascalCase (`UserFormDialog`).
- Schema: camelCase (`userSchema`, `userCreateSchema`).

## Hooks típicos

```ts
// use-users.ts
export function useUsers() { /* list */ }
export function useUser(id: string) { /* detail */ }
export function useCreateUser() { /* mutation */ }
export function useUpdateUser() { /* mutation */ }
export function useDeleteUser() { /* mutation */ }
```

## Barrel export

Apenas se ≥ 3 componentes são consumidos externamente. Evite over-export.

## Cross-feature sharing

Se algo precisa em 2+ features → mover para `src/features/shared/` ou `src/components/shared/`.

## Referência

`src/features/alerts/` e `src/features/users/` são os exemplares canônicos.
