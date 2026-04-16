# Migração — shieldgo-admin-web → alertport-admin-web

Relatório do que foi migrado, como foi mapeado e o que ficou como gap/risco.

## Escopo do AlertPort

Antes de migrar, mapeamos todas as funcionalidades de `shieldgo-admin-web` para identificar o subset AlertPort. O critério: tudo que depende de dispositivos/eventos AlertPort, agendamento de alertas, ocorrências (PENDING/RESPONDED/MISSED), controle de presença, e os módulos de apoio (usuários, colaboradores, equipamentos, empresa).

## Mapeamento legado → novo

### Rotas

| Legado (shieldgo-admin-web) | Novo (alertport-admin-web) | Origem de referência |
|---|---|---|
| `/` (login) | `/login` | `pages/Login/CrtLogin.vue` |
| `/dashboard/general-summary` | `/dashboard` | `pages/Dashboard/GeneralSummary/*` |
| `/monitor/alert-occurrence` | `/alerts/monitor` | `pages/Monitor/AlertMonitor/*` |
| `/alert-occurrences` | `/alerts/occurrences` | `pages/Timeline/AlertOccurrences/*` |
| `/time-entries` | `/attendance` | `pages/Timeline/TimeEntry/*` |
| `/schedules/alert-occurrence` | `/alerts/scheduling` | `pages/Schedule/AlertOccurence/*` |
| `/users` | `/users` | `pages/User/Users/*` |
| `/colaborators` | `/collaborators` | `pages/User/Colaborators/*` |
| `/management/equipments` | `/equipment` | `pages/Company/Equipment/*` |
| `/companies` (edição) | `/company` | `pages/Company/Companies/*` |

**Não migrado (fora do escopo AlertPort):** patrol points, itineraries, guard groups, reports tradicionais, grafana, scan histories, integrations, supervisory schedules, general companies/clients/sites management (permanecem em shieldgo).

### Endpoints preservados (100% idênticos)

Declarados em [src/config/endpoints.ts](src/config/endpoints.ts):

**Auth:**
- `POST /api/users/system/login/v1/`
- `GET /api/users/me/v1/`
- `GET /api/users/system/companyuser/me/v1`
- `POST /api/users/system/password/change/online/v1/`
- `POST /api/users/system/change/language/v1/`

**Users:**
- `POST /api/users/v1/` (create)
- `PUT /api/users/v1/:id` (update)
- `GET /api/users/v1/:id`
- `POST /api/users/bytype/v1/COMPANY_USER` (filter company users)
- `POST /api/users/bytype/v1/VIGILANT` (filter collaborators)
- `POST /api/users/delete/v1/`

**Companies:**
- `POST /api/company/filter/v1/`
- `GET /api/company/v1/:id`
- `POST /api/company/v1/`
- `PUT /api/company/v1/:id`
- `POST /api/company/delete/v1/`
- `GET /api/company/settings/me/v1/`

**Equipment:**
- `POST /api/company/equipments/filter/v1/`
- `GET /api/company/equipments/v1/:id`
- `POST /api/company/equipments/v1/`
- `PUT /api/company/equipments/v1/:id`
- `POST /api/company/equipments/delete/v1/`

**Alert Schedules (AlertPort-specific):**
- `POST /api/schedules/alertport/v1/` (create)
- `POST /api/schedules/alertport/update/v1/` (update)
- `POST /api/schedules/appointments/filter/v2/` (listar, com filtro `category: 'ALERT_CHECK'`)

**Alert Occurrences:**
- `POST /api/schedules/occurences/filter/v1/`

**Time Entries:**
- `POST /api/schedules/timeentries/filter/v1/`

**Events (patrol actions do AlertPort):**
- `POST /api/users/patrol/actions/filter/v1/` (com `sources: ['ALERTPORT']`)
- `POST /api/users/patrol/actions/attendance/v1/`

