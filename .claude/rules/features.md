# Features — anatomia de um módulo de domínio

## Localização

`src/features/<nome>/` — kebab-case.

## Arquivos típicos

```
src/features/<domínio>/
├── schemas.ts              # Zod schemas + types inferidos
├── use-<recurso>.ts        # Hooks TanStack Query (list/get/create/update/delete)
├── <recurso>-form-dialog.tsx  # UI de CRUD com useAppForm
├── <recurso>-columns.tsx   # Definição de colunas do DataTable (opcional)
└── realtime.ts             # Firestore subscriptions (só features com tempo real)
```

## Convenções

- **Nomes de arquivo**: kebab-case (`user-form-dialog.tsx`, `use-occurrences.ts`).
- **Nomes de identificadores**: camelCase (`useOccurrences`, `userSchema`).
- **Componentes exportados**: PascalCase (`UserFormDialog`).
- **Hooks**: sempre começam com `use` e moram em `use-<coisa>.ts`.

## Hooks

- `useList<Thing>` → `useQuery` com filter POST, `skip` 1-indexed.
- `useCreate<Thing>` → `useMutation` + invalidação via `src/lib/query-invalidation.ts`.
- `useUpdate<Thing>` / `useDelete<Thing>` → mesmo padrão.
- Query keys: tuple `['<domínio>', '<operação>', filters]`.

## Schemas

- Input schema (form) pode diferir do output schema (API response).
- Use `z.infer<typeof schema>` e exporte o tipo junto do schema.
- Reaproveitar sub-schemas (endereço, telefone, etc.) de `src/features/shared/`.

## UI

- Dialog pattern: `<Thing>FormDialog` recebe `open`, `onOpenChange`, `initialData` (para edit), `onSuccess`.
- Listagem usa `<DataTable>` de `src/components/shared/`.
- Filtros via `<FilterPanel>` que usa `src/hooks/use-filters.ts`.

## Referência

Exemplares a copiar: `src/features/alerts/`, `src/features/users/`, `src/features/equipment/`.
