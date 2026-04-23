# State — qual ferramenta para qual estado

| Tipo | Ferramenta | Exemplo |
|---|---|---|
| Server state (listas, detalhes, charts) | **TanStack Query** v5 | `useOccurrences()`, `useUsers()` |
| Session / auth | **`sessionStorage` + `useSyncExternalStore`** | `useAuth()`, `useSession()` |
| UI local (modais, tabs, loading) | **`useState`** | `const [open, setOpen] = useState(false)` |
| URL (filtros deep-linkable, tabs persistentes) | **`nuqs`** | `useQueryState('tab')` |
| Form state | **React Hook Form (via `useAppForm`)** | `form.register('email')` |

## Server state

- Query keys: tuple `['<domínio>', '<operação>', ...params]`.
- Invalidação: `src/lib/query-invalidation.ts` expõe helpers nomeados (`invalidateUsers`, `invalidateAlerts`). Não invalidar por string solta.
- `staleTime` padrão no QueryProvider — ajustar por query só quando necessário.
- Mutations sempre invalidam após sucesso.

## Session

- Storage: `sessionStorage['alertport_session']` (JSON `{ user, token, lastActivity }`).
- Propagação via `useSyncExternalStore` — SSR-safe.
- **Nunca** persistir em cookies ou `localStorage` — session morre com a aba por design.
- Limpeza: `clearSession()` em `src/lib/session.ts` (chamado no interceptor 401 e no logout).

## URL state

- `nuqs` para filtros que devem sobreviver ao refresh e ao back/forward.
- Default value no hook, não no componente.

## Pitfalls

- Evitar state duplicado (server + client). Se veio de API, fonte única é TanStack Query.
- `useState` em list items que deveriam compartilhar state → levantar para o parent ou URL.
- `React.Context` só para coisas verdadeiramente globais (tema, QueryClient). Não para state de feature.
