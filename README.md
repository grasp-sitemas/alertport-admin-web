# AlertPort Admin Web

Painel administrativo do AlertPort — extraído do projeto `shieldgo-admin-web` e reescrito em stack moderna preservando **100 % dos contratos de backend**.

> Vigilância conectada: o vigia não dorme no posto.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| UI | **React 19** · TypeScript strict · Tailwind CSS v4 |
| State (servidor) | **TanStack Query v5** |
| State (sessão) | sessionStorage + custom hooks (`useSyncExternalStore`) |
| Formulários | **React Hook Form + Zod** |
| i18n | **next-intl v4** — pt · en · es · ja · zh |
| HTTP | **Axios** com interceptors (auth · retry · 401 handling) |
| Primitives | Radix UI (Dialog, Select, Dropdown, Toast…) |
| Icons | Lucide React |
| Fonts | Sora (heading) · Manrope (body) |
| Testes | Vitest + Testing Library + Playwright |

## Pré-requisitos

- **Node.js ≥ 22** (use `.nvmrc`)
- **npm ≥ 10**

## Setup

```bash
nvm use                    # ou nvm install 22
cp .env.example .env.local
npm install
npm run dev                # → http://localhost:3000
```

## Variáveis de ambiente

Arquivos disponíveis:
- `.env.example` — template
- `.env.local` — desenvolvimento (HML por padrão)
- `.env.production` — produção (commit no repo, sem secrets reais)

Todas as variáveis são prefixadas com `NEXT_PUBLIC_` (embarcadas no bundle client).
**Não coloque secrets reais em arquivos `.env`** — use o secret manager do seu host (Vercel/AWS/…) para injetar TURN passwords, chaves privadas etc.

### API / backend
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend (gateway) |

### WebSocket / Chat (ligação operador ↔ dispositivo)
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_MS_CHAT_URL` | URL do servidor ms-chat (Socket.IO) |

### WebRTC (ICE servers)
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_WEBRTC_ICE_SERVERS` | JSON array com toda a config de ICE (precedência máxima) |
| `NEXT_PUBLIC_WEBRTC_TURN_URLS` | URLs TURN separadas por vírgula |
| `NEXT_PUBLIC_WEBRTC_TURN_USERNAME` | Usuário TURN |
| `NEXT_PUBLIC_WEBRTC_TURN_PASSWORD` | Credencial TURN |

### Firebase (Firestore real-time)
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Measurement ID |

### App / observabilidade
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_APP_MODE` | `development` ou `production` |
| `NEXT_PUBLIC_IS_PRODUCTION` | `true` / `false` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Locale padrão (default `pt`) |
| `NEXT_PUBLIC_MASTER_ADMIN_EMAILS` | Whitelist SUPER_ADMIN_MASTER (vazio = todos) |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN do Sentry |

## Scripts

```bash
npm run dev           # Dev server (Turbopack)
npm run build         # Production build
npm run start         # Servir build de produção
npm run typecheck     # TypeScript strict
npm run lint          # ESLint
npm run lint:fix      # ESLint --fix
npm run format        # Prettier
npm test              # Vitest (unit + integration)
npm run test:watch    # Vitest watch mode
npm run test:e2e      # Playwright
npm run validate      # typecheck + lint + test + build (CI-style gate)
npm run clean         # Remove .next / .turbo
```

## Tempo real: WebSocket, chamadas e Firestore

### Chat / chamadas (ms-chat via Socket.IO)

Eventos espelham exatamente o contrato legado de `shieldgo-admin-web/src/config/websocket.js`:

**Emitidos pelo cliente:** `user:register`, `call:start`, `call:accept`, `call:reject`, `call:end`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice`, `call:recording:upload`.

