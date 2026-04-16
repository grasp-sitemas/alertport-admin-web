# Arquitetura — AlertPort Admin Web

## Objetivos

1. **Separação total** do `shieldgo-admin-web` preservando 100% dos contratos backend
2. Stack moderna sem regressão funcional
3. Escalabilidade por feature/domínio
4. Tipagem forte ponta-a-ponta
5. Reuso sistemático (design system + shared components + hooks + services)

## Camadas

```
┌─────────────────────────────────────────────────────┐
│  Pages (src/app/**)         [Next.js App Router]    │
│  ─ Orquestra hooks, composição de UI                │
└──────────────┬──────────────────────────────────────┘
               │ usa
┌──────────────▼──────────────────────────────────────┐
│  Features (src/features/**)                         │
│  ─ Schemas Zod, hooks de domínio, UI de feature     │
└──────────────┬──────────────────────────────────────┘
               │ usa
┌──────────────▼──────────────────────────────────────┐
│  Services (src/services/**)                         │
│  ─ Funções puras de HTTP (1:1 com endpoints legado) │
└──────────────┬──────────────────────────────────────┘
               │ usa
┌──────────────▼──────────────────────────────────────┐
│  Infra (src/lib/**, src/config/**)                  │
│  ─ Axios, sessão, tipos, endpoints, roles           │
└─────────────────────────────────────────────────────┘
```

Toda rota protegida vive dentro de `src/app/(app)/`. O `layout.tsx` desse grupo monta o `AppShell`, que é o único lugar que decide se o usuário está autenticado e despacha para o sidebar/header.

## Autenticação e sessão

### Por que sessionStorage?

O legado (`shieldgo-admin-web`) usa `vue-session` que persiste em sessionStorage. Mantemos o mesmo ciclo de vida:
- Sessão morre ao fechar a aba → comportamento esperado pelo cliente
- Permite múltiplas contas simultâneas em abas diferentes
- Sem cookies de servidor (a API já faz autenticação por header `Authorization`)

### Fluxo

1. `POST /api/users/system/login/v1/` com `{ email, login, password }`
2. Backend retorna `{ status: 200, result: User, token }`
3. `useLogin` valida:
   - `user.status !== 'ARCHIVED'`
   - `user.companyUser.subtype ∈ ADMIN_ALLOWED_SUBTYPES`
   - Se `SUPER_ADMIN_MASTER`: email na whitelist `NEXT_PUBLIC_MASTER_ADMIN_EMAILS`
4. Persiste em `sessionStorage['alertport_session']` via `setSession()`
5. `useSyncExternalStore` propaga a mudança para todos os consumidores de `useAuth()`
6. Redireciona para `/dashboard`

### Interceptors Axios

Localização: [src/lib/api-client.ts](src/lib/api-client.ts)

- **Request**: injeta `Authorization` e `x-correlation-id` lendo sessionStorage
- **Response 401**: destrói sessão e redireciona para `/login`
- **Response 5xx/408/429**: retry com backoff linear (até 2 tentativas)

## Gerenciamento de estado

| Tipo de estado | Ferramenta | Justificativa |
|---|---|---|
| Server state (listas, formulários de leitura, charts) | TanStack Query | Cache + invalidação + refetch + retry |
| Form state | React Hook Form | Performance + integração com Zod |
| Validação | Zod | Schema inferido em TS |
| Session/auth | sessionStorage + `useSyncExternalStore` | Compatibilidade com legado + SSR-safe |
| UI state (modais, tabs) | `useState` local | Evita complexidade desnecessária |
| URL state (filtros que devem persistir) | `nuqs` (disponível) | Deep-linking e back/forward funcionais |

## Contratos de API

**Regra crítica (imutável):** nenhum contrato do backend foi alterado. Todos os endpoints, nomes de campos, formatos de payload e respostas refletem exatamente o que já existia em `shieldgo-admin-web/src/common/Endpoints.vue`.

**Quirks preservados do legado:**
- `skip` em requests paginados é **1-indexed page number** (não offset). Ver [src/hooks/use-pagination.ts](src/hooks/use-pagination.ts).
- Autenticação via header `Authorization` com o token literal (não `Bearer <token>`).
- Filtros com account/client/site auto-scope pela hierarquia do usuário logado (lido da sessão em `use-filters.ts`).
- Requests `POST` para filtros (não GET com query params).

## Design System

### Tokens

Definidos em `@theme` em [src/app/globals.css](src/app/globals.css). Espelham o site público `alertport.vercel.app`:

```css
@theme {
  --color-brand-500: #B3261E;
  --color-bg-primary: #0a0e1a;
  --color-text-primary: #f8fafc;
  --font-heading: var(--font-sora);
  --font-body: var(--font-manrope);
}
```

### Componentes

Três níveis:

1. **UI primitives** (`components/ui/`): Button, Input, Dialog, Table, Select, Dropdown — baseados em Radix
2. **Shared** (`components/shared/`): DataTable, FilterPanel, PageHeader, ConfirmDialog, StatusBadge, RoleGuard
3. **Feature** (`features/*/`): dialogs e componentes específicos de domínio

Todas as variantes são construídas via `class-variance-authority` para type safety.

## i18n

### Escolha: next-intl sem routing

**Decisão:** usar next-intl para traduções, mas **sem** middleware de roteamento por locale (sem `/pt/...`, `/en/...`).

**Motivação:**
- O usuário efetua login → seleciona idioma no header → a escolha é armazenada em `localStorage`
- Toda a aplicação é cliente-autenticada (sessionStorage), então URLs públicas por locale não agregam valor
- Evita redirecionamentos em cascata e simplifica SSR

### Fluxo

1. `IntlProvider` lê `localStorage['alertport_locale']` via `useSyncExternalStore`
2. Carrega mensagens do locale ativo (import estático de JSON)
3. Fallback para `pt` (default) se locale inválido ou indefinido
4. Trocar locale → salva em localStorage → `window.location.reload()` para re-bootstrapping limpo

### Estrutura das chaves

Organizado por domínio (não por arquivo):

```json
{
  "common": { ... },      // Labels genéricos
  "auth": { ... },
  "sidebar": { ... },
  "dashboard": { ... },
  "alerts": { ... },
  "attendance": { ... },
  "users": { ... },
  "collaborators": { ... },
  "equipment": { ... },
  "company": { ... },
  "roles": { ... },
  "validation": { ... },
  "table": { ... },
  "notifications": { ... }
}
```

## Testes

| Escopo | Ferramenta | Cobertura |
|---|---|---|
| Utilities (cn, getInitials, getNestedValue) | Vitest | `src/lib/utils.ts` |
| Roles & permissions | Vitest | `src/config/roles.ts` |
| Sessão (persist/retrieve/clear) | Vitest | `src/lib/session.ts` |
| Auth validation | Vitest | `validateLoginUser` |
| Zod schemas | Vitest | login, user, equipment, alert schedule |
| Fluxos críticos UI | Playwright | Login, redirecionamento, validação |

**Quando adicionar um teste:**
- **Sempre** para novas regras de validação (Zod)
- **Sempre** para helpers/utilities puros
- **Sempre** para lógica de autorização/permissões
- **Playwright** para jornadas E2E críticas (login, criação de entidade principal, fluxo de atendimento)

## Decisões técnicas — sumário

| Decisão | Motivo |
|---|---|
| Next.js App Router (não Pages) | Padrão moderno, server components disponíveis quando necessário |
| `force-dynamic` em rotas autenticadas | Evita prerender de conteúdo que depende de sessionStorage |
| React Hook Form + Zod | Performance + tipagem + menor overhead que Formik |
| TanStack Query (não SWR) | API mais rica, melhor DX para mutations, devtools |
| Radix UI (não shadcn/ui direto) | Controle total sobre estilo, sem opinar sobre a infra |
| next-intl sem routing | SPA autenticada, locale no localStorage |
| Tailwind v4 (`@theme` nativo) | Tokens em CSS, sem config JS, melhor integração |
| sessionStorage (não JWT em cookie) | Compatibilidade total com backend legado |
| Axios (não fetch) | Interceptors nativos, retry config, já familiar ao time |

## Limitações conhecidas

1. **WebRTC / chamadas ao vivo**: o monitor legado tem WebRTC para escuta e chamada dos equipamentos AlertPort. A página `/alerts/monitor` está pronta para receber essa camada (event cards já renderizam e permitem iniciar/fechar atendimento) — a integração completa de áudio é uma próxima entrega.
2. **Socket.IO em tempo real**: a inscrição no WebSocket para updates ao vivo de eventos está esquematizada mas ainda não plugada (o monitor hoje faz polling via React Query). Adicionar em `features/alerts/use-realtime.ts`.
3. **Auto-scope por hierarquia**: replica o comportamento do legado, mas não há UI para um SUPER_ADMIN_MASTER trocar o escopo ativo — próximo incremento.
4. **Firebase Remote Config**: não portado (o legado usava para feature flags). Pode ser adicionado se necessário.

Tudo isso está documentado em [MIGRATION.md](./MIGRATION.md#gaps-e-riscos-conhecidos).