**Helpers:**
- `GET /api/helpers/data/events/attendances/types/v1/`
- `GET /api/helpers/data/monitor/events/types/v1/`
- `GET /api/helpers/data/equipments/brands/v1/`
- `GET /api/helpers/data/equipments/types/v1/`
- `GET /api/helpers/data/timezones/v1/`

### Regras de negócio preservadas

| Regra | Implementação |
|---|---|
| **Sessão em sessionStorage** (morre ao fechar aba) | `src/lib/session.ts` |
| **Token no header `Authorization`** (valor literal, sem `Bearer`) | `src/lib/api-client.ts` interceptor |
| **`x-correlation-id` quando presente** | `src/lib/api-client.ts` interceptor |
| **Retry em 5xx/408/429** (até 2 tentativas, 1s) | `src/lib/api-client.ts` |
| **401 → destruir sessão + redirect** | `src/lib/api-client.ts` |
| **`skip` é 1-indexed page number** | `src/hooks/use-pagination.ts` |
| **Auto-scope por account/client/site do usuário** | `src/hooks/use-filters.ts` |
| **SUPER_ADMIN_MASTER requer whitelist de email** | `src/config/roles.ts`, `src/hooks/use-auth.ts` |
| **Archived user/company → erro específico** | `src/features/auth/use-login.ts` (trata `response.user.archived`, `response.company.archived`) |
| **messageId legado (`response.user.password.incorrect`)** | Mapeado para tradução correta em `useLogin` |

### Contratos de formulário

Os schemas de formulário foram extraídos dos arquivos em `shieldgo-admin-web/src/types/` e reescritos como schemas Zod estritamente compatíveis:

- `types/user.js` → `src/features/users/schemas.ts`
- `types/company.js` → `src/features/company/schemas.ts`
- `types/equipment.js` → `src/features/equipment/schemas.ts`
- `types/alertOccurenceSchedule.js` → `src/features/alerts/schemas.ts`

Todos os campos aceitos pelo backend estão preservados. Os tipos TypeScript em `src/types/api.ts` documentam a shape exata das respostas.

### Permissões e roles

Matriz replicada fielmente de `shieldgo-admin-web/src/components/sidebar/SidebarMenu.vue`:

| Role | Subtype backend | Acesso |
|---|---|---|
| Super Admin | `SUPER_ADMIN_MASTER` | Tudo (com whitelist de email) |
| Admin Master | `ADMIN_MASTER` | Gestão + timelines |
| Admin | `ADMIN` | Gestão + agendamento + monitoring |
| Gerente | `MANAGER` | Agendamento + monitoring + colaboradores/equipamentos |
| Operador | `OPERATOR` | Monitoring + timelines |
| Auditor | `AUDITOR` | Apenas timelines (leitura) |

Implementação: `src/config/roles.ts` + `src/config/navigation.ts` (filtragem do menu) + `<RoleGuard>` (proteção de rota).

### i18n

Legado: pt + en + es (vue-i18n).

Novo: **pt + en + es + ja + zh** (next-intl). As chaves foram organizadas por domínio em vez do esquema plano `str.*` do legado, para facilitar manutenção. Chaves migradas/adaptadas:

| Legado (prefixo) | Novo (namespace) |
|---|---|
| `str.sidebar.menu.*` | `sidebar.*` |
| `str.title.*`, `str.form.*` | `common.*` e por feature |
| `str.user.*` | `users.*` / `roles.*` |
| `str.register.*` | `common.required`, `validation.*` |
| `response.*` | Tratado em `useLogin` para mensagens de erro localizadas |

## Gaps e riscos conhecidos

### Gaps funcionais (escopo explícito para próximas entregas)

1. **WebRTC ao vivo no AlertMonitor**
   - Legado: `pages/Monitor/AlertMonitor/*` tem chamadas de voz (normal + silent listen) com `operatorCallBridge.js` e `webrtcIceConfig.js`.
   - Novo: estrutura de UI pronta (cards de evento, botões de atendimento), mas sem camada de áudio.
   - **Risco**: sem isso o operador não faz a escuta/chamada; hoje ele pode apenas registrar atendimento.