**Recebidos:** `connect`, `disconnect`, `user:list`, `call:incoming`, `call:accept`, `call:reject`, `call:end`, `call:duration:tick`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice`.

Fluxo completo de chamada (operador ↔ dispositivo) implementado em [src/features/calls/use-call.ts](src/features/calls/use-call.ts):
- Auto-registro no `connect` com `clientType: 'ADMIN_MONITOR'`
- Auto-reconexão infinita (Socket.IO built-in, 1s delay)
- Estados: `idle → connecting → outgoing/incoming → connected → ended`
- Modo **NORMAL** (áudio bidirecional) e **SILENT_LISTEN** (mic travado — escuta SOS)
- Fila de ofertas/ICE para lidar com pacotes que chegam antes do `PeerConnection` estar pronto
- Limpeza total no disconnect/unmount: streams, tracks, listeners — sem vazamentos
- UI: [CallDialog](src/features/calls/call-dialog.tsx) com aceitar / rejeitar / encerrar, mute mic/áudio, timer MM:SS e badge de status do chat

### Firestore real-time (notificações push)

Assinaturas criadas em [src/features/alerts/realtime.ts](src/features/alerts/realtime.ts), espelhando `shieldgo-admin-web/src/App.vue` + `AlertMonitor.vue`:

| Coleção | Uso |
|---|---|
| `notifications/{siteId}` | SOS / INCIDENT / CRASH / LOWVOLTAGE / TIME_ENTRY — filtra `source === 'ALERTPORT'` |
| `updatedMedias/{siteId}` | Push de foto, assinatura ou áudio |
| `updateAttendanceEvent/{siteGroupId}` | Atualização live de atendimento |
| `updateCloseAttendanceEvent/{siteGroupId}` | Atendimento encerrado |
| `updateAttendanceEventReport/{siteGroupId}` | Refresh do histórico |

Cada documento é deletado após processamento (padrão legado) para evitar reprocessamento.
O hook [useAlertportRealtime](src/features/alerts/use-realtime.ts) invalida as queries TanStack correspondentes, atualizando a UI em tempo real sem polling.

## Logo e identidade

O arquivo `public/logo.png` é a logo oficial. É consumida via `next/image` no componente
[Logo](src/components/layout/logo.tsx) e aparece no login, sidebar e demais pontos de branding.

## Estrutura

```
src/
├── app/                     # Rotas (Next.js App Router)
│   ├── (app)/               # Rotas autenticadas (layout com sidebar)
│   │   ├── dashboard/
│   │   ├── alerts/
│   │   │   ├── occurrences/
│   │   │   ├── scheduling/
│   │   │   └── monitor/
│   │   ├── attendance/      # Controle de presença
│   │   ├── users/
│   │   ├── collaborators/
│   │   ├── clients/         # Cadastro de clientes
│   │   ├── sites/           # Cadastro de postos (com ViaCEP + geo)
│   │   ├── equipment/
│   │   └── company/
│   ├── login/               # Rota pública
│   ├── layout.tsx           # Root layout (providers)
│   ├── page.tsx             # Redireciona → /login ou /dashboard
│   └── globals.css          # Design tokens AlertPort
│
├── components/
│   ├── ui/                  # Primitivos (Button, Input, Dialog, Table…)
│   ├── layout/              # AppShell, Sidebar, Header, Logo, LocaleSwitcher
│   ├── shared/              # DataTable, FilterPanel, PageHeader, RoleGuard…
│   └── providers/           # Intl, Query, Auth, Toaster
│
├── features/                # Lógica por domínio
│   ├── auth/                # schemas, useLogin
│   ├── dashboard/           # useDashboardData, KpiCard
│   ├── alerts/              # schemas, hooks, ScheduleFormDialog, realtime, useRealtime
│   ├── calls/               # useCall (WebRTC+Socket.IO), CallDialog
│   ├── clients/             # schemas, ClientFormDialog
│   ├── sites/               # schemas, SiteFormDialog (ViaCEP + geo)
│   └── users/ · collaborators/ · equipment/ · company/
│
├── services/                # Camada HTTP (1 arquivo por domínio)
│   ├── auth.service.ts
│   ├── users.service.ts
│   ├── company.service.ts
│   ├── equipment.service.ts
│   ├── alerts.service.ts
│   └── helpers.service.ts
│
├── hooks/                   # use-auth, use-pagination, use-filters, use-locale
├── lib/                     # api-client (axios), session, utils
├── config/                  # endpoints, roles, navigation, i18n
├── types/                   # api.ts (contratos)
└── messages/                # pt/en/es/ja/zh (JSON)
```

## Autenticação

- Login em `POST /api/users/system/login/v1/` (contrato legado preservado)
- Sessão persistida em `sessionStorage` (`alertport_session`)
- Token injetado em todo request via interceptor Axios (header `Authorization`)
- `x-correlation-id` propagado quando disponível
- 401 → destrói sessão e redireciona para `/login`
- Retry automático em 5xx/408/429 (até 2 tentativas, delay 1s)

## Controle de acesso

Matriz de papéis (`src/config/roles.ts` + `src/config/navigation.ts`):

| Rota | SUPER_ADMIN_MASTER | ADMIN_MASTER | ADMIN | MANAGER | OPERATOR | AUDITOR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alert Monitor | ✓ | — | ✓ | ✓ | ✓ | — |
| Alert Occurrences (timeline) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Time Entries (presença) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alert Scheduling | ✓ | — | ✓ | ✓ | — | — |
| Users | ✓ | ✓ | ✓ | — | — | — |
| Collaborators | ✓ | ✓ | ✓ | ✓ | — | — |
| Clients | ✓ | ✓ | ✓ | ✓ | — | — |
| Sites | ✓ | ✓ | ✓ | ✓ | — | — |
| Equipment | ✓ | ✓ | ✓ | ✓ | — | — |
| Company | ✓ | ✓ | ✓ | — | — | — |

`RoleGuard` encapsula a renderização condicional e redireciona para `/dashboard` quando não autorizado.

## i18n

- 5 idiomas prontos: **pt (default), en, es, ja, zh**
- Arquivos JSON em `src/messages/`
- Locale armazenada em `localStorage` (`alertport_locale`)
- `LocaleSwitcher` no header
- Pluralização e formatação de datas via ICU (next-intl)

## Design System

Tokens alinhados ao site institucional https://alertport.vercel.app:

- **Brand**: `#B3261E` (red 600) / `#8C1D18` (red 700 hover)
- **Background**: `#0a0e1a` (primary) / `#111827` (secondary) / `#1a2234` (tertiary)
- **Text**: `#f8fafc` · `#94a3b8` · `#64748b`
- **Fontes**: Sora 600/700 (headings) · Manrope 400/500/600 (body)
- **Raios**: xl 12 · 2xl 16 · 3xl 24
- **Utilitários**: `.glass-card`, `.glow-red`, `.bg-grid-pattern`, `.bg-app-gradient`

