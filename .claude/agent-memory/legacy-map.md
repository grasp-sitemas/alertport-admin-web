# Legacy Map — shieldgo-admin-web → alertport-admin-web

> Mapeamento canônico entre legado (Vue) e novo (Next 16). Consulte antes de "como era no legado?".

## Rotas

| Legado | Novo |
|---|---|
| `/` (login) | `/login` |
| `/dashboard/general-summary` | `/dashboard` |
| `/monitor/alert-occurrence` | `/alerts/monitor` |
| `/alert-occurrences` | `/alerts/occurrences` |
| `/time-entries` | `/attendance` |
| `/schedules/alert-occurrence` | `/alerts/scheduling` |
| `/users` | `/users` |
| `/colaborators` | `/collaborators` |
| `/management/equipments` | `/equipment` |
| `/companies` | `/company` |

## Arquivos de referência

| Legado (`shieldgo-admin-web/src/`) | Novo (`alertport-admin-web/src/`) |
|---|---|
| `common/Endpoints.vue` | `config/endpoints.ts` |
| `config/websocket.js` | `features/calls/use-call.ts` |
| `pages/Login/CrtLogin.vue` | `app/login/page.tsx` + `features/auth/use-login.ts` |
| `pages/Monitor/AlertMonitor/*` | `app/(app)/alerts/monitor/` + `features/alerts/realtime.ts` |
| `pages/Timeline/AlertOccurrences/*` | `app/(app)/alerts/occurrences/` |
| `pages/Timeline/TimeEntry/*` | `app/(app)/attendance/` |
| `pages/Schedule/AlertOccurence/*` | `app/(app)/alerts/scheduling/` + `features/alerts/schedule-form-dialog.tsx` |
| `pages/User/Users/*` | `app/(app)/users/` + `features/users/` |
| `pages/User/Colaborators/*` | `app/(app)/collaborators/` + `features/collaborators/` |
| `pages/Company/Equipment/*` | `app/(app)/equipment/` + `features/equipment/` |
| `pages/Company/Companies/*` | `app/(app)/company/` + `features/company/` |
| `components/sidebar/SidebarMenu.vue` | `config/navigation.ts` + `components/layout/sidebar.tsx` |
| `types/user.js` | `features/users/schemas.ts` + `types/api.ts` |
| `types/company.js` | `features/company/schemas.ts` |
| `types/equipment.js` | `features/equipment/schemas.ts` |
| `types/alertOccurenceSchedule.js` | `features/alerts/schemas.ts` |

## Fora de escopo (não migrado)

Permanecem em shieldgo (não fazem parte do AlertPort):
- Patrol points
- Itineraries
- Guard groups
- Reports tradicionais
- Grafana embeds
- Scan histories
- Integrations
- Supervisory schedules
- Gestão geral de companies/clients/sites

## i18n keys — migração

| Legado (prefixo) | Novo (namespace) |
|---|---|
| `str.sidebar.menu.*` | `sidebar.*` |
| `str.title.*`, `str.form.*` | `common.*` + por feature |
| `str.user.*` | `users.*` + `roles.*` |
| `str.register.*` | `common.required`, `validation.*` |
| `response.*` | Tratado em `useLogin` para erros localizados |

## Gaps conhecidos (legado tem, novo não)

Ver MIGRATION.md → "Gaps e riscos conhecidos":
1. WebRTC ao vivo no AlertMonitor (parcial)
2. Socket.IO push real-time (polling por ora)
3. Firebase Remote Config
4. Google Maps embed no AlertMonitor
5. Vista calendário em scheduling
6. Account selector para SUPER_ADMIN_MASTER
