---
name: tanstack-query
description: Query/mutation patterns com invalidação e retry alinhados ao interceptor Axios
---

# TanStack Query — padrão AlertPort

## Query key convention

Tuple: `['<domínio>', '<operação>', ...params]`.

```ts
const queryKey = ['users', 'list', { skip, limit, filters }] as const;
```

## List (paginated filter)

```ts
import { useQuery } from '@tanstack/react-query';
import { usersService } from '@/services/users.service';
import { useFilters } from '@/hooks/use-filters';
import { usePagination } from '@/hooks/use-pagination';

export function useUsers() {
  const filters = useFilters();       // auto-scope account/client/site
  const { skip, limit } = usePagination();  // skip é 1-indexed

  return useQuery({
    queryKey: ['users', 'list', { skip, limit, filters }],
    queryFn: () => usersService.filter({ skip, limit, ...filters }),
  });
}
```

## Mutation + invalidação

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateUsers } from '@/lib/query-invalidation';

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersService.create,
    onSuccess: () => invalidateUsers(qc),
  });
}
```

## Invalidação

Use helpers em `src/lib/query-invalidation.ts`:
```ts
export const invalidateUsers = (qc: QueryClient) =>
  qc.invalidateQueries({ queryKey: ['users'] });
```

Não invalidar por string solta. Não usar `qc.removeQueries` sem motivo (quebra estado otimista).

## Retry

O interceptor Axios já faz retry 5xx/408/429 até 2×. **Não configurar retry extra** em `useQuery` — duplica tentativas.

```ts
useQuery({
  queryKey: [...],
  queryFn: ...,
  retry: false, // interceptor cuida
});
```

## Staleness

`staleTime` global configurado no `QueryProvider`. Ajustar por query só com motivo claro.

## Não

- ❌ Não transformar query em `useMutation` só porque o endpoint é POST (filtros são POST por design).
- ❌ Não tipar retorno manualmente — inferência é suficiente.
- ❌ Não combinar server state com useState local (fonte única: TanStack Query).