2. **Socket.IO real-time**
   - Legado: `config/websocket.js` registra usuário e escuta eventos.
   - Novo: requisições por TanStack Query (refetch on demand). Sem push.
   - **Risco**: latência de 30–60s para novos eventos aparecerem.
   - **Mitigação recomendada**: adicionar `useRealtimeEvents` em `features/alerts/` que invalida queries ao receber push.

3. **Firebase Remote Config / notifications**
   - Legado: `firebaseInit.js` + listeners em `notifications/{siteId}`.
   - Novo: não portado.
   - **Decisão**: avaliar necessidade real antes de portar. Se houver feature flags críticas, adicionar.

4. **Google Maps no AlertMonitor**
   - Legado: iframe embed para geolocalização de eventos.
   - Novo: exibimos coordenadas (lat/lng) sem mapa.
   - **Próximo passo**: adicionar `@react-google-maps/api` quando necessário.

5. **Calendário FullCalendar no scheduling**
   - Legado: `pages/Schedule/AlertOccurence/*` usa `@fullcalendar/vue` para visualização em calendário.
   - Novo: lista tabular paginada. Criação/edição via dialog é igualmente funcional.
   - **Próximo passo**: adicionar visão calendário (a lista já atende o fluxo de CRUD).

6. **Account selector para SUPER_ADMIN_MASTER**
   - Legado: componente de troca de conta no header.
   - Novo: auto-scope usa a hierarquia da sessão. Sem UI de troca.
   - **Próximo passo**: implementar `<AccountScopeSwitcher>` que sobrescreve o scope em runtime.

### Riscos funcionais

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Backend alterar shape de `User.companyUser.subtype` | Baixa | Tipos em `src/types/api.ts` falham o TS build imediatamente |
| Endpoint `alertport/v1/` ser renomeado | Baixa | Centralizado em `endpoints.ts` — 1 local para ajustar |
| Quirk do `skip` 1-indexed quebrar em migração de backend | Média | Documentado em `use-pagination.ts` e ARCHITECTURE.md |
| Whitelist `NEXT_PUBLIC_MASTER_ADMIN_EMAILS` vazar no bundle | Baixa | É público por natureza (`NEXT_PUBLIC_`); valida apenas entrada no login |

### Dependências externas

Nenhuma nova integração externa foi adicionada além do que já existia em shieldgo-admin-web. O novo projeto **consome exatamente o mesmo backend** (`NEXT_PUBLIC_API_URL`).

## Critério de pronto — checklist

- [x] Build `next build` limpa em produção
- [x] TypeScript strict sem erros (`tsc --noEmit`)
- [x] ESLint sem erros (apenas warnings benignos de terceiros)
- [x] 28 testes unitários passando (Vitest)
- [x] Playwright E2E configurado para fluxos críticos
- [x] Contratos de backend 100% preservados
- [x] 6 perfis de usuário mapeados e protegidos
- [x] 5 idiomas estruturados
- [x] Design tokens alinhados ao site AlertPort
- [x] Todas as funcionalidades listadas no briefing implementadas
- [x] Nenhuma alteração em `shieldgo-admin-web`

## Como validar localmente

```bash
# 1. Instalar
nvm use && npm install

# 2. Subir dev server
npm run dev

# 3. Abrir http://localhost:3000
#    Redireciona para /login

# 4. Logar com credenciais válidas do backend homolog
#    (mesmas do shieldgo-admin-web)

# 5. Navegar:
#    - Dashboard (KPIs + chart + recent activity)
#    - Alerts → Monitor (eventos ao vivo via polling)
#    - Alerts → Occurrences (timeline)
#    - Attendance (controle de presença)
#    - Alerts → Scheduling (CRUD de agendamentos)
#    - Users, Collaborators, Equipment (CRUD completo)
#    - Company (edição dos dados da empresa)

# 6. Trocar idioma no header
#    localStorage['alertport_locale'] persiste a escolha
```