## Desenvolvimento

### Adicionar uma nova rota protegida

1. Criar pasta em `src/app/(app)/nova-rota/`
2. Adicionar `page.tsx` (client component)
3. Envolver com `<RoleGuard roles={[...]}>` se precisar de controle por perfil
4. Adicionar entrada em `src/config/navigation.ts` (com roles)
5. Adicionar chaves de tradução nos 5 arquivos de `src/messages/`

### Adicionar um novo endpoint

1. Declarar em `src/config/endpoints.ts`
2. Adicionar método no service correspondente em `src/services/`
3. Criar hook TanStack Query na feature (ex: `src/features/alerts/use-occurrences.ts`)

## Segredos locais (.env.local)

`.env.local` é gitignorado por padrão, **mas** permanece em texto
claro no laptop do dev. Boas práticas:

- **Nunca** subir backup de `.env.local` para iCloud, Dropbox, Google
  Drive ou pasta com sync compartilhado.
- Use `vercel env pull .env.local` para sincronizar com a Vercel sempre
  que precisar das chaves; isso evita ter `SENTRY_AUTH_TOKEN` /
  `VERCEL_OIDC_TOKEN` parados em disco por meses.
- Se vazar (commit acidental, compartilhamento de pasta), **rotacione**:
  - `SENTRY_AUTH_TOKEN` → `https://sentry.io/settings/account/api/auth-tokens/`
  - `VERCEL_OIDC_TOKEN` → emitido automaticamente; rotacione recriando o
    link do projeto Vercel (`vercel link --project ...`).
- `.env.hml` e `.env.production` versionados (templates apenas) **não
  devem ganhar segredos privados.** Veja `.gitignore` — o allowlist
  foi comentado para forçar adoção do Vercel Env como fonte de verdade.

## Documentação adicional

- [ARCHITECTURE.md](./ARCHITECTURE.md) — decisões técnicas e diagramas
- [MIGRATION.md](./MIGRATION.md) — mapeamento do escopo migrado a partir de shieldgo-admin-web
