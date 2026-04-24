# Roles Matrix — 6 perfis

## Perfis (subtypes do backend)

| Role | Backend subtype | Escopo |
|---|---|---|
| Super Admin | `SUPER_ADMIN_MASTER` | Tudo (requer whitelist de email via `NEXT_PUBLIC_MASTER_ADMIN_EMAILS`) |
| Admin Master | `ADMIN_MASTER` | Gestão + timelines |
| Admin | `ADMIN` | Gestão + agendamento + monitoring |
| Gerente | `MANAGER` | Agendamento + monitoring + colaboradores/equipamentos |
| Operador | `OPERATOR` | Monitoring + timelines |
| Auditor | `AUDITOR` | Apenas timelines (leitura) |

## Matriz (rota × role)

| Rota | SUPER_ADMIN_MASTER | ADMIN_MASTER | ADMIN | MANAGER | OPERATOR | AUDITOR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alert Monitor | ✓ | — | ✓ | ✓ | ✓ | — |
| Alert Occurrences | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Time Entries | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alert Scheduling | ✓ | — | ✓ | ✓ | — | — |
| Users | ✓ | ✓ | ✓ | — | — | — |
| Collaborators | ✓ | ✓ | ✓ | ✓ | — | — |
| Clients | ✓ | ✓ | ✓ | ✓ | — | — |
| Sites | ✓ | ✓ | ✓ | ✓ | — | — |
| Equipment | ✓ | ✓ | ✓ | ✓ | — | — |
| Company | ✓ | ✓ | ✓ | — | — | — |
| Companies (platform) | ✓ | — | — | — | — | — |

## Implementação

- **Fonte da matriz**: `src/config/roles.ts` (definição + guardas) + `src/config/navigation.ts` (filtragem do menu).
- **Enforcement de rota**: `<RoleGuard roles={[...]}>` de `src/components/shared/` — redireciona para `/dashboard` se não autorizado.
- **Auto-scope**: `src/hooks/use-filters.ts` aplica account/client/site da sessão automaticamente.

## Ao adicionar rota nova

1. Decidir quais roles acessam.
2. Adicionar em `navigation.ts` com array de roles.
3. Envolver `page.tsx` com `<RoleGuard roles={[...]}>`.
4. Atualizar esta matriz (edite este arquivo).
